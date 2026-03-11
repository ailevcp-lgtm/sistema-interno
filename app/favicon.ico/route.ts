import { NextResponse } from 'next/server'

import { ICON_VERSION } from '@/lib/site-config'

export function GET(request: Request) {
  return NextResponse.redirect(new URL(`/icon?v=${ICON_VERSION}`, request.url), 307)
}
