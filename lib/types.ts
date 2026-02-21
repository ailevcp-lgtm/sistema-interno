// Tipos globales compartidos para AILE Sistema Interno

export type TipoNotificacion = 'info' | 'alerta' | 'exito' | 'error'

export interface Notificacion {
  id: string
  usuario_id: string
  titulo: string
  mensaje: string
  leida: boolean
  tipo: TipoNotificacion
  link?: string
  created_at: string
}

export type Rol = 'socio' | 'comision_directiva' | 'revisor_cuentas' | 'admin'
export type EstadoSocio = 'activo' | 'inactivo' | 'eliminado'
export type EstadoCuota = 'pendiente' | 'pagada' | 'parcial' | 'vencida'
export type TipoMovimiento = 'ingreso' | 'egreso'
export type TipoResolucion = 'asamblea' | 'decreto'
export type EstadoResolucion = 'vigente' | 'derogada'
export type EstadoBalance = 'borrador' | 'aprobado_cd' | 'aprobado_asamblea'
export type TipoBalance = 'mensual' | 'trimestral' | 'anual'
export type ReintegroEstado =
  | 'borrador'
  | 'pendiente_aprobacion'
  | 'observada'
  | 'aprobada_pendiente_pago'
  | 'rechazada'
  | 'pagada'
  | 'cancelada'

export type RolAile =
  | 'Presidente'
  | 'Vicepresidente'
  | 'Secretario General'
  | 'Director de Finanzas'
  | 'Tesorero'
  | 'Revisor de Cuentas'
  | 'Vocal Titular'
  | 'Vocal Suplente'
  | 'Revisor de Cuentas Titular'
  | 'Revisor de Cuentas Suplente'
  | 'Socio'

export interface Usuario {
  id: string
  email: string
  nombre: string
  apellido: string
  avatar_url?: string
  rol: Rol
}

export interface RolAileDefinition {
  id: string
  nombre: string
}

export interface Socio {
  id: string
  usuario_id: string
  dni: string
  nombre: string
  apellido: string
  email: string
  telefono?: string
  fecha_ingreso: string
  estado: EstadoSocio
  avatar_url?: string
  rol_aile?: RolAile | string // Keeping string fallback for legacy data compatibility
  rol_aile_id?: string
  rol_aile_definicion?: RolAileDefinition
  created_at: string
  tiene_deuda?: boolean
}

export type CalendarioAlcanceReunion = 'personalizada' | 'comision_directiva' | 'general'
export type CalendarioParticipacionReunion = 'invitado' | 'involucrado'
export type CalendarioEstadoPlanificacion = 'tentativo' | 'definitivo'

export interface SocioCalendario {
  id: string
  usuario_id: string
  nombre: string
  apellido: string
  email?: string | null
  rol: Rol
  rol_aile?: string | null
}

export interface ReunionCalendarioParticipante {
  id: string
  reunion_id: string
  usuario_id: string
  socio_id: string
  participacion: CalendarioParticipacionReunion
  created_at: string
  socio?: SocioCalendario
}

export interface ReunionCalendario {
  id: string
  titulo: string
  descripcion?: string | null
  lugar?: string | null
  fecha_inicio: string
  fecha_fin: string
  alcance: CalendarioAlcanceReunion
  created_by: string
  created_at: string
  updated_at: string
  participantes?: ReunionCalendarioParticipante[]
}

export interface PlanificacionCalendario {
  id: string
  titulo: string
  descripcion?: string | null
  fecha_inicio: string
  fecha_fin: string
  estado: CalendarioEstadoPlanificacion
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface TareaVencimientoCalendario {
  id: string
  proyecto_id: string
  proyecto_nombre?: string | null
  titulo: string
  descripcion?: string | null
  fecha_limite: string
  estado_backend?: EstadoTareaWorkflow | string | null
}

export type TipoProyectoTarea = 'institucional' | 'interno_direccion'
export type DireccionBase = 'CEA' | 'Finanzas' | 'Recursos Humanos' | 'Comunicación'
export type EstadoProyectoTarea =
  | 'borrador'
  | 'en_ejecucion'
  | 'enviado_cd'
  | 'aprobado_cd'
  | 'archivado'
export type EstadoTareaKanban = 'pendiente' | 'en_progreso' | 'en_revision' | 'completada'
export type EstadoTareaWorkflow =
  | 'backlog'
  | 'por_hacer'
  | 'en_progreso'
  | 'en_revision_direccion'
  | 'pendiente_handoff'
  | 'pendiente_aprobacion_cd'
  | 'observada_cd'
  | 'aprobada_cd'
  | 'cerrada'

export interface ProyectoTarea {
  id: string
  nombre: string
  descripcion?: string | null
  tipo: TipoProyectoTarea
  orden?: number | null
  direccion_id?: string | null
  direccion?: DireccionBase | null
  estado: EstadoProyectoTarea
  activo?: boolean
  fecha_cierre?: string | null
  responsable_socio_id?: string | null
  created_by?: string | null
  updated_by?: string | null
  created_at: string
  updated_at?: string | null
}

export interface TareaProyecto {
  id: string
  proyecto_id: string
  titulo: string
  descripcion?: string | null
  estado: EstadoTareaKanban
  estado_backend?: EstadoTareaWorkflow
  prioridad?: 'baja' | 'media' | 'alta' | 'critica' | null
  orden?: number | null
  fecha_limite?: string | null
  direccion_responsable_id?: string | null
  direccion_responsable?: DireccionBase | null
  asignado_usuario_id?: string | null
  asignado_socio_id?: string | null
  created_by?: string | null
  updated_by?: string | null
  created_at: string
  updated_at?: string | null
}

export interface SubtareaProyecto {
  id: string
  tarea_id: string
  titulo: string
  descripcion?: string | null
  estado: EstadoTareaKanban
  estado_backend?: EstadoTareaWorkflow
  orden?: number | null
  asignado_usuario_id?: string | null
  asignado_socio_id?: string | null
  created_by?: string | null
  updated_by?: string | null
  created_at: string
  updated_at?: string | null
}

export interface UsuarioAsignableTarea {
  socio_id: string
  usuario_id: string
  nombre: string
  apellido: string
  email?: string | null
  rol: Rol
  rol_aile?: string | null
}

export interface TareaAprobacionCD {
  id: string
  tarea_id: string
  socio_id: string
  decision: 'pendiente' | 'aprobada' | 'observada' | 'rechazada'
  observacion?: string | null
  aprobado_at?: string | null
  metadata?: Record<string, unknown>
  created_at: string
  updated_at?: string | null
}

export interface AccesoProyectoTarea {
  canManage: boolean
  canCreate: boolean
  canAssign: boolean
  canHandoff: boolean
  canDelete: boolean
  canSubmitCd: boolean
  canApproveCd: boolean
  canEditAssigned: boolean
  readOnly: boolean
}

export interface Cuota {
  id: string
  socio_id: string
  periodo: string
  monto_esperado: number
  monto_pagado: number
  fecha_pago?: string
  estado: EstadoCuota
  comprobante_url?: string
  registrado_por?: string
  created_at: string
  // Relaciones
  socio?: Socio
}

export interface CategoriaFinanciera {
  id: string
  nombre: string
  tipo: TipoMovimiento
  activa: boolean
  created_at?: string
}

export interface Movimiento {
  id: string
  tipo: TipoMovimiento
  categoria_id: string
  monto: number
  fecha: string
  descripcion: string
  comprobante_url?: string
  registrado_por: string
  aprobado_por?: string
  periodo: string
  created_at: string
  // Relaciones
  categoria?: CategoriaFinanciera
  registradoPor?: Usuario
}

export interface SolicitudReintegro {
  id: string
  numero: string
  solicitante_socio_id: string
  tesorero_socio_id?: string | null
  estado: ReintegroEstado
  fecha_gasto: string
  fecha_solicitud?: string | null
  fecha_aprobacion?: string | null
  fecha_pago?: string | null
  categoria_id?: string | null
  cuenta_pago_id?: string | null
  monto_solicitado: number
  monto_aprobado?: number | null
  moneda: string
  descripcion: string
  factura_url: string
  factura_numero?: string | null
  factura_emisor?: string | null
  motivo_rechazo?: string | null
  motivo_observacion?: string | null
  comprobante_pago_url?: string | null
  movimiento_id?: string | null
  created_at: string
  updated_at: string
  created_by?: string | null
  updated_by?: string | null
  solicitante?: Socio
  tesorero?: Socio
  categoria?: CategoriaFinanciera
  cuenta_pago?: Cuenta
}

export interface SolicitudReintegroHistorial {
  id: string
  solicitud_id: string
  accion: string
  estado_anterior?: ReintegroEstado | null
  estado_nuevo?: ReintegroEstado | null
  comentario?: string | null
  metadata: Record<string, unknown>
  actor_user_id: string
  actor_socio_id?: string | null
  created_at: string
  actor_socio?: Socio
}

export interface CrearSolicitudReintegroPayload {
  fecha_gasto: string
  categoria_id?: string
  monto_solicitado: number
  moneda?: string
  descripcion: string
  factura_url: string
  factura_numero?: string
  factura_emisor?: string
  tesorero_socio_id?: string
  solicitante_socio_id?: string
}

export interface RegistrarPagoReintegroPayload {
  solicitud_id: string
  cuenta_pago_id: string
  fecha_pago: string
  comprobante_pago_url: string
}

export interface Resolucion {
  id: string
  tipo: TipoResolucion
  numero: number
  anio: number
  fecha: string
  titulo: string
  contenido: string
  estado: EstadoResolucion
  archivo_url?: string
  creado_por: string
  created_at: string
  // Relaciones
  creadoPor?: Usuario
}

export interface ArticuloEstatuto {
  id: string
  capitulo: number
  articulo: string
  titulo: string
  contenido: string
  updated_at: string
  editado_por?: string
  // Relaciones
  editadoPor?: Usuario
}

export interface Balance {
  id: string
  periodo: string
  tipo: TipoBalance
  total_ingresos: number
  total_egresos: number
  saldo: number
  estado: EstadoBalance
  archivo_url?: string
  aprobado_por?: string
  created_at: string
  // Relaciones
  aprobadoPor?: Usuario
}

export interface LogActividad {
  id: string
  usuario_id: string
  accion: string
  detalle: string
  created_at: string
  // Relaciones
  usuario?: Usuario
}

// Tipos para navegación y UI
export interface NavItem {
  href: string
  label: string
  icon: string
  requiredRoles?: Rol[]
  hiddenRoles?: Rol[]
}

// Tipos para filtros y paginación
export interface PaginationParams {
  page: number
  limit: number
}

export interface FilterParams {
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// Tipos para permisos
export type Recurso =
  | 'dashboard'
  | 'calendario'
  | 'tareas'
  | 'socios'
  | 'deudas'
  | 'movimientos'
  | 'finanzas'
  | 'tesoreria'
  | 'reintegros'
  | 'documentos'
  | 'configuracion'
  | 'estatuto'
  | 'resoluciones'
  | 'balances'
  | 'logs'

export type Accion = 'ver' | 'crear' | 'editar' | 'eliminar' | 'aprobar'

// ── Tipos financieros extendidos (Power BI migration) ──────

export interface Evento {
  id: string
  nombre: string
  anio?: number
  activo: boolean
  created_at?: string
}

export interface SubcategoriaFinanciera {
  id: string
  categoria_id: string
  nombre: string
  activa: boolean
  created_at?: string
  categoria?: CategoriaFinanciera
}

export interface Cuenta {
  id: string
  nombre: string
  tipo: 'efectivo' | 'digital' | 'banco'
  activa: boolean
  created_at?: string
}

export interface ImportBatch {
  id: string
  archivo_origen: string
  hoja_origen?: string
  filas_totales: number
  filas_insertadas: number
  filas_duplicadas: number
  filas_error: number
  importado_por?: string
  created_at?: string
}

// Extended Movimiento with new fields
export interface MovimientoExtended extends Movimiento {
  evento_id?: string
  subcategoria_id?: string
  cuenta_id?: string
  voluntario_nombre?: string
  moneda?: string
  import_batch_id?: string
  external_id?: string
  row_hash?: string
  socio_id?: string
  anulado?: boolean
  anulado_at?: string
  anulado_por?: string
  anulado_motivo?: string
  evento?: Evento
  subcategoria?: SubcategoriaFinanciera
  cuenta?: Cuenta
  socio?: Socio
  cuota_aplicaciones?: CuotaAplicacion[]
}

// ── Cuotas ↔ Movimientos integration types ────────────────────

export interface CuotaAplicacion {
  id: string
  movimiento_id: string
  cuota_id: string
  monto_aplicado: number
  created_at: string
  cuota?: Cuota
}

export interface PromocionCuota {
  id: string
  nombre: string
  descripcion?: string
  tipo: 'percent' | 'fixed'
  valor: number
  meses_min?: number
  meses_max?: number
  activa: boolean
  created_at: string
}

export interface MovimientoPromocionCuota {
  id: string
  movimiento_id: string
  promocion_id?: string
  descuento_monto: number
  snapshot: Record<string, unknown>
  created_at: string
  promocion?: PromocionCuota
}

export interface CuotaResumen {
  id: string
  socio_id: string
  socio_nombre: string
  socio_apellido: string
  periodo: string
  monto_esperado: number
  monto_pagado: number
  saldo: number
  estado: EstadoCuota
  vencimiento?: string
  fecha_ultimo_pago?: string
}

// ── Finance Dashboard Types ────────────────────────────────

export interface FinanceFilters {
  anio?: number
  categoriaId?: string
  eventoId?: string
}

export interface FinanceSummary {
  balance: number
  ingresos: number
  egresos: number
  gananciaPorcentual: number
}

export interface MonthlyDetail {
  periodo: string
  mes: string
  mesNum: number
  ingresos: number
  egresos: number
  saldo: number
  acumulado: number
}

export interface CategoryContribution {
  categoriaId: string
  categoria: string
  tipo: 'ingreso' | 'egreso'
  ingresos: number
  egresos: number
  balance: number
}

export interface EventSummary {
  eventoId: string
  evento: string
  anio?: number
  ingresos: number
  egresos: number
  saldo: number
}

export interface CategorySummaryRow {
  categoriaId: string
  categoria: string
  total: number
  porcentaje: number
}

export interface TransactionRow {
  id: string
  fecha: string
  descripcion: string
  categoria: string
  categoriaId: string
  monto: number
  tipo: TipoMovimiento
  evento?: string
  voluntario?: string
  cuenta?: string
}
