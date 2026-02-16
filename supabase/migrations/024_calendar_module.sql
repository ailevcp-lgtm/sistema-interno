-- ============================================================
-- 024: Calendario institucional con invitaciones y notificaciones
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'calendario_alcance_reunion'
  ) THEN
    CREATE TYPE calendario_alcance_reunion AS ENUM (
      'personalizada',
      'comision_directiva',
      'general'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'calendario_participacion_reunion'
  ) THEN
    CREATE TYPE calendario_participacion_reunion AS ENUM (
      'invitado',
      'involucrado'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS reuniones_calendario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  lugar TEXT,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ NOT NULL,
  alcance calendario_alcance_reunion NOT NULL DEFAULT 'personalizada',
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin > fecha_inicio)
);

CREATE TABLE IF NOT EXISTS reuniones_calendario_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id UUID NOT NULL REFERENCES reuniones_calendario (id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  socio_id UUID NOT NULL REFERENCES socios (id) ON DELETE CASCADE,
  participacion calendario_participacion_reunion NOT NULL DEFAULT 'invitado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reunion_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_reuniones_calendario_fecha_inicio
  ON reuniones_calendario (fecha_inicio ASC);

CREATE INDEX IF NOT EXISTS idx_reuniones_calendario_created_by
  ON reuniones_calendario (created_by);

CREATE INDEX IF NOT EXISTS idx_reuniones_participantes_reunion
  ON reuniones_calendario_participantes (reunion_id);

CREATE INDEX IF NOT EXISTS idx_reuniones_participantes_usuario
  ON reuniones_calendario_participantes (usuario_id, reunion_id);

CREATE OR REPLACE FUNCTION fn_calendar_can_schedule_meetings(p_usuario_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM socios s
    LEFT JOIN rol_aile_definitions rad ON rad.id = s.rol_aile_id
    WHERE s.usuario_id = COALESCE(p_usuario_id, auth.uid())
      AND COALESCE(s.estado, 'activo') = 'activo'
      AND (
        s.rol = 'admin'
        OR lower(COALESCE(rad.nombre, s.rol_aile, '')) IN (
          'presidente',
          'secretario general',
          'tesorero'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION fn_calendar_is_committee_member_user(p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM socios s
    LEFT JOIN rol_aile_definitions rad ON rad.id = s.rol_aile_id
    WHERE s.usuario_id = p_usuario_id
      AND COALESCE(s.estado, 'activo') = 'activo'
      AND (
        s.rol = 'comision_directiva'
        OR lower(COALESCE(rad.nombre, s.rol_aile, '')) IN (
          'presidente',
          'vicepresidente',
          'secretario general',
          'director de finanzas',
          'tesorero',
          'vocal titular',
          'vocal suplente'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION fn_reuniones_calendario_biu()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_at IS NULL THEN
      NEW.created_at := now();
    END IF;

    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reuniones_calendario_biu ON reuniones_calendario;
CREATE TRIGGER trg_reuniones_calendario_biu
  BEFORE INSERT OR UPDATE ON reuniones_calendario
  FOR EACH ROW
  EXECUTE FUNCTION fn_reuniones_calendario_biu();

ALTER TABLE reuniones_calendario ENABLE ROW LEVEL SECURITY;
ALTER TABLE reuniones_calendario_participantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_meetings_select" ON reuniones_calendario;
CREATE POLICY "calendar_meetings_select"
ON reuniones_calendario
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR fn_calendar_can_schedule_meetings(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM reuniones_calendario_participantes rp
    WHERE rp.reunion_id = reuniones_calendario.id
      AND rp.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "calendar_meetings_insert" ON reuniones_calendario;
CREATE POLICY "calendar_meetings_insert"
ON reuniones_calendario
FOR INSERT
TO authenticated
WITH CHECK (
  fn_calendar_can_schedule_meetings(auth.uid())
);

DROP POLICY IF EXISTS "calendar_meetings_update" ON reuniones_calendario;
CREATE POLICY "calendar_meetings_update"
ON reuniones_calendario
FOR UPDATE
TO authenticated
USING (
  fn_calendar_can_schedule_meetings(auth.uid())
)
WITH CHECK (
  fn_calendar_can_schedule_meetings(auth.uid())
);

DROP POLICY IF EXISTS "calendar_meetings_delete" ON reuniones_calendario;
CREATE POLICY "calendar_meetings_delete"
ON reuniones_calendario
FOR DELETE
TO authenticated
USING (
  fn_calendar_can_schedule_meetings(auth.uid())
);

DROP POLICY IF EXISTS "calendar_participants_select" ON reuniones_calendario_participantes;
CREATE POLICY "calendar_participants_select"
ON reuniones_calendario_participantes
FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid()
  OR fn_calendar_can_schedule_meetings(auth.uid())
);

DROP POLICY IF EXISTS "calendar_participants_insert" ON reuniones_calendario_participantes;
CREATE POLICY "calendar_participants_insert"
ON reuniones_calendario_participantes
FOR INSERT
TO authenticated
WITH CHECK (
  fn_calendar_can_schedule_meetings(auth.uid())
);

DROP POLICY IF EXISTS "calendar_participants_update" ON reuniones_calendario_participantes;
CREATE POLICY "calendar_participants_update"
ON reuniones_calendario_participantes
FOR UPDATE
TO authenticated
USING (
  fn_calendar_can_schedule_meetings(auth.uid())
)
WITH CHECK (
  fn_calendar_can_schedule_meetings(auth.uid())
);

DROP POLICY IF EXISTS "calendar_participants_delete" ON reuniones_calendario_participantes;
CREATE POLICY "calendar_participants_delete"
ON reuniones_calendario_participantes
FOR DELETE
TO authenticated
USING (
  fn_calendar_can_schedule_meetings(auth.uid())
);

CREATE OR REPLACE FUNCTION rpc_calendar_schedule_meeting(
  p_titulo TEXT,
  p_descripcion TEXT DEFAULT NULL,
  p_lugar TEXT DEFAULT NULL,
  p_fecha_inicio TIMESTAMPTZ DEFAULT NULL,
  p_fecha_fin TIMESTAMPTZ DEFAULT NULL,
  p_alcance calendario_alcance_reunion DEFAULT 'personalizada',
  p_usuario_ids_involucrados UUID[] DEFAULT ARRAY[]::UUID[],
  p_usuario_ids_invitados UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS reuniones_calendario
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := auth.uid();
  v_reunion reuniones_calendario;
  v_involucrados UUID[] := COALESCE(p_usuario_ids_involucrados, ARRAY[]::UUID[]);
  v_invitados UUID[] := COALESCE(p_usuario_ids_invitados, ARRAY[]::UUID[]);
  v_invalid_count INTEGER := 0;
  v_inserted_participants INTEGER := 0;
  v_fecha_texto TEXT;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF NOT fn_calendar_can_schedule_meetings(v_actor_user_id) THEN
    RAISE EXCEPTION 'Solo Presidente, Secretario General, Tesorero o Admin pueden agendar reuniones';
  END IF;

  IF p_titulo IS NULL OR btrim(p_titulo) = '' THEN
    RAISE EXCEPTION 'El titulo de la reunion es obligatorio';
  END IF;

  IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL THEN
    RAISE EXCEPTION 'La fecha de inicio y fin son obligatorias';
  END IF;

  IF p_fecha_fin <= p_fecha_inicio THEN
    RAISE EXCEPTION 'La fecha de finalizacion debe ser posterior al inicio';
  END IF;

  IF p_alcance = 'personalizada'
     AND COALESCE(array_length(v_involucrados, 1), 0) = 0
     AND COALESCE(array_length(v_invitados, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Debes seleccionar al menos una persona invitada o involucrada';
  END IF;

  IF p_alcance = 'comision_directiva' THEN
    SELECT COUNT(1)
    INTO v_invalid_count
    FROM (
      SELECT DISTINCT u.usuario_id
      FROM unnest(v_involucrados || v_invitados) AS u(usuario_id)
      WHERE u.usuario_id IS NOT NULL
    ) req
    WHERE NOT fn_calendar_is_committee_member_user(req.usuario_id);

    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION 'En reuniones de Comision Directiva solo se puede incluir a miembros de Comision Directiva';
    END IF;
  END IF;

  IF p_alcance = 'personalizada' THEN
    SELECT COUNT(1)
    INTO v_invalid_count
    FROM (
      SELECT DISTINCT u.usuario_id
      FROM unnest(v_involucrados || v_invitados) AS u(usuario_id)
      WHERE u.usuario_id IS NOT NULL
    ) req
    LEFT JOIN socios s
      ON s.usuario_id = req.usuario_id
      AND COALESCE(s.estado, 'activo') = 'activo'
    WHERE s.id IS NULL;

    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION 'Hay usuarios seleccionados que no estan activos o no existen';
    END IF;
  END IF;

  INSERT INTO reuniones_calendario (
    titulo,
    descripcion,
    lugar,
    fecha_inicio,
    fecha_fin,
    alcance,
    created_by
  )
  VALUES (
    btrim(p_titulo),
    NULLIF(btrim(COALESCE(p_descripcion, '')), ''),
    NULLIF(btrim(COALESCE(p_lugar, '')), ''),
    p_fecha_inicio,
    p_fecha_fin,
    COALESCE(p_alcance, 'personalizada'),
    v_actor_user_id
  )
  RETURNING *
  INTO v_reunion;

  WITH usuarios_activos AS (
    SELECT
      s.usuario_id,
      s.id AS socio_id,
      (
        s.rol = 'comision_directiva'
        OR lower(COALESCE(rad.nombre, s.rol_aile, '')) IN (
          'presidente',
          'vicepresidente',
          'secretario general',
          'director de finanzas',
          'tesorero',
          'vocal titular',
          'vocal suplente'
        )
      ) AS es_comision_directiva
    FROM socios s
    LEFT JOIN rol_aile_definitions rad ON rad.id = s.rol_aile_id
    WHERE s.usuario_id IS NOT NULL
      AND COALESCE(s.estado, 'activo') = 'activo'
  ),
  solicitados AS (
    SELECT
      u.usuario_id,
      'involucrado'::calendario_participacion_reunion AS participacion
    FROM unnest(v_involucrados) AS u(usuario_id)
    WHERE u.usuario_id IS NOT NULL

    UNION ALL

    SELECT
      u.usuario_id,
      'invitado'::calendario_participacion_reunion AS participacion
    FROM unnest(v_invitados) AS u(usuario_id)
    WHERE u.usuario_id IS NOT NULL
  ),
  solicitados_unicos AS (
    SELECT
      s.usuario_id,
      CASE
        WHEN bool_or(s.participacion = 'involucrado') THEN 'involucrado'::calendario_participacion_reunion
        ELSE 'invitado'::calendario_participacion_reunion
      END AS participacion
    FROM solicitados s
    GROUP BY s.usuario_id
  ),
  destinatarios AS (
    SELECT
      ua.usuario_id,
      ua.socio_id,
      CASE
        WHEN p_alcance = 'personalizada' THEN su.participacion
        ELSE COALESCE(su.participacion, 'invitado'::calendario_participacion_reunion)
      END AS participacion
    FROM usuarios_activos ua
    LEFT JOIN solicitados_unicos su ON su.usuario_id = ua.usuario_id
    WHERE (
      (p_alcance = 'personalizada' AND su.usuario_id IS NOT NULL)
      OR (p_alcance = 'comision_directiva' AND ua.es_comision_directiva)
      OR (p_alcance = 'general')
    )
  )
  INSERT INTO reuniones_calendario_participantes (
    reunion_id,
    usuario_id,
    socio_id,
    participacion
  )
  SELECT
    v_reunion.id,
    d.usuario_id,
    d.socio_id,
    d.participacion
  FROM destinatarios d
  ON CONFLICT (reunion_id, usuario_id)
  DO UPDATE SET participacion = EXCLUDED.participacion;

  GET DIAGNOSTICS v_inserted_participants = ROW_COUNT;

  IF v_inserted_participants = 0 THEN
    RAISE EXCEPTION 'No hay destinatarios validos para esta reunion';
  END IF;

  v_fecha_texto := to_char(
    v_reunion.fecha_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires',
    'DD/MM/YYYY HH24:MI'
  );

  INSERT INTO notificaciones (
    usuario_id,
    titulo,
    mensaje,
    tipo,
    link
  )
  SELECT
    rp.usuario_id,
    format('Nueva reunion: %s', v_reunion.titulo),
    CASE
      WHEN rp.participacion = 'involucrado'::calendario_participacion_reunion
        THEN format('Fuiste asignada/o como involucrada/o para el %s.', v_fecha_texto)
      ELSE format('Fuiste invitada/o para el %s.', v_fecha_texto)
    END,
    'info'::tipo_notificacion,
    '/calendario'
  FROM reuniones_calendario_participantes rp
  WHERE rp.reunion_id = v_reunion.id
    AND rp.usuario_id <> v_actor_user_id;

  RETURN v_reunion;
END;
$$;
