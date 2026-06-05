# Teoría — Stripe: pagos en internet, webhooks y seguridad

> **Proyecto Flex** · Teoría de apoyo al apunte 07  
> Nivel: Intermedio

---

## 1. El problema de los pagos en internet

Cuando pagas con tarjeta en una tienda física, el datáfono se comunica directamente con la red bancaria. En internet no existe ese canal seguro directo, así que alguien tiene que hacer de intermediario de confianza entre tu cliente (el navegador), tu servidor, y los bancos.

Ese intermediario es **Stripe**.

Stripe se encarga de:
- Mostrar un formulario de pago seguro (certificado PCI-DSS).
- Comunicarse con la red de tarjetas (Visa, Mastercard) y con el banco emisor.
- Devolverte el resultado (pago aprobado o rechazado) de forma que puedas actuar en consecuencia.

La regla de oro es que **tú nunca tocas los datos de la tarjeta**. Stripe los recibe, los tokeniza, y a ti solo te llega un identificador (`PaymentIntent`, `Checkout Session`...) que no tiene ningún valor si alguien lo intercepta.

---

## 2. Stripe Checkout: la forma más sencilla de cobrar

**Stripe Checkout** es una página de pago alojada en los servidores de Stripe. En lugar de construir tu propio formulario de tarjeta, redirigues al usuario a una URL de Stripe, el usuario paga allí, y Stripe lo redirige de vuelta a tu aplicación.

```
Tu app              Stripe              Banco
  │                    │                  │
  │── crear Session ──▶│                  │
  │◀── { url } ────────│                  │
  │                    │                  │
  │  (usuario va a la URL de Stripe)      │
  │                    │── autorizar ─────▶│
  │                    │◀── aprobado ──────│
  │◀── redirect ───────│                  │
```

### ¿Qué es una Checkout Session?

Es un objeto de Stripe que representa una intención de compra. Lo creas en tu servidor con los detalles del pedido (precio, moneda, descripción) y Stripe te devuelve una URL única. Esa URL caduca (en nuestro caso, en 30 minutos).

```js
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [{ price_data: { ... }, quantity: 1 }],
  mode: 'payment',
  success_url: 'https://tuapp.com/exito',
  cancel_url:  'https://tuapp.com/cancelado',
})
// session.url → redirigimos al usuario aquí
```

### Por qué se crea en el servidor

Si crearas la Checkout Session en el navegador, necesitarías exponer tu `STRIPE_SECRET_KEY`. Cualquiera que inspeccionara el código podría usarla para crear cobros, hacer reembolsos o acceder a tus datos de Stripe. La clave secreta **nunca sale del servidor**.

---

## 3. PaymentIntent: el objeto central del cobro

Por debajo de una Checkout Session siempre hay un **PaymentIntent**. Es el objeto que representa el intento de cobro real: el dinero que se va a mover de la tarjeta del usuario a tu cuenta.

Sus estados más importantes:

| Estado | Significado |
|---|---|
| `requires_payment_method` | Esperando que el usuario introduzca su tarjeta |
| `requires_action` | El banco pide autenticación adicional (3D Secure) |
| `processing` | El cargo está siendo procesado |
| `succeeded` | El pago se completó correctamente |
| `canceled` | El pago fue cancelado |

Cuando confirmas un pago, Stripe crea el PaymentIntent y lo lleva hasta `succeeded`. En tu base de datos guardas el ID (`pi_xxx`) en la columna `stripe_payment` de la reserva, lo que te permite rastrear cada cobro en el Dashboard de Stripe.

---

## 4. Webhooks: la única fuente de verdad

Aquí está el error más común al implementar pagos: **confiar en el redirect de `success_url` para confirmar el pago**.

El problema: el usuario puede cerrar el navegador antes de que se complete el redirect, puede manipular la URL, o puede haber un fallo de red. La URL de éxito llega al cliente, no a tu servidor.

La solución son los **webhooks**: notificaciones que Stripe envía directamente a tu servidor cuando algo ocurre. Son peticiones HTTP POST que Stripe hace a una URL tuya, con un JSON describiendo el evento.

```
Stripe                    Tu servidor (Edge Function)
  │                              │
  │── POST /stripe-webhook ─────▶│
  │   { type: 'checkout.session.completed', data: { ... } }
  │                              │── UPDATE reservas SET estado='pagada'
  │◀── 200 OK ──────────────────│
```

### Verificación de firma

Cualquiera podría enviar una petición POST a tu endpoint de webhook fingiendo ser Stripe. Para evitarlo, Stripe firma cada petición con un secreto compartido (`STRIPE_WEBHOOK_SECRET`). Tu servidor verifica esa firma antes de procesar nada:

```js
evento = await stripe.webhooks.constructEventAsync(
  body,       // el cuerpo de la petición en crudo (texto, no JSON)
  signature,  // cabecera 'stripe-signature' de la petición
  Deno.env.get('STRIPE_WEBHOOK_SECRET')
)
// Si la firma no cuadra, constructEventAsync lanza un error → devolvemos 400
```

Si la verificación falla, rechazas la petición. Si alguien intenta falsificar un webhook de "pago completado", no pasará esta comprobación.

### Idempotencia

Stripe puede enviar el mismo evento más de una vez (por reintentos de red). Por eso en el webhook filtramos con `.eq('estado', 'pendiente')`: solo actualizamos la reserva si todavía está pendiente. Si el webhook llega dos veces, el segundo UPDATE no cambia nada porque el estado ya es `pagada`.

---

## 5. Edge Functions de Supabase

Una **Edge Function** es un fragmento de código que se ejecuta en la nube, cerca del usuario, sin que tengas que gestionar un servidor. Supabase las ejecuta sobre Deno (no Node.js).

Las usamos para el webhook por tres razones:

1. **Necesitan la `service_role key`**: Esta clave bypasea las políticas RLS de Supabase, lo que nos permite actualizar reservas de cualquier usuario. Solo puede existir en el servidor, nunca en el cliente.

2. **Deben ser HTTPS con IP pública**: Stripe necesita una URL real a la que enviar los webhooks. Next.js en local no tiene esa URL; las Edge Functions sí, aunque estés desarrollando.

3. **Son serverless**: No pagas por tiempo de espera, solo por ejecución. Perfecto para un webhook que se activa puntualmente.

```
┌─────────────────────────────────────┐
│  Supabase Edge Functions (Deno)     │
│                                     │
│  crear-checkout/index.js            │
│    ├── Recibe datos de la reserva   │
│    ├── Llama a stripe.checkout...   │
│    └── Devuelve { url }             │
│                                     │
│  stripe-webhook/index.js            │
│    ├── Verifica firma de Stripe     │
│    ├── Actualiza reserva en DB      │
│    └── Genera qr_token              │
└─────────────────────────────────────┘
```

### Deno vs Node.js

Las Edge Functions usan Deno, no Node.js. Las diferencias que afectan al código:

| Node.js | Deno |
|---|---|
| `require('stripe')` | `import Stripe from 'https://esm.sh/stripe@14?target=deno'` |
| `process.env.VAR` | `Deno.env.get('VAR')` |
| `http.createServer(...)` | `Deno.serve(...)` |

Los imports en Deno son URLs directas a módulos. `esm.sh` convierte paquetes de npm al formato de módulos ES que Deno entiende.

---

## 6. Seguridad: las cuatro reglas

**Regla 1 — La `STRIPE_SECRET_KEY` nunca va al cliente.**  
Ni en variables de entorno con prefijo `NEXT_PUBLIC_`, ni en código que se ejecute en el navegador. Cualquier llamada a la API de Stripe con esta clave debe hacerse en el servidor.

**Regla 2 — Valida siempre la firma del webhook.**  
Un webhook sin verificar es una puerta trasera: cualquiera podría fingir que un pago se completó y conseguir una reserva gratis.

**Regla 3 — El webhook es la fuente de verdad, no el redirect.**  
Nunca marques una reserva como pagada basándote solo en que el usuario llegó a la página de éxito. Esa lógica va en el webhook.

**Regla 4 — Usa idempotencia en el webhook.**  
Filtra con `.eq('estado', 'pendiente')` para que procesar el mismo evento dos veces no duplique efectos.

---

## 7. Resumen de objetos de Stripe que usamos en el apunte 07

| Objeto | ID de ejemplo | Para qué sirve en Flex |
|---|---|---|
| `Checkout Session` | `cs_xxx` | La página de pago de Stripe; la URL a la que redirigimos al usuario |
| `PaymentIntent` | `pi_xxx` | El cargo real; lo guardamos en `reservas.stripe_payment` |
| `Webhook Event` | — | Notificación de Stripe a nuestra Edge Function cuando el pago termina |

---

## Navegación

[← 06 — Productos](./06-productos.md) · [07 — Stripe y Edge Functions →](./07-stripe-y-edge-functions.md)
