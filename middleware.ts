import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname, search } = request.nextUrl

  // Treat a value as a safe internal redirect path: must start with `/` and not
  // be a protocol-relative URL (`//evil.com`) or a javascript: scheme. Returns
  // the value if safe, otherwise null.
  const safeNext = (raw: string | null): string | null => {
    if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes(':')) return null
    return raw
  }

  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/register') || pathname === '/' || pathname === '/kid/login' || pathname.startsWith('/api/children/lookup')) {
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      const url = request.nextUrl.clone()
      // If the login page was reached with ?next=<safe path>, send the user
      // to that page instead of the role default. Lets bookmarks like
      // /parent/mobile resolve to the right page after login.
      const next = safeNext(request.nextUrl.searchParams.get('next'))
      if (next) {
        url.pathname = next
        url.search = ''
      } else {
        url.pathname = profile?.role === 'kid' ? '/kid' : '/parent/dashboard'
      }
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Protected routes — must be logged in
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Preserve the originally requested path so the login page can return there.
    url.searchParams.set('next', pathname + search)
    return NextResponse.redirect(url)
  }

  // Role guard
  if (pathname.startsWith('/parent') || pathname.startsWith('/kid')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role
    if (pathname.startsWith('/parent') && role === 'kid') {
      const url = request.nextUrl.clone()
      url.pathname = '/kid'
      return NextResponse.redirect(url)
    }
    if (pathname.startsWith('/kid') && role === 'parent') {
      const url = request.nextUrl.clone()
      url.pathname = '/parent/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
