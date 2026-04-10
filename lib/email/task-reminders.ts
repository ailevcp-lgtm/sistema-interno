import { createClient } from '@supabase/supabase-js'
import { sendEmailNotification, getSubjectForNotification } from './send-notification'
import type {
  EmailRecipient,
  TareaVencimientoData,
  TareasVencidasResumenData,
  TareasVencidasResumenItemData,
} from './types'

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
  subject?: string | null
  estado: string
}

interface PlannedReminder {
  recipient: EmailRecipient
  data: TareaVencimientoData
  subject: string
  daysRemaining: number
}

interface PlannedOverdueDigest {
  recipient: EmailRecipient
  data: TareasVencidasResumenData
}

interface TaskContext {
  projectById: Map<string, ProjectRow>
  socioById: Map<string, SocioRow>
  preferenceBySocioId: Map<string, PreferenceRow>
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

export interface OverdueTaskDigestRunResult {
  dryRun: boolean
  timezone: string
  date: string
  tasksEvaluated: number
  tasksIncluded: number
  recipientsMatched: number
  alreadySent: number
  sent: number
  skipped: number
  errors: number
}

export interface TaskReminderEmailJobsResult {
  dueReminders: DueTaskReminderRunResult
  overdueDigests: OverdueTaskDigestRunResult
}

type ServiceSupabase = ReturnType<typeof getServiceSupabase>

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

function buildRecipient(socio: SocioRow): EmailRecipient {
  return {
    socio_id: socio.id,
    email: socio.email || '',
    nombre: socio.nombre,
    apellido: socio.apellido,
  }
}

async function loadTaskContext(
  supabase: ServiceSupabase,
  tasks: TaskRow[],
  options: { includePreferences?: boolean } = {}
): Promise<TaskContext> {
  if (tasks.length === 0) {
    return {
      projectById: new Map(),
      socioById: new Map(),
      preferenceBySocioId: new Map(),
    }
  }

  const projectIds = Array.from(new Set(tasks.map((task) => task.proyecto_id)))
  const socioIds = Array.from(new Set(tasks.map((task) => task.asignado_socio_id)))

  const [
    { data: projectsData, error: projectsError },
    { data: sociosData, error: sociosError },
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
  ])

  if (projectsError) {
    throw new Error(`No se pudieron consultar los proyectos de tareas: ${projectsError.message}`)
  }
  if (sociosError) {
    throw new Error(`No se pudieron consultar los destinatarios de tareas: ${sociosError.message}`)
  }

  let preferencesData: PreferenceRow[] = []

  if (options.includePreferences) {
    const { data, error } = await supabase
      .from('email_preferences')
      .select('socio_id, dias_antelacion_recordatorio')
      .in('socio_id', socioIds)

    if (error) {
      throw new Error(`No se pudieron consultar las preferencias de email: ${error.message}`)
    }

    preferencesData = (data || []) as PreferenceRow[]
  }

  return {
    projectById: new Map<string, ProjectRow>(
      ((projectsData || []) as ProjectRow[]).map((project) => [project.id, project])
    ),
    socioById: new Map<string, SocioRow>(
      ((sociosData || []) as SocioRow[]).map((socio) => [socio.id, socio])
    ),
    preferenceBySocioId: new Map<string, PreferenceRow>(
      preferencesData.map((preference) => [preference.socio_id, preference])
    ),
  }
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

  const recentLogCutoff = new Date(Date.now() - DEDUPE_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()
  const [{ data: emailLogData, error: emailLogError }, context] = await Promise.all([
    supabase
      .from('email_log')
      .select('socio_id, subject, estado')
      .eq('tipo', 'tarea_vencimiento_proximo')
      .gte('created_at', recentLogCutoff),
    loadTaskContext(supabase, tasks, { includePreferences: true }),
  ])

  if (emailLogError) {
    throw new Error(`No se pudo consultar el historial reciente de emails: ${emailLogError.message}`)
  }

  const recentlySentKeys = new Set(
    ((emailLogData || []) as EmailLogRow[])
      .filter((row) => row.estado === 'enviado' && row.socio_id && row.subject)
      .map((row) => `${row.socio_id}::${row.subject}`)
  )

  const plannedReminders: PlannedReminder[] = []
  const daysByReminder: Record<string, number> = {}

  for (const task of tasks) {
    const socio = context.socioById.get(task.asignado_socio_id)
    if (!socio?.email) {
      continue
    }

    const projectName = context.projectById.get(task.proyecto_id)?.nombre || 'Proyecto'
    const daysRemaining = getDaysRemaining(today, task.fecha_vencimiento)
    const reminderDays = clampReminderDays(
      context.preferenceBySocioId.get(task.asignado_socio_id)?.dias_antelacion_recordatorio
    )

    if (!shouldSendReminder(daysRemaining, reminderDays)) {
      continue
    }

    const recipient = buildRecipient(socio)
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

export async function runOverdueTaskDigestEmails(
  options: DueTaskReminderRunOptions = {}
): Promise<OverdueTaskDigestRunResult> {
  const dryRun = options.dryRun === true
  const supabase = getServiceSupabase()
  const now = new Date()
  const today = getDateStringInTimeZone(now, REMINDER_TIMEZONE)
  const localDayStartUtc = getStartOfDayUtcIso(now, REMINDER_TIMEZONE)

  const { data: tasksData, error: tasksError } = await supabase
    .from('tareas')
    .select('id, titulo, estado, fecha_vencimiento, asignado_socio_id, proyecto_id')
    .not('asignado_socio_id', 'is', null)
    .not('fecha_vencimiento', 'is', null)
    .neq('estado', 'cerrada')
    .lt('fecha_vencimiento', today)
    .order('fecha_vencimiento', { ascending: true })

  if (tasksError) {
    throw new Error(`No se pudieron consultar las tareas vencidas: ${tasksError.message}`)
  }

  const tasks = (tasksData || []) as TaskRow[]
  if (tasks.length === 0) {
    return {
      dryRun,
      timezone: REMINDER_TIMEZONE,
      date: today,
      tasksEvaluated: 0,
      tasksIncluded: 0,
      recipientsMatched: 0,
      alreadySent: 0,
      sent: 0,
      skipped: 0,
      errors: 0,
    }
  }

  const [{ data: emailLogData, error: emailLogError }, context] = await Promise.all([
    supabase
      .from('email_log')
      .select('socio_id, estado')
      .eq('tipo', 'tareas_vencidas_resumen')
      .gte('created_at', localDayStartUtc),
    loadTaskContext(supabase, tasks),
  ])

  if (emailLogError) {
    throw new Error(`No se pudo consultar el historial diario de emails vencidos: ${emailLogError.message}`)
  }

  const alreadySentSocioIds = new Set(
    ((emailLogData || []) as EmailLogRow[])
      .filter((row) => row.estado === 'enviado' && row.socio_id)
      .map((row) => row.socio_id as string)
  )

  const tasksBySocioId = new Map<string, TareasVencidasResumenItemData[]>()

  for (const task of tasks) {
    const socio = context.socioById.get(task.asignado_socio_id)
    if (!socio?.email) {
      continue
    }

    const daysOverdue = Math.abs(getDaysRemaining(today, task.fecha_vencimiento))
    const taskList = tasksBySocioId.get(task.asignado_socio_id) || []

    taskList.push({
      id: task.id,
      tarea_titulo: task.titulo,
      proyecto_nombre: context.projectById.get(task.proyecto_id)?.nombre || 'Proyecto',
      fecha_limite: task.fecha_vencimiento,
      dias_vencida: daysOverdue,
    })

    tasksBySocioId.set(task.asignado_socio_id, taskList)
  }

  const plannedDigests: PlannedOverdueDigest[] = Array.from(tasksBySocioId.entries())
    .map(([socioId, overdueTasks]) => {
      const socio = context.socioById.get(socioId)
      if (!socio?.email) {
        return null
      }

      const sortedTasks = [...overdueTasks].sort((a, b) =>
        a.fecha_limite.localeCompare(b.fecha_limite) || a.tarea_titulo.localeCompare(b.tarea_titulo)
      )

      return {
        recipient: buildRecipient(socio),
        data: {
          type: 'tareas_vencidas_resumen',
          cantidad_tareas: sortedTasks.length,
          tareas: sortedTasks,
        },
      }
    })
    .filter((digest): digest is PlannedOverdueDigest => digest !== null)

  let alreadySent = 0
  let sent = 0
  let skipped = 0
  let errors = 0
  let tasksIncluded = 0

  for (const digest of plannedDigests) {
    if (alreadySentSocioIds.has(digest.recipient.socio_id)) {
      alreadySent++
      continue
    }

    tasksIncluded += digest.data.tareas.length

    if (dryRun) {
      continue
    }

    const result = await sendEmailNotification(
      'tareas_vencidas_resumen',
      [digest.recipient],
      digest.data
    )

    sent += result.sent
    skipped += result.skipped
    errors += result.errors

    if (result.sent > 0) {
      alreadySentSocioIds.add(digest.recipient.socio_id)
    }
  }

  return {
    dryRun,
    timezone: REMINDER_TIMEZONE,
    date: today,
    tasksEvaluated: tasks.length,
    tasksIncluded,
    recipientsMatched: plannedDigests.length,
    alreadySent,
    sent,
    skipped,
    errors,
  }
}

export async function runTaskReminderEmailJobs(
  options: DueTaskReminderRunOptions = {}
): Promise<TaskReminderEmailJobsResult> {
  const dueReminders = await runDueTaskReminderEmails(options)
  const overdueDigests = await runOverdueTaskDigestEmails(options)

  return {
    dueReminders,
    overdueDigests,
  }
}
