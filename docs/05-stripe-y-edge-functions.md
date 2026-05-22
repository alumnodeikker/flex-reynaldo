# 04 — Pagos con Stripe y Edge Functions

> **Proyecto Flex** · Stack: Next.js · Supabase · Zustand · Stripe  
> Nivel: Intermedio

---

## Visión general del flujo de pago

```
Cliente                  Next.js                  Supabase EF              Stripe
   │                        │                          │                      │
   │── Pulsar "Pagar" ──────▶│                          │                      │
   │                        │── crear reserva (pendiente)                      │
   │                        │── llamar EF checkout ───▶│                      │
   │                        │                          │── crear Session ─────▶│
   │                        │◀── { url } ─────────────│                      │
   │◀── redirect ───────────│                          │                      │
   │                        │                          │                      │
   │────────────────────────────── pago en Stripe ─────────────────────────▶│
   │                        │                          │                      │
   │                        │                          │◀── Webhook ──────────│
   │                        │                          │── UPDATE reserva     │
   │                        │                          │   estado = 'pagada'  │
   │                        │                          │── generar qr_token   │
   │◀── redirect success ───│                          │                      │
```

**¿Por qué Edge Functions para el webhook?**  
Las Edge Functions de Supabase corren cerca del usuario, son serverless y pueden usar la `service_role key` de forma segura (solo en el servidor). El webhook de Stripe necesita un endpoint HTTPS que valide la firma de Stripe y actualice la DB con permisos totales.

---

## Prerequisitos

```bash
pnpm add stripe @stripe/stripe-js
pnpm add -g supabase  # CLI de Supabase para desplegar Edge Functions
```

Variables de entorno necesarias:

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # solo servidor

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...             # solo servidor
STRIPE_WEBHOOK_SECRET=whsec_...           # obtenido al registrar el webhook
```

---

## 1. Edge Function: Crear Checkout Session

Las Edge Functions viven en `supabase/functions/<nombre>/index.js`.

```bash
supabase functions new crear-checkout
```

```js
// supabase/functions/crear-checkout/index.js
import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),  // compatibilidad con Deno
})

Deno.serve(async (req) => {
  // Solo permitimos POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const { reservaId, salaId, inicio, fin, total, clienteId } = await req.json()

    // Validación mínima de datos de entrada
    if (!reservaId || !total || total <= 0) {
      return new Response(
        JSON.stringify({ error: 'Datos de reserva inválidos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Creamos la Checkout Session de Stripe
    // 'total' viene en euros, Stripe trabaja en céntimos
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(total * 100),  // € → céntimos
            product_data: {
              name: `Reserva Sala VIP Flex · ${new Date(inicio).toLocaleDateString('es-ES')}`,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Redirige al frontend cuando el pago se completa o se cancela
      success_url: `${Deno.env.get('NEXT_PUBLIC_APP_URL')}/reserva/exito?reserva_id=${reservaId}`,
      cancel_url:  `${Deno.env.get('NEXT_PUBLIC_APP_URL')}/reserva/cancelada`,
      // Metadatos: los recuperamos en el webhook para identificar la reserva
      metadata: { reserva_id: reservaId, cliente_id: clienteId },
      // Caduca en 30 minutos (evita sesiones zombi)
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    })

    // Guardamos el stripe_session en la reserva (útil para reconciliar pagos)
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

---

## 2. Edge Function: Webhook de Stripe

```bash
supabase functions new stripe-webhook
```

```js
// supabase/functions/stripe-webhook/index.js
import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
})

/**
 * Genera un token único para el QR de entrada.
 * Usamos crypto.randomUUID() que es estándar en Deno y navegadores modernos.
 */
function generarQrToken() {
  return crypto.randomUUID()
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body      = await req.text()  // leer como texto para verificar firma

  let evento
  try {
    // Verificamos que el webhook viene REALMENTE de Stripe
    // Si la firma no cuadra, Stripe.constructEventAsync lanza un error
    evento = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')
    )
  } catch (err) {
    console.error('Firma de webhook inválida:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')  // bypasea RLS (correcto aquí)
  )

  // Solo nos interesan dos eventos de Stripe:
  switch (evento.type) {

    case 'checkout.session.completed': {
      const session   = evento.data.object
      const reservaId = session.metadata?.reserva_id

      if (!reservaId) break

      // Actualizamos la reserva: pagada + guardamos el Payment Intent + generamos QR
      const { error } = await supabase
        .from('reservas')
        .update({
          estado:         'pagada',
          stripe_payment: session.payment_intent,
          qr_token:       generarQrToken(),
        })
        .eq('id', reservaId)
        .eq('estado', 'pendiente')  // seguridad extra: solo si sigue pendiente

      if (error) console.error('Error actualizando reserva:', error)
      break
    }

    case 'checkout.session.expired': {
      // El usuario no pagó en 30 min → marcamos la reserva como cancelada
      const session   = evento.data.object
      const reservaId = session.metadata?.reserva_id

      if (!reservaId) break

      await supabase
        .from('reservas')
        .update({ estado: 'cancelada' })
        .eq('id', reservaId)
        .eq('estado', 'pendiente')

      break
    }

    default:
      // Ignoramos el resto de eventos
      console.log(`Evento ignorado: ${evento.type}`)
  }

  // Siempre devolvemos 200 para que Stripe no reintente el envío
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

---

## 3. Llamar a la Edge Function desde Next.js

```js
// app/actions/reservas.js
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server Action: crea la reserva en DB y redirige a Stripe Checkout.
 */
export async function iniciarPagoReserva({ salaId, inicio, fin, total }) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  // Verificar usuario autenticado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  // 1. Crear reserva en estado 'pendiente' (sin pago confirmado aún)
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

  // 2. Llamar a la Edge Function para obtener la URL de Stripe
  const resp = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/crear-checkout`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        reservaId:  reserva.id,
        salaId,
        inicio:     inicio.toISOString(),
        fin:        fin.toISOString(),
        total,
        clienteId:  user.id,
      }),
    }
  )

  if (!resp.ok) {
    const err = await resp.json()
    throw new Error(err.error ?? 'Error al crear el checkout')
  }

  const { url } = await resp.json()
  return url  // el componente redirigirá a esta URL
}
```

```jsx
// components/BotonPagarReserva.jsx
'use client'

import { useReservaStore } from '@/store/reservaStore'
import { iniciarPagoReserva } from '@/app/actions/reservas'
import { useRouter } from 'next/navigation'

export default function BotonPagarReserva() {
  const { salaSeleccionada, fechaInicio, fechaFin, resetReserva } = useReservaStore()
  const router = useRouter()

  const horas = fechaFin && fechaInicio
    ? (fechaFin - fechaInicio) / 3600000
    : 0
  const total = horas * (salaSeleccionada?.precio_hora ?? 0)

  async function handlePagar() {
    try {
      const checkoutUrl = await iniciarPagoReserva({
        salaId: salaSeleccionada.id,
        inicio: fechaInicio,
        fin:    fechaFin,
        total,
      })
      resetReserva()               // limpiamos el store
      router.push(checkoutUrl)     // redirigimos a Stripe
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  return (
    <button onClick={handlePagar} disabled={total <= 0}>
      Pagar {total.toFixed(2)} € →
    </button>
  )
}
```

---

## 4. Desplegar las Edge Functions

```bash
# Autenticarnos con la CLI de Supabase
supabase login

# Enlazar con nuestro proyecto remoto
supabase link --project-ref <tu-project-ref>

# Configurar los secrets (variables de entorno de las EF)
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set NEXT_PUBLIC_APP_URL=https://flex.vercel.app

# Desplegar ambas funciones
supabase functions deploy crear-checkout
supabase functions deploy stripe-webhook
```

### Registrar el webhook en Stripe

1. Ve a [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. **Add endpoint**
3. URL: `https://<tu-project-ref>.supabase.co/functions/v1/stripe-webhook`
4. Eventos a escuchar:
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Copia el **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`

### Probar el webhook en local

```bash
# Instala el CLI de Stripe
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# En otra terminal, simula un pago completado
stripe trigger checkout.session.completed
```

---

## 5. Página de éxito

```jsx
// app/reserva/exito/page.jsx
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function PaginaExito({ searchParams }) {
  const reservaId = searchParams.reserva_id
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: reserva } = await supabase
    .from('reservas')
    .select('*, salas_vip(nombre)')
    .eq('id', reservaId)
    .single()

  if (!reserva || reserva.estado !== 'pagada') {
    return <p>Reserva no encontrada o pago no confirmado.</p>
  }

  return (
    <div>
      <h1>¡Reserva confirmada! 🎸</h1>
      <p>Sala: {reserva.salas_vip.nombre}</p>
      <p>Inicio: {new Date(reserva.inicio).toLocaleString('es-ES')}</p>
      <p>Total pagado: {reserva.total} €</p>
      {/* El QR se genera en el apunte 05 */}
      <p>Tu entrada QR estará disponible en tu perfil.</p>
    </div>
  )
}
```

---

## Reto Flex 🎸

1. Añade soporte para **reembolsos parciales**: si el cliente cancela con más de 24 horas de antelación, Stripe devuelve el 50% del importe. Necesitarás:
   - Una nueva Edge Function `cancelar-reserva` que calcule el tiempo restante y llame a `stripe.refunds.create`.
   - Actualizar el estado de la reserva a `cancelada` en la DB.

2. Maneja el evento `charge.refunded` en el webhook para registrar en DB que el reembolso se ha procesado.

> **Pista:** `stripe.refunds.create({ payment_intent: '...', amount: importeEnCentimos })` acepta el Payment Intent ID que guardamos en `reservas.stripe_payment`.

---

## Navegación

[← 04 — Estado con Zustand](./04-estado-con-zustand.md) · [06 — PWA y Entradas QR →](./06-pwa-y-entradas-qr.md)
