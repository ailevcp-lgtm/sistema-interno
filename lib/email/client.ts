import { supabase } from '@/lib/supabase'
import type {
  EmailNotificationType,
  EmailNotificationData,
  EmailRecipient,
} from './types'

/**
 * Envía una notificación por email de forma fire-and-forget.
 * No bloquea la UI ni lanza errores al usuario.
 */
export async function sendEmailNotificationFromClient(
  type: EmailNotificationType,
  recipients: EmailRecipient[],
  data: EmailNotificationData
): Promise<void> {
  try {
    if (recipients.length === 0) return

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return

    // Fire and forget — no await en el caller
    fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type, recipients, data }),
    }).catch((err) => {
      console.warn('Error enviando notificación por email:', err)
    })
  } catch (err) {
    console.warn('Error preparando notificación por email:', err)
  }
}
