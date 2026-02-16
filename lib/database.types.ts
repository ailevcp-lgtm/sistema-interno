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
      solicitudes_reintegro: {
        Row: {
          id: string
          numero: string | null
          solicitante_socio_id: string
          tesorero_socio_id: string | null
          estado: Database['public']['Enums']['reintegro_estado']
          fecha_gasto: string
          fecha_solicitud: string | null
          fecha_aprobacion: string | null
          fecha_pago: string | null
          categoria_id: string | null
          cuenta_pago_id: string | null
          monto_solicitado: number
          monto_aprobado: number | null
          moneda: string
          descripcion: string
          factura_url: string
          factura_numero: string | null
          factura_emisor: string | null
          motivo_rechazo: string | null
          motivo_observacion: string | null
          comprobante_pago_url: string | null
          movimiento_id: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          numero?: string | null
          solicitante_socio_id: string
          tesorero_socio_id?: string | null
          estado?: Database['public']['Enums']['reintegro_estado']
          fecha_gasto: string
          fecha_solicitud?: string | null
          fecha_aprobacion?: string | null
          fecha_pago?: string | null
          categoria_id?: string | null
          cuenta_pago_id?: string | null
          monto_solicitado: number
          monto_aprobado?: number | null
          moneda?: string
          descripcion: string
          factura_url: string
          factura_numero?: string | null
          factura_emisor?: string | null
          motivo_rechazo?: string | null
          motivo_observacion?: string | null
          comprobante_pago_url?: string | null
          movimiento_id?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          numero?: string | null
          solicitante_socio_id?: string
          tesorero_socio_id?: string | null
          estado?: Database['public']['Enums']['reintegro_estado']
          fecha_gasto?: string
          fecha_solicitud?: string | null
          fecha_aprobacion?: string | null
          fecha_pago?: string | null
          categoria_id?: string | null
          cuenta_pago_id?: string | null
          monto_solicitado?: number
          monto_aprobado?: number | null
          moneda?: string
          descripcion?: string
          factura_url?: string
          factura_numero?: string | null
          factura_emisor?: string | null
          motivo_rechazo?: string | null
          motivo_observacion?: string | null
          comprobante_pago_url?: string | null
          movimiento_id?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
      }
      solicitudes_reintegro_historial: {
        Row: {
          id: string
          solicitud_id: string
          accion: string
          estado_anterior: Database['public']['Enums']['reintegro_estado'] | null
          estado_nuevo: Database['public']['Enums']['reintegro_estado'] | null
          comentario: string | null
          metadata: Json
          actor_user_id: string
          actor_socio_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          solicitud_id: string
          accion: string
          estado_anterior?: Database['public']['Enums']['reintegro_estado'] | null
          estado_nuevo?: Database['public']['Enums']['reintegro_estado'] | null
          comentario?: string | null
          metadata?: Json
          actor_user_id: string
          actor_socio_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          solicitud_id?: string
          accion?: string
          estado_anterior?: Database['public']['Enums']['reintegro_estado'] | null
          estado_nuevo?: Database['public']['Enums']['reintegro_estado'] | null
          comentario?: string | null
          metadata?: Json
          actor_user_id?: string
          actor_socio_id?: string | null
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
      rpc_crear_solicitud_reintegro: {
        Args: {
          p_payload: Json
        }
        Returns: Database['public']['Tables']['solicitudes_reintegro']['Row']
      }
      rpc_enviar_solicitud_reintegro: {
        Args: {
          p_solicitud_id: string
        }
        Returns: Database['public']['Tables']['solicitudes_reintegro']['Row']
      }
      rpc_observar_solicitud_reintegro: {
        Args: {
          p_solicitud_id: string
          p_motivo: string
        }
        Returns: Database['public']['Tables']['solicitudes_reintegro']['Row']
      }
      rpc_aprobar_solicitud_reintegro: {
        Args: {
          p_solicitud_id: string
          p_monto_aprobado: number | null
        }
        Returns: Database['public']['Tables']['solicitudes_reintegro']['Row']
      }
      rpc_rechazar_solicitud_reintegro: {
        Args: {
          p_solicitud_id: string
          p_motivo: string
        }
        Returns: Database['public']['Tables']['solicitudes_reintegro']['Row']
      }
      rpc_registrar_pago_reintegro: {
        Args: {
          p_solicitud_id: string
          p_cuenta_pago_id: string
          p_fecha_pago: string
          p_comprobante_pago_url: string
        }
        Returns: Database['public']['Tables']['solicitudes_reintegro']['Row']
      }
      rpc_cancelar_solicitud_reintegro: {
        Args: {
          p_solicitud_id: string
          p_motivo: string | null
        }
        Returns: Database['public']['Tables']['solicitudes_reintegro']['Row']
      }
    }
    Enums: {
      reintegro_estado:
        | 'borrador'
        | 'pendiente_aprobacion'
        | 'observada'
        | 'aprobada_pendiente_pago'
        | 'rechazada'
        | 'pagada'
        | 'cancelada'
    }
  }
}
