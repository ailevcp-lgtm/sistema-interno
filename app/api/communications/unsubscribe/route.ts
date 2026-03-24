import { NextRequest, NextResponse } from 'next/server'
import { renderUnsubscribeHtml } from '@/lib/communications/email'
import { processUnsubscribeToken } from '@/lib/communications/service'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim()

  if (!token) {
    return new NextResponse(
      renderUnsubscribeHtml({
        title: 'Link invalido',
        message: 'El enlace de baja no es valido o esta incompleto.',
      }),
      {
        status: 400,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }
    )
  }

  try {
    const result = await processUnsubscribeToken(token)
    return new NextResponse(
      renderUnsubscribeHtml({
        title: result.kind === 'test' ? 'Correo de prueba' : 'Suscripcion cancelada',
        message: result.kind === 'test'
          ? `Este era un correo de prueba enviado a ${result.email}. No se registro ninguna baja real.`
          : `La direccion ${result.email} fue dada de baja para futuras comunicaciones institucionales de AILE.`,
        accent: result.kind === 'test' ? 'muted' : 'success',
      }),
      {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible procesar la baja.'
    return new NextResponse(
      renderUnsubscribeHtml({
        title: 'No pudimos procesar la baja',
        message,
      }),
      {
        status: 400,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }
    )
  }
}
