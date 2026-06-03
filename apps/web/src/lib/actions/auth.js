'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (error) return { error: 'Email o contraseña incorrectos.' }
  redirect('/')
}

export async function register(formData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: formData.get('email'),
    password: formData.get('password'),
    options: { data: { nombre: formData.get('nombre') } },
  })
  if (error) return { error: error.message }
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
