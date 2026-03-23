import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendEmailNotification } from '@/lib/email/send-notification'
import { createSupabaseRouteClient } from '@/lib/supabase-server'
import type { EmailNotificationData, EmailNotificationType, EmailRecipient } from '@/lib/email/types'

const EMAIL_NOTIFICATION_TYPES = [
  'tarea_asignada',
  'tarea_estado_cambio',
  'tarea_vencimiento_proximo',
  'subtarea_creada',
  'handoff_solicitado',
  'handoff_resuelto',
  'aprobacion_cd_pendiente',
  'aprobacion_cd_resuelta',
  'calendario_reunion_nueva',
  'calendario_reunion_modificada',
  'calendario_reunion_cancelada',
  'calendario_planificacion_definitiva',
  'resolucion_nueva',
  'decreto_nuevo',
  'balance_nuevo',
] as const

const SERVER_ONLY_NOTIFICATION_TYPES = new Set<EmailNotificationType>([
  'tarea_vencimiento_proximo',
])

const NOTIFICATION_PERMISSION_GUARDS: Partial<Record<EmailNotificationType, Array<['balances' | 'resoluciones' | 'calendario', 'crear' | 'editar']>>> = {
  balance_nuevo: [['balances', 'crear'], ['balances', 'editar']],
  resolucion_nueva: [['resoluciones', 'crear'], ['resoluciones', 'editar']],
  decreto_nuevo: [['resoluciones', 'crear'], ['resoluciones', 'editar']],
  calendario_reunion_nueva: [['calendario', 'crear'], ['calendario', 'editar']],
  calendario_reunion_modificada: [['calendario', 'crear'], ['calendario', 'editar']],
  calendario_reunion_cancelada: [['calendario', 'crear'], ['calendario', 'editar']],
  calendario_planificacion_definitiva: [['calendario', 'crear'], ['calendario', 'editar']],
}

const EmailNotificationTypeSchema = z.enum(EMAIL_NOTIFICATION_TYPES)

const RecipientSchema = z.object({
  socio_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  nombre: z.string().min(1).optional(),
  apellido: z.string().min(1).optional(),
}).passthrough()

const SendEmailBodySchema = z.object({
  type: EmailNotificationTypeSchema,
  recipients: z.array(RecipientSchema).min(1).max(100),
  data: z.object({
    type: EmailNotificationTypeSchema,
  }).passthrough(),
})

const SOCIO_SELECT = 'id, usuario_id, nombre, apellido, email, estado'

interface SocioRow {
  id: string
  usuario_id: string | null
  nombre: string
  apellido: string
  email: string | null
  estado: string
}

interface AuthContext {
  user: {
    id: string
  }
  applyCookies<T extends NextResponse>(response: T): T
}

function normalizeText(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey)
}

async function getAuthenticatedUser(request: NextRequest): Promise<AuthContext | null> {
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
        user: { id: user.id },
        applyCookies<T extends NextResponse>(response: T): T {
          return response
        },
      }
    }
  }

  const { supabase, applyCookies } = createSupabaseRouteClient(request)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  return { user: { id: user.id }, applyCookies }
}

async function getActiveSocioForUser(userId: string): Promise<SocioRow | null> {
  const supabase = getServiceSupabase()
  if (!supabase) throw new Error('Missing Supabase service role configuration')

  const { data, error } = await supabase
    .from('socios')
    .select(SOCIO_SELECT)
    .eq('usuario_id', userId)
    .eq('estado', 'activo')
    .maybeSingle()

  if (error) throw error
  return (data as SocioRow | null) || null
}

async function loadActiveSocios(): Promise<SocioRow[]> {
  const supabase = getServiceSupabase()
  if (!supabase) throw new Error('Missing Supabase service role configuration')

  const { data, error } = await supabase
    .from('socios')
    .select(SOCIO_SELECT)
    .eq('estado', 'activo')
    .not('email', 'is', null)

  if (error) throw error
  return (data || []) as SocioRow[]
}

async function hasServerPermission(
  userId: string,
  recurso: 'balances' | 'resoluciones' | 'calendario',
  accion: 'crear' | 'editar'
) {
  const supabase = getServiceSupabase()
  if (!supabase) throw new Error('Missing Supabase service role configuration')

  const { data, error } = await supabase.rpc('fn_has_resource_permission', {
    p_recurso: recurso,
    p_accion: accion,
    p_usuario_id: userId,
  })

  if (error) throw error
  return data === true
}

async function canSendNotificationType(userId: string, type: EmailNotificationType) {
  if (SERVER_ONLY_NOTIFICATION_TYPES.has(type)) {
    return false
  }

  const guards = NOTIFICATION_PERMISSION_GUARDS[type]
  if (!guards || guards.length === 0) {
    return true
  }

  for (const [recurso, accion] of guards) {
    if (await hasServerPermission(userId, recurso, accion)) {
      return true
    }
  }

  return false
}

function buildSocioMaps(socios: SocioRow[]) {
  const byId = new Map<string, SocioRow>()
  const byEmail = new Map<string, SocioRow>()

  for (const socio of socios) {
    byId.set(socio.id, socio)

    const normalizedEmail = normalizeText(socio.email)
    if (!normalizedEmail) continue

    const existing = byEmail.get(normalizedEmail)
    if (existing && existing.id !== socio.id) {
      throw new Error(`Duplicate active socio email detected: ${normalizedEmail}`)
    }

    byEmail.set(normalizedEmail, socio)
  }

  return { byId, byEmail }
}

function resolveRecipient(
  recipient: z.infer<typeof RecipientSchema>,
  socioMaps: ReturnType<typeof buildSocioMaps>
) {
  const requestedSocioId = recipient.socio_id?.trim() || ''
  const requestedEmail = normalizeText(recipient.email)
  const requestedNombre = normalizeText(recipient.nombre)
  const requestedApellido = normalizeText(recipient.apellido)

  const resolved = requestedSocioId
    ? socioMaps.byId.get(requestedSocioId)
    : requestedEmail
      ? socioMaps.byEmail.get(requestedEmail)
      : null

  if (!resolved) return null
  if (requestedSocioId && resolved.id !== requestedSocioId) return null
  if (requestedEmail && normalizeText(resolved.email) !== requestedEmail) return null
  if (recipient.nombre && normalizeText(resolved.nombre) !== requestedNombre) return null
  if (recipient.apellido && normalizeText(resolved.apellido) !== requestedApellido) return null
  if (!normalizeText(resolved.email)) return null

  return {
    socio_id: resolved.id,
    email: resolved.email!,
    nombre: resolved.nombre,
    apellido: resolved.apellido,
  }
}

function jsonWithCookies<T extends NextResponse>(
  authContext: AuthContext,
  response: T
) {
  return authContext.applyCookies(response)
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedUser(request)
    if (!authContext) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const activeSocio = await getActiveSocioForUser(authContext.user.id)
    if (!activeSocio) {
      return jsonWithCookies(
        authContext,
        NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      )
    }

    const rawBody = await request.json().catch(() => null)
    const parsedBody = SendEmailBodySchema.safeParse(rawBody)

    if (!parsedBody.success) {
      return jsonWithCookies(
        authContext,
        NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
      )
    }

    const body = parsedBody.data
    if (body.data.type !== body.type) {
      return jsonWithCookies(
        authContext,
        NextResponse.json(
          { error: 'El tipo del payload no coincide con data.type' },
          { status: 400 }
        )
      )
    }

    if (!(await canSendNotificationType(authContext.user.id, body.type))) {
      return jsonWithCookies(
        authContext,
        NextResponse.json(
          { error: 'No autorizado para enviar esta notificación' },
          { status: 403 }
        )
      )
    }

    if (!process.env.RESEND_API_KEY) {
      return jsonWithCookies(
        authContext,
        NextResponse.json({
          sent: 0,
          skipped: 0,
          errors: 0,
          message: 'Email service not configured',
        })
      )
    }

    const activeSocios = await loadActiveSocios()
    const socioMaps = buildSocioMaps(activeSocios)
    const resolvedRecipients: EmailRecipient[] = []
    const seenRecipients = new Set<string>()

    for (const recipient of body.recipients) {
      const resolved = resolveRecipient(recipient, socioMaps)
      if (!resolved) {
        return jsonWithCookies(
          authContext,
          NextResponse.json(
            { error: 'Destinatarios inválidos o inconsistentes' },
            { status: 400 }
          )
        )
      }

      if (seenRecipients.has(resolved.socio_id)) {
        return jsonWithCookies(
          authContext,
          NextResponse.json({ error: 'Destinatarios duplicados' }, { status: 400 })
        )
      }

      seenRecipients.add(resolved.socio_id)
      resolvedRecipients.push(resolved)
    }

    if (resolvedRecipients.length === 0) {
      return jsonWithCookies(
        authContext,
        NextResponse.json(
          { error: 'No se encontraron destinatarios válidos' },
          { status: 400 }
        )
      )
    }

    const result = await sendEmailNotification(
      body.type,
      resolvedRecipients,
      body.data as unknown as EmailNotificationData
    )

    return jsonWithCookies(authContext, NextResponse.json(result))
  } catch (error) {
    console.error('Error en /api/email/send:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
