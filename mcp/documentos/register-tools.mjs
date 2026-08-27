import * as z from 'zod/v4';

const typeSchema = z.enum([
  'acta_constitutiva_estatuto',
  'acta_cd',
  'acta_asamblea',
  'resolucion_cd',
  'constancia_ipj',
  'libro_digital',
  'otro',
]);

const stateSchema = z.enum([
  'borrador',
  'pendiente_firma',
  'firmado',
  'presentado_ipj',
  'inscripto_ipj',
  'rechazado',
  'reemplazado',
]);

const componentSchema = z.object({
  tipo: z.string().min(1),
  numero: z.number().int().positive().optional(),
  anio: z.number().int().min(1900).max(2200).optional(),
  titulo: z.string().optional(),
});

export function registerDocumentTools(server, service, { local = false } = {}) {
  server.registerTool('aile_documents_list', {
    title: 'Listar archivo legal',
    description: 'Lista actas, estatuto, resoluciones y constancias del archivo jurídico privado de AILE.',
    inputSchema: {
      search: z.string().optional(),
      tipo: typeSchema.optional(),
      estado_registro: stateSchema.optional(),
      anio: z.number().int().min(1900).max(2200).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
  }, async (input) => service.list(input));

  server.registerTool('aile_documents_get', {
    title: 'Abrir documento legal',
    description: 'Obtiene metadatos y un enlace privado temporal de 5 minutos para descargar un PDF legal.',
    inputSchema: {
      document_id: z.string().uuid(),
    },
  }, async ({ document_id }) => service.get(document_id));

  server.registerTool('aile_documents_update_metadata', {
    title: 'Actualizar estado de documento legal',
    description: 'Actualiza metadatos jurídicos sin reemplazar ni sobrescribir el PDF original. Soporta dry_run.',
    inputSchema: {
      document_id: z.string().uuid(),
      titulo: z.string().optional(),
      descripcion: z.string().optional(),
      estado_registro: stateSchema.optional(),
      es_vigente: z.boolean().optional(),
      firma_digital: z.boolean().optional(),
      organismo_registro: z.string().optional(),
      expediente: z.string().optional(),
      componentes: z.array(componentSchema).optional(),
      dry_run: z.boolean().optional(),
    },
  }, async (input) => service.update(input));

  if (local) {
    server.registerTool('aile_documents_upload_local_pdf', {
      title: 'Subir PDF legal desde este equipo',
      description: 'Valida, calcula SHA-256 y sube un PDF local al repositorio privado de AILE. Usa dry_run primero cuando la clasificación no sea obvia.',
      inputSchema: {
        file_path: z.string().describe('Ruta absoluta al PDF en el equipo donde corre el MCP.'),
        tipo: typeSchema,
        titulo: z.string().min(3).max(240),
        descripcion: z.string().optional(),
        numero: z.number().int().positive().optional(),
        anio: z.number().int().min(1900).max(2200).optional(),
        fecha_documento: z.string().optional().describe('Fecha YYYY-MM-DD.'),
        estado_registro: stateSchema.optional(),
        es_vigente: z.boolean().optional(),
        firma_digital: z.boolean().optional(),
        organismo_registro: z.string().optional(),
        expediente: z.string().optional(),
        registrado_at: z.string().optional(),
        componentes: z.array(componentSchema).optional(),
        etiquetas: z.array(z.string()).optional(),
        resolucion_ids: z.array(z.string().uuid()).optional(),
        dry_run: z.boolean().optional(),
      },
    }, async (input) => service.uploadLocal(input));
  }
}
