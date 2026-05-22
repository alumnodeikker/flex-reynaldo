# 05 — PWA y Entradas QR

> **Proyecto Flex** · Stack: Next.js · Supabase · Zustand · Stripe  
> Nivel: Intermedio

---

## ¿Por qué una PWA?

Una Progressive Web App (PWA) es una web que se comporta como una app nativa:

- Se puede instalar en el móvil desde el navegador (sin App Store)
- Funciona offline (con Service Worker)
- Envía notificaciones push
- Aparece en la pantalla de inicio con su icono

Para Flex es perfecta: el cliente accede a su entrada QR desde el móvil, sin tener que descargar nada.

```
Web normal:   Cliente ──▶ Abre el navegador cada vez
PWA:          Cliente ──▶ Icono en pantalla de inicio ──▶ Experiencia de app
```

---

## 1. Convertir Next.js en PWA

### 1.1 Instalar `next-pwa`

```bash
pnpm add next-pwa
```

### 1.2 Configurar `next.config.js`

```js
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',          // dónde genera el Service Worker
  disable: process.env.NODE_ENV === 'development',  // no en dev (rompe hot reload)
  register: true,          // registra el SW automáticamente
  skipWaiting: true,       // activa el nuevo SW sin esperar a cerrar pestañas
  // Rutas que SÍ queremos cachear offline
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
      handler: 'CacheFirst',           // primero caché, luego red
      options: {
        cacheName: 'supabase-storage',
        expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^\//,               // rutas internas de la app
      handler: 'NetworkFirst',         // primero red, caché como fallback
      options: { cacheName: 'flex-pages' },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ...tu configuración existente
}

module.exports = withPWA(nextConfig)
```

### 1.3 Web App Manifest (`public/manifest.json`)

El manifest le dice al navegador cómo instalar la PWA:

```json
{
  "name": "Flex Underground",
  "short_name": "Flex",
  "description": "Tu sala de Jam Sessions en el bolsillo",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#e63946",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/home.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

### 1.4 Enlazar el manifest en el layout

```jsx
// app/layout.jsx
export const metadata = {
  title: 'Flex Underground',
  description: 'Tu sala de Jam Sessions',
  manifest: '/manifest.json',
  themeColor: '#e63946',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Flex',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        {/* iOS necesita esto para el icono en pantalla de inicio */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

---

## 2. Generación del código QR

### ¿Qué contiene el QR?

El QR no contiene datos sensibles directamente. Contiene una **URL** que apunta a la entrada:

```
https://flex.vercel.app/entrada/<qr_token>
```

El `qr_token` es el UUID único que generó el webhook de Stripe (apunte 04). El portero escanea el QR y la app verifica en Supabase si el token es válido.

### 2.1 Instalar la librería QR

```bash
pnpm add qrcode
```

### 2.2 Componente `EntradaQR`

```jsx
// components/EntradaQR.jsx
'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

/**
 * Renderiza un código QR en un canvas.
 * @param {string} props.token  - El qr_token de la reserva
 * @param {string} props.appUrl - La URL base de la app
 */
export default function EntradaQR({ token, appUrl }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!token || !canvasRef.current) return

    const url = `${appUrl}/entrada/${token}`

    QRCode.toCanvas(canvasRef.current, url, {
      width:           250,
      margin:          2,
      color: {
        dark:  '#ffffff',   // módulos del QR (blanco sobre fondo oscuro)
        light: '#0a0a0a',   // fondo del QR
      },
    }, (err) => {
      if (err) console.error('Error generando QR:', err)
    })
  }, [token, appUrl])

  return (
    <div className="entrada-qr">
      <canvas ref={canvasRef} aria-label="Código QR de entrada" />
      <p className="qr-hint">Muestra este QR en la puerta de la sala VIP</p>
    </div>
  )
}
```

### 2.3 Página de la entrada (`/entrada/[token]`)

```jsx
// app/entrada/[token]/page.jsx
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import EntradaQR from '@/components/EntradaQR'

export default async function PaginaEntrada({ params }) {
  const { token } = params
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  // Buscamos la reserva por qr_token
  const { data: reserva } = await supabase
    .from('reservas')
    .select(`
      id,
      inicio,
      fin,
      estado,
      total,
      qr_token,
      salas_vip ( nombre, imagen_url ),
      perfiles  ( nombre )
    `)
    .eq('qr_token', token)
    .single()

  // Token inválido o reserva no pagada
  if (!reserva || reserva.estado !== 'pagada') {
    return (
      <div className="entrada-invalida">
        <h1>Entrada no válida</h1>
        <p>Este código QR no corresponde a ninguna reserva activa.</p>
      </div>
    )
  }

  const ahora   = new Date()
  const inicio  = new Date(reserva.inicio)
  const fin     = new Date(reserva.fin)
  const valida  = ahora >= inicio && ahora <= fin

  return (
    <div className="entrada-container">
      <h1>Entrada Flex 🎸</h1>

      <div className="entrada-info">
        <img src={reserva.salas_vip.imagen_url} alt={reserva.salas_vip.nombre} />
        <h2>{reserva.salas_vip.nombre}</h2>
        <p>Titular: {reserva.perfiles.nombre}</p>
        <p>Entrada: {inicio.toLocaleString('es-ES')}</p>
        <p>Salida:  {fin.toLocaleString('es-ES')}</p>
        <p>Total pagado: {reserva.total} €</p>
      </div>

      {/* Estado visual de la entrada */}
      <div className={`estado-entrada ${valida ? 'valida' : 'fuera-de-rango'}`}>
        {valida ? '✅ ENTRADA VÁLIDA' : '⚠️ FUERA DEL HORARIO'}
      </div>

      {/* El QR muestra la URL pública de esta misma página */}
      <EntradaQR
        token={token}
        appUrl={process.env.NEXT_PUBLIC_APP_URL}
      />
    </div>
  )
}
```

### 2.4 Página de perfil del usuario (acceso a sus entradas)

```jsx
// app/perfil/page.jsx
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'

export default async function PaginaPerfil() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Solo reservas pagadas (tienen QR)
  const { data: reservas } = await supabase
    .from('reservas')
    .select('id, inicio, fin, qr_token, salas_vip(nombre)')
    .eq('cliente_id', user.id)
    .eq('estado', 'pagada')
    .order('inicio', { ascending: false })

  return (
    <div>
      <h1>Mis entradas</h1>
      {reservas?.length === 0 && <p>No tienes reservas pagadas.</p>}
      {reservas?.map((reserva) => (
        <div key={reserva.id} className="tarjeta-entrada">
          <h3>{reserva.salas_vip.nombre}</h3>
          <p>{new Date(reserva.inicio).toLocaleString('es-ES')}</p>
          {/* Enlace a la página de entrada con el QR */}
          <Link href={`/entrada/${reserva.qr_token}`}>
            Ver entrada QR →
          </Link>
        </div>
      ))}
    </div>
  )
}
```

---

## 3. Edge Function: Verificar QR (para el portero)

El portero usa una app interna que escanea el QR y llama a esta Edge Function.

```bash
supabase functions new verificar-entrada
```

```js
// supabase/functions/verificar-entrada/index.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const { token } = await req.json()

  if (!token) {
    return new Response(
      JSON.stringify({ valida: false, motivo: 'Token no proporcionado' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  )

  const { data: reserva } = await supabase
    .from('reservas')
    .select('id, inicio, fin, estado, perfiles(nombre), salas_vip(nombre)')
    .eq('qr_token', token)
    .single()

  if (!reserva) {
    return new Response(
      JSON.stringify({ valida: false, motivo: 'Token no encontrado' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (reserva.estado !== 'pagada') {
    return new Response(
      JSON.stringify({ valida: false, motivo: `Estado: ${reserva.estado}` }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  const ahora  = new Date()
  const inicio = new Date(reserva.inicio)
  const fin    = new Date(reserva.fin)

  // Permitimos entrada 15 minutos antes del inicio
  const margenMs = 15 * 60 * 1000
  const dentroDeRango = ahora >= new Date(inicio - margenMs) && ahora <= fin

  if (!dentroDeRango) {
    return new Response(
      JSON.stringify({
        valida: false,
        motivo: 'Fuera del horario de la reserva',
        inicio: inicio.toISOString(),
        fin:    fin.toISOString(),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Entrada válida: marcamos la reserva como 'completada'
  await supabase
    .from('reservas')
    .update({ estado: 'completada' })
    .eq('id', reserva.id)

  return new Response(
    JSON.stringify({
      valida:   true,
      cliente:  reserva.perfiles.nombre,
      sala:     reserva.salas_vip.nombre,
      inicio:   inicio.toISOString(),
      fin:      fin.toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

---

## 4. Verificar que es una PWA instalable

Abre Chrome DevTools → pestaña **Application** → **Manifest**.

Debe mostrar:
- ✅ Manifest válido
- ✅ Service Worker registrado
- ✅ Al menos un icono de 192×192

En móvil (Chrome), aparecerá el banner "Añadir a pantalla de inicio" automáticamente si:
- La web se sirve por HTTPS
- El manifest está correctamente enlazado
- El Service Worker está activo

---

## Reto Flex 🎸

1. Añade al componente `EntradaQR` un botón **"Descargar QR"** que use `canvas.toDataURL('image/png')` para crear un enlace de descarga con el QR en alta resolución (512×512 px).

2. Crea una ruta `/portero` (protegida por rol `portero`) con un formulario donde el portero pueda **escribir manualmente** el token si el escáner falla, y llame a la Edge Function `verificar-entrada`. Muestra el resultado con un indicador visual verde/rojo.

3. Configura en `manifest.json` un `shortcut` de acceso rápido a `/perfil` para que los usuarios con la PWA instalada puedan acceder directamente a sus entradas desde el icono.

> **Pista:** Los shortcuts del manifest se definen así:
> ```json
> "shortcuts": [{ "name": "Mis entradas", "url": "/perfil", "icons": [...] }]
> ```

---

## Navegación

[← 05 — Stripe y Edge Functions](./05-stripe-y-edge-functions.md) · [07 — Realtime y Vercel →](./07-realtime-y-vercel.md)
