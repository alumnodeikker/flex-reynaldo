-- create table public.documentos (
--   id serial primary key,
--   autor_id uuid not null references public.perfiles(id),
--   contenido text not null,
--   borrador boolean not null default true
-- )

-- alter table public.documentos enable row level security;

-- CREATE POLICY "autor: ver todos sus documentos"
-- ON documentos
-- FOR select
-- using(autor_id = auth.uid());


-- CREATE POLICY "autenticado: ver todos los documentos publicos"
-- ON documentos
-- FOR select
-- using(auth.role() = 'authenticated' AND borrador = false);

-- CREATE POLICY "autor: editar todos sus documentos"
-- ON documentos
-- FOR update
-- using(autor_id = auth.uid())
-- with check(autor_id = auth.uid());

-- select * from documentos;