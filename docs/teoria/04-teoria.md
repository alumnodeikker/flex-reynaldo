# 03 — Teoría previa: Estado en React desde cero

> Objetivo: entender los conceptos que aparecen en los stores de Flex antes de leer el código

---

## Antes de empezar: ¿qué problema resuelve el estado global?

En React, los datos que cambian con el tiempo se llaman **estado**. El problema surge cuando varios componentes necesitan compartir ese estado.

```
Sin estado global (prop drilling):

App
 └── Navbar ─────────────── necesita saber si hay items en el carrito
      └── IconoCarrito
App
 └── PaginaMenu
      └── TarjetaProducto ─ puede añadir items al carrito
App
 └── PanelCarrito ────────── necesita la lista completa de items

¿Cómo comparte los datos TarjetaProducto con Navbar y PanelCarrito?
```

La solución naive es "elevar el estado" hasta el componente padre común y pasarlo hacia abajo como props. Eso es **prop drilling**: pasar datos a través de componentes intermedios que no los necesitan. Con tres o cuatro niveles, el código se vuelve inmanejable.

El **estado global** resuelve esto: un almacén centralizado que cualquier componente puede leer o modificar directamente, sin pasar por intermediarios.

---

## 1. Estado local con `useState`

### ¿Qué es el estado en React?

El **estado** es información que un componente guarda entre renders. Cuando el estado cambia, React vuelve a renderizar el componente para reflejar el nuevo valor.

```jsx
import { useState } from 'react'

function Contador() {
  const [cuenta, setCuenta] = useState(0)  // valor inicial: 0

  return (
    <div>
      <p>Cuenta: {cuenta}</p>
      <button onClick={() => setCuenta(cuenta + 1)}>+1</button>
    </div>
  )
}
```

`useState` devuelve un array con dos elementos:
1. El valor actual del estado.
2. Una función para actualizarlo (`setCuenta`). Nunca modificamos el estado directamente (`cuenta = 5`), siempre usamos la función.

### El re-render

Cada vez que llamas a `setCuenta`, React vuelve a ejecutar la función del componente de arriba a abajo. Esto se llama **re-render**. React es lo suficientemente inteligente para actualizar solo el DOM que realmente cambió.

```jsx
// Esto no funciona: no notifica a React del cambio
let cuenta = 0
function incrementar() {
  cuenta = cuenta + 1  // React no sabe que esto cambió → no re-renderiza
}

// Esto sí funciona:
const [cuenta, setCuenta] = useState(0)
function incrementar() {
  setCuenta(cuenta + 1)  // React recibe la notificación → re-renderiza
}
```

### Ejercicio: useState

Crea un componente `Semaforo` que muestre un color (`'rojo'`, `'amarillo'` o `'verde'`) y un botón "Cambiar". Cada pulsación debe avanzar al siguiente color (de verde vuelve a rojo).

<details>
<summary>Respuesta</summary>

```jsx
import { useState } from 'react'

const COLORES = ['rojo', 'amarillo', 'verde']

function Semaforo() {
  const [indice, setIndice] = useState(0)

  function cambiar() {
    setIndice((i) => (i + 1) % COLORES.length)  // % hace que vuelva a 0 al llegar al final
  }

  return (
    <div>
      <p>Color: {COLORES[indice]}</p>
      <button onClick={cambiar}>Cambiar</button>
    </div>
  )
}
```

Guardamos el índice en lugar del nombre del color porque facilita el cálculo del siguiente valor con el operador módulo `%`.

</details>

---

## 2. El problema del prop drilling

### ¿Qué es el prop drilling?

Cuando un dato tiene que "bajar" por varios niveles de componentes mediante props, aunque los componentes intermedios no lo necesiten.

```jsx
// App necesita pasar el carrito hasta TarjetaProducto, pasando por dos niveles que no lo usan

function App() {
  const [items, setItems] = useState([])

  return <PaginaMenu items={items} setItems={setItems} />  // PaginaMenu no usa items
}

function PaginaMenu({ items, setItems }) {
  return <ListaProductos items={items} setItems={setItems} />  // ListaProductos tampoco
}

function ListaProductos({ items, setItems }) {
  return <TarjetaProducto items={items} setItems={setItems} />  // solo aquí se usa
}

function TarjetaProducto({ items, setItems }) {
  // Por fin, aquí se usa setItems
  return <button onClick={() => setItems([...items, nuevoItem])}>Añadir</button>
}
```

En un proyecto real con 5-6 niveles de anidamiento, esto es insostenible: cambiar la estructura de un componente obliga a modificar todos los que están por encima.

### Ejercicio 1

Razona sin escribir código: en Flex, `TarjetaProducto` puede añadir items al carrito y `IconoCarrito` muestra cuántos items hay. Estos componentes están en partes distintas del árbol de componentes. Si quisieras resolver esto solo con `useState` y props, ¿en qué componente tendría que vivir el estado del carrito? ¿Qué problemas prácticos tendría esa solución?

<details>
<summary>Respuesta</summary>

El estado tendría que vivir en el componente padre más cercano que sea ancestro común de `TarjetaProducto` e `IconoCarrito`. En Flex, ese ancestro probablemente sería el componente raíz (`App` o el layout de Next.js).

Problemas prácticos:
1. **Prop drilling**: habría que pasar `items` y `setItems` a través de todos los componentes intermedios (layout → página → sección → componente), aunque ninguno los use.
2. **Re-renders innecesarios**: cada vez que alguien añade un producto, React re-renderiza todo el árbol desde el componente raíz hacia abajo, incluidos componentes que no tienen nada que ver con el carrito.
3. **Mantenimiento**: si reorganizas la estructura de componentes, tienes que actualizar todas las props que atraviesan los niveles.

El estado global evita los tres problemas: cada componente se conecta directamente al store, sin intermediarios.

</details>

---

## 3. Zustand: el store

### ¿Qué es un store?

Un **store** es un objeto que contiene estado y las funciones para modificarlo. En Zustand se crea con la función `create`:

```js
import { create } from 'zustand'

const useContadorStore = create((set) => ({
  // Estado inicial
  cuenta: 0,

  // Acciones (funciones que modifican el estado)
  incrementar: () => set((estado) => ({ cuenta: estado.cuenta + 1 })),
  resetear:    () => set({ cuenta: 0 }),
}))
```

`set` es la función que Zustand nos da para actualizar el estado. Funciona parecido a `setState` en clases de React: podemos pasarle un objeto con los campos a actualizar (el resto se mantiene) o una función que recibe el estado actual y devuelve los cambios.

### Usar el store en un componente

```jsx
function Contador() {
  // Nos suscribimos solo al campo 'cuenta' (suscripción selectiva)
  const cuenta      = useContadorStore((estado) => estado.cuenta)
  const incrementar = useContadorStore((estado) => estado.incrementar)

  return (
    <div>
      <p>{cuenta}</p>
      <button onClick={incrementar}>+1</button>
    </div>
  )
}
```

El componente se re-renderiza solo cuando cambia el campo al que está suscrito. Si el store tiene otros campos que cambian, este componente no se re-renderiza.

### La diferencia entre `set` con objeto y `set` con función

```js
// Con objeto: útil cuando el nuevo valor NO depende del valor anterior
resetear: () => set({ cuenta: 0 })

// Con función: obligatorio cuando el nuevo valor SÍ depende del anterior
incrementar: () => set((estado) => ({ cuenta: estado.cuenta + 1 }))

// ¿Por qué importa? React puede agrupar varias llamadas a set.
// Si usas el objeto y hay dos incrementos seguidos, ambos leerían el mismo valor:
incrementar: () => set({ cuenta: cuenta + 1 })  // MAL: captura 'cuenta' de la closure
// Resultado: dos pulsaciones rápidas sumarían solo 1 en lugar de 2

// Con la función, cada set recibe el estado más reciente:
incrementar: () => set((estado) => ({ cuenta: estado.cuenta + 1 }))  // BIEN
```

### Ejercicio: crear un store básico

Crea un store `useCarritoBasicoStore` con:
- Estado: `items` (array vacío inicial).
- Acción `agregar(item)`: añade un item al final del array.
- Acción `vaciar()`: resetea el array a vacío.

Escribe también el componente `BotonAnadir` que use ese store.

<details>
<summary>Respuesta</summary>

```js
// store/carritoBasicoStore.js
import { create } from 'zustand'

export const useCarritoBasicoStore = create((set) => ({
  items: [],

  agregar: (item) => set((estado) => ({
    items: [...estado.items, item],
  })),

  vaciar: () => set({ items: [] }),
}))
```

```jsx
// components/BotonAnadir.jsx
import { useCarritoBasicoStore } from '@/store/carritoBasicoStore'

export default function BotonAnadir({ producto }) {
  const agregar = useCarritoBasicoStore((estado) => estado.agregar)

  return (
    <button onClick={() => agregar(producto)}>
      Añadir {producto.nombre}
    </button>
  )
}
```

El componente solo se suscribe a la acción `agregar`, no al array `items`. Así no se re-renderiza cuando alguien añade otro producto.

</details>

---

## 4. Inmutabilidad

### ¿Qué es la inmutabilidad?

En JavaScript, los arrays y objetos son **mutables**: se pueden modificar directamente. React y Zustand necesitan que **nunca modifiques el estado directamente**; en cambio, debes crear copias con los cambios aplicados.

```js
// MAL: mutación directa (React no detecta el cambio)
agregar: (item) => set((estado) => {
  estado.items.push(item)    // mutamos el array original
  return { items: estado.items }  // devolvemos la misma referencia → React no ve cambio
})

// BIEN: crear una nueva copia
agregar: (item) => set((estado) => ({
  items: [...estado.items, item],  // spread crea un array nuevo con todos los elementos + el nuevo
}))
```

### Operaciones inmutables habituales

```js
// Añadir al final
{ items: [...estado.items, nuevoItem] }

// Eliminar por id
{ items: estado.items.filter((i) => i.id !== idAEliminar) }

// Modificar un campo de un elemento concreto
{ items: estado.items.map((i) =>
    i.id === idAModificar ? { ...i, cantidad: i.cantidad + 1 } : i
  )
}

// Actualizar un campo de un objeto
{ config: { ...estado.config, tema: 'oscuro' } }
```

El operador **spread** (`...`) copia todos los elementos de un array u objeto en uno nuevo:
```js
const original = [1, 2, 3]
const copia    = [...original, 4]  // [1, 2, 3, 4] — original no se toca
```

### Ejercicio: inmutabilidad

Tienes este store con un bug. Identifícalo y corrígelo:

```js
const useListaStore = create((set) => ({
  tareas: [],

  completar: (id) => set((estado) => {
    const tarea = estado.tareas.find((t) => t.id === id)
    tarea.completada = true   // ← ¿hay algún problema aquí?
    return { tareas: estado.tareas }
  }),
}))
```

<details>
<summary>Respuesta</summary>

Hay dos bugs:
1. `tarea.completada = true` muta el objeto directamente.
2. `return { tareas: estado.tareas }` devuelve la misma referencia de array → Zustand no detecta el cambio y los componentes suscritos no se re-renderizan.

Versión correcta:

```js
completar: (id) => set((estado) => ({
  tareas: estado.tareas.map((t) =>
    t.id === id ? { ...t, completada: true } : t
  ),
})),
```

`{ ...t, completada: true }` crea un nuevo objeto con todos los campos de `t` y sobreescribe `completada`. El array `map` crea un array nuevo. Zustand detecta la nueva referencia y notifica a los componentes.

</details>

---

## 5. Suscripción selectiva

### El problema de los re-renders innecesarios

Por defecto, si te suscribes a todo el store, el componente se re-renderiza cada vez que cambie cualquier campo, aunque no use ese campo:

```js
// MAL: suscripción total → re-render en cualquier cambio del store
const estado = useCarritoStore()
const items  = estado.items
```

Si el store tiene 10 campos y solo usas 1, el componente se re-renderiza 10 veces más de lo necesario.

### Suscripción selectiva con selector

Zustand acepta una función **selector** que extrae solo el trozo de estado que te interesa:

```js
// BIEN: solo re-renderiza cuando cambia 'items'
const items = useCarritoStore((estado) => estado.items)

// Incluso mejor: solo re-renderiza cuando cambia el número (no cuando cambia el array)
const totalUnidades = useCarritoStore((estado) =>
  estado.items.reduce((acc, i) => acc + i.cantidad, 0)
)
```

El segundo ejemplo es importante: si tienes un badge que muestra "3 items", no necesita re-renderizarse cuando el usuario cambia el nombre de un item. Solo debe hacerlo cuando cambia la cantidad total.

### Suscribirse solo a una acción

Las acciones (funciones) en Zustand no cambian entre renders. Puedes suscribirte a ellas de forma selectiva para evitar re-renders al cambiar el estado:

```jsx
// Este componente NUNCA se re-renderiza por cambios en el store
// porque las funciones son estables (no cambian)
function BotonAnadir({ producto }) {
  const agregar = useCarritoStore((estado) => estado.agregar)
  return <button onClick={() => agregar(producto)}>+</button>
}
```

### Ejercicio 2

Tienes este store:

```js
const useAppStore = create((set) => ({
  usuario: null,
  notificaciones: [],
  temaOscuro: false,
  setUsuario:         (u)  => set({ usuario: u }),
  agregarNotif:       (n)  => set((s) => ({ notificaciones: [...s.notificaciones, n] })),
  toggleTema:         ()   => set((s) => ({ temaOscuro: !s.temaOscuro })),
}))
```

Escribe la línea de suscripción correcta para cada componente:
- `Navbar`: necesita el nombre del usuario (`usuario.nombre`).
- `BadgeNotificaciones`: muestra cuántas notificaciones hay.
- `BotonTema`: solo necesita la acción `toggleTema`.

<details>
<summary>Respuesta</summary>

```js
// Navbar: solo re-renderiza cuando cambia usuario.nombre
const nombreUsuario = useAppStore((s) => s.usuario?.nombre)

// BadgeNotificaciones: solo re-renderiza cuando cambia la cantidad
const cantidad = useAppStore((s) => s.notificaciones.length)

// BotonTema: nunca se re-renderiza por cambios de estado (las funciones son estables)
const toggleTema = useAppStore((s) => s.toggleTema)
```

`s.usuario?.nombre` usa el optional chaining (`?.`): si `usuario` es `null`, devuelve `undefined` en lugar de lanzar un error.

</details>

---

## 6. El middleware `persist`

### ¿Qué es un middleware?

Un **middleware** en Zustand es una función que envuelve el store y añade comportamiento adicional sin modificar la lógica interna. Es como una capa extra que intercepta las llamadas a `set`.

```
Sin middleware:
  acción → set → store actualizado

Con middleware persist:
  acción → set → store actualizado → guarda en localStorage
                                   ← carga de localStorage al iniciar
```

### `persist`: guardar el estado en localStorage

`localStorage` es un almacén clave-valor que el navegador guarda en el disco. Los datos persisten aunque el usuario cierre la pestaña o el navegador.

```js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useCarritoStore = create(
  persist(
    (set) => ({
      items: [],
      agregar: (item) => set((s) => ({ items: [...s.items, item] })),
      vaciar:  ()     => set({ items: [] }),
    }),
    {
      name: 'flex-carrito',   // clave bajo la que se guarda en localStorage
    }
  )
)
```

Al cargar la página, Zustand lee automáticamente `localStorage['flex-carrito']` y restaura el estado. Si no existe (primera visita), usa el estado inicial.

### `partialize`: guardar solo parte del estado

No siempre quieres persistir todo. Las funciones no se pueden serializar en JSON (localStorage solo guarda texto), y algunos datos no deben persistir (por ejemplo, un estado de carga `isLoading`):

```js
persist(
  (set) => ({
    items:   [],
    mesaId:  null,
    cargando: false,  // este no queremos persistirlo
    agregar: (item) => set((s) => ({ items: [...s.items, item] })),
  }),
  {
    name:        'flex-carrito',
    partialize:  (estado) => ({
      items:  estado.items,   // solo persistimos estos dos campos
      mesaId: estado.mesaId,
    }),
  }
)
```

`partialize` recibe el estado completo y devuelve el subconjunto que se guardará en localStorage. Las funciones y los campos omitidos no se tocan.

### Ejercicio: persist y partialize

Tienes un store de configuración con: `tema` (`'claro'` o `'oscuro'`), `idioma` (`'es'` o `'en'`), `cargandoPreferencias` (boolean), y `setTema`/`setIdioma` (acciones).

¿Qué campos deberías persistir y cuáles no? Escribe el store completo con `persist` y `partialize`.

<details>
<summary>Respuesta</summary>

```js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useConfigStore = create(
  persist(
    (set) => ({
      tema:                 'claro',
      idioma:               'es',
      cargandoPreferencias: false,
      setTema:   (t) => set({ tema: t }),
      setIdioma: (i) => set({ idioma: i }),
    }),
    {
      name:       'flex-config',
      partialize: (estado) => ({
        tema:   estado.tema,
        idioma: estado.idioma,
        // cargandoPreferencias: no se persiste (es estado efímero)
        // setTema, setIdioma: no se persisten (las funciones no son serializables en JSON)
      }),
    }
  )
)
```

`cargandoPreferencias` es estado transitorio: si el usuario recarga la página, debe volver a `false`. Persistirlo podría dejar la UI bloqueada en un estado de carga si la app se cerró a mitad de una operación. `tema` e `idioma` sí tienen sentido persistirlos: el usuario los elige una vez y espera que se recuerden.

</details>

---

## 7. `get`: leer el estado dentro de una acción

### ¿Para qué sirve `get`?

Dentro de las acciones, `set` actualiza el estado. Pero a veces necesitas leer el estado actual para calcular algo antes de actualizarlo. Para eso existe `get`:

```js
const useStore = create((set, get) => ({
  //                          ↑ segundo parámetro
  items: [],
  precio_hora: 0,

  get totalPrecio() {
    // Computed value: calcula el total cada vez que se llama
    return get().items.reduce((acc, i) => acc + i.precio * i.cantidad, 0)
  },

  aplicarDescuento(porcentaje) {
    const total = get().totalPrecio  // leer el estado actual
    const descuento = total * porcentaje / 100
    // ... lógica que use el total
  },
}))
```

`get()` devuelve el estado actual del store en ese momento. A diferencia de capturar valores en la closure, `get()` siempre da el valor más reciente.

### Ejercicio 3

Tienes este store incompleto. Implementa la acción `quitarItem(id)` que reduce en 1 la cantidad del item con ese id, y si la cantidad llega a 0, elimina el item del array. Usa `set` con función (no con objeto):

```js
const useCarritoStore = create((set, get) => ({
  items: [
    { id: 1, nombre: 'Cerveza', precio: 3.50, cantidad: 2 },
    { id: 2, nombre: 'Nachos',  precio: 5.00, cantidad: 1 },
  ],

  quitarItem: (id) => { /* implementar */ },
}))
```

<details>
<summary>Respuesta</summary>

```js
quitarItem: (id) => set((estado) => ({
  items: estado.items
    .map((i) => i.id === id ? { ...i, cantidad: i.cantidad - 1 } : i)
    .filter((i) => i.cantidad > 0),
})),
```

La cadena `map` + `filter` es el patrón estándar para reducir cantidad y eliminar si llega a 0:
1. `map` recorre todos los items: al que coincide con `id` le resta 1 en `cantidad`, el resto no cambia.
2. `filter` elimina los items cuya cantidad haya quedado en 0 o menos.

Ambas operaciones crean arrays nuevos (inmutables), por lo que Zustand detecta el cambio y notifica a los componentes.

</details>

---

## 8. Server Actions en Next.js

### ¿Qué es una Server Action?

Una **Server Action** es una función asíncrona que se ejecuta en el servidor de Node.js, no en el navegador. Se marca con la directiva `'use server'`.

```js
// app/actions/ejemplo.js
'use server'

export async function miAccion(datos) {
  // Este código corre en el servidor, nunca llega al navegador
  // Puede acceder a la base de datos, variables de entorno secretas, etc.
  const resultado = await baseDeDatos.guardar(datos)
  return resultado
}
```

Desde un componente cliente, se llama como si fuera una función normal:

```jsx
// components/MiFormulario.jsx
'use client'

import { miAccion } from '@/app/actions/ejemplo'

export default function MiFormulario() {
  async function handleSubmit() {
    const resultado = await miAccion({ nombre: 'test' })
    console.log(resultado)
  }

  return <button onClick={handleSubmit}>Enviar</button>
}
```

Next.js se encarga de serializar los argumentos, enviarlos al servidor mediante una petición HTTP interna, ejecutar la función y devolver el resultado al cliente.

### ¿Por qué no llamar directamente a Supabase desde el cliente?

```
Sin Server Actions:
  Componente cliente → llama a Supabase directamente
  → la anon key está expuesta en el bundle de JavaScript del navegador
  → cualquiera puede abrir DevTools y ver la key
  → puede hacer peticiones manuales a Supabase

Con Server Actions:
  Componente cliente → llama a la Server Action (petición HTTP interna)
  → el servidor ejecuta el código con las claves secretas
  → solo llega al cliente el resultado
  → la clave service_role nunca sale del servidor
```

En Flex, `confirmarPedido` es una Server Action porque necesita crear el pedido con el ID del usuario autenticado, que se verifica en el servidor.

### `'use client'` vs `'use server'`

| Directiva | Dónde corre | Puede usar |
|-----------|------------|-----------|
| `'use client'` | Navegador | `useState`, `useEffect`, eventos del DOM, Zustand |
| `'use server'` | Servidor Node.js | Variables de entorno secretas, `service_role key`, acceso directo a BD |
| Sin directiva | Servidor por defecto en Next.js App Router | Igual que `'use server'` pero no puede recibir eventos del cliente |

### Ejercicio: Server Actions

Razona sin escribir código completo: la acción `confirmarPedido` en Flex llama a Supabase con `supabase.auth.getUser()`. ¿Por qué no puede hacerse esto directamente desde el componente `PanelCarrito` en el cliente? ¿Qué pasaría si alguien manipulara la petición para enviar un `cliente_id` falso?

<details>
<summary>Respuesta</summary>

Si `confirmarPedido` corriera en el cliente:
1. **Seguridad**: el componente necesitaría la `service_role key` para escribir en la base de datos sin restricciones RLS. Esa key estaría visible en el bundle de JavaScript → cualquiera podría usarla para manipular la base de datos.

2. **Falsificación del cliente_id**: sin verificación en el servidor, un usuario malicioso podría abrir DevTools, interceptar la petición y enviar `cliente_id = uuid_de_otro_usuario`. El pedido quedaría registrado como si fuera de otra persona.

En la Server Action, `getUser()` verifica el token JWT en el servidor (firmado por Supabase, no falsificable desde el cliente) y obtiene el ID real del usuario. El `cliente_id` del pedido siempre viene del JWT, no del cuerpo de la petición → imposible falsificarlo.

</details>

---

## 9. Acceder al store fuera de componentes React

### Leer el estado sin hooks

Los hooks de React (`useState`, `useEffect`, etc.) solo pueden usarse dentro de componentes. Pero a veces necesitas leer el estado del store desde una Server Action o desde código que no es un componente.

Zustand expone el estado directamente a través del store sin necesidad de hooks:

```js
// Desde cualquier sitio (no solo componentes):
const estadoActual = useCarritoStore.getState()
console.log(estadoActual.items)

// También puedes llamar acciones:
useCarritoStore.getState().vaciar()
```

En las Server Actions **no puedes usar el store de Zustand** directamente porque corren en el servidor y Zustand es una librería del cliente. Los datos del carrito deben pasarse como argumento serializado:

```js
// MAL: intentar usar el store en una Server Action (el store no existe en el servidor)
'use server'
export async function confirmarPedido() {
  const items = useCarritoStore.getState().items  // ❌ Zustand no existe aquí
}

// BIEN: recibir los datos del carrito como parámetro serializado
'use server'
export async function confirmarPedido({ items, mesaId }) {
  // items y mesaId vienen del componente cliente que llamó a esta función
}
```

### Ejercicio 4

¿En qué situación usarías `useCarritoStore.getState()` fuera de un componente React? Da un ejemplo concreto con código.

<details>
<summary>Respuesta</summary>

Un caso útil es en una función de utilidad que prepara datos antes de una petición, llamada desde un event handler pero fuera del componente:

```js
// utils/pedido.js (NO es un componente, NO es una Server Action)

import { useCarritoStore } from '@/store/carritoStore'

export function calcularResumenPedido() {
  const { items, mesaId } = useCarritoStore.getState()

  const subtotal = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0)
  const iva      = subtotal * 0.21

  return {
    items,
    mesaId,
    subtotal: subtotal.toFixed(2),
    iva:      iva.toFixed(2),
    total:    (subtotal + iva).toFixed(2),
  }
}
```

```jsx
// Usada desde un componente sin necesidad de suscripción:
function PanelResumen() {
  function handleVer() {
    const resumen = calcularResumenPedido()  // lee el store sin hooks
    console.log(resumen)
  }
  return <button onClick={handleVer}>Ver resumen</button>
}
```

`getState()` es útil cuando no necesitas que el componente se re-renderice al cambiar el store, solo necesitas el valor en el momento de la acción.

</details>

---

## Resumen de conceptos

| Concepto | En una frase |
|---|---|
| **Estado** | Información que React guarda entre renders; cambiarla provoca un re-render |
| **`useState`** | Hook para estado local de un componente |
| **Prop drilling** | Pasar datos por componentes intermedios que no los necesitan |
| **Store** | Almacén centralizado de estado accesible desde cualquier componente |
| **`create`** | Función de Zustand que crea un store con estado y acciones |
| **`set`** | Función para actualizar el estado del store (usa siempre función cuando depende del estado anterior) |
| **`get`** | Función para leer el estado actual dentro de una acción |
| **Inmutabilidad** | No modificar el estado directamente; crear copias con los cambios |
| **Suscripción selectiva** | Pasar un selector a `useStore` para re-renderizar solo cuando cambia el dato necesario |
| **`persist`** | Middleware que guarda y restaura el estado en `localStorage` automáticamente |
| **`partialize`** | Elige qué campos del store se persisten en `localStorage` |
| **Server Action** | Función que corre en el servidor de Next.js; nunca expone claves secretas al cliente |
| **`'use client'`** | Marca un archivo como código de navegador (necesario para hooks y eventos) |

---

## Ejercicio final integrador

Diseña los stores y la Server Action para un sistema de pedidos de comida a domicilio con estas reglas:

**Requisitos del estado:**
1. Un store `usePedidoStore` que gestione los platos del pedido: añadir, quitar (reducir cantidad), eliminar, vaciar. El pedido debe persistir en localStorage bajo la clave `'delivery-pedido'`, pero solo los campos `platos` y `direccion`.
2. El store debe exponer un valor calculado `totalConEnvio` que sume el precio de los platos más 2.50€ de envío (solo si hay platos; si el pedido está vacío, el total es 0).
3. Una Server Action `enviarPedido({ platos, direccion })` que:
   - Obtenga el usuario autenticado desde el servidor.
   - Inserte el pedido en la tabla `pedidos` con `cliente_id`, `total` y `direccion`.
   - Inserte las líneas en `pedido_lineas` con `pedido_id`, `plato_id`, `cantidad`, `precio_unit`.
   - Devuelva el pedido creado.

<details>
<summary>Respuesta</summary>

```js
// store/pedidoStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const usePedidoStore = create(
  persist(
    (set, get) => ({
      platos:    [],
      direccion: '',

      setDireccion: (d) => set({ direccion: d }),

      agregarPlato: (plato) => set((s) => {
        const existente = s.platos.find((p) => p.id === plato.id)
        if (existente) {
          return {
            platos: s.platos.map((p) =>
              p.id === plato.id ? { ...p, cantidad: p.cantidad + 1 } : p
            ),
          }
        }
        return { platos: [...s.platos, { ...plato, cantidad: 1 }] }
      }),

      quitarPlato: (id) => set((s) => ({
        platos: s.platos
          .map((p) => p.id === id ? { ...p, cantidad: p.cantidad - 1 } : p)
          .filter((p) => p.cantidad > 0),
      })),

      eliminarPlato: (id) => set((s) => ({
        platos: s.platos.filter((p) => p.id !== id),
      })),

      vaciar: () => set({ platos: [], direccion: '' }),

      get totalConEnvio() {
        const platos = get().platos
        if (platos.length === 0) return 0
        const subtotal = platos.reduce((acc, p) => acc + p.precio * p.cantidad, 0)
        return subtotal + 2.50
      },
    }),
    {
      name:       'delivery-pedido',
      partialize: (s) => ({ platos: s.platos, direccion: s.direccion }),
    }
  )
)
```

```js
// app/actions/pedidos.js
'use server'

import { createClient } from '@/lib/supabase/server'

export async function enviarPedido({ platos, direccion }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const subtotal = platos.reduce((acc, p) => acc + p.precio * p.cantidad, 0)
  const total    = subtotal + 2.50

  const { data: pedido, error: errorPedido } = await supabase
    .from('pedidos')
    .insert({ cliente_id: user.id, total, direccion })
    .select()
    .single()

  if (errorPedido) throw new Error(errorPedido.message)

  const lineas = platos.map((p) => ({
    pedido_id:  pedido.id,
    plato_id:   p.id,
    cantidad:   p.cantidad,
    precio_unit: p.precio,
  }))

  const { error: errorLineas } = await supabase
    .from('pedido_lineas')
    .insert(lineas)

  if (errorLineas) throw new Error(errorLineas.message)

  return pedido
}
```

Puntos clave de la solución:
- `totalConEnvio` es un getter computado: no se guarda en el estado, se calcula al vuelo. Así siempre está sincronizado con `platos`.
- `partialize` excluye `setDireccion`, `agregarPlato` y el resto de funciones: las funciones no son serializables en JSON.
- La Server Action recibe `platos` como argumento (no lee el store directamente porque el store vive en el cliente). El `cliente_id` viene siempre del servidor, nunca del cliente.

</details>

---

## Navegación

[← 02 — Teoría previa: Seguridad en bases de datos](./02-teoria.md) · [04 — Estado Global con Zustand →](../04-estado-con-zustand.md)
