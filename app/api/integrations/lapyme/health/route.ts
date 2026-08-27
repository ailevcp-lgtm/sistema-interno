import { NextRequest, NextResponse } from 'next/server'
import { LapymeApiError, LapymeClient, getLapymeConfig } from '@/lib/lapyme/client'
import { getAuthenticatedSocioContext } from '@/lib/server-auth'

export async function GET(request: NextRequest) {
  const authContext = await getAuthenticatedSocioContext(request)
  if (!authContext) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const canViewIntegration =
    (await authContext.hasPermission('finanzas', 'ver')) ||
    (await authContext.hasPermission('tesoreria', 'ver'))

  if (!canViewIntegration) {
    return authContext.applyCookies(
      NextResponse.json({ error: 'No tenes permisos para ver esta integracion' }, { status: 403 })
    )
  }

  const config = getLapymeConfig()
  const client = new LapymeClient(config)
  const includeSmoke = request.nextUrl.searchParams.get('smoke') === '1'

  try {
    const health = await client.health()
    const response: Record<string, unknown> = {
      ok: true,
      baseUrl: config.baseUrl,
      apiKeyConfigured: Boolean(config.apiKey),
      health,
    }

    if (includeSmoke) {
      const warehouses = await client.listWarehouses({ limit: 1 })
      response.smoke = {
        requestId: warehouses.request_id,
        items: warehouses.data.length,
        hasMore: warehouses.has_more,
      }
    }

    return authContext.applyCookies(NextResponse.json(response))
  } catch (error) {
    if (error instanceof LapymeApiError) {
      return authContext.applyCookies(
        NextResponse.json(
          {
            ok: false,
            status: error.status,
            code: error.code,
            message: error.message,
            requestId: error.requestId,
            retryable: error.retryable,
          },
          { status: error.status === 401 || error.status === 403 ? 502 : 500 }
        )
      )
    }

    const message = error instanceof Error ? error.message : 'Error desconocido'
    return authContext.applyCookies(
      NextResponse.json({ ok: false, message }, { status: 500 })
    )
  }
}
