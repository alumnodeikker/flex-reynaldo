-- ALTER TABLE public.reservas enable row level security;

-- CREATE POLICY "cliente: cancelar reserva pendiente"
-- ON reservas
-- for update
-- using(cliente_id = auth.uid() AND estado= 'pendiente')
-- with check (cliente_id = auth.uid() AND estado= 'cancelado')

create table documentos (
  id serial primary key,
  autor_id uuid not null references public.perfiles(id),
  contenido text not null,
  borrador boolean not null default true
)

-- alter table public.documentos enable row level security;