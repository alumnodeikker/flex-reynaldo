'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearReserva({ sala_id, fecha, hora, duracionHoras }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const inicio = new Date(`${fecha}T${hora}:00`)
  const fin    = new Date(inicio.getTime() + duracionHoras * 60 * 60 * 1000)

  const { data: sala } = await supabase
    .from('salas_vip')
    .select('precio_hora')
    .eq('id', sala_id)
    .single()

  const total = sala ? sala.precio_hora * duracionHoras : 0

  const { error } = await supabase.from('reservas').insert({
    sala_id,
    cliente_id: user.id,
    inicio:     inicio.toISOString(),
    fin:        fin.toISOString(),
    estado:     'pendiente',
    total,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/mi-area')
}
