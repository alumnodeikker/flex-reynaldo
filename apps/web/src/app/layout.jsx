import './globals.css'
import { Playfair_Display, Raleway } from 'next/font/google'
import Shell from '@/components/Shell'
import { createClient } from '@/lib/supabase/server'

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
  if (user) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()
    rol = perfil?.rol ?? 'cliente'
    nombre = user.user_metadata?.nombre ?? user.email
  }

  return (
    <html lang="es" className={`${playfair.variable} ${raleway.variable}`} suppressHydrationWarning>
      <body>
        <Shell rol={rol} nombre={nombre}>{children}</Shell>
      </body>
    </html>
  )
}
