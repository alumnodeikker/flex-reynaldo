import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MiAreaClient from '@/components/mi-area/MiAreaClient'

export default async function PaginaMiArea() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: perfil },
    { data: pedidos },
    { data: reservas },
  ] = await Promise.all([
    supabase
      .from('perfiles')
      .select('nombre, rol')
      .eq('id', user.id)
      .single(),

    supabase
      .from('pedidos')
      .select(`
        id, estado, total, creado_en,
        mesas ( numero ),
        pedido_items (
          cantidad, precio_unit,
          productos ( nombre )
        )
      `)
      .eq('cliente_id', user.id)
      .order('creado_en', { ascending: false }),

    supabase
      .from('reservas')
      .select(`
        id, inicio, fin, estado,
        salas_vip ( nombre, descripcion )
      `)
      .eq('cliente_id', user.id)
      .order('inicio', { ascending: false }),
  ])

  return (
    <MiAreaClient
      perfil={perfil}
      pedidos={pedidos ?? []}
      reservas={reservas ?? []}
    />
  )
}
