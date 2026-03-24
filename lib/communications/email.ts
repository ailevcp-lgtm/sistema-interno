import type { CommunicationEmailContent } from '@/lib/types'

const brand = {
  primary: '#6314A9',
  primaryDark: '#4E0F87',
  text: '#1E1B2E',
  muted: '#6B7280',
  surface: '#FFFFFF',
  background: '#F7F4FB',
  border: '#E6DDF1',
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function bodyToParagraphs(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

export function renderCommunicationEmailHtml(props: {
  subject: string
  preheader?: string | null
  recipientName: string
  content: CommunicationEmailContent
  unsubscribeUrl: string
}) {
  const paragraphs = bodyToParagraphs(props.content.body)
    .map((paragraph) => `
      <p style="margin:0 0 14px;color:${brand.text};font-size:15px;line-height:24px;">
        ${escapeHtml(paragraph)}
      </p>
    `)
    .join('')

  const cta = props.content.ctaLabel && props.content.ctaUrl
    ? `
      <div style="padding-top:10px;padding-bottom:10px;">
        <a
          href="${escapeHtml(props.content.ctaUrl)}"
          style="display:inline-block;padding:13px 24px;border-radius:10px;background-color:${brand.primary};color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;"
        >
          ${escapeHtml(props.content.ctaLabel)}
        </a>
      </div>
    `
    : ''

  const footerNote = props.content.footerNote
    ? `
      <p style="margin:18px 0 0;color:${brand.muted};font-size:13px;line-height:20px;">
        ${escapeHtml(props.content.footerNote)}
      </p>
    `
    : ''

  return `<!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(props.subject)}</title>
    </head>
    <body style="margin:0;padding:24px 0;background-color:${brand.background};font-family:Arial,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        ${escapeHtml(props.preheader || props.subject)}
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${brand.surface};border:1px solid ${brand.border};border-radius:16px;overflow:hidden;">
              <tr>
                <td align="center" style="padding:28px 32px;background:linear-gradient(135deg, ${brand.primary} 0%, ${brand.primaryDark} 100%);">
                  <p style="margin:0;color:#FFFFFF;font-size:32px;font-weight:800;letter-spacing:0.35em;text-transform:uppercase;">AILE</p>
                  <p style="margin:10px 0 0;color:rgba(255,255,255,0.78);font-size:12px;letter-spacing:0.16em;text-transform:uppercase;">
                    Comunicacion institucional
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0;color:${brand.text};font-size:15px;line-height:24px;">
                    Hola <strong>${escapeHtml(props.recipientName)}</strong>,
                  </p>
                  <h1 style="margin:18px 0 14px;color:${brand.text};font-size:26px;line-height:34px;">
                    ${escapeHtml(props.content.title)}
                  </h1>
                  ${paragraphs}
                  ${cta}
                  ${footerNote}
                </td>
              </tr>
              <tr>
                <td style="padding:22px 32px;border-top:1px solid ${brand.border};">
                  <p style="margin:0 0 8px;color:${brand.muted};font-size:12px;line-height:18px;">
                    Este correo fue enviado por el modulo de Comunicaciones del Sistema Interno de AILE.
                  </p>
                  <p style="margin:0;color:${brand.muted};font-size:12px;line-height:18px;">
                    Si no deseas recibir futuras comunicaciones institucionales, puedes darte de baja desde este enlace:
                    <a href="${escapeHtml(props.unsubscribeUrl)}" style="color:${brand.primary};"> cancelar suscripcion</a>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`
}

export function renderUnsubscribeHtml(options: {
  title: string
  message: string
  accent?: 'success' | 'muted'
}) {
  const accentColor = options.accent === 'success' ? '#15803D' : brand.primary

  return `<!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(options.title)}</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: ${brand.background};
          color: ${brand.text};
        }
        .wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .card {
          max-width: 560px;
          width: 100%;
          background: ${brand.surface};
          border: 1px solid ${brand.border};
          border-radius: 18px;
          overflow: hidden;
        }
        .header {
          padding: 28px 32px;
          background: linear-gradient(135deg, ${brand.primary} 0%, ${brand.primaryDark} 100%);
          color: white;
          text-align: center;
        }
        .content {
          padding: 32px;
        }
        h1 {
          margin: 0 0 12px;
          font-size: 28px;
          color: ${accentColor};
        }
        p {
          margin: 0;
          line-height: 1.65;
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <div class="header">
            <strong style="font-size:30px;letter-spacing:0.32em;">AILE</strong>
          </div>
          <div class="content">
            <h1>${escapeHtml(options.title)}</h1>
            <p>${escapeHtml(options.message)}</p>
          </div>
        </div>
      </div>
    </body>
  </html>`
}
