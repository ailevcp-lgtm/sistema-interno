export const SITE_NAME = 'Sistema Interno AILE'
export const SITE_SHORT_NAME = 'AILE'
export const ICON_VERSION = '20260311b'
export const SITE_DESCRIPTION =
  'Plataforma privada para administrar socios, deudas, finanzas, tesoreria y documentos de AILE.'
export const LOGIN_PAGE_DESCRIPTION =
  'Ingresa al panel interno de AILE para gestionar socios, deudas, finanzas, tesoreria y documentos.'
export const SITE_LOCALE = 'es_AR'
export const SITE_KEYWORDS = [
  'AILE',
  'Sistema Interno AILE',
  'panel interno',
  'gestion de socios',
  'tesoreria',
  'finanzas',
  'deudas',
  'documentos',
]

export const SOCIAL_IMAGE = {
  path: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'Vista de acceso al Sistema Interno AILE',
}

const SITE_URL_CANDIDATES = [
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.SITE_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_URL,
  'http://localhost:3000',
]

function normalizeSiteUrl(value: string): URL {
  const trimmed = value.trim()
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return new URL(withProtocol)
}

export function getSiteUrl(): URL {
  for (const candidate of SITE_URL_CANDIDATES) {
    if (!candidate) continue

    try {
      return normalizeSiteUrl(candidate)
    } catch {
      continue
    }
  }

  return new URL('http://localhost:3000')
}
