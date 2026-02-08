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

export type RolAile =
  | 'Presidente'
  | 'Vicepresidente'
  | 'Secretario General'
  | 'Tesorero'
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

// Tipos para el módulo de Documentos
export interface ArticuloEstatuto {
  id: string
  capitulo: number
  articulo: number
  titulo: string
  contenido: string // Markdown
  archivo_url?: string // PDF URL for specific article or full statute link
  updated_at: string
  editado_por?: string
}

export interface Resolucion {
  id: string
  tipo: TipoResolucion
  numero: number
  anio: number
  fecha: string
  titulo: string
  contenido: string // Markdown/HTML
  estado: EstadoResolucion
  archivo_url?: string // PDF URL
  creado_por: string
  created_at: string
}

export interface Balance {
  id: string
  periodo: string
  tipo: TipoBalance
  total_ingresos: number
  total_egresos: number
  saldo: number
  estado: EstadoBalance
  archivo_url?: string // PDF URL
  aprobado_por?: string
  created_at: string
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
  | 'socios'
  | 'deudas'
  | 'finanzas'
  | 'tesoreria'
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
