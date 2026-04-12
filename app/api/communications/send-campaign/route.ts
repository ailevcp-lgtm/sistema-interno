import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedCommunicationsContext } from '@/lib/communications/auth'
import { sendSavedCampaign } from '@/lib/communications/service'

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedCommunicationsContext(request)
    if (!authContext) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    console.log('[send-campaign] body keys:', body ? Object.keys(body) : 'null')
    console.log('[send-campaign] campaign keys:', body?.campaign ? Object.keys(body.campaign) : 'missing')
    console.log('[send-campaign] selection_mode:', body?.campaign?.selection_mode)
    console.log('[send-campaign] filters_json:', JSON.stringify(body?.campaign?.filters_json))
    const result = await sendSavedCampaign(body)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    console.error('[send-campaign] error:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
