# 04 — Estado Global con Zustand

> **Proyecto Flex** · Stack: Next.js · Supabase · Zustand · Stripe  
> Nivel: Principiante-Intermedio

---

## ¿Por qué Zustand y no Context API o Redux?

| Herramienta   | Ventaja                        | Inconveniente                         |
|---------------|--------------------------------|---------------------------------------|
| Context API   | Nativa de React, sin instalar  | Re-render de todo el árbol al cambiar |
| Redux Toolkit | Muy potente, DevTools          | Boilerplate, curva de aprendizaje     |
| **Zustand**   | Mínimo boilerplate, rápido     | Menos ecosistema que Redux            |

Para Flex necesitamos:

- **Carrito de consumiciones** (añadir bebidas/comida desde el menú)
- **Selección de sala VIP** (qué sala, qué franja horaria)
- Sincronización de UI sin recargar la página

Zustand resuelve todo esto con muy poco código y sin contextos anidados.

---

## Instalación

```bash
cd apps/web
pnpm add zustand
```

---

## Estructura de stores

```
store/
  carritoStore.js    ← consumiciones (bebidas, comida)
  reservaStore.js    ← selección de sala VIP + franja horaria
```

---

## 1. `carritoStore.js`

```js
// store/carritoStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCarritoStore = create(
  persist(
    (set, get) => ({
      items: [],
      mesaId: null,

      setMesa(mesaId) {
        set({ mesaId })
      },

      agregarItem(producto) {
        set((estado) => {
          const existente = estado.items.find((i) => i.id === producto.id)
          if (existente) {
            return {
              items: estado.items.map((i) =>
                i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
              ),
            }
          }
          return { items: [...estado.items, { ...producto, cantidad: 1 }] }
        })
      },

      quitarItem(productoId) {
        set((estado) => ({
          items: estado.items
            .map((i) => i.id === productoId ? { ...i, cantidad: i.cantidad - 1 } : i)
            .filter((i) => i.cantidad > 0),
        }))
      },

      eliminarItem(productoId) {
        set((estado) => ({
          items: estado.items.filter((i) => i.id !== productoId),
        }))
      },

      vaciarCarrito() {
        set({ items: [], mesaId: null })
      },

      get totalUnidades() {
        return get().items.reduce((acc, i) => acc + i.cantidad, 0)
      },

      get totalPrecio() {
        return get().items.reduce((acc, i) => acc + i.precio * i.cantidad, 0)
      },
    }),
    {
      name: 'flex-carrito',
      partialize: (estado) => ({ items: estado.items, mesaId: estado.mesaId }),
    }
  )
)
```

---

## 2. `reservaStore.js`

```js
// store/reservaStore.js
import { create } from 'zustand'

export const useReservaStore = create((set, get) => ({
  salaSeleccionada: null,
  fechaInicio: null,
  fechaFin: null,
  paso: 1,

  seleccionarSala(sala) {
    set({ salaSeleccionada: sala, paso: 2 })
  },

  seleccionarHorario(inicio, fin) {
    set({ fechaInicio: inicio, fechaFin: fin, paso: 3 })
  },

  retroceder() {
    set((estado) => ({ paso: Math.max(1, estado.paso - 1) }))
  },

  resetReserva() {
    set({ salaSeleccionada: null, fechaInicio: null, fechaFin: null, paso: 1 })
  },

  get totalReserva() {
    const { salaSeleccionada, fechaInicio, fechaFin } = get()
    if (!salaSeleccionada || !fechaInicio || !fechaFin) return 0
    const horas = (fechaFin - fechaInicio) / (1000 * 60 * 60)
    return Math.max(0, horas * salaSeleccionada.precio_hora)
  },
}))
```

---

## 3. Uso en componentes React

### 3.1 Botón "Añadir al carrito"

```jsx
// components/TarjetaProducto.jsx
'use client'

import { useCarritoStore } from '@/store/carritoStore'

export default function TarjetaProducto({ producto }) {
  const agregarItem = useCarritoStore((estado) => estado.agregarItem)

  return (
    <div className="tarjeta-producto">
      <img src={producto.imagen_url} alt={producto.nombre} />
      <h3>{producto.nombre}</h3>
      <p>{producto.precio} €</p>
      <button onClick={() => agregarItem(producto)}>+ Añadir</button>
    </div>
  )
}
```

### 3.2 Icono del carrito con badge

```jsx
// components/IconoCarrito.jsx
'use client'

import { useCarritoStore } from '@/store/carritoStore'

export default function IconoCarrito() {
  const totalUnidades = useCarritoStore((estado) =>
    estado.items.reduce((acc, i) => acc + i.cantidad, 0)
  )

  return (
    <div className="icono-carrito">
      🛒
      {totalUnidades > 0 && (
        <span className="badge">{totalUnidades}</span>
      )}
    </div>
  )
}
```

### 3.3 Panel del carrito

```jsx
// components/PanelCarrito.jsx
'use client'

import { useCarritoStore } from '@/store/carritoStore'
import { confirmarPedido } from '@/app/actions/pedidos'

export default function PanelCarrito() {
  const { items, mesaId, quitarItem, eliminarItem, vaciarCarrito } = useCarritoStore()
  const total = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0)

  async function handleConfirmar() {
    if (!mesaId) {
      alert('No hay mesa seleccionada. Escanea el QR de tu mesa.')
      return
    }
    await confirmarPedido({ items, mesaId })
    vaciarCarrito()
  }

  if (items.length === 0) return <p>El carrito está vacío</p>

  return (
    <div className="panel-carrito">
      {items.map((item) => (
        <div key={item.id} className="carrito-item">
          <span>{item.nombre}</span>
          <button onClick={() => quitarItem(item.id)}>–</button>
          <span>{item.cantidad}</span>
          <button onClick={() => quitarItem(item.id)}>+</button>
          <span>{(item.precio * item.cantidad).toFixed(2)} €</span>
          <button onClick={() => eliminarItem(item.id)}>🗑</button>
        </div>
      ))}
      <p className="total">Total: {total.toFixed(2)} €</p>
      <button onClick={handleConfirmar}>Confirmar pedido</button>
    </div>
  )
}
```

### 3.4 Selector de sala VIP (flujo por pasos)

```jsx
// components/SelectorSalaVip.jsx
'use client'

import { useReservaStore } from '@/store/reservaStore'

export default function SelectorSalaVip({ salas }) {
  const { paso, salaSeleccionada, seleccionarSala, seleccionarHorario, retroceder } =
    useReservaStore()

  if (paso === 1) {
    return (
      <div>
        <h2>Elige tu sala VIP</h2>
        {salas.map((sala) => (
          <div key={sala.id} onClick={() => seleccionarSala(sala)}>
            <img src={sala.imagen_url} alt={sala.nombre} />
            <h3>{sala.nombre}</h3>
            <p>{sala.precio_hora} €/hora</p>
          </div>
        ))}
      </div>
    )
  }

  if (paso === 2) {
    function handleHorario(e) {
      e.preventDefault()
      const inicio = new Date(e.target.inicio.value)
      const fin    = new Date(e.target.fin.value)
      if (fin <= inicio) {
        alert('La hora de fin debe ser posterior a la de inicio.')
        return
      }
      seleccionarHorario(inicio, fin)
    }

    return (
      <div>
        <button onClick={retroceder}>← Volver</button>
        <h2>Horario para {salaSeleccionada.nombre}</h2>
        <form onSubmit={handleHorario}>
          <label>Inicio: <input type="datetime-local" name="inicio" required /></label>
          <label>Fin:    <input type="datetime-local" name="fin"    required /></label>
          <button type="submit">Continuar al pago</button>
        </form>
      </div>
    )
  }

  if (paso === 3) {
    const horas = (useReservaStore.getState().fechaFin - useReservaStore.getState().fechaInicio) / 3600000
    const total = (horas * salaSeleccionada.precio_hora).toFixed(2)

    return (
      <div>
        <button onClick={retroceder}>← Volver</button>
        <h2>Confirmar reserva</h2>
        <p>Sala: {salaSeleccionada.nombre}</p>
        <p>Horas: {horas}h · Total: {total} €</p>
        {/* El botón de pago irá aquí — ver apunte 05 */}
      </div>
    )
  }
}
```

---

## 4. Sincronización de UI sin recargar

Zustand actualiza la UI de forma automática cuando cambia el estado:

```
Usuario pulsa "Añadir" → agregarItem() → Zustand actualiza items
                       ↓
Todos los componentes suscritos a 'items' se re-renderizan automáticamente
```

**Suscripción selectiva** (importante para rendimiento):

```js
// MAL: se suscribe a TODO el estado → re-render en cualquier cambio
const estado = useCarritoStore()

// BIEN: solo re-renderiza cuando cambia 'items'
const items = useCarritoStore((estado) => estado.items)

// MEJOR: solo re-renderiza cuando cambia el número de unidades
const totalUnidades = useCarritoStore((estado) =>
  estado.items.reduce((acc, i) => acc + i.cantidad, 0)
)
```

---

## 5. Acceder al store fuera de React (Server Actions)

```js
// app/actions/pedidos.js
'use server'

import { supabase } from '@/lib/supabase'

export async function confirmarPedido({ items, mesaId }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const total = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0)

  const { data: pedido, error: errorPedido } = await supabase
    .from('pedidos')
    .insert({ mesa_id: mesaId, cliente_id: user.id, total })
    .select()
    .single()

  if (errorPedido) throw new Error(errorPedido.message)

  const lineas = items.map((item) => ({
    pedido_id:   pedido.id,
    producto_id: item.id,
    cantidad:    item.cantidad,
    precio_unit: item.precio,
  }))

  const { error: errorItems } = await supabase
    .from('pedido_items')
    .insert(lineas)

  if (errorItems) throw new Error(errorItems.message)

  return pedido
}
```

---

## Reto Flex 🎸

1. Añade al `carritoStore` una acción `aplicarDescuento(codigo)` que:
   - Acepte los códigos `'FLEX10'` (10% de descuento) y `'FLEX20'` (20%).
   - Guarde el descuento aplicado en el estado (`descuento: 0`).
   - Si el código no es válido, lance un error con el mensaje `'Código no válido'`.

2. Modifica el componente `PanelCarrito` para mostrar:
   - Un input para introducir el código.
   - El precio con descuento aplicado.

3. Persiste el descuento en localStorage junto con `items` y `mesaId`.

> **Pista:** Usa el campo `partialize` del middleware `persist` para incluir también `descuento` en los datos guardados.

---

## Navegación

[← 03 — Interfaz estática](./03-ui-estatica.md) · [05 — Stripe y Edge Functions →](./05-stripe-y-edge-functions.md)
