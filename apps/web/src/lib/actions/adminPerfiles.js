'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getPerfiles() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, rol, avatar_url, activo')
    .order('nombre')
  if (error) throw new Error(error.message)
  return data
}

export async function toggleActivoPerfil(id, activo) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('perfiles')
    .update({ activo })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin')
}

export async function editarPerfil(id, { nombre, rol, activo }) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('perfiles')
    .update({ nombre, rol, activo })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin')
}

export async function borrarPerfil(id) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('borrar_usuario', { user_id: id })
  if (error) throw new Error(error.message)
  revalidatePath('/admin')
}
