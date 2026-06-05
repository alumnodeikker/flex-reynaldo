import { createClient } from '@/lib/supabase/server'
import CartaClient from '@/components/carta/CartaClient'

export default async function PaginaPedir() {
  const supabase = await createClient()

  const [
    { data: productos, error },
    { data: mesas },
  ] = await Promise.all([
    supabase.from('productos').select('id, nombre, descripcion, precio, categoria, imagen_url').eq('disponible', true).order('categoria'),
    supabase.from('mesas').select('id, numero, piso, capacidad').order('piso').order('numero'),
  ])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <p className="text-red-400 text-sm">Error al cargar la carta.</p>
      </div>
    )
  }

  return <CartaClient productos={productos} mesas={mesas ?? []} />
}