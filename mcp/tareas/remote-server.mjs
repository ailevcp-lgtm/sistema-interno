import * as z from 'zod/v4';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createTasksReadonlyDataSource, tasksReadonlyInternals } from './data.mjs';
import { createAuthenticatedSupabaseClient } from './remote-auth.mjs';
import { createTasksRemoteMutationService } from './remote-write.mjs';
import { createRemoteDocumentsService } from '../documentos/service.mjs';
import { registerDocumentTools } from '../documentos/register-tools.mjs';

export function createRemoteTareasMcpServer({
  supabaseUrl,
  anonKey,
  accessToken,
  authInfo,
}) {
  const supabaseClient = createAuthenticatedSupabaseClient({
    supabaseUrl,
    anonKey,
    accessToken,
  });

  const dataSource = createTasksReadonlyDataSource({ supabaseClient });
  const mutationService = createTasksRemoteMutationService({
    supabaseUrl,
    anonKey,
    accessToken,
    authInfo,
  });
  const documentsService = createRemoteDocumentsService({
    supabaseClient,
    actor: authInfo?.extra?.actor,
  });

  const server = new McpServer(
    {
      name: 'aile-interno-remote',
      version: '0.3.0',
    },
    {
      capabilities: {
        logging: {},
      },
    }
  );

  registerDocumentTools(server, documentsService);

  const directionDescription = 'Acepta CEA, Finanzas, Recursos Humanos o Comunicación.';
  const taskStateDescription = [
    'Acepta estados backend o kanban.',
    `Backend: ${tasksReadonlyInternals.BACKEND_STATES.join(', ')}.`,
    'Kanban: pendiente, en_progreso, en_revision, completada.',
  ].join(' ');

  server.registerTool(
    'aile_tasks_get_dashboard',
    {
      title: 'Resumen de tareas',
      description: 'Devuelve un panorama del módulo de tareas: conteos, urgencias y distribución por proyecto o dirección.',
      inputSchema: {
        project_id: z.string().uuid().optional().describe('Filtra el resumen a un proyecto específico.'),
        direction: z.string().optional().describe(directionDescription),
        days_ahead: z.number().int().min(1).max(60).optional().describe('Ventana de próximos vencimientos. Por defecto 7 días.'),
      },
    },
    async ({ project_id, direction, days_ahead }) => dataSource.getTaskDashboard({
      project_id,
      direction,
      days_ahead,
    })
  );

  server.registerTool(
    'aile_tasks_list_projects',
    {
      title: 'Listar proyectos',
      description: 'Lista proyectos del módulo de tareas con métricas resumidas y filtros.',
      inputSchema: {
        search: z.string().optional().describe('Busca por nombre, descripción o dirección.'),
        type: z.enum(['institucional', 'interno_direccion']).optional().describe('Tipo de proyecto.'),
        direction: z.string().optional().describe(directionDescription),
        include_archived: z.boolean().optional().describe('Incluye proyectos archivados. Por defecto false.'),
        limit: z.number().int().min(1).max(100).optional().describe('Máximo de resultados a devolver.'),
      },
    },
    async ({ search, type, direction, include_archived, limit }) => dataSource.listTaskProjects({
      search,
      type,
      direction,
      include_archived,
      limit,
    })
  );

  server.registerTool(
    'aile_tasks_list_tasks',
    {
      title: 'Listar tareas',
      description: 'Lista tareas con filtros por proyecto, estado, responsable, vencimiento y dirección.',
      inputSchema: {
        project_id: z.string().uuid().optional().describe('Filtra por proyecto.'),
        search: z.string().optional().describe('Busca por título, descripción, proyecto o persona asignada.'),
        state: z.string().optional().describe(taskStateDescription),
        assignee_socio_id: z.string().uuid().optional().describe('Filtra por socio asignado.'),
        direction: z.string().optional().describe(directionDescription),
        due_before: z.string().optional().describe('Fecha máxima de vencimiento en formato YYYY-MM-DD.'),
        due_after: z.string().optional().describe('Fecha mínima de vencimiento en formato YYYY-MM-DD.'),
        include_completed: z.boolean().optional().describe('Incluye tareas completadas. Por defecto false.'),
        limit: z.number().int().min(1).max(100).optional().describe('Máximo de resultados a devolver.'),
      },
    },
    async ({
      project_id,
      search,
      state,
      assignee_socio_id,
      direction,
      due_before,
      due_after,
      include_completed,
      limit,
    }) => dataSource.listTasks({
      project_id,
      search,
      state,
      assignee_socio_id,
      direction,
      due_before,
      due_after,
      include_completed,
      limit,
    })
  );

  server.registerTool(
    'aile_tasks_get_task_details',
    {
      title: 'Detalle de tarea',
      description: 'Obtiene el detalle completo de una tarea, incluyendo subtareas, aprobaciones, handoffs e historial reciente.',
      inputSchema: {
        task_id: z.string().uuid().describe('ID de la tarea a consultar.'),
      },
    },
    async ({ task_id }) => dataSource.getTaskDetails(task_id)
  );

  server.registerTool(
    'aile_tasks_list_assignable_members',
    {
      title: 'Buscar socios asignables',
      description: 'Busca socios o miembros disponibles para asignar tareas. Úsala cuando necesites encontrar a quién asignar una tarea o revisar su carga básica.',
      inputSchema: {
        search: z.string().optional().describe('Busca por nombre, email o rol AILE.'),
        role: z.enum(['socio', 'revisor_cuentas', 'comision_directiva', 'admin']).optional().describe('Filtra por rol del sistema.'),
        direction: z.string().optional().describe(directionDescription),
        include_workload: z.boolean().optional().describe('Incluye un resumen de carga de trabajo por persona.'),
        limit: z.number().int().min(1).max(100).optional().describe('Máximo de resultados a devolver.'),
      },
    },
    async ({ search, role, direction, include_workload, limit }) => dataSource.listAssignableMembers({
      search,
      role,
      direction,
      include_workload,
      limit,
    })
  );

  server.registerTool(
    'aile_tasks_get_member_workload',
    {
      title: 'Carga de socios',
      description: 'Muestra la carga de trabajo de socios asignables, incluyendo tareas abiertas, vencidas y subtareas.',
      inputSchema: {
        search: z.string().optional().describe('Busca por nombre, email o fragmento.'),
        role: z.enum(['socio', 'revisor_cuentas', 'comision_directiva', 'admin']).optional().describe('Filtra por rol del sistema.'),
        direction: z.string().optional().describe(directionDescription),
        limit: z.number().int().min(1).max(100).optional().describe('Máximo de resultados a devolver.'),
      },
    },
    async ({ search, role, direction, limit }) => dataSource.getMemberWorkload({
      search,
      role,
      direction,
      limit,
    })
  );

  server.registerTool(
    'aile_tasks_get_actor_context',
    {
      title: 'Actor remoto',
      description: 'Muestra con qué socio autenticado está operando este MCP remoto y el contexto OAuth asociado.',
    },
    async () => mutationService.getActorContext()
  );

  server.registerTool(
    'aile_tasks_create_task',
    {
      title: 'Crear tarea',
      description: 'Crea una tarea en AILE. Soporta dry_run para simular la operación antes de ejecutar la RPC.',
      inputSchema: {
        project_id: z.string().uuid().optional().describe('ID del proyecto destino.'),
        project_name: z.string().optional().describe('Nombre o fragmento del proyecto destino si no conoces el ID.'),
        title: z.string().describe('Título de la tarea.'),
        description: z.string().optional().describe('Descripción opcional.'),
        state: z.string().optional().describe(taskStateDescription),
        priority: z.number().int().min(1).max(4).optional().describe('Prioridad de 1 a 4. Por defecto 3.'),
        due_date: z.string().optional().describe('Fecha límite en formato YYYY-MM-DD.'),
        direction: z.string().optional().describe('Dirección responsable, útil sobre todo para tareas institucionales.'),
        assignee_socio_id: z.string().uuid().optional().describe('Socio asignado por ID.'),
        assignee_email: z.string().email().optional().describe('Socio asignado por email.'),
        assignee_name: z.string().optional().describe('Socio asignado por nombre o fragmento.'),
        dry_run: z.boolean().optional().describe('Si es true, solo simula la creación.'),
      },
    },
    async (input) => mutationService.createTask(input)
  );

  server.registerTool(
    'aile_tasks_create_tasks_batch',
    {
      title: 'Crear varias tareas',
      description: 'Crea varias tareas en lote. Soporta dry_run para revisar el plan antes de ejecutar.',
      inputSchema: {
        project_id: z.string().uuid().optional().describe('Proyecto por defecto para todo el lote.'),
        project_name: z.string().optional().describe('Nombre del proyecto por defecto para todo el lote.'),
        dry_run: z.boolean().optional().describe('Si es true, solo simula el lote.'),
        tasks: z.array(z.object({
          project_id: z.string().uuid().optional(),
          project_name: z.string().optional(),
          title: z.string(),
          description: z.string().optional(),
          state: z.string().optional(),
          priority: z.number().int().min(1).max(4).optional(),
          due_date: z.string().optional(),
          direction: z.string().optional(),
          assignee_socio_id: z.string().uuid().optional(),
          assignee_email: z.string().email().optional(),
          assignee_name: z.string().optional(),
        })).min(1).describe('Tareas a crear. Cada item puede heredar el proyecto por defecto del lote.'),
      },
    },
    async (input) => mutationService.createTasksBatch(input)
  );

  server.registerTool(
    'aile_tasks_assign_task',
    {
      title: 'Asignar tarea',
      description: 'Asigna o reasigna una tarea a un socio activo. Soporta dry_run.',
      inputSchema: {
        task_id: z.string().uuid().describe('ID de la tarea a asignar.'),
        assignee_socio_id: z.string().uuid().optional().describe('Destino por ID de socio.'),
        assignee_email: z.string().email().optional().describe('Destino por email.'),
        assignee_name: z.string().optional().describe('Destino por nombre o fragmento.'),
        reason: z.string().optional().describe('Motivo o contexto de la asignación.'),
        dry_run: z.boolean().optional().describe('Si es true, solo simula la asignación.'),
      },
    },
    async (input) => mutationService.assignTask(input)
  );

  server.registerTool(
    'aile_tasks_update_task',
    {
      title: 'Actualizar tarea',
      description: 'Actualiza una tarea existente: estado, título, descripción, prioridad, fecha límite o dirección responsable. Soporta dry_run.',
      inputSchema: {
        task_id: z.string().uuid().describe('ID de la tarea a actualizar.'),
        title: z.string().optional().describe('Nuevo título.'),
        description: z.string().optional().describe('Nueva descripción. Pasa string vacío si quieres limpiarla.'),
        state: z.string().optional().describe(taskStateDescription),
        priority: z.number().int().min(1).max(4).optional().describe('Nueva prioridad de 1 a 4.'),
        due_date: z.string().optional().describe('Nueva fecha límite en formato YYYY-MM-DD.'),
        clear_due_date: z.boolean().optional().describe('Limpia la fecha límite actual.'),
        direction: z.string().optional().describe('Nueva dirección responsable.'),
        dry_run: z.boolean().optional().describe('Si es true, solo simula la actualización.'),
      },
    },
    async (input) => mutationService.updateTask(input)
  );

  server.registerTool(
    'aile_tasks_update_task_status',
    {
      title: 'Actualizar estado de tarea',
      description: 'Cambia el estado de una tarea existente. Esta es la tool recomendada para mover una tarea entre pendiente, en progreso, en revisión o completada.',
      inputSchema: {
        task_id: z.string().uuid().describe('ID de la tarea a actualizar.'),
        state: z.string().describe(taskStateDescription),
        dry_run: z.boolean().optional().describe('Si es true, solo simula el cambio.'),
      },
    },
    async ({ task_id, state, dry_run }) => mutationService.updateTask({
      task_id,
      state,
      dry_run,
    })
  );

  server.registerTool(
    'aile_tasks_create_subtask',
    {
      title: 'Crear subtarea',
      description: 'Crea una subtarea dentro de una tarea existente. Soporta dry_run.',
      inputSchema: {
        task_id: z.string().uuid().describe('ID de la tarea padre.'),
        title: z.string().describe('Título de la subtarea.'),
        description: z.string().optional().describe('Descripción opcional.'),
        state: z.string().optional().describe(taskStateDescription),
        assignee_socio_id: z.string().uuid().optional().describe('Destino por ID de socio.'),
        assignee_email: z.string().email().optional().describe('Destino por email.'),
        assignee_name: z.string().optional().describe('Destino por nombre o fragmento.'),
        dry_run: z.boolean().optional().describe('Si es true, solo simula la creación.'),
      },
    },
    async (input) => mutationService.createSubtask(input)
  );

  server.registerTool(
    'aile_tasks_create_project',
    {
      title: 'Crear proyecto',
      description: 'Crea un proyecto de tareas usando las RPC oficiales del sistema.',
      inputSchema: {
        name: z.string().describe('Nombre del proyecto.'),
        description: z.string().optional().describe('Descripción opcional.'),
        type: z.enum(['institucional', 'interno_direccion']).describe('Tipo de proyecto.'),
        direction: z.string().optional().describe(directionDescription),
      },
    },
    async (input) => mutationService.createProject(input)
  );

  server.registerTool(
    'aile_tasks_update_project',
    {
      title: 'Actualizar proyecto',
      description: 'Actualiza nombre, descripción, tipo, dirección, estado activo u orden de un proyecto existente.',
      inputSchema: {
        project_id: z.string().uuid().optional().describe('ID del proyecto a editar.'),
        project_name: z.string().optional().describe('Nombre o fragmento si no conoces el ID.'),
        name: z.string().optional().describe('Nuevo nombre del proyecto.'),
        description: z.string().optional().describe('Nueva descripción. Usa string vacío para limpiarla.'),
        type: z.enum(['institucional', 'interno_direccion']).optional().describe('Nuevo tipo de proyecto.'),
        direction: z.string().optional().describe(directionDescription),
        active: z.boolean().optional().describe('Marca si el proyecto sigue activo.'),
        order: z.number().int().optional().describe('Nuevo orden en el tablero.'),
      },
    },
    async (input) => mutationService.updateProject(input)
  );

  server.registerTool(
    'aile_tasks_archive_project',
    {
      title: 'Archivar proyecto',
      description: 'Archiva un proyecto existente usando las RPC oficiales del sistema.',
      inputSchema: {
        project_id: z.string().uuid().optional().describe('ID del proyecto a archivar.'),
        project_name: z.string().optional().describe('Nombre o fragmento si no conoces el ID.'),
      },
    },
    async (input) => mutationService.archiveProject(input)
  );

  server.registerTool(
    'aile_tasks_handoff_task',
    {
      title: 'Handoff de tarea',
      description: 'Solicita o aplica el handoff de una tarea a otro socio usando las RPC oficiales.',
      inputSchema: {
        task_id: z.string().uuid().describe('ID de la tarea.'),
        assignee_socio_id: z.string().uuid().optional().describe('Destino por ID de socio.'),
        assignee_email: z.string().email().optional().describe('Destino por email.'),
        assignee_name: z.string().optional().describe('Destino por nombre o fragmento.'),
        note: z.string().optional().describe('Motivo o comentario del handoff.'),
      },
    },
    async (input) => mutationService.handoffTask(input)
  );

  server.registerTool(
    'aile_tasks_delete_task',
    {
      title: 'Eliminar tarea',
      description: 'Elimina una tarea usando las RPC oficiales del sistema.',
      inputSchema: {
        task_id: z.string().uuid().describe('ID de la tarea a eliminar.'),
      },
    },
    async (input) => mutationService.deleteTask(input)
  );

  server.registerTool(
    'aile_tasks_update_subtask',
    {
      title: 'Actualizar subtarea',
      description: 'Actualiza una subtarea existente: título, descripción o estado.',
      inputSchema: {
        subtask_id: z.string().uuid().describe('ID de la subtarea a actualizar.'),
        title: z.string().optional().describe('Nuevo título.'),
        description: z.string().optional().describe('Nueva descripción. Usa string vacío para limpiarla.'),
        state: z.string().optional().describe(taskStateDescription),
      },
    },
    async (input) => mutationService.updateSubtask(input)
  );

  server.registerTool(
    'aile_tasks_send_task_to_cd',
    {
      title: 'Enviar tarea a CD',
      description: 'Envía una tarea al flujo de aprobación de Comisión Directiva.',
      inputSchema: {
        task_id: z.string().uuid().describe('ID de la tarea a enviar a CD.'),
        comment: z.string().optional().describe('Comentario opcional para el envío.'),
      },
    },
    async (input) => mutationService.sendTaskToCd(input)
  );

  server.registerTool(
    'aile_tasks_resolve_task_cd',
    {
      title: 'Resolver aprobación CD',
      description: 'Aprueba u observa/rechaza una tarea pendiente de CD para el socio autenticado.',
      inputSchema: {
        task_id: z.string().uuid().describe('ID de la tarea con aprobación pendiente.'),
        approve: z.boolean().optional().describe('True para aprobar, false para rechazar u observar. Por defecto true.'),
        comment: z.string().optional().describe('Comentario opcional de la resolución.'),
      },
    },
    async (input) => mutationService.resolveTaskCd(input)
  );

  return server;
}
