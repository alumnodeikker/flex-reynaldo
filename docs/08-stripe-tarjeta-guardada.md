# 08 — Guardar la tarjeta del usuario en Stripe

> **Proyecto Flex** · Stack: Next.js · Supabase · Zustand · Stripe  
> Nivel: Intermedio

---

## Visión general del flujo

El objetivo es que el usuario introduzca su tarjeta **una sola vez**. En todas las reservas siguientes, Stripe la recordará y solo tendrá que confirmar el pago con un clic.

```
Primera reserva
  Usuario           Next.js                 Supabase EF              Stripe
     │                 │                         │                      │
     │── Pagar ────────▶│                         │                      │
     │                 │── ¿tiene stripe_customer_id?                    │
     │                 │   No → crear Customer ──────────────────────────▶│
     │                 │◀── stripe_customer_id ───────────────────────────│
     │                 │── guardar stripe_customer_id en profiles         │
     │                 │── crear Checkout Session (setup_future_usage) ──▶│
     │◀── redirect ────│◀── { url } ─────────────────────────────────────│
     │── (usuario introduce la tarjeta en Stripe) ──────────────────────▶│
     │                 │                         │◀── Webhook ───────────│
     │◀── redirect success                       │── UPDATE reserva      │

Reserva siguiente
  Usuario           Next.js                 Supabase EF              Stripe
     │                 │                         │                      │
     │── Pagar ────────▶│                         │                      │
     │                 │── ¿tiene stripe_customer_id?                    │
     │                 │   Sí → crear Checkout Session con customer ─────▶│
     │◀── redirect ────│◀── { url } ─────────────────────────────────────│
     │                 │                                                  │
     │  (Stripe muestra la tarjeta guardada, usuario confirma) ──────────▶│
```

---

## Prerequisitos

Este apunte continúa desde el [07 — Stripe y Edge Functions](./07-stripe-y-edge-functions.md).  
Necesitas tener funcionando: la Edge Function `crear-checkout` y el webhook `stripe-webhook`.

---

## 1. Modificar la tabla `profiles`

Necesitamos guardar el ID de cliente de Stripe para cada usuario. Añade la columna en Supabase:

```sql
ALTER TABLE profiles
  ADD COLUMN stripe_customer_id TEXT;
```

El valor será `NULL` hasta que el usuario haga su primer pago. Desde ese momento, lo reutilizamos en todas las reservas.

---

## 2. Crear el Customer de Stripe al hacer el primer pago

Modificamos la Server Action `iniciarPagoReserva` para que, si el usuario no tiene `stripe_customer_id` todavía, lo cree en Stripe y lo guarde en la DB antes de crear el Checkout Session.

```js
// app/actions/reservas.js
'use server'

import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function iniciarPagoReserva({ salaId, inicio, fin, total }) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  // 1. Verificar usuario autenticado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  // 2. Obtener el perfil del usuario (incluye stripe_customer_id si ya existe)
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single()

  let stripeCustomerId = profile?.stripe_customer_id

  // 3. Si no tiene Customer en Stripe, crearlo ahora
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    stripeCustomerId = customer.id

    // Guardamos el ID para no tener que crearlo de nuevo
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', user.id)
  }

  // 4. Crear la reserva en DB (estado 'pendiente')
  const { data: reserva, error } = await supabase
    .from('reservas')
    .insert({
      sala_id:    salaId,
      cliente_id: user.id,
      inicio:     inicio.toISOString(),
      fin:        fin.toISOString(),
      total,
      estado:     'pendiente',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // 5. Llamar a la Edge Function con el customer ID
  const resp = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/crear-checkout`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        reservaId:        reserva.id,
        salaId,
        inicio:           inicio.toISOString(),
        fin:              fin.toISOString(),
        total,
        clienteId:        user.id,
        stripeCustomerId, // <-- nuevo
      }),
    }
  )

  if (!resp.ok) {
    const err = await resp.json()
    throw new Error(err.error ?? 'Error al crear el checkout')
  }

  const { url } = await resp.json()
  return url
}
```

---

## 3. Modificar la Edge Function `crear-checkout`

Añadimos `customer` y `setup_future_usage` al Checkout Session. Estos dos parámetros son los que hacen que Stripe guarde la tarjeta.

```js
// supabase/functions/crear-checkout/index.js
import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
})

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const {
      reservaId,
      salaId,
      inicio,
      fin,
      total,
      clienteId,
      stripeCustomerId, // <-- recibimos el customer ID
    } = await req.json()

    if (!reservaId || !total || total <= 0) {
      return new Response(
        JSON.stringify({ error: 'Datos de reserva inválidos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const session = await stripe.checkout.sessions.create({
      customer:             stripeCustomerId, // vinculamos el Customer
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency:     'eur',
            unit_amount:  Math.round(total * 100),
            product_data: {
              name: `Reserva Sala VIP Flex · ${new Date(inicio).toLocaleDateString('es-ES')}`,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Indica a Stripe que guarde el método de pago en el Customer
      // para que pueda usarse en futuros pagos sin que el usuario esté presente
      payment_intent_data: {
        setup_future_usage: 'off_session',
      },
      success_url: `${Deno.env.get('NEXT_PUBLIC_APP_URL')}/reserva/exito?reserva_id=${reservaId}`,
      cancel_url:  `${Deno.env.get('NEXT_PUBLIC_APP_URL')}/reserva/cancelada`,
      metadata: { reserva_id: reservaId, cliente_id: clienteId },
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    )

    await supabase
      .from('reservas')
      .update({ stripe_session: session.id })
      .eq('id', reservaId)

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Error en crear-checkout:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

> **Comportamiento en el checkout:**  
> - **Primera vez:** Stripe muestra el formulario completo de tarjeta.  
> - **Veces siguientes:** Stripe muestra la tarjeta guardada con los últimos 4 dígitos y el usuario solo hace clic en "Pagar".

---

## 4. Desplegar la Edge Function actualizada

```bash
supabase functions deploy crear-checkout
```

No necesitas tocar el webhook `stripe-webhook` — ya guarda el `payment_intent` en la reserva correctamente.

---

## 5. Verificar que funciona

### En el Dashboard de Stripe

1. Ve a **Customers** en el Dashboard de Stripe.
2. Después del primer pago, verás el Customer creado con el email del usuario.
3. Dentro del Customer → **Payment methods**: aparecerá la tarjeta guardada.

### En Supabase

```sql
-- Comprueba que se ha guardado el stripe_customer_id
SELECT id, email, stripe_customer_id FROM profiles WHERE stripe_customer_id IS NOT NULL;
```

---

## Reto Flex 🎸

Añade un apartado en el perfil del usuario (`/perfil/metodos-pago`) que:

1. Liste las tarjetas guardadas usando `stripe.paymentMethods.list({ customer: stripeCustomerId, type: 'card' })`.
2. Permita eliminar una tarjeta con `stripe.paymentMethods.detach(paymentMethodId)`.

> **Pista:** Necesitarás una nueva Server Action o API Route ya que estas llamadas a Stripe deben hacerse desde el servidor (nunca expongas la `STRIPE_SECRET_KEY` al cliente).

---

## Navegación

[← 07 — Stripe y Edge Functions](./07-stripe-y-edge-functions.md) · [09 — PWA y Entradas QR →](./09-pwa-y-entradas-qr.md)
