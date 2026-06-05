'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function subirImagen(supabase, file) {
  const ext    = file.name.split('.').pop()
  const nombre = `${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('productos')
    .upload(nombre, file, { contentType: file.type, upsert: false })

  if (error) {
    console.error('Storage error:', error)
    throw new Error(`Error al subir imagen: ${error.message}`)
  }

  const { data } = supabase.storage.from('productos').getPublicUrl(nombre)
  return data.publicUrl
}

export async function crearProducto(formData) {
  const supabase = await createClient()

  const imagen = formData.get('imagen')
  const imagen_url = imagen?.size > 0 ? await subirImagen(supabase, imagen) : null

  const { error } = await supabase.from('productos').insert({
    nombre:      formData.get('nombre'),
    descripcion: formData.get('descripcion') || null,
    precio:      parseFloat(formData.get('precio')),
    categoria:   formData.get('categoria'),
    disponible:  formData.get('disponible') === 'true',
    imagen_url,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/admin')
  revalidatePath('/')
}

export async function editarProducto(id, formData) {
  const supabase = await createClient()

  const imagen = formData.get('imagen')
  const campos = {
    nombre:      formData.get('nombre'),
    descripcion: formData.get('descripcion') || null,
    precio:      parseFloat(formData.get('precio')),
    categoria:   formData.get('categoria'),
    disponible:  formData.get('disponible') === 'true',
  }

  if (imagen?.size > 0) {
    campos.imagen_url = await subirImagen(supabase, imagen)
  }

  const { error } = await supabase.from('productos').update(campos).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin')
  revalidatePath('/')
}

export async function borrarProducto(id) {
  const supabase = await createClient()

  const { data: producto } = await supabase
    .from('productos')
    .select('imagen_url')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('productos').delete().eq('id', id)
  if (error) throw new Error(error.message)

  if (producto?.imagen_url) {
    const nombre = producto.imagen_url.split('/').pop()
    await supabase.storage.from('productos').remove([nombre])
  }

  revalidatePath('/admin')
  revalidatePath('/')
}
