# Teoría — Stripe Customers, Payment Methods y SetupIntents

> **Proyecto Flex** · Teoría de apoyo al apunte 08  
> Nivel: Intermedio

---

## 1. El problema que resuelve "guardar la tarjeta"

Cada vez que un usuario hace un pago estándar en Stripe, introduce sus datos de tarjeta, Stripe los tokeniza y procesa el cobro. Cuando termina, esos datos desaparecen del contexto del pago. En el siguiente pago, el usuario tiene que volver a introducirlos.

Esto es correcto por seguridad: **ni tú ni Stripe almacenan el número de tarjeta real**. Stripe almacena un **Payment Method**, que es una referencia segura a esa tarjeta. La pregunta es: ¿a qué entidad de Stripe está vinculado ese Payment Method? Si no está vinculado a nada permanente, se pierde.

La solución es el **Customer**.

---

## 2. El objeto `Customer` de Stripe

Un `Customer` en Stripe representa a una persona real (tu usuario) dentro del sistema de Stripe. Es una entidad persistente que:

- Tiene un ID único (`cus_xxxxx`).
- Puede tener múltiples Payment Methods adjuntos.
- Guarda historial de pagos.
- Permite hacer cobros futuros sin que el usuario esté presente.

```
Tu DB (profiles)          Stripe
┌─────────────────┐      ┌──────────────────────────────────┐
│ user_id (UUID)  │      │ Customer cus_abc123               │
│ email           │      │   email: usuario@gmail.com        │
│ stripe_customer │◀────▶│   metadata.supabase_user_id: UUID │
│   _id           │      │                                   │
└─────────────────┘      │   Payment Methods:                │
                         │     pm_111 → Visa **** 4242       │
                         │     pm_222 → Mastercard **** 1234 │
                         └──────────────────────────────────┘
```

El vínculo entre tu sistema y Stripe se guarda en tu propia base de datos: el campo `stripe_customer_id` en la tabla `profiles`. Stripe guarda el `supabase_user_id` en los metadatos del Customer, lo que te permite hacer la asociación en ambas direcciones.

### ¿Cuándo se crea el Customer?

Hay dos estrategias habituales:

| Cuándo crearlo | Ventajas | Inconvenientes |
|---|---|---|
| Al registrarse el usuario | El Customer existe desde el primer momento | Creas Customers en Stripe aunque el usuario nunca pague |
| En el primer pago | Solo creas Customers de usuarios que pagan | Un paso extra en el flujo de pago |

En Flex usamos la **segunda opción** porque es más limpia y no ensucia el Dashboard de Stripe con usuarios inactivos.

---

## 3. El objeto `PaymentMethod`

Un `PaymentMethod` representa un instrumento de pago concreto: una tarjeta de crédito, una cuenta bancaria (SEPA), etc.

Lo importante es entender sus dos estados posibles:

### 3.1 PaymentMethod no adjunto (flotante)

Cuando Stripe tokeniza una tarjeta por primera vez (al introducirla en un formulario), crea un PaymentMethod. Si no lo adjuntas a un Customer, es **temporal**: solo puede usarse una vez.

### 3.2 PaymentMethod adjunto a un Customer

Cuando un PaymentMethod está vinculado a un Customer, es **permanente**. Puedes usarlo en cualquier momento futuro, incluso sin que el usuario esté delante (esto se llama "off-session").

```js
stripe.paymentMethods.attach('pm_xxx', { customer: 'cus_xxx' })
```

Una vez adjunto, puedes ver todos los métodos de un Customer:

```js
const methods = await stripe.paymentMethods.list({
  customer: 'cus_xxx',
  type: 'card',
})
// methods.data → array de PaymentMethods con datos de cada tarjeta
```

---

## 4. `setup_future_usage`: la clave de todo

Cuando creas un Checkout Session o un PaymentIntent, puedes incluir el parámetro `setup_future_usage`. Este parámetro le dice a Stripe qué piensas hacer con ese método de pago después del pago actual.

```js
payment_intent_data: {
  setup_future_usage: 'off_session',
}
```

Los dos valores posibles:

| Valor | Significado |
|---|---|
| `'on_session'` | El usuario estará presente en los pagos futuros (SCA/3DS más suave) |
| `'off_session'` | Los pagos futuros pueden hacerse sin que el usuario esté presente (suscripciones, renovaciones) |

En Flex usamos `'off_session'` porque queremos poder cobrar reservas de forma automática si en el futuro añades renovaciones o reservas recurrentes.

**¿Qué hace Stripe internamente cuando recibe este parámetro?**

1. Completa el pago normalmente.
2. Adjunta el PaymentMethod al Customer vinculado a la sesión.
3. Configura el PaymentMethod para que acepte cobros futuros sin autenticación adicional del usuario.

Sin este parámetro, el PaymentMethod se usaría y se descartaría.

---

## 5. SCA y 3D Secure: por qué importa el contexto

La **Strong Customer Authentication (SCA)** es una regulación europea (PSD2) que obliga a verificar la identidad del usuario en pagos online. La forma más común es **3D Secure (3DS)**: esa pantalla del banco donde introduces un código SMS o confirmas en la app.

El problema es que SCA requiere que el usuario esté presente. En un pago automático futuro ("off-session"), el usuario no está ahí. Por eso Stripe hace algo inteligente:

- **En el primer pago** (on-session): Stripe solicita la autenticación 3DS si el banco la requiere. El usuario la completa.
- **En pagos futuros** (off-session): Stripe usa una exención llamada **"merchant-initiated transaction"** (MIT). El banco acepta el cargo sin 3DS porque el usuario ya autorizó los pagos futuros cuando aceptó `setup_future_usage: 'off_session'`.

Esto es posible gracias a los datos que Stripe almacena al configurar el PaymentMethod: sabe que este método fue autorizado explícitamente para uso futuro.

```
Usuario presente (primer pago)
  └── 3DS requerido → usuario lo completa → método guardado para futuros cobros

Pagos futuros (off-session)
  └── Stripe usa MIT exención → banco acepta sin 3DS
      (salvo excepciones: tarjeta nueva, límite de gasto, etc.)
```

---

## 6. SetupIntent: cuando quieres guardar sin cobrar

En Flex siempre cobramos al guardar la tarjeta (el primer pago). Pero existe un objeto de Stripe para guardar la tarjeta **sin cobrar nada**: el `SetupIntent`.

```js
const setupIntent = await stripe.setupIntents.create({
  customer: 'cus_xxx',
  usage: 'off_session',
})
```

Se usa cuando quieres que el usuario añada una tarjeta en su perfil antes de hacer ninguna compra. Stripe muestra el formulario de tarjeta, la valida, y la guarda en el Customer.

En nuestro caso no lo necesitamos, pero es bueno conocerlo porque en proyectos más grandes suele aparecer en la página de "Métodos de pago" del perfil de usuario.

---

## 7. Flujo completo con todos los objetos implicados

```
Primera reserva:

  1. Next.js crea un Customer en Stripe  →  cus_abc123
  2. Guarda cus_abc123 en profiles.stripe_customer_id
  3. Crea un Checkout Session con:
       customer: cus_abc123
       setup_future_usage: 'off_session'
  4. Stripe genera la Session  →  cs_xxx  →  URL de pago
  5. Usuario introduce tarjeta, Stripe procesa el pago
  6. Stripe crea:
       - PaymentIntent (pi_xxx) → el cargo real
       - PaymentMethod (pm_xxx) → la tarjeta tokenizada, adjunta a cus_abc123
  7. Stripe dispara el webhook: checkout.session.completed
  8. Edge Function actualiza la reserva: estado='pagada', stripe_payment='pi_xxx'

Segunda reserva:

  1. Next.js obtiene cus_abc123 de profiles
  2. Crea un Checkout Session con:
       customer: cus_abc123
       setup_future_usage: 'off_session'
  3. Stripe detecta que cus_abc123 ya tiene pm_xxx guardado
  4. La página de checkout muestra "Visa **** 4242" con botón "Pagar"
  5. El usuario hace clic → pago procesado sin introducir nada nuevo
```

---

## 8. Seguridad: qué no debes hacer nunca

| ❌ Nunca hagas esto | ✅ Haz esto en cambio |
|---|---|
| Enviar `STRIPE_SECRET_KEY` al cliente (navegador) | Usar siempre Server Actions, API Routes o Edge Functions |
| Guardar el número de tarjeta en tu DB | Guardar solo el `stripe_customer_id` y el `payment_method` ID |
| Crear el Customer en el cliente | Crear el Customer siempre en el servidor |
| Confiar en el `success_url` como confirmación del pago | Usar siempre el webhook para confirmar pagos |

El último punto es crítico: un usuario podría manipular la URL de `success_url` en su navegador. El webhook llega directamente de Stripe a tu servidor, con una firma criptográfica que validas con `stripe.webhooks.constructEventAsync`. Esa es la única fuente de verdad sobre si un pago se completó.

---

## 9. Resumen de objetos de Stripe

| Objeto | Qué es | Dónde vive |
|---|---|---|
| `Customer` (`cus_xxx`) | Representación de tu usuario en Stripe | Stripe + tu DB (`stripe_customer_id`) |
| `PaymentMethod` (`pm_xxx`) | Una tarjeta u otro instrumento de pago tokenizado | Adjunto al Customer en Stripe |
| `PaymentIntent` (`pi_xxx`) | Una intención de cobro (el cargo real) | En Stripe, vinculado a tu reserva via `stripe_payment` |
| `Checkout Session` (`cs_xxx`) | La sesión de pago (la página de Stripe) | Temporal en Stripe, guardas el ID en tu reserva |
| `SetupIntent` (`seti_xxx`) | Guardar un método de pago sin cobrar | En Stripe, temporal |
| `Webhook Event` | Notificación de Stripe a tu servidor | Llega a tu Edge Function |

---

## Navegación

[← 07 — Stripe y Edge Functions](./07-stripe-y-edge-functions.md) · [08 — Guardar la tarjeta del usuario →](./08-stripe-tarjeta-guardada.md)
