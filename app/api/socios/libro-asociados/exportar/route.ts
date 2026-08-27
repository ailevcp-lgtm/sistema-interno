import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

import { buildLibroAsociadosPdf, getLibroAsociadosPageCount } from '@/lib/pdf/libro-asociados'
import { getAuthenticatedSocioContext, getServiceSupabase } from '@/lib/server-auth'

export const runtime = 'nodejs'

const PERIOD_PATTERN = /^20\d{2}-(0[1-9]|1[0-2])$/

function endOfPeriod(period: string) {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString()
}

function normalizeDni(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '')
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSocioContext(request)
  if (!auth || !(await auth.hasPermission('socios', 'editar'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as { periodo?: string }
  const periodo = body.periodo || ''
  if (!PERIOD_PATTERN.test(periodo)) {
    return NextResponse.json({ error: 'El período debe tener formato AAAA-MM' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const { data: configRows } = await supabase
    .from('configuracion')
    .select('clave, valor')
    .in('clave', ['libro_asociados_numero', 'aile_cuit'])
  const config = new Map((configRows || []).map((row) => [row.clave, row.valor]))
  const libroNumero = Number(config.get('libro_asociados_numero') || 1)

  const { data: existing } = await supabase
    .from('libro_asociados_cierres')
    .select('id, documento:documentos_legales!libro_asociados_cierres_documento_id_fkey(bucket, storage_path, nombre_archivo)')
    .eq('libro_numero', libroNumero)
    .eq('periodo', periodo)
    .maybeSingle()

  if (existing?.documento) {
    const documentRow = Array.isArray(existing.documento) ? existing.documento[0] : existing.documento
    const { data: signed } = await supabase.storage
      .from(documentRow.bucket)
      .createSignedUrl(documentRow.storage_path, 300, { download: documentRow.nombre_archivo })
    return NextResponse.json({ cierreId: existing.id, url: signed?.signedUrl, existente: true })
  }

  const [{ data: memberships, error: membershipError }, { data: previousClosure }, { data: sanctions }] = await Promise.all([
    supabase
      .from('asociados_membresias')
      .select('id, socio_id, numero_asociado, categoria, origen, estado, fecha_inicio, fecha_fin, causa_fin, instrumento_descripcion, socio:socios!asociados_membresias_socio_id_fkey(id, nombre, apellido, dni)')
      .lte('fecha_inicio', endOfPeriod(periodo).slice(0, 10))
      .order('numero_asociado'),
    supabase
      .from('libro_asociados_cierres')
      .select('folio_hasta, sha256')
      .eq('libro_numero', libroNumero)
      .lt('periodo', periodo)
      .order('periodo', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('estatuto_procesos_disciplinarios')
      .select('socio_id, tipo, estado, resultado')
      .in('estado', ['resuelto', 'apelado', 'cerrado']),
  ])

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 })
  }

  const socioIds = (memberships || []).map((membership) => membership.socio_id)
  const { data: cuotas } = socioIds.length > 0
    ? await supabase
      .from('cuotas')
      .select('socio_id, periodo, estado')
      .eq('naturaleza', 'cuota_social')
      .eq('estado', 'pagada')
      .lte('periodo', periodo)
      .in('socio_id', socioIds)
    : { data: [] }

  const paidBySocio = new Map<string, string[]>()
  for (const cuota of cuotas || []) {
    const periods = paidBySocio.get(cuota.socio_id) || []
    periods.push(cuota.periodo)
    paidBySocio.set(cuota.socio_id, periods)
  }
  const sanctionsBySocio = new Map<string, string[]>()
  for (const sanction of sanctions || []) {
    const items = sanctionsBySocio.get(sanction.socio_id) || []
    items.push(`${sanction.tipo}${sanction.resultado ? `: ${sanction.resultado}` : ''}`)
    sanctionsBySocio.set(sanction.socio_id, items)
  }

  const rows = (memberships || []).map((membership) => {
    const socio = Array.isArray(membership.socio) ? membership.socio[0] : membership.socio
    const paid = paidBySocio.get(membership.socio_id) || []
    return {
      numero: membership.numero_asociado,
      apellidoNombre: `${socio?.apellido || ''}, ${socio?.nombre || ''}`,
      dni: normalizeDni(socio?.dni),
      categoria: membership.categoria === 'pleno' ? 'Pleno' : membership.categoria === 'adherente' ? 'Adherente' : 'Honorario',
      fechaIngreso: membership.fecha_inicio,
      origen: membership.origen === 'fundador' ? 'Acta constitutiva' : membership.instrumento_descripcion,
      cuotasPagadas: paid.length ? paid.join(', ') : 'Sin cuotas devengadas/pagadas',
      sanciones: (sanctionsBySocio.get(membership.socio_id) || []).join('; ') || 'Sin sanciones',
      estado: membership.estado === 'activo' ? 'Activo' : membership.estado === 'suspendido' ? 'Suspendido' : 'Baja',
      fechaBaja: membership.fecha_fin,
      causaBaja: membership.causa_fin,
    }
  })

  const folioDesde = Number(previousClosure?.folio_hasta || 0) + 1
  const pdfBytes = buildLibroAsociadosPdf({
    periodo,
    libroNumero,
    folioDesde,
    cuit: config.get('aile_cuit') || null,
    generadoEl: new Date(),
    hashAnterior: previousClosure?.sha256 || null,
    rows,
  })
  const sha256 = crypto.createHash('sha256').update(pdfBytes).digest('hex')
  const pageCount = getLibroAsociadosPageCount(rows.length)
  const fileName = `AILE-Libro-${libroNumero}-Registro-Asociados-${periodo}.pdf`
  const storagePath = `libro-digital/asociados/libro-${libroNumero}/${periodo}-${sha256.slice(0, 16)}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('documentos-legales')
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: documentRow, error: documentError } = await supabase
    .from('documentos_legales')
    .insert({
      tipo: 'libro_digital',
      titulo: `Registro de Personas Asociadas - ${periodo}`,
      descripcion: `Cierre mensual del Libro N.º ${libroNumero}, folios ${folioDesde} a ${folioDesde + pageCount - 1}.`,
      fecha_documento: endOfPeriod(periodo).slice(0, 10),
      estado_registro: 'pendiente_firma',
      es_vigente: true,
      firma_digital: false,
      componentes: [],
      etiquetas: ['legal', 'libro-asociados', periodo],
      bucket: 'documentos-legales',
      storage_path: storagePath,
      nombre_archivo: fileName,
      mime_type: 'application/pdf',
      tamano_bytes: pdfBytes.byteLength,
      sha256,
      created_by_socio_id: auth.socioId,
      visibilidad: 'privado',
    })
    .select('id')
    .single()

  if (documentError || !documentRow) {
    await supabase.storage.from('documentos-legales').remove([storagePath])
    return NextResponse.json({ error: documentError?.message || 'No se pudo registrar el PDF' }, { status: 500 })
  }

  const cutoff = endOfPeriod(periodo)
  const { data: openSeats } = await supabase
    .from('libro_asociados_asientos')
    .select('numero_asiento')
    .is('cierre_id', null)
    .lte('fecha', cutoff.slice(0, 10))
    .order('numero_asiento')

  const asientoDesde = openSeats?.[0]?.numero_asiento || null
  const asientoHasta = openSeats?.[openSeats.length - 1]?.numero_asiento || null
  const { data: closure, error: closureError } = await supabase
    .from('libro_asociados_cierres')
    .insert({
      periodo,
      libro_numero: libroNumero,
      folio_desde: folioDesde,
      folio_hasta: folioDesde + pageCount - 1,
      asiento_desde: asientoDesde,
      asiento_hasta: asientoHasta,
      estado: 'cerrado',
      documento_id: documentRow.id,
      sha256,
      sha256_anterior: previousClosure?.sha256 || null,
      cerrado_por_socio_id: auth.socioId,
    })
    .select('id')
    .single()

  if (closureError || !closure) {
    await supabase.from('documentos_legales').delete().eq('id', documentRow.id)
    await supabase.storage.from('documentos-legales').remove([storagePath])
    return NextResponse.json({ error: closureError?.message || 'No se pudo cerrar el período' }, { status: 409 })
  }

  if (openSeats?.length) {
    await supabase
      .from('libro_asociados_asientos')
      .update({ cierre_id: closure.id })
      .in('numero_asiento', openSeats.map((seat) => seat.numero_asiento))
  }

  const { data: signed } = await supabase.storage
    .from('documentos-legales')
    .createSignedUrl(storagePath, 300, { download: fileName })

  return auth.applyCookies(NextResponse.json({
    cierreId: closure.id,
    url: signed?.signedUrl,
    existente: false,
    sha256,
    folioDesde,
    folioHasta: folioDesde + pageCount - 1,
  }))
}
