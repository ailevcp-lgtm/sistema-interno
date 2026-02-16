import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseMiddlewareClient } from '@/lib/supabase-server'

interface SocioAuthGateRow {
  id: string
  usuario_id: string | null
  email: string | null
  estado: string
}

const SOCIO_GATE_SELECT = 'id, usuario_id, email, estado'
const PROXY_AUTH_TIMEOUT_MS = 8_000

class ProxyTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProxyTimeoutError'
  }
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login'
    || pathname.startsWith('/auth/callback')
    || pathname.startsWith('/auth/clear-cookies')
    || pathname.startsWith('/_next')
    || pathname.startsWith('/api')
  )
}

function buildLoginRedirect(request: NextRequest, pathname: string, reason?: string): NextResponse {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirectTo', pathname)
  if (reason) {
    loginUrl.searchParams.set('error', reason)
  }
  return NextResponse.redirect(loginUrl)
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie)
  })
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ProxyTimeoutError(`${label} exceeded ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

async function fetchSocioByUserId(supabase: any, userId: string): Promise<SocioAuthGateRow | null> {
  const { data, error } = await supabase
    .from('socios')
    .select(SOCIO_GATE_SELECT)
    .eq('usuario_id', userId)
    .maybeSingle()

  if (error) throw error

  return (data as SocioAuthGateRow | null) || null
}

async function fetchSocioByEmail(supabase: any, email: string): Promise<SocioAuthGateRow | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return null

  const { data, error } = await supabase
    .from('socios')
    .select(SOCIO_GATE_SELECT)
    .eq('estado', 'activo')
    .not('email', 'is', null)
    .ilike('email', normalizedEmail)
    .limit(5)

  if (error) throw error

  const exactMatches = ((data || []) as SocioAuthGateRow[]).filter(
    (row) => (row.email || '').trim().toLowerCase() === normalizedEmail
  )

  if (exactMatches.length > 1) {
    console.error('Auth gate: multiple active socios share the same email', {
      email: normalizedEmail,
      socioIds: exactMatches.map((row) => row.id),
    })
    return null
  }

  return exactMatches[0] || null
}

async function linkSocioToUserId(supabase: any, socioId: string, userId: string): Promise<SocioAuthGateRow | null> {
  const { error: updateError } = await supabase
    .from('socios')
    .update({ usuario_id: userId })
    .eq('id', socioId)
    .is('usuario_id', null)

  if (updateError) throw updateError

  return await fetchSocioByUserId(supabase, userId)
}

async function ensureAuthorizedSocio(
  supabase: any,
  user: { id: string; email?: string | null }
): Promise<boolean> {
  const existingSocio = await fetchSocioByUserId(supabase, user.id)
  if (existingSocio) {
    return existingSocio.estado === 'activo'
  }

  const authEmail = (user.email || '').trim().toLowerCase()
  if (!authEmail) return false

  const socioByEmail = await fetchSocioByEmail(supabase, authEmail)
  if (!socioByEmail) return false
  if (socioByEmail.estado !== 'activo') return false

  if (socioByEmail.usuario_id && socioByEmail.usuario_id !== user.id) {
    return false
  }

  if (!socioByEmail.usuario_id) {
    const linkedSocio = await linkSocioToUserId(supabase, socioByEmail.id, user.id)
    return !!linkedSocio && linkedSocio.estado === 'activo' && linkedSocio.usuario_id === user.id
  }

  return true
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSupabaseAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'))

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Sin cookie de auth no hay nada que validar contra Supabase:
  // respondemos inmediato para evitar requests colgadas por red.
  if (!hasSupabaseAuthCookie) {
    return buildLoginRedirect(request, pathname)
  }

  const { supabase, response } = createSupabaseMiddlewareClient(request)

  try {
    const {
      data: { user },
      error,
    } = await withTimeout(
      supabase.auth.getUser(),
      PROXY_AUTH_TIMEOUT_MS,
      'proxy supabase.auth.getUser'
    )

    if (error) {
      throw error
    }

    if (user) {
      const authorized = await ensureAuthorizedSocio(supabase, {
        id: user.id,
        email: user.email,
      })

      if (!authorized) {
        await supabase.auth.signOut()
        const unauthorizedRedirect = buildLoginRedirect(request, pathname, 'unauthorized')
        copyResponseCookies(response, unauthorizedRedirect)
        return unauthorizedRedirect
      }

      return response
    }
  } catch (error) {
    if (error instanceof ProxyTimeoutError) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Proxy auth check timed out, allowing request with existing auth cookie')
      }
    } else {
      console.error('Proxy auth check failed:', error)
    }
    return response
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
