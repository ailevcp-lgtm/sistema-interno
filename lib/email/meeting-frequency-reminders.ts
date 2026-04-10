import { createClient } from '@supabase/supabase-js'
import { DIRECCIONES_BASE, REUNION_DIRECCION_ALERT_THRESHOLD_DAYS } from '@/lib/reuniones'
import { getAppUrl, getFromEmail, getResendClient } from './resend'

const REMINDER_TIMEZONE = process.env.APP_TIMEZONE || 'America/Argentina/Cordoba'
const REMINDER_EMAIL_TYPE = 'reunion_direccion_sin_frecuencia'

interface MeetingRow {
  direccion: string
  fecha_inicio: string
}

interface DirectorAssignmentRowRaw {
  socio_id: string
  direccion?: Array<{
    nombre: string
    activo: boolean
  }> | {
    nombre: string
    activo: boolean
  } | null
  socio?: Array<{
    id: string
    nombre: string
    apellido: string
    email: string | null
    estado: string
  }> | {
    id: string
    nombre: string
    apellido: string
    email: string | null
    estado: string
  } | null
}

interface DirectorAssignmentRow {
  socio_id: string
  direccion?: {
    nombre: string
    activo: boolean
  } | null
  socio?: {
    id: string
    nombre: string
    apellido: string
    email: string | null
    estado: string
  } | null
}

interface EmailPreferenceRow {
  socio_id: string
  emails_habilitados: boolean
}

interface EmailLogRow {
  socio_id: string | null
  subject: string | null
  estado: string
}

interface PlannedMeetingReminder {
  socioId: string
  email: string
  nombre: string
  apellido: string
  direccion: string
  lastMeetingAt: string
  daysWithoutMeeting: number
  subject: string
}

export interface MeetingFrequencyReminderRunOptions {
  dryRun?: boolean
}

export interface MeetingFrequencyReminderDirectionResult {
  direccion: string
  lastMeetingAt: string | null
  daysWithoutMeeting: number | null
  recipientsMatched: number
}

export interface MeetingFrequencyReminderRunResult {
  dryRun: boolean
  timezone: string
  date: string
  evaluatedDirections: number
  directionsDue: number
  recipientsMatched: number
  alreadySent: number
  sent: number
  skipped: number
  errors: number
  directions: MeetingFrequencyReminderDirectionResult[]
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltan variables de entorno de Supabase para el job de reuniones')
  }
  return createClient(url, serviceKey)
}

function getDateStringInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    throw new Error(`No se pudo resolver la fecha local para ${timeZone}`)
  }

  return `${year}-${month}-${day}`
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
  })

  const offsetLabel = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value
  const match = offsetLabel?.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/)

  if (!match) {
    return 0
  }

  const [, sign, hours, minutes] = match
  const totalMinutes = Number(hours) * 60 + Number(minutes || '0')

  return sign === '-' ? -totalMinutes : totalMinutes
}

function getStartOfDayUtcIso(date: Date, timeZone: string): string {
  const [year, month, day] = getDateStringInTimeZone(date, timeZone).split('-').map(Number)
  const offsetMinutes = getTimeZoneOffsetMinutes(date, timeZone)
  const utcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMinutes * 60_000

  return new Date(utcMs).toISOString()
}

function getDayDiff(laterDate: string, earlierDate: string): number {
  const laterUtc = new Date(`${laterDate}T00:00:00Z`).getTime()
  const earlierUtc = new Date(`${earlierDate}T00:00:00Z`).getTime()
  return Math.round((laterUtc - earlierUtc) / 86_400_000)
}

function formatDateTime(dateString: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: REMINDER_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getReminderSubject(direccion: string, daysWithoutMeeting: number): string {
  return `Recordatorio diario: ${direccion} lleva ${daysWithoutMeeting} dias sin reunion`
}

function getRelationValue<T>(value?: T[] | T | null): T | null {
  if (Array.isArray(value)) {
    return value[0] || null
  }

  return value || null
}

function normalizeDirectorAssignment(row: DirectorAssignmentRowRaw): DirectorAssignmentRow {
  return {
    socio_id: row.socio_id,
    direccion: getRelationValue(row.direccion),
    socio: getRelationValue(row.socio),
  }
}

function renderReminderHtml(reminder: PlannedMeetingReminder, appUrl: string): string {
  const fullName = `${reminder.nombre} ${reminder.apellido}`.trim()
  const reunionesUrl = `${appUrl}/reuniones`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(reminder.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:28px 32px;background:#111827;color:#ffffff;">
              <h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:1px;">AILE</h1>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Recordatorio de frecuencia de reuniones</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 12px;font-size:15px;">Hola <strong>${escapeHtml(fullName || reminder.nombre)}</strong>,</p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
                La direccion <strong>${escapeHtml(reminder.direccion)}</strong> lleva
                <strong>${reminder.daysWithoutMeeting} dias</strong> sin registrar una reunion finalizada en el sistema.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;margin:0 0 20px;">
                <tr>
                  <td style="padding:14px 16px;font-size:13px;color:#6b7280;width:180px;">Direccion</td>
                  <td style="padding:14px 16px;font-size:13px;color:#111827;font-weight:600;">${escapeHtml(reminder.direccion)}</td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;font-size:13px;color:#6b7280;width:180px;">Ultima reunion registrada</td>
                  <td style="padding:14px 16px;font-size:13px;color:#111827;">${escapeHtml(formatDateTime(reminder.lastMeetingAt))}</td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;font-size:13px;color:#6b7280;width:180px;">Dias sin reunion</td>
                  <td style="padding:14px 16px;font-size:13px;color:#b91c1c;font-weight:700;">${reminder.daysWithoutMeeting} dias</td>
                </tr>
              </table>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
                Hace falta organizar una nueva reunion y dejarla asentada en el modulo correspondiente.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#111827;border-radius:10px;">
                    <a href="${escapeHtml(reunionesUrl)}" style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">
                      Ir al modulo de reuniones
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function logReminderEmail(
  socioId: string,
  emailTo: string,
  subject: string,
  resendId?: string,
  error?: string
) {
  try {
    const supabase = getServiceSupabase()
    await supabase.from('email_log').insert({
      socio_id: socioId,
      email_to: emailTo,
      tipo: REMINDER_EMAIL_TYPE,
      subject,
      resend_id: resendId || null,
      estado: error ? 'error' : 'enviado',
      error: error || null,
    })
  } catch (logError) {
    console.error('Error registrando email de frecuencia de reuniones:', logError)
  }
}

export async function runMeetingFrequencyReminderEmails(
  options: MeetingFrequencyReminderRunOptions = {}
): Promise<MeetingFrequencyReminderRunResult> {
  const dryRun = options.dryRun === true
  const supabase = getServiceSupabase()
  const now = new Date()
  const today = getDateStringInTimeZone(now, REMINDER_TIMEZONE)
  const dayStartUtc = getStartOfDayUtcIso(now, REMINDER_TIMEZONE)

  const [
    { data: meetingsData, error: meetingsError },
    { data: directorsData, error: directorsError },
    { data: emailLogData, error: emailLogError },
  ] = await Promise.all([
    supabase
      .from('reuniones_direccion')
      .select('direccion, fecha_inicio')
      .eq('estado', 'finalizada')
      .order('fecha_inicio', { ascending: false }),
    supabase
      .from('socios_direcciones')
      .select(`
        socio_id,
        direccion:direcciones!socios_direcciones_direccion_id_fkey(nombre, activo),
        socio:socios!socios_direcciones_socio_id_fkey(id, nombre, apellido, email, estado)
      `)
      .eq('es_director', true)
      .eq('activo', true),
    supabase
      .from('email_log')
      .select('socio_id, subject, estado')
      .eq('tipo', REMINDER_EMAIL_TYPE)
      .gte('created_at', dayStartUtc),
  ])

  if (meetingsError) {
    throw new Error(`No se pudieron consultar las reuniones finalizadas: ${meetingsError.message}`)
  }
  if (directorsError) {
    throw new Error(`No se pudieron consultar los directores de direccion: ${directorsError.message}`)
  }
  if (emailLogError) {
    throw new Error(`No se pudo consultar el historial diario de emails: ${emailLogError.message}`)
  }

  const lastMeetingByDirection = new Map<string, string>()
  for (const meeting of (meetingsData || []) as MeetingRow[]) {
    if (!lastMeetingByDirection.has(meeting.direccion)) {
      lastMeetingByDirection.set(meeting.direccion, meeting.fecha_inicio)
    }
  }

  const activeDirectorAssignments = ((directorsData || []) as DirectorAssignmentRowRaw[])
    .map(normalizeDirectorAssignment)
    .filter((row) =>
    row.direccion?.activo === true &&
    row.socio?.estado === 'activo' &&
    typeof row.socio?.email === 'string' &&
    row.socio.email.trim().length > 0
  )

  const directorSocioIds = Array.from(
    new Set(activeDirectorAssignments.map((row) => row.socio?.id).filter((value): value is string => Boolean(value)))
  )

  const preferenceBySocioId = new Map<string, EmailPreferenceRow>()
  if (directorSocioIds.length > 0) {
    const { data: preferencesData, error: preferencesError } = await supabase
      .from('email_preferences')
      .select('socio_id, emails_habilitados')
      .in('socio_id', directorSocioIds)

    if (preferencesError) {
      throw new Error(`No se pudieron consultar las preferencias globales de email: ${preferencesError.message}`)
    }

    for (const preference of (preferencesData || []) as EmailPreferenceRow[]) {
      preferenceBySocioId.set(preference.socio_id, preference)
    }
  }

  const directorsByDirection = new Map<string, PlannedMeetingReminder[]>()
  let skipped = 0

  for (const assignment of activeDirectorAssignments) {
    const directionName = assignment.direccion?.nombre
    const socio = assignment.socio

    if (!directionName || !socio?.email) {
      continue
    }

    const preferences = preferenceBySocioId.get(socio.id)
    if (preferences?.emails_habilitados === false) {
      skipped++
      continue
    }

    const lastMeetingAt = lastMeetingByDirection.get(directionName)
    if (!lastMeetingAt) {
      continue
    }

    const lastMeetingDate = getDateStringInTimeZone(new Date(lastMeetingAt), REMINDER_TIMEZONE)
    const daysWithoutMeeting = getDayDiff(today, lastMeetingDate)

    if (daysWithoutMeeting < REUNION_DIRECCION_ALERT_THRESHOLD_DAYS) {
      continue
    }

    const reminder: PlannedMeetingReminder = {
      socioId: socio.id,
      email: socio.email,
      nombre: socio.nombre,
      apellido: socio.apellido,
      direccion: directionName,
      lastMeetingAt,
      daysWithoutMeeting,
      subject: getReminderSubject(directionName, daysWithoutMeeting),
    }

    const reminders = directorsByDirection.get(directionName) || []
    reminders.push(reminder)
    directorsByDirection.set(directionName, reminders)
  }

  const alreadySentKeys = new Set(
    ((emailLogData || []) as EmailLogRow[])
      .filter((row) => row.estado === 'enviado' && row.socio_id && row.subject)
      .map((row) => `${row.socio_id}::${row.subject}`)
  )

  const directionResults: MeetingFrequencyReminderDirectionResult[] = DIRECCIONES_BASE.map((direccion) => {
    const lastMeetingAt = lastMeetingByDirection.get(direccion) || null
    const daysWithoutMeeting = lastMeetingAt
      ? getDayDiff(today, getDateStringInTimeZone(new Date(lastMeetingAt), REMINDER_TIMEZONE))
      : null

    return {
      direccion,
      lastMeetingAt,
      daysWithoutMeeting,
      recipientsMatched: (directorsByDirection.get(direccion) || []).length,
    }
  })

  const plannedReminders = Array.from(directorsByDirection.values()).flat()
  let alreadySent = 0
  let sent = 0
  let errors = 0

  if (!dryRun && plannedReminders.length > 0 && !process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY no esta configurada para el job de reuniones')
  }

  const resend = dryRun || plannedReminders.length === 0 ? null : getResendClient()
  const fromEmail = getFromEmail()
  const appUrl = getAppUrl()

  for (const reminder of plannedReminders) {
    const dedupeKey = `${reminder.socioId}::${reminder.subject}`
    if (alreadySentKeys.has(dedupeKey)) {
      alreadySent++
      continue
    }

    if (dryRun) {
      continue
    }

    try {
      const html = renderReminderHtml(reminder, appUrl)
      const { data, error } = await resend!.emails.send({
        from: fromEmail,
        to: reminder.email,
        subject: reminder.subject,
        html,
      })

      if (error) {
        await logReminderEmail(reminder.socioId, reminder.email, reminder.subject, undefined, error.message)
        errors++
        continue
      }

      await logReminderEmail(reminder.socioId, reminder.email, reminder.subject, data?.id)
      sent++
      alreadySentKeys.add(dedupeKey)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      await logReminderEmail(reminder.socioId, reminder.email, reminder.subject, undefined, message)
      errors++
    }
  }

  return {
    dryRun,
    timezone: REMINDER_TIMEZONE,
    date: today,
    evaluatedDirections: DIRECCIONES_BASE.length,
    directionsDue: directionResults.filter(
      (direction) =>
        typeof direction.daysWithoutMeeting === 'number' &&
        direction.daysWithoutMeeting >= REUNION_DIRECCION_ALERT_THRESHOLD_DAYS
    ).length,
    recipientsMatched: plannedReminders.length,
    alreadySent,
    sent,
    skipped,
    errors,
    directions: directionResults,
  }
}
