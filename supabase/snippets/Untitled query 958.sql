-- ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Un usuario authenticated: solo puede leer su perfil"
-- ON public.perfiles
-- FOR select
-- USING(id = auth.uid());

-- CREATE POLICY "cliente: cancelar reserva pendiente"
-- ON reservas
-- for update
-- using(cliente_id = auth.uid() AND estado= 'pendiente')
-- with check (cliente_id = auth.uid() AND estado= 'cancelada')

-- CREATE POLICY "cliente: puede ver sus reservas"
-- ON reservas
-- for SELECT
-- using(cliente_id = auth.uid())
-- select * from perfiles;


-- UPDATE reservas
-- SET estado = 'cancelada'
-- WHERE id = 6;

select '1' from perfiles;