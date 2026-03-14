import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseRouteClient } from '@/lib/supabase-server'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltan variables de entorno de Supabase')
  }
  return createClient(url, serviceKey)
}

interface AuthenticatedSocioContext {
  socioId: string
  applyCookies<T extends NextResponse>(response: T): T
}

async function getAuthenticatedSocioContext(
  request: NextRequest
): Promise<AuthenticatedSocioContext | null> {
  const authHeader = request.headers.get('authorization')
  let userId: string | null = null
  let applyCookies = <T extends NextResponse>(response: T): T => response

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (!error && user) {
      userId = user.id
    }
  }

  if (!userId) {
    const routeClient = createSupabaseRouteClient(request)
    const { data: { user }, error } = await routeClient.supabase.auth.getUser()
    if (error || !user) return null

    userId = user.id
    applyCookies = routeClient.applyCookies
  }

  const serviceSupabase = getServiceSupabase()
  const { data: socio } = await serviceSupabase
    .from('socios')
    .select('id')
    .eq('usuario_id', userId)
    .single()

  if (!socio?.id) return null

  return {
    socioId: socio.id,
    applyCookies,
  }
}

const ALLOWED_FIELDS = [
  'tarea_asignada',
  'tarea_estado_cambio',
  'tarea_vencimiento_proximo',
  'subtarea_creada',
  'handoff_solicitado',
  'handoff_resuelto',
  'aprobacion_cd_pendiente',
  'aprobacion_cd_resuelta',
  'emails_habilitados',
  'calendario_reunion_nueva',
  'calendario_reunion_modificada',
  'calendario_reunion_cancelada',
  'calendario_planificacion_definitiva',
  'resolucion_nueva',
  'decreto_nuevo',
]

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedSocioContext(request)
    if (!authContext) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const supabase = getServiceSupabase()
    const { data, error } = await supabase
      .from('email_preferences')
      .select('*')
      .eq('socio_id', authContext.socioId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Si no hay preferencias, devolver defaults (todo activado)
    if (!data) {
      return authContext.applyCookies(NextResponse.json({
        socio_id: authContext.socioId,
        emails_habilitados: true,
        dias_antelacion_recordatorio: 2,
        tarea_asignada: true,
        tarea_estado_cambio: true,
        tarea_vencimiento_proximo: true,
        subtarea_creada: true,
        handoff_solicitado: true,
        handoff_resuelto: true,
        aprobacion_cd_pendiente: true,
        aprobacion_cd_resuelta: true,
        calendario_reunion_nueva: true,
        calendario_reunion_modificada: true,
        calendario_reunion_cancelada: true,
        calendario_planificacion_definitiva: true,
        resolucion_nueva: true,
        decreto_nuevo: true,
      }))
    }

    return authContext.applyCookies(NextResponse.json(data))
  } catch (error) {
    console.error('Error en GET /api/email/preferences:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedSocioContext(request)
    if (!authContext) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    const updates: Record<string, boolean | number> = {}
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.includes(key) && typeof value === 'boolean') {
        updates[key] = value
      }
      if (key === 'dias_antelacion_recordatorio' && typeof value === 'number' && Number.isInteger(value)) {
        updates[key] = Math.max(0, Math.min(14, value))
      }
    }

    if (Object.keys(updates).length === 0) {
      return authContext.applyCookies(NextResponse.json(
        { error: 'No se proporcionaron campos válidos para actualizar' },
        { status: 400 }
      ))
    }

    const supabase = getServiceSupabase()

    const { data, error } = await supabase
      .from('email_preferences')
      .upsert(
        { socio_id: authContext.socioId, ...updates },
        { onConflict: 'socio_id' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return authContext.applyCookies(NextResponse.json(data))
  } catch (error) {
    console.error('Error en PUT /api/email/preferences:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
