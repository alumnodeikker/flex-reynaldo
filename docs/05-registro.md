# 05 — Autenticación y control de acceso por rol

> Stack: Next.js 16 · Supabase SSR

---

## Qué vamos a hacer

1. Proteger rutas en el servidor con un proxy
2. Login, registro y logout con Server Actions
3. Filtrar la navegación según el rol del usuario

---

## Instalación

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Variables de entorno en `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## Piezas del puzzle

### Cliente de Supabase

Necesitamos dos clientes: uno para el servidor y otro para el navegador.

El de servidor lee la sesión desde **cookies HTTP** — el único mecanismo disponible en el servidor. El del navegador hace lo mismo pero desde el cliente.

```
src/lib/supabase/server.js  → Server Components, Server Actions, proxy
src/lib/supabase/client.js  → Client Components ('use client')
```

---

### Proxy (protección de rutas)

El proxy corre **antes de renderizar cualquier página**. Si el usuario no tiene sesión o no tiene el rol necesario, lo redirige sin enviar nada al navegador.

```
Sin proxy:   request → renderiza → JS detecta no-auth → redirect  (el HTML ya salió)
Con proxy:   request → comprueba sesión → redirect                 (sin renderizar nada)
```

El proxy también comprueba el rol para rutas restringidas:

```js
const RUTAS_ROL = [
  { path: '/admin',    roles: ['admin'] },
  { path: '/staff',    roles: ['staff', 'admin'] },
  { path: '/porteros', roles: ['portero', 'admin'] },
]
```

> En Next.js 16, el middleware se llama `proxy.js` y la función exportada se llama `proxy`.

---

### Server Actions de autenticación

Funciones que corren en el servidor pero se llaman desde el cliente como si fueran funciones normales.

```js
// src/lib/actions/auth.js
export async function login(formData) { ... }
export async function register(formData) { ... }
export async function logout() { ... }
```

Los formularios las llaman así:

```js
const formData = new FormData(e.target)
const result = await login(formData)
```

> Los inputs del formulario deben tener el atributo `name` para que `FormData` los recoja. Sin `name`, `formData.get('email')` devuelve `null`.

Si la acción tiene éxito llama a `redirect()` y el usuario navega automáticamente. Si hay error devuelve `{ error: '...' }` y el formulario lo muestra.

---

### Rol y nombre en el servidor

`layout.jsx` es un Server Component — corre en el servidor en cada petición. Aquí leemos el rol y el nombre del usuario y los pasamos hacia abajo como props.

```
layout.jsx (servidor)
  → lee usuario + rol de Supabase
  → pasa rol y nombre a Shell
      → Shell los pasa a Sidebar y BottomNav
```

Así no necesitamos ningún store ni listener para saber quién es el usuario en la UI.

---

### Navegación filtrada

Cada item de gestión tiene una lista de roles que pueden verlo:

```js
const NAV_STAFF = [
  { label: 'Panel Staff', href: '/staff',    roles: ['staff', 'admin'] },
  { label: 'Porteros',    href: '/porteros', roles: ['portero', 'staff', 'admin'] },
  { label: 'Admin',       href: '/admin',    roles: ['admin'] },
]
```

Al renderizar, se filtran los que no corresponden al rol del usuario:

```js
const itemsGestion = NAV_STAFF.filter(i => i.roles.includes(rol))
```

> La UI oculta los enlaces (experiencia de usuario). El proxy bloquea el acceso (seguridad). Nunca confíes solo en la UI.

---

## Flujo completo

```
Petición
  │
  ▼
proxy.js — ¿tiene sesión? ¿tiene el rol para esta ruta?
  │ no → redirect
  │ sí
  ▼
layout.jsx — lee rol y nombre del usuario en el servidor
  │
  ▼
Shell → Sidebar y BottomNav muestran solo lo que el rol puede ver
```


[← 04 — Estado con Zustand](./04-estado-con-zustand.md) · [06 — PWA y entradas QR →](./06-pwa-y-entradas-qr.md)
