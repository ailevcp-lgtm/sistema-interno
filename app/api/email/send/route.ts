import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmailNotification } from '@/lib/email/send-notification'
import { createSupabaseRouteClient } from '@/lib/supabase-server'
import type {
  EmailNotificationType,
  EmailNotificationData,
  EmailRecipient,
} from '@/lib/email/types'

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (!error && user) {
      return {
        user,
        applyCookies<T extends NextResponse>(response: T): T {
          return response
        },
      }
    }
  }

  const { supabase, applyCookies } = createSupabaseRouteClient(request)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  return { user, applyCookies }
}

interface SendEmailBody {
  type: EmailNotificationType
  recipients: EmailRecipient[]
  data: EmailNotificationData
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedUser(request)
    if (!authContext) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!process.env.RESEND_API_KEY) {
      return authContext.applyCookies(NextResponse.json({
        sent: 0,
        skipped: 0,
        errors: 0,
        message: 'Email service not configured',
      }))
    }

    const body = (await request.json()) as SendEmailBody

    if (!body.type || !body.recipients || !body.data) {
      return authContext.applyCookies(NextResponse.json(
        { error: 'Faltan campos requeridos: type, recipients, data' },
        { status: 400 }
      ))
    }

    const validRecipients = body.recipients.filter(
      (r) => r.email && r.socio_id && r.nombre
    )

    if (validRecipients.length === 0) {
      return authContext.applyCookies(NextResponse.json({ sent: 0, skipped: 0, errors: 0 }))
    }

    const result = await sendEmailNotification(
      body.type,
      validRecipients,
      body.data
    )

    return authContext.applyCookies(NextResponse.json(result))
  } catch (error) {
    console.error('Error en /api/email/send:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
