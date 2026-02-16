import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

function resolveSafeNextPath(nextPath: string | null): string {
  if (!nextPath || !nextPath.startsWith('/')) return '/dashboard'
  if (nextPath.startsWith('/auth/callback')) return '/dashboard'
  return nextPath
}

function buildLoginUrl(requestUrl: URL, nextPath: string, reason: string): URL {
  const loginUrl = new URL('/login', requestUrl.origin)
  loginUrl.searchParams.set('redirectTo', nextPath)
  loginUrl.searchParams.set('error', reason)
  return loginUrl
}

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie)
  })
}

function createSupabaseRouteClient(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) => {
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

  return {
    supabase,
    getResponse: () => response,
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const nextPath = resolveSafeNextPath(requestUrl.searchParams.get('next'))
  const providerError = requestUrl.searchParams.get('error') || requestUrl.searchParams.get('error_description')
  const { supabase, getResponse } = createSupabaseRouteClient(request)

  let destinationUrl: URL

  if (providerError) {
    destinationUrl = buildLoginUrl(requestUrl, nextPath, 'oauth_provider')
  } else {
    const code = requestUrl.searchParams.get('code')

    if (!code) {
      destinationUrl = buildLoginUrl(requestUrl, nextPath, 'oauth_missing_code')
    } else {
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('OAuth callback exchange failed:', error)
        destinationUrl = buildLoginUrl(requestUrl, nextPath, 'oauth_callback')
      } else {
        destinationUrl = new URL(nextPath, requestUrl.origin)
      }
    }
  }

  const redirectResponse = NextResponse.redirect(destinationUrl)
  copyCookies(getResponse(), redirectResponse)
  return redirectResponse
}
