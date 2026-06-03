import { createClient } from '@/lib/supabase/server'
import PerfilClient from './PerfilClient'

export default async function PaginaPerfil() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre, rol, avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <PerfilClient
      nombre={perfil?.nombre ?? user.user_metadata?.nombre ?? ''}
      email={user.email}
      rol={perfil?.rol ?? 'cliente'}
      avatarUrl={perfil?.avatar_url ?? null}
    />
  )
}
