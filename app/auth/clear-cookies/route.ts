import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const redirectUrl = new URL('/login?cookies=cleared', request.url)
  const response = NextResponse.redirect(redirectUrl)

  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith('sb-')) continue

    response.cookies.set({
      name: cookie.name,
      value: '',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    })
  }

  return response
}
