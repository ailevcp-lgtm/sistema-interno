import { NextRequest, NextResponse } from 'next/server'

import { sendEmailNotification } from '@/lib/email/send-notification'
import { getAuthenticatedSocioContext, getServiceSupabase } from '@/lib/server-auth'

export const runtime = 'nodejs'

interface DecisionInput {
  solicitudId?: string
  decision?: 'admitida' | 'rechazada'
  resolucionId?: string
  resolucionDocumentoId?: string
  fechaResolucion?: string
  categoriaAdmitida?: 'pleno' | 'adherente' | null
  observaciones?: string | null
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSocioContext(request)
  if (!auth || !(await auth.hasPermission('socios', 'editar'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as DecisionInput
  if (!body.solicitudId || !body.decision || !body.resolucionId || !body.resolucionDocumentoId || !body.fechaResolucion) {
    return NextResponse.json({ error: 'Faltan datos obligatorios de la resolución' }, { status: 400 })
  }
  if (body.decision === 'admitida' && !body.categoriaAdmitida) {
    return NextResponse.json({ error: 'Debe indicarse la categoría en la que se admite' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const { error: decisionError } = await supabase.rpc('fn_registrar_decision_admision', {
    p_solicitud_id: body.solicitudId,
    p_decision: body.decision,
    p_resolucion_id: body.resolucionId,
    p_resolucion_documento_id: body.resolucionDocumentoId,
    p_fecha_resolucion: body.fechaResolucion,
    p_categoria_admitida: body.categoriaAdmitida || null,
    p_observaciones: body.observaciones || null,
    p_actor_usuario_id: auth.userId,
  })
  if (decisionError) return NextResponse.json({ error: decisionError.message }, { status: 409 })

  const [{ data: application }, { data: resolution }, { data: document }] = await Promise.all([
    supabase
      .from('admision_solicitudes')
      .select('id, socio_id, socio:socios!admision_solicitudes_socio_id_fkey(nombre, apellido, email)')
      .eq('id', body.solicitudId)
      .single(),
    supabase
      .from('resoluciones')
      .select('numero, anio, fecha')
      .eq('id', body.resolucionId)
      .single(),
    supabase
      .from('documentos_legales')
      .select('bucket, storage_path, nombre_archivo')
      .eq('id', body.resolucionDocumentoId)
      .single(),
  ])

  const socio = application?.socio
    ? (Array.isArray(application.socio) ? application.socio[0] : application.socio)
    : null
  if (!application || !socio?.email || !resolution || !document) {
    await supabase.from('admision_solicitudes').update({
      notificacion_estado: 'error',
      notificacion_error: 'Faltan email del interesado o documentos de la resolución.',
    }).eq('id', body.solicitudId)
    return NextResponse.json({ error: 'La decisión fue registrada, pero no pudo prepararse la notificación' }, { status: 502 })
  }

  const { data: pdfBlob, error: downloadError } = await supabase.storage
    .from(document.bucket)
    .download(document.storage_path)
  if (downloadError || !pdfBlob) {
    await supabase.from('admision_solicitudes').update({
      notificacion_estado: 'error',
      notificacion_error: downloadError?.message || 'No se pudo descargar la resolución.',
    }).eq('id', body.solicitudId)
    return NextResponse.json({ error: 'La decisión fue registrada, pero no pudo adjuntarse la resolución' }, { status: 502 })
  }

  const result = await sendEmailNotification(
    'admision_asociado_resuelta',
    [{ socio_id: application.socio_id, email: socio.email, nombre: socio.nombre, apellido: socio.apellido }],
    {
      type: 'admision_asociado_resuelta',
      decision: body.decision,
      categoria: body.categoriaAdmitida || null,
      resolucion_numero: resolution.numero,
      resolucion_anio: resolution.anio,
      resolucion_fecha: resolution.fecha,
    },
    {
      ignorePreferences: true,
      attachments: [{ filename: document.nombre_archivo, content: Buffer.from(await pdfBlob.arrayBuffer()) }],
    }
  )

  const sent = result.sent === 1
  await supabase.from('admision_solicitudes').update({
    notificado_at: sent ? new Date().toISOString() : null,
    notificacion_email: socio.email,
    notificacion_estado: sent ? 'enviada' : 'error',
    notificacion_error: sent ? null : 'El servicio de correo no confirmó el envío.',
  }).eq('id', body.solicitudId)

  return auth.applyCookies(NextResponse.json({ registrada: true, notificada: sent }))
}
