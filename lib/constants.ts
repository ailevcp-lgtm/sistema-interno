// Constantes globales para AILE Sistema Interno

import type { Rol, NavItem, Recurso, Accion } from './types'

// Configuración de la aplicación
export const APP_CONFIG = {
  name: 'AILE',
  fullName: 'Asociación Independiente para Líderes Empoderados',
  version: '2026 v1.0',
  year: 2026,
}

// Colores de marca AILE
export const COLORS = {
  violet: '#6314a7',
  violetLight: '#9341bf',
  violetLighter: '#cea2dc',
  violetDark: '#0d0618',
  pink: '#e50051',
  cyan: '#00a3e2',
  cream: '#e7d0f1',
}

export const PERMISSION_RESOURCES: Recurso[] = [
  'dashboard',
  'calendario',
  'tareas',
  'socios',
  'deudas',
  'movimientos',
  'finanzas',
  'tesoreria',
  'reintegros',
  'documentos',
  'configuracion',
  'estatuto',
  'resoluciones',
  'balances',
  'logs',
  'reuniones',
]

export const PERMISSION_ACTIONS: Accion[] = ['ver', 'crear', 'editar', 'eliminar', 'aprobar']

export const RECURSO_LABELS: Record<Recurso, string> = {
  dashboard: 'Inicio',
  calendario: 'Calendario',
  tareas: 'Tareas',
  socios: 'Socios',
  deudas: 'Deudas',
  movimientos: 'Movimientos',
  finanzas: 'Finanzas',
  tesoreria: 'Tesoreria',
  reintegros: 'Reintegros',
  documentos: 'Documentos',
  configuracion: 'Ajustes',
  estatuto: 'Estatuto',
  resoluciones: 'Resoluciones',
  balances: 'Balances',
  logs: 'Logs',
  reuniones: 'Reuniones',
}

export const ACCION_LABELS: Record<Accion, string> = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
  aprobar: 'Aprobar',
}

// Navegación principal
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: 'Home' },
  { href: '/calendario', label: 'Calendario', icon: 'CalendarDays' },
  { href: '/reuniones', label: 'Reuniones', icon: 'Users2' },
  { href: '/tareas', label: 'Tareas', icon: 'KanbanSquare' },
  { href: '/socios', label: 'Socios', icon: 'Users' },
  { href: '/deudas', label: 'Deudas', icon: 'Wallet' },
  { href: '/movimientos', label: 'Movimientos', icon: 'ArrowUpDown' },
  { href: '/finanzas', label: 'Finanzas', icon: 'BarChart3', hiddenRoles: ['socio'] },
  { href: '/tesoreria', label: 'Tesorería', icon: 'Landmark', hiddenRoles: ['socio'] },
  { href: '/documentos', label: 'Documentos', icon: 'FileText' },
  { href: '/configuracion', label: 'Configuración', icon: 'Settings', requiredRoles: ['comision_directiva', 'admin'] },
]

// Navegación mobile (BottomNav)
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: 'Home' },
  { href: '/calendario', label: 'Calendario', icon: 'CalendarDays' },
  { href: '/tareas', label: 'Tareas', icon: 'KanbanSquare' },
  { href: '/socios', label: 'Socios', icon: 'Users' },
  { href: '/finanzas', label: 'Finanzas', icon: 'BarChart3', hiddenRoles: ['socio'] },
  { href: '/documentos', label: 'Documentos', icon: 'FileText' },
]

// Más opciones para el menú mobile
export const MORE_NAV_ITEMS: NavItem[] = [
  { href: '/deudas', label: 'Deudas', icon: 'Wallet' },
  { href: '/movimientos', label: 'Movimientos', icon: 'ArrowUpDown' },
  { href: '/calendario', label: 'Calendario', icon: 'CalendarDays' },
  { href: '/tareas', label: 'Tareas', icon: 'KanbanSquare' },
  { href: '/configuracion', label: 'Configuración', icon: 'Settings', requiredRoles: ['comision_directiva', 'admin'] },
]

// Labels de roles
export const ROL_LABELS: Record<Rol, string> = {
  socio: 'Socio',
  comision_directiva: 'Comisión Directiva',
  revisor_cuentas: 'Revisor de Cuentas',
  admin: 'Administrador',
}

// Colores de badges por rol
export const ROL_COLORS: Record<Rol, { bg: string; text: string }> = {
  socio: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
  comision_directiva: { bg: 'bg-[#6314a7]/20', text: 'text-[#9341bf]' },
  revisor_cuentas: { bg: 'bg-[#00a3e2]/20', text: 'text-[#00a3e2]' },
  admin: { bg: 'bg-[#e50051]/20', text: 'text-[#ff6699]' },
}

// Roles específicos de AILE
export const ROLES_AILE = [
  'Presidente',
  'Vicepresidente',
  'Secretario General',
  'Director de Finanzas',
  'Tesorero',
  'Revisor de Cuentas',
  'Vocal Titular',
  'Vocal Suplente',
  'Revisor de Cuentas Titular',
  'Revisor de Cuentas Suplente',
  'Socio',
] as const

export const REINTEGROS_ALLOWED_ROLES_AILE = [
  'Director de Finanzas',
  'Miembro de Finanzas',
  'Tesorero',
  'Presidente',
  'Secretario General',
] as const

export const COMISION_DIRECTIVA_ROLES_AILE = [
  'Presidente',
  'Tesorero',
  'Secretario General',
  'Vocal Titular',
] as const

export const ROLE_PERMISSIONS_UPDATED_EVENT = 'aile:role-permissions-updated'
export const AUTH_SESSION_RESUMED_EVENT = 'aile:auth-session-resumed'

export function canAccessReintegrosModule(rol: Rol, rolAile?: string | null): boolean {
  if (isGlobalManager(rol, rolAile)) return true
  if (!rolAile) return false
  return REINTEGROS_ALLOWED_ROLES_AILE.some(
    (allowed) => normalizeInstitutionalRole(allowed) === normalizeInstitutionalRole(rolAile)
  )
}

// Categorías financieras por defecto
export const DEFAULT_CATEGORIAS_INGRESOS = [
  'Cuotas',
  'Inscripciones a modelos',
  'Donaciones',
  'Sponsors',
  'Otros ingresos',
]

export const DEFAULT_CATEGORIAS_EGRESOS = [
  'Logística',
  'Catering',
  'Papelería e impresiones',
  'Alquiler de espacios',
  'Honorarios',
  'Merchandising',
  'Otros egresos',
]

const INSTITUTIONAL_GLOBAL_MANAGER_ROLES = new Set(
  COMISION_DIRECTIVA_ROLES_AILE.map((roleName) => normalizeInstitutionalRole(roleName))
)

const FINANZAS_DEBT_MANAGER_ROLE_ALIASES = [
  'director de finanzas',
  'directora de finanzas',
]

const FINANZAS_OPERATION_ROLE_ALIASES = [
  ...FINANZAS_DEBT_MANAGER_ROLE_ALIASES,
  'miembro de finanzas',
  'tesorero',
]

const RRHH_ROLE_ALIASES = [
  'director de rrhh',
  'directora de rrhh',
  'director de recursos humanos',
  'directora de recursos humanos',
  'miembro de rrhh',
  'miembro de recursos humanos',
]

type PermissionOverrides = Partial<Record<Recurso, Accion[]>>
type PermissionActionOverrides = Partial<Record<Accion, boolean>>
type PermissionResourceOverrides = Partial<Record<Recurso, PermissionActionOverrides>>

export type RolePermissionOverridesMap = Partial<Record<string, PermissionResourceOverrides>>

const INSTITUTIONAL_ROLE_OVERRIDES: Record<string, PermissionOverrides> = {}

for (const roleName of RRHH_ROLE_ALIASES) {
  INSTITUTIONAL_ROLE_OVERRIDES[roleName] = {
    socios: ['ver', 'editar'],
  }
}

for (const roleName of FINANZAS_OPERATION_ROLE_ALIASES) {
  INSTITUTIONAL_ROLE_OVERRIDES[roleName] = {
    finanzas: ['ver'],
    tesoreria: ['ver'],
    reintegros: ['ver', 'crear'],
  }
}

for (const roleName of FINANZAS_DEBT_MANAGER_ROLE_ALIASES) {
  INSTITUTIONAL_ROLE_OVERRIDES[roleName] = {
    ...INSTITUTIONAL_ROLE_OVERRIDES[roleName],
    deudas: ['ver', 'editar'],
  }
}

export function normalizeInstitutionalRole(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasInstitutionalOverride(
  recurso: Recurso,
  accion: Accion,
  rolAile?: string | null
): boolean {
  const normalizedRole = normalizeInstitutionalRole(rolAile)
  if (!normalizedRole) return false

  const overrides = INSTITUTIONAL_ROLE_OVERRIDES[normalizedRole]
  if (!overrides) return false

  return overrides[recurso]?.includes(accion) ?? false
}

function getDynamicInstitutionalOverride(
  recurso: Recurso,
  accion: Accion,
  rolAile?: string | null,
  roleOverrides?: RolePermissionOverridesMap
): boolean | undefined {
  if (!roleOverrides) return undefined
  const normalizedRole = normalizeInstitutionalRole(rolAile)
  if (!normalizedRole) return undefined
  return roleOverrides[normalizedRole]?.[recurso]?.[accion]
}

export function isGlobalManager(rol: Rol, rolAile?: string | null): boolean {
  if (rol === 'admin' || rol === 'comision_directiva') return true
  return INSTITUTIONAL_GLOBAL_MANAGER_ROLES.has(normalizeInstitutionalRole(rolAile))
}

// Matriz de permisos base (global managers se resuelven en hasPermission)
export const PERMISSIONS: Record<Recurso, Record<Accion, Rol[]>> = {
  dashboard: {
    ver: ['socio', 'comision_directiva', 'revisor_cuentas', 'admin'],
    crear: [],
    editar: [],
    eliminar: [],
    aprobar: [],
  },
  calendario: {
    ver: ['socio', 'comision_directiva', 'revisor_cuentas', 'admin'],
    crear: ['comision_directiva', 'admin'],
    editar: ['comision_directiva', 'admin'],
    eliminar: ['comision_directiva', 'admin'],
    aprobar: [],
  },
  tareas: {
    ver: ['socio', 'comision_directiva', 'revisor_cuentas', 'admin'],
    crear: [],
    editar: [],
    eliminar: [],
    aprobar: [],
  },
  socios: {
    ver: ['comision_directiva', 'revisor_cuentas', 'admin'],
    crear: ['comision_directiva', 'admin'],
    editar: ['comision_directiva', 'admin'],
    eliminar: ['admin'],
    aprobar: [],
  },
  deudas: {
    ver: ['comision_directiva', 'revisor_cuentas', 'admin'],
    crear: ['comision_directiva', 'admin'],
    editar: ['comision_directiva', 'admin'],
    eliminar: ['admin'],
    aprobar: [],
  },
  movimientos: {
    ver: ['socio', 'comision_directiva', 'revisor_cuentas', 'admin'],
    crear: ['comision_directiva', 'admin'],
    editar: ['comision_directiva', 'admin'],
    eliminar: ['admin'],
    aprobar: [],
  },
  finanzas: {
    ver: ['comision_directiva', 'revisor_cuentas', 'admin'],
    crear: ['comision_directiva', 'admin'],
    editar: ['comision_directiva', 'admin'],
    eliminar: ['admin'],
    aprobar: [],
  },
  tesoreria: {
    ver: ['comision_directiva', 'revisor_cuentas', 'admin'],
    crear: ['comision_directiva', 'admin'],
    editar: ['comision_directiva', 'admin'],
    eliminar: ['admin'],
    aprobar: [],
  },
  reintegros: {
    ver: ['comision_directiva', 'admin'],
    crear: ['comision_directiva', 'admin'],
    editar: ['comision_directiva', 'admin'],
    eliminar: ['admin'],
    aprobar: ['comision_directiva', 'admin'],
  },
  documentos: {
    ver: ['comision_directiva', 'revisor_cuentas', 'admin'],
    crear: ['comision_directiva', 'admin'],
    editar: ['comision_directiva', 'admin'],
    eliminar: ['admin'],
    aprobar: [],
  },
  configuracion: {
    ver: ['comision_directiva', 'admin'],
    crear: ['comision_directiva', 'admin'],
    editar: ['comision_directiva', 'admin'],
    eliminar: ['admin'],
    aprobar: [],
  },
  estatuto: {
    ver: ['comision_directiva', 'revisor_cuentas', 'admin'],
    crear: [],
    editar: ['admin'],
    eliminar: [],
    aprobar: [],
  },
  resoluciones: {
    ver: ['comision_directiva', 'revisor_cuentas', 'admin'],
    crear: ['comision_directiva', 'admin'],
    editar: ['comision_directiva', 'admin'],
    eliminar: ['admin'],
    aprobar: [],
  },
  balances: {
    ver: ['comision_directiva', 'revisor_cuentas', 'admin'],
    crear: ['comision_directiva', 'admin'],
    editar: ['comision_directiva', 'admin'],
    eliminar: ['admin'],
    aprobar: ['comision_directiva', 'admin'],
  },
  logs: {
    ver: ['comision_directiva', 'admin'],
    crear: [],
    editar: [],
    eliminar: [],
    aprobar: [],
  },
  reuniones: {
    ver: ['socio', 'comision_directiva', 'revisor_cuentas', 'admin'],
    crear: ['comision_directiva', 'admin'],
    editar: ['comision_directiva', 'admin'],
    eliminar: ['admin'],
    aprobar: [],
  },
}

// Estados de socios
export const ESTADO_SOCIO_LABELS: Record<string, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  eliminado: 'Eliminado',
}

export const ESTADO_SOCIO_COLORS: Record<string, { bg: string; text: string }> = {
  activo: { bg: 'bg-green-500/20', text: 'text-green-500' },
  inactivo: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  eliminado: { bg: 'bg-red-500/20', text: 'text-red-500' },
}

// Estados de cuotas
export const ESTADO_CUOTA_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  pagada: 'Pagada',
  parcial: 'Parcial',
  vencida: 'Vencida',
}

export const ESTADO_CUOTA_COLORS: Record<string, { bg: string; text: string }> = {
  pendiente: { bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
  pagada: { bg: 'bg-green-500/20', text: 'text-green-500' },
  parcial: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
  vencida: { bg: 'bg-red-500/20', text: 'text-red-500' },
}

// Estados de resoluciones
export const ESTADO_RESOLUCION_LABELS: Record<string, string> = {
  vigente: 'Vigente',
  derogada: 'Derogada',
}

export const ESTADO_RESOLUCION_COLORS: Record<string, { bg: string; text: string }> = {
  vigente: { bg: 'bg-[#6314a7]/20', text: 'text-[#9341bf]' },
  derogada: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
}

// Estados de balances
export const ESTADO_BALANCE_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  aprobado_cd: 'Aprobado por CD',
  aprobado_asamblea: 'Aprobado por Asamblea',
}

export const ESTADO_BALANCE_COLORS: Record<string, { bg: string; text: string }> = {
  borrador: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  aprobado_cd: { bg: 'bg-[#6314a7]/20', text: 'text-[#9341bf]' },
  aprobado_asamblea: { bg: 'bg-green-500/20', text: 'text-green-500' },
}

// Helper de permisos
export function hasPermission(
  rol: Rol,
  recurso: Recurso,
  accion: Accion,
  rolAile?: string | null,
  roleOverrides?: RolePermissionOverridesMap
): boolean {
  if (isGlobalManager(rol, rolAile)) return true
  const dynamicOverride = getDynamicInstitutionalOverride(recurso, accion, rolAile, roleOverrides)
  if (typeof dynamicOverride === 'boolean') return dynamicOverride
  if (hasInstitutionalOverride(recurso, accion, rolAile)) return true
  return PERMISSIONS[recurso]?.[accion]?.includes(rol) ?? false
}

export function canWrite(
  rol: Rol,
  recurso: Recurso,
  rolAile?: string | null,
  roleOverrides?: RolePermissionOverridesMap
): boolean {
  return hasPermission(rol, recurso, 'crear', rolAile, roleOverrides)
    || hasPermission(rol, recurso, 'editar', rolAile, roleOverrides)
}

// Configuración de paginación
export const PAGINATION = {
  defaultLimit: 15,
  sociosLimit: 15,
  deudasLimit: 20,
  logsLimit: 20,
  maxLimit: 100,
}

// Inline style colors for badges (for components that use style prop)
export const ESTADO_SOCIO_INLINE = {
  activo: { bg: '#ecfdf5', text: '#059669', label: 'Activo' },
  inactivo: { bg: '#f3f4f6', text: '#6b7280', label: 'Inactivo' },
  eliminado: { bg: '#fef2f2', text: '#dc2626', label: 'Eliminado' },
} as const

export const ESTADO_CUOTA_INLINE = {
  pagada: { bg: '#ecfdf5', text: '#059669', label: 'Pagada' },
  pendiente: { bg: '#fef3c7', text: '#b45309', label: 'Pendiente' },
  parcial: { bg: '#fef3c7', text: '#b45309', label: 'Parcial' },
  vencida: { bg: '#fef2f2', text: '#dc2626', label: 'Vencida' },
} as const

export const ROL_INLINE: Record<string, { bg: string; text: string }> = {
  socio: { bg: '#f3f4f6', text: '#6b7280' },
  comision_directiva: { bg: '#ede5f7', text: '#6314a7' },
  revisor_cuentas: { bg: '#fef3c7', text: '#b45309' },
  admin: { bg: '#fde2e8', text: '#e50051' },
}

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const

// Configuración de almacenamiento
export const STORAGE_BUCKETS = {
  avatares: 'avatares',
  comprobantes: 'comprobantes',
  resoluciones: 'resoluciones',
  balances: 'balances',
}

// Límites de archivo
export const FILE_LIMITS = {
  imageMaxSize: 5 * 1024 * 1024, // 5MB
  pdfMaxSize: 10 * 1024 * 1024, // 10MB
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedPdfTypes: ['application/pdf'],
}

// Constantes para el módulo de Documentos
export const ESTADOS_RESOLUCION_DOCS = {
  VIGENTE: 'vigente',
  DEROGADA: 'derogada',
} as const

export const TIPOS_RESOLUCION_DOCS = {
  ASAMBLEA: 'asamblea',
  DECRETO: 'decreto',
} as const

export const ESTADOS_BALANCE_DOCS = {
  BORRADOR: 'borrador',
  APROBADO_CD: 'aprobado_cd',
  APROBADO_ASAMBLEA: 'aprobado_asamblea',
} as const

export const TIPOS_BALANCE_DOCS = {
  MENSUAL: 'mensual',
  TRIMESTRAL: 'trimestral',
  ANUAL: 'anual',
} as const
