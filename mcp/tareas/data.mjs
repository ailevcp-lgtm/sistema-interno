import { createClient } from '@supabase/supabase-js';

const BACKEND_STATES = [
  'backlog',
  'por_hacer',
  'en_progreso',
  'en_revision_direccion',
  'pendiente_handoff',
  'pendiente_aprobacion_cd',
  'observada_cd',
  'aprobada_cd',
  'cerrada',
];

const KANBAN_STATE_ORDER = ['pendiente', 'en_progreso', 'en_revision', 'completada'];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function directionFromCodeOrName(rawValue) {
  const normalized = normalizeText(rawValue);

  if (!normalized) return null;
  if (normalized.includes('cea')) return 'CEA';
  if (normalized.includes('finanza')) return 'Finanzas';
  if (normalized.includes('recurso') || normalized.includes('rrhh')) return 'Recursos Humanos';
  if (normalized.includes('comunic')) return 'Comunicación';

  return null;
}

function toKanbanState(backendState) {
  const normalized = normalizeText(backendState);

  if (normalized === 'backlog' || normalized === 'por_hacer') return 'pendiente';
  if (normalized === 'en_progreso') return 'en_progreso';

  if (
    normalized === 'en_revision_direccion' ||
    normalized === 'pendiente_handoff' ||
    normalized === 'pendiente_aprobacion_cd' ||
    normalized === 'observada_cd'
  ) {
    return 'en_revision';
  }

  return 'completada';
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function toDateOnly(value) {
  if (!value || typeof value !== 'string') return null;
  return value.slice(0, 10);
}

function compareNullableStrings(left, right) {
  if (left && right) return left.localeCompare(right, 'es');
  if (left) return -1;
  if (right) return 1;
  return 0;
}

function compareNullableNumbers(left, right) {
  if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
  if (Number.isFinite(left)) return -1;
  if (Number.isFinite(right)) return 1;
  return 0;
}

function compareDatesAsc(left, right) {
  if (left && right) return left.localeCompare(right);
  if (left) return -1;
  if (right) return 1;
  return 0;
}

function buildTokens(value) {
  return normalizeText(value).split(/\s+/).filter(Boolean);
}

function looselyMatchesToken(queryToken, targetToken) {
  if (!queryToken || !targetToken) return false;
  if (targetToken.includes(queryToken)) return true;

  const prefixLength = Math.min(4, queryToken.length, targetToken.length);
  if (prefixLength >= 4 && targetToken.slice(0, prefixLength) === queryToken.slice(0, prefixLength)) {
    return true;
  }

  return false;
}

function matchesSearch(haystack, needle) {
  if (!needle) return true;

  const haystackTokens = buildTokens(haystack);
  const needleTokens = buildTokens(needle);

  if (needleTokens.length === 0) return true;
  if (haystackTokens.length === 0) return false;

  return needleTokens.every((needleToken) => (
    haystackTokens.some((haystackToken) => looselyMatchesToken(needleToken, haystackToken))
  ));
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function dedupeStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function safeCount(value) {
  return Number.isFinite(value) ? value : 0;
}

function clampLimit(value, fallback = 25, max = 100) {
  if (!Number.isFinite(value)) return fallback;
  if (value < 1) return 1;
  if (value > max) return max;
  return Math.trunc(value);
}

function parsePriority(value) {
  if (!Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function isTaskCompleted(task) {
  return toKanbanState(task.estado_backend) === 'completada';
}

function isTaskOverdue(task) {
  const dueDate = toDateOnly(task.fecha_vencimiento);
  if (!dueDate) return false;
  return dueDate < todayDateOnly() && !isTaskCompleted(task);
}

function dueInWindow(task, endDate) {
  const dueDate = toDateOnly(task.fecha_vencimiento);
  if (!dueDate) return false;
  if (isTaskCompleted(task)) return false;
  const today = todayDateOnly();
  return dueDate >= today && dueDate <= endDate;
}

function addDays(dateOnly, days) {
  const base = new Date(`${dateOnly}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function projectIsArchived(project) {
  return project.activo === false || Boolean(project.fecha_cierre);
}

function summarizeDirection(directionId, directionsById) {
  const direction = directionId ? directionsById.get(directionId) : null;
  if (!direction) return null;
  return direction.label;
}

function mapDirectionRow(row) {
  const label = directionFromCodeOrName(row.nombre || row.codigo) || row.nombre || row.codigo;

  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    label,
  };
}

function mapMemberRow(row, membershipsBySocioId, directionsById) {
  const memberships = ensureArray(membershipsBySocioId.get(row.id)).map((membership) => {
    const direction = directionsById.get(membership.direccion_id);
    return {
      direccion_id: membership.direccion_id,
      direccion: direction?.label || null,
      es_director: membership.es_director === true,
      activo: membership.activo !== false,
      fecha_desde: membership.fecha_desde || null,
      fecha_hasta: membership.fecha_hasta || null,
    };
  });

  memberships.sort((left, right) => compareNullableStrings(left.direccion, right.direccion));

  return {
    socio_id: row.id,
    usuario_id: row.usuario_id || null,
    nombre: row.nombre || '',
    apellido: row.apellido || '',
    nombre_completo: `${row.nombre || ''} ${row.apellido || ''}`.trim(),
    email: row.email || null,
    rol: row.rol || 'socio',
    rol_aile: row.rol_aile || null,
    direcciones: memberships,
  };
}

function buildMemberMaps(members) {
  const bySocioId = new Map();

  for (const member of members) {
    bySocioId.set(member.socio_id, member);
  }

  return { bySocioId };
}

function mapProjectRow(row, directionsById, membersBySocioId) {
  const direction = directionsById.get(row.direccion_id);
  const responsibleMember = row.responsable_socio_id
    ? membersBySocioId.get(row.responsable_socio_id) || null
    : null;

  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion || null,
    tipo: row.tipo,
    direccion_id: row.direccion_id,
    direccion: direction?.label || null,
    creado_por_socio_id: row.creado_por_socio_id || null,
    responsable_socio_id: row.responsable_socio_id || null,
    responsable: responsibleMember,
    activo: row.activo !== false,
    fecha_inicio: row.fecha_inicio || null,
    fecha_fin_estimada: row.fecha_fin_estimada || null,
    fecha_cierre: row.fecha_cierre || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archivado: projectIsArchived(row),
  };
}

function mapTaskRow(row, projectsById, directionsById, membersBySocioId, subtaskStatsByTaskId = new Map()) {
  const project = projectsById.get(row.proyecto_id) || null;
  const assignee = row.asignado_socio_id ? membersBySocioId.get(row.asignado_socio_id) || null : null;
  const createdBy = row.creado_por_socio_id ? membersBySocioId.get(row.creado_por_socio_id) || null : null;
  const updatedBy = row.updated_by_socio_id ? membersBySocioId.get(row.updated_by_socio_id) || null : null;
  const taskDirection = summarizeDirection(row.direccion_responsable_id, directionsById) || project?.direccion || null;
  const stats = subtaskStatsByTaskId.get(row.id) || { total: 0, completed: 0 };
  const estado_backend = row.estado;
  const estado_kanban = toKanbanState(row.estado);

  const task = {
    id: row.id,
    proyecto_id: row.proyecto_id,
    proyecto: project,
    titulo: row.titulo,
    descripcion: row.descripcion || null,
    estado_backend,
    estado_kanban,
    prioridad: parsePriority(row.prioridad),
    orden_en_columna: parsePriority(row.orden_en_columna),
    asignado_socio_id: row.asignado_socio_id || null,
    asignado_a: assignee,
    creado_por_socio_id: row.creado_por_socio_id || null,
    creado_por: createdBy,
    updated_by_socio_id: row.updated_by_socio_id || null,
    actualizado_por: updatedBy,
    direccion_responsable_id: row.direccion_responsable_id || null,
    direccion_responsable: taskDirection,
    fecha_vencimiento: toDateOnly(row.fecha_vencimiento),
    fecha_inicio_real: row.fecha_inicio_real || null,
    fecha_cierre: row.fecha_cierre || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    subtask_count: safeCount(stats.total),
    completed_subtask_count: safeCount(stats.completed),
  };

  return {
    ...task,
    vencida: isTaskOverdue(task),
    completada: isTaskCompleted(task),
  };
}

function mapSubtaskRow(row, membersBySocioId) {
  const assignee = row.asignado_socio_id ? membersBySocioId.get(row.asignado_socio_id) || null : null;
  const createdBy = row.creado_por_socio_id ? membersBySocioId.get(row.creado_por_socio_id) || null : null;
  const updatedBy = row.updated_by_socio_id ? membersBySocioId.get(row.updated_by_socio_id) || null : null;

  return {
    id: row.id,
    tarea_id: row.tarea_id,
    titulo: row.titulo,
    descripcion: row.descripcion || null,
    estado_backend: row.estado,
    estado_kanban: toKanbanState(row.estado),
    orden_en_columna: parsePriority(row.orden_en_columna),
    asignado_socio_id: row.asignado_socio_id || null,
    asignado_a: assignee,
    creado_por_socio_id: row.creado_por_socio_id || null,
    creado_por: createdBy,
    updated_by_socio_id: row.updated_by_socio_id || null,
    actualizado_por: updatedBy,
    fecha_vencimiento: toDateOnly(row.fecha_vencimiento),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
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

function buildProjectSummary(projects) {
  if (projects.length === 0) {
    return 'No encontré proyectos que coincidan con los filtros.';
  }

  const activeCount = projects.filter((project) => !project.archivado).length;
  return `Encontré ${projects.length} proyecto(s). ${activeCount} activo(s) y ${projects.length - activeCount} archivado(s).`;
}

function buildTaskSummary(tasks) {
  if (tasks.length === 0) {
    return 'No encontré tareas que coincidan con los filtros.';
  }

  const overdue = tasks.filter((task) => task.vencida).length;
  const open = tasks.filter((task) => !task.completada).length;
  return `Encontré ${tasks.length} tarea(s). ${open} abierta(s) y ${overdue} vencida(s).`;
}

function buildMemberSummary(members) {
  if (members.length === 0) {
    return 'No encontré personas asignables que coincidan con los filtros.';
  }

  const directors = members.filter((member) => member.direcciones.some((item) => item.es_director)).length;
  return `Encontré ${members.length} persona(s) asignable(s). ${directors} tiene(n) rol de dirección en al menos un área.`;
}

function buildDashboardSummary(dashboard) {
  return [
    `Resumen de tareas: ${dashboard.summary.total_tasks} total, ${dashboard.summary.open_tasks} abiertas, ${dashboard.summary.overdue_tasks} vencidas.`,
    `${dashboard.summary.pending_cd_tasks} pendiente(s) de CD y ${dashboard.summary.pending_handoff_tasks} pendiente(s) de handoff.`,
  ].join(' ');
}

function buildWorkloadSummary(workload) {
  return {
    total_tasks: workload.total_tasks,
    open_tasks: workload.open_tasks,
    completed_tasks: workload.completed_tasks,
    overdue_tasks: workload.overdue_tasks,
    total_subtasks: workload.total_subtasks,
    open_subtasks: workload.open_subtasks,
    completed_subtasks: workload.completed_subtasks,
  };
}

function ensureSupabaseConfig({ supabaseUrl, serviceRoleKey, supabaseClient }) {
  if (supabaseClient) {
    return;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Faltan variables de entorno para el MCP de tareas. Se requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
}

export function createTasksReadonlyDataSource({ supabaseUrl, serviceRoleKey, supabaseClient }) {
  ensureSupabaseConfig({ supabaseUrl, serviceRoleKey, supabaseClient });

  const supabase = supabaseClient || createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const cache = new Map();

  async function fromCache(key, ttlMs, loader) {
    const cached = cache.get(key);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const value = await loader();
    cache.set(key, { value, expiresAt: now + ttlMs });
    return value;
  }

  async function queryDirections() {
    return fromCache('directions', 5 * 60 * 1000, async () => {
      const { data, error } = await supabase
        .from('direcciones')
        .select('id, codigo, nombre, activo')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) {
        throw new Error(`No se pudieron leer las direcciones: ${error.message}`);
      }

      return ensureArray(data).map(mapDirectionRow);
    });
  }

  async function queryMembers() {
    return fromCache('members', 60 * 1000, async () => {
      const [directions, sociosResult, membershipsResult] = await Promise.all([
        queryDirections(),
        supabase
          .from('socios')
          .select('id, usuario_id, nombre, apellido, email, rol, rol_aile, estado')
          .eq('estado', 'activo')
          .not('usuario_id', 'is', null)
          .order('apellido', { ascending: true })
          .order('nombre', { ascending: true }),
        supabase
          .from('socios_direcciones')
          .select('socio_id, direccion_id, es_director, activo, fecha_desde, fecha_hasta')
          .eq('activo', true),
      ]);

      if (sociosResult.error) {
        throw new Error(`No se pudieron leer los socios activos: ${sociosResult.error.message}`);
      }

      if (membershipsResult.error) {
        throw new Error(`No se pudieron leer las membresías por dirección: ${membershipsResult.error.message}`);
      }

      const directionsById = new Map(directions.map((direction) => [direction.id, direction]));
      const membershipsBySocioId = new Map();

      for (const membership of ensureArray(membershipsResult.data)) {
        const current = membershipsBySocioId.get(membership.socio_id) || [];
        current.push(membership);
        membershipsBySocioId.set(membership.socio_id, current);
      }

      return ensureArray(sociosResult.data).map((row) => mapMemberRow(row, membershipsBySocioId, directionsById));
    });
  }

  async function queryProjectsByIds(projectIds) {
    const ids = dedupeStrings(projectIds);
    if (ids.length === 0) return [];

    const [directions, members, projectsResult] = await Promise.all([
      queryDirections(),
      queryMembers(),
      supabase
        .from('proyectos_tareas')
        .select('*')
        .in('id', ids),
    ]);

    if (projectsResult.error) {
      throw new Error(`No se pudieron leer los proyectos: ${projectsResult.error.message}`);
    }

    const directionsById = new Map(directions.map((direction) => [direction.id, direction]));
    const { bySocioId: membersBySocioId } = buildMemberMaps(members);

    return ensureArray(projectsResult.data).map((row) => mapProjectRow(row, directionsById, membersBySocioId));
  }

  async function querySubtaskStats(taskIds) {
    const ids = dedupeStrings(taskIds);
    if (ids.length === 0) return new Map();

    const { data, error } = await supabase
      .from('subtareas')
      .select('id, tarea_id, estado')
      .in('tarea_id', ids);

    if (error) {
      throw new Error(`No se pudieron leer las subtareas: ${error.message}`);
    }

    const stats = new Map();

    for (const row of ensureArray(data)) {
      const current = stats.get(row.tarea_id) || { total: 0, completed: 0 };
      current.total += 1;
      if (toKanbanState(row.estado) === 'completada') {
        current.completed += 1;
      }
      stats.set(row.tarea_id, current);
    }

    return stats;
  }

  async function queryWorkloadBySocioIds(socioIds) {
    const ids = dedupeStrings(socioIds);
    const workloadBySocioId = new Map();

    for (const socioId of ids) {
      workloadBySocioId.set(socioId, {
        total_tasks: 0,
        open_tasks: 0,
        completed_tasks: 0,
        overdue_tasks: 0,
        total_subtasks: 0,
        open_subtasks: 0,
        completed_subtasks: 0,
      });
    }

    if (ids.length === 0) return workloadBySocioId;

    const [tasksResult, subtasksResult] = await Promise.all([
      supabase
        .from('tareas')
        .select('id, asignado_socio_id, estado, fecha_vencimiento')
        .in('asignado_socio_id', ids),
      supabase
        .from('subtareas')
        .select('id, asignado_socio_id, estado, fecha_vencimiento')
        .in('asignado_socio_id', ids),
    ]);

    if (tasksResult.error) {
      throw new Error(`No se pudo calcular la carga de tareas: ${tasksResult.error.message}`);
    }

    if (subtasksResult.error) {
      throw new Error(`No se pudo calcular la carga de subtareas: ${subtasksResult.error.message}`);
    }

    for (const task of ensureArray(tasksResult.data)) {
      const current = workloadBySocioId.get(task.asignado_socio_id);
      if (!current) continue;
      current.total_tasks += 1;
      if (toKanbanState(task.estado) === 'completada') {
        current.completed_tasks += 1;
      } else {
        current.open_tasks += 1;
      }
      if (isTaskOverdue({ estado_backend: task.estado, fecha_vencimiento: task.fecha_vencimiento })) {
        current.overdue_tasks += 1;
      }
    }

    for (const subtask of ensureArray(subtasksResult.data)) {
      const current = workloadBySocioId.get(subtask.asignado_socio_id);
      if (!current) continue;
      current.total_subtasks += 1;
      if (toKanbanState(subtask.estado) === 'completada') {
        current.completed_subtasks += 1;
      } else {
        current.open_subtasks += 1;
      }
    }

    return workloadBySocioId;
  }

  async function listTaskProjects(filters = {}) {
    const [directions, members, projectsResult, tasksResult] = await Promise.all([
      queryDirections(),
      queryMembers(),
      supabase.from('proyectos_tareas').select('*'),
      supabase.from('tareas').select('id, proyecto_id, estado, fecha_vencimiento'),
    ]);

    if (projectsResult.error) {
      throw new Error(`No se pudieron leer los proyectos de tareas: ${projectsResult.error.message}`);
    }

    if (tasksResult.error) {
      throw new Error(`No se pudieron leer las tareas para resumir proyectos: ${tasksResult.error.message}`);
    }

    const directionsById = new Map(directions.map((direction) => [direction.id, direction]));
    const { bySocioId: membersBySocioId } = buildMemberMaps(members);
    const rawProjects = ensureArray(projectsResult.data).map((row) => mapProjectRow(row, directionsById, membersBySocioId));

    const tasksByProjectId = new Map();
    for (const row of ensureArray(tasksResult.data)) {
      const current = tasksByProjectId.get(row.proyecto_id) || [];
      current.push({
        estado_backend: row.estado,
        fecha_vencimiento: row.fecha_vencimiento,
      });
      tasksByProjectId.set(row.proyecto_id, current);
    }

    let projects = rawProjects.map((project) => {
      const tasks = tasksByProjectId.get(project.id) || [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((task) => toKanbanState(task.estado_backend) === 'completada').length;
      const openTasks = totalTasks - completedTasks;
      const overdueTasks = tasks.filter((task) => {
        const taskLike = {
          estado_backend: task.estado_backend,
          fecha_vencimiento: task.fecha_vencimiento,
        };
        return isTaskOverdue(taskLike);
      }).length;
      const nextDueDate = tasks
        .map((task) => toDateOnly(task.fecha_vencimiento))
        .filter(Boolean)
        .sort(compareDatesAsc)[0] || null;

      return {
        ...project,
        task_count: totalTasks,
        open_task_count: openTasks,
        completed_task_count: completedTasks,
        overdue_task_count: overdueTasks,
        next_due_date: nextDueDate,
      };
    });

    if (!filters.include_archived) {
      projects = projects.filter((project) => !project.archivado);
    }

    if (filters.type) {
      projects = projects.filter((project) => project.tipo === filters.type);
    }

    if (filters.direction) {
      const directionNeedle = directionFromCodeOrName(filters.direction) || filters.direction;
      projects = projects.filter((project) => normalizeText(project.direccion) === normalizeText(directionNeedle));
    }

    if (filters.search) {
      projects = projects.filter((project) => (
        matchesSearch(project.nombre, filters.search) ||
        matchesSearch(project.descripcion, filters.search) ||
        matchesSearch(project.direccion, filters.search)
      ));
    }

    projects.sort((left, right) => {
      if (left.archivado !== right.archivado) return left.archivado ? 1 : -1;
      const dueComparison = compareDatesAsc(left.next_due_date, right.next_due_date);
      if (dueComparison !== 0) return dueComparison;
      return right.created_at.localeCompare(left.created_at);
    });

    const limit = clampLimit(filters.limit, 25);
    const items = projects.slice(0, limit);

    return {
      meta: {
        total_matches: projects.length,
        returned_items: items.length,
        limit,
        filters: {
          search: filters.search || null,
          type: filters.type || null,
          direction: filters.direction || null,
          include_archived: Boolean(filters.include_archived),
        },
      },
      items,
    };
  }

  async function listTasks(filters = {}) {
    const limit = clampLimit(filters.limit, 50);
    const payload = await listTasksInternal(filters);
    const items = payload.items.slice(0, limit);

    return {
      meta: {
        ...payload.meta,
        returned_items: items.length,
        limit,
      },
      items,
    };
  }

  async function listTasksInternal(filters = {}) {
    const query = supabase
      .from('tareas')
      .select([
        'id',
        'proyecto_id',
        'titulo',
        'descripcion',
        'estado',
        'prioridad',
        'orden_en_columna',
        'asignado_socio_id',
        'creado_por_socio_id',
        'updated_by_socio_id',
        'fecha_vencimiento',
        'fecha_inicio_real',
        'fecha_cierre',
        'created_at',
        'updated_at',
        'direccion_responsable_id',
      ].join(', '));

    if (filters.project_id) {
      query.eq('proyecto_id', filters.project_id);
    }

    if (filters.assignee_socio_id) {
      query.eq('asignado_socio_id', filters.assignee_socio_id);
    }

    const tasksResult = await query;
    if (tasksResult.error) {
      throw new Error(`No se pudieron leer las tareas: ${tasksResult.error.message}`);
    }

    const rawTasks = ensureArray(tasksResult.data);
    const projectIds = dedupeStrings(rawTasks.map((task) => task.proyecto_id));

    const [directions, members, projects, subtaskStats] = await Promise.all([
      queryDirections(),
      queryMembers(),
      queryProjectsByIds(projectIds),
      querySubtaskStats(rawTasks.map((task) => task.id)),
    ]);

    const directionsById = new Map(directions.map((direction) => [direction.id, direction]));
    const projectsById = new Map(projects.map((project) => [project.id, project]));
    const { bySocioId: membersBySocioId } = buildMemberMaps(members);

    let tasks = rawTasks.map((row) => mapTaskRow(row, projectsById, directionsById, membersBySocioId, subtaskStats));

    if (!filters.include_completed) {
      tasks = tasks.filter((task) => !task.completada);
    }

    if (filters.direction) {
      const directionNeedle = directionFromCodeOrName(filters.direction) || filters.direction;
      tasks = tasks.filter((task) => normalizeText(task.direccion_responsable) === normalizeText(directionNeedle));
    }

    if (filters.state) {
      const expected = normalizeText(filters.state);
      tasks = tasks.filter((task) => {
        if (normalizeText(task.estado_backend) === expected) return true;
        return normalizeText(task.estado_kanban) === expected;
      });
    }

    if (filters.search) {
      tasks = tasks.filter((task) => (
        matchesSearch(task.titulo, filters.search) ||
        matchesSearch(task.descripcion, filters.search) ||
        matchesSearch(task.proyecto?.nombre, filters.search) ||
        matchesSearch(task.asignado_a?.nombre_completo, filters.search)
      ));
    }

    if (filters.due_before) {
      tasks = tasks.filter((task) => task.fecha_vencimiento && task.fecha_vencimiento <= filters.due_before);
    }

    if (filters.due_after) {
      tasks = tasks.filter((task) => task.fecha_vencimiento && task.fecha_vencimiento >= filters.due_after);
    }

    tasks.sort((left, right) => {
      if (left.vencida !== right.vencida) return left.vencida ? -1 : 1;
      const dueComparison = compareDatesAsc(left.fecha_vencimiento, right.fecha_vencimiento);
      if (dueComparison !== 0) return dueComparison;
      const priorityComparison = compareNullableNumbers(left.prioridad, right.prioridad);
      if (priorityComparison !== 0) return priorityComparison;
      return right.updated_at.localeCompare(left.updated_at);
    });

    return {
      meta: {
        total_matches: tasks.length,
        filters: {
          project_id: filters.project_id || null,
          search: filters.search || null,
          state: filters.state || null,
          assignee_socio_id: filters.assignee_socio_id || null,
          direction: filters.direction || null,
          due_before: filters.due_before || null,
          due_after: filters.due_after || null,
          include_completed: Boolean(filters.include_completed),
        },
      },
      items: tasks,
    };
  }

  async function getTaskDetails(taskId) {
    const taskResult = await supabase
      .from('tareas')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();

    if (taskResult.error) {
      throw new Error(`No se pudo leer la tarea ${taskId}: ${taskResult.error.message}`);
    }

    if (!taskResult.data) {
      throw new Error(`No encontré una tarea con id ${taskId}.`);
    }

    const taskRow = taskResult.data;

    const [directions, members, projects, subtasksResult, approvalsResult, handoffsResult, historyResult] = await Promise.all([
      queryDirections(),
      queryMembers(),
      queryProjectsByIds([taskRow.proyecto_id]),
      supabase
        .from('subtareas')
        .select('*')
        .eq('tarea_id', taskId)
        .order('orden_en_columna', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('tareas_aprobaciones_cd')
        .select('*')
        .eq('tarea_id', taskId)
        .order('created_at', { ascending: true }),
      supabase
        .from('tareas_handoffs')
        .select('*')
        .eq('tarea_id', taskId)
        .order('created_at', { ascending: false }),
      supabase
        .from('tareas_historial')
        .select('*')
        .eq('tarea_id', taskId)
        .order('created_at', { ascending: false })
        .limit(25),
    ]);

    if (subtasksResult.error) {
      throw new Error(`No se pudieron leer las subtareas de la tarea ${taskId}: ${subtasksResult.error.message}`);
    }

    if (approvalsResult.error) {
      throw new Error(`No se pudieron leer las aprobaciones CD de la tarea ${taskId}: ${approvalsResult.error.message}`);
    }

    if (handoffsResult.error) {
      throw new Error(`No se pudieron leer los handoffs de la tarea ${taskId}: ${handoffsResult.error.message}`);
    }

    if (historyResult.error) {
      throw new Error(`No se pudo leer el historial de la tarea ${taskId}: ${historyResult.error.message}`);
    }

    const directionsById = new Map(directions.map((direction) => [direction.id, direction]));
    const { bySocioId: membersBySocioId } = buildMemberMaps(members);
    const projectsById = new Map(projects.map((project) => [project.id, project]));
    const subtaskStats = await querySubtaskStats([taskId]);
    const task = mapTaskRow(taskRow, projectsById, directionsById, membersBySocioId, subtaskStats);

    const subtasks = ensureArray(subtasksResult.data).map((row) => mapSubtaskRow(row, membersBySocioId));

    const approvals = ensureArray(approvalsResult.data).map((row) => ({
      id: row.id,
      tarea_id: row.tarea_id,
      socio_id: row.socio_id,
      socio: membersBySocioId.get(row.socio_id) || null,
      decision: row.decision,
      observacion: row.observacion || null,
      metadata: row.metadata || {},
      aprobado_at: row.aprobado_at || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    const handoffs = ensureArray(handoffsResult.data).map((row) => ({
      id: row.id,
      tarea_id: row.tarea_id,
      estado: row.estado,
      motivo: row.motivo || null,
      comentario_resolucion: row.comentario_resolucion || null,
      metadata: row.metadata || {},
      de_socio_id: row.de_socio_id || null,
      de_socio: row.de_socio_id ? membersBySocioId.get(row.de_socio_id) || null : null,
      a_socio_id: row.a_socio_id,
      a_socio: membersBySocioId.get(row.a_socio_id) || null,
      solicitado_por_socio_id: row.solicitado_por_socio_id || null,
      solicitado_por_socio: row.solicitado_por_socio_id
        ? membersBySocioId.get(row.solicitado_por_socio_id) || null
        : null,
      resuelto_por_socio_id: row.resuelto_por_socio_id || null,
      resuelto_por_socio: row.resuelto_por_socio_id
        ? membersBySocioId.get(row.resuelto_por_socio_id) || null
        : null,
      resuelto_at: row.resuelto_at || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    const history = ensureArray(historyResult.data).map((row) => ({
      id: row.id,
      accion: row.accion,
      actor_socio_id: row.actor_socio_id || null,
      actor: row.actor_socio_id ? membersBySocioId.get(row.actor_socio_id) || null : null,
      estado_anterior: row.estado_anterior || null,
      estado_nuevo: row.estado_nuevo || null,
      payload: row.payload || {},
      created_at: row.created_at,
    }));

    return {
      task,
      subtasks,
      approvals,
      handoffs,
      history,
    };
  }

  async function listAssignableMembers(filters = {}) {
    const members = await queryMembers();
    const limit = clampLimit(filters.limit, 25);

    let items = [...members];

    if (filters.role) {
      items = items.filter((member) => normalizeText(member.rol) === normalizeText(filters.role));
    }

    if (filters.direction) {
      const directionNeedle = directionFromCodeOrName(filters.direction) || filters.direction;
      items = items.filter((member) => member.direcciones.some((item) => (
        normalizeText(item.direccion) === normalizeText(directionNeedle)
      )));
    }

    if (filters.search) {
      items = items.filter((member) => (
        matchesSearch(member.nombre_completo, filters.search) ||
        matchesSearch(member.email, filters.search) ||
        matchesSearch(member.rol_aile, filters.search)
      ));
    }

    items.sort((left, right) => {
      const lastNameComparison = compareNullableStrings(left.apellido, right.apellido);
      if (lastNameComparison !== 0) return lastNameComparison;
      return compareNullableStrings(left.nombre, right.nombre);
    });

    const limited = items.slice(0, limit);
    const workloadBySocioId = filters.include_workload
      ? await queryWorkloadBySocioIds(limited.map((member) => member.socio_id))
      : null;

    const enriched = limited.map((member) => ({
      ...member,
      workload: workloadBySocioId
        ? buildWorkloadSummary(workloadBySocioId.get(member.socio_id) || {
          total_tasks: 0,
          open_tasks: 0,
          completed_tasks: 0,
          overdue_tasks: 0,
          total_subtasks: 0,
          open_subtasks: 0,
          completed_subtasks: 0,
        })
        : undefined,
    }));

    return {
      meta: {
        total_matches: items.length,
        returned_items: enriched.length,
        limit,
        filters: {
          search: filters.search || null,
          role: filters.role || null,
          direction: filters.direction || null,
          include_workload: Boolean(filters.include_workload),
        },
      },
      items: enriched,
    };
  }

  async function getMemberWorkload(filters = {}) {
    const listing = await listAssignableMembers({
      search: filters.search || null,
      role: filters.role || null,
      direction: filters.direction || null,
      include_workload: true,
      limit: filters.limit || 25,
    });

    return listing;
  }

  async function getTaskDashboard(filters = {}) {
    const daysAhead = clampLimit(filters.days_ahead, 7, 60);
    const taskListing = await listTasksInternal({
      project_id: filters.project_id || null,
      direction: filters.direction || null,
      include_completed: true,
    });

    const tasks = taskListing.items;
    const dueSoonEnd = addDays(todayDateOnly(), daysAhead);

    const byKanbanState = Object.fromEntries(
      KANBAN_STATE_ORDER.map((state) => [state, tasks.filter((task) => task.estado_kanban === state).length])
    );

    const byDirectionMap = new Map();
    const byProjectMap = new Map();

    for (const task of tasks) {
      const directionKey = task.direccion_responsable || 'Sin dirección';
      const projectKey = task.proyecto?.nombre || 'Proyecto sin nombre';

      byDirectionMap.set(directionKey, (byDirectionMap.get(directionKey) || 0) + 1);
      byProjectMap.set(projectKey, (byProjectMap.get(projectKey) || 0) + 1);
    }

    const urgentTasks = tasks
      .filter((task) => task.vencida || dueInWindow(task, dueSoonEnd))
      .sort((left, right) => {
        if (left.vencida !== right.vencida) return left.vencida ? -1 : 1;
        return compareDatesAsc(left.fecha_vencimiento, right.fecha_vencimiento);
      })
      .slice(0, 10);

    const summary = {
      total_tasks: tasks.length,
      open_tasks: tasks.filter((task) => !task.completada).length,
      completed_tasks: tasks.filter((task) => task.completada).length,
      overdue_tasks: tasks.filter((task) => task.vencida).length,
      due_soon_tasks: tasks.filter((task) => dueInWindow(task, dueSoonEnd)).length,
      pending_cd_tasks: tasks.filter((task) => task.estado_backend === 'pendiente_aprobacion_cd').length,
      pending_handoff_tasks: tasks.filter((task) => task.estado_backend === 'pendiente_handoff').length,
      by_kanban_state: byKanbanState,
    };

    return {
      filters: {
        project_id: filters.project_id || null,
        direction: filters.direction || null,
        days_ahead: daysAhead,
      },
      summary,
      by_direction: Array.from(byDirectionMap.entries())
        .map(([direction, count]) => ({ direction, count }))
        .sort((left, right) => right.count - left.count),
      by_project: Array.from(byProjectMap.entries())
        .map(([project, count]) => ({ project, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 10),
      urgent_tasks: urgentTasks,
    };
  }

  return {
    async getTaskDashboard(filters) {
      const payload = await getTaskDashboard(filters);
      return toStructuredResponse(buildDashboardSummary(payload), payload);
    },
    async listTaskProjects(filters) {
      const payload = await listTaskProjects(filters);
      return toStructuredResponse(buildProjectSummary(payload.items), payload);
    },
    async listTasks(filters) {
      const payload = await listTasks(filters);
      return toStructuredResponse(buildTaskSummary(payload.items), payload);
    },
    async getTaskDetails(taskId) {
      const payload = await getTaskDetails(taskId);
      return toStructuredResponse(`Detalle listo para la tarea "${payload.task.titulo}".`, payload);
    },
    async listAssignableMembers(filters) {
      const payload = await listAssignableMembers(filters);
      return toStructuredResponse(buildMemberSummary(payload.items), payload);
    },
    async getMemberWorkload(filters) {
      const payload = await getMemberWorkload(filters);
      return toStructuredResponse(buildMemberSummary(payload.items), payload);
    },
  };
}

export const tasksReadonlyInternals = {
  BACKEND_STATES,
  normalizeText,
  directionFromCodeOrName,
  toKanbanState,
  matchesSearch,
};
