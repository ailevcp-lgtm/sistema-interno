import { createClient } from '@supabase/supabase-js'
import { getSubjectForNotification, sendEmailNotification } from './send-notification'
import type {
  EmailRecipient,
  ReunionAsistenciaPendienteRecordatorioData,
} from './types'

const REMINDER_TIMEZONE = process.env.APP_TIMEZONE || 'America/Argentina/Cordoba'
const DEDUPE_LOOKBACK_HOURS = 48
const REMINDER_NOTIFICATION_TITLE = 'Asistencia pendiente por registrar'

interface MeetingCreatorRow {
  id: string
  usuario_id: string | null
  nombre: string
  apellido: string
  email: string | null
  estado: string | null
}

interface MeetingRowRaw {
  id: string
  titulo: string
  direccion: string
  fecha_inicio: string
  fecha_fin: string
  lugar: string | null
  creado_por_socio_id: string | null
  creado_por?: MeetingCreatorRow[] | MeetingCreatorRow | null
}

interface MeetingRow {
  id: string
  titulo: string
  direccion: string
  fecha_inicio: string
  fecha_fin: string
  lugar: string | null
  creado_por_socio_id: string | null
  creado_por?: MeetingCreatorRow | null
}

interface EmailLogRow {
  socio_id: string | null
  subject: string
  estado: string
  created_at: string
}

interface NotificationRow {
  usuario_id: string | null
  link: string | null
}

export interface MeetingAttendanceReminderRunOptions {
  dryRun?: boolean
}

export interface MeetingAttendanceReminderRunResult {
  dryRun: boolean
  timezone: string
  date: string
  meetingsEvaluated: number
  remindersMatched: number
  creatorsWithoutActiveProfile: number
  creatorsWithoutUser: number
  creatorsWithoutEmail: number
  notificationsMatched: number
  notificationsAlreadyActive: number
  notificationsCreated: number
  emailRecipientsMatched: number
  emailAlreadySent: number
  emailSent: number
  emailSkipped: number
  emailErrors: number
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltan variables de entorno de Supabase para el job de recordatorios de asistencia')
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

function getDaysElapsed(fromDate: string, toDate: string): number {
  const fromUtc = new Date(`${fromDate}T00:00:00Z`).getTime()
  const toUtc = new Date(`${toDate}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((toUtc - fromUtc) / 86_400_000))
}

function buildRecipient(creator: MeetingCreatorRow): EmailRecipient {
  return {
    socio_id: creator.id,
    email: creator.email || '',
    nombre: creator.nombre,
    apellido: creator.apellido,
  }
}

function getMeetingReminderLink(meetingId: string) {
  return `/reuniones?reunionId=${meetingId}`
}

function normalizeMeeting(row: MeetingRowRaw): MeetingRow {
  return {
    id: row.id,
    titulo: row.titulo,
    direccion: row.direccion,
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    lugar: row.lugar,
    creado_por_socio_id: row.creado_por_socio_id,
    creado_por: Array.isArray(row.creado_por) ? row.creado_por[0] || null : row.creado_por || null,
  }
}

export async function runMeetingAttendanceReminderJob(
  options: MeetingAttendanceReminderRunOptions = {}
): Promise<MeetingAttendanceReminderRunResult> {
  const dryRun = options.dryRun === true
  const supabase = getServiceSupabase()
  const now = new Date()
  const today = getDateStringInTimeZone(now, REMINDER_TIMEZONE)

  const { data: meetingsData, error: meetingsError } = await supabase
    .from('reuniones_direccion')
    .select(`
      id,
      titulo,
      direccion,
      fecha_inicio,
      fecha_fin,
      lugar,
      creado_por_socio_id,
      creado_por:socios!reuniones_direccion_creado_por_socio_id_fkey(
        id,
        usuario_id,
        nombre,
        apellido,
        email,
        estado
      )
    `)
    .eq('estado', 'programada')
    .eq('asistencia_registrada', false)
    .lt('fecha_fin', now.toISOString())
    .not('creado_por_socio_id', 'is', null)
    .order('fecha_fin', { ascending: true })

  if (meetingsError) {
    throw new Error(`No se pudieron consultar las reuniones con asistencia pendiente: ${meetingsError.message}`)
  }

  const meetings = ((meetingsData || []) as MeetingRowRaw[]).map(normalizeMeeting)
  if (meetings.length === 0) {
    return {
      dryRun,
      timezone: REMINDER_TIMEZONE,
      date: today,
      meetingsEvaluated: 0,
      remindersMatched: 0,
      creatorsWithoutActiveProfile: 0,
      creatorsWithoutUser: 0,
      creatorsWithoutEmail: 0,
      notificationsMatched: 0,
      notificationsAlreadyActive: 0,
      notificationsCreated: 0,
      emailRecipientsMatched: 0,
      emailAlreadySent: 0,
      emailSent: 0,
      emailSkipped: 0,
      emailErrors: 0,
    }
  }

  const recentLogCutoff = new Date(Date.now() - DEDUPE_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()
  const creatorSocioIds = Array.from(
    new Set(
      meetings
        .map((meeting) => meeting.creado_por?.id || null)
        .filter((value): value is string => Boolean(value))
    )
  )
  const creatorUserIds = Array.from(
    new Set(
      meetings
        .map((meeting) => meeting.creado_por?.usuario_id || null)
        .filter((value): value is string => Boolean(value))
    )
  )

  const emailLogPromise = creatorSocioIds.length
    ? supabase
        .from('email_log')
        .select('socio_id, subject, estado, created_at')
        .eq('tipo', 'reunion_asistencia_pendiente_recordatorio')
        .in('socio_id', creatorSocioIds)
        .gte('created_at', recentLogCutoff)
    : Promise.resolve({ data: [], error: null })

  const notificationPromise = creatorUserIds.length
    ? supabase
        .from('notificaciones')
        .select('usuario_id, link')
        .eq('titulo', REMINDER_NOTIFICATION_TITLE)
        .eq('leida', false)
        .in('usuario_id', creatorUserIds)
    : Promise.resolve({ data: [], error: null })

  const [
    { data: emailLogData, error: emailLogError },
    { data: notificationData, error: notificationError },
  ] = await Promise.all([emailLogPromise, notificationPromise])

  if (emailLogError) {
    throw new Error(`No se pudo consultar el historial reciente de emails: ${emailLogError.message}`)
  }
  if (notificationError) {
    throw new Error(`No se pudo consultar las notificaciones activas: ${notificationError.message}`)
  }

  const emailSentTodayKeys = new Set(
    ((emailLogData || []) as EmailLogRow[])
      .filter((row) => row.estado === 'enviado' && row.socio_id)
      .filter((row) => getDateStringInTimeZone(new Date(row.created_at), REMINDER_TIMEZONE) === today)
      .map((row) => `${row.socio_id}::${row.subject}`)
  )

  const activeNotificationKeys = new Set(
    ((notificationData || []) as NotificationRow[])
      .filter((row) => row.usuario_id && row.link)
      .map((row) => `${row.usuario_id}::${row.link}`)
  )

  let remindersMatched = 0
  let creatorsWithoutActiveProfile = 0
  let creatorsWithoutUser = 0
  let creatorsWithoutEmail = 0
  let notificationsMatched = 0
  let notificationsAlreadyActive = 0
  let notificationsCreated = 0
  let emailRecipientsMatched = 0
  let emailAlreadySent = 0
  let emailSent = 0
  let emailSkipped = 0
  let emailErrors = 0

  for (const meeting of meetings) {
    const creator = meeting.creado_por
    if (!creator || creator.estado !== 'activo') {
      creatorsWithoutActiveProfile++
      continue
    }

    remindersMatched++

    const meetingDate = getDateStringInTimeZone(new Date(meeting.fecha_fin), REMINDER_TIMEZONE)
    const daysPending = getDaysElapsed(meetingDate, today)
    const notificationLink = getMeetingReminderLink(meeting.id)

    if (!creator.usuario_id) {
      creatorsWithoutUser++
    } else {
      notificationsMatched++

      const notificationKey = `${creator.usuario_id}::${notificationLink}`
      if (activeNotificationKeys.has(notificationKey)) {
        notificationsAlreadyActive++
      } else if (!dryRun) {
        const { error: notificationInsertError } = await supabase.from('notificaciones').insert({
          usuario_id: creator.usuario_id,
          titulo: REMINDER_NOTIFICATION_TITLE,
          mensaje: `La reunión "${meeting.titulo}" sigue con la asistencia pendiente. Registrala desde el módulo de Reuniones.`,
          tipo: 'alerta',
          link: notificationLink,
        })

        if (notificationInsertError) {
          throw new Error(`No se pudo crear la notificación de asistencia pendiente: ${notificationInsertError.message}`)
        }

        activeNotificationKeys.add(notificationKey)
        notificationsCreated++
      }
    }

    if (!creator.email) {
      creatorsWithoutEmail++
      continue
    }

    const recipient = buildRecipient(creator)
    const data: ReunionAsistenciaPendienteRecordatorioData = {
      type: 'reunion_asistencia_pendiente_recordatorio',
      reunion_titulo: meeting.titulo,
      reunion_fecha: meeting.fecha_inicio,
      reunion_fecha_fin: meeting.fecha_fin,
      reunion_lugar: meeting.lugar,
      reunion_direccion: meeting.direccion,
      dias_pendiente: daysPending,
    }
    const subject = getSubjectForNotification(data)
    const emailKey = `${recipient.socio_id}::${subject}`

    if (emailSentTodayKeys.has(emailKey)) {
      emailAlreadySent++
      continue
    }

    emailRecipientsMatched++
    if (dryRun) {
      continue
    }

    const result = await sendEmailNotification(
      'reunion_asistencia_pendiente_recordatorio',
      [recipient],
      data
    )

    emailSent += result.sent
    emailSkipped += result.skipped
    emailErrors += result.errors

    if (result.sent > 0) {
      emailSentTodayKeys.add(emailKey)
    }
  }

  return {
    dryRun,
    timezone: REMINDER_TIMEZONE,
    date: today,
    meetingsEvaluated: meetings.length,
    remindersMatched,
    creatorsWithoutActiveProfile,
    creatorsWithoutUser,
    creatorsWithoutEmail,
    notificationsMatched,
    notificationsAlreadyActive,
    notificationsCreated,
    emailRecipientsMatched,
    emailAlreadySent,
    emailSent,
    emailSkipped,
    emailErrors,
  }
}
