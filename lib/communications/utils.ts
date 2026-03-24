import crypto from 'crypto'
import { getSiteUrl } from '@/lib/site-config'
import type { CommunicationCampaignFilters } from '@/lib/types'

const DEFAULT_UNSUBSCRIBE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90

type UnsubscribePayload =
  | {
      mode: 'recipient'
      campaignId: string
      recipientId: string
      contactId?: string | null
      exp: number
    }
  | {
      mode: 'test'
      email: string
      exp: number
    }

type SignableUnsubscribePayload =
  | Omit<Extract<UnsubscribePayload, { mode: 'recipient' }>, 'exp'>
  | Omit<Extract<UnsubscribePayload, { mode: 'test' }>, 'exp'>

export function normalizeCommunicationEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase()
}

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items]

  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }
  return chunks
}

export function getCommunicationAppUrl(): string {
  return getSiteUrl().toString().replace(/\/$/, '')
}

export function getCommunicationSenderDefaults() {
  return {
    senderName: (process.env.EMAIL_FROM_NAME || 'AILE').trim(),
    senderEmail: (process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || 'notificaciones@aile.org.ar').trim(),
  }
}

export function formatSender(senderName?: string | null, senderEmail?: string | null): string {
  const normalizedEmail = (senderEmail || '').trim()
  const normalizedName = (senderName || '').trim()

  if (!normalizedEmail) {
    throw new Error('No se configuro un email remitente valido')
  }

  if (!normalizedName) {
    return normalizedEmail
  }

  return `${normalizedName} <${normalizedEmail}>`
}

export function splitFullName(fullName?: string | null) {
  const normalized = (fullName || '').trim()
  if (!normalized) {
    return { firstName: null, lastName: null, fullName: null }
  }

  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null, fullName: normalized }
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1) || null,
    fullName: normalized,
  }
}

export function ensureMinimumContent(body: string): boolean {
  const plainText = body.replace(/\s+/g, ' ').trim()
  return plainText.length >= 12
}

export function parseJsonObject<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback
  }
  return value as T
}

export function sanitizeFilters(filters: CommunicationCampaignFilters | null | undefined): CommunicationCampaignFilters {
  if (!filters) return {}

  const minAge = typeof filters.minAge === 'number' && Number.isFinite(filters.minAge)
    ? Math.max(0, Math.trunc(filters.minAge))
    : undefined
  const maxAge = typeof filters.maxAge === 'number' && Number.isFinite(filters.maxAge)
    ? Math.max(0, Math.trunc(filters.maxAge))
    : undefined

  return {
    contactIds: Array.from(new Set((filters.contactIds || []).map((value) => value.trim()).filter(Boolean))),
    tags: Array.from(new Set((filters.tags || []).map(normalizeTag).filter(Boolean))),
    statuses: Array.from(new Set((filters.statuses || []).filter(Boolean))),
    sources: Array.from(new Set((filters.sources || []).map((value) => value.trim()).filter(Boolean))),
    optInOnly: Boolean(filters.optInOnly),
    minAge,
    maxAge,
  }
}

export function normalizeStringArray(value: unknown): string[] {
  if (!value) return []

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim()
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          const record = entry as Record<string, unknown>
          const candidate = record.name || record.label || record.role || record.value
          return typeof candidate === 'string' ? candidate.trim() : ''
        }
        return String(entry).trim()
      })
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  return []
}

export function getAgeFromBirthDate(birthDate?: string | null): number | null {
  if (!birthDate) return null

  const parsed = new Date(birthDate)
  if (Number.isNaN(parsed.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - parsed.getFullYear()
  const monthDiff = today.getMonth() - parsed.getMonth()
  const dayDiff = today.getDate() - parsed.getDate()

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1
  }

  return age >= 0 ? age : null
}

export function matchesAgeRange(
  birthDate: string | null | undefined,
  minAge?: number,
  maxAge?: number
): boolean {
  if (minAge === undefined && maxAge === undefined) return true

  const age = getAgeFromBirthDate(birthDate)
  if (age === null) return false
  if (minAge !== undefined && age < minAge) return false
  if (maxAge !== undefined && age > maxAge) return false
  return true
}

export function toPlainJson(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()

  if (Array.isArray(value)) {
    return value.map((item) => toPlainJson(item))
  }

  if (typeof value === 'object') {
    if ('toHexString' in (value as Record<string, unknown>) && typeof (value as { toHexString?: unknown }).toHexString === 'function') {
      return (value as { toHexString: () => string }).toHexString()
    }

    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(record).map(([key, entry]) => [key, toPlainJson(entry)])
    )
  }

  return String(value)
}

export function getValueByPath(source: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.').filter(Boolean)
  let current: unknown = source

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment)
      current = Number.isInteger(index) ? current[index] : undefined
      continue
    }

    if (!current || typeof current !== 'object') {
      return undefined
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

export function firstDefinedValue(
  source: Record<string, unknown>,
  explicitPath: string | undefined,
  candidates: string[]
): unknown {
  const paths = [explicitPath, ...candidates].filter(Boolean) as string[]

  for (const path of paths) {
    const value = getValueByPath(source, path)
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return undefined
}

function getUnsubscribeSecret(): string {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error('Falta EMAIL_UNSUBSCRIBE_SECRET o SUPABASE_SERVICE_ROLE_KEY para firmar bajas')
  }
  return secret
}

function encodePayload(payload: UnsubscribePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodePayload(token: string): UnsubscribePayload {
  return JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as UnsubscribePayload
}

export function signUnsubscribePayload(payload: SignableUnsubscribePayload & { exp?: number }): string {
  const signedPayload: UnsubscribePayload = {
    ...payload,
    exp: payload.exp || Math.floor(Date.now() / 1000) + DEFAULT_UNSUBSCRIBE_MAX_AGE_SECONDS,
  } as UnsubscribePayload

  const encoded = encodePayload(signedPayload)
  const signature = crypto.createHmac('sha256', getUnsubscribeSecret()).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload {
  const [encoded, signature] = token.split('.')

  if (!encoded || !signature) {
    throw new Error('Token de baja invalido')
  }

  const expected = crypto.createHmac('sha256', getUnsubscribeSecret()).update(encoded).digest('base64url')
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (signatureBuffer.length !== expectedBuffer.length) {
    throw new Error('Firma de baja invalida')
  }

  const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer)

  if (!isValid) {
    throw new Error('Firma de baja invalida')
  }

  const payload = decodePayload(encoded)
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('El link de baja expiro')
  }

  return payload
}

export function buildRecipientUnsubscribeUrl(payload: Omit<Extract<UnsubscribePayload, { mode: 'recipient' }>, 'exp'>): string {
  const token = signUnsubscribePayload({ ...payload, mode: 'recipient' })
  return `${getCommunicationAppUrl()}/api/communications/unsubscribe?token=${encodeURIComponent(token)}`
}

export function buildTestUnsubscribeUrl(email: string): string {
  const token = signUnsubscribePayload({ mode: 'test', email })
  return `${getCommunicationAppUrl()}/api/communications/unsubscribe?token=${encodeURIComponent(token)}`
}
