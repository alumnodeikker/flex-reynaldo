import { createClient } from '@/lib/supabase/server'
import AdminClient from '@/components/admin/AdminClient'

export default async function PaginaAdmin() {
  const supabase = await createClient()

  const [
    { data: productos, error: errProductos },
    { data: perfiles, error: errPerfiles },
  ] = await Promise.all([
    supabase.from('productos').select('id, nombre, descripcion, precio, categoria, disponible').order('categoria'),
    supabase.from('perfiles').select('id, nombre, rol, avatar_url, activo').order('nombre'),
  ])

  if (errProductos || errPerfiles) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <p className="text-red-400 text-sm">Error al cargar los datos.</p>
      </div>
    )
  }

  return <AdminClient productosIniciales={productos} perfilesIniciales={perfiles} />
}
