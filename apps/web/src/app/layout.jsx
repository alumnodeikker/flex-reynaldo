import './globals.css'
import { Playfair_Display, Raleway } from 'next/font/google'
import Shell from '@/components/layout/Shell'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const raleway = Raleway({
  subsets: ['latin'],
  variable: '--font-raleway',
  display: 'swap',
})

export const metadata = {
  title: 'Flex — Live Sessions',
  description: 'Tu noche, tu ritmo',
}

export default async function RootLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let rol = null
  let nombre = null
  let avatarUrl = null
  if (user) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol, nombre, avatar_url, activo')
      .eq('id', user.id)
      .single()
    if (perfil?.activo === false) redirect('/cuenta-desactivada')
    rol       = perfil?.rol ?? 'cliente'
    nombre    = perfil?.nombre ?? user.user_metadata?.nombre ?? user.email
    avatarUrl = perfil?.avatar_url ?? null
  }

  return (
    <html lang="es" className={`${playfair.variable} ${raleway.variable}`} suppressHydrationWarning>
      <body>
        <Shell rol={rol} nombre={nombre} avatarUrl={avatarUrl}>{children}</Shell>
      </body>
    </html>
  )
}
