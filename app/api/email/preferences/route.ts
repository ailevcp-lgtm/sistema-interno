import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltan variables de entorno de Supabase')
  }
  return createClient(url, serviceKey)
}

async function getAuthenticatedSocioId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const serviceSupabase = getServiceSupabase()
  const { data: socio } = await serviceSupabase
    .from('socios')
    .select('id')
    .eq('usuario_id', user.id)
    .single()

  return socio?.id || null
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
  'resolucion_nueva',
  'decreto_nuevo',
]

export async function GET(request: NextRequest) {
  try {
    const socioId = await getAuthenticatedSocioId(request)
    if (!socioId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const supabase = getServiceSupabase()
    const { data, error } = await supabase
      .from('email_preferences')
      .select('*')
      .eq('socio_id', socioId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Si no hay preferencias, devolver defaults (todo activado)
    if (!data) {
      return NextResponse.json({
        socio_id: socioId,
        emails_habilitados: true,
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
        resolucion_nueva: true,
        decreto_nuevo: true,
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error en GET /api/email/preferences:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const socioId = await getAuthenticatedSocioId(request)
    if (!socioId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    // Solo permitir campos válidos
    const updates: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.includes(key) && typeof value === 'boolean') {
        updates[key] = value
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos válidos para actualizar' },
        { status: 400 }
      )
    }

    const supabase = getServiceSupabase()

    // Upsert: crear si no existe, actualizar si existe
    const { data, error } = await supabase
      .from('email_preferences')
      .upsert(
        { socio_id: socioId, ...updates },
        { onConflict: 'socio_id' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error en PUT /api/email/preferences:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
