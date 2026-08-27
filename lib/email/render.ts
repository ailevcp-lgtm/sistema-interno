import type { EmailNotificationData, EmailRecipient } from './types'

// Colores AILE (del theme CSS -- primary: 272 79% 37%)
const COLORS = {
  primary: '#6314A9',         // hsl(272, 79%, 37%) — violeta oficial AILE
  primaryDark: '#4e0f87',
  primaryLight: '#8b3fd4',
  background: '#faf8fc',      // --background
  foreground: '#1e1b2e',      // --foreground
  muted: '#6b7280',           // --muted-foreground
  border: '#e5e1ee',          // --border
  white: '#ffffff',
  success: '#16a34a',
  warning: '#d97706',
  destructive: '#dc2662',     // --destructive
}

function formatPriority(prioridad?: string | number | null): string {
  if (!prioridad) return ''
  const normalized = String(prioridad).trim().toUpperCase()
  const map: Record<string, string> = {
    '1': 'P1',
    P1: 'P1',
    '2': 'P2',
    P2: 'P2',
    '3': 'P3',
    P3: 'P3',
    '4': 'P4',
    P4: 'P4',
  }
  return map[normalized] || String(prioridad)
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const date = d.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const time = d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    return `${date} a las ${time}`
  } catch {
    return dateStr
  }
}

function formatEstado(estado: string): string {
  const map: Record<string, string> = {
    backlog: 'Backlog',
    por_hacer: 'Por hacer',
    pendiente: 'Pendiente',
    en_progreso: 'En progreso',
    en_revision: 'En revisión',
    en_revision_direccion: 'En revisión (Dirección)',
    pendiente_handoff: 'Pendiente handoff',
    pendiente_aprobacion_cd: 'Pendiente aprobación CD',
    observada_cd: 'Observada por CD',
    aprobada_cd: 'Aprobada por CD',
    cerrada: 'Cerrada',
    completada: 'Completada',
  }
  return map[estado] || estado
}

function baseLayout(title: string, content: string, preferencesUrl: string, appUrl = ''): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:${COLORS.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.background};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${COLORS.white};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${COLORS.primary} 0%,${COLORS.primaryDark} 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:${COLORS.white};font-family:'Montserrat',Arial,sans-serif;font-size:42px;font-weight:900;letter-spacing:6px;">AILE</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Sistema Interno</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${COLORS.border};text-align:center;">
              <p style="margin:0;color:${COLORS.muted};font-size:12px;">
                Este email fue enviado automáticamente por el Sistema Interno de AILE.
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

function infoRow(label: string, value: string): string {
  if (!value) return ''
  return `
    <tr>
      <td style="padding:6px 12px;color:${COLORS.muted};font-size:13px;font-weight:600;vertical-align:top;white-space:nowrap;">${label}</td>
      <td style="padding:6px 12px;color:${COLORS.foreground};font-size:13px;">${value}</td>
    </tr>`
}

function detailsTable(rows: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.background};border-radius:8px;margin:16px 0;">
      ${rows}
    </table>`
}

function ctaButton(text: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;">
      <tr>
        <td style="background-color:${COLORS.primary};border-radius:8px;">
          <a href="${url}" style="display:inline-block;padding:12px 28px;color:${COLORS.white};font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`
}

function badge(text: string, color: string): string {
  return `<span style="display:inline-block;padding:3px 10px;background-color:${color}18;color:${color};font-size:12px;font-weight:600;border-radius:6px;border:1px solid ${color}30;">${text}</span>`
}

function renderOverdueTaskList(
  tasks: Array<{
    tarea_titulo: string
    proyecto_nombre: string
    fecha_limite: string
    dias_vencida: number
  }>
): string {
  return tasks
    .map((task) => {
      const overdueLabel = `${task.dias_vencida} día${task.dias_vencida === 1 ? '' : 's'} de atraso`

      return `
        <tr>
          <td style="padding:0 0 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLORS.border};border-radius:10px;background-color:${COLORS.white};">
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0;color:${COLORS.foreground};font-size:14px;font-weight:700;">${task.tarea_titulo}</p>
                  <p style="margin:6px 0 0;color:${COLORS.muted};font-size:13px;">${task.proyecto_nombre}</p>
                  <div style="margin-top:10px;">
                    ${badge(formatDate(task.fecha_limite), COLORS.destructive)}
                    <span style="display:inline-block;width:8px;"></span>
                    ${badge(overdueLabel, COLORS.warning)}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    })
    .join('')
}

export function renderEmailHtml(
  data: EmailNotificationData,
  recipient: EmailRecipient,
  appUrl: string
): string {
  const greeting = `<p style="margin:0 0 4px;color:${COLORS.foreground};font-size:15px;">Hola <strong>${recipient.nombre}</strong>,</p>`
  const tareasUrl = `${appUrl}/tareas`
  const calendarioUrl = `${appUrl}/calendario`
  const reunionesUrl = `${appUrl}/reuniones`
  const documentosUrl = `${appUrl}/documentos`
  const preferencesUrl = `${appUrl}/tareas?preferencias_email=1`

  const layout = (title: string, content: string) => baseLayout(title, content, preferencesUrl, appUrl)

  switch (data.type) {
    case 'tarea_asignada': {
      const rows = [
        infoRow('Tarea', `<strong>${data.tarea_titulo}</strong>`),
        infoRow('Proyecto', data.proyecto_nombre),
        data.prioridad ? infoRow('Prioridad', formatPriority(data.prioridad)) : '',
        data.fecha_limite ? infoRow('Fecha límite', formatDate(data.fecha_limite)) : '',
        data.descripcion ? infoRow('Descripción', data.descripcion) : '',
        infoRow('Asignada por', data.asignado_por_nombre),
      ].join('')

      return layout(
        'Tarea asignada',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          Se te ha asignado una nueva tarea:
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Ver tarea', tareasUrl)}`
      )
    }

    case 'tarea_estado_cambio': {
      const rows = [
        infoRow('Tarea', `<strong>${data.tarea_titulo}</strong>`),
        infoRow('Proyecto', data.proyecto_nombre),
        infoRow('Estado anterior', badge(formatEstado(data.estado_anterior), COLORS.muted)),
        infoRow('Nuevo estado', badge(formatEstado(data.estado_nuevo), COLORS.primary)),
        infoRow('Cambiado por', data.cambiado_por_nombre),
      ].join('')

      return layout(
        'Tarea actualizada',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          El estado de una tarea ha cambiado:
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Ver tarea', tareasUrl)}`,
      )
    }

    case 'tarea_vencimiento_proximo': {
      const urgencyColor = data.dias_restantes === 0 ? COLORS.destructive : COLORS.warning
      const urgencyText = data.dias_restantes === 0
        ? 'vence hoy'
        : `vence en ${data.dias_restantes} día${data.dias_restantes > 1 ? 's' : ''}`

      const rows = [
        infoRow('Tarea', `<strong>${data.tarea_titulo}</strong>`),
        infoRow('Proyecto', data.proyecto_nombre),
        infoRow('Fecha límite', `${badge(formatDate(data.fecha_limite), urgencyColor)}`),
      ].join('')

      return layout(
        'Recordatorio de vencimiento',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          Tienes una tarea que <strong style="color:${urgencyColor};">${urgencyText}</strong>:
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Ver tarea', tareasUrl)}`,
      )
    }

    case 'tareas_vencidas_resumen': {
      const taskLabel = `tarea${data.cantidad_tareas === 1 ? '' : 's'} vencida${data.cantidad_tareas === 1 ? '' : 's'}`
      const taskList = renderOverdueTaskList(data.tareas)

      return layout(
        'Resumen diario de tareas vencidas',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          Tienes <strong style="color:${COLORS.destructive};">${data.cantidad_tareas} ${taskLabel}</strong> pendiente${data.cantidad_tareas === 1 ? '' : 's'} de completar:
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 4px;">
          ${taskList}
        </table>
        ${ctaButton('Revisar tareas', tareasUrl)}`,
      )
    }

    case 'subtarea_creada': {
      const rows = [
        infoRow('Subtarea', `<strong>${data.subtarea_titulo}</strong>`),
        infoRow('Tarea padre', data.tarea_titulo),
        infoRow('Proyecto', data.proyecto_nombre),
        infoRow('Creada por', data.creado_por_nombre),
      ].join('')

      return layout(
        'Nueva subtarea',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          Se creó una nueva subtarea en una de tus tareas:
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Ver tarea', tareasUrl)}`,
      )
    }

    case 'handoff_solicitado': {
      const rows = [
        infoRow('Tarea', `<strong>${data.tarea_titulo}</strong>`),
        infoRow('Proyecto', data.proyecto_nombre),
        infoRow('Solicitado por', data.solicitado_por_nombre),
        data.motivo ? infoRow('Motivo', data.motivo) : '',
      ].join('')

      return layout(
        'Handoff solicitado',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          Se te ha solicitado hacerte cargo de una tarea (handoff):
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Ver handoff', tareasUrl)}`,
      )
    }

    case 'handoff_resuelto': {
      const statusColor = data.aceptado ? COLORS.success : COLORS.destructive
      const statusText = data.aceptado ? 'Aceptado' : 'Rechazado'
      const rows = [
        infoRow('Tarea', `<strong>${data.tarea_titulo}</strong>`),
        infoRow('Proyecto', data.proyecto_nombre),
        infoRow('Resultado', badge(statusText, statusColor)),
        infoRow('Resuelto por', data.resuelto_por_nombre),
        data.comentario ? infoRow('Comentario', data.comentario) : '',
      ].join('')

      return layout(
        `Handoff ${statusText.toLowerCase()}`,
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          Un handoff que solicitaste ha sido resuelto:
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Ver tarea', tareasUrl)}`,
      )
    }

    case 'aprobacion_cd_pendiente': {
      const rows = [
        infoRow('Tarea', `<strong>${data.tarea_titulo}</strong>`),
        infoRow('Proyecto', data.proyecto_nombre),
        infoRow('Enviada por', data.enviado_por_nombre),
        data.comentario ? infoRow('Comentario', data.comentario) : '',
      ].join('')

      return layout(
        'Aprobación CD pendiente',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          Una tarea requiere tu revisión y aprobación en Comisión Directiva:
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Revisar tarea', tareasUrl)}`,
      )
    }

    case 'aprobacion_cd_resuelta': {
      const decisionMap: Record<string, { text: string; color: string }> = {
        aprobada: { text: 'Aprobada', color: COLORS.success },
        observada: { text: 'Observada', color: COLORS.warning },
        rechazada: { text: 'Rechazada', color: COLORS.destructive },
      }
      const decision = decisionMap[data.decision] || { text: data.decision, color: COLORS.muted }

      const rows = [
        infoRow('Tarea', `<strong>${data.tarea_titulo}</strong>`),
        infoRow('Proyecto', data.proyecto_nombre),
        infoRow('Decisión', badge(decision.text, decision.color)),
        infoRow('Resuelto por', data.resuelto_por_nombre),
        data.observacion ? infoRow('Observación', data.observacion) : '',
      ].join('')

      return layout(
        `Tarea ${decision.text.toLowerCase()} por CD`,
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          La Comisión Directiva ha resuelto sobre una tarea que enviaste:
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Ver tarea', tareasUrl)}`,
      )
    }

    // ── Calendario ──────────────────────────────────────

    case 'calendario_reunion_nueva': {
      const alcanceLabel: Record<string, string> = {
        personalizada: 'Personalizada',
        comision_directiva: 'Comisión Directiva',
        general: 'General',
      }

      const rows = [
        infoRow('Reunión', `<strong>${data.reunion_titulo}</strong>`),
        infoRow('Fecha', formatDateTime(data.reunion_fecha)),
        infoRow('Finaliza', formatDateTime(data.reunion_fecha_fin)),
        data.reunion_lugar ? infoRow('Lugar', data.reunion_lugar) : '',
        infoRow('Alcance', badge(alcanceLabel[data.reunion_alcance] || data.reunion_alcance, COLORS.primary)),
        data.participacion ? infoRow('Tu rol', data.participacion === 'involucrado' ? 'Involucrado/a' : 'Invitado/a') : '',
        infoRow('Agendada por', data.creado_por_nombre),
      ].join('')

      return layout(
        'Nueva reunión agendada',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          Se ha agendado una nueva reunión en la que participas:
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Ver calendario', calendarioUrl)}`,
      )
    }

    case 'calendario_reunion_modificada': {
      const rows = [
        infoRow('Reunión', `<strong>${data.reunion_titulo}</strong>`),
        infoRow('Nueva fecha', formatDateTime(data.reunion_fecha)),
        infoRow('Finaliza', formatDateTime(data.reunion_fecha_fin)),
        data.reunion_lugar ? infoRow('Lugar', data.reunion_lugar) : '',
        infoRow('Modificada por', data.modificado_por_nombre),
      ].join('')

      return layout(
        'Reunión modificada',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          Una reunión en la que participas ha sido modificada:
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Ver calendario', calendarioUrl)}`,
      )
    }

    case 'calendario_reunion_cancelada': {
      const rows = [
        infoRow('Reunión', `<strong>${data.reunion_titulo}</strong>`),
        infoRow('Fecha original', formatDateTime(data.reunion_fecha)),
        infoRow('Cancelada por', data.cancelado_por_nombre),
      ].join('')

      return layout(
        'Reunión cancelada',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          Una reunión ha sido <strong style="color:${COLORS.destructive};">cancelada</strong>:
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Ver calendario', calendarioUrl)}`,
      )
    }

    case 'calendario_planificacion_definitiva': {
      const rows = [
        infoRow('Evento', `<strong>${data.planificacion_titulo}</strong>`),
        infoRow('Desde', formatDate(data.planificacion_fecha_inicio)),
        infoRow('Hasta', formatDate(data.planificacion_fecha_fin)),
        data.planificacion_descripcion ? infoRow('Descripción', data.planificacion_descripcion) : '',
        infoRow('Estado', badge('Definitivo', COLORS.success)),
        infoRow('Confirmado por', data.definido_por_nombre),
      ].join('')

      return layout(
        'Fecha de planificación confirmada',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          Una fecha de planificación ha sido confirmada como <strong style="color:${COLORS.success};">definitiva</strong>:
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Ver calendario', calendarioUrl)}`,
      )
    }

    case 'reunion_asistencia_pendiente_recordatorio': {
      const pendienteLabel =
        data.dias_pendiente === 0
          ? 'Pendiente desde hoy'
          : `Pendiente hace ${data.dias_pendiente} día${data.dias_pendiente === 1 ? '' : 's'}`

      const rows = [
        infoRow('Reunión', `<strong>${data.reunion_titulo}</strong>`),
        infoRow('Dirección', data.reunion_direccion),
        infoRow('Fecha', formatDateTime(data.reunion_fecha)),
        infoRow('Finaliza', formatDateTime(data.reunion_fecha_fin)),
        data.reunion_lugar ? infoRow('Lugar', data.reunion_lugar) : '',
        infoRow('Estado', badge(pendienteLabel, COLORS.warning)),
      ].join('')

      return layout(
        'Asistencia pendiente por registrar',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          La asistencia de una reunión que creaste todavía no fue registrada. Te lo recordamos para que puedas cargarla desde el módulo de Reuniones.
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Registrar asistencia', reunionesUrl)}`,
      )
    }

    // ── Resoluciones y Decretos ─────────────────────────

    case 'resolucion_nueva': {
      const rows = [
        infoRow('Resolución', `<strong>${data.resolucion_titulo}</strong>`),
        infoRow('Número', `Res. ${data.resolucion_numero}/${data.resolucion_anio}`),
        infoRow('Fecha', formatDate(data.resolucion_fecha)),
        infoRow('Publicada por', data.creado_por_nombre),
      ].join('')

      return layout(
        'Nueva resolución de Comisión Directiva',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          La Comisión Directiva ha publicado una nueva resolución:
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Ver resolución', documentosUrl)}`,
      )
    }

    case 'decreto_nuevo': {
      const rows = [
        infoRow('Decreto', `<strong>${data.decreto_titulo}</strong>`),
        infoRow('Número', `Dec. ${data.decreto_numero}/${data.decreto_anio}`),
        infoRow('Fecha', formatDate(data.decreto_fecha)),
        infoRow('Publicado por', data.creado_por_nombre),
      ].join('')

      return layout(
        'Nuevo decreto publicado',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          Se ha publicado un nuevo decreto:
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Ver decreto', documentosUrl)}`,
      )
    }

    case 'balance_nuevo': {
      const rows = [
        infoRow('Balance', `<strong>${data.balance_periodo}</strong>`),
        infoRow('Publicado el', formatDate(data.balance_fecha_publicacion)),
        infoRow('Publicado por', data.creado_por_nombre),
      ].join('')

      return layout(
        'Nuevo balance institucional disponible',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          Se ha publicado un nuevo balance en Documentos:
        </p>
        ${detailsTable(rows)}
        ${ctaButton('Ver balance', documentosUrl)}`,
      )
    }

    case 'admision_asociado_resuelta': {
      const accepted = data.decision === 'admitida'
      const rows = [
        infoRow('Decisión', accepted ? '<strong>Admisión aprobada</strong>' : '<strong>Solicitud rechazada</strong>'),
        ...(accepted && data.categoria ? [infoRow('Categoría', data.categoria === 'pleno' ? 'Socio/a Pleno/a' : 'Socio/a Adherente')] : []),
        infoRow('Resolución', `Res. CD N.º ${data.resolucion_numero}/${data.resolucion_anio}`),
        infoRow('Fecha', formatDate(data.resolucion_fecha)),
      ].join('')

      return layout(
        accepted ? 'Admisión como persona asociada' : 'Resolución de solicitud de admisión',
        `${greeting}
        <p style="margin:12px 0 0;color:${COLORS.foreground};font-size:14px;">
          ${accepted
            ? 'La Comisión Directiva de la ASOCIACIÓN CIVIL AILE resolvió admitir tu solicitud. Tu antigüedad se computa desde la fecha indicada.'
            : 'La Comisión Directiva de la ASOCIACIÓN CIVIL AILE resolvió tu solicitud de admisión con resultado negativo.'}
        </p>
        ${detailsTable(rows)}
        <p style="margin:16px 0 0;color:${COLORS.muted};font-size:13px;">Se adjunta el PDF de la resolución que documenta lo resuelto.</p>`,
      )
    }
  }
}
