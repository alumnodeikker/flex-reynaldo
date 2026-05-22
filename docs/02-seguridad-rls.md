# 02 — Seguridad con Row Level Security (RLS)

> **Proyecto Flex** · Stack: Next.js · Supabase · Zustand · Stripe  
> Nivel: Principiante-Intermedio

---

## ¿Por qué RLS y no solo validar en el frontend?

El frontend es **código público**. Cualquier persona con DevTools puede ver tus queries, robar la `anon key` y lanzar peticiones directas a Supabase saltándose toda validación de tu app.

**Row Level Security (RLS)** es una característica de PostgreSQL que evalúa una política de seguridad **dentro del propio motor de la base de datos**, antes de devolver ningún dato. No importa de dónde venga la petición: si la política dice "no", no hay dato.

```
Sin RLS:                          Con RLS:
Cliente malo ──▶ Supabase API ──▶ DB (devuelve todo)   ← PELIGROSO
Cliente malo ──▶ Supabase API ──▶ RLS evalúa ──▶ DB   ← BLOQUEADO
```

---

## Modelo de roles en Flex

| Rol      | Quién es                         | Qué puede hacer                                        |
|----------|----------------------------------|--------------------------------------------------------|
| `cliente`| Usuario registrado del local     | Ver su propio perfil, crear pedidos, ver sus reservas  |
| `staff`  | Camarero / encargado de barra    | Ver todos los pedidos de su piso, actualizar estado    |
| `admin`  | Dueño del local                  | Acceso total: productos, mesas, reservas, perfiles     |

El rol se almacena en `public.perfiles.rol`. Supabase Auth no sabe de este campo, así que en cada política consultamos esa tabla.

---

## Patrón base: función helper de rol

Para no repetir el subquery de rol en cada política, creamos una función auxiliar:

```sql
-- Devuelve el rol del usuario autenticado actualmente.
-- 'security definer' significa que se ejecuta con permisos del creador (postgres),
-- no con los del usuario que llama. Así evitamos recursión infinita en las políticas.
create or replace function public.mi_rol()
returns text
language sql
stable          -- el resultado no cambia durante la misma transacción
security definer
as $$
  select rol from public.perfiles where id = auth.uid()
$$;
```

Ahora en las políticas usamos `public.mi_rol()` en lugar de repetir el subquery.

---

## 1. Estructura de migraciones: esquema vs. políticas

Las migraciones de Supabase se aplican en orden por timestamp. En Flex separamos la seguridad en dos archivos:

```
supabase/migrations/
  20260513160558_esquema_inicial.sql   ← tablas, triggers, datos de ejemplo + ENABLE RLS
  20260513160559_politicas_rls.sql     ← función mi_rol() + todas las políticas
```

**¿Por qué esta separación?**

- **`ENABLE ROW LEVEL SECURITY`** es un atributo de la tabla, no una regla de negocio. Va junto a `CREATE TABLE` porque sin ese flag las políticas no tienen efecto, y una tabla sin RLS activo es pública por defecto.
- Las **políticas** cambian con más frecuencia (nuevos roles, ajustes de permisos). Con una migración propia, cada cambio de seguridad tiene su propio diff limpio, fácil de revisar y de revertir.

### Activar RLS (en `_esquema_inicial.sql`)

Por defecto RLS está **desactivado**. Hay que activarlo tabla a tabla. Sin ninguna política activa, una tabla con RLS habilitado deniega **todo** — buen estado por defecto.

```sql
alter table public.perfiles      enable row level security;
alter table public.mesas         enable row level security;
alter table public.productos     enable row level security;
alter table public.pedidos       enable row level security;
alter table public.pedido_items  enable row level security;
alter table public.salas_vip     enable row level security;
alter table public.reservas      enable row level security;
```

Las políticas se definen en la migración siguiente.

---

## 2. Políticas para `perfiles`

```sql
-- Un cliente ve y edita SOLO su propio perfil
create policy "perfil propio: lectura"
  on public.perfiles for select
  using ( id = auth.uid() );

create policy "perfil propio: edición"
  on public.perfiles for update
  using ( id = auth.uid() )
  with check ( id = auth.uid() );

-- El admin ve todos los perfiles
create policy "admin: lectura total perfiles"
  on public.perfiles for select
  using ( public.mi_rol() = 'admin' );

-- El trigger de registro (apunte 01) necesita insertar con service_role,
-- que ignora RLS. No necesitamos política de INSERT para clientes.
```

---

## 3. Políticas para `mesas` y `salas_vip`

```sql
-- Todos los usuarios autenticados pueden VER mesas y salas (para la UI)
create policy "autenticado: ver mesas"
  on public.mesas for select
  using ( auth.role() = 'authenticated' );

create policy "autenticado: ver salas vip"
  on public.salas_vip for select
  using ( auth.role() = 'authenticated' );

-- Solo admin puede crear/modificar/borrar mesas y salas
create policy "admin: gestionar mesas"
  on public.mesas for all
  using ( public.mi_rol() = 'admin' )
  with check ( public.mi_rol() = 'admin' );

create policy "admin: gestionar salas vip"
  on public.salas_vip for all
  using ( public.mi_rol() = 'admin' )
  with check ( public.mi_rol() = 'admin' );
```

---

## 4. Políticas para `productos`

```sql
-- Cualquier usuario autenticado ve el menú
create policy "autenticado: ver productos"
  on public.productos for select
  using ( auth.role() = 'authenticated' );

-- Staff y admin gestionan el menú (crear, editar, borrar)
create policy "staff/admin: gestionar productos"
  on public.productos for all
  using ( public.mi_rol() in ('staff', 'admin') )
  with check ( public.mi_rol() in ('staff', 'admin') );
```

---

## 5. Políticas para `pedidos`

Aquí está la lógica más importante. El staff necesita ver los pedidos de su zona.

```sql
-- Un cliente ve SOLO sus propios pedidos
create policy "cliente: ver sus pedidos"
  on public.pedidos for select
  using (
    cliente_id = auth.uid()
    and public.mi_rol() = 'cliente'
  );

-- Un cliente puede CREAR pedidos (solo como su propio usuario)
create policy "cliente: crear pedidos"
  on public.pedidos for insert
  with check (
    cliente_id = auth.uid()
    and public.mi_rol() = 'cliente'
  );

-- Staff ve TODOS los pedidos (necesita ver el panel de barra en tiempo real)
-- No filtramos por piso aquí; el filtro de piso lo hace la query de la app,
-- pero si el staff intenta leer pedidos de otro local (en un sistema multi-tenant)
-- el RLS lo impediría a nivel de proyecto.
create policy "staff: ver todos los pedidos"
  on public.pedidos for select
  using ( public.mi_rol() in ('staff', 'admin') );

-- Staff puede actualizar el estado del pedido (pendiente → en_barra → listo…)
create policy "staff: actualizar estado pedido"
  on public.pedidos for update
  using ( public.mi_rol() in ('staff', 'admin') )
  with check ( public.mi_rol() in ('staff', 'admin') );

-- Admin puede borrar pedidos (para limpiar datos de prueba, por ejemplo)
create policy "admin: borrar pedidos"
  on public.pedidos for delete
  using ( public.mi_rol() = 'admin' );
```

---

## 6. Políticas para `pedido_items`

```sql
-- El cliente ve los ítems de SUS pedidos
create policy "cliente: ver items de sus pedidos"
  on public.pedido_items for select
  using (
    exists (
      select 1 from public.pedidos
      where pedidos.id = pedido_items.pedido_id
        and pedidos.cliente_id = auth.uid()
    )
  );

-- El cliente puede insertar ítems en SUS pedidos
create policy "cliente: insertar items"
  on public.pedido_items for insert
  with check (
    exists (
      select 1 from public.pedidos
      where pedidos.id = pedido_items.pedido_id
        and pedidos.cliente_id = auth.uid()
    )
  );

-- Staff/admin ven y modifican todos los ítems
create policy "staff: ver todos los items"
  on public.pedido_items for select
  using ( public.mi_rol() in ('staff', 'admin') );
```

---

## 7. Políticas para `reservas`

```sql
-- Un cliente ve SOLO sus reservas
create policy "cliente: ver sus reservas"
  on public.reservas for select
  using ( cliente_id = auth.uid() );

-- Un cliente puede crear una reserva (el webhook de Stripe la confirmará)
create policy "cliente: crear reserva"
  on public.reservas for insert
  with check (
    cliente_id = auth.uid()
    and public.mi_rol() = 'cliente'
  );

-- Un cliente puede cancelar SU reserva (si el estado es 'pendiente')
create policy "cliente: cancelar reserva pendiente"
  on public.reservas for update
  using (
    cliente_id = auth.uid()
    and estado = 'pendiente'
  )
  with check (
    cliente_id = auth.uid()
    and estado = 'cancelada'   -- solo puede cambiar a 'cancelada', no a 'pagada'
  );

-- Staff/admin ven todas las reservas
create policy "staff: ver todas las reservas"
  on public.reservas for select
  using ( public.mi_rol() in ('staff', 'admin') );

-- Admin gestiona todo
create policy "admin: gestionar reservas"
  on public.reservas for all
  using ( public.mi_rol() = 'admin' )
  with check ( public.mi_rol() = 'admin' );
```

---

## 8. El caso del Webhook de Stripe

El webhook de Stripe actualiza el estado de una reserva (`pendiente` → `pagada`). Esta lógica corre en una **Edge Function** con la `service_role key`, que **bypasea RLS**. Eso es intencional: el webhook actúa como el sistema, no como un usuario.

```
Stripe ──▶ Edge Function (service_role) ──▶ UPDATE reservas SET estado='pagada'
                                            (RLS ignorado → correcto para esta operación)
```

> Nunca expongas la `service_role key` en el cliente. Solo vive en variables de entorno del servidor.

---

## 9. Verificar que las políticas funcionan

Usa el **SQL Editor** de Supabase para simular un usuario concreto:

```sql
-- Simula ser el usuario con ese UUID
set request.jwt.claims = '{"sub":"<UUID-del-cliente>","role":"authenticated"}';

-- Esto debería devolver solo los pedidos de ese usuario
select * from public.pedidos;

-- Esto debería devolver 0 filas (el cliente no ve pedidos de otros)
select * from public.pedidos where cliente_id != '<UUID-del-cliente>';
```

O usa la pestaña **Authentication → Policies** del Dashboard para ver las políticas activas visualmente.

---

## Resumen rápido

| Tabla          | Cliente              | Staff                     | Admin        |
|----------------|----------------------|---------------------------|--------------|
| `perfiles`     | Solo el suyo         | —                         | Todos        |
| `mesas`        | Solo lectura         | Solo lectura              | CRUD         |
| `productos`    | Solo lectura         | CRUD                      | CRUD         |
| `pedidos`      | Solo los suyos       | Lectura + actualizar estado | CRUD       |
| `pedido_items` | Solo los suyos       | Lectura total             | CRUD         |
| `salas_vip`    | Solo lectura         | Solo lectura              | CRUD         |
| `reservas`     | Solo las suyas       | Lectura total             | CRUD         |

---

## Reto Flex 🎸

1. Crea un rol `portero` en la tabla `perfiles` (añade `'portero'` al `check` de la columna `rol`).
2. Define una política en `reservas` para que el portero pueda hacer `SELECT` y `UPDATE` (solo el campo `estado` de `completada`), pero **no** `INSERT` ni `DELETE`.
3. Escribe una query SQL que simule al portero intentando borrar una reserva y verifica que falla con el error de RLS.

> **Pista:** El portero necesita verificar entradas en la puerta de las salas VIP, así que solo debe poder marcar una reserva como `completada` cuando el cliente llega.

---

## Navegación

[← 01 — Base de Datos y Storage](./01-db-y-storage-flex.md) · [03 — Interfaz estática →](./03-ui-estatica.md)
