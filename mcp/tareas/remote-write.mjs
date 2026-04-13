import { createTasksReadonlyDataSource, tasksReadonlyInternals } from './data.mjs';
import { createAuthenticatedSupabaseClient } from './remote-auth.mjs';

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

function canonicalDirection(value) {
  return tasksReadonlyInternals.directionFromCodeOrName(value) || null;
}

function directionCode(value) {
  const direction = canonicalDirection(value);

  switch (direction) {
    case 'CEA':
      return 'cea';
    case 'Finanzas':
      return 'finanzas';
    case 'Recursos Humanos':
      return 'recursos_humanos';
    case 'Comunicación':
      return 'comunicacion';
    default:
      return null;
  }
}

function buildActorLabel(actor) {
  return actor?.nombre || actor?.email || actor?.socio_id || 'Usuario autenticado';
}

function buildAmbiguousMatches(rows, mapper) {
  return rows.map(mapper).filter(Boolean).slice(0, 5);
}

function buildAssigneePayload(assignee) {
  if (!assignee) return null;

  return {
    socio_id: assignee.id,
    nombre: `${assignee.nombre || ''} ${assignee.apellido || ''}`.trim(),
    email: assignee.email || null,
  };
}

export function createTasksRemoteMutationService({
  supabaseUrl,
  anonKey,
  accessToken,
  authInfo,
}) {
  if (!supabaseUrl || !anonKey || !accessToken || !authInfo?.extra?.actor?.socio_id) {
    throw new Error(
      'No se pudo inicializar el servicio remoto de tareas. Faltan configuración OAuth o contexto del actor autenticado.'
    );
  }

  const supabase = createAuthenticatedSupabaseClient({ supabaseUrl, anonKey, accessToken });
  const readonly = createTasksReadonlyDataSource({ supabaseClient: supabase });
  const actor = {
    socio_id: authInfo.extra.actor.socio_id,
    usuario_id: authInfo.extra.actor.usuario_id || null,
    nombre: authInfo.extra.actor.nombre || '',
    email: authInfo.extra.actor.email || authInfo.extra.userEmail || null,
    rol: authInfo.extra.actor.rol || 'socio',
    rol_aile: authInfo.extra.actor.rol_aile || null,
    direcciones: Array.isArray(authInfo.extra.actor.direcciones) ? authInfo.extra.actor.direcciones : [],
  };

  async function callRpcWithFallback(actionLabel, attempts) {
    let lastError = null;

    for (const attempt of attempts) {
      const { data, error } = await supabase.rpc(attempt.fn, attempt.args);

      if (!error) {
        return data;
      }

      if (String(error.code || '').toUpperCase() === 'PGRST202' || String(error.code || '').toUpperCase() === '42883') {
        lastError = error;
        continue;
      }

      throw new Error(`No se pudo ${actionLabel}: ${error.message}`);
    }

    throw new Error(
      lastError
        ? `No se pudo ${actionLabel}: ${lastError.message}`
        : `No se pudo ${actionLabel}: backend RPC no disponible`
    );
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
        `El nombre de proyecto "${projectName}" es ambiguo. Coincidencias: ${buildAmbiguousMatches(matches, (item) => item.nombre).join(', ')}.`
      );
    }

    return matches[0];
  }

  async function resolveAssignee({ socioId, email, name }) {
    if (socioId) {
      const { data, error } = await supabase
        .from('socios')
        .select('id, usuario_id, nombre, apellido, email, rol, rol_aile, estado')
        .eq('id', socioId)
        .eq('estado', 'activo')
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

    if (!name) {
      return null;
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
      throw new Error(
        `La referencia de persona "${name}" es ambigua. Coincidencias: ${buildAmbiguousMatches(matches, (item) => `${item.nombre || ''} ${item.apellido || ''}`.trim()).join(', ')}.`
      );
    }

    return matches[0];
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

  async function resolveSubtask(subtaskId) {
    const { data, error } = await supabase
      .from('subtareas')
      .select('*')
      .eq('id', subtaskId)
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo leer la subtarea ${subtaskId}: ${error.message}`);
    }

    if (!data) {
      throw new Error(`No existe una subtarea con id ${subtaskId}.`);
    }

    return data;
  }

  async function resolvePendingApproval(taskId) {
    const { data, error } = await supabase
      .from('tareas_aprobaciones_cd')
      .select('id, tarea_id, aprobador_socio_id, estado, created_at')
      .eq('tarea_id', taskId)
      .eq('aprobador_socio_id', actor.socio_id)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo resolver la aprobación pendiente para la tarea ${taskId}: ${error.message}`);
    }

    if (!data?.id) {
      throw new Error('No se encontró una aprobación pendiente de CD para este usuario en esa tarea.');
    }

    return data;
  }

  async function createTask(input) {
    const project = await resolveProject({
      projectId: input.project_id || null,
      projectName: input.project_name || null,
    });

    const assignee = await resolveAssignee({
      socioId: input.assignee_socio_id || null,
      email: input.assignee_email || null,
      name: input.assignee_name || null,
    });

    const payload = {
      proyecto_id: project.id,
      titulo: String(input.title || '').trim(),
      descripcion: typeof input.description === 'string' && input.description.trim()
        ? input.description.trim()
        : null,
      estado: toBackendState(input.state || 'pendiente'),
      prioridad: normalizePriority(input.priority),
      fecha_vencimiento: toDateOnly(input.due_date),
      direccion_responsable: canonicalDirection(input.direction),
      direccion_responsable_codigo: directionCode(input.direction),
      asignado_socio_id: assignee?.id || null,
    };

    if (!payload.titulo) {
      throw new Error('El título de la tarea es obligatorio.');
    }

    const preview = {
      mode: input.dry_run ? 'dry_run' : 'executed',
      operation: 'create_task',
      actor: {
        socio_id: actor.socio_id,
        usuario_id: actor.usuario_id,
        nombre: buildActorLabel(actor),
        email: actor.email,
        rol: actor.rol,
        rol_aile: actor.rol_aile,
      },
      project: {
        id: project.id,
        nombre: project.nombre,
        tipo: project.tipo,
      },
      task: {
        title: payload.titulo,
        description: payload.descripcion,
        state_backend: payload.estado,
        state_kanban: tasksReadonlyInternals.toKanbanState(payload.estado),
        priority: payload.prioridad,
        due_date: payload.fecha_vencimiento,
        direction: payload.direccion_responsable,
        assignee: buildAssigneePayload(assignee),
      },
    };

    if (input.dry_run) {
      return preview;
    }

    const rpcResult = await callRpcWithFallback('crear tarea', [
      { fn: 'rpc_tasks_create_task', args: { p_payload: payload } },
      { fn: 'rpc_tareas_crear_tarea', args: { p_payload: payload } },
    ]);

    const createdTaskId = typeof rpcResult === 'string'
      ? rpcResult
      : rpcResult?.id || rpcResult?.tarea_id || rpcResult?.task_id || null;

    const detail = createdTaskId
      ? await readonly.getTaskDetails(createdTaskId)
      : null;

    return {
      ...preview,
      rpc_result: rpcResult,
      created_task: detail?.structuredContent?.task || null,
      task_details: detail?.structuredContent || null,
    };
  }

  async function createTasksBatch(input) {
    const tasks = Array.isArray(input.tasks) ? input.tasks : [];

    if (tasks.length === 0) {
      throw new Error('Debes enviar al menos una tarea en tasks.');
    }

    const items = [];

    for (const task of tasks) {
      items.push(await createTask({
        ...task,
        project_id: task.project_id || input.project_id || null,
        project_name: task.project_name || input.project_name || null,
        dry_run: Boolean(input.dry_run),
      }));
    }

    return {
      mode: input.dry_run ? 'dry_run' : 'executed',
      operation: 'create_tasks_batch',
      actor: {
        socio_id: actor.socio_id,
        usuario_id: actor.usuario_id,
        nombre: buildActorLabel(actor),
        email: actor.email,
        rol: actor.rol,
        rol_aile: actor.rol_aile,
      },
      total_tasks: items.length,
      items,
    };
  }

  async function assignTask(input) {
    const currentTask = await resolveTask(String(input.task_id || '').trim());
    const assignee = await resolveAssignee({
      socioId: input.assignee_socio_id || null,
      email: input.assignee_email || null,
      name: input.assignee_name || null,
    });

    if (!assignee?.id) {
      throw new Error('Debes indicar un destino de asignación válido.');
    }

    const preview = {
      mode: input.dry_run ? 'dry_run' : 'executed',
      operation: 'assign_task',
      actor: {
        socio_id: actor.socio_id,
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
      new_assignee: buildAssigneePayload(assignee),
      reason: typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim() : null,
    };

    if (input.dry_run) {
      return preview;
    }

    const rpcResult = await callRpcWithFallback('asignar tarea', [
      {
        fn: 'rpc_tasks_assign_task',
        args: {
          p_tarea_id: currentTask.id,
          p_asignado_socio_id: assignee.id,
          p_motivo: preview.reason,
        },
      },
      {
        fn: 'rpc_tareas_asignar_tarea',
        args: {
          p_tarea_id: currentTask.id,
          p_socio_id: assignee.id,
        },
      },
    ]);

    const detail = await readonly.getTaskDetails(currentTask.id);

    return {
      ...preview,
      rpc_result: rpcResult,
      task_details: detail.structuredContent,
    };
  }

  async function updateTask(input) {
    const currentTask = await resolveTask(String(input.task_id || '').trim());
    const rpcPayload = {};
    const changes = {};

    if (Object.prototype.hasOwnProperty.call(input, 'title')) {
      const title = String(input.title || '').trim();
      if (!title) {
        throw new Error('El título no puede quedar vacío.');
      }
      if (title !== currentTask.titulo) {
        rpcPayload.titulo = title;
        changes.title = { before: currentTask.titulo, after: title };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'description')) {
      const description = typeof input.description === 'string' && input.description.trim()
        ? input.description.trim()
        : null;
      if ((currentTask.descripcion || null) !== description) {
        rpcPayload.descripcion = description;
        changes.description = { before: currentTask.descripcion || null, after: description };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'priority')) {
      const priority = normalizePriority(input.priority);
      if (Number(currentTask.prioridad) !== priority) {
        rpcPayload.prioridad = priority;
        changes.priority = { before: currentTask.prioridad, after: priority };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'state')) {
      const state = toBackendState(input.state);
      if (currentTask.estado !== state) {
        rpcPayload.estado = state;
        changes.state = {
          before_backend: currentTask.estado,
          before_kanban: tasksReadonlyInternals.toKanbanState(currentTask.estado),
          after_backend: state,
          after_kanban: tasksReadonlyInternals.toKanbanState(state),
        };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'due_date') || input.clear_due_date === true) {
      const dueDate = input.clear_due_date ? null : toDateOnly(input.due_date);
      if ((currentTask.fecha_vencimiento || null) !== dueDate) {
        rpcPayload.fecha_vencimiento = dueDate;
        changes.due_date = { before: currentTask.fecha_vencimiento || null, after: dueDate };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'direction')) {
      const direction = canonicalDirection(input.direction);
      const directionCodeValue = directionCode(input.direction);
      if ((currentTask.direccion_responsable_id || null) !== direction) {
        rpcPayload.direccion_responsable = direction;
        rpcPayload.direccion_responsable_codigo = directionCodeValue;
        changes.direction = {
          before: currentTask.direccion_responsable_id || null,
          after: direction,
        };
      }
    }

    const preview = {
      mode: input.dry_run ? 'dry_run' : 'executed',
      operation: 'update_task',
      actor: {
        socio_id: actor.socio_id,
        nombre: buildActorLabel(actor),
        email: actor.email,
        rol: actor.rol,
      },
      task: {
        id: currentTask.id,
        titulo: currentTask.titulo,
        proyecto_id: currentTask.proyecto_id,
      },
      changes,
    };

    if (Object.keys(changes).length === 0) {
      const detail = await readonly.getTaskDetails(currentTask.id);
      return {
        ...preview,
        unchanged: true,
        task_details: detail.structuredContent,
      };
    }

    if (input.dry_run) {
      return preview;
    }

    const rpcResult = await callRpcWithFallback('editar tarea', [
      {
        fn: 'rpc_tasks_update_task_editable',
        args: {
          p_tarea_id: currentTask.id,
          p_payload: rpcPayload,
        },
      },
      {
        fn: 'rpc_tareas_actualizar_tarea_asignada',
        args: {
          p_tarea_id: currentTask.id,
          p_payload: rpcPayload,
        },
      },
    ]);

    const detail = await readonly.getTaskDetails(currentTask.id);

    return {
      ...preview,
      unchanged: false,
      rpc_result: rpcResult,
      updated_task: detail.structuredContent.task,
      task_details: detail.structuredContent,
    };
  }

  async function createSubtask(input) {
    const parentTask = await resolveTask(String(input.task_id || '').trim());
    const assignee = await resolveAssignee({
      socioId: input.assignee_socio_id || null,
      email: input.assignee_email || null,
      name: input.assignee_name || null,
    });

    const title = String(input.title || '').trim();

    if (!title) {
      throw new Error('El título de la subtarea es obligatorio.');
    }

    const payload = {
      tarea_id: parentTask.id,
      titulo: title,
      descripcion: typeof input.description === 'string' && input.description.trim()
        ? input.description.trim()
        : null,
      estado: toBackendState(input.state || 'pendiente'),
      asignado_socio_id: assignee?.id || null,
    };

    const preview = {
      mode: input.dry_run ? 'dry_run' : 'executed',
      operation: 'create_subtask',
      actor: {
        socio_id: actor.socio_id,
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
        title: payload.titulo,
        description: payload.descripcion,
        state_backend: payload.estado,
        state_kanban: tasksReadonlyInternals.toKanbanState(payload.estado),
        assignee: buildAssigneePayload(assignee),
      },
    };

    if (input.dry_run) {
      return preview;
    }

    const rpcResult = await callRpcWithFallback('crear subtarea', [
      { fn: 'rpc_tasks_create_subtask', args: { p_payload: payload } },
      { fn: 'rpc_tareas_crear_subtarea', args: { p_payload: payload } },
    ]);

    const detail = await readonly.getTaskDetails(parentTask.id);

    return {
      ...preview,
      rpc_result: rpcResult,
      task_details: detail.structuredContent,
    };
  }

  async function createProject(input) {
    const name = String(input.name || '').trim();

    if (!name) {
      throw new Error('El nombre del proyecto es obligatorio.');
    }

    const payload = {
      nombre: name,
      descripcion: typeof input.description === 'string' && input.description.trim()
        ? input.description.trim()
        : null,
      tipo: input.type,
      direccion: canonicalDirection(input.direction),
      direccion_codigo: directionCode(input.direction),
    };

    const rpcResult = await callRpcWithFallback('crear proyecto', [
      { fn: 'rpc_tasks_create_project', args: { p_payload: payload } },
      { fn: 'rpc_tareas_crear_proyecto', args: { p_payload: payload } },
    ]);

    return {
      operation: 'create_project',
      actor: {
        socio_id: actor.socio_id,
        nombre: buildActorLabel(actor),
        email: actor.email,
        rol: actor.rol,
      },
      project: payload,
      rpc_result: rpcResult,
    };
  }

  async function updateProject(input) {
    const project = await resolveProject({
      projectId: input.project_id || null,
      projectName: input.project_name || null,
    });

    const rpcPayload = {};

    if (Object.prototype.hasOwnProperty.call(input, 'name')) {
      const name = String(input.name || '').trim();
      if (!name) {
        throw new Error('El nombre del proyecto no puede quedar vacío.');
      }
      rpcPayload.nombre = name;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'description')) {
      rpcPayload.descripcion = typeof input.description === 'string' && input.description.trim()
        ? input.description.trim()
        : null;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'type')) {
      rpcPayload.tipo = input.type;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'active')) {
      rpcPayload.activo = input.active;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'order')) {
      rpcPayload.orden_tablero = input.order;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'direction')) {
      rpcPayload.direccion = canonicalDirection(input.direction);
      rpcPayload.direccion_codigo = directionCode(input.direction);
    }

    if (Object.keys(rpcPayload).length === 0) {
      return {
        operation: 'update_project',
        unchanged: true,
        project_before: project,
      };
    }

    const rpcResult = await callRpcWithFallback('editar proyecto', [
      {
        fn: 'rpc_tasks_update_project',
        args: { p_proyecto_id: project.id, p_payload: rpcPayload },
      },
      {
        fn: 'rpc_tareas_actualizar_proyecto',
        args: { p_proyecto_id: project.id, p_payload: rpcPayload },
      },
    ]);

    const updatedProject = await resolveProject({ projectId: project.id });

    return {
      operation: 'update_project',
      actor: {
        socio_id: actor.socio_id,
        nombre: buildActorLabel(actor),
        email: actor.email,
        rol: actor.rol,
      },
      project_before: project,
      project_after: updatedProject,
      rpc_result: rpcResult,
    };
  }

  async function archiveProject(input) {
    const project = await resolveProject({
      projectId: input.project_id || null,
      projectName: input.project_name || null,
    });

    const rpcResult = await callRpcWithFallback('archivar proyecto', [
      { fn: 'rpc_tasks_delete_project', args: { p_proyecto_id: project.id } },
      { fn: 'rpc_tareas_delete_project', args: { p_proyecto_id: project.id } },
      {
        fn: 'rpc_tasks_update_project',
        args: { p_proyecto_id: project.id, p_payload: { activo: false } },
      },
      {
        fn: 'rpc_tareas_actualizar_proyecto',
        args: { p_proyecto_id: project.id, p_payload: { activo: false } },
      },
    ]);

    return {
      operation: 'archive_project',
      actor: {
        socio_id: actor.socio_id,
        nombre: buildActorLabel(actor),
        email: actor.email,
        rol: actor.rol,
      },
      project,
      rpc_result: rpcResult,
    };
  }

  async function handoffTask(input) {
    const task = await resolveTask(String(input.task_id || '').trim());
    const assignee = await resolveAssignee({
      socioId: input.assignee_socio_id || null,
      email: input.assignee_email || null,
      name: input.assignee_name || null,
    });

    if (!assignee?.id) {
      throw new Error('Debes indicar un destino válido para el handoff.');
    }

    const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim() : null;

    const rpcResult = await callRpcWithFallback('realizar handoff', [
      {
        fn: 'rpc_tasks_handoff_task',
        args: {
          p_tarea_id: task.id,
          p_hacia_socio_id: assignee.id,
          p_motivo: note,
        },
      },
      {
        fn: 'rpc_tareas_handoff_tarea',
        args: {
          p_tarea_id: task.id,
          p_hacia_socio_id: assignee.id,
          p_motivo: note,
        },
      },
    ]);

    const detail = await readonly.getTaskDetails(task.id);

    return {
      operation: 'handoff_task',
      actor: {
        socio_id: actor.socio_id,
        nombre: buildActorLabel(actor),
        email: actor.email,
        rol: actor.rol,
      },
      task: {
        id: task.id,
        titulo: task.titulo,
        proyecto_id: task.proyecto_id,
      },
      target_assignee: buildAssigneePayload(assignee),
      note,
      rpc_result: rpcResult,
      task_details: detail.structuredContent,
    };
  }

  async function deleteTask(input) {
    const task = await resolveTask(String(input.task_id || '').trim());

    const rpcResult = await callRpcWithFallback('borrar tarea', [
      { fn: 'rpc_tasks_delete_task', args: { p_tarea_id: task.id } },
      { fn: 'rpc_tareas_delete_task', args: { p_tarea_id: task.id } },
    ]);

    return {
      operation: 'delete_task',
      actor: {
        socio_id: actor.socio_id,
        nombre: buildActorLabel(actor),
        email: actor.email,
        rol: actor.rol,
      },
      deleted_task: {
        id: task.id,
        titulo: task.titulo,
        proyecto_id: task.proyecto_id,
      },
      rpc_result: rpcResult,
    };
  }

  async function updateSubtask(input) {
    const subtask = await resolveSubtask(String(input.subtask_id || '').trim());
    const rpcPayload = {};
    const changes = {};

    if (Object.prototype.hasOwnProperty.call(input, 'title')) {
      const title = String(input.title || '').trim();
      if (!title) {
        throw new Error('El título de la subtarea no puede quedar vacío.');
      }
      if (title !== subtask.titulo) {
        rpcPayload.titulo = title;
        changes.title = { before: subtask.titulo, after: title };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'description')) {
      const description = typeof input.description === 'string' && input.description.trim()
        ? input.description.trim()
        : null;
      if ((subtask.descripcion || null) !== description) {
        rpcPayload.descripcion = description;
        changes.description = { before: subtask.descripcion || null, after: description };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'state')) {
      const state = toBackendState(input.state);
      if (subtask.estado !== state) {
        rpcPayload.estado = state;
        changes.state = {
          before_backend: subtask.estado,
          before_kanban: tasksReadonlyInternals.toKanbanState(subtask.estado),
          after_backend: state,
          after_kanban: tasksReadonlyInternals.toKanbanState(state),
        };
      }
    }

    if (Object.keys(changes).length === 0) {
      return {
        operation: 'update_subtask',
        unchanged: true,
        subtask,
      };
    }

    const rpcResult = await callRpcWithFallback('editar subtarea', [
      {
        fn: 'rpc_tasks_update_subtask_editable',
        args: {
          p_subtarea_id: subtask.id,
          p_payload: rpcPayload,
        },
      },
      {
        fn: 'rpc_tareas_actualizar_subtarea_asignada',
        args: {
          p_subtarea_id: subtask.id,
          p_payload: rpcPayload,
        },
      },
    ]);

    const updatedSubtask = await resolveSubtask(subtask.id);

    return {
      operation: 'update_subtask',
      actor: {
        socio_id: actor.socio_id,
        nombre: buildActorLabel(actor),
        email: actor.email,
        rol: actor.rol,
      },
      changes,
      subtask_before: subtask,
      subtask_after: updatedSubtask,
      rpc_result: rpcResult,
    };
  }

  async function sendTaskToCd(input) {
    const task = await resolveTask(String(input.task_id || '').trim());
    const comment = typeof input.comment === 'string' && input.comment.trim() ? input.comment.trim() : null;

    const rpcResult = await callRpcWithFallback('enviar la tarea a CD', [
      {
        fn: 'rpc_tasks_send_to_cd',
        args: {
          p_tarea_id: task.id,
          p_comentario: comment,
        },
      },
      {
        fn: 'rpc_tareas_send_to_cd',
        args: {
          p_tarea_id: task.id,
          p_comentario: comment,
        },
      },
    ]);

    const detail = await readonly.getTaskDetails(task.id);

    return {
      operation: 'send_task_to_cd',
      actor: {
        socio_id: actor.socio_id,
        nombre: buildActorLabel(actor),
        email: actor.email,
        rol: actor.rol,
      },
      task: {
        id: task.id,
        titulo: task.titulo,
        proyecto_id: task.proyecto_id,
      },
      comment,
      rpc_result: rpcResult,
      task_details: detail.structuredContent,
    };
  }

  async function resolveTaskCd(input) {
    const task = await resolveTask(String(input.task_id || '').trim());
    const approval = await resolvePendingApproval(task.id);
    const approve = input.approve !== false;
    const comment = typeof input.comment === 'string' && input.comment.trim() ? input.comment.trim() : null;

    const rpcResult = await callRpcWithFallback('resolver la aprobación de CD', [
      {
        fn: 'rpc_tasks_cd_resolve',
        args: {
          p_aprobacion_id: approval.id,
          p_aprobar: approve,
          p_comentario: comment,
        },
      },
      {
        fn: 'rpc_tareas_cd_resolve',
        args: {
          p_aprobacion_id: approval.id,
          p_aprobar: approve,
          p_comentario: comment,
        },
      },
    ]);

    const detail = await readonly.getTaskDetails(task.id);

    return {
      operation: 'resolve_task_cd',
      actor: {
        socio_id: actor.socio_id,
        nombre: buildActorLabel(actor),
        email: actor.email,
        rol: actor.rol,
      },
      decision: approve ? 'approve' : 'reject',
      comment,
      approval,
      task: {
        id: task.id,
        titulo: task.titulo,
        proyecto_id: task.proyecto_id,
      },
      rpc_result: rpcResult,
      task_details: detail.structuredContent,
    };
  }

  return {
    async getActorContext() {
      const payload = {
        actor: {
          socio_id: actor.socio_id,
          usuario_id: actor.usuario_id,
          nombre: buildActorLabel(actor),
          email: actor.email,
          rol: actor.rol,
          rol_aile: actor.rol_aile,
          direcciones: actor.direcciones,
        },
        oauth: {
          client_id: authInfo.clientId,
          scopes: authInfo.scopes,
          expires_at: authInfo.expiresAt || null,
        },
      };

      return toStructuredResponse(`Actuando remotamente como ${buildActorLabel(actor)}.`, payload);
    },
    async createTask(input) {
      const payload = await createTask(input);
      const summary = payload.mode === 'dry_run'
        ? `Dry run listo para crear la tarea "${payload.task.title}".`
        : payload.created_task?.titulo
          ? `Tarea "${payload.created_task.titulo}" creada correctamente.`
          : 'Tarea creada correctamente.';
      return toStructuredResponse(summary, payload);
    },
    async createTasksBatch(input) {
      const payload = await createTasksBatch(input);
      const summary = payload.mode === 'dry_run'
        ? `Dry run listo para ${payload.total_tasks} tarea(s).`
        : `${payload.total_tasks} tarea(s) procesada(s) correctamente.`;
      return toStructuredResponse(summary, payload);
    },
    async assignTask(input) {
      const payload = await assignTask(input);
      const summary = payload.mode === 'dry_run'
        ? `Dry run listo para asignar "${payload.task.titulo}".`
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
    async createProject(input) {
      const payload = await createProject(input);
      return toStructuredResponse(`Proyecto "${payload.project.nombre}" procesado correctamente.`, payload);
    },
    async updateProject(input) {
      const payload = await updateProject(input);
      const summary = payload.unchanged
        ? `El proyecto "${payload.project_before.nombre}" no necesitó cambios.`
        : `El proyecto "${payload.project_after.nombre}" fue actualizado correctamente.`;
      return toStructuredResponse(summary, payload);
    },
    async archiveProject(input) {
      const payload = await archiveProject(input);
      return toStructuredResponse(`El proyecto "${payload.project.nombre}" fue archivado correctamente.`, payload);
    },
    async handoffTask(input) {
      const payload = await handoffTask(input);
      return toStructuredResponse(`La tarea "${payload.task.titulo}" fue enviada a handoff correctamente.`, payload);
    },
    async deleteTask(input) {
      const payload = await deleteTask(input);
      return toStructuredResponse(`La tarea "${payload.deleted_task.titulo}" fue eliminada correctamente.`, payload);
    },
    async updateSubtask(input) {
      const payload = await updateSubtask(input);
      const summary = payload.unchanged
        ? `La subtarea "${payload.subtask.titulo}" no necesitó cambios.`
        : `La subtarea "${payload.subtask_after.titulo}" fue actualizada correctamente.`;
      return toStructuredResponse(summary, payload);
    },
    async sendTaskToCd(input) {
      const payload = await sendTaskToCd(input);
      return toStructuredResponse(`La tarea "${payload.task.titulo}" fue enviada a CD correctamente.`, payload);
    },
    async resolveTaskCd(input) {
      const payload = await resolveTaskCd(input);
      const summary = payload.decision === 'approve'
        ? `La tarea "${payload.task.titulo}" fue aprobada en CD.`
        : `La tarea "${payload.task.titulo}" fue rechazada en CD.`;
      return toStructuredResponse(summary, payload);
    },
  };
}
