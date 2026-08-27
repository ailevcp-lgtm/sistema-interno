-- Registro formal de personas asociadas de AILE.
-- Modelo aditivo: conserva la comunidad historica y separa membresia legal,
-- admisiones, habilitaciones NNA y cierres del libro digital.

BEGIN;

-- Esta columna pertenecía al modelo anterior a la constitución. Se conserva
-- sólo por compatibilidad, sin valor jurídico ni valor por defecto. La categoría
-- vigente vive exclusivamente en asociados_membresias.
ALTER TABLE public.socios ALTER COLUMN categoria_socio DROP DEFAULT;
ALTER TABLE public.socios ALTER COLUMN categoria_socio DROP NOT NULL;
UPDATE public.socios SET categoria_socio = NULL;
COMMENT ON COLUMN public.socios.categoria_socio IS
  'Campo histórico deprecado. No acredita condición de asociado ni debe usarse para padrón, voto o cargos.';

ALTER TABLE public.cuotas
  ADD COLUMN IF NOT EXISTS naturaleza TEXT NOT NULL DEFAULT 'aporte_historico'
  CHECK (naturaleza IN ('aporte_historico', 'cuota_social'));

COMMENT ON COLUMN public.cuotas.naturaleza IS
  'Distingue aportes previos a la constitucion de las cuotas sociales posteriores al inicio formal de su percepcion.';

ALTER TABLE public.cuotas ALTER COLUMN naturaleza SET DEFAULT 'cuota_social';

INSERT INTO public.configuracion (clave, valor)
VALUES
  ('fecha_inicio_percepcion_cuotas', ''),
  ('libro_asociados_numero', '1'),
  ('aile_cuit', '')
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE public.documentos_legales
  ADD COLUMN IF NOT EXISTS visibilidad TEXT NOT NULL DEFAULT 'privado'
    CHECK (visibilidad IN ('privado', 'publico')),
  ADD COLUMN IF NOT EXISTS nivel_acceso TEXT NOT NULL DEFAULT 'institucional'
    CHECK (nivel_acceso IN ('institucional', 'secretaria', 'proteccion_nna')),
  ADD COLUMN IF NOT EXISTS publicado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS titulo_publico TEXT,
  ADD COLUMN IF NOT EXISTS descripcion_publica TEXT;

COMMENT ON COLUMN public.documentos_legales.visibilidad IS
  'Publico habilita la descarga sin autenticacion. Solo debe usarse con una copia revisada que no exponga datos personales innecesarios.';

DROP POLICY IF EXISTS documentos_legales_select ON public.documentos_legales;
CREATE POLICY documentos_legales_select ON public.documentos_legales
FOR SELECT TO authenticated
USING (
  CASE
    WHEN nivel_acceso = 'institucional' THEN public.fn_has_resource_permission('documentos', 'ver')
    ELSE public.fn_has_resource_permission('socios', 'editar')
  END
);

DROP POLICY IF EXISTS documentos_legales_storage_select ON storage.objects;
CREATE POLICY documentos_legales_storage_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos-legales'
  AND CASE
    WHEN (storage.foldername(name))[1] = 'restringido'
      THEN public.fn_has_resource_permission('socios', 'editar')
    ELSE public.fn_has_resource_permission('documentos', 'ver')
  END
);

DROP POLICY IF EXISTS documentos_legales_storage_insert ON storage.objects;
CREATE POLICY documentos_legales_storage_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos-legales'
  AND CASE
    WHEN (storage.foldername(name))[1] = 'restringido'
      THEN public.fn_has_resource_permission('socios', 'editar')
    ELSE public.fn_has_resource_permission('documentos', 'crear')
  END
);

CREATE TABLE IF NOT EXISTS public.asociados_membresias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id UUID NOT NULL REFERENCES public.socios(id) ON DELETE RESTRICT,
  numero_asociado INTEGER NOT NULL CHECK (numero_asociado > 0),
  categoria TEXT NOT NULL CHECK (categoria IN ('pleno', 'honorario', 'adherente')),
  origen TEXT NOT NULL CHECK (origen IN ('fundador', 'admision_cd', 'designacion_honoraria')),
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido', 'baja')),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,
  causa_fin TEXT,
  resolucion_id UUID REFERENCES public.resoluciones(id) ON DELETE RESTRICT,
  documento_instrumento_id UUID REFERENCES public.documentos_legales(id) ON DELETE RESTRICT,
  instrumento_descripcion TEXT NOT NULL,
  libro_numero INTEGER NOT NULL DEFAULT 1 CHECK (libro_numero > 0),
  folio_alta INTEGER CHECK (folio_alta IS NULL OR folio_alta > 0),
  observaciones TEXT,
  created_by_socio_id UUID REFERENCES public.socios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT asociados_membresias_fecha_chk CHECK (
    (estado = 'baja' AND fecha_fin IS NOT NULL AND causa_fin IS NOT NULL)
    OR (estado <> 'baja' AND fecha_fin IS NULL)
  ),
  UNIQUE (numero_asociado)
);

CREATE UNIQUE INDEX IF NOT EXISTS asociados_membresia_vigente_socio_uidx
  ON public.asociados_membresias(socio_id)
  WHERE estado IN ('activo', 'suspendido');

CREATE TABLE IF NOT EXISTS public.admision_solicitudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id UUID NOT NULL REFERENCES public.socios(id) ON DELETE RESTRICT,
  categoria_solicitada TEXT NOT NULL CHECK (categoria_solicitada IN ('pleno', 'adherente')),
  estado TEXT NOT NULL DEFAULT 'recibida' CHECK (estado IN (
    'recibida', 'documentacion_incompleta', 'documentacion_completa',
    'verificada_secretaria', 'elevada_cd', 'admitida', 'rechazada', 'archivada'
  )),
  fecha_solicitud DATE NOT NULL,
  fecha_recepcion DATE NOT NULL,
  datos_declarados JSONB NOT NULL CHECK (jsonb_typeof(datos_declarados) = 'object'),
  solicitud_documento_id UUID REFERENCES public.documentos_legales(id) ON DELETE RESTRICT,
  dni_documento_id UUID REFERENCES public.documentos_legales(id) ON DELETE RESTRICT,
  autorizacion_representante_documento_id UUID REFERENCES public.documentos_legales(id) ON DELETE RESTRICT,
  documentacion_general_verificada BOOLEAN NOT NULL DEFAULT false,
  verificada_por_socio_id UUID REFERENCES public.socios(id) ON DELETE RESTRICT,
  verificada_at TIMESTAMPTZ,
  resolucion_id UUID REFERENCES public.resoluciones(id) ON DELETE RESTRICT,
  resolucion_documento_id UUID REFERENCES public.documentos_legales(id) ON DELETE RESTRICT,
  fecha_resolucion DATE,
  categoria_admitida TEXT CHECK (categoria_admitida IN ('pleno', 'adherente')),
  notificado_at TIMESTAMPTZ,
  notificacion_email TEXT,
  notificacion_estado TEXT CHECK (notificacion_estado IN ('pendiente', 'enviada', 'error')),
  notificacion_error TEXT,
  observaciones TEXT,
  created_by_socio_id UUID NOT NULL REFERENCES public.socios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admision_resultado_chk CHECK (
    estado NOT IN ('admitida', 'rechazada')
    OR (resolucion_id IS NOT NULL AND resolucion_documento_id IS NOT NULL AND fecha_resolucion IS NOT NULL)
  ),
  CONSTRAINT admision_categoria_resultado_chk CHECK (
    estado <> 'admitida' OR categoria_admitida IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS admision_solicitudes_estado_fecha_idx
  ON public.admision_solicitudes(estado, fecha_recepcion DESC);
CREATE UNIQUE INDEX IF NOT EXISTS admision_solicitud_abierta_socio_uidx
  ON public.admision_solicitudes(socio_id)
  WHERE estado NOT IN ('admitida', 'rechazada', 'archivada');

CREATE TABLE IF NOT EXISTS public.habilitaciones_nna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id UUID NOT NULL REFERENCES public.socios(id) ON DELETE RESTRICT,
  requiere_contacto_directo BOOLEAN NOT NULL DEFAULT false,
  estado TEXT NOT NULL DEFAULT 'no_requerida' CHECK (estado IN (
    'no_requerida', 'pendiente', 'vigente', 'vencida', 'revocada'
  )),
  antecedentes_documento_id UUID REFERENCES public.documentos_legales(id) ON DELETE RESTRICT,
  antecedentes_emitido_el DATE,
  antecedentes_presentado_el DATE,
  antecedentes_vence_el DATE,
  integridad_sexual_documento_id UUID REFERENCES public.documentos_legales(id) ON DELETE RESTRICT,
  integridad_sexual_emitido_el DATE,
  integridad_sexual_presentado_el DATE,
  integridad_sexual_vence_el DATE,
  verificado_por_socio_id UUID REFERENCES public.socios(id) ON DELETE RESTRICT,
  verificado_at TIMESTAMPTZ,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (socio_id),
  CONSTRAINT habilitacion_nna_vigente_chk CHECK (
    estado <> 'vigente'
    OR (
      requiere_contacto_directo
      AND antecedentes_documento_id IS NOT NULL
      AND integridad_sexual_documento_id IS NOT NULL
      AND verificado_por_socio_id IS NOT NULL
      AND verificado_at IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS public.libro_asociados_asientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_asiento BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  membresia_id UUID NOT NULL REFERENCES public.asociados_membresias(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'apertura', 'alta', 'actualizacion_cuotas', 'sancion', 'levantamiento_sancion',
    'cambio_categoria', 'baja', 'rectificacion'
  )),
  fecha DATE NOT NULL,
  detalle TEXT NOT NULL CHECK (char_length(btrim(detalle)) >= 3),
  datos_snapshot JSONB NOT NULL CHECK (jsonb_typeof(datos_snapshot) = 'object'),
  rectifica_asiento_id UUID REFERENCES public.libro_asociados_asientos(id) ON DELETE RESTRICT,
  cierre_id UUID,
  created_by_socio_id UUID REFERENCES public.socios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.libro_asociados_cierres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo TEXT NOT NULL CHECK (periodo ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  libro_numero INTEGER NOT NULL DEFAULT 1 CHECK (libro_numero > 0),
  folio_desde INTEGER NOT NULL CHECK (folio_desde > 0),
  folio_hasta INTEGER NOT NULL CHECK (folio_hasta >= folio_desde),
  asiento_desde BIGINT,
  asiento_hasta BIGINT,
  estado TEXT NOT NULL DEFAULT 'cerrado' CHECK (estado IN ('cerrado', 'presentado_ipj')),
  documento_id UUID NOT NULL REFERENCES public.documentos_legales(id) ON DELETE RESTRICT,
  sha256 TEXT NOT NULL UNIQUE CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  sha256_anterior TEXT CHECK (sha256_anterior IS NULL OR sha256_anterior ~ '^[0-9a-f]{64}$'),
  cerrado_por_socio_id UUID NOT NULL REFERENCES public.socios(id) ON DELETE RESTRICT,
  cerrado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  presentado_ipj_at TIMESTAMPTZ,
  constancia_ipj_documento_id UUID REFERENCES public.documentos_legales(id) ON DELETE RESTRICT,
  UNIQUE (libro_numero, periodo),
  UNIQUE (libro_numero, folio_desde),
  CONSTRAINT libro_cierre_presentacion_chk CHECK (
    estado <> 'presentado_ipj' OR presentado_ipj_at IS NOT NULL
  )
);

ALTER TABLE public.libro_asociados_asientos
  ADD CONSTRAINT libro_asociados_asientos_cierre_fkey
  FOREIGN KEY (cierre_id) REFERENCES public.libro_asociados_cierres(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_asociados_membresias_updated_at ON public.asociados_membresias;
CREATE TRIGGER trg_asociados_membresias_updated_at
BEFORE UPDATE ON public.asociados_membresias
FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_admision_solicitudes_updated_at ON public.admision_solicitudes;
CREATE TRIGGER trg_admision_solicitudes_updated_at
BEFORE UPDATE ON public.admision_solicitudes
FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_habilitaciones_nna_updated_at ON public.habilitaciones_nna;
CREATE TRIGGER trg_habilitaciones_nna_updated_at
BEFORE UPDATE ON public.habilitaciones_nna
FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

-- Un asiento incorporado a un cierre es inmutable. Las correcciones se realizan
-- mediante un asiento posterior de tipo rectificacion.
CREATE OR REPLACE FUNCTION public.fn_proteger_asiento_libro_cerrado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.cierre_id IS NOT NULL THEN
    RAISE EXCEPTION 'Un asiento incorporado a un cierre no puede modificarse ni eliminarse';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_asiento_libro_cerrado ON public.libro_asociados_asientos;
CREATE TRIGGER trg_proteger_asiento_libro_cerrado
BEFORE UPDATE OR DELETE ON public.libro_asociados_asientos
FOR EACH ROW EXECUTE FUNCTION public.fn_proteger_asiento_libro_cerrado();

-- Normalizacion de nombres legales de los fundadores.
UPDATE public.socios SET nombre = 'Lucía Candelaria', apellido = 'Figueroa', fecha_nacimiento = DATE '2004-05-13'
WHERE regexp_replace(COALESCE(dni, ''), '[^0-9]', '', 'g') = '45697526';
UPDATE public.socios SET nombre = 'Emiliano Nicolás', apellido = 'Aguad Cano', fecha_nacimiento = DATE '2002-01-24'
WHERE regexp_replace(COALESCE(dni, ''), '[^0-9]', '', 'g') = '43812368';
UPDATE public.socios SET fecha_nacimiento = DATE '2001-12-04'
WHERE regexp_replace(COALESCE(dni, ''), '[^0-9]', '', 'g') = '43230152';
UPDATE public.socios SET fecha_nacimiento = DATE '2002-07-15'
WHERE regexp_replace(COALESCE(dni, ''), '[^0-9]', '', 'g') = '43992870';
UPDATE public.socios SET fecha_nacimiento = DATE '2005-04-11'
WHERE regexp_replace(COALESCE(dni, ''), '[^0-9]', '', 'g') = '46036542';
UPDATE public.socios SET fecha_nacimiento = DATE '2001-10-16'
WHERE regexp_replace(COALESCE(dni, ''), '[^0-9]', '', 'g') = '43603615';
UPDATE public.socios SET fecha_nacimiento = DATE '2004-11-17'
WHERE regexp_replace(COALESCE(dni, ''), '[^0-9]', '', 'g') = '46034263';
UPDATE public.socios SET fecha_nacimiento = DATE '2004-11-26'
WHERE regexp_replace(COALESCE(dni, ''), '[^0-9]', '', 'g') = '46034415';

WITH fundadores(numero_asociado, dni) AS (
  VALUES
    (1, '43230152'), (2, '43992870'), (3, '46036542'), (4, '43603615'),
    (5, '46034263'), (6, '45697526'), (7, '46034415'), (8, '43812368')
)
INSERT INTO public.asociados_membresias (
  socio_id, numero_asociado, categoria, origen, estado, fecha_inicio,
  instrumento_descripcion, libro_numero
)
SELECT
  s.id,
  f.numero_asociado,
  'pleno',
  'fundador',
  'activo',
  DATE '2026-05-13',
  'Acta Constitutiva de ASOCIACIÓN CIVIL AILE de fecha 13/05/2026',
  1
FROM fundadores f
JOIN public.socios s
  ON regexp_replace(COALESCE(s.dni, ''), '[^0-9]', '', 'g') = f.dni
ON CONFLICT (numero_asociado) DO NOTHING;

-- Compatibilidad temporal para pantallas antiguas: únicamente los fundadores
-- con membresía formal activa conservan valor en el campo deprecado.
UPDATE public.socios s
SET categoria_socio = m.categoria
FROM public.asociados_membresias m
WHERE m.socio_id = s.id
  AND m.estado = 'activo'
  AND m.origen = 'fundador';

INSERT INTO public.libro_asociados_asientos (
  membresia_id, tipo, fecha, detalle, datos_snapshot
)
SELECT
  m.id,
  'apertura',
  DATE '2026-05-13',
  'Incorporación como persona asociada fundadora conforme Acta Constitutiva.',
  jsonb_build_object(
    'numero_asociado', m.numero_asociado,
    'socio_id', s.id,
    'apellido_y_nombres', concat_ws(', ', s.apellido, s.nombre),
    'dni', regexp_replace(COALESCE(s.dni, ''), '[^0-9]', '', 'g'),
    'categoria', m.categoria,
    'origen', m.origen,
    'fecha_inicio', m.fecha_inicio,
    'instrumento', m.instrumento_descripcion
  )
FROM public.asociados_membresias m
JOIN public.socios s ON s.id = m.socio_id
WHERE m.origen = 'fundador'
  AND NOT EXISTS (
    SELECT 1 FROM public.libro_asociados_asientos a
    WHERE a.membresia_id = m.id AND a.tipo = 'apertura'
  );

CREATE OR REPLACE VIEW public.socios_estatutarios
WITH (security_invoker = true)
AS
WITH cuota_estado AS (
  SELECT
    socio_id,
    count(*) FILTER (
      WHERE naturaleza = 'cuota_social'
        AND estado <> 'pagada'
        AND GREATEST(COALESCE(monto_esperado, 0) - COALESCE(monto_pagado, 0), 0) > 0
    ) AS cuotas_impagas_count
  FROM public.cuotas
  GROUP BY socio_id
)
SELECT
  s.*,
  COALESCE(ce.cuotas_impagas_count, 0)::integer AS cuotas_impagas_count,
  (COALESCE(ce.cuotas_impagas_count, 0) = 0) AS esta_al_dia,
  (COALESCE(ce.cuotas_impagas_count, 0) >= 3) AS requiere_notificacion_morosidad,
  CASE WHEN s.fecha_nacimiento IS NULL THEN NULL
    ELSE date_part('year', age(current_date, s.fecha_nacimiento))::integer END AS edad,
  GREATEST(
    date_part('year', age(current_date, m.fecha_inicio))::integer * 12
      + date_part('month', age(current_date, m.fecha_inicio))::integer,
    0
  ) AS meses_antiguedad,
  (
    m.estado = 'activo' AND m.categoria = 'pleno'
    AND s.fecha_nacimiento IS NOT NULL
    AND date_part('year', age(current_date, s.fecha_nacimiento)) >= 18
    AND (current_date <= DATE '2028-04-30' OR age(current_date, m.fecha_inicio) >= interval '6 months')
    AND COALESCE(ce.cuotas_impagas_count, 0) = 0
  ) AS puede_votar,
  (
    m.estado = 'activo' AND m.categoria = 'pleno'
    AND s.fecha_nacimiento IS NOT NULL
    AND date_part('year', age(current_date, s.fecha_nacimiento)) >= 18
    AND (current_date <= DATE '2028-04-30' OR age(current_date, m.fecha_inicio) >= interval '6 months')
    AND COALESCE(ce.cuotas_impagas_count, 0) = 0
  ) AS puede_integrar_organos
FROM public.socios s
JOIN public.asociados_membresias m ON m.socio_id = s.id AND m.estado IN ('activo', 'suspendido')
LEFT JOIN cuota_estado ce ON ce.socio_id = s.id;

COMMENT ON VIEW public.socios_estatutarios IS
  'Padron legal: solo personas con membresia formal vigente. La antiguedad se computa desde constitucion o resolucion de admision.';

CREATE OR REPLACE FUNCTION public.fn_registrar_decision_admision(
  p_solicitud_id UUID,
  p_decision TEXT,
  p_resolucion_id UUID,
  p_resolucion_documento_id UUID,
  p_fecha_resolucion DATE,
  p_categoria_admitida TEXT DEFAULT NULL,
  p_observaciones TEXT DEFAULT NULL,
  p_actor_usuario_id UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_socio_id UUID;
  v_solicitud public.admision_solicitudes%ROWTYPE;
  v_membresia_id UUID;
  v_numero_asociado INTEGER;
  v_fecha_inicio_cuotas DATE;
  v_monto_cuota NUMERIC;
  v_periodo TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND p_actor_usuario_id <> auth.uid() THEN
    RAISE EXCEPTION 'El actor informado no coincide con la sesión';
  END IF;

  IF NOT public.fn_has_resource_permission('socios', 'editar', p_actor_usuario_id) THEN
    RAISE EXCEPTION 'No autorizado para registrar decisiones de admision';
  END IF;

  IF p_decision NOT IN ('admitida', 'rechazada') THEN
    RAISE EXCEPTION 'Decision invalida';
  END IF;

  SELECT id INTO v_actor_socio_id
  FROM public.socios
  WHERE usuario_id = p_actor_usuario_id AND estado = 'activo'
  LIMIT 1;

  SELECT * INTO v_solicitud
  FROM public.admision_solicitudes
  WHERE id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud inexistente'; END IF;
  IF v_solicitud.estado IN ('admitida', 'rechazada', 'archivada') THEN
    RAISE EXCEPTION 'La solicitud ya tiene un estado terminal';
  END IF;
  IF NOT v_solicitud.documentacion_general_verificada
    OR v_solicitud.solicitud_documento_id IS NULL
    OR v_solicitud.dni_documento_id IS NULL THEN
    RAISE EXCEPTION 'Secretaría debe verificar la solicitud firmada y la copia del DNI antes de registrar la decisión de CD';
  END IF;
  IF p_resolucion_id IS NULL OR p_resolucion_documento_id IS NULL OR p_fecha_resolucion IS NULL THEN
    RAISE EXCEPTION 'La resolucion, su PDF y su fecha son obligatorios';
  END IF;

  IF p_decision = 'admitida' THEN
    IF p_categoria_admitida NOT IN ('pleno', 'adherente') THEN
      RAISE EXCEPTION 'Categoria de admision invalida';
    END IF;
    IF p_categoria_admitida = 'pleno' AND NOT EXISTS (
      SELECT 1 FROM public.socios s
      WHERE s.id = v_solicitud.socio_id
        AND s.fecha_nacimiento IS NOT NULL
        AND date_part('year', age(p_fecha_resolucion, s.fecha_nacimiento)) >= 18
    ) THEN
      RAISE EXCEPTION 'La categoría Socio Pleno exige mayoría de edad a la fecha de admisión';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('aile-numero-asociado'));
    SELECT COALESCE(max(numero_asociado), 0) + 1 INTO v_numero_asociado
    FROM public.asociados_membresias;

    INSERT INTO public.asociados_membresias (
      socio_id, numero_asociado, categoria, origen, estado, fecha_inicio,
      resolucion_id, documento_instrumento_id, instrumento_descripcion,
      created_by_socio_id
    ) VALUES (
      v_solicitud.socio_id, v_numero_asociado, p_categoria_admitida,
      'admision_cd', 'activo', p_fecha_resolucion, p_resolucion_id,
      p_resolucion_documento_id,
      'Resolución de Comisión Directiva de admisión de fecha ' || to_char(p_fecha_resolucion, 'DD/MM/YYYY'),
      v_actor_socio_id
    ) RETURNING id INTO v_membresia_id;

    INSERT INTO public.libro_asociados_asientos (
      membresia_id, tipo, fecha, detalle, datos_snapshot, created_by_socio_id
    )
    SELECT
      v_membresia_id,
      'alta',
      p_fecha_resolucion,
      'Alta por admisión resuelta por la Comisión Directiva.',
      jsonb_build_object(
        'numero_asociado', v_numero_asociado,
        'socio_id', s.id,
        'apellido_y_nombres', concat_ws(', ', s.apellido, s.nombre),
        'dni', regexp_replace(COALESCE(s.dni, ''), '[^0-9]', '', 'g'),
        'categoria', p_categoria_admitida,
        'fecha_inicio', p_fecha_resolucion,
        'resolucion_id', p_resolucion_id,
        'documento_instrumento_id', p_resolucion_documento_id
      ),
      v_actor_socio_id
    FROM public.socios s WHERE s.id = v_solicitud.socio_id;

    UPDATE public.socios SET categoria_socio = p_categoria_admitida
    WHERE id = v_solicitud.socio_id;

    SELECT NULLIF(valor, '')::date INTO v_fecha_inicio_cuotas
    FROM public.configuracion WHERE clave = 'fecha_inicio_percepcion_cuotas';
    SELECT NULLIF(valor, '')::numeric INTO v_monto_cuota
    FROM public.configuracion WHERE clave = 'monto_cuota';

    IF v_fecha_inicio_cuotas IS NOT NULL
      AND p_fecha_resolucion >= v_fecha_inicio_cuotas
      AND v_monto_cuota IS NOT NULL THEN
      v_periodo := to_char(p_fecha_resolucion, 'YYYY-MM');
      INSERT INTO public.cuotas (
        socio_id, periodo, monto_esperado, monto_pagado, estado, naturaleza
      ) VALUES (
        v_solicitud.socio_id, v_periodo, v_monto_cuota, 0, 'pendiente', 'cuota_social'
      ) ON CONFLICT (socio_id, periodo) DO NOTHING;
    END IF;
  END IF;

  UPDATE public.admision_solicitudes SET
    estado = p_decision,
    resolucion_id = p_resolucion_id,
    resolucion_documento_id = p_resolucion_documento_id,
    fecha_resolucion = p_fecha_resolucion,
    categoria_admitida = CASE WHEN p_decision = 'admitida' THEN p_categoria_admitida ELSE NULL END,
    notificacion_estado = 'pendiente',
    observaciones = COALESCE(p_observaciones, observaciones)
  WHERE id = p_solicitud_id;

  RETURN v_membresia_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_registrar_decision_admision(UUID, TEXT, UUID, UUID, DATE, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_registrar_decision_admision(UUID, TEXT, UUID, UUID, DATE, TEXT, TEXT, UUID) TO authenticated, service_role;

ALTER TABLE public.asociados_membresias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admision_solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habilitaciones_nna ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.libro_asociados_asientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.libro_asociados_cierres ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.asociados_membresias, public.admision_solicitudes,
  public.habilitaciones_nna, public.libro_asociados_asientos,
  public.libro_asociados_cierres FROM anon, authenticated;

GRANT SELECT ON public.asociados_membresias, public.libro_asociados_asientos,
  public.libro_asociados_cierres TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.admision_solicitudes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.habilitaciones_nna TO authenticated;
GRANT INSERT, UPDATE ON public.asociados_membresias TO authenticated;
GRANT INSERT ON public.libro_asociados_asientos, public.libro_asociados_cierres TO authenticated;

CREATE POLICY asociados_membresias_select ON public.asociados_membresias
FOR SELECT TO authenticated USING (public.fn_has_resource_permission('socios', 'ver'));
CREATE POLICY asociados_membresias_write ON public.asociados_membresias
FOR ALL TO authenticated
USING (public.fn_has_resource_permission('socios', 'editar'))
WITH CHECK (public.fn_has_resource_permission('socios', 'editar'));

CREATE POLICY admision_solicitudes_select ON public.admision_solicitudes
FOR SELECT TO authenticated USING (public.fn_has_resource_permission('socios', 'ver'));
CREATE POLICY admision_solicitudes_insert ON public.admision_solicitudes
FOR INSERT TO authenticated WITH CHECK (public.fn_has_resource_permission('socios', 'crear'));
CREATE POLICY admision_solicitudes_update ON public.admision_solicitudes
FOR UPDATE TO authenticated
USING (public.fn_has_resource_permission('socios', 'editar'))
WITH CHECK (public.fn_has_resource_permission('socios', 'editar'));

CREATE POLICY habilitaciones_nna_select ON public.habilitaciones_nna
FOR SELECT TO authenticated USING (public.fn_has_resource_permission('socios', 'editar'));
CREATE POLICY habilitaciones_nna_write ON public.habilitaciones_nna
FOR ALL TO authenticated
USING (public.fn_has_resource_permission('socios', 'editar'))
WITH CHECK (public.fn_has_resource_permission('socios', 'editar'));

CREATE POLICY libro_asientos_select ON public.libro_asociados_asientos
FOR SELECT TO authenticated USING (public.fn_has_resource_permission('socios', 'ver'));
CREATE POLICY libro_asientos_insert ON public.libro_asociados_asientos
FOR INSERT TO authenticated WITH CHECK (public.fn_has_resource_permission('socios', 'editar'));

CREATE POLICY libro_cierres_select ON public.libro_asociados_cierres
FOR SELECT TO authenticated USING (public.fn_has_resource_permission('socios', 'ver'));
CREATE POLICY libro_cierres_insert ON public.libro_asociados_cierres
FOR INSERT TO authenticated WITH CHECK (public.fn_has_resource_permission('socios', 'editar'));

COMMIT;
