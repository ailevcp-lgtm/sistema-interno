-- ============================================================
-- 027: Core schema for tasks / kanban
-- ============================================================

-- 1) Enums
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'tipo_proyecto_tarea'
  ) THEN
    CREATE TYPE tipo_proyecto_tarea AS ENUM (
      'institucional',
      'interno_direccion'
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'estado_tarea'
  ) THEN
    CREATE TYPE estado_tarea AS ENUM (
      'backlog',
      'por_hacer',
      'en_progreso',
      'en_revision_direccion',
      'pendiente_handoff',
      'pendiente_aprobacion_cd',
      'observada_cd',
      'aprobada_cd',
      'cerrada'
    );
  END IF;
END;
$$;

-- 2) Tables
CREATE TABLE IF NOT EXISTS direcciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT direcciones_codigo_not_blank_chk
    CHECK (char_length(btrim(codigo)) > 0),
  CONSTRAINT direcciones_codigo_format_chk
    CHECK (codigo ~ '^[a-z][a-z_]*$'),
  CONSTRAINT direcciones_nombre_not_blank_chk
    CHECK (char_length(btrim(nombre)) > 0)
);

CREATE TABLE IF NOT EXISTS socios_direcciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id UUID NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  direccion_id UUID NOT NULL REFERENCES direcciones(id) ON DELETE RESTRICT,
  es_director BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_hasta DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT socios_direcciones_unique UNIQUE (socio_id, direccion_id),
  CONSTRAINT socios_direcciones_fecha_rango_chk
    CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde)
);

CREATE TABLE IF NOT EXISTS proyectos_tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo tipo_proyecto_tarea NOT NULL DEFAULT 'interno_direccion',
  direccion_id UUID NOT NULL REFERENCES direcciones(id) ON DELETE RESTRICT,
  creado_por_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  responsable_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_inicio DATE,
  fecha_fin_estimada DATE,
  fecha_cierre TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT proyectos_tareas_nombre_not_blank_chk
    CHECK (char_length(btrim(nombre)) > 0),
  CONSTRAINT proyectos_tareas_fecha_rango_chk
    CHECK (
      fecha_inicio IS NULL
      OR fecha_fin_estimada IS NULL
      OR fecha_fin_estimada >= fecha_inicio
    )
);

CREATE TABLE IF NOT EXISTS tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos_tareas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  estado estado_tarea NOT NULL DEFAULT 'backlog',
  prioridad SMALLINT NOT NULL DEFAULT 3,
  orden_en_columna INTEGER NOT NULL DEFAULT 0,
  asignado_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  creado_por_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  updated_by_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  fecha_vencimiento DATE,
  fecha_inicio_real TIMESTAMPTZ,
  fecha_cierre TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tareas_titulo_not_blank_chk
    CHECK (char_length(btrim(titulo)) > 0),
  CONSTRAINT tareas_prioridad_chk
    CHECK (prioridad BETWEEN 1 AND 5),
  CONSTRAINT tareas_orden_en_columna_chk
    CHECK (orden_en_columna >= 0)
);

CREATE TABLE IF NOT EXISTS subtareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  estado estado_tarea NOT NULL DEFAULT 'backlog',
  orden_en_columna INTEGER NOT NULL DEFAULT 0,
  asignado_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  creado_por_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  updated_by_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  fecha_vencimiento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subtareas_titulo_not_blank_chk
    CHECK (char_length(btrim(titulo)) > 0),
  CONSTRAINT subtareas_orden_en_columna_chk
    CHECK (orden_en_columna >= 0)
);

CREATE TABLE IF NOT EXISTS tareas_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  de_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  a_socio_id UUID NOT NULL REFERENCES socios(id) ON DELETE RESTRICT,
  solicitado_por_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  resuelto_por_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  motivo TEXT,
  comentario_resolucion TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  resuelto_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tareas_handoffs_estado_chk
    CHECK (estado IN ('pendiente', 'aceptado', 'rechazado', 'cancelado')),
  CONSTRAINT tareas_handoffs_distinto_socio_chk
    CHECK (de_socio_id IS NULL OR de_socio_id <> a_socio_id),
  CONSTRAINT tareas_handoffs_motivo_not_blank_chk
    CHECK (motivo IS NULL OR char_length(btrim(motivo)) > 0)
);

CREATE TABLE IF NOT EXISTS tareas_aprobaciones_cd (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  socio_id UUID NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  decision TEXT NOT NULL DEFAULT 'pendiente',
  observacion TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  aprobado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tareas_aprobaciones_cd_unique UNIQUE (tarea_id, socio_id),
  CONSTRAINT tareas_aprobaciones_cd_decision_chk
    CHECK (decision IN ('pendiente', 'aprobada', 'observada', 'rechazada')),
  CONSTRAINT tareas_aprobaciones_cd_observacion_chk
    CHECK (
      decision NOT IN ('observada', 'rechazada')
      OR char_length(btrim(COALESCE(observacion, ''))) > 0
    )
);

CREATE TABLE IF NOT EXISTS tareas_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID REFERENCES proyectos_tareas(id) ON DELETE CASCADE,
  tarea_id UUID REFERENCES tareas(id) ON DELETE CASCADE,
  subtarea_id UUID REFERENCES subtareas(id) ON DELETE CASCADE,
  actor_socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  estado_anterior estado_tarea,
  estado_nuevo estado_tarea,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tareas_historial_accion_not_blank_chk
    CHECK (char_length(btrim(accion)) > 0),
  CONSTRAINT tareas_historial_scope_chk
    CHECK (num_nonnulls(proyecto_id, tarea_id, subtarea_id) >= 1)
);

-- 3) updated_at + append-only helpers
CREATE OR REPLACE FUNCTION fn_tasks_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_direcciones_bu_set_updated_at ON direcciones;
CREATE TRIGGER trg_direcciones_bu_set_updated_at
  BEFORE UPDATE ON direcciones
  FOR EACH ROW
  EXECUTE FUNCTION fn_tasks_set_updated_at();

DROP TRIGGER IF EXISTS trg_socios_direcciones_bu_set_updated_at ON socios_direcciones;
CREATE TRIGGER trg_socios_direcciones_bu_set_updated_at
  BEFORE UPDATE ON socios_direcciones
  FOR EACH ROW
  EXECUTE FUNCTION fn_tasks_set_updated_at();

DROP TRIGGER IF EXISTS trg_proyectos_tareas_bu_set_updated_at ON proyectos_tareas;
CREATE TRIGGER trg_proyectos_tareas_bu_set_updated_at
  BEFORE UPDATE ON proyectos_tareas
  FOR EACH ROW
  EXECUTE FUNCTION fn_tasks_set_updated_at();

DROP TRIGGER IF EXISTS trg_tareas_bu_set_updated_at ON tareas;
CREATE TRIGGER trg_tareas_bu_set_updated_at
  BEFORE UPDATE ON tareas
  FOR EACH ROW
  EXECUTE FUNCTION fn_tasks_set_updated_at();

DROP TRIGGER IF EXISTS trg_subtareas_bu_set_updated_at ON subtareas;
CREATE TRIGGER trg_subtareas_bu_set_updated_at
  BEFORE UPDATE ON subtareas
  FOR EACH ROW
  EXECUTE FUNCTION fn_tasks_set_updated_at();

DROP TRIGGER IF EXISTS trg_tareas_handoffs_bu_set_updated_at ON tareas_handoffs;
CREATE TRIGGER trg_tareas_handoffs_bu_set_updated_at
  BEFORE UPDATE ON tareas_handoffs
  FOR EACH ROW
  EXECUTE FUNCTION fn_tasks_set_updated_at();

DROP TRIGGER IF EXISTS trg_tareas_aprobaciones_cd_bu_set_updated_at ON tareas_aprobaciones_cd;
CREATE TRIGGER trg_tareas_aprobaciones_cd_bu_set_updated_at
  BEFORE UPDATE ON tareas_aprobaciones_cd
  FOR EACH ROW
  EXECUTE FUNCTION fn_tasks_set_updated_at();

CREATE OR REPLACE FUNCTION fn_tareas_historial_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'tareas_historial es append-only';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tareas_historial_no_update_delete ON tareas_historial;
CREATE TRIGGER trg_tareas_historial_no_update_delete
  BEFORE UPDATE OR DELETE ON tareas_historial
  FOR EACH ROW
  EXECUTE FUNCTION fn_tareas_historial_append_only();

-- 4) Seed base directions
INSERT INTO direcciones (codigo, nombre, descripcion, activo)
VALUES
  ('cea', 'CEA', 'Comision Ejecutiva de Administracion', true),
  ('finanzas', 'Finanzas', 'Direccion de Finanzas', true),
  ('recursos_humanos', 'Recursos Humanos', 'Direccion de Recursos Humanos', true),
  ('comunicacion', 'Comunicación', 'Direccion de Comunicacion', true)
ON CONFLICT (codigo) DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  activo = true,
  updated_at = now();

-- 5) Indexes: FK and board/filter composites
CREATE INDEX IF NOT EXISTS idx_socios_direcciones_socio_id
  ON socios_direcciones (socio_id);

CREATE INDEX IF NOT EXISTS idx_socios_direcciones_direccion_id
  ON socios_direcciones (direccion_id);

CREATE INDEX IF NOT EXISTS idx_socios_direcciones_direccion_activo_director
  ON socios_direcciones (direccion_id, activo, es_director);

CREATE INDEX IF NOT EXISTS idx_proyectos_tareas_direccion_id
  ON proyectos_tareas (direccion_id);

CREATE INDEX IF NOT EXISTS idx_proyectos_tareas_creado_por_socio_id
  ON proyectos_tareas (creado_por_socio_id);

CREATE INDEX IF NOT EXISTS idx_proyectos_tareas_responsable_socio_id
  ON proyectos_tareas (responsable_socio_id);

CREATE INDEX IF NOT EXISTS idx_proyectos_tareas_board_filters
  ON proyectos_tareas (direccion_id, tipo, activo, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tareas_proyecto_id
  ON tareas (proyecto_id);

CREATE INDEX IF NOT EXISTS idx_tareas_asignado_socio_id
  ON tareas (asignado_socio_id);

CREATE INDEX IF NOT EXISTS idx_tareas_creado_por_socio_id
  ON tareas (creado_por_socio_id);

CREATE INDEX IF NOT EXISTS idx_tareas_updated_by_socio_id
  ON tareas (updated_by_socio_id);

CREATE INDEX IF NOT EXISTS idx_tareas_board_project_state_order
  ON tareas (proyecto_id, estado, orden_en_columna, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tareas_filters_assignee_state
  ON tareas (asignado_socio_id, estado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tareas_filters_project_due_state
  ON tareas (proyecto_id, fecha_vencimiento, estado)
  WHERE fecha_vencimiento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subtareas_tarea_id
  ON subtareas (tarea_id);

CREATE INDEX IF NOT EXISTS idx_subtareas_asignado_socio_id
  ON subtareas (asignado_socio_id);

CREATE INDEX IF NOT EXISTS idx_subtareas_creado_por_socio_id
  ON subtareas (creado_por_socio_id);

CREATE INDEX IF NOT EXISTS idx_subtareas_updated_by_socio_id
  ON subtareas (updated_by_socio_id);

CREATE INDEX IF NOT EXISTS idx_subtareas_board_task_state_order
  ON subtareas (tarea_id, estado, orden_en_columna, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tareas_handoffs_tarea_id
  ON tareas_handoffs (tarea_id);

CREATE INDEX IF NOT EXISTS idx_tareas_handoffs_de_socio_id
  ON tareas_handoffs (de_socio_id);

CREATE INDEX IF NOT EXISTS idx_tareas_handoffs_a_socio_id
  ON tareas_handoffs (a_socio_id);

CREATE INDEX IF NOT EXISTS idx_tareas_handoffs_solicitado_por_socio_id
  ON tareas_handoffs (solicitado_por_socio_id);

CREATE INDEX IF NOT EXISTS idx_tareas_handoffs_resuelto_por_socio_id
  ON tareas_handoffs (resuelto_por_socio_id);

CREATE INDEX IF NOT EXISTS idx_tareas_handoffs_task_state_created
  ON tareas_handoffs (tarea_id, estado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tareas_handoffs_target_state_created
  ON tareas_handoffs (a_socio_id, estado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tareas_aprobaciones_cd_tarea_id
  ON tareas_aprobaciones_cd (tarea_id);

CREATE INDEX IF NOT EXISTS idx_tareas_aprobaciones_cd_socio_id
  ON tareas_aprobaciones_cd (socio_id);

CREATE INDEX IF NOT EXISTS idx_tareas_aprobaciones_cd_tarea_decision_created
  ON tareas_aprobaciones_cd (tarea_id, decision, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tareas_historial_proyecto_id
  ON tareas_historial (proyecto_id);

CREATE INDEX IF NOT EXISTS idx_tareas_historial_tarea_id
  ON tareas_historial (tarea_id);

CREATE INDEX IF NOT EXISTS idx_tareas_historial_subtarea_id
  ON tareas_historial (subtarea_id);

CREATE INDEX IF NOT EXISTS idx_tareas_historial_actor_socio_id
  ON tareas_historial (actor_socio_id);

CREATE INDEX IF NOT EXISTS idx_tareas_historial_tarea_created
  ON tareas_historial (tarea_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_tareas_historial_subtarea_created
  ON tareas_historial (subtarea_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_tareas_historial_actor_created
  ON tareas_historial (actor_socio_id, created_at DESC);

-- 6) RLS on all new tables (policies in following migrations)
ALTER TABLE direcciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE socios_direcciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos_tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas_aprobaciones_cd ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas_historial ENABLE ROW LEVEL SECURITY;
