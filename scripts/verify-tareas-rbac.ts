import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

const envCandidates = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env.local'),
  path.resolve(process.cwd(), '../.env'),
]

for (const envPath of envCandidates) {
  dotenv.config({ path: envPath })
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local/.env')
}

if (!SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local/.env')
}

const usingServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type TableSecurity = {
  exists: boolean
  rls_enabled: boolean
  policy_count: number
  policy_cmds: string[]
}

type Snapshot = {
  table_security: Record<string, TableSecurity>
  rpc_tareas_functions: string[]
}

type Socio = {
  id: string
  email: string
  rol: string
  rol_aile: string | null
}

type Direccion = {
  id: string
  codigo: string
}

type Proyecto = {
  id: string
  nombre: string
  tipo: string
  direccion_id: string | null
  activo: boolean
}

type Tarea = {
  id: string
  proyecto_id: string
  asignado_socio_id: string | null
  estado: string
}

type Subtarea = {
  id: string
  tarea_id: string
  asignado_socio_id: string | null
  estado: string
}

type Handoff = {
  id: string
  tarea_id: string
  de_socio_id: string | null
  a_socio_id: string
  estado: string
}

type Aprobacion = {
  tarea_id: string
  socio_id: string
  decision: string
}

type SocioDireccion = {
  socio_id: string
  direccion_id: string
  es_director: boolean
  activo: boolean
}

const REQUIRED_TABLES = [
  'direcciones',
  'socios_direcciones',
  'proyectos_tareas',
  'tareas',
  'subtareas',
  'tareas_handoffs',
  'tareas_aprobaciones_cd',
  'tareas_historial',
] as const

const DEMO_PROJECTS = [
  { nombre: 'Modelo ONU - Carteles', tipo: 'institucional', direccion: null },
  { nombre: 'Planificación Redes', tipo: 'interno_direccion', direccion: 'comunicacion' },
] as const

const PERSONAS = {
  socioNoAsignado: 'gabrielgarciaimportantes@gmail.com',
  socioAsignado: 'naiiabatte@gmail.com',
  directorDueno: 'emiagugames@gmail.com',
  directorAjeno: 'nachoalcedo@gmail.com',
  admin: 'faustolavezzari99@gmail.com',
  comision: 'matimarchesinkossoy@gmail.com',
} as const

let checks = 0
const failures: string[] = []
const warnings: string[] = []

function pass(message: string) {
  checks += 1
  console.log(`[OK] ${message}`)
}

function fail(message: string) {
  checks += 1
  failures.push(message)
  console.error(`[FAIL] ${message}`)
}

function warn(message: string) {
  warnings.push(message)
  console.warn(`[WARN] ${message}`)
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v))))
}

async function main() {
  console.log('Running tareas RBAC verification...')
  if (!usingServiceRole) {
    warn('SUPABASE_SERVICE_ROLE_KEY is not set. Verification may be incomplete with anon key.')
  }

  const { data: snapshotData, error: snapshotError } = await supabase.rpc('rpc_tareas_qc_snapshot')
  if (snapshotError) {
    fail(
      `Cannot execute rpc_tareas_qc_snapshot: ${snapshotError.message}. Ensure migration 029 is applied.`
    )
    finish()
    return
  }

  const snapshot = snapshotData as Snapshot
  const tableSecurity = asObject(snapshot?.table_security)
  const rpcFunctions = asStringArray(snapshot?.rpc_tareas_functions)

  for (const table of REQUIRED_TABLES) {
    const entry = asObject(tableSecurity[table]) as Partial<TableSecurity>
    const exists = Boolean(entry.exists)
    const rlsEnabled = Boolean(entry.rls_enabled)
    const policyCount = Number(entry.policy_count ?? 0)

    if (exists) pass(`Table exists: ${table}`)
    else fail(`Missing table: ${table}`)

    if (rlsEnabled) pass(`RLS enabled: ${table}`)
    else fail(`RLS disabled: ${table}`)

    if (policyCount > 0) pass(`RLS policies found (${policyCount}) on ${table}`)
    else fail(`No RLS policies found on ${table}`)
  }

  if (rpcFunctions.includes('rpc_tareas_qc_snapshot')) {
    pass('RPC inventory function exists: rpc_tareas_qc_snapshot')
  } else {
    fail('Missing rpc_tareas_qc_snapshot in public schema')
  }

  const businessRpcs = rpcFunctions.filter((fn) => fn !== 'rpc_tareas_qc_snapshot')
  if (businessRpcs.length > 0) {
    pass(`Business RPCs detected (${businessRpcs.length})`)
  } else {
    fail('No business RPCs with prefix rpc_tareas_ detected')
  }

  const hasHandoffRpc = businessRpcs.some((fn) => fn.includes('handoff'))
  const hasCdRpc = businessRpcs.some((fn) => fn.includes('cd') || fn.includes('aprob'))
  if (hasHandoffRpc) pass('RPC handoff capability detected')
  else fail('No RPC handoff capability detected (expected function name containing "handoff")')
  if (hasCdRpc) pass('RPC CD approval capability detected')
  else fail('No RPC CD approval capability detected (expected function name containing "cd" or "aprob")')

  const { data: direcciones, error: direccionesError } = await supabase
    .from('direcciones')
    .select('id, codigo')
  if (direccionesError) {
    fail(`Cannot read direcciones: ${direccionesError.message}`)
    finish()
    return
  }

  const direccionByCode = new Map<string, Direccion>()
  const direccionById = new Map<string, Direccion>()
  for (const dir of (direcciones ?? []) as Direccion[]) {
    direccionByCode.set(dir.codigo, dir)
    direccionById.set(dir.id, dir)
  }

  const { data: proyectos, error: proyectosError } = await supabase
    .from('proyectos_tareas')
    .select('id, nombre, tipo, direccion_id, activo')
    .in(
      'nombre',
      DEMO_PROJECTS.map((p) => p.nombre)
    )

  if (proyectosError) {
    fail(`Cannot read proyectos_tareas: ${proyectosError.message}`)
    finish()
    return
  }

  const demoProjects = (proyectos ?? []) as Proyecto[]
  const projectByName = new Map(demoProjects.map((p) => [p.nombre, p]))

  for (const required of DEMO_PROJECTS) {
    const project = projectByName.get(required.nombre)
    if (!project) {
      fail(`Missing demo project: ${required.nombre}`)
      continue
    }

    pass(`Demo project exists: ${required.nombre}`)
    if (project.tipo === required.tipo) pass(`Project type ok for ${required.nombre}: ${required.tipo}`)
    else fail(`Invalid type for ${required.nombre}: expected ${required.tipo}, got ${project.tipo}`)

    if (required.direccion === null) {
      if (project.direccion_id === null) {
        pass(`Project direction ok for ${required.nombre}: global`)
      } else {
        fail(`Invalid direction for ${required.nombre}: expected global, got ${project.direccion_id}`)
      }
    } else {
      const directionCode = project.direccion_id ? direccionById.get(project.direccion_id)?.codigo : null
      if (directionCode === required.direccion) {
        pass(`Project direction ok for ${required.nombre}: ${required.direccion}`)
      } else {
        fail(
          `Invalid direction for ${required.nombre}: expected ${required.direccion}, got ${directionCode ?? 'unknown'}`
        )
      }
    }

    if (project.activo) pass(`Project active flag set for ${required.nombre}`)
    else fail(`Project inactive: ${required.nombre}`)
  }

  const projectIds = demoProjects.map((p) => p.id)
  if (projectIds.length === 0) {
    fail('No demo projects loaded, cannot continue scenario checks')
    finish()
    return
  }

  const { data: tareasData, error: tareasError } = await supabase
    .from('tareas')
    .select('id, proyecto_id, asignado_socio_id, estado')
    .in('proyecto_id', projectIds)
  if (tareasError) {
    fail(`Cannot read tareas: ${tareasError.message}`)
    finish()
    return
  }

  const tasks = (tareasData ?? []) as Tarea[]
  const taskIds = tasks.map((t) => t.id)

  const { data: subtareasData, error: subtareasError } =
    taskIds.length > 0
      ? await supabase
          .from('subtareas')
          .select('id, tarea_id, asignado_socio_id, estado')
          .in('tarea_id', taskIds)
      : { data: [], error: null }

  if (subtareasError) {
    fail(`Cannot read subtareas: ${subtareasError.message}`)
    finish()
    return
  }

  const subtasks = (subtareasData ?? []) as Subtarea[]

  const { data: handoffsData, error: handoffsError } =
    taskIds.length > 0
      ? await supabase
          .from('tareas_handoffs')
          .select('id, tarea_id, de_socio_id, a_socio_id, estado')
          .in('tarea_id', taskIds)
      : { data: [], error: null }

  if (handoffsError) {
    fail(`Cannot read tareas_handoffs: ${handoffsError.message}`)
    finish()
    return
  }

  const handoffs = (handoffsData ?? []) as Handoff[]

  const { data: aprobacionesData, error: aprobacionesError } =
    taskIds.length > 0
      ? await supabase
          .from('tareas_aprobaciones_cd')
          .select('tarea_id, socio_id, decision')
          .in('tarea_id', taskIds)
      : { data: [], error: null }

  if (aprobacionesError) {
    fail(`Cannot read tareas_aprobaciones_cd: ${aprobacionesError.message}`)
    finish()
    return
  }

  const approvals = (aprobacionesData ?? []) as Aprobacion[]

  const assignedTaskCount = tasks.filter((task) => Boolean(task.asignado_socio_id)).length
  const unassignedTaskCount = tasks.length - assignedTaskCount
  if (assignedTaskCount > 0) pass(`Assigned tasks found: ${assignedTaskCount}`)
  else fail('No assigned tasks found in demo projects')
  if (unassignedTaskCount > 0) pass(`Unassigned tasks found: ${unassignedTaskCount}`)
  else fail('No unassigned tasks found in demo projects')

  const assignedSubtaskCount = subtasks.filter((subtask) => Boolean(subtask.asignado_socio_id)).length
  if (assignedSubtaskCount > 0) pass(`Assigned subtasks found: ${assignedSubtaskCount}`)
  else fail('No assigned subtasks found in demo projects')

  const taskStates = new Set(tasks.map((task) => task.estado))
  if (taskStates.has('pendiente_aprobacion_cd')) pass('Task state present: pendiente_aprobacion_cd')
  else fail('Missing task state: pendiente_aprobacion_cd')
  if (taskStates.has('observada_cd')) pass('Task state present: observada_cd')
  else fail('Missing task state: observada_cd')
  if (taskStates.has('aprobada_cd')) pass('Task state present: aprobada_cd')
  else fail('Missing task state: aprobada_cd')

  const decisionCounts = approvals.reduce<Record<string, number>>((acc, curr) => {
    acc[curr.decision] = (acc[curr.decision] ?? 0) + 1
    return acc
  }, {})
  if ((decisionCounts.pendiente ?? 0) > 0) pass('CD approvals include decision: pendiente')
  else fail('Missing CD decision: pendiente')
  if ((decisionCounts.observada ?? 0) > 0) pass('CD approvals include decision: observada')
  else fail('Missing CD decision: observada')
  if ((decisionCounts.aprobada ?? 0) > 0) pass('CD approvals include decision: aprobada')
  else fail('Missing CD decision: aprobada')

  const handoffSocioIds = unique(
    handoffs.flatMap((handoff) => [handoff.de_socio_id, handoff.a_socio_id])
  )
  const { data: handoffMembershipsData, error: handoffMembershipsError } =
    handoffSocioIds.length > 0
      ? await supabase
          .from('socios_direcciones')
          .select('socio_id, direccion_id, es_director, activo')
          .in('socio_id', handoffSocioIds)
          .eq('activo', true)
      : { data: [], error: null }

  if (handoffMembershipsError) {
    fail(`Cannot read socios_direcciones for handoff checks: ${handoffMembershipsError.message}`)
    finish()
    return
  }

  const handoffMemberships = (handoffMembershipsData ?? []) as SocioDireccion[]
  const directionCodesBySocio = new Map<string, Set<string>>()
  for (const row of handoffMemberships) {
    const directionCode = direccionById.get(row.direccion_id)?.codigo
    if (!directionCode) continue
    if (!directionCodesBySocio.has(row.socio_id)) directionCodesBySocio.set(row.socio_id, new Set())
    directionCodesBySocio.get(row.socio_id)?.add(directionCode)
  }

  const acceptedHandoffs = handoffs.filter((handoff) => handoff.estado === 'aceptado')
  const pendingHandoffs = handoffs.filter((handoff) => handoff.estado === 'pendiente')
  if (acceptedHandoffs.length > 0) pass(`Accepted handoffs found: ${acceptedHandoffs.length}`)
  else fail('No accepted handoffs found in demo projects')
  if (pendingHandoffs.length > 0) pass(`Pending handoffs found: ${pendingHandoffs.length}`)
  else fail('No pending handoffs found in demo projects')

  const hasCrossDirectionAccepted = acceptedHandoffs.some((handoff) => {
    if (!handoff.de_socio_id) return false
    const sourceDirections = directionCodesBySocio.get(handoff.de_socio_id)
    const targetDirections = directionCodesBySocio.get(handoff.a_socio_id)
    if (!sourceDirections || !targetDirections) return false
    const overlap = Array.from(sourceDirections).some((code) => targetDirections.has(code))
    return !overlap
  })

  if (hasCrossDirectionAccepted) pass('Cross-direction accepted handoff detected')
  else fail('No cross-direction accepted handoff detected')

  const { data: personasData, error: personasError } = await supabase
    .from('socios')
    .select('id, email, rol, rol_aile')
    .in('email', Object.values(PERSONAS))

  if (personasError) {
    fail(`Cannot read socios for persona checks: ${personasError.message}`)
    finish()
    return
  }

  const personas = (personasData ?? []) as Socio[]
  const personaByEmail = new Map(personas.map((s) => [s.email.toLowerCase(), s]))

  const socioNoAsignado = personaByEmail.get(PERSONAS.socioNoAsignado)
  const socioAsignado = personaByEmail.get(PERSONAS.socioAsignado)
  const directorDueno = personaByEmail.get(PERSONAS.directorDueno)
  const directorAjeno = personaByEmail.get(PERSONAS.directorAjeno)
  const admin = personaByEmail.get(PERSONAS.admin)
  const comision = personaByEmail.get(PERSONAS.comision)

  if (socioNoAsignado) pass('Persona loaded: socio no asignado')
  else fail('Missing persona socio no asignado')
  if (socioAsignado) pass('Persona loaded: socio asignado')
  else fail('Missing persona socio asignado')
  if (directorDueno) pass('Persona loaded: director dueño')
  else fail('Missing persona director dueño')
  if (directorAjeno) pass('Persona loaded: director ajeno')
  else fail('Missing persona director ajeno')
  if (admin) pass('Persona loaded: admin')
  else fail('Missing persona admin')
  if (comision) pass('Persona loaded: comision_directiva')
  else fail('Missing persona comision_directiva')

  const assignedSocioIds = new Set(
    unique([
      ...tasks.map((task) => task.asignado_socio_id),
      ...subtasks.map((subtask) => subtask.asignado_socio_id),
    ])
  )

  if (socioNoAsignado) {
    if (!assignedSocioIds.has(socioNoAsignado.id)) {
      pass('Scenario socio no asignado: not assigned to demo task/subtask')
    } else {
      fail('Scenario socio no asignado failed: user is assigned in demo task/subtask')
    }
  }

  if (socioAsignado) {
    if (assignedSocioIds.has(socioAsignado.id)) {
      pass('Scenario socio asignado: assigned to demo task/subtask')
    } else {
      fail('Scenario socio asignado failed: user has no assignment in demo data')
    }
  }

  if (admin) {
    if (admin.rol === 'admin') pass('Scenario CD/admin: admin role confirmed')
    else fail(`Scenario CD/admin failed: expected admin role, got ${admin.rol}`)
  }

  if (comision) {
    if (comision.rol === 'comision_directiva') pass('Scenario CD/admin: comision_directiva role confirmed')
    else fail(`Scenario CD/admin failed: expected comision_directiva role, got ${comision.rol}`)
  }

  if (admin && comision) {
    const approvalSocioIds = new Set(approvals.map((approval) => approval.socio_id))
    if (approvalSocioIds.has(admin.id) && approvalSocioIds.has(comision.id)) {
      pass('Scenario CD/admin: both personas appear in tareas_aprobaciones_cd')
    } else {
      fail('Scenario CD/admin failed: missing approval rows for admin/comision personas')
    }
  }

  const comunicacionDirection = direccionByCode.get('comunicacion')
  const finanzasDirection = direccionByCode.get('finanzas')
  const commProject = projectByName.get('Planificación Redes')

  if (commProject && comunicacionDirection) {
    if (commProject.direccion_id === comunicacionDirection.id) {
      pass('Communication demo project is owned by direccion comunicacion')
    } else {
      fail('Communication demo project is not owned by direccion comunicacion')
    }
  }

  const directorCheckSocioIds = unique([
    directorDueno?.id,
    directorAjeno?.id,
  ])

  const { data: directorMembershipsData, error: directorMembershipsError } =
    directorCheckSocioIds.length > 0
      ? await supabase
          .from('socios_direcciones')
          .select('socio_id, direccion_id, es_director, activo')
          .in('socio_id', directorCheckSocioIds)
          .eq('activo', true)
      : { data: [], error: null }

  if (directorMembershipsError) {
    fail(`Cannot read socios_direcciones for director checks: ${directorMembershipsError.message}`)
    finish()
    return
  }

  const directorMemberships = (directorMembershipsData ?? []) as SocioDireccion[]

  if (directorDueno && comunicacionDirection) {
    const isDirectorDueno = directorMemberships.some(
      (row) =>
        row.socio_id === directorDueno.id &&
        row.direccion_id === comunicacionDirection.id &&
        row.es_director
    )
    if (isDirectorDueno) pass('Scenario director dueño: membership as director in owner direction confirmed')
    else fail('Scenario director dueño failed: no active director membership in owner direction')
  }

  if (directorAjeno && comunicacionDirection && finanzasDirection) {
    const isDirectorFinanzas = directorMemberships.some(
      (row) =>
        row.socio_id === directorAjeno.id &&
        row.direccion_id === finanzasDirection.id &&
        row.es_director
    )
    const isDirectorComunicacion = directorMemberships.some(
      (row) =>
        row.socio_id === directorAjeno.id &&
        row.direccion_id === comunicacionDirection.id &&
        row.es_director
    )

    if (isDirectorFinanzas) pass('Scenario director ajeno: director role in finanzas confirmed')
    else fail('Scenario director ajeno failed: no active director role in finanzas')

    if (!isDirectorComunicacion) pass('Scenario director ajeno: not director of owner direction (comunicacion)')
    else fail('Scenario director ajeno failed: user is also director of comunicacion')
  }

  finish()
}

function finish() {
  console.log(`\nChecks: ${checks}`)
  console.log(`Failures: ${failures.length}`)
  if (warnings.length > 0) {
    console.log(`Warnings: ${warnings.length}`)
  }

  if (failures.length > 0) {
    console.error('\nRBAC verification FAILED:')
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    process.exitCode = 1
    return
  }

  console.log('\nRBAC verification PASSED')
}

main().catch((error) => {
  console.error('Unexpected error while verifying tareas RBAC:', error)
  process.exit(1)
})
