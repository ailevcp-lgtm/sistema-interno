import { NextRequest, NextResponse } from 'next/server'

import { getServiceSupabase } from '@/lib/server-auth'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const supabase = getServiceSupabase()
  const id = request.nextUrl.searchParams.get('id')

  if (id) {
    const { data: document, error } = await supabase
      .from('documentos_legales')
      .select('id, bucket, storage_path, nombre_archivo')
      .eq('id', id)
      .eq('visibilidad', 'publico')
      .eq('es_vigente', true)
      .not('publicado_at', 'is', null)
      .maybeSingle()
    if (error || !document) return NextResponse.json({ error: 'Documento no disponible' }, { status: 404 })
    const { data: signed, error: signedError } = await supabase.storage
      .from(document.bucket)
      .createSignedUrl(document.storage_path, 120, { download: document.nombre_archivo })
    if (signedError || !signed?.signedUrl) return NextResponse.json({ error: 'No se pudo abrir el documento' }, { status: 500 })
    return NextResponse.json({ url: signed.signedUrl }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const { data, error } = await supabase
    .from('documentos_legales')
    .select('id, tipo, titulo_publico, titulo, descripcion_publica, numero, anio, fecha_documento, publicado_at, firma_digital, sha256')
    .eq('visibilidad', 'publico')
    .eq('es_vigente', true)
    .not('publicado_at', 'is', null)
    .order('fecha_documento', { ascending: false, nullsFirst: false })
  if (error) return NextResponse.json({ error: 'No se pudo cargar el archivo público' }, { status: 500 })
  return NextResponse.json({ documentos: data || [] }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
}
