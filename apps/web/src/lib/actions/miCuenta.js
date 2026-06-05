'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function actualizarPerfil({ nombre }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase
    .from('perfiles')
    .update({ nombre })
    .eq('id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/perfil')
}

export async function actualizarAvatar(avatarUrl) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase
    .from('perfiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/perfil')
}

export async function actualizarContrasena({ nueva, confirmar }) {
  if (nueva !== confirmar) throw new Error('Las contraseñas no coinciden')
  if (nueva.length < 6) throw new Error('Mínimo 6 caracteres')

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: nueva })
  if (error) throw new Error(error.message)
}
