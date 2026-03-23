import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSocioContext, getServiceSupabase } from '@/lib/server-auth'

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
  'balance_nuevo',
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
      return authContext.applyCookies(
        NextResponse.json({ error: error.message }, { status: 500 })
      )
    }

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
        balance_nuevo: true,
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
      return authContext.applyCookies(
        NextResponse.json({ error: error.message }, { status: 500 })
      )
    }

    return authContext.applyCookies(NextResponse.json(data))
  } catch (error) {
    console.error('Error en PUT /api/email/preferences:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
