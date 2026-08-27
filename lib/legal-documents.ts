export type TipoDocumentoLegal =
  | 'acta_constitutiva_estatuto'
  | 'acta_cd'
  | 'acta_asamblea'
  | 'resolucion_cd'
  | 'constancia_ipj'
  | 'libro_digital'
  | 'otro'

export type EstadoRegistroDocumento =
  | 'borrador'
  | 'pendiente_firma'
  | 'firmado'
  | 'presentado_ipj'
  | 'inscripto_ipj'
  | 'rechazado'
  | 'reemplazado'

export interface ComponenteDocumentoLegal {
  tipo: 'acta_constitutiva' | 'estatuto' | 'acta_cd' | 'acta_asamblea' | 'resolucion_cd' | 'otro'
  numero?: number
  anio?: number
  titulo?: string
}

export interface DocumentoLegal {
  id: string
  tipo: TipoDocumentoLegal
  titulo: string
  descripcion?: string | null
  numero?: number | null
  anio?: number | null
  fecha_documento?: string | null
  estado_registro: EstadoRegistroDocumento
  es_vigente: boolean
  firma_digital: boolean
  organismo_registro?: string | null
  expediente?: string | null
  registrado_at?: string | null
  componentes: ComponenteDocumentoLegal[]
  etiquetas: string[]
  bucket: 'documentos-legales'
  storage_path: string
  nombre_archivo: string
  mime_type: 'application/pdf'
  tamano_bytes: number
  sha256: string
  documento_padre_id?: string | null
  visibilidad?: 'privado' | 'publico'
  nivel_acceso?: 'institucional' | 'secretaria' | 'proteccion_nna'
  publicado_at?: string | null
  titulo_publico?: string | null
  descripcion_publica?: string | null
  created_by_socio_id: string
  created_at: string
  updated_at: string
}
