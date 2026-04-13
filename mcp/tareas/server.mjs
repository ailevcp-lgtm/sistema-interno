#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import * as z from 'zod/v4';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createTasksReadonlyDataSource, tasksReadonlyInternals } from './data.mjs';
import { createTasksMutationService } from './write.mjs';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const REPO_ROOT = path.resolve(CURRENT_DIR, '../..');

loadDotenv({ path: path.join(REPO_ROOT, '.env'), quiet: true });
loadDotenv({ path: path.join(REPO_ROOT, '.env.local'), override: true, quiet: true });

const server = new McpServer(
  {
    name: 'aile-tareas-local',
    version: '0.1.0',
  },
  {
    capabilities: {
      logging: {},
    },
  }
);

const dataSource = createTasksReadonlyDataSource({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

const mutationService = createTasksMutationService({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  defaultActorSocioId: process.env.AILE_MCP_ACTOR_SOCIO_ID,
  defaultActorEmail: process.env.AILE_MCP_ACTOR_EMAIL,
});

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
    description: 'Devuelve un panorama read-only del módulo de tareas: conteos, urgencias y distribución por proyecto o dirección.',
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
    description: 'Lista proyectos del módulo de tareas con métricas resumidas y filtros read-only.',
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
    description: 'Lista tareas read-only con filtros por proyecto, estado, responsable, vencimiento y dirección.',
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
    description: 'Obtiene el detalle completo de una tarea read-only, incluyendo subtareas, aprobaciones, handoffs e historial reciente.',
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
  'aile_tasks_get_local_actor',
  {
    title: 'Actor local',
    description: 'Muestra con qué socio local está operando este MCP para mutaciones.',
  },
  async () => mutationService.getLocalActor()
);

server.registerTool(
  'aile_tasks_create_task',
  {
    title: 'Crear tarea',
    description: 'Crea una tarea simple en AILE. Soporta dry_run para simular la operación antes de escribir.',
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
    description: 'Crea varias tareas en lote. Soporta dry_run para revisar el plan antes de escribir.',
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
      due_date: z.string().optional().describe('Fecha límite en formato YYYY-MM-DD.'),
      clear_due_date: z.boolean().optional().describe('Limpia la fecha límite si corresponde.'),
      assignee_socio_id: z.string().uuid().optional().describe('Destino por ID de socio.'),
      assignee_email: z.string().email().optional().describe('Destino por email.'),
      assignee_name: z.string().optional().describe('Destino por nombre o fragmento.'),
      dry_run: z.boolean().optional().describe('Si es true, solo simula la creación.'),
    },
  },
  async (input) => mutationService.createSubtask(input)
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AILE tareas MCP local escuchando por stdio');
}

main().catch((error) => {
  console.error('No se pudo iniciar el MCP de tareas local:', error);
  process.exit(1);
});
