# 06 — Productos, CRUD, Storage y conexión completa con Supabase

> Stack: Next.js · Supabase · Supabase Storage

---

## Qué hemos construido

1. CRUD de productos con imágenes en Storage
2. Gestión de perfiles desde el panel admin (editar, activar/desactivar, borrar)
3. Pedidos reales: el carrito escribe en la base de datos
4. Reservas de salas VIP conectadas a la tabla `reservas`
5. Perfil de usuario editable: nombre, contraseña y avatar en Storage
6. Panel de staff con estados de pedido en tiempo real

---

## Server Components para leer datos

Las páginas que necesitan datos son Server Components: hacen el `select` en el servidor y pasan los datos como props. Sin `useEffect`, sin estado de carga.

```
page.jsx             → productos + mesas    → CartaClient
vip/page.jsx         → salas_vip            → VipClient
staff/page.jsx       → pedidos + items      → StaffClient
admin/page.jsx       → productos + perfiles → AdminClient
mi-area/page.jsx     → perfil + pedidos + reservas → MiAreaClient
```

---

## Server Actions para escribir datos

Todas las escrituras viven en `src/lib/actions/` con `'use server'`. El cliente las llama como funciones normales.

| Archivo | Responsabilidad |
| --- | --- |
| `productos.js` | Crear, editar, borrar productos + imagen |
| `pedidos.js` | Avanzar estado de un pedido |
| `reservas.js` | Crear reserva de sala VIP |
| `adminPerfiles.js` | Editar, activar/desactivar y borrar perfiles |
| `miCuenta.js` | Actualizar nombre, contraseña y avatar propios |

Después de cada escritura se llama `revalidatePath` para que Next.js descarte la caché.

---

## Storage: dos buckets

### `productos`

Las imágenes de productos se suben desde el Server Action al crear o editar:

```
Admin adjunta imagen → FormData → Server Action
  → sube a Storage con nombre único (timestamp.ext)
  → guarda URL pública en productos.imagen_url
  → al borrar el producto, también borra la imagen del bucket
```

### `avatares`

El usuario sube su avatar directamente desde el cliente:

```
Usuario selecciona imagen → upload client-side a avatares/{user_id}/avatar.ext
  → obtiene URL pública
  → Server Action actualiza perfiles.avatar_url
```

Ambos buckets son públicos (solo lectura). La escritura está protegida por políticas RLS de Storage.

---

## Pedidos: del carrito a la base de datos

Al confirmar el pedido en `CarritoDrawer`:

```
Usuario elige mesa en modal visual (grid de mesas reales desde DB)
  → INSERT en pedidos (mesa_id, cliente_id, estado: 'pendiente', total)
  → INSERT en pedido_items (pedido_id, producto_id, cantidad, precio_unit)
```

El staff ve los pedidos en tiempo real y los avanza de estado:

```
pendiente → en_barra → listo → entregado
```

Cada avance hace UPDATE en la tabla `pedidos` y actualiza la UI con optimistic update (cambia al instante, revierte si hay error).

---

## Reservas de salas VIP

Al confirmar una reserva en `VipClient`:

```
Usuario elige sala, fecha, hora y duración
  → Server Action calcula inicio, fin y total (precio_hora × horas)
  → INSERT en reservas (sala_id, cliente_id, inicio, fin, estado, total)
```

La tabla tiene una restricción de solapamiento (`EXCLUDE USING GIST`) que impide reservar la misma sala en el mismo tramo horario.

---

## Panel admin: gestión de perfiles

El admin puede editar cualquier perfil (nombre, rol, activo) y borrar cuentas:

- **Editar / activar / desactivar**: UPDATE en `public.perfiles` permitido por la política RLS `"admin: gestionar perfiles"`.
- **Borrar**: no se puede hacer DELETE en `public.perfiles` desde el cliente porque la cuenta vive en `auth.users`. Se resuelve con una función RPC con `SECURITY DEFINER`:

```sql
-- La función corre con privilegios elevados pero verifica el rol antes de actuar
create function public.borrar_usuario(user_id uuid) ...
  delete from auth.users where id = user_id;
  -- la FK con ON DELETE CASCADE elimina el perfil en cascada
```

Si una cuenta está desactivada (`activo = false`), el layout redirige al usuario a `/cuenta-desactivada` en cada carga de página.

---

## Separación de componentes

```
admin/
  AdminClient.jsx    → stats + tabs
  TabUsuarios.jsx    → lista de perfiles + editar/borrar (tabla en desktop, cards en móvil)
  TabProductos.jsx   → CRUD de productos (tabla en desktop, cards en móvil)
  ModalUsuario.jsx   → editar perfil (nombre, rol, activo)
  ModalProducto.jsx  → crear/editar producto con preview de imagen

carta/
  CartaClient.jsx    → filtros + grid
  ProductoCard.jsx   → tarjeta individual
  CarritoDrawer.jsx  → carrito, selector visual de mesa, lógica de pedido

staff/
  StaffClient.jsx    → lista de pedidos con filtros + optimistic update
  PedidoCard.jsx     → tarjeta de pedido con botón de avance de estado

mi-area/
  MiAreaClient.jsx   → pedidos propios + reservas propias

vip/
  VipClient.jsx      → selector de sala + formulario de reserva
```

---

[← 05 — Autenticación](./05-registro.md)
