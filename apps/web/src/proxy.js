import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/register']

// Rutas que requieren un rol específico.
// El orden importa: se comprueba de más restrictivo a menos.
const RUTAS_ROL = [
  { path: '/admin',    roles: ['admin'] },
  { path: '/staff',    roles: ['staff', 'admin'] },
  { path: '/porteros', roles: ['portero', 'admin'] },
]

function crearClienteSupabase(request, getResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          const res = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
          getResponse(res)
        },
      },
    }
  )
}

export async function proxy(request) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = crearClienteSupabase(request, res => { supabaseResponse = res })

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Usuario logueado intentando entrar a login/register → mandamos al inicio
  if (user && PUBLIC_ROUTES.some(p => path.startsWith(p))) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Usuario sin sesión en ruta protegida → mandamos al login
  if (!user && !PUBLIC_ROUTES.some(p => path.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Comprobación de rol: solo si la ruta requiere uno específico
  const rutaRestringida = RUTAS_ROL.find(r => path.startsWith(r.path))
  if (user && rutaRestringida) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    const rol = perfil?.rol ?? 'cliente'

    if (!rutaRestringida.roles.includes(rol)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
