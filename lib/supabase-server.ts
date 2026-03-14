import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  return { supabase, response }
}

interface PendingCookie {
  name: string
  value: string
  options?: CookieOptions
}

export function createSupabaseRouteClient(request: NextRequest) {
  const pendingCookies: PendingCookie[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          pendingCookies.splice(0, pendingCookies.length, ...cookiesToSet)
        },
      },
    }
  )

  return {
    supabase,
    applyCookies<T extends NextResponse>(response: T): T {
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      return response
    },
  }
}
