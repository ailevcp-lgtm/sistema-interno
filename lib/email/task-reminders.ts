import { createClient } from '@supabase/supabase-js'
import { sendEmailNotification, getSubjectForNotification } from './send-notification'
import type { EmailRecipient, TareaVencimientoData } from './types'

const DEFAULT_REMINDER_DAYS = 2
const MAX_REMINDER_LOOKAHEAD_DAYS = 14
const REMINDER_TIMEZONE = process.env.APP_TIMEZONE || 'America/Argentina/Cordoba'
const DEDUPE_LOOKBACK_HOURS = 36

interface TaskRow {
  id: string
  titulo: string
  estado: string
  fecha_vencimiento: string
  asignado_socio_id: string
  proyecto_id: string
}

interface ProjectRow {
  id: string
  nombre: string
}

interface SocioRow {
  id: string
  nombre: string
  apellido: string
  email: string | null
}

interface PreferenceRow {
  socio_id: string
  dias_antelacion_recordatorio: number | null
}

interface EmailLogRow {
  socio_id: string | null
  subject: string
  estado: string
}

interface PlannedReminder {
  recipient: EmailRecipient
  data: TareaVencimientoData
  subject: string
  daysRemaining: number
}

export interface DueTaskReminderRunOptions {
  dryRun?: boolean
}

export interface DueTaskReminderRunResult {
  dryRun: boolean
  timezone: string
  date: string
  tasksEvaluated: number
  remindersMatched: number
  alreadySent: number
  sent: number
  skipped: number
  errors: number
  daysByReminder: Record<string, number>
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltan variables de entorno de Supabase para el job de recordatorios')
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

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function getDaysRemaining(today: string, dueDate: string): number {
  const todayUtc = new Date(`${today}T00:00:00Z`).getTime()
  const dueUtc = new Date(`${dueDate}T00:00:00Z`).getTime()
  return Math.round((dueUtc - todayUtc) / 86_400_000)
}

function clampReminderDays(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_REMINDER_DAYS
  }

  return Math.max(0, Math.min(MAX_REMINDER_LOOKAHEAD_DAYS, Math.trunc(value)))
}

function shouldSendReminder(daysRemaining: number, reminderDays: number): boolean {
  if (daysRemaining < 0 || daysRemaining > MAX_REMINDER_LOOKAHEAD_DAYS) {
    return false
  }

  if (daysRemaining === 0) {
    return true
  }

  return daysRemaining === reminderDays
}

export async function runDueTaskReminderEmails(
  options: DueTaskReminderRunOptions = {}
): Promise<DueTaskReminderRunResult> {
  const dryRun = options.dryRun === true
  const supabase = getServiceSupabase()
  const now = new Date()
  const today = getDateStringInTimeZone(now, REMINDER_TIMEZONE)
  const maxDate = addDays(today, MAX_REMINDER_LOOKAHEAD_DAYS)

  const { data: tasksData, error: tasksError } = await supabase
    .from('tareas')
    .select('id, titulo, estado, fecha_vencimiento, asignado_socio_id, proyecto_id')
    .not('asignado_socio_id', 'is', null)
    .not('fecha_vencimiento', 'is', null)
    .neq('estado', 'cerrada')
    .gte('fecha_vencimiento', today)
    .lte('fecha_vencimiento', maxDate)

  if (tasksError) {
    throw new Error(`No se pudieron consultar las tareas con vencimiento: ${tasksError.message}`)
  }

  const tasks = (tasksData || []) as TaskRow[]
  if (tasks.length === 0) {
    return {
      dryRun,
      timezone: REMINDER_TIMEZONE,
      date: today,
      tasksEvaluated: 0,
      remindersMatched: 0,
      alreadySent: 0,
      sent: 0,
      skipped: 0,
      errors: 0,
      daysByReminder: {},
    }
  }

  const projectIds = Array.from(new Set(tasks.map((task) => task.proyecto_id)))
  const socioIds = Array.from(new Set(tasks.map((task) => task.asignado_socio_id)))
  const recentLogCutoff = new Date(Date.now() - DEDUPE_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()

  const [
    { data: projectsData, error: projectsError },
    { data: sociosData, error: sociosError },
    { data: preferencesData, error: preferencesError },
    { data: emailLogData, error: emailLogError },
  ] = await Promise.all([
    supabase
      .from('proyectos_tareas')
      .select('id, nombre')
      .in('id', projectIds),
    supabase
      .from('socios')
      .select('id, nombre, apellido, email')
      .in('id', socioIds)
      .eq('estado', 'activo')
      .not('email', 'is', null),
    supabase
      .from('email_preferences')
      .select('socio_id, dias_antelacion_recordatorio')
      .in('socio_id', socioIds),
    supabase
      .from('email_log')
      .select('socio_id, subject, estado')
      .eq('tipo', 'tarea_vencimiento_proximo')
      .gte('created_at', recentLogCutoff),
  ])

  if (projectsError) {
    throw new Error(`No se pudieron consultar los proyectos de tareas: ${projectsError.message}`)
  }
  if (sociosError) {
    throw new Error(`No se pudieron consultar los destinatarios de tareas: ${sociosError.message}`)
  }
  if (preferencesError) {
    throw new Error(`No se pudieron consultar las preferencias de email: ${preferencesError.message}`)
  }
  if (emailLogError) {
    throw new Error(`No se pudo consultar el historial reciente de emails: ${emailLogError.message}`)
  }

  const projectById = new Map<string, ProjectRow>(
    ((projectsData || []) as ProjectRow[]).map((project) => [project.id, project])
  )
  const socioById = new Map<string, SocioRow>(
    ((sociosData || []) as SocioRow[]).map((socio) => [socio.id, socio])
  )
  const preferenceBySocioId = new Map<string, PreferenceRow>(
    ((preferencesData || []) as PreferenceRow[]).map((preference) => [preference.socio_id, preference])
  )

  const recentlySentKeys = new Set(
    ((emailLogData || []) as EmailLogRow[])
      .filter((row) => row.estado === 'enviado' && row.socio_id)
      .map((row) => `${row.socio_id}::${row.subject}`)
  )

  const plannedReminders: PlannedReminder[] = []
  const daysByReminder: Record<string, number> = {}

  for (const task of tasks) {
    const socio = socioById.get(task.asignado_socio_id)
    if (!socio?.email) {
      continue
    }

    const projectName = projectById.get(task.proyecto_id)?.nombre || 'Proyecto'
    const daysRemaining = getDaysRemaining(today, task.fecha_vencimiento)
    const reminderDays = clampReminderDays(
      preferenceBySocioId.get(task.asignado_socio_id)?.dias_antelacion_recordatorio
    )

    if (!shouldSendReminder(daysRemaining, reminderDays)) {
      continue
    }

    const recipient: EmailRecipient = {
      socio_id: socio.id,
      email: socio.email,
      nombre: socio.nombre,
      apellido: socio.apellido,
    }

    const data: TareaVencimientoData = {
      type: 'tarea_vencimiento_proximo',
      tarea_titulo: task.titulo,
      proyecto_nombre: projectName,
      fecha_limite: task.fecha_vencimiento,
      dias_restantes: daysRemaining,
    }

    plannedReminders.push({
      recipient,
      data,
      subject: getSubjectForNotification(data),
      daysRemaining,
    })
  }

  let alreadySent = 0
  let sent = 0
  let skipped = 0
  let errors = 0

  for (const reminder of plannedReminders) {
    const dedupeKey = `${reminder.recipient.socio_id}::${reminder.subject}`
    if (recentlySentKeys.has(dedupeKey)) {
      alreadySent++
      continue
    }

    daysByReminder[String(reminder.daysRemaining)] =
      (daysByReminder[String(reminder.daysRemaining)] || 0) + 1

    if (dryRun) {
      continue
    }

    const result = await sendEmailNotification(
      'tarea_vencimiento_proximo',
      [reminder.recipient],
      reminder.data
    )

    sent += result.sent
    skipped += result.skipped
    errors += result.errors

    if (result.sent > 0) {
      recentlySentKeys.add(dedupeKey)
    }
  }

  return {
    dryRun,
    timezone: REMINDER_TIMEZONE,
    date: today,
    tasksEvaluated: tasks.length,
    remindersMatched: plannedReminders.length,
    alreadySent,
    sent,
    skipped,
    errors,
    daysByReminder,
  }
}
