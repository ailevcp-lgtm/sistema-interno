import { NextResponse } from 'next/server'

import { ICON_VERSION, SITE_FAVICON_PATH } from '@/lib/site-config'

export function GET(request: Request) {
  return NextResponse.redirect(
    new URL(`${SITE_FAVICON_PATH}?v=${ICON_VERSION}`, request.url),
    307
  )
}
