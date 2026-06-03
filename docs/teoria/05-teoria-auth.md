# 05 — Teoría previa: Autenticación web desde cero

> Objetivo: entender los conceptos que aparecen en el sistema de auth de Flex antes de leer el código

---

## Antes de empezar: ¿qué problema resuelve la autenticación?

Imagina una discoteca. Hay zonas públicas (la entrada) y zonas privadas (sala VIP, backstage). Para entrar a las zonas privadas necesitas una **pulsera** que te dieron al pagar.

En una app web ocurre exactamente lo mismo:

```
Discoteca                          App web
─────────────────────────────────────────────────
Zona pública (entrada)        →    /login, /register
Zona privada (pista, VIP)     →    /, /vip, /perfil
Seguridad en la puerta        →    proxy.js
Pulsera que te identifica     →    cookie de sesión
Diferentes accesos por rol    →    cliente / staff / admin
```

La autenticación resuelve dos preguntas:
1. **¿Quién eres?** (identificación — login)
2. **¿Qué puedes hacer?** (autorización — roles)

---

## 1. Cómo el navegador recuerda quién eres

El problema central: HTTP es **sin memoria**. Cada petición que hace tu navegador llega al servidor como si fuera la primera vez. El servidor no sabe si la petición de ahora viene del mismo usuario que la de hace 2 segundos.

Para solucionar esto existen dos mecanismos:

### localStorage

`localStorage` es una especie de bloc de notas dentro del navegador. La app guarda el token ahí y lo envía manualmente en cada petición. El servidor lo valida y sabe quién eres.

**Problema:** `localStorage` solo es accesible desde JavaScript. El servidor nunca ve el token directamente — necesita que el cliente se lo mande. Esto hace imposible proteger rutas en el servidor.

### Cookies

```
Servidor                          Navegador
──────────────────────────────────────────────────────
Set-Cookie: token=abc123    →     (guarda la cookie)
                                        │
                            ┌───────────┘
                            │ En cada petición futura:
                            ▼
                     Cookie: token=abc123   →   Servidor
                                                (ve el token
                                                 automáticamente)
```

Las cookies las envía el navegador **automáticamente** en cada petición HTTP, sin que el JavaScript haga nada. El servidor las ve desde el primer momento, antes de ejecutar cualquier código de la página.

**Por eso Supabase SSR usa cookies y no localStorage**: permite que el servidor sepa si el usuario está autenticado sin necesitar JavaScript del cliente.

---

> ### 🏋️ Ejercicio 1
>
> Sin escribir código, responde:
>
> 1. ¿Cuál de los dos (cookies o localStorage) puede leer el servidor sin necesitar JavaScript del cliente?
> 2. Si quieres proteger una ruta en el servidor antes de renderizarla, ¿cuál necesitas usar?
> 3. ¿Por qué `@supabase/ssr` usa cookies en vez del cliente normal de Supabase?

<details>
<summary>Ver respuesta</summary>

1. Las **cookies**. El navegador las envía automáticamente en cada petición HTTP, el servidor las ve sin necesitar que JavaScript haga nada.
2. **Cookies**. Con localStorage el servidor nunca ve el token — necesitaría que el cliente se lo mandara, y para entonces ya habría renderizado la página.
3. Porque el cliente normal de Supabase usa localStorage, que no es accesible desde el servidor. `@supabase/ssr` reemplaza ese mecanismo por cookies para que el proxy y los Server Components puedan leer la sesión.

</details>

---

## 2. Dónde corre el código en Next.js

En Next.js hay dos entornos de ejecución completamente distintos:

```
┌─────────────────────────────────────────────────────────┐
│                      SERVIDOR (Node.js)                  │
│                                                          │
│  proxy.js         Corre ANTES de renderizar nada         │
│  layout.jsx       Server Component (lee sesión y rol)    │
│  page.jsx         Server Components (async function)     │
│  actions/auth.js  Server Actions ('use server')          │
│                                                          │
│  Tiene acceso a: cookies HTTP, variables de entorno      │
│  NO tiene acceso a: window, localStorage, DOM            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   NAVEGADOR (JavaScript)                  │
│                                                          │
│  Shell.jsx        Client Component ('use client')        │
│  BottomNav.jsx    Client Component                       │
│  Sidebar.jsx      Client Component                       │
│                                                          │
│  Tiene acceso a: DOM, eventos de usuario                 │
│  NO tiene acceso a: cookies HttpOnly, sistema de ficheros│
└─────────────────────────────────────────────────────────┘
```

Esto es crucial para entender por qué el sistema de auth tiene las piezas que tiene.

---

> ### 🏋️ Ejercicio 2
>
> Clasifica cada caso como "necesita Server Component" o "necesita Client Component":
>
> 1. Un formulario con estado (`useState`) que muestra errores en tiempo real
> 2. Una página que lee datos de la base de datos al cargar
> 3. Un botón que abre un menú desplegable al hacer clic
> 4. Una página que verifica el rol del usuario antes de renderizar
> 5. Un componente que escucha eventos del teclado

<details>
<summary>Ver respuesta</summary>

1. **Client Component** — `useState` solo existe en el navegador.
2. **Server Component** — leer la base de datos es una operación de servidor. No necesita JavaScript en el cliente.
3. **Client Component** — el clic es un evento del DOM, solo accesible en el navegador.
4. **Server Component** — la verificación del rol ocurre en el servidor antes de renderizar, con `redirect()` si no tiene permiso.
5. **Client Component** — los eventos del teclado son del DOM, solo existen en el navegador.

</details>

---

## 3. El Proxy: el guardia de seguridad

El proxy es un archivo especial (`proxy.js`) que Next.js ejecuta en el servidor **antes de renderizar cualquier página**. Intercepta cada petición HTTP y puede:
- Dejarla pasar
- Redirigirla a otra URL

Piensa en él como el guardia de la puerta de la discoteca: mira tu pulsera antes de dejarte entrar, sin que tengas que llegar a la barra.

```js
// proxy.js (versión mínima para entender el concepto)
import { NextResponse } from 'next/server'

export function proxy(request) {
  const token = request.cookies.get('mi-sesion')
  const path = request.nextUrl.pathname

  if (!token && path !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (token && path === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}
```

### ¿Por qué no hacerlo en el cliente?

```
Con proxy (servidor):
   request → proxy verifica → si no auth: redirect 302
   El servidor nunca envía el HTML privado.

Sin proxy (cliente):
   request → servidor renderiza la página completa → navegador descarga HTML+JS
   → JS ejecuta → detecta no-auth → redirect
   El servidor YA envió el contenido privado. Tarde.
```

---

> ### 🏋️ Ejercicio 3
>
> Traza qué ocurre en cada escenario:
>
> **A:** Usuario sin sesión visita `/vip`
> ```
> petición a /vip → proxy → ?
> ```
>
> **B:** Usuario autenticado visita `/login`
> ```
> petición a /login → proxy → ?
> ```
>
> **C:** Usuario autenticado con rol `cliente` visita `/admin`
> ```
> petición a /admin → proxy → ?
> ```

<details>
<summary>Ver respuesta</summary>

**A:** `petición a /vip → proxy → no hay sesión → redirect /login`
El usuario nunca ve `/vip`. El servidor no renderiza nada.

**B:** `petición a /login → proxy → hay sesión y la ruta es pública → redirect /`
Si ya estás autenticado no tiene sentido ir al login, así que el proxy te manda al inicio.

**C:** `petición a /admin → proxy → hay sesión ✓ → comprueba rol en perfiles → rol es 'cliente', no tiene permiso → redirect /`
El proxy tiene la tabla `RUTAS_ROL` y verifica el rol para rutas restringidas. El usuario nunca ve `/admin`.

</details>

---

## 4. Server Actions: funciones del servidor que llamas desde el cliente

Antes de los Server Actions, enviar un formulario de login requería:

```js
// Enfoque antiguo — mucho código para algo simple
async function handleSubmit(e) {
  e.preventDefault()
  const res = await fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await res.json()
  if (data.error) setError(data.error)
}
```

Con Server Actions, la misma operación se simplifica:

```js
// src/lib/actions/auth.js
'use server'

export async function login(formData) {
  const email = formData.get('email')
  const password = formData.get('password')
  // ... lógica de autenticación ...
  if (error) return { error: 'Credenciales incorrectas' }
  redirect('/')
}
```

```jsx
// Desde el cliente, se llama como una función normal
const formData = new FormData(e.target)
const result = await login(formData)  // ← el servidor ejecuta el código de arriba
if (result?.error) setError(result.error)
```

Next.js gestiona la comunicación por debajo — no necesitas escribir `fetch` ni definir rutas de API.

### ¿Qué es FormData?

`new FormData(e.target)` recoge todos los inputs del formulario de una vez usando su atributo `name`. Por eso es importante que los inputs tengan `name`:

```html
<input name="email" />     ← formData.get('email') funciona
<input />                  ← formData.get('email') devuelve null
```

### ¿Qué hace `redirect()` dentro de un Server Action?

`redirect()` lanza internamente una excepción que Next.js intercepta. El cliente recibe una instrucción de navegación y va a la nueva URL. El código después del `redirect()` nunca se ejecuta.

---

> ### 🏋️ Ejercicio 4
>
> Dado este Server Action:
>
> ```js
> 'use server'
>
> export async function cambiarNombre(formData) {
>   const nombre = formData.get('nombre')
>   if (nombre.length < 2) return { error: 'El nombre es demasiado corto' }
>   await supabase.from('perfiles').update({ nombre }).eq('id', userId)
>   redirect('/perfil')
> }
> ```
>
> 1. ¿Dónde corre este código, en el servidor o en el navegador?
> 2. ¿Qué ocurre si el nombre tiene 1 carácter?
> 3. ¿Qué ocurre si el nombre es válido?
> 4. ¿Puede este Server Action acceder a `localStorage`? ¿Por qué?

<details>
<summary>Ver respuesta</summary>

1. En el **servidor**. La directiva `'use server'` lo indica. Next.js lo ejecuta en Node.js, no en el navegador.
2. La función devuelve `{ error: 'El nombre es demasiado corto' }`. El `redirect` no se ejecuta. El cliente recibe el error y puede mostrarlo al usuario.
3. Se actualiza la tabla `perfiles` en la base de datos y se lanza `redirect('/perfil')`. El cliente navega automáticamente a `/perfil`.
4. **No**. `localStorage` es una API del navegador. El servidor (Node.js) no tiene `window` ni `localStorage`. Si intentaras acceder, obtendría un error `localStorage is not defined`.

</details>

---

## 5. Dos clientes de Supabase: ¿por qué?

Supabase necesita leer el token de sesión para saber quién está autenticado. El problema es que el token está en un lugar diferente según dónde corra el código:

```
En el navegador → token en cookies accesibles por JS
En el servidor  → token en las cookies HTTP de la petición
En el proxy     → token en el objeto request de Next.js
```

Por eso `@supabase/ssr` tiene dos clientes con la misma API pero distinta forma de acceder al token:

```
src/lib/supabase/client.js  → createBrowserClient  → para Client Components
src/lib/supabase/server.js  → createServerClient   → para Server Components y Actions
proxy.js                    → createServerClient   → con request.cookies directamente
```

El proxy no puede usar `server.js` porque este usa `cookies()` de `next/headers`, una API que solo funciona dentro del ciclo de vida de Next.js — no en el proxy, que corre antes.

---

> ### 🏋️ Ejercicio 5
>
> ¿Qué cliente de Supabase usarías en cada caso? (`client.js`, `server.js`, o ninguno — créalo inline como en el proxy)
>
> 1. Un Server Action que actualiza el email del usuario
> 2. Un botón "Cerrar sesión" en un Client Component
> 3. El proxy verificando si hay sesión activa
> 4. Un Server Component que lista las reservas del usuario

<details>
<summary>Ver respuesta</summary>

1. **`server.js`** — los Server Actions corren en el servidor y tienen acceso a `cookies()` de `next/headers`.
2. **`client.js`** — el botón es un Client Component que corre en el navegador. Usa `createBrowserClient`.
3. **Inline** (como en el proxy real) — el proxy corre antes del ciclo de vida de Next.js y no puede usar `cookies()` de `next/headers`. Necesita crear el cliente con `request.cookies` directamente.
4. **`server.js`** — los Server Components corren en el servidor y tienen acceso a `cookies()` de `next/headers`.

</details>

---

## 6. Leer el rol en el servidor

Una vez que el proxy deja pasar la petición, los componentes de navegación (Sidebar, BottomNav) necesitan saber el rol del usuario para mostrar los enlaces correctos.

El enfoque más simple: leerlo en el servidor en `layout.jsx` y pasarlo como prop.

```
layout.jsx (Server Component)
  → lee usuario + rol de Supabase
  → pasa rol y nombre a Shell (Client Component)
      → Shell los pasa a Sidebar y BottomNav
```

Así los componentes de navegación reciben el rol directamente — sin llamadas a Supabase, sin listeners, sin estado asíncrono en el cliente.

```
proxy.js   →  protege el acceso (quién puede entrar)
layout.jsx →  distribuye los datos (quién eres, qué rol tienes)
Sidebar    →  usa el rol para filtrar los enlaces
```

---

> ### 🏋️ Ejercicio 6
>
> Explica con tus palabras qué pasaría si leyéramos el rol en el cliente (con un `useEffect` y una llamada a Supabase) en lugar de leerlo en el servidor:
>
> 1. ¿Qué vería el usuario mientras se carga el rol?
> 2. ¿Cuántas veces se haría la llamada a Supabase comparado con el enfoque de `layout.jsx`?
> 3. ¿Sería más o menos código? ¿Por qué?

<details>
<summary>Ver respuesta</summary>

1. El Sidebar y BottomNav aparecerían sin los enlaces de gestión (rol `null`) y luego harían un salto visual al recibir el rol real. Es el efecto conocido como "flash of incorrect content".
2. Con `useEffect` se haría una llamada a Supabase **cada vez que el componente monta** — es decir, en cada navegación entre páginas. Con `layout.jsx` se hace **una sola vez por petición** en el servidor, sin coste en el cliente.
3. **Más código**: necesitarías `useState` para el rol, `useEffect` para la llamada, manejo del estado de carga, y el cliente de Supabase en el navegador. El enfoque de `layout.jsx` es un `await` de tres líneas.

</details>

---

## 7. ¿Por qué `getUser()` y no `getSession()`?

Supabase tiene dos funciones para obtener la sesión actual:

```js
supabase.auth.getSession()  // Lee la cookie local. Rápido, sin red.
supabase.auth.getUser()     // Valida el token con el servidor de Supabase. Más lento, más seguro.
```

`getSession()` solo lee lo que hay en la cookie sin verificarlo. Si alguien manipulara la cookie, `getSession()` lo aceptaría como válido.

`getUser()` envía el token al servidor de Supabase para que lo verifique. Si el token está manipulado, Supabase lo detecta y devuelve `user: null`.

**En el proxy siempre se usa `getUser()`** porque es la primera línea de defensa.

---

> ### 🏋️ Ejercicio 7
>
> Un desarrollador propone este cambio para "hacer el proxy más rápido":
>
> ```js
> // Antes
> const { data: { user } } = await supabase.auth.getUser()
>
> // Propuesta
> const { data: { session } } = await supabase.auth.getSession()
> const user = session?.user
> ```
>
> 1. ¿Es correcto este cambio? ¿Por qué sí o por qué no?
> 2. ¿En qué situación concreta podría fallar?

<details>
<summary>Ver respuesta</summary>

1. **No es correcto** para el proxy. `getSession()` es más rápido porque no hace ninguna petición de red — solo lee la cookie local. Pero eso es exactamente el problema: no verifica que el token sea legítimo. Cualquiera que pueda modificar su cookie podría falsificar una sesión válida.
2. Si un atacante copia una cookie de sesión de otro usuario (robo de sesión) o manipula el contenido de su propia cookie, `getSession()` lo aceptaría como válido porque no lo contrasta con el servidor de Supabase. `getUser()` lo detectaría y devolvería `user: null`.

</details>

---

## 8. Roles: dos capas de protección

### Capa 1: UI (ocultar enlaces)

```jsx
const itemsGestion = NAV_STAFF.filter(i => i.roles.includes(rol))
// Si el array está vacío, no se renderiza la sección de gestión
```

Esto es **UX**, no seguridad. Si alguien escribe `/admin` directamente en la barra de direcciones, el proxy le deja pasar (está autenticado).

### Capa 2: Servidor (bloquear acceso)

```jsx
// src/app/admin/page.jsx
export default async function PaginaAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase
    .from('perfiles').select('rol').eq('id', user.id).single()

  if (perfil?.rol !== 'admin') redirect('/')

  return <div>Panel de administración...</div>
}
```

Esto es **seguridad real**. Aunque el usuario adivine la URL, el servidor verifica el rol y redirige antes de enviar el HTML.

```
Regla de oro:
  La UI oculta los enlaces     →  para que sea cómodo (UX)
  El servidor verifica el rol  →  para que sea seguro (seguridad)
  Nunca confíes solo en la UI
```

---

> ### 🏋️ Ejercicio 8
>
> Implementa la protección por rol para la página de staff. Debe:
>
> 1. Permitir el acceso a usuarios con rol `staff` o `admin`
> 2. Redirigir a `/` a cualquier otro rol
>
> ```jsx
> // src/app/staff/page.jsx
> import { redirect } from 'next/navigation'
> import { createClient } from '@/lib/supabase/server'
>
> export default async function PaginaStaff() {
>   // Tu código aquí
> }
> ```

<details>
<summary>Ver respuesta</summary>

```jsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PaginaStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!['staff', 'admin'].includes(perfil?.rol)) redirect('/')

  return <div>Panel de staff...</div>
}
```

El proxy ya garantiza que `user` existe (si no hay sesión, redirige al login antes de llegar aquí). La comprobación de rol en la página es la segunda capa de defensa para cuando alguien intenta acceder directamente por URL.

</details>

---

## Resumen visual

```
PETICIÓN DEL NAVEGADOR
         │
         ▼
    ┌─────────┐
    │ proxy.js│  ← ¿Hay sesión válida? ¿Tiene el rol para esta ruta?
    └────┬────┘       No → redirect /login (o /)
         │             Sí → continúa
         ▼
  ┌────────────┐
  │ layout.jsx │  ← Server Component: lee rol y nombre, los pasa como props
  └────┬───────┘
       │
       ▼
  ┌──────────────┐
  │   page.jsx   │  ← Server Component: renderiza HTML
  │  (servidor)  │     Puede verificar rol → redirect si no tiene permiso
  └────┬─────────┘
       │  HTML + props
       ▼
  NAVEGADOR
  ┌──────────────┐
  │  Shell.jsx   │  ← recibe rol y nombre como props
  └──────┬───────┘
         │
         ▼
  Sidebar y BottomNav muestran solo los enlaces del rol
```

---

## Navegación

[← 04 — Teoría Zustand](./04-teoria-zustand.md)
