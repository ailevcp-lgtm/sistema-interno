import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmailNotification } from '@/lib/email/send-notification'
import type {
  EmailNotificationType,
  EmailNotificationData,
  EmailRecipient,
} from '@/lib/email/types'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltan variables de entorno de Supabase')
  }
  return createClient(url, serviceKey)
}

// Verificar que el request viene de un usuario autenticado
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

interface SendEmailBody {
  type: EmailNotificationType
  recipients: EmailRecipient[]
  data: EmailNotificationData
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que RESEND_API_KEY está configurada
    if (!process.env.RESEND_API_KEY) {
      // Silenciosamente ignorar si no está configurado (no romper la app)
      return NextResponse.json({
        sent: 0,
        skipped: 0,
        errors: 0,
        message: 'Email service not configured',
      })
    }

    const body = (await request.json()) as SendEmailBody

    if (!body.type || !body.recipients || !body.data) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: type, recipients, data' },
        { status: 400 }
      )
    }

    // Validar que los recipients tienen email
    const validRecipients = body.recipients.filter(
      (r) => r.email && r.socio_id && r.nombre
    )

    if (validRecipients.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0, errors: 0 })
    }

    const result = await sendEmailNotification(
      body.type,
      validRecipients,
      body.data
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en /api/email/send:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
