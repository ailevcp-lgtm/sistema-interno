import { getResendClient, getFromEmail, getAppUrl } from './resend'
import { renderEmailHtml } from './render'
import type {
  EmailNotificationType,
  EmailNotificationData,
  EmailRecipient,
} from './types'
import { NOTIFICATION_PREFERENCE_MAP } from './types'
import { createClient } from '@supabase/supabase-js'

// Usa service role para consultar preferencias sin RLS
function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltan variables de entorno de Supabase para el servicio de email')
  }
  return createClient(url, serviceKey)
}

interface EmailPreferenceRow {
  socio_id: string
  emails_habilitados: boolean
  [key: string]: unknown
}

async function getEnabledRecipients(
  recipients: EmailRecipient[],
  notificationType: EmailNotificationType
): Promise<EmailRecipient[]> {
  if (recipients.length === 0) return []

  const supabase = getServiceSupabase()
  const socioIds = recipients.map((r) => r.socio_id)
  const preferenceColumn = NOTIFICATION_PREFERENCE_MAP[notificationType]

  const { data: preferences } = await supabase
    .from('email_preferences')
    .select('*')
    .in('socio_id', socioIds)

  const prefMap = new Map<string, EmailPreferenceRow>()
  if (preferences) {
    for (const pref of preferences as unknown as EmailPreferenceRow[]) {
      prefMap.set(pref.socio_id, pref)
    }
  }

  return recipients.filter((recipient) => {
    const pref = prefMap.get(recipient.socio_id)
    // Si no tiene preferencias guardadas, se envía por defecto (todo activado)
    if (!pref) return true
    // Kill switch global
    if (!pref.emails_habilitados) return false
    // Preferencia específica
    return pref[preferenceColumn] !== false
  })
}

export function getSubjectForNotification(data: EmailNotificationData): string {
  switch (data.type) {
    case 'tarea_asignada':
      return `Nueva tarea asignada: ${data.tarea_titulo}`
    case 'tarea_estado_cambio':
      return `Tarea actualizada: ${data.tarea_titulo}`
    case 'tarea_vencimiento_proximo':
      return `Recordatorio: [${data.proyecto_nombre}] "${data.tarea_titulo}" vence ${data.dias_restantes === 0 ? 'hoy' : `en ${data.dias_restantes} día${data.dias_restantes > 1 ? 's' : ''}`}`
    case 'subtarea_creada':
      return `Nueva subtarea en: ${data.tarea_titulo}`
    case 'handoff_solicitado':
      return `Handoff solicitado: ${data.tarea_titulo}`
    case 'handoff_resuelto':
      return `Handoff ${data.aceptado ? 'aceptado' : 'rechazado'}: ${data.tarea_titulo}`
    case 'aprobacion_cd_pendiente':
      return `Aprobación pendiente: ${data.tarea_titulo}`
    case 'aprobacion_cd_resuelta':
      return `Tarea ${data.decision}: ${data.tarea_titulo}`
    // Calendario
    case 'calendario_reunion_nueva':
      return `Nueva reunión: ${data.reunion_titulo}`
    case 'calendario_reunion_modificada':
      return `Reunión modificada: ${data.reunion_titulo}`
    case 'calendario_reunion_cancelada':
      return `Reunión cancelada: ${data.reunion_titulo}`
    case 'calendario_planificacion_definitiva':
      return `Fecha confirmada: ${data.planificacion_titulo}`
    // Resoluciones y Decretos
    case 'resolucion_nueva':
      return `Nueva resolución CD: Res. ${data.resolucion_numero}/${data.resolucion_anio} - ${data.resolucion_titulo}`
    case 'decreto_nuevo':
      return `Nuevo decreto: Dec. ${data.decreto_numero}/${data.decreto_anio} - ${data.decreto_titulo}`
    case 'balance_nuevo':
      return `Nuevo balance disponible: ${data.balance_periodo}`
  }
}

async function logEmail(
  socioId: string,
  emailTo: string,
  tipo: string,
  subject: string,
  resendId?: string,
  error?: string
) {
  try {
    const supabase = getServiceSupabase()
    await supabase.from('email_log').insert({
      socio_id: socioId,
      email_to: emailTo,
      tipo,
      subject,
      resend_id: resendId || null,
      estado: error ? 'error' : 'enviado',
      error: error || null,
    })
  } catch (logError) {
    console.error('Error registrando email en log:', logError)
  }
}

export interface SendNotificationResult {
  sent: number
  skipped: number
  errors: number
}

export async function sendEmailNotification(
  notificationType: EmailNotificationType,
  recipients: EmailRecipient[],
  data: EmailNotificationData
): Promise<SendNotificationResult> {
  const result: SendNotificationResult = { sent: 0, skipped: 0, errors: 0 }

  // Filtrar por preferencias
  const enabledRecipients = await getEnabledRecipients(recipients, notificationType)
  result.skipped = recipients.length - enabledRecipients.length

  if (enabledRecipients.length === 0) return result

  const resend = getResendClient()
  const fromEmail = getFromEmail()
  const appUrl = getAppUrl()
  const subject = getSubjectForNotification(data)

  // Enviar un email por destinatario (personalizado)
  const sendPromises = enabledRecipients.map(async (recipient) => {
    try {
      const html = renderEmailHtml(data, recipient, appUrl)

      const { data: resendData, error } = await resend.emails.send({
        from: fromEmail,
        to: recipient.email,
        subject,
        html,
      })

      if (error) {
        await logEmail(recipient.socio_id, recipient.email, notificationType, subject, undefined, error.message)
        result.errors++
        return
      }

      await logEmail(recipient.socio_id, recipient.email, notificationType, subject, resendData?.id)
      result.sent++
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      await logEmail(recipient.socio_id, recipient.email, notificationType, subject, undefined, errorMessage)
      result.errors++
    }
  })

  await Promise.allSettled(sendPromises)
  return result
}
