import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedCommunicationsContext } from '@/lib/communications/auth'
import { generateCampaignPreview } from '@/lib/communications/service'

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedCommunicationsContext(request)
    if (!authContext) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const preview = await generateCampaignPreview(body)
    return NextResponse.json(preview)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
