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
  return process.env.RESEND_FROM_EMAIL || 'AILE <notificaciones@aile.org.ar>'
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://interno.aile.com.ar'
}
