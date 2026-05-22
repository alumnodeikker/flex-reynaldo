create extension if not exists btree_gist;

create table public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text,
  rol        text not null default 'cliente'
             check (rol in ('cliente', 'staff', 'admin')),
  avatar_url text,
  creado_en  timestamptz not null default now()
);


create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  as $$
  begin
  insert into public.perfiles (id, nombre)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created  
  after insert                         
  on auth.users                        
  for each row                         
  execute procedure public.handle_new_user();

create table public.mesas (
  id        serial primary key,
  numero    int not null,
  piso      smallint not null check (piso in (1, 2)),
  capacidad int not null default 4,
  activa    boolean not null default true,
  unique (numero, piso)
);

insert into public.mesas (numero, piso, capacidad) values
  (1,1,4),(2,1,4),(3,1,6),(4,1,4),(5,1,2),
  (6,1,4),(7,1,4),(8,1,6),(9,1,4),(10,1,2),
  (1,2,4),(2,2,4),(3,2,4),(4,2,4),(5,2,6),(6,2,6);

create table public.productos (
  id          serial primary key,
  nombre      text not null,
  descripcion text,
  precio      numeric(8,2) not null,
  categoria   text not null default 'bebida'
              check (categoria in ('bebida', 'comida', 'pack')),
  imagen_url  text,
  disponible  boolean not null default true,
  creado_en   timestamptz not null default now()
);

create table public.pedidos (
  id          bigserial primary key,
  mesa_id     int references public.mesas(id),
  cliente_id  uuid references public.perfiles(id),
  estado      text not null default 'pendiente'
              check (estado in ('pendiente','en_barra','listo','entregado','cancelado')),
  total       numeric(8,2),
  creado_en   timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create table public.pedido_items (
  id          bigserial primary key,
  pedido_id   bigint not null references public.pedidos(id) on delete cascade,
  producto_id int not null references public.productos(id),
  cantidad    int not null default 1 check (cantidad > 0),
  precio_unit numeric(8,2) not null
);

create table public.salas_vip (
  id          serial primary key,
  nombre      text not null,
  descripcion text,
  capacidad   int not null default 10,
  precio_hora numeric(8,2) not null,
  imagen_url  text,
  activa      boolean not null default true
);

insert into public.salas_vip (nombre, descripcion, capacidad, precio_hora) values
  ('Sala Roja',  'Ambiente íntimo con equipo de sonido Marshall',  8, 80.00),
  ('Sala Negra', 'Escenario propio + luces de discoteca',          15, 120.00),
  ('Sala Gold',  'Suite VIP con servicio de botella incluido',     6,  150.00);

  create table public.reservas (
  id              bigserial primary key,
  sala_id         int not null references public.salas_vip(id),
  cliente_id      uuid not null references public.perfiles(id),
  inicio          timestamptz not null,
  fin             timestamptz not null,
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente','pagada','cancelada','completada')),
  stripe_session  text,
  stripe_payment  text,
  qr_token        text unique,
  total           numeric(8,2) not null,
  creado_en       timestamptz not null default now(),

  constraint sin_solapamiento exclude using gist (
    sala_id with =,
    tstzrange(inicio, fin) with &&
  ) where (estado not in ('cancelada'))
);

ALTER TABLE public.perfiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salas_vip     ENABLE ROW LEVEL SECURITY;
