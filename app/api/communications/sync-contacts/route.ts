import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedCommunicationsContext } from '@/lib/communications/auth'
import { syncContactsFromMongo } from '@/lib/communications/service'

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedCommunicationsContext(request)
    if (!authContext) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const result = await syncContactsFromMongo(authContext.userId)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
