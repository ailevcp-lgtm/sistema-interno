export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      socios: {
        Row: {
          id: string
          usuario_id: string
          dni: string
          nombre: string
          apellido: string
          telefono: string | null
          fecha_ingreso: string
          estado: string
          rol_aile: string | null
          created_at: string
        }
        Insert: {
          id?: string
          usuario_id: string
          dni: string
          nombre: string
          apellido: string
          telefono?: string | null
          fecha_ingreso?: string
          estado?: string
          rol_aile?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          usuario_id?: string
          dni?: string
          nombre?: string
          apellido?: string
          telefono?: string | null
          fecha_ingreso?: string
          estado?: string
          rol_aile?: string | null
          created_at?: string
        }
      }
      cuotas: {
        Row: {
          id: string
          socio_id: string
          periodo: string
          monto_esperado: number
          monto_pagado: number
          fecha_pago: string | null
          estado: string
          comprobante_url: string | null
          registrado_por: string | null
          created_at: string
        }
        Insert: {
          id?: string
          socio_id: string
          periodo: string
          monto_esperado: number
          monto_pagado?: number
          fecha_pago?: string | null
          estado?: string
          comprobante_url?: string | null
          registrado_por?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          socio_id?: string
          periodo?: string
          monto_esperado?: number
          monto_pagado?: number
          fecha_pago?: string | null
          estado?: string
          comprobante_url?: string | null
          registrado_por?: string | null
          created_at?: string
        }
      }
      categorias_financieras: {
        Row: {
          id: string
          nombre: string
          tipo: string
          activa: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          tipo: string
          activa?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          tipo?: string
          activa?: boolean
          created_at?: string
        }
      }
      movimientos: {
        Row: {
          id: string
          tipo: string
          categoria_id: string
          monto: number
          fecha: string
          descripcion: string
          comprobante_url: string | null
          registrado_por: string
          aprobado_por: string | null
          periodo: string
          created_at: string
          evento_id: string | null
          subcategoria_id: string | null
          cuenta_id: string | null
          voluntario_nombre: string | null
          moneda: string | null
          import_batch_id: string | null
          external_id: string | null
          row_hash: string | null
        }
        Insert: {
          id?: string
          tipo: string
          categoria_id?: string | null
          monto: number
          fecha: string
          descripcion: string
          comprobante_url?: string | null
          registrado_por?: string | null
          aprobado_por?: string | null
          periodo: string
          created_at?: string
          evento_id?: string | null
          subcategoria_id?: string | null
          cuenta_id?: string | null
          voluntario_nombre?: string | null
          moneda?: string | null
          import_batch_id?: string | null
          external_id?: string | null
          row_hash?: string | null
        }
        Update: {
          id?: string
          tipo?: string
          categoria_id?: string | null
          monto?: number
          fecha?: string
          descripcion?: string
          comprobante_url?: string | null
          registrado_por?: string | null
          aprobado_por?: string | null
          periodo?: string
          created_at?: string
          evento_id?: string | null
          subcategoria_id?: string | null
          cuenta_id?: string | null
          voluntario_nombre?: string | null
          moneda?: string | null
          import_batch_id?: string | null
          external_id?: string | null
          row_hash?: string | null
        }
      }
      eventos: {
        Row: {
          id: string
          nombre: string
          anio: number | null
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          anio?: number | null
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          anio?: number | null
          activo?: boolean
          created_at?: string
        }
      }
      subcategorias_financieras: {
        Row: {
          id: string
          categoria_id: string
          nombre: string
          activa: boolean
          created_at: string
        }
        Insert: {
          id?: string
          categoria_id: string
          nombre: string
          activa?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          categoria_id?: string
          nombre?: string
          activa?: boolean
          created_at?: string
        }
      }
      cuentas: {
        Row: {
          id: string
          nombre: string
          tipo: string
          activa: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          tipo: string
          activa?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          tipo?: string
          activa?: boolean
          created_at?: string
        }
      }
      import_batches: {
        Row: {
          id: string
          archivo_origen: string
          hoja_origen: string | null
          filas_totales: number
          filas_insertadas: number
          filas_duplicadas: number
          filas_error: number
          importado_por: string | null
          created_at: string
        }
        Insert: {
          id?: string
          archivo_origen: string
          hoja_origen?: string | null
          filas_totales?: number
          filas_insertadas?: number
          filas_duplicadas?: number
          filas_error?: number
          importado_por?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          archivo_origen?: string
          hoja_origen?: string | null
          filas_totales?: number
          filas_insertadas?: number
          filas_duplicadas?: number
          filas_error?: number
          importado_por?: string | null
          created_at?: string
        }
      }
      resoluciones: {
        Row: {
          id: string
          tipo: string
          numero: number
          anio: number
          fecha: string
          titulo: string
          contenido: string
          estado: string
          archivo_url: string | null
          creado_por: string
          created_at: string
        }
        Insert: {
          id?: string
          tipo: string
          numero: number
          anio: number
          fecha: string
          titulo: string
          contenido: string
          estado?: string
          archivo_url?: string | null
          creado_por: string
          created_at?: string
        }
        Update: {
          id?: string
          tipo?: string
          numero?: number
          anio?: number
          fecha?: string
          titulo?: string
          contenido?: string
          estado?: string
          archivo_url?: string | null
          creado_por?: string
          created_at?: string
        }
      }
      estatuto_articulos: {
        Row: {
          id: string
          capitulo: number
          articulo: number
          titulo: string
          contenido: string
          updated_at: string
          editado_por: string | null
        }
        Insert: {
          id?: string
          capitulo: number
          articulo: number
          titulo: string
          contenido: string
          updated_at?: string
          editado_por?: string | null
        }
        Update: {
          id?: string
          capitulo?: number
          articulo?: number
          titulo?: string
          contenido?: string
          updated_at?: string
          editado_por?: string | null
        }
      }
      balances: {
        Row: {
          id: string
          periodo: string
          tipo: string
          total_ingresos: number
          total_egresos: number
          saldo: number
          estado: string
          archivo_url: string | null
          aprobado_por: string | null
          created_at: string
        }
        Insert: {
          id?: string
          periodo: string
          tipo: string
          total_ingresos?: number
          total_egresos?: number
          estado?: string
          archivo_url?: string | null
          aprobado_por?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          periodo?: string
          tipo?: string
          total_ingresos?: number
          total_egresos?: number
          estado?: string
          archivo_url?: string | null
          aprobado_por?: string | null
          created_at?: string
        }
      }
      logs_actividad: {
        Row: {
          id: string
          usuario_id: string
          accion: string
          detalle: string
          created_at: string
        }
        Insert: {
          id?: string
          usuario_id: string
          accion: string
          detalle: string
          created_at?: string
        }
        Update: {
          id?: string
          usuario_id?: string
          accion?: string
          detalle?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
