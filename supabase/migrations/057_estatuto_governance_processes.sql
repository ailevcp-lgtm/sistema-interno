-- ============================================================
-- 057: Procesos estatutarios formales
-- ============================================================
--
-- Migracion aditiva:
-- - no borra tablas;
-- - no elimina registros;
-- - no modifica datos historicos existentes;
-- - crea tablas para asambleas, padrones, listas, disciplina,
--   remociones y protocolos de menores.

CREATE TABLE IF NOT EXISTS estatuto_asambleas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL DEFAULT 'ordinaria'
    CHECK (tipo IN ('ordinaria', 'extraordinaria')),
  estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'convocada', 'en_curso', 'cerrada', 'cancelada')),
  titulo TEXT NOT NULL,
  fecha TIMESTAMPTZ,
  lugar TEXT,
  modalidad TEXT NOT NULL DEFAULT 'presencial'
    CHECK (modalidad IN ('presencial', 'virtual', 'mixta')),
  convocatoria_fecha DATE,
  publicacion_boletin_fecha DATE,
  notificacion_socios_fecha DATE,
  documentacion_disponible_fecha DATE,
  cierre_ejercicio DATE,
  orden_dia TEXT,
  notas TEXT,
  created_by_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  updated_by_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estatuto_asamblea_padron (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asamblea_id UUID NOT NULL REFERENCES estatuto_asambleas(id) ON DELETE CASCADE,
  socio_id UUID NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  socio_nombre TEXT NOT NULL,
  socio_apellido TEXT NOT NULL,
  dni TEXT,
  email TEXT,
  categoria_socio TEXT NOT NULL,
  edad INTEGER,
  meses_antiguedad INTEGER NOT NULL DEFAULT 0,
  cuotas_impagas_count INTEGER NOT NULL DEFAULT 0,
  esta_al_dia BOOLEAN NOT NULL DEFAULT false,
  puede_votar BOOLEAN NOT NULL DEFAULT false,
  puede_integrar_organos BOOLEAN NOT NULL DEFAULT false,
  motivo_no_vota TEXT,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asamblea_id, socio_id)
);

CREATE TABLE IF NOT EXISTS estatuto_listas_electorales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asamblea_id UUID NOT NULL REFERENCES estatuto_asambleas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'presentada', 'observada', 'aprobada', 'proclamada', 'retirada')),
  presentada_at TIMESTAMPTZ,
  observaciones TEXT,
  created_by_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asamblea_id, nombre)
);

CREATE TABLE IF NOT EXISTS estatuto_lista_candidatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id UUID NOT NULL REFERENCES estatuto_listas_electorales(id) ON DELETE CASCADE,
  cargo TEXT NOT NULL
    CHECK (cargo IN (
      'Presidente',
      'Secretario',
      'Tesorero',
      'Vocal Titular',
      'Vocal Suplente',
      'Revisor de Cuentas Titular',
      'Revisor de Cuentas Suplente'
    )),
  socio_id UUID NOT NULL REFERENCES socios(id) ON DELETE RESTRICT,
  orden INTEGER NOT NULL DEFAULT 1,
  cumple_requisitos BOOLEAN NOT NULL DEFAULT false,
  motivo_observacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lista_id, cargo, orden)
);

CREATE TABLE IF NOT EXISTS estatuto_procesos_disciplinarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id UUID NOT NULL REFERENCES socios(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('apercibimiento', 'suspension', 'cesantia', 'expulsion')),
  estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'notificado', 'descargo_recibido', 'pendiente_resolucion', 'resuelto', 'apelado', 'cerrado', 'anulado')),
  causa TEXT NOT NULL,
  fecha_hecho DATE,
  fecha_inicio DATE NOT NULL DEFAULT current_date,
  fecha_notificacion DATE,
  medio_notificacion TEXT,
  plazo_descargo_hasta DATE,
  resolucion_id UUID REFERENCES resoluciones(id) ON DELETE SET NULL,
  resultado TEXT,
  created_by_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  updated_by_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estatuto_remociones_autoridades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id UUID NOT NULL REFERENCES socios(id) ON DELETE RESTRICT,
  organo TEXT NOT NULL
    CHECK (organo IN ('comision_directiva', 'comision_revisora')),
  cargo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'notificado', 'descargo_recibido', 'pendiente_resolucion', 'resuelta', 'apelada', 'cerrada', 'anulada')),
  causa TEXT NOT NULL,
  fecha_inicio DATE NOT NULL DEFAULT current_date,
  fecha_notificacion DATE,
  medio_notificacion TEXT,
  plazo_descargo_hasta DATE,
  resolucion_id UUID REFERENCES resoluciones(id) ON DELETE SET NULL,
  resultado TEXT,
  created_by_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  updated_by_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estatuto_socios_menores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id UUID NOT NULL UNIQUE REFERENCES socios(id) ON DELETE CASCADE,
  responsable_nombre TEXT,
  responsable_dni TEXT,
  responsable_email TEXT,
  responsable_telefono TEXT,
  autorizacion_archivo_url TEXT,
  certificado_archivo_url TEXT,
  protocolo_aceptado BOOLEAN NOT NULL DEFAULT false,
  fecha_autorizacion DATE,
  vencimiento_autorizacion DATE,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'vigente', 'vencido', 'revocado')),
  observaciones TEXT,
  created_by_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  updated_by_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estatuto_asambleas_fecha
  ON estatuto_asambleas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_estatuto_asambleas_estado
  ON estatuto_asambleas(estado);
CREATE INDEX IF NOT EXISTS idx_estatuto_padron_asamblea
  ON estatuto_asamblea_padron(asamblea_id);
CREATE INDEX IF NOT EXISTS idx_estatuto_padron_puede_votar
  ON estatuto_asamblea_padron(asamblea_id, puede_votar);
CREATE INDEX IF NOT EXISTS idx_estatuto_listas_asamblea
  ON estatuto_listas_electorales(asamblea_id);
CREATE INDEX IF NOT EXISTS idx_estatuto_disciplina_socio
  ON estatuto_procesos_disciplinarios(socio_id);
CREATE INDEX IF NOT EXISTS idx_estatuto_disciplina_estado
  ON estatuto_procesos_disciplinarios(estado);
CREATE INDEX IF NOT EXISTS idx_estatuto_remociones_socio
  ON estatuto_remociones_autoridades(socio_id);
CREATE INDEX IF NOT EXISTS idx_estatuto_menores_estado
  ON estatuto_socios_menores(estado);

CREATE OR REPLACE FUNCTION fn_estatuto_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_estatuto_asambleas_updated_at ON estatuto_asambleas;
CREATE TRIGGER trg_estatuto_asambleas_updated_at
BEFORE UPDATE ON estatuto_asambleas
FOR EACH ROW EXECUTE FUNCTION fn_estatuto_touch_updated_at();

DROP TRIGGER IF EXISTS trg_estatuto_listas_updated_at ON estatuto_listas_electorales;
CREATE TRIGGER trg_estatuto_listas_updated_at
BEFORE UPDATE ON estatuto_listas_electorales
FOR EACH ROW EXECUTE FUNCTION fn_estatuto_touch_updated_at();

DROP TRIGGER IF EXISTS trg_estatuto_disciplina_updated_at ON estatuto_procesos_disciplinarios;
CREATE TRIGGER trg_estatuto_disciplina_updated_at
BEFORE UPDATE ON estatuto_procesos_disciplinarios
FOR EACH ROW EXECUTE FUNCTION fn_estatuto_touch_updated_at();

DROP TRIGGER IF EXISTS trg_estatuto_remociones_updated_at ON estatuto_remociones_autoridades;
CREATE TRIGGER trg_estatuto_remociones_updated_at
BEFORE UPDATE ON estatuto_remociones_autoridades
FOR EACH ROW EXECUTE FUNCTION fn_estatuto_touch_updated_at();

DROP TRIGGER IF EXISTS trg_estatuto_menores_updated_at ON estatuto_socios_menores;
CREATE TRIGGER trg_estatuto_menores_updated_at
BEFORE UPDATE ON estatuto_socios_menores
FOR EACH ROW EXECUTE FUNCTION fn_estatuto_touch_updated_at();

CREATE OR REPLACE FUNCTION fn_estatuto_generar_padron(p_asamblea_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  IF NOT (
    fn_has_resource_permission('estatuto', 'crear')
    OR fn_has_resource_permission('estatuto', 'editar')
  ) THEN
    RAISE EXCEPTION 'No tiene permisos para generar padron estatutario';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM estatuto_asambleas WHERE id = p_asamblea_id) THEN
    RAISE EXCEPTION 'La asamblea indicada no existe';
  END IF;

  INSERT INTO estatuto_asamblea_padron (
    asamblea_id,
    socio_id,
    socio_nombre,
    socio_apellido,
    dni,
    email,
    categoria_socio,
    edad,
    meses_antiguedad,
    cuotas_impagas_count,
    esta_al_dia,
    puede_votar,
    puede_integrar_organos,
    motivo_no_vota,
    snapshot_at
  )
  SELECT
    p_asamblea_id,
    se.id,
    se.nombre,
    se.apellido,
    se.dni,
    se.email,
    se.categoria_socio,
    se.edad,
    se.meses_antiguedad,
    se.cuotas_impagas_count,
    se.esta_al_dia,
    se.puede_votar,
    se.puede_integrar_organos,
    NULLIF(concat_ws('; ',
      CASE WHEN se.estado <> 'activo' THEN 'No esta activo' END,
      CASE WHEN se.categoria_socio <> 'pleno' THEN 'No pertenece a categoria Socio Pleno' END,
      CASE WHEN se.edad IS NULL THEN 'Falta fecha de nacimiento' END,
      CASE WHEN se.edad IS NOT NULL AND se.edad < 18 THEN 'No alcanza mayoria de edad' END,
      CASE WHEN current_date > date '2028-04-30' AND se.meses_antiguedad < 6 THEN 'No alcanza 6 meses de antiguedad' END,
      CASE WHEN NOT se.esta_al_dia THEN 'No esta al dia con cuotas' END
    ), ''),
    now()
  FROM socios_estatutarios se
  WHERE se.estado <> 'eliminado'
  ON CONFLICT (asamblea_id, socio_id) DO UPDATE SET
    socio_nombre = EXCLUDED.socio_nombre,
    socio_apellido = EXCLUDED.socio_apellido,
    dni = EXCLUDED.dni,
    email = EXCLUDED.email,
    categoria_socio = EXCLUDED.categoria_socio,
    edad = EXCLUDED.edad,
    meses_antiguedad = EXCLUDED.meses_antiguedad,
    cuotas_impagas_count = EXCLUDED.cuotas_impagas_count,
    esta_al_dia = EXCLUDED.esta_al_dia,
    puede_votar = EXCLUDED.puede_votar,
    puede_integrar_organos = EXCLUDED.puede_integrar_organos,
    motivo_no_vota = EXCLUDED.motivo_no_vota,
    snapshot_at = EXCLUDED.snapshot_at;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

ALTER TABLE estatuto_asambleas ENABLE ROW LEVEL SECURITY;
ALTER TABLE estatuto_asamblea_padron ENABLE ROW LEVEL SECURITY;
ALTER TABLE estatuto_listas_electorales ENABLE ROW LEVEL SECURITY;
ALTER TABLE estatuto_lista_candidatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estatuto_procesos_disciplinarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE estatuto_remociones_autoridades ENABLE ROW LEVEL SECURITY;
ALTER TABLE estatuto_socios_menores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estatuto_asambleas_select ON estatuto_asambleas;
CREATE POLICY estatuto_asambleas_select ON estatuto_asambleas
FOR SELECT TO authenticated USING (fn_has_resource_permission('estatuto', 'ver'));
DROP POLICY IF EXISTS estatuto_asambleas_insert ON estatuto_asambleas;
CREATE POLICY estatuto_asambleas_insert ON estatuto_asambleas
FOR INSERT TO authenticated WITH CHECK (fn_has_resource_permission('estatuto', 'crear'));
DROP POLICY IF EXISTS estatuto_asambleas_update ON estatuto_asambleas;
CREATE POLICY estatuto_asambleas_update ON estatuto_asambleas
FOR UPDATE TO authenticated USING (fn_has_resource_permission('estatuto', 'editar'))
WITH CHECK (fn_has_resource_permission('estatuto', 'editar'));
DROP POLICY IF EXISTS estatuto_asambleas_delete ON estatuto_asambleas;
CREATE POLICY estatuto_asambleas_delete ON estatuto_asambleas
FOR DELETE TO authenticated USING (fn_has_resource_permission('estatuto', 'eliminar'));

DROP POLICY IF EXISTS estatuto_padron_select ON estatuto_asamblea_padron;
CREATE POLICY estatuto_padron_select ON estatuto_asamblea_padron
FOR SELECT TO authenticated USING (fn_has_resource_permission('estatuto', 'ver'));
DROP POLICY IF EXISTS estatuto_padron_insert ON estatuto_asamblea_padron;
CREATE POLICY estatuto_padron_insert ON estatuto_asamblea_padron
FOR INSERT TO authenticated WITH CHECK (fn_has_resource_permission('estatuto', 'crear'));
DROP POLICY IF EXISTS estatuto_padron_update ON estatuto_asamblea_padron;
CREATE POLICY estatuto_padron_update ON estatuto_asamblea_padron
FOR UPDATE TO authenticated USING (fn_has_resource_permission('estatuto', 'editar'))
WITH CHECK (fn_has_resource_permission('estatuto', 'editar'));

DROP POLICY IF EXISTS estatuto_listas_select ON estatuto_listas_electorales;
CREATE POLICY estatuto_listas_select ON estatuto_listas_electorales
FOR SELECT TO authenticated USING (fn_has_resource_permission('estatuto', 'ver'));
DROP POLICY IF EXISTS estatuto_listas_insert ON estatuto_listas_electorales;
CREATE POLICY estatuto_listas_insert ON estatuto_listas_electorales
FOR INSERT TO authenticated WITH CHECK (fn_has_resource_permission('estatuto', 'crear'));
DROP POLICY IF EXISTS estatuto_listas_update ON estatuto_listas_electorales;
CREATE POLICY estatuto_listas_update ON estatuto_listas_electorales
FOR UPDATE TO authenticated USING (fn_has_resource_permission('estatuto', 'editar'))
WITH CHECK (fn_has_resource_permission('estatuto', 'editar'));
DROP POLICY IF EXISTS estatuto_listas_delete ON estatuto_listas_electorales;
CREATE POLICY estatuto_listas_delete ON estatuto_listas_electorales
FOR DELETE TO authenticated USING (fn_has_resource_permission('estatuto', 'eliminar'));

DROP POLICY IF EXISTS estatuto_candidatos_select ON estatuto_lista_candidatos;
CREATE POLICY estatuto_candidatos_select ON estatuto_lista_candidatos
FOR SELECT TO authenticated USING (fn_has_resource_permission('estatuto', 'ver'));
DROP POLICY IF EXISTS estatuto_candidatos_insert ON estatuto_lista_candidatos;
CREATE POLICY estatuto_candidatos_insert ON estatuto_lista_candidatos
FOR INSERT TO authenticated WITH CHECK (fn_has_resource_permission('estatuto', 'crear'));
DROP POLICY IF EXISTS estatuto_candidatos_update ON estatuto_lista_candidatos;
CREATE POLICY estatuto_candidatos_update ON estatuto_lista_candidatos
FOR UPDATE TO authenticated USING (fn_has_resource_permission('estatuto', 'editar'))
WITH CHECK (fn_has_resource_permission('estatuto', 'editar'));
DROP POLICY IF EXISTS estatuto_candidatos_delete ON estatuto_lista_candidatos;
CREATE POLICY estatuto_candidatos_delete ON estatuto_lista_candidatos
FOR DELETE TO authenticated USING (fn_has_resource_permission('estatuto', 'eliminar'));

DROP POLICY IF EXISTS estatuto_disciplina_select ON estatuto_procesos_disciplinarios;
CREATE POLICY estatuto_disciplina_select ON estatuto_procesos_disciplinarios
FOR SELECT TO authenticated USING (fn_has_resource_permission('estatuto', 'ver'));
DROP POLICY IF EXISTS estatuto_disciplina_insert ON estatuto_procesos_disciplinarios;
CREATE POLICY estatuto_disciplina_insert ON estatuto_procesos_disciplinarios
FOR INSERT TO authenticated WITH CHECK (fn_has_resource_permission('estatuto', 'crear'));
DROP POLICY IF EXISTS estatuto_disciplina_update ON estatuto_procesos_disciplinarios;
CREATE POLICY estatuto_disciplina_update ON estatuto_procesos_disciplinarios
FOR UPDATE TO authenticated USING (fn_has_resource_permission('estatuto', 'editar'))
WITH CHECK (fn_has_resource_permission('estatuto', 'editar'));
DROP POLICY IF EXISTS estatuto_disciplina_delete ON estatuto_procesos_disciplinarios;
CREATE POLICY estatuto_disciplina_delete ON estatuto_procesos_disciplinarios
FOR DELETE TO authenticated USING (fn_has_resource_permission('estatuto', 'eliminar'));

DROP POLICY IF EXISTS estatuto_remociones_select ON estatuto_remociones_autoridades;
CREATE POLICY estatuto_remociones_select ON estatuto_remociones_autoridades
FOR SELECT TO authenticated USING (fn_has_resource_permission('estatuto', 'ver'));
DROP POLICY IF EXISTS estatuto_remociones_insert ON estatuto_remociones_autoridades;
CREATE POLICY estatuto_remociones_insert ON estatuto_remociones_autoridades
FOR INSERT TO authenticated WITH CHECK (fn_has_resource_permission('estatuto', 'crear'));
DROP POLICY IF EXISTS estatuto_remociones_update ON estatuto_remociones_autoridades;
CREATE POLICY estatuto_remociones_update ON estatuto_remociones_autoridades
FOR UPDATE TO authenticated USING (fn_has_resource_permission('estatuto', 'editar'))
WITH CHECK (fn_has_resource_permission('estatuto', 'editar'));
DROP POLICY IF EXISTS estatuto_remociones_delete ON estatuto_remociones_autoridades;
CREATE POLICY estatuto_remociones_delete ON estatuto_remociones_autoridades
FOR DELETE TO authenticated USING (fn_has_resource_permission('estatuto', 'eliminar'));

DROP POLICY IF EXISTS estatuto_menores_select ON estatuto_socios_menores;
CREATE POLICY estatuto_menores_select ON estatuto_socios_menores
FOR SELECT TO authenticated USING (fn_has_resource_permission('estatuto', 'ver'));
DROP POLICY IF EXISTS estatuto_menores_insert ON estatuto_socios_menores;
CREATE POLICY estatuto_menores_insert ON estatuto_socios_menores
FOR INSERT TO authenticated WITH CHECK (fn_has_resource_permission('estatuto', 'crear'));
DROP POLICY IF EXISTS estatuto_menores_update ON estatuto_socios_menores;
CREATE POLICY estatuto_menores_update ON estatuto_socios_menores
FOR UPDATE TO authenticated USING (fn_has_resource_permission('estatuto', 'editar'))
WITH CHECK (fn_has_resource_permission('estatuto', 'editar'));
DROP POLICY IF EXISTS estatuto_menores_delete ON estatuto_socios_menores;
CREATE POLICY estatuto_menores_delete ON estatuto_socios_menores
FOR DELETE TO authenticated USING (fn_has_resource_permission('estatuto', 'eliminar'));
