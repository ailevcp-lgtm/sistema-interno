import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'documentos-legales';
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MANAGER_ROLES = new Set(['admin', 'comision_directiva']);
const TYPES = new Set([
  'acta_constitutiva_estatuto',
  'acta_cd',
  'acta_asamblea',
  'resolucion_cd',
  'constancia_ipj',
  'libro_digital',
  'otro',
]);
const STATES = new Set([
  'borrador',
  'pendiente_firma',
  'firmado',
  'presentado_ipj',
  'inscripto_ipj',
  'rechazado',
  'reemplazado',
]);

function response(summary, payload) {
  return {
    content: [{ type: 'text', text: `${summary}\n\n${JSON.stringify(payload, null, 2)}` }],
    structuredContent: payload,
  };
}

function requiredText(value, label, max = 240) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(`${label} es obligatorio.`);
  if (normalized.length > max) throw new Error(`${label} supera ${max} caracteres.`);
  return normalized;
}

function optionalText(value, max = 1000) {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (normalized.length > max) throw new Error(`Un campo de texto supera ${max} caracteres.`);
  return normalized;
}

function dateOnly(value) {
  if (!value) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('fecha_documento debe usar formato YYYY-MM-DD.');
  }
  return value;
}

function positiveInteger(value, label) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} debe ser un entero positivo.`);
  return parsed;
}

function normalizeType(value) {
  if (!TYPES.has(value)) throw new Error(`Tipo documental inválido: ${value}.`);
  return value;
}

function normalizeState(value) {
  const normalized = value || 'borrador';
  if (!STATES.has(normalized)) throw new Error(`Estado registral inválido: ${value}.`);
  return normalized;
}

function safeFilename(value) {
  return path.basename(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'documento.pdf';
}

function normalizedComponents(value) {
  if (!value) return [];
  if (!Array.isArray(value)) throw new Error('componentes debe ser una lista.');
  return value.map((item) => ({
    tipo: requiredText(item?.tipo, 'componentes[].tipo', 80),
    ...(item?.numero == null ? {} : { numero: positiveInteger(item.numero, 'componentes[].numero') }),
    ...(item?.anio == null ? {} : { anio: positiveInteger(item.anio, 'componentes[].anio') }),
    ...(optionalText(item?.titulo, 240) ? { titulo: optionalText(item.titulo, 240) } : {}),
  }));
}

function documentPayload(input, file, actorSocioId) {
  const type = normalizeType(input.tipo);
  const registrationState = normalizeState(input.estado_registro);
  const year = positiveInteger(input.anio, 'anio');

  return {
    tipo: type,
    titulo: requiredText(input.titulo, 'titulo'),
    descripcion: optionalText(input.descripcion, 2000),
    numero: positiveInteger(input.numero, 'numero'),
    anio: year,
    fecha_documento: dateOnly(input.fecha_documento),
    estado_registro: registrationState,
    es_vigente: input.es_vigente ?? !['rechazado', 'reemplazado'].includes(registrationState),
    firma_digital: input.firma_digital === true,
    organismo_registro: optionalText(input.organismo_registro, 240),
    expediente: optionalText(input.expediente, 240),
    registrado_at: registrationState === 'inscripto_ipj' ? (input.registrado_at || new Date().toISOString()) : null,
    componentes: normalizedComponents(input.componentes),
    etiquetas: Array.isArray(input.etiquetas)
      ? [...new Set(input.etiquetas.map((item) => String(item).trim().toLowerCase()).filter(Boolean))].slice(0, 20)
      : ['legal'],
    bucket: BUCKET,
    storage_path: file.storagePath,
    nombre_archivo: file.filename,
    mime_type: 'application/pdf',
    tamano_bytes: file.size,
    sha256: file.sha256,
    created_by_socio_id: actorSocioId,
  };
}

async function resolveLocalActor(supabase, { actorSocioId, actorEmail }) {
  if (!actorSocioId && !actorEmail) {
    throw new Error('Configura AILE_MCP_ACTOR_SOCIO_ID o AILE_MCP_ACTOR_EMAIL para cargar documentos.');
  }

  let query = supabase
    .from('socios')
    .select('id, nombre, apellido, email, rol, estado')
    .eq('estado', 'activo');
  query = actorSocioId ? query.eq('id', actorSocioId) : query.ilike('email', actorEmail);
  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(`No se pudo resolver el actor del MCP: ${error.message}`);
  if (!data?.id) throw new Error('No se encontró el socio activo configurado como actor del MCP.');
  if (!MANAGER_ROLES.has(data.rol)) {
    throw new Error(`El actor ${data.nombre} ${data.apellido} no puede administrar documentos (rol: ${data.rol}).`);
  }
  return data;
}

async function inspectLocalPdf(filePath, input) {
  const canonicalPath = await realpath(requiredText(filePath, 'file_path', 4096));
  const fileStat = await stat(canonicalPath);
  if (!fileStat.isFile()) throw new Error('file_path no apunta a un archivo regular.');
  if (fileStat.size <= 0 || fileStat.size > MAX_PDF_BYTES) throw new Error('El PDF debe pesar entre 1 byte y 50 MB.');

  const buffer = await readFile(canonicalPath);
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('El archivo no tiene una firma PDF válida.');

  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const filename = path.basename(canonicalPath);
  const pathYear = input.fecha_documento?.slice(0, 4) || input.anio || new Date().getFullYear();
  const storagePath = `${normalizeType(input.tipo)}/${pathYear}/${sha256.slice(0, 16)}-${safeFilename(filename)}`;
  return { canonicalPath, buffer, filename, size: fileStat.size, sha256, storagePath };
}

function createService({ supabase, actorResolver, allowLocalFiles }) {
  async function actor() {
    const value = await actorResolver();
    if (!value?.id) throw new Error('No se pudo identificar al socio que opera el MCP.');
    return value;
  }

  return {
    async list(input = {}) {
      await actor();
      let query = supabase
        .from('documentos_legales')
        .select('*')
        .order('fecha_documento', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(input.limit || 50);

      if (input.tipo) query = query.eq('tipo', normalizeType(input.tipo));
      if (input.estado_registro) query = query.eq('estado_registro', normalizeState(input.estado_registro));
      if (input.anio) query = query.eq('anio', positiveInteger(input.anio, 'anio'));
      if (input.search) {
        const term = String(input.search).replace(/[%_,()]/g, ' ').trim();
        if (term) query = query.or(`titulo.ilike.%${term}%,descripcion.ilike.%${term}%,expediente.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(`No se pudo listar el archivo legal: ${error.message}`);
      const documents = Array.isArray(data) ? data : [];
      return response(`${documents.length} documento(s) legal(es) encontrado(s).`, { documents });
    },

    async get(documentId) {
      await actor();
      const { data, error } = await supabase
        .from('documentos_legales')
        .select('*, documentos_legales_resoluciones(resolucion_id, resoluciones(id, tipo, numero, anio, fecha, titulo, estado))')
        .eq('id', documentId)
        .maybeSingle();
      if (error) throw new Error(`No se pudo leer el documento: ${error.message}`);
      if (!data) throw new Error(`No existe un documento legal con id ${documentId}.`);

      const { data: signed, error: signedError } = await supabase.storage
        .from(data.bucket)
        .createSignedUrl(data.storage_path, 300, { download: data.nombre_archivo });
      if (signedError) throw new Error(`No se pudo firmar el acceso al PDF: ${signedError.message}`);

      return response(`Documento “${data.titulo}” listo. El enlace vence en 5 minutos.`, {
        document: data,
        signed_url: signed.signedUrl,
        signed_url_expires_in_seconds: 300,
      });
    },

    async uploadLocal(input) {
      if (!allowLocalFiles) throw new Error('La carga por file_path sólo está disponible en el MCP local de AILE.');
      const currentActor = await actor();
      const file = await inspectLocalPdf(input.file_path, input);
      const { data: duplicate, error: duplicateError } = await supabase
        .from('documentos_legales')
        .select('id, titulo, storage_path')
        .eq('sha256', file.sha256)
        .maybeSingle();
      if (duplicateError) throw new Error(`No se pudo comprobar duplicados: ${duplicateError.message}`);
      if (duplicate) {
        return response(`El PDF ya está registrado como “${duplicate.titulo}”.`, {
          mode: 'duplicate',
          sha256: file.sha256,
          existing_document: duplicate,
        });
      }

      const row = documentPayload(input, file, currentActor.id);
      if (input.dry_run) {
        return response(`Dry run listo para incorporar “${row.titulo}”.`, {
          mode: 'dry_run',
          source_path: file.canonicalPath,
          document: row,
        });
      }

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(file.storagePath, file.buffer, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw new Error(`No se pudo subir el PDF: ${uploadError.message}`);

      let created = null;
      try {
        const { data, error } = await supabase.from('documentos_legales').insert(row).select('*').single();
        if (error) throw new Error(`No se pudo registrar el PDF: ${error.message}`);
        created = data;

        if (Array.isArray(input.resolucion_ids) && input.resolucion_ids.length > 0) {
          const links = [...new Set(input.resolucion_ids)].map((resolucionId) => ({
            documento_id: created.id,
            resolucion_id: resolucionId,
          }));
          const { error: linkError } = await supabase.from('documentos_legales_resoluciones').insert(links);
          if (linkError) throw new Error(`El documento se subió pero no se pudo vincular a resoluciones: ${linkError.message}`);
        }
      } catch (error) {
        if (created?.id) await supabase.from('documentos_legales').delete().eq('id', created.id);
        await supabase.storage.from(BUCKET).remove([file.storagePath]);
        throw error;
      }

      return response(`Documento “${created.titulo}” incorporado al archivo legal.`, {
        mode: 'created',
        document: created,
      });
    },

    async update(input) {
      await actor();
      const { data: before, error: readError } = await supabase
        .from('documentos_legales')
        .select('*')
        .eq('id', input.document_id)
        .maybeSingle();
      if (readError) throw new Error(`No se pudo leer el documento: ${readError.message}`);
      if (!before) throw new Error(`No existe un documento legal con id ${input.document_id}.`);

      const updates = {};
      if (input.titulo !== undefined) updates.titulo = requiredText(input.titulo, 'titulo');
      if (input.descripcion !== undefined) updates.descripcion = optionalText(input.descripcion, 2000);
      if (input.estado_registro !== undefined) updates.estado_registro = normalizeState(input.estado_registro);
      if (input.es_vigente !== undefined) updates.es_vigente = input.es_vigente;
      if (input.firma_digital !== undefined) updates.firma_digital = input.firma_digital;
      if (input.organismo_registro !== undefined) updates.organismo_registro = optionalText(input.organismo_registro, 240);
      if (input.expediente !== undefined) updates.expediente = optionalText(input.expediente, 240);
      if (input.componentes !== undefined) updates.componentes = normalizedComponents(input.componentes);
      if (Object.keys(updates).length === 0) throw new Error('No se indicaron cambios.');

      if (input.dry_run) return response(`Dry run listo para actualizar “${before.titulo}”.`, { mode: 'dry_run', before, updates });
      const { data: after, error } = await supabase
        .from('documentos_legales')
        .update(updates)
        .eq('id', input.document_id)
        .select('*')
        .single();
      if (error) throw new Error(`No se pudo actualizar el documento: ${error.message}`);
      return response(`Documento “${after.titulo}” actualizado.`, { mode: 'updated', before, after });
    },
  };
}

export function createLocalDocumentsService({ supabaseUrl, serviceRoleKey, actorSocioId, actorEmail }) {
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let actorCache;
  return createService({
    supabase,
    allowLocalFiles: true,
    actorResolver: async () => {
      actorCache ||= await resolveLocalActor(supabase, { actorSocioId, actorEmail });
      return actorCache;
    },
  });
}

export function createRemoteDocumentsService({ supabaseClient, actor }) {
  return createService({
    supabase: supabaseClient,
    allowLocalFiles: false,
    actorResolver: async () => ({ id: actor?.socio_id, ...actor }),
  });
}

export const documentServiceInternals = { TYPES: [...TYPES], STATES: [...STATES], BUCKET, MAX_PDF_BYTES };
