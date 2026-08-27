-- Registro documental legal de AILE.
-- Los archivos se guardan en un bucket privado porque pueden contener DNI,
-- CUIT, domicilios y firmas. La tabla conserva metadatos auditables y evita
-- duplicados por SHA-256.

CREATE TABLE IF NOT EXISTS public.documentos_legales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN (
    'acta_constitutiva_estatuto',
    'acta_cd',
    'acta_asamblea',
    'resolucion_cd',
    'constancia_ipj',
    'libro_digital',
    'otro'
  )),
  titulo TEXT NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 3 AND 240),
  descripcion TEXT,
  numero INTEGER CHECK (numero IS NULL OR numero > 0),
  anio INTEGER CHECK (anio IS NULL OR anio BETWEEN 1900 AND 2200),
  fecha_documento DATE,
  estado_registro TEXT NOT NULL DEFAULT 'borrador' CHECK (estado_registro IN (
    'borrador',
    'pendiente_firma',
    'firmado',
    'presentado_ipj',
    'inscripto_ipj',
    'rechazado',
    'reemplazado'
  )),
  es_vigente BOOLEAN NOT NULL DEFAULT true,
  firma_digital BOOLEAN NOT NULL DEFAULT false,
  organismo_registro TEXT,
  expediente TEXT,
  registrado_at TIMESTAMPTZ,
  componentes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(componentes) = 'array'),
  etiquetas TEXT[] NOT NULL DEFAULT '{}'::text[],
  bucket TEXT NOT NULL DEFAULT 'documentos-legales' CHECK (bucket = 'documentos-legales'),
  storage_path TEXT NOT NULL UNIQUE,
  nombre_archivo TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf' CHECK (mime_type = 'application/pdf'),
  tamano_bytes BIGINT NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 52428800),
  sha256 TEXT NOT NULL UNIQUE CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  documento_padre_id UUID REFERENCES public.documentos_legales(id) ON DELETE SET NULL,
  created_by_socio_id UUID NOT NULL REFERENCES public.socios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documentos_legales_resoluciones (
  documento_id UUID NOT NULL REFERENCES public.documentos_legales(id) ON DELETE CASCADE,
  resolucion_id UUID NOT NULL REFERENCES public.resoluciones(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (documento_id, resolucion_id)
);

CREATE INDEX IF NOT EXISTS idx_documentos_legales_fecha
  ON public.documentos_legales(fecha_documento DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documentos_legales_tipo_estado
  ON public.documentos_legales(tipo, estado_registro);
CREATE INDEX IF NOT EXISTS idx_documentos_legales_componentes
  ON public.documentos_legales USING gin(componentes);

CREATE OR REPLACE FUNCTION public.fn_documentos_legales_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documentos_legales_updated_at ON public.documentos_legales;
CREATE TRIGGER trg_documentos_legales_updated_at
BEFORE UPDATE ON public.documentos_legales
FOR EACH ROW EXECUTE FUNCTION public.fn_documentos_legales_touch_updated_at();

ALTER TABLE public.documentos_legales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_legales_resoluciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documentos_legales_select ON public.documentos_legales;
CREATE POLICY documentos_legales_select ON public.documentos_legales
FOR SELECT TO authenticated
USING (public.fn_has_resource_permission('documentos', 'ver'));

DROP POLICY IF EXISTS documentos_legales_insert ON public.documentos_legales;
CREATE POLICY documentos_legales_insert ON public.documentos_legales
FOR INSERT TO authenticated
WITH CHECK (public.fn_has_resource_permission('documentos', 'crear'));

DROP POLICY IF EXISTS documentos_legales_update ON public.documentos_legales;
CREATE POLICY documentos_legales_update ON public.documentos_legales
FOR UPDATE TO authenticated
USING (public.fn_has_resource_permission('documentos', 'editar'))
WITH CHECK (public.fn_has_resource_permission('documentos', 'editar'));

DROP POLICY IF EXISTS documentos_legales_delete ON public.documentos_legales;
CREATE POLICY documentos_legales_delete ON public.documentos_legales
FOR DELETE TO authenticated
USING (public.fn_has_resource_permission('documentos', 'eliminar'));

DROP POLICY IF EXISTS documentos_legales_resoluciones_select ON public.documentos_legales_resoluciones;
CREATE POLICY documentos_legales_resoluciones_select ON public.documentos_legales_resoluciones
FOR SELECT TO authenticated
USING (public.fn_has_resource_permission('documentos', 'ver'));

DROP POLICY IF EXISTS documentos_legales_resoluciones_insert ON public.documentos_legales_resoluciones;
CREATE POLICY documentos_legales_resoluciones_insert ON public.documentos_legales_resoluciones
FOR INSERT TO authenticated
WITH CHECK (
  public.fn_has_resource_permission('documentos', 'editar')
  AND public.fn_has_resource_permission('resoluciones', 'ver')
);

DROP POLICY IF EXISTS documentos_legales_resoluciones_delete ON public.documentos_legales_resoluciones;
CREATE POLICY documentos_legales_resoluciones_delete ON public.documentos_legales_resoluciones
FOR DELETE TO authenticated
USING (public.fn_has_resource_permission('documentos', 'editar'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_legales TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.documentos_legales_resoluciones TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-legales',
  'documentos-legales',
  false,
  52428800,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS documentos_legales_storage_select ON storage.objects;
CREATE POLICY documentos_legales_storage_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos-legales'
  AND public.fn_has_resource_permission('documentos', 'ver')
);

DROP POLICY IF EXISTS documentos_legales_storage_insert ON storage.objects;
CREATE POLICY documentos_legales_storage_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos-legales'
  AND public.fn_has_resource_permission('documentos', 'crear')
);

DROP POLICY IF EXISTS documentos_legales_storage_update ON storage.objects;
CREATE POLICY documentos_legales_storage_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'documentos-legales'
  AND public.fn_has_resource_permission('documentos', 'editar')
)
WITH CHECK (
  bucket_id = 'documentos-legales'
  AND public.fn_has_resource_permission('documentos', 'editar')
);

DROP POLICY IF EXISTS documentos_legales_storage_delete ON storage.objects;
CREATE POLICY documentos_legales_storage_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos-legales'
  AND public.fn_has_resource_permission('documentos', 'eliminar')
);
