# 10 — Despliegue: Supabase Cloud + Vercel

> **Proyecto Flex** · Stack: Next.js · Supabase · Stripe  
> Nivel: Intermedio

---

## ¿Qué vamos a conseguir?

Hasta ahora todo funciona en tu ordenador. Cuando lo apagas, la app desaparece. El objetivo de este apunte es tener la app **funcionando en internet**, accesible desde cualquier móvil, con HTTPS real.

Al final del apunte tendrás:

- La base de datos en Supabase Cloud (en vez de en local)
- La app publicada en Vercel con una URL real
- El webhook de Stripe apuntando a esa URL
- Todo conectado entre sí

---

## El orden importa

```
1. Crear proyecto en Supabase Cloud
        ↓
2. Ejecutar las migraciones (crear las tablas en la nube)
        ↓
3. Subir el código a GitHub
        ↓
4. Conectar GitHub con Vercel
        ↓
5. Configurar las variables de entorno en Vercel
        ↓
6. Actualizar el webhook de Stripe
        ↓
7. Verificar que todo funciona
```

No te saltes pasos — si configuras Vercel antes de tener las variables de entorno, el deploy fallará.

---

## Paso 1 — Crear el proyecto en Supabase Cloud

1. Ve a [supabase.com](https://supabase.com) e inicia sesión (o crea una cuenta)
2. Pulsa **New project**
3. Rellena:
   - **Name:** `flex` (o el nombre que prefieras)
   - **Database password:** elige una contraseña segura y **guárdala**, la necesitarás
   - **Region:** elige la más cercana (Europe West para España)
4. Pulsa **Create new project** y espera ~2 minutos a que se cree

---

## Paso 2 — Ejecutar las migraciones

Tu proyecto ya tiene los archivos de migración en `supabase/migrations/`. Hay dos formas de aplicarlos a la nube:

### Opción A — Desde la CLI de Supabase (recomendada)

Primero, conecta tu proyecto local con el de la nube. Necesitas el **Project ID**, que está en la URL del panel de Supabase: `https://supabase.com/dashboard/project/TU_PROJECT_ID`.

```bash
# Inicia sesión en Supabase (solo la primera vez)
npx supabase login

# Vincula tu proyecto local con el de la nube
npx supabase link --project-ref TU_PROJECT_ID

# Aplica todas las migraciones
npx supabase db push
```

Esto crea todas las tablas, políticas RLS y funciones exactamente como están en local.

### Opción B — Copiar el SQL manualmente

Si la CLI te da problemas, puedes ir al panel de Supabase → **SQL Editor** y pegar el contenido de cada archivo en `supabase/migrations/`, en orden, uno por uno.

---

## Paso 3 — Copiar el seed (datos iniciales)

Si tienes datos de prueba en `supabase/seed.sql` (salas, productos, etc.) y quieres que estén en producción, ejecuta el archivo en el **SQL Editor** de Supabase Cloud.

> En un proyecto real solo copiarías datos que tienen sentido en producción (salas, productos). No copiarías usuarios ni reservas de prueba.

---

## Paso 4 — Obtener las variables de entorno de Supabase Cloud

Ve al panel de tu proyecto en Supabase → **Project Settings** → **API**.

Necesitas estos valores:

| Variable | Dónde encontrarla |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project API Keys → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API Keys → `service_role` `secret` |

> La `service_role` key tiene acceso total a la base de datos saltándose las políticas RLS. Nunca la pongas en código que llegue al navegador — solo en el servidor.

---

## Paso 5 — Subir el código a GitHub

Si aún no tienes el proyecto en GitHub:

```bash
# Desde la raíz del proyecto
git add .
git commit -m "Preparando despliegue"
```

Luego ve a [github.com](https://github.com), crea un repositorio nuevo y sigue las instrucciones para subir tu código existente.

Si ya tienes el repo en GitHub, asegúrate de que tienes todos los cambios subidos:

```bash
git push origin main
```

---

## Paso 6 — Crear el proyecto en Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub
2. Pulsa **Add New → Project**
3. Elige tu repositorio de GitHub
4. Vercel detectará que es un proyecto Next.js automáticamente
5. Antes de pulsar **Deploy**, expande **Environment Variables** y añade todas las variables

### Variables de entorno que necesitas en Vercel

Copia los valores de tu `.env.local` pero con los datos de producción (Supabase Cloud, no localhost):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

STRIPE_SECRET_KEY=sk_live_...        (o sk_test_ si quieres seguir en modo test)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...      (lo actualizaremos en el siguiente paso)
```

> Por ahora pon un placeholder en `STRIPE_WEBHOOK_SECRET` — lo actualizaremos después de crear el webhook en Stripe.

6. Pulsa **Deploy** y espera a que termine (~2 minutos)

Al terminar, Vercel te da una URL del tipo `https://flex-xxxx.vercel.app`. Esa es tu app en producción.

---

## Paso 7 — Configurar el webhook de Stripe en producción

Hasta ahora usabas `stripe listen` para que los webhooks llegaran a tu máquina local. En producción Stripe necesita una URL real a la que enviar los avisos.

1. Ve a [dashboard.stripe.com](https://dashboard.stripe.com) → **Developers** → **Webhooks**
2. Pulsa **Add endpoint**
3. En **Endpoint URL** pon: `https://TU-APP.vercel.app/api/webhook`
4. En **Events to listen to** selecciona:
   - `checkout.session.completed`
5. Pulsa **Add endpoint**

Stripe te mostrará el **Signing secret** del webhook (`whsec_...`). Cópialo.

6. Ve a Vercel → tu proyecto → **Settings** → **Environment Variables**
7. Actualiza `STRIPE_WEBHOOK_SECRET` con ese valor
8. Ve a **Deployments** y pulsa **Redeploy** para que Vercel recargue las variables

---

## Paso 8 — Verificar que todo funciona

Haz una prueba de extremo a extremo:

1. Abre tu URL de Vercel en el navegador
2. Regístrate con un usuario nuevo (o inicia sesión)
3. Reserva una sala y paga con la tarjeta de prueba `4242 4242 4242 4242`
4. Comprueba que en Supabase Cloud → tabla `reservas` el `estado_pago` cambia a `pagado` y se genera el `qr_token`
5. Ve a `/mi-area` — debería aparecer el botón "Ver entrada QR"
6. Abre la entrada y comprueba que el QR se genera correctamente

Si algo falla, el primer sitio donde mirar es **Vercel → tu proyecto → Deployments → Functions** — ahí están los logs de las peticiones al servidor.

---

## Dominio personalizado (opcional)

Vercel te permite conectar tu propio dominio. Ve a **Settings → Domains** y sigue las instrucciones. Necesitarás acceso al panel DNS de donde compraste el dominio.

Si usas un dominio personalizado, recuerda actualizar también la URL del webhook en Stripe.

---

## Probar la PWA en producción

El service worker y la instalación PWA están **desactivados en desarrollo** a propósito — el caché agresivo interfiere con los cambios de código. En local verás este mensaje en la consola del servidor, que es normal:

```text
○ (pwa) PWA support is disabled
```

Para probar la PWA necesitas el deploy en Vercel (HTTPS real). Una vez desplegado:

1. Abre la URL desde tu móvil
2. Inicia sesión — al entrar en la app aparecerá automáticamente el **popup de instalación**
3. En Android/Chrome pulsa **Instalar** para añadirla a la pantalla de inicio
4. En iPhone/Safari el popup muestra instrucciones manuales (Safari no permite instalación automática)

> El popup solo aparece una vez por sesión. Si lo cerraste sin instalar y quieres verlo de nuevo, abre una pestaña de incógnito o borra el `sessionStorage` desde las DevTools.

### Desarrollo local con Turbopack

Para el día a día usa Turbopack — es significativamente más rápido que Webpack:

```bash
npm run dev        # arranca con --turbopack
```

El build de producción (`npm run build`) sigue usando Webpack, que es lo que Vercel ejecuta al desplegar.

---

## Probar en móvil

Con la app en Vercel ya tienes HTTPS real. Abre la URL desde tu móvil, inicia sesión y el popup de instalación aparecerá solo.

Para probar el escáner de QR del portero:

1. Abre `/porteros` en el móvil
2. Pulsa **Cámara** y acepta el permiso — la cámara trasera arranca directamente
3. Apunta al QR de una entrada válida — debería aparecer "ENTRADA VÁLIDA" en verde
4. Escanea el mismo QR otra vez — debería aparecer "Entrada ya utilizada"
5. Al recargar la página, el historial de entradas del día se carga desde la base de datos

---

## Resumen

| Servicio | Para qué | URL |
|---|---|---|
| Supabase Cloud | Base de datos en la nube | supabase.com |
| Vercel | Hosting de la app Next.js | vercel.com |
| Stripe Dashboard | Gestión de pagos y webhooks | dashboard.stripe.com |

El flujo de un cambio a partir de ahora:

```bash
git add .
git commit -m "descripción del cambio"
git push origin main
# Vercel detecta el push y despliega automáticamente en ~1 minuto
```

### Migraciones pendientes

Si el cambio incluye nuevas migraciones en `supabase/migrations/`, aplícalas antes de desplegar el código:

```bash
npx supabase db push
```

Si no lo haces, el código en producción intentará leer o escribir columnas que aún no existen en la base de datos y fallará.

---

## Navegación

[← 09 — PWA y entradas QR](./09-pwa-y-entradas-qr.md) · [10 — Realtime →](./10-realtime-y-vercel.md)
