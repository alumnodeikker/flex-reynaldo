'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function avanzarPedido(id, estadoActual) {
  const SIGUIENTE = { pendiente: 'en_barra', en_barra: 'listo', listo: 'entregado' }
  const siguiente = SIGUIENTE[estadoActual]
  if (!siguiente) return

  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: siguiente })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/staff')
}
