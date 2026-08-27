#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { createLocalDocumentsService } from '../mcp/documentos/service.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..');
loadDotenv({ path: path.join(repoRoot, '.env'), quiet: true });
loadDotenv({ path: path.join(repoRoot, '.env.local'), override: true, quiet: true });

const root = '/Users/lauti/Desktop/Lauti/PROYECTOS EN DESARROLLO/AILE/SEC. GRAL. ';
const apply = process.argv.includes('--apply');
const actorEmailArg = process.argv.find((item) => item.startsWith('--actor-email='));
const actorEmail = actorEmailArg?.slice('--actor-email='.length) || process.env.AILE_MCP_ACTOR_EMAIL;

if (!actorEmail && !process.env.AILE_MCP_ACTOR_SOCIO_ID) {
  throw new Error('Indica --actor-email=EMAIL o configura AILE_MCP_ACTOR_EMAIL/AILE_MCP_ACTOR_SOCIO_ID.');
}

const documents = [
  {
    file_path: path.join(root, 'ACTA CONSTITUTIVA Y ESTATUTO DE AILE.pdf'),
    tipo: 'acta_constitutiva_estatuto',
    titulo: 'Acta constitutiva y Estatuto Social de AILE',
    descripcion: 'Instrumento constitutivo y estatuto vigente de la Asociación Civil AILE, con firmas digitales incorporadas al expediente de IPJ.',
    fecha_documento: '2026-05-13',
    anio: 2026,
    estado_registro: 'inscripto_ipj',
    es_vigente: true,
    firma_digital: true,
    organismo_registro: 'Instituto Provincial de Personas Jurídicas (IPJ) de Córdoba',
    registrado_at: '2026-06-03T16:20:11-03:00',
    componentes: [
      { tipo: 'acta_constitutiva', anio: 2026, titulo: 'Acta constitutiva de la Asociación Civil AILE' },
      { tipo: 'estatuto', anio: 2026, titulo: 'Estatuto Social de la Asociación Civil AILE' },
    ],
    etiquetas: ['legal', 'ipj', 'inscripto', 'estatuto', 'acta-constitutiva'],
  },
  {
    file_path: path.join(root, 'RESOLUCIONES PARA SUBIR A IPJ/26-6-2026/CBA_FIPJ01_2026_00007194.pdf'),
    tipo: 'acta_cd',
    titulo: 'Acta de Comisión Directiva N.º 1/2026 y resoluciones anexas',
    descripcion: 'Acta CD N.º 1 con las Resoluciones CD N.º 1/2026 y 2/2026, firmadas digitalmente e incorporadas a IPJ.',
    numero: 1,
    anio: 2026,
    fecha_documento: '2026-06-26',
    estado_registro: 'inscripto_ipj',
    es_vigente: true,
    firma_digital: true,
    organismo_registro: 'Instituto Provincial de Personas Jurídicas (IPJ) de Córdoba',
    expediente: 'CBA_FIPJ01_2026_00007194',
    registrado_at: '2026-07-02T09:36:49-03:00',
    componentes: [
      { tipo: 'acta_cd', numero: 1, anio: 2026, titulo: 'Acta de reunión de Comisión Directiva N.º 1' },
      { tipo: 'resolucion_cd', numero: 1, anio: 2026, titulo: 'Aprobación de plantillas de actas y resoluciones' },
      { tipo: 'resolucion_cd', numero: 2, anio: 2026, titulo: 'Convenio de vinculación con la Universidad Siglo 21' },
    ],
    etiquetas: ['legal', 'ipj', 'inscripto', 'acta-cd', 'resoluciones'],
  },
  {
    file_path: path.join(root, 'RESOLUCIONES PARA SUBIR A IPJ/25-7-2026/CBA_FIPJ01_2026_00008259.pdf'),
    tipo: 'acta_cd',
    titulo: 'Acta de Comisión Directiva N.º 2/2026',
    descripcion: 'Acta CD N.º 2 firmada digitalmente e incorporada a IPJ.',
    numero: 2,
    anio: 2026,
    fecha_documento: '2026-07-25',
    estado_registro: 'inscripto_ipj',
    es_vigente: true,
    firma_digital: true,
    organismo_registro: 'Instituto Provincial de Personas Jurídicas (IPJ) de Córdoba',
    expediente: 'CBA_FIPJ01_2026_00008259',
    registrado_at: '2026-08-08T11:46:02-03:00',
    componentes: [
      { tipo: 'acta_cd', numero: 2, anio: 2026, titulo: 'Acta de reunión de Comisión Directiva N.º 2' },
    ],
    etiquetas: ['legal', 'ipj', 'inscripto', 'acta-cd'],
  },
];

const service = createLocalDocumentsService({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  actorSocioId: process.env.AILE_MCP_ACTOR_SOCIO_ID,
  actorEmail,
});

for (const document of documents) {
  const result = await service.uploadLocal({ ...document, dry_run: !apply });
  const payload = result.structuredContent;
  console.log(`${payload.mode}: ${document.titulo} (${payload.document?.sha256 || payload.sha256})`);
}

if (!apply) {
  console.log('Dry run finalizado. Ejecuta nuevamente con --apply para subir los tres PDFs.');
}
