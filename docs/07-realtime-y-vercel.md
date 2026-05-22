# 06 — Panel del Camarero con Realtime y Despliegue en Vercel

> **Proyecto Flex** · Stack: Next.js · Supabase · Zustand · Stripe  
> Nivel: Intermedio

---

## ¿Por qué Supabase Realtime?

Sin Realtime, el camarero tendría que recargar la página para ver pedidos nuevos. Con Realtime, Supabase abre una conexión WebSocket y **empuja los cambios** de la DB directamente al navegador.

```
Sin Realtime:
  Camarero ──▶ Recarga página ──▶ SELECT pedidos ──▶ DB
  (manual, lento, propenso a errores)

Con Realtime:
  DB cambia ──▶ Supabase Realtime ──▶ WebSocket ──▶ Camarero
  (automático, inmediato, sin recargar)
```

Supabase Realtime escucha cambios a nivel de tabla usando el mecanismo de **replicación lógica** de PostgreSQL. Solo necesitamos habilitarlo en las tablas que nos interesan.

---

## 1. Habilitar Realtime en la tabla `pedidos`

```sql
-- En el SQL Editor de Supabase:
-- Añade la tabla 'pedidos' a la publicación de replicación de Realtime
alter publication supabase_realtime add table public.pedidos;
alter publication supabase_realtime add table public.pedido_items;
```

> También puedes hacerlo desde el Dashboard: **Database → Replication → supabase_realtime** → activa los toggles de `pedidos` y `pedido_items`.

---

## 2. Store Zustand para el panel del camarero

```js
// store/panelStore.js
import { create } from 'zustand'

/**
 * Store para el panel del camarero.
 * Gestiona la lista de pedidos activos y la suscripción Realtime.
 * No persistimos en localStorage: el camarero siempre ve el estado en vivo.
 */
export const usePanelStore = create((set, get) => ({
  // ─── Estado ─────────────────────────────────────────────────────
  pedidos:     [],           // array de pedidos activos con sus items
  cargando:    true,
  error:       null,
  canal:       null,         // referencia al canal Realtime (para desuscribirse)
  filtroEstado: 'pendiente', // qué estado mostrar: 'pendiente'|'en_barra'|'listo'

  // ─── Acciones ───────────────────────────────────────────────────

  setFiltroEstado(estado) {
    set({ filtroEstado: estado })
  },

  /**
   * Carga los pedidos iniciales desde Supabase.
   * Se llama una vez al montar el panel.
   */
  async cargarPedidos(supabase, piso) {
    set({ cargando: true, error: null })

    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id,
        estado,
        total,
        creado_en,
        mesas ( numero, piso ),
        pedido_items (
          cantidad,
          precio_unit,
          productos ( nombre )
        )
      `)
      .in('estado', ['pendiente', 'en_barra', 'listo'])
      .eq('mesas.piso', piso)       // solo el piso del camarero
      .order('creado_en', { ascending: true })

    if (error) {
      set({ error: error.message, cargando: false })
      return
    }

    set({ pedidos: data ?? [], cargando: false })
  },

  /**
   * Suscribe el panel a cambios en 'pedidos' via Realtime.
   * Devuelve una función de cleanup para desuscribirse.
   */
  suscribir(supabase, piso) {
    const canal = supabase
      .channel(`panel-camarero-piso-${piso}`)
      // Escucha INSERT: pedido nuevo
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'pedidos',
        },
        async (payload) => {
          const nuevoPedido = payload.new

          // Enriquecemos el pedido con sus relaciones (el payload no las incluye)
          const { data } = await supabase
            .from('pedidos')
            .select(`
              id, estado, total, creado_en,
              mesas ( numero, piso ),
              pedido_items ( cantidad, precio_unit, productos ( nombre ) )
            `)
            .eq('id', nuevoPedido.id)
            .single()

          if (!data || data.mesas?.piso !== piso) return

          set((estado) => ({ pedidos: [...estado.pedidos, data] }))
        }
      )
      // Escucha UPDATE: cambio de estado del pedido
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'pedidos',
        },
        (payload) => {
          const actualizado = payload.new

          set((estado) => ({
            pedidos: estado.pedidos
              // Si el pedido pasa a 'entregado' o 'cancelado', lo quitamos del panel
              .filter((p) => {
                if (p.id !== actualizado.id) return true
                return !['entregado', 'cancelado'].includes(actualizado.estado)
              })
              // Si sigue activo, actualizamos su estado
              .map((p) =>
                p.id === actualizado.id ? { ...p, estado: actualizado.estado } : p
              ),
          }))
        }
      )
      .subscribe()

    set({ canal })

    // Devuelve la función de cleanup
    return () => {
      supabase.removeChannel(canal)
      set({ canal: null })
    }
  },

  /**
   * Actualiza el estado de un pedido (staff/admin).
   */
  async cambiarEstado(supabase, pedidoId, nuevoEstado) {
    const { error } = await supabase
      .from('pedidos')
      .update({ estado: nuevoEstado, actualizado: new Date().toISOString() })
      .eq('id', pedidoId)

    if (error) console.error('Error actualizando estado:', error)
    // El UPDATE de Supabase Realtime actualizará la lista automáticamente
  },
}))
```

---

## 3. Componente Panel del Camarero

```jsx
// components/PanelCamarero.jsx
'use client'

import { useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { usePanelStore } from '@/store/panelStore'

const ESTADOS_SIGUIENTES = {
  pendiente: 'en_barra',
  en_barra:  'listo',
  listo:     'entregado',
}

const ETIQUETAS_ESTADO = {
  pendiente: '🕐 Pendiente',
  en_barra:  '🍺 En barra',
  listo:     '✅ Listo',
  entregado: '📦 Entregado',
}

export default function PanelCamarero({ piso }) {
  const {
    pedidos,
    cargando,
    error,
    filtroEstado,
    setFiltroEstado,
    cargarPedidos,
    suscribir,
    cambiarEstado,
  } = usePanelStore()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    // Carga inicial
    cargarPedidos(supabase, piso)

    // Suscripción Realtime
    const desuscribir = suscribir(supabase, piso)

    // Cleanup: se ejecuta cuando el componente se desmonta
    return desuscribir
  }, [piso])  // si cambia el piso, recarga y resuscribe

  const pedidosFiltrados = pedidos.filter((p) => p.estado === filtroEstado)

  if (cargando) return <p>Cargando pedidos...</p>
  if (error)    return <p>Error: {error}</p>

  return (
    <div className="panel-camarero">
      <h1>Panel Camarero — Piso {piso}</h1>

      {/* Filtros por estado */}
      <div className="filtros">
        {['pendiente', 'en_barra', 'listo'].map((estado) => (
          <button
            key={estado}
            onClick={() => setFiltroEstado(estado)}
            className={filtroEstado === estado ? 'activo' : ''}
          >
            {ETIQUETAS_ESTADO[estado]}
            {/* Badge con el número de pedidos en ese estado */}
            <span className="badge">
              {pedidos.filter((p) => p.estado === estado).length}
            </span>
          </button>
        ))}
      </div>

      {/* Lista de pedidos */}
      {pedidosFiltrados.length === 0 ? (
        <p>No hay pedidos {filtroEstado}.</p>
      ) : (
        <div className="lista-pedidos">
          {pedidosFiltrados.map((pedido) => (
            <TarjetaPedido
              key={pedido.id}
              pedido={pedido}
              onCambiarEstado={(nuevoEstado) =>
                cambiarEstado(supabase, pedido.id, nuevoEstado)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TarjetaPedido({ pedido, onCambiarEstado }) {
  const estadoSiguiente = ESTADOS_SIGUIENTES[pedido.estado]
  const tiempoEspera    = Math.floor(
    (Date.now() - new Date(pedido.creado_en)) / 60000
  )

  return (
    <div className={`tarjeta-pedido estado-${pedido.estado}`}>
      <div className="cabecera">
        <strong>Mesa {pedido.mesas?.numero}</strong>
        <span className={`tiempo ${tiempoEspera > 10 ? 'urgente' : ''}`}>
          {tiempoEspera} min
        </span>
      </div>

      <ul className="items">
        {pedido.pedido_items?.map((item, i) => (
          <li key={i}>
            {item.cantidad}× {item.productos?.nombre}
          </li>
        ))}
      </ul>

      <div className="pie">
        <span>{pedido.total?.toFixed(2)} €</span>
        {estadoSiguiente && (
          <button onClick={() => onCambiarEstado(estadoSiguiente)}>
            Marcar como {ETIQUETAS_ESTADO[estadoSiguiente]}
          </button>
        )}
      </div>
    </div>
  )
}
```

---

## 4. Ruta del panel (protegida por rol)

```jsx
// app/panel/page.jsx
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PanelCamarero from '@/components/PanelCamarero'

export default async function PaginaPanel() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfil || !['staff', 'admin'].includes(perfil.rol)) {
    redirect('/')  // clientes no tienen acceso al panel
  }

  // El piso del camarero podría estar en su perfil.
  // Por ahora asignamos piso 1 por defecto (ver Reto Flex).
  return <PanelCamarero piso={1} />
}
```

---

## 5. Despliegue en Vercel

### 5.1 Preparar el repositorio

```bash
# Asegúrate de tener un .gitignore correcto
echo ".env.local" >> .gitignore
echo ".env*.local" >> .gitignore

git add .
git commit -m "feat: proyecto Flex inicial"
git push origin main
```

### 5.2 Conectar con Vercel

1. Ve a [vercel.com](https://vercel.com) → **Add New Project**
2. Importa tu repositorio de GitHub
3. Framework: **Next.js** (Vercel lo detecta solo)
4. Click en **Deploy** (la primera vez fallará porque faltan las variables de entorno)

### 5.3 Variables de entorno en Vercel

Ve a tu proyecto → **Settings → Environment Variables** y añade:

| Variable                              | Valor                              | Entornos              |
|---------------------------------------|------------------------------------|-----------------------|
| `NEXT_PUBLIC_SUPABASE_URL`            | `https://xxxx.supabase.co`        | Production, Preview   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`       | `eyJ...`                           | Production, Preview   |
| `SUPABASE_SERVICE_ROLE_KEY`           | `eyJ...`                           | Production, Preview   |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`  | `pk_live_...` / `pk_test_...`      | Production / Preview  |
| `STRIPE_SECRET_KEY`                   | `sk_live_...` / `sk_test_...`      | Production / Preview  |
| `STRIPE_WEBHOOK_SECRET`               | `whsec_...`                        | Production, Preview   |
| `NEXT_PUBLIC_APP_URL`                 | `https://flex.vercel.app`          | Production            |
| `NEXT_PUBLIC_APP_URL`                 | `https://flex-git-main-....vercel.app` | Preview          |

> **Importante:** Las variables `NEXT_PUBLIC_*` son accesibles en el cliente (navegador). Las demás solo en el servidor. Nunca pongas `STRIPE_SECRET_KEY` ni `SUPABASE_SERVICE_ROLE_KEY` con el prefijo `NEXT_PUBLIC_`.

### 5.4 Re-desplegar tras añadir variables

```
Vercel Dashboard → tu proyecto → Deployments → ... → Redeploy
```

O simplemente haz un nuevo `git push` con cualquier cambio mínimo.

### 5.5 Actualizar las URLs del webhook de Stripe

Con la app desplegada en `https://flex.vercel.app`, actualiza el endpoint en Stripe:

```
https://flex.vercel.app   ← ya no es localhost
```

Y en los secrets de Supabase:

```bash
supabase secrets set NEXT_PUBLIC_APP_URL=https://flex.vercel.app
supabase functions deploy crear-checkout
supabase functions deploy stripe-webhook
supabase functions deploy verificar-entrada
```

---

## 6. Configurar Supabase Auth para la URL de producción

En el Dashboard de Supabase → **Authentication → URL Configuration**:

```
Site URL:         https://flex.vercel.app
Redirect URLs:    https://flex.vercel.app/**
                  http://localhost:3000/**    ← para desarrollo local
```

Sin esto, el login con OAuth o magic links redirige a la URL incorrecta.

---

## 7. Checklist de despliegue

```
□ Variables de entorno añadidas en Vercel
□ Site URL y Redirect URLs actualizados en Supabase Auth
□ Buckets de Storage creados y políticas aplicadas
□ Edge Functions desplegadas con los secrets correctos
□ Webhook de Stripe apuntando a la URL de producción
□ Realtime habilitado en tablas 'pedidos' y 'pedido_items'
□ PWA: manifest.json accesible en /manifest.json (status 200)
□ HTTPS activo (Vercel lo gestiona automáticamente)
```

---

## Reto Flex 🎸

1. Añade el campo `piso` al perfil del staff en la tabla `perfiles` (columna `piso_asignado smallint`). Modifica la página `/panel` para que el camarero vea automáticamente los pedidos del piso que tiene asignado en su perfil.

2. Implementa una **notificación sonora** en el panel: cuando llegue un pedido nuevo via Realtime, reproduce un sonido de notificación usando la Web Audio API:
   ```js
   const ctx = new AudioContext()
   const osc = ctx.createOscillator()
   osc.connect(ctx.destination)
   osc.start()
   osc.stop(ctx.currentTime + 0.2)
   ```

3. Añade en Vercel un entorno de **Preview** diferente al de Production: usa las claves `pk_test_` de Stripe en Preview y `pk_live_` en Production. Configura los valores por entorno desde el Dashboard de Vercel.

> **Pista:** Vercel permite definir valores distintos para la misma variable según el entorno (Production / Preview / Development) directamente desde la interfaz de variables de entorno.

---

## Navegación

[← 06 — PWA y Entradas QR](./06-pwa-y-entradas-qr.md)
