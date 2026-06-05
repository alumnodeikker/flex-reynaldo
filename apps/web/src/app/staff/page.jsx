import { createClient } from '@/lib/supabase/server'
import StaffClient from '@/components/staff/StaffClient'

export default async function PaginaStaff() {
  const supabase = await createClient()

  const { data: pedidos } = await supabase
    .from('pedidos')
    .select(`
      id, estado, creado_en,
      mesas ( numero ),
      perfiles ( nombre ),
      pedido_items (
        cantidad,
        productos ( nombre )
      )
    `)
    .not('estado', 'eq', 'cancelado')
    .order('creado_en', { ascending: true })

  return <StaffClient pedidosIniciales={pedidos ?? []} />
}
