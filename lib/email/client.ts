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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch('/api/email/send', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers,
      body: JSON.stringify({ type, recipients, data }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.warn('Error enviando notificación por email:', response.status, errorBody)
    }
  } catch (err) {
    console.warn('Error preparando notificación por email:', err)
  }
}
