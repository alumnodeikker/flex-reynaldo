-- ── Pedidos de prueba ─────────────────────────────────────────────────────────
-- Usa el UUID del admin sin hardcodearlo

do $$
declare
  admin_id  uuid;
  mesa3_id  int;
  mesa7_id  int;
  mesa1_id  int;
  p1_id     bigint;
  p2_id     bigint;
  p3_id     bigint;
  p4_id     bigint;
begin
  select id into admin_id from public.perfiles where rol = 'admin' limit 1;
  select id into mesa3_id from public.mesas where numero = 3 and piso = 1;
  select id into mesa7_id from public.mesas where numero = 7 and piso = 1;
  select id into mesa1_id from public.mesas where numero = 1 and piso = 1;

  -- Pedido 1: pendiente
  insert into public.pedidos (mesa_id, cliente_id, estado, total, creado_en)
  values (mesa3_id, admin_id, 'pendiente', 25.50, now() - interval '5 minutes')
  returning id into p1_id;

  insert into public.pedido_items (pedido_id, producto_id, cantidad, precio_unit)
  select p1_id, id, 2, precio from public.productos where nombre = 'Gin-tonic premium'
  union all
  select p1_id, id, 1, precio from public.productos where nombre = 'Nachos con guacamole';

  -- Pedido 2: en_barra
  insert into public.pedidos (mesa_id, cliente_id, estado, total, creado_en)
  values (mesa7_id, admin_id, 'en_barra', 17.00, now() - interval '15 minutes')
  returning id into p2_id;

  insert into public.pedido_items (pedido_id, producto_id, cantidad, precio_unit)
  select p2_id, id, 3, precio from public.productos where nombre = 'Cerveza artesana'
  union all
  select p2_id, id, 1, precio from public.productos where nombre = 'Patatas bravas';

  -- Pedido 3: listo
  insert into public.pedidos (mesa_id, cliente_id, estado, total, creado_en)
  values (mesa1_id, admin_id, 'listo', 17.00, now() - interval '30 minutes')
  returning id into p3_id;

  insert into public.pedido_items (pedido_id, producto_id, cantidad, precio_unit)
  select p3_id, id, 2, precio from public.productos where nombre = 'Mojito'
  union all
  select p3_id, id, 1, precio from public.productos where nombre = 'Alitas BBQ';

  -- Pedido 4: entregado
  insert into public.pedidos (mesa_id, cliente_id, estado, total, creado_en)
  values (mesa3_id, admin_id, 'entregado', 26.00, now() - interval '1 hour')
  returning id into p4_id;

  insert into public.pedido_items (pedido_id, producto_id, cantidad, precio_unit)
  select p4_id, id, 1, precio from public.productos where nombre = 'Burger Flex'
  union all
  select p4_id, id, 2, precio from public.productos where nombre = 'Refresco cola'
  union all
  select p4_id, id, 1, precio from public.productos where nombre = 'Tabla de quesos';

end $$;


-- ── Reservas de salas VIP ─────────────────────────────────────────────────────

do $$
declare
  admin_id uuid;
begin
  select id into admin_id from public.perfiles where rol = 'admin' limit 1;

  -- Reserva 1: pagada (esta noche)
  insert into public.reservas (sala_id, cliente_id, inicio, fin, estado)
  select id, admin_id,
    now()::date + time '22:00',
    now()::date + time '01:00' + interval '1 day',
    'pagada'
  from public.salas_vip where nombre = 'Sala Roja';

  -- Reserva 2: pendiente (mañana)
  insert into public.reservas (sala_id, cliente_id, inicio, fin, estado)
  select id, admin_id,
    now()::date + interval '1 day' + time '23:00',
    now()::date + interval '2 days' + time '02:00',
    'pendiente'
  from public.salas_vip where nombre = 'Sala Gold';

  -- Reserva 3: completada (ayer)
  insert into public.reservas (sala_id, cliente_id, inicio, fin, estado)
  select id, admin_id,
    now()::date - interval '1 day' + time '21:00',
    now()::date - interval '1 day' + time '23:00',
    'completada'
  from public.salas_vip where nombre = 'Sala Negra';

end $$;
