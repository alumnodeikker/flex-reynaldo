# 03 — Interfaz estática: Next.js + maquetación de Flex

> **Objetivo:** crear la estructura de carpetas del proyecto, instalar Next.js y maquetar todas las pantallas con datos estáticos (sin base de datos ni estado global todavía).

---

## Estructura del monorepo

El proyecto Flex usa una estructura **monorepo**: una sola carpeta raíz que contiene múltiples aplicaciones. Por ahora solo tenemos la app web; más adelante podría añadirse una app móvil o un panel de administración sin cambiar la organización raíz.

```text
flex/                   ← raíz del monorepo
  apps/
    web/                ← aquí va Next.js
  docs/
  supabase/
  package.json
```

---

## 1. Crear `apps/web` con Next.js

Desde la raíz del proyecto:

```bash
mkdir apps
pnpm create next-app apps/web --no-typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

Opciones que seleccionamos al asistente interactivo (si no pasamos flags):

| Pregunta          | Respuesta |
| ----------------- | --------- |
| TypeScript        | No        |
| ESLint            | Sí        |
| Tailwind CSS      | Sí        |
| `src/` directory  | No        |
| App Router        | Sí        |
| Import alias      | `@/*`     |

```bash
cd apps/web
pnpm add lucide-react         # iconos
```

Arrancamos el servidor de desarrollo:

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) — verás la página de bienvenida de Next.js. La vamos a reemplazar completamente.

---

## 2. Paleta de colores y tema

El diseño de Flex usa fondo negro con dorado como color de acento. Añadimos los colores custom a Tailwind:

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          400: '#D4A843',
          500: '#C9A030',
          600: '#A07820',
        },
      },
    },
  },
}

module.exports = config
```

Estilos globales base:

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-zinc-950 text-zinc-100 antialiased;
  }

  ::-webkit-scrollbar {
    @apply w-1;
  }

  ::-webkit-scrollbar-track {
    @apply bg-zinc-900;
  }

  ::-webkit-scrollbar-thumb {
    @apply bg-zinc-700 rounded-full;
  }
}
```

---

## 3. Layout: sidebar + área principal

El layout raíz define la estructura que comparten todas las páginas: una barra lateral fija a la izquierda y el contenido scrollable a la derecha.

```jsx
// app/layout.jsx
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata = {
  title: 'Flex — Live Experience',
  description: 'Tu noche, tu ritmo',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  )
}
```

### Sidebar

```jsx
// components/Sidebar.jsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Music, Clock, Ticket,
  Crown, Activity, Bell, HelpCircle, Settings,
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: Home,        label: 'Inicio',          href: '/' },
  { icon: Music,       label: 'Pedir canción',   href: '/canciones' },
  { icon: Clock,       label: 'Mi turno',        href: '/turno' },
  { icon: Ticket,      label: 'Mis entradas',    href: '/entradas' },
  { icon: Crown,       label: 'Salas VIP',       href: '/vip' },
  { icon: Activity,    label: 'Actividades',     href: '/actividades' },
  { icon: Bell,        label: 'Notificaciones',  href: '/notificaciones' },
  { icon: HelpCircle,  label: 'Ayuda',           href: '/ayuda' },
  { icon: Settings,    label: 'Configuración',   href: '/configuracion' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-zinc-800">
        <span className="text-2xl font-bold text-gold-400 tracking-widest">ƒFLEX</span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-4 space-y-1 px-3">
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
          const activo = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activo
                  ? 'bg-gold-500/20 text-gold-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Usuario */}
      <div className="px-4 py-4 border-t border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gold-500/30 flex items-center justify-center text-gold-400 text-sm font-bold">
            A
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-100">Alex</p>
            <p className="text-xs text-zinc-500">Cliente</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
```

---

## 4. Página de inicio (Dashboard)

La página principal muestra: el evento destacado, el turno del usuario, próximos eventos, entradas y acceso rápido a salas VIP.

```jsx
// app/page.jsx
import TarjetaEvento from '@/components/TarjetaEvento'
import PanelTurno from '@/components/PanelTurno'
import SeccionVIP from '@/components/SeccionVIP'

const EVENTO_DESTACADO = {
  titulo: 'Jazz Nights',
  fecha: 'Sábado, 25 de mayo',
  hora: '22:00 — 04:00h',
  lugar: 'Flex Principal',
}

const PROXIMOS_EVENTOS = [
  { id: 1, titulo: 'Jazz Nights',  fecha: '25 mayo', genero: 'Jazz / Blues',   precio: 'Desde 15€' },
  { id: 2, titulo: 'Soul & Blues', fecha: '31 mayo', genero: 'Soul / R&B',     precio: 'Desde 12€' },
  { id: 3, titulo: 'Latin Jazz',   fecha: '07 jun',  genero: 'Latin / Fusión', precio: 'Desde 10€' },
]

export default function Inicio() {
  return (
    <div className="p-8 space-y-10">

      {/* Cabecera */}
      <div>
        <p className="text-zinc-500 text-sm">Bienvenido, Alex 👋</p>
        <h1 className="text-2xl font-bold text-zinc-100">¿Qué te vas a tomar esta noche?</h1>
      </div>

      {/* Hero + Turno */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <BannerEvento evento={EVENTO_DESTACADO} />
        </div>
        <PanelTurno numero={4} espera="25 – 30 min" />
      </div>

      {/* Próximos eventos */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Próximos eventos</h2>
        <div className="grid grid-cols-3 gap-4">
          {PROXIMOS_EVENTOS.map((evento) => (
            <TarjetaEvento key={evento.id} {...evento} />
          ))}
        </div>
      </section>

      {/* Salas VIP */}
      <SeccionVIP />

    </div>
  )
}

function BannerEvento({ evento }) {
  return (
    <div className="relative rounded-2xl overflow-hidden h-64 bg-zinc-800">
      {/* Imagen de fondo (placeholder hasta tener las fotos reales) */}
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-900/60 to-transparent" />

      <div className="absolute inset-0 flex flex-col justify-end p-6">
        <p className="text-gold-400 text-xs font-semibold uppercase tracking-wider mb-1">
          Evento destacado
        </p>
        <h2 className="text-3xl font-bold text-white mb-2">{evento.titulo}</h2>
        <div className="flex items-center gap-4 text-zinc-400 text-sm">
          <span>{evento.fecha}</span>
          <span>·</span>
          <span>{evento.hora}</span>
          <span>·</span>
          <span>{evento.lugar}</span>
        </div>
        <button className="mt-4 w-fit px-5 py-2 bg-gold-500 hover:bg-gold-600 text-zinc-950 text-sm font-semibold rounded-lg transition-colors">
          Ver entradas
        </button>
      </div>
    </div>
  )
}
```

---

## 5. Componentes estáticos

### `TarjetaEvento`

```jsx
// components/TarjetaEvento.jsx
export default function TarjetaEvento({ titulo, fecha, genero, precio }) {
  return (
    <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer group">
      {/* Imagen placeholder */}
      <div className="h-36 bg-zinc-800 group-hover:bg-zinc-750 transition-colors" />

      <div className="p-4">
        <p className="text-gold-400 text-xs font-medium mb-1">{fecha}</p>
        <h3 className="text-zinc-100 font-semibold">{titulo}</h3>
        <p className="text-zinc-500 text-sm mt-0.5">{genero}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-zinc-400 text-sm">{precio}</span>
          <button className="text-xs px-3 py-1 border border-gold-500/40 text-gold-400 rounded-lg hover:bg-gold-500/10 transition-colors">
            Entradas
          </button>
        </div>
      </div>
    </div>
  )
}
```

### `PanelTurno`

```jsx
// components/PanelTurno.jsx
export default function PanelTurno({ numero, espera }) {
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 flex flex-col">
      <h3 className="text-sm font-medium text-zinc-400 mb-auto">Mi turno</h3>

      <div className="flex-1 flex flex-col items-center justify-center py-4">
        <p className="text-zinc-500 text-xs mb-2">Tu posición en fila</p>
        <p className="text-7xl font-bold text-gold-400 leading-none">#{numero}</p>
        <p className="text-zinc-500 text-sm mt-3">{espera}</p>
      </div>

      <button className="mt-4 w-full py-2 text-sm border border-zinc-700 text-zinc-400 rounded-lg hover:bg-zinc-800 transition-colors">
        Ver fila de espera
      </button>
    </div>
  )
}
```

### `SeccionVIP`

```jsx
// components/SeccionVIP.jsx
const SALAS = [
  { id: 1, nombre: 'Sala Roja',  capacidad: 10, precio_hora: 150, disponible: true  },
  { id: 2, nombre: 'Sala Azul',  capacidad: 8,  precio_hora: 120, disponible: false },
  { id: 3, nombre: 'Sala Negra', capacidad: 15, precio_hora: 200, disponible: true  },
]

export default function SeccionVIP() {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-100">Salas VIP</h2>
        <a href="/vip" className="text-sm text-gold-400 hover:text-gold-300">
          Ver todas →
        </a>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {SALAS.map((sala) => (
          <div
            key={sala.id}
            className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 hover:border-zinc-700 transition-colors"
          >
            {/* Imagen placeholder */}
            <div className="h-28 bg-zinc-800 rounded-lg mb-4" />

            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-zinc-100">{sala.nombre}</h3>
                <p className="text-zinc-500 text-sm">Hasta {sala.capacidad} personas</p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  sala.disponible
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-zinc-700 text-zinc-500'
                }`}
              >
                {sala.disponible ? 'Disponible' : 'Ocupada'}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-gold-400 font-semibold">{sala.precio_hora} €/h</span>
              <button
                disabled={!sala.disponible}
                className="text-sm px-4 py-1.5 bg-gold-500 hover:bg-gold-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-semibold rounded-lg transition-colors"
              >
                Reservar
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

---

## 6. Página de Salas VIP

```jsx
// app/vip/page.jsx
import SeccionVIP from '@/components/SeccionVIP'

export default function PaginaVIP() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Salas VIP</h1>
        <p className="text-zinc-500 mt-1">Reserva una sala privada para tu grupo</p>
      </div>
      <SeccionVIP />
    </div>
  )
}
```

---

## 7. Página de Mis Entradas

```jsx
// app/entradas/page.jsx
const MIS_ENTRADAS = [
  {
    id: 1,
    evento: 'Jazz Nights',
    fecha: 'Sáb, 25 mayo · 22:00h',
    tipo: 'Pista Principal',
    precio: 15,
    codigo: 'FLEX-2C7B',
  },
]

export default function PaginaEntradas() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold text-zinc-100">Mis entradas</h1>

      {MIS_ENTRADAS.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p>No tienes entradas todavía</p>
          <a href="/" className="text-gold-400 text-sm mt-2 inline-block hover:text-gold-300">
            Ver próximos eventos →
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {MIS_ENTRADAS.map((entrada) => (
            <div
              key={entrada.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center gap-6"
            >
              {/* QR placeholder */}
              <div className="w-24 h-24 bg-white rounded-xl shrink-0" />

              <div className="flex-1">
                <h3 className="font-bold text-zinc-100 text-lg">{entrada.evento}</h3>
                <p className="text-zinc-400 text-sm mt-0.5">{entrada.fecha}</p>
                <p className="text-zinc-500 text-sm">{entrada.tipo}</p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-gold-400 font-bold text-xl">{entrada.precio} €</p>
                <p className="text-zinc-600 text-xs mt-1 font-mono">{entrada.codigo}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## Estado al final de este apunte

Al terminar este paso tenemos:

```text
apps/web/
  app/
    layout.jsx          ← sidebar + estructura global
    page.jsx            ← dashboard con datos hardcoded
    globals.css
    vip/
      page.jsx
    entradas/
      page.jsx
  components/
    Sidebar.jsx
    TarjetaEvento.jsx
    PanelTurno.jsx
    SeccionVIP.jsx
  tailwind.config.js
```

Los datos son estáticos (definidos en cada archivo). En el siguiente apunte añadiremos **Zustand** para gestionar el estado del carrito y la selección de sala VIP; más adelante conectaremos todo a Supabase.

---

## Navegación

[← 02 — Seguridad con RLS](./02-seguridad-rls.md) · [Teoría previa: Estado en React →](./teoria/04-teoria.md)
