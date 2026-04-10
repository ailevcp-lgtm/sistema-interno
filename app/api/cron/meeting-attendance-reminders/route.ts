import { NextRequest, NextResponse } from 'next/server'
import { runMeetingAttendanceReminderJob } from '@/lib/email/meeting-attendance-reminders'

export const dynamic = 'force-dynamic'

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = request.headers.get('authorization')

  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`
  }

  if (process.env.NODE_ENV !== 'production') {
    return true
  }

  const userAgent = request.headers.get('user-agent') || ''
  return userAgent.toLowerCase().includes('vercel-cron')
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && !process.env.CRON_SECRET?.trim()) {
    console.error('CRON_SECRET no esta configurado para /api/cron/meeting-attendance-reminders')
    return NextResponse.json(
      { error: 'Cron no configurado' },
      { status: 503 }
    )
  }

  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const dryRun = request.nextUrl.searchParams.get('dry_run') === '1'

  try {
    const result = await runMeetingAttendanceReminderJob({ dryRun })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    console.error('Error ejecutando recordatorios de asistencia:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
