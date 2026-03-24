import { Resend } from 'resend'

let resendInstance: Resend | null = null

export function getResendClient(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error(
        'RESEND_API_KEY no está configurada. Agrega la variable de entorno para habilitar emails.'
      )
    }
    resendInstance = new Resend(apiKey)
  }
  return resendInstance
}

export function getFromEmail(): string {
  const senderEmail = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || 'notificaciones@aile.org.ar'
  const senderName = process.env.EMAIL_FROM_NAME || 'AILE'

  if (senderEmail.includes('<')) {
    return senderEmail
  }

  return `${senderName} <${senderEmail}>`
}

export function getAppUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://interno.aile.com.ar'
}
