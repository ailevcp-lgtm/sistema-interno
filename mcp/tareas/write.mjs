import { createClient } from '@supabase/supabase-js';
import { createTasksReadonlyDataSource, tasksReadonlyInternals } from './data.mjs';

const CORE_MANAGER_ROLES = new Set(['admin', 'comision_directiva']);

function ensureSupabaseConfig({ supabaseUrl, serviceRoleKey }) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Faltan variables de entorno para mutaciones del MCP de tareas. Se requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
}

function toStructuredResponse(summary, payload) {
  return {
    content: [
      {
        type: 'text',
        text: `${summary}\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
    structuredContent: payload,
  };
}

function normalizeText(value) {
  return tasksReadonlyInternals.normalizeText(value);
}

function toBackendState(rawValue) {
  const normalized = normalizeText(rawValue);

  if (!normalized || normalized === 'pendiente') return 'por_hacer';
  if (normalized === 'en_progreso') return 'en_progreso';
  if (normalized === 'en_revision') return 'en_revision_direccion';
  if (normalized === 'completada') return 'cerrada';

  if (tasksReadonlyInternals.BACKEND_STATES.includes(normalized)) {
    return normalized;
  }

  throw new Error(
    `Estado inválido: ${rawValue}. Valores permitidos: pendiente, en_progreso, en_revision, completada o estados backend.`
  );
}

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value !== 'string') {
    throw new Error('Las fechas deben estar en formato YYYY-MM-DD.');
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`Fecha inválida: ${value}. Usa formato YYYY-MM-DD.`);
  }

  return trimmed;
}

function normalizePriority(value) {
  if (value == null) return 3;
  if (!Number.isFinite(value)) {
    throw new Error('La prioridad debe ser un número entre 1 y 4.');
  }

  const parsed = Math.trunc(value);
  if (parsed < 1 || parsed > 4) {
    throw new Error('La prioridad debe estar entre 1 y 4.');
  }

  return parsed;
}

function buildActorLabel(actor) {
  return `${actor.nombre || ''} ${actor.apellido || ''}`.trim() || actor.email || actor.id;
}

function buildTaskLink(taskId) {
  return `/tareas?task=${taskId}`;
}

function isArchivedProject(project) {
  return project.activo === false || Boolean(project.fecha_cierre);
}

function buildAmbiguousMatches(rows, key = 'nombre') {
  return rows.map((row) => row[key]).filter(Boolean).slice(0, 5);
}

export function createTasksMutationService({
  supabaseUrl,
  serviceRoleKey,
  defaultActorSocioId,
  defaultActorEmail,
}) {
  ensureSupabaseConfig({ supabaseUrl, serviceRoleKey });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const readonly = createTasksReadonlyDataSource({ supabaseUrl, serviceRoleKey });
  let actorCache = null;

  async function queryActorMemberships(actorSocioId) {
    const { data, error } = await supabase
      .from('socios_direcciones')
      .select('socio_id, direccion_id, es_director, activo, fecha_desde, fecha_hasta, direcciones:direccion_id(id, codigo, nombre)')
      .eq('socio_id', actorSocioId)
      .eq('activo', true);

    if (error) {
      throw new Error(`No se pudieron leer las direcciones del actor local: ${error.message}`);
    }

    return Array.isArray(data) ? data : [];
  }

  async function resolveActor() {
    if (actorCache) return actorCache;

    if (!defaultActorSocioId && !defaultActorEmail) {
      throw new Error(
        'No hay actor local configurado. Define AILE_MCP_ACTOR_SOCIO_ID o AILE_MCP_ACTOR_EMAIL en la configuración del servidor MCP.'
      );
    }

    let query = supabase
      .from('socios')
      .select('id, usuario_id, nombre, apellido, email, rol, rol_aile, estado')
      .eq('estado', 'activo')
      .limit(1);

    if (defaultActorSocioId) {
      query = query.eq('id', defaultActorSocioId);
    } else {
      query = query.ilike('email', defaultActorEmail);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`No se pudo resolver el actor local: ${error.message}`);
    }

    if (!data?.id) {
      throw new Error(
        'No se encontró un socio activo para el actor local configurado. Revisa AILE_MCP_ACTOR_SOCIO_ID/AILE_MCP_ACTOR_EMAIL.'
      );
    }

    const memberships = await queryActorMemberships(data.id);

    actorCache = {
      id: data.id,
      usuario_id: data.usuario_id || null,
      nombre: data.nombre || '',
      apellido: data.apellido || '',
      email: data.email || null,
      rol: data.rol || 'socio',
      rol_aile: data.rol_aile || null,
      nombre_completo: `${data.nombre || ''} ${data.apellido || ''}`.trim(),
      direcciones: memberships.map((membership) => ({
        direccion_id: membership.direccion_id,
        direccion: membership.direcciones?.nombre || null,
        codigo: membership.direcciones?.codigo || null,
        es_director: membership.es_director === true,
      })),
    };

    return actorCache;
  }

  async function ensureActorCanManageMutations() {
    const actor = await resolveActor();

    if (!CORE_MANAGER_ROLES.has(actor.rol)) {
      throw new Error(
        `El actor local (${buildActorLabel(actor)}) no tiene rol suficiente para mutaciones generales. Rol actual: ${actor.rol}.`
      );
    }

    return actor;
  }

  async function resolveProject({ projectId, projectName }) {
    if (!projectId && !projectName) {
      throw new Error('Debes indicar project_id o project_name.');
    }

    if (projectId) {
      const { data, error } = await supabase
        .from('proyectos_tareas')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (error) {
        throw new Error(`No se pudo leer el proyecto ${projectId}: ${error.message}`);
      }

      if (!data) {
        throw new Error(`No existe un proyecto con id ${projectId}.`);
      }

      return data;
    }

    const { data, error } = await supabase
      .from('proyectos_tareas')
      .select('*')
      .ilike('nombre', `%${projectName}%`)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (error) {
      throw new Error(`No se pudo buscar el proyecto "${projectName}": ${error.message}`);
    }

    const matches = Array.isArray(data) ? data : [];

    if (matches.length === 0) {
      throw new Error(`No encontré un proyecto que coincida con "${projectName}".`);
    }

    if (matches.length > 1) {
      throw new Error(
        `El nombre de proyecto "${projectName}" es ambiguo. Coincidencias: ${buildAmbiguousMatches(matches).join(', ')}. Usa project_id.`
      );
    }

    return matches[0];
  }

  async function resolveDirectionId(directionRef) {
    if (!directionRef) return null;

    const normalizedRef = normalizeText(directionRef);
    const { data, error } = await supabase
      .from('direcciones')
      .select('id, codigo, nombre, activo')
      .eq('activo', true);

    if (error) {
      throw new Error(`No se pudieron leer las direcciones: ${error.message}`);
    }

    const matches = (Array.isArray(data) ? data : []).filter((direction) => (
      normalizeText(direction.id) === normalizedRef ||
      normalizeText(direction.codigo) === normalizedRef ||
      normalizeText(direction.nombre) === normalizedRef ||
      normalizeText(tasksReadonlyInternals.directionFromCodeOrName(direction.nombre || direction.codigo)) === normalizedRef ||
      normalizeText(tasksReadonlyInternals.directionFromCodeOrName(directionRef)) === normalizeText(direction.nombre) ||
      normalizeText(tasksReadonlyInternals.directionFromCodeOrName(directionRef)) === normalizeText(direction.codigo)
    ));

    if (matches.length === 0) {
      throw new Error(`No encontré una dirección válida para "${directionRef}".`);
    }

    if (matches.length > 1) {
      throw new Error(`La dirección "${directionRef}" es ambigua.`);
    }

    return matches[0].id;
  }

  async function resolveAssignee({ socioId, email, name }) {
    if (!socioId && !email && !name) return null;

    if (socioId) {
      const { data, error } = await supabase
        .from('socios')
        .select('id, usuario_id, nombre, apellido, email, rol, rol_aile, estado')
        .eq('estado', 'activo')
        .eq('id', socioId)
        .maybeSingle();

      if (error) {
        throw new Error(`No se pudo resolver el socio ${socioId}: ${error.message}`);
      }

      if (!data) {
        throw new Error(`No existe un socio activo con id ${socioId}.`);
      }

      return data;
    }

    if (email) {
      const { data, error } = await supabase
        .from('socios')
        .select('id, usuario_id, nombre, apellido, email, rol, rol_aile, estado')
        .eq('estado', 'activo')
        .ilike('email', email)
        .maybeSingle();

      if (error) {
        throw new Error(`No se pudo resolver el socio por email ${email}: ${error.message}`);
      }

      if (!data) {
        throw new Error(`No existe un socio activo con email ${email}.`);
      }

      return data;
    }

    const { data, error } = await supabase
      .from('socios')
      .select('id, usuario_id, nombre, apellido, email, rol, rol_aile, estado')
      .eq('estado', 'activo')
      .limit(100);

    if (error) {
      throw new Error(`No se pudo buscar el socio "${name}": ${error.message}`);
    }

    const matches = (Array.isArray(data) ? data : []).filter((item) => {
      const fullName = `${item.nombre || ''} ${item.apellido || ''}`.trim();
      return (
        tasksReadonlyInternals.matchesSearch(item.nombre, name) ||
        tasksReadonlyInternals.matchesSearch(item.apellido, name) ||
        tasksReadonlyInternals.matchesSearch(fullName, name) ||
        tasksReadonlyInternals.matchesSearch(item.email, name)
      );
    }).slice(0, 5);

    if (matches.length === 0) {
      throw new Error(`No encontré un socio activo que coincida con "${name}".`);
    }

    if (matches.length > 1) {
      const labels = matches
        .map((item) => `${item.nombre || ''} ${item.apellido || ''}`.trim())
        .filter(Boolean)
        .slice(0, 5);
      throw new Error(`La referencia de persona "${name}" es ambigua. Coincidencias: ${labels.join(', ')}.`);
    }

    return matches[0];
  }

  async function getNextOrderInColumn(projectId, backendState) {
    const { data, error } = await supabase
      .from('tareas')
      .select('orden_en_columna')
      .eq('proyecto_id', projectId)
      .eq('estado', backendState)
      .order('orden_en_columna', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`No se pudo calcular el orden de la tarea: ${error.message}`);
    }

    const currentMax = Array.isArray(data) && data.length > 0
      ? Number(data[0].orden_en_columna) || 0
      : -1;

    return currentMax + 1;
  }

  async function appendHistory({
    proyectoId,
    tareaId,
    actorSocioId,
    accion,
    estadoAnterior = null,
    estadoNuevo = null,
    payload = {},
  }) {
    const { error } = await supabase
      .from('tareas_historial')
      .insert({
        proyecto_id: proyectoId || null,
        tarea_id: tareaId || null,
        actor_socio_id: actorSocioId,
        accion,
        estado_anterior: estadoAnterior,
        estado_nuevo: estadoNuevo,
        payload,
      });

    if (error) {
      throw new Error(`No se pudo registrar historial (${accion}): ${error.message}`);
    }
  }

  async function notifySocio(socioId, title, message, link) {
    if (!socioId) return;

    const { data, error } = await supabase
      .from('socios')
      .select('usuario_id')
      .eq('id', socioId)
      .maybeSingle();

    if (error || !data?.usuario_id) {
      return;
    }

    await supabase
      .from('notificaciones')
      .insert({
        usuario_id: data.usuario_id,
        titulo: title,
        mensaje: message,
        tipo: 'info',
        link: link || null,
      });
  }

  async function prepareTaskCreation(input, options = {}) {
    const actor = await ensureActorCanManageMutations();
    const project = await resolveProject({
      projectId: input.project_id || options.defaultProjectId || null,
      projectName: input.project_name || options.defaultProjectName || null,
    });

    if (isArchivedProject(project)) {
      throw new Error(`El proyecto "${project.nombre}" está archivado y no admite nuevas tareas.`);
    }

    const title = String(input.title || '').trim();
    if (!title) {
      throw new Error('El título de la tarea es obligatorio.');
    }

    const assignee = await resolveAssignee({
      socioId: input.assignee_socio_id || null,
      email: input.assignee_email || null,
      name: input.assignee_name || null,
    });

    let directionId = await resolveDirectionId(input.direction || null);
    if (!directionId && project.tipo === 'interno_direccion') {
      directionId = project.direccion_id || null;
    }

    const backendState = toBackendState(input.state || 'pendiente');
    const priority = normalizePriority(input.priority);
    const dueDate = toDateOnly(input.due_date);
    const description = typeof input.description === 'string' && input.description.trim()
      ? input.description.trim()
      : null;
    const orderInColumn = await getNextOrderInColumn(project.id, backendState);

    return {
      actor,
      project,
      assignee,
      taskInsert: {
        proyecto_id: project.id,
        titulo: title,
        descripcion: description,
        estado: backendState,
        prioridad: priority,
        orden_en_columna: orderInColumn,
        asignado_socio_id: assignee?.id || null,
        direccion_responsable_id: directionId,
        creado_por_socio_id: actor.id,
        updated_by_socio_id: actor.id,
        fecha_vencimiento: dueDate,
      },
      preview: {
        actor: {
          socio_id: actor.id,
          nombre: buildActorLabel(actor),
          email: actor.email,
          rol: actor.rol,
        },
        project: {
          id: project.id,
          nombre: project.nombre,
          tipo: project.tipo,
        },
        task: {
          title,
          description,
          state_backend: backendState,
          state_kanban: tasksReadonlyInternals.toKanbanState(backendState),
          priority,
          due_date: dueDate,
          assignee: assignee ? {
            socio_id: assignee.id,
            nombre: `${assignee.nombre || ''} ${assignee.apellido || ''}`.trim(),
            email: assignee.email || null,
          } : null,
          direction_id: directionId,
        },
      },
    };
  }

  async function performCreateTask(prepared) {
    const { data, error } = await supabase
      .from('tareas')
      .insert(prepared.taskInsert)
      .select('id, proyecto_id, titulo, estado, asignado_socio_id')
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo crear la tarea "${prepared.taskInsert.titulo}": ${error.message}`);
    }

    await appendHistory({
      proyectoId: data.proyecto_id,
      tareaId: data.id,
      actorSocioId: prepared.actor.id,
      accion: 'crear_tarea_mcp_local',
      estadoNuevo: data.estado,
      payload: {
        titulo: prepared.taskInsert.titulo,
        prioridad: prepared.taskInsert.prioridad,
        asignado_socio_id: prepared.taskInsert.asignado_socio_id,
        direccion_responsable_id: prepared.taskInsert.direccion_responsable_id,
        origen: 'mcp_local',
      },
    });

    if (prepared.taskInsert.asignado_socio_id) {
      await notifySocio(
        prepared.taskInsert.asignado_socio_id,
        'Nueva tarea asignada',
        `Se te asignó la tarea "${prepared.taskInsert.titulo}".`,
        buildTaskLink(data.id)
      );
    }

    return data.id;
  }

  async function createTask(input) {
    const prepared = await prepareTaskCreation(input);

    if (input.dry_run) {
      return {
        mode: 'dry_run',
        operation: 'create_task',
        ...prepared.preview,
      };
    }

    const taskId = await performCreateTask(prepared);
    const detail = await readonly.getTaskDetails(taskId);

    return {
      mode: 'executed',
      operation: 'create_task',
      actor: prepared.preview.actor,
      created_task: detail.structuredContent.task,
      task_details: detail.structuredContent,
    };
  }

  async function createTasksBatch(input) {
    const tasks = Array.isArray(input.tasks) ? input.tasks : [];
    if (tasks.length === 0) {
      throw new Error('Debes enviar al menos una tarea en tasks.');
    }

    const preparedTasks = [];
    for (const task of tasks) {
      preparedTasks.push(await prepareTaskCreation(task, {
        defaultProjectId: input.project_id || null,
        defaultProjectName: input.project_name || null,
      }));
    }

    if (input.dry_run) {
      return {
        mode: 'dry_run',
        operation: 'create_tasks_batch',
        actor: preparedTasks[0]?.preview.actor || null,
        total_tasks: preparedTasks.length,
        items: preparedTasks.map((prepared) => prepared.preview),
      };
    }

    const createdTaskIds = [];
    for (const prepared of preparedTasks) {
      createdTaskIds.push(await performCreateTask(prepared));
    }

    const createdTasks = [];
    for (const taskId of createdTaskIds) {
      const detail = await readonly.getTaskDetails(taskId);
      createdTasks.push(detail.structuredContent.task);
    }

    return {
      mode: 'executed',
      operation: 'create_tasks_batch',
      actor: preparedTasks[0]?.preview.actor || null,
      total_tasks: createdTaskIds.length,
      created_tasks: createdTasks,
    };
  }

  async function assignTask(input) {
    const actor = await ensureActorCanManageMutations();
    const taskId = String(input.task_id || '').trim();

    if (!taskId) {
      throw new Error('task_id es obligatorio para asignar una tarea.');
    }

    const { data: currentTask, error: taskError } = await supabase
      .from('tareas')
      .select('id, proyecto_id, titulo, estado, asignado_socio_id')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) {
      throw new Error(`No se pudo leer la tarea ${taskId}: ${taskError.message}`);
    }

    if (!currentTask) {
      throw new Error(`No existe una tarea con id ${taskId}.`);
    }

    const assignee = await resolveAssignee({
      socioId: input.assignee_socio_id || null,
      email: input.assignee_email || null,
      name: input.assignee_name || null,
    });

    if (!assignee) {
      throw new Error('Debes indicar un destino de asignación válido.');
    }

    const preview = {
      mode: input.dry_run ? 'dry_run' : 'executed',
      operation: 'assign_task',
      actor: {
        socio_id: actor.id,
        nombre: buildActorLabel(actor),
        email: actor.email,
        rol: actor.rol,
      },
      task: {
        id: currentTask.id,
        titulo: currentTask.titulo,
        proyecto_id: currentTask.proyecto_id,
        estado_backend: currentTask.estado,
      },
      previous_assignee_socio_id: currentTask.asignado_socio_id || null,
      new_assignee: {
        socio_id: assignee.id,
        nombre: `${assignee.nombre || ''} ${assignee.apellido || ''}`.trim(),
        email: assignee.email || null,
      },
      reason: typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim() : null,
    };

    if (input.dry_run) {
      return preview;
    }

    if (currentTask.asignado_socio_id === assignee.id) {
      const detail = await readonly.getTaskDetails(taskId);
      return {
        ...preview,
        unchanged: true,
        task_details: detail.structuredContent,
      };
    }

    const { error: updateError } = await supabase
      .from('tareas')
      .update({
        asignado_socio_id: assignee.id,
        updated_by_socio_id: actor.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (updateError) {
      throw new Error(`No se pudo asignar la tarea ${taskId}: ${updateError.message}`);
    }

    const { error: handoffError } = await supabase
      .from('tareas_handoffs')
      .insert({
        tarea_id: taskId,
        de_socio_id: currentTask.asignado_socio_id || null,
        a_socio_id: assignee.id,
        solicitado_por_socio_id: actor.id,
        resuelto_por_socio_id: actor.id,
        estado: 'aceptado',
        motivo: preview.reason,
        comentario_resolucion: 'Asignación realizada desde MCP local',
        metadata: {
          tipo: 'asignacion_directa_mcp_local',
        },
        resuelto_at: new Date().toISOString(),
      });

    if (handoffError) {
      throw new Error(`La tarea se actualizó, pero falló el registro del handoff: ${handoffError.message}`);
    }

    await appendHistory({
      proyectoId: currentTask.proyecto_id,
      tareaId: taskId,
      actorSocioId: actor.id,
      accion: 'asignar_tarea_mcp_local',
      estadoAnterior: currentTask.estado,
      estadoNuevo: currentTask.estado,
      payload: {
        desde_socio_id: currentTask.asignado_socio_id || null,
        hacia_socio_id: assignee.id,
        motivo: preview.reason,
        origen: 'mcp_local',
      },
    });

    await notifySocio(
      assignee.id,
      'Tarea asignada',
      `Se te asignó la tarea "${currentTask.titulo}".`,
      buildTaskLink(taskId)
    );

    const detail = await readonly.getTaskDetails(taskId);

    return {
      ...preview,
      unchanged: false,
      task_details: detail.structuredContent,
    };
  }

  async function resolveTask(taskId) {
    const { data, error } = await supabase
      .from('tareas')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo leer la tarea ${taskId}: ${error.message}`);
    }

    if (!data) {
      throw new Error(`No existe una tarea con id ${taskId}.`);
    }

    return data;
  }

  async function updateTask(input) {
    const actor = await ensureActorCanManageMutations();
    const taskId = String(input.task_id || '').trim();

    if (!taskId) {
      throw new Error('task_id es obligatorio para actualizar una tarea.');
    }

    const currentTask = await resolveTask(taskId);

    const updates = {};
    const previewChanges = {};

    if (Object.prototype.hasOwnProperty.call(input, 'title')) {
      const title = String(input.title || '').trim();
      if (!title) {
        throw new Error('El título no puede quedar vacío.');
      }
      if (title !== currentTask.titulo) {
        updates.titulo = title;
        previewChanges.title = { before: currentTask.titulo, after: title };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'description')) {
      const description = typeof input.description === 'string' && input.description.trim()
        ? input.description.trim()
        : null;
      if ((currentTask.descripcion || null) !== description) {
        updates.descripcion = description;
        previewChanges.description = { before: currentTask.descripcion || null, after: description };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'priority')) {
      const priority = normalizePriority(input.priority);
      if (Number(currentTask.prioridad) !== priority) {
        updates.prioridad = priority;
        previewChanges.priority = { before: currentTask.prioridad, after: priority };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'state')) {
      const state = toBackendState(input.state);
      if (currentTask.estado !== state) {
        updates.estado = state;
        previewChanges.state = {
          before_backend: currentTask.estado,
          before_kanban: tasksReadonlyInternals.toKanbanState(currentTask.estado),
          after_backend: state,
          after_kanban: tasksReadonlyInternals.toKanbanState(state),
        };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'due_date') || input.clear_due_date === true) {
      const dueDate = input.clear_due_date ? null : toDateOnly(input.due_date);
      const currentDueDate = currentTask.fecha_vencimiento || null;
      if (currentDueDate !== dueDate) {
        updates.fecha_vencimiento = dueDate;
        previewChanges.due_date = { before: currentDueDate, after: dueDate };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'direction')) {
      const directionId = input.direction ? await resolveDirectionId(input.direction) : null;
      if ((currentTask.direccion_responsable_id || null) !== directionId) {
        updates.direccion_responsable_id = directionId;
        previewChanges.direction_id = {
          before: currentTask.direccion_responsable_id || null,
          after: directionId,
        };
      }
    }

    const preview = {
      mode: input.dry_run ? 'dry_run' : 'executed',
      operation: 'update_task',
      actor: {
        socio_id: actor.id,
        nombre: buildActorLabel(actor),
        email: actor.email,
        rol: actor.rol,
      },
      task: {
        id: currentTask.id,
        titulo: currentTask.titulo,
        proyecto_id: currentTask.proyecto_id,
      },
      changes: previewChanges,
    };

    if (Object.keys(previewChanges).length === 0) {
      const detail = await readonly.getTaskDetails(taskId);
      return {
        ...preview,
        unchanged: true,
        task_details: detail.structuredContent,
      };
    }

    if (input.dry_run) {
      return preview;
    }

    updates.updated_by_socio_id = actor.id;
    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('tareas')
      .update(updates)
      .eq('id', taskId);

    if (updateError) {
      throw new Error(`No se pudo actualizar la tarea ${taskId}: ${updateError.message}`);
    }

    await appendHistory({
      proyectoId: currentTask.proyecto_id,
      tareaId: taskId,
      actorSocioId: actor.id,
      accion: 'actualizar_tarea_mcp_local',
      estadoAnterior: currentTask.estado,
      estadoNuevo: updates.estado || currentTask.estado,
      payload: {
        before: {
          titulo: currentTask.titulo,
          descripcion: currentTask.descripcion || null,
          prioridad: currentTask.prioridad,
          estado: currentTask.estado,
          fecha_vencimiento: currentTask.fecha_vencimiento || null,
          direccion_responsable_id: currentTask.direccion_responsable_id || null,
        },
        after: {
          titulo: updates.titulo || currentTask.titulo,
          descripcion: Object.prototype.hasOwnProperty.call(updates, 'descripcion')
            ? updates.descripcion
            : (currentTask.descripcion || null),
          prioridad: updates.prioridad || currentTask.prioridad,
          estado: updates.estado || currentTask.estado,
          fecha_vencimiento: Object.prototype.hasOwnProperty.call(updates, 'fecha_vencimiento')
            ? updates.fecha_vencimiento
            : (currentTask.fecha_vencimiento || null),
          direccion_responsable_id: Object.prototype.hasOwnProperty.call(updates, 'direccion_responsable_id')
            ? updates.direccion_responsable_id
            : (currentTask.direccion_responsable_id || null),
        },
        origen: 'mcp_local',
      },
    });

    const detail = await readonly.getTaskDetails(taskId);

    return {
      ...preview,
      unchanged: false,
      updated_task: detail.structuredContent.task,
      task_details: detail.structuredContent,
    };
  }

  async function createSubtask(input) {
    const actor = await ensureActorCanManageMutations();
    const taskId = String(input.task_id || '').trim();
    if (!taskId) {
      throw new Error('task_id es obligatorio para crear una subtarea.');
    }

    const parentTask = await resolveTask(taskId);
    const title = String(input.title || '').trim();
    if (!title) {
      throw new Error('El título de la subtarea es obligatorio.');
    }

    const assignee = await resolveAssignee({
      socioId: input.assignee_socio_id || null,
      email: input.assignee_email || null,
      name: input.assignee_name || null,
    });

    const state = toBackendState(input.state || 'pendiente');
    const description = typeof input.description === 'string' && input.description.trim()
      ? input.description.trim()
      : null;
    const dueDate = input.clear_due_date ? null : toDateOnly(input.due_date);

    const { data: lastSubtask, error: orderError } = await supabase
      .from('subtareas')
      .select('orden_en_columna')
      .eq('tarea_id', taskId)
      .order('orden_en_columna', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) {
      throw new Error(`No se pudo calcular el orden de la subtarea: ${orderError.message}`);
    }

    const preview = {
      mode: input.dry_run ? 'dry_run' : 'executed',
      operation: 'create_subtask',
      actor: {
        socio_id: actor.id,
        nombre: buildActorLabel(actor),
        email: actor.email,
        rol: actor.rol,
      },
      parent_task: {
        id: parentTask.id,
        titulo: parentTask.titulo,
        proyecto_id: parentTask.proyecto_id,
      },
      subtask: {
        title,
        description,
        state_backend: state,
        state_kanban: tasksReadonlyInternals.toKanbanState(state),
        due_date: dueDate,
        assignee: assignee ? {
          socio_id: assignee.id,
          nombre: `${assignee.nombre || ''} ${assignee.apellido || ''}`.trim(),
          email: assignee.email || null,
        } : null,
      },
    };

    if (input.dry_run) {
      return preview;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('subtareas')
      .insert({
        tarea_id: taskId,
        titulo: title,
        descripcion: description,
        estado: state,
        orden_en_columna: Number(lastSubtask?.orden_en_columna || 0) + 1,
        asignado_socio_id: assignee?.id || null,
        creado_por_socio_id: actor.id,
        updated_by_socio_id: actor.id,
        fecha_vencimiento: dueDate,
      })
      .select('id')
      .maybeSingle();

    if (insertError) {
      throw new Error(`No se pudo crear la subtarea "${title}": ${insertError.message}`);
    }

    await appendHistory({
      proyectoId: parentTask.proyecto_id,
      tareaId: taskId,
      actorSocioId: actor.id,
      accion: 'crear_subtarea_mcp_local',
      estadoNuevo: state,
      payload: {
        subtarea_id: inserted.id,
        titulo: title,
        asignado_socio_id: assignee?.id || null,
        origen: 'mcp_local',
      },
    });

    const detail = await readonly.getTaskDetails(taskId);

    return {
      ...preview,
      created_subtask_id: inserted.id,
      task_details: detail.structuredContent,
    };
  }

  return {
    async getLocalActor() {
      const actor = await resolveActor();
      const payload = {
        actor: {
          socio_id: actor.id,
          usuario_id: actor.usuario_id,
          nombre: buildActorLabel(actor),
          email: actor.email,
          rol: actor.rol,
          rol_aile: actor.rol_aile,
          direcciones: actor.direcciones,
        },
      };

      return toStructuredResponse(`Actuando localmente como ${buildActorLabel(actor)}.`, payload);
    },
    async createTask(input) {
      const payload = await createTask(input);
      const summary = payload.mode === 'dry_run'
        ? `Dry run listo para crear la tarea "${payload.task.title}".`
        : `Tarea "${payload.created_task.titulo}" creada correctamente.`;
      return toStructuredResponse(summary, payload);
    },
    async createTasksBatch(input) {
      const payload = await createTasksBatch(input);
      const summary = payload.mode === 'dry_run'
        ? `Dry run listo para ${payload.total_tasks} tarea(s).`
        : `${payload.total_tasks} tarea(s) creada(s) correctamente.`;
      return toStructuredResponse(summary, payload);
    },
    async assignTask(input) {
      const payload = await assignTask(input);
      const summary = payload.mode === 'dry_run'
        ? `Dry run listo para asignar "${payload.task.titulo}".`
        : payload.unchanged
          ? `La tarea "${payload.task.titulo}" ya estaba asignada a esa persona.`
          : `La tarea "${payload.task.titulo}" fue asignada correctamente.`;
      return toStructuredResponse(summary, payload);
    },
    async updateTask(input) {
      const payload = await updateTask(input);
      const summary = payload.mode === 'dry_run'
        ? `Dry run listo para actualizar "${payload.task.titulo}".`
        : payload.unchanged
          ? `La tarea "${payload.task.titulo}" no necesitó cambios.`
          : `La tarea "${payload.task.titulo}" fue actualizada correctamente.`;
      return toStructuredResponse(summary, payload);
    },
    async createSubtask(input) {
      const payload = await createSubtask(input);
      const summary = payload.mode === 'dry_run'
        ? `Dry run listo para crear una subtarea en "${payload.parent_task.titulo}".`
        : `Subtarea creada correctamente en "${payload.parent_task.titulo}".`;
      return toStructuredResponse(summary, payload);
    },
  };
}
