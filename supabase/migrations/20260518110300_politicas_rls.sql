-- ── Activar RLS en todas las tablas ─────────────────────────────────────────

alter table public.perfiles      enable row level security;
alter table public.mesas         enable row level security;
alter table public.productos     enable row level security;
alter table public.pedidos       enable row level security;
alter table public.pedido_items  enable row level security;
alter table public.salas_vip     enable row level security;
alter table public.reservas      enable row level security;

-- ── Función helper de rol ─────────────────────────────────────────────────────
-- Devuelve el rol del usuario autenticado actualmente.
-- SECURITY DEFINER: corre con permisos del creador para evitar recursión infinita
-- cuando una política de 'perfiles' llama a esta función (que lee 'perfiles').
-- STABLE: PostgreSQL cachea el resultado por transacción (1 query en vez de N).

create or replace function public.mi_rol()
returns text
language sql
stable
security definer
as $$
  select rol from public.perfiles where id = auth.uid()
$$;

-- ── perfiles ──────────────────────────────────────────────────────────────────

create policy "perfil propio: lectura"
  on public.perfiles for select
  using ( id = auth.uid() );

create policy "perfil propio de cliente: edición"
  on public.perfiles for update
  using ( id = auth.uid() and rol = 'cliente' )
  with check ( id = auth.uid() and rol = 'cliente' );

create policy "perfil propio de staff: edición"
  on public.perfiles for update
  using ( id = auth.uid() and rol = 'staff' )
  with check ( id = auth.uid() and rol = 'staff' );

create policy "perfil propio de portero: edición"
  on public.perfiles for update
  using ( id = auth.uid() and rol = 'portero' )
  with check ( id = auth.uid() and rol = 'portero' );

-- Admin: acceso total (el trigger de registro usa service_role → ignora RLS)
create policy "admin: gestionar perfiles"
  on public.perfiles for all
  using ( public.mi_rol() = 'admin' )
  with check ( public.mi_rol() = 'admin' );

-- ── mesas ─────────────────────────────────────────────────────────────────────

create policy "autenticado: ver mesas"
  on public.mesas for select
  using ( auth.role() = 'authenticated' );

create policy "admin: gestionar mesas"
  on public.mesas for all
  using ( public.mi_rol() = 'admin' )
  with check ( public.mi_rol() = 'admin' );

-- ── productos ─────────────────────────────────────────────────────────────────

create policy "autenticado: ver productos"
  on public.productos for select
  using ( auth.role() = 'authenticated' );

-- Staff y admin gestionan el menú (crear, editar, borrar)
create policy "staff/admin: gestionar productos"
  on public.productos for all
  using ( public.mi_rol() in ('staff', 'admin') )
  with check ( public.mi_rol() in ('staff', 'admin') );

-- ── pedidos ───────────────────────────────────────────────────────────────────

create policy "cliente: ver sus pedidos"
  on public.pedidos for select
  using (
    cliente_id = auth.uid()
    and public.mi_rol() = 'cliente'
  );

create policy "autenticado: crear pedidos"
  on public.pedidos for insert
  with check (
    cliente_id = auth.uid()
    and auth.role() = 'authenticated'
  );

create policy "staff: ver todos los pedidos"
  on public.pedidos for select
  using ( public.mi_rol() in ('staff', 'admin') );

create policy "staff: actualizar estado pedido"
  on public.pedidos for update
  using ( public.mi_rol() in ('staff', 'admin') )
  with check ( public.mi_rol() in ('staff', 'admin') );

create policy "admin: borrar pedidos"
  on public.pedidos for delete
  using ( public.mi_rol() = 'admin' );

-- ── pedido_items ──────────────────────────────────────────────────────────────

create policy "cliente: ver items de sus pedidos"
  on public.pedido_items for select
  using (
    exists (
      select 1 from public.pedidos
      where pedidos.id = pedido_items.pedido_id
        and pedidos.cliente_id = auth.uid()
    )
  );

create policy "cliente: insertar items"
  on public.pedido_items for insert
  with check (
    exists (
      select 1 from public.pedidos
      where pedidos.id = pedido_items.pedido_id
        and pedidos.cliente_id = auth.uid()
    )
  );

create policy "staff: ver todos los items"
  on public.pedido_items for select
  using ( public.mi_rol() in ('staff', 'admin') );

-- ── salas_vip ─────────────────────────────────────────────────────────────────

create policy "autenticado: ver salas vip"
  on public.salas_vip for select
  using ( auth.role() = 'authenticated' );

create policy "admin: gestionar salas vip"
  on public.salas_vip for all
  using ( public.mi_rol() = 'admin' )
  with check ( public.mi_rol() = 'admin' );

-- ── reservas ──────────────────────────────────────────────────────────────────

create policy "cliente: ver sus reservas"
  on public.reservas for select
  using ( cliente_id = auth.uid() );

create policy "autenticado: crear reserva"
  on public.reservas for insert
  with check (
    cliente_id = auth.uid()
    and auth.role() = 'authenticated'
  );

-- Solo puede cambiar el estado de 'pendiente' → 'cancelada'
create policy "cliente: cancelar reserva pendiente"
  on public.reservas for update
  using (
    cliente_id = auth.uid()
    and estado = 'pendiente'
  )
  with check (
    cliente_id = auth.uid()
    and estado = 'cancelada'
  );

create policy "staff: ver todas las reservas"
  on public.reservas for select
  using ( public.mi_rol() in ('staff', 'admin') );

-- Portero: puede ver reservas y marcarlas como 'completada' (validación en puerta)
create policy "portero: ver reservas"
  on public.reservas for select
  using ( public.mi_rol() = 'portero' );

create policy "portero: completar reserva"
  on public.reservas for update
  using ( public.mi_rol() = 'portero' )
  with check (
    public.mi_rol() = 'portero'
    and estado = 'completada'
  );

create policy "admin: gestionar reservas"
  on public.reservas for all
  using ( public.mi_rol() = 'admin' )
  with check ( public.mi_rol() = 'admin' );

-- ── storage: bucket productos ─────────────────────────────────────────────────

create policy "público: ver imágenes productos"
  on storage.objects for select
  using ( bucket_id = 'productos' );

create policy "admin: subir imágenes productos"
  on storage.objects for insert
  with check (
    bucket_id = 'productos'
    and public.mi_rol() = 'admin'
  );

create policy "admin: borrar imágenes productos"
  on storage.objects for delete
  using (
    bucket_id = 'productos'
    and public.mi_rol() = 'admin'
  );

-- ── storage: bucket avatares ──────────────────────────────────────────────────

create policy "público: ver avatares"
  on storage.objects for select
  using ( bucket_id = 'avatares' );

create policy "usuario: subir su avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatares'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "usuario: actualizar su avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
