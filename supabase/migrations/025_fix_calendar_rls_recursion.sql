-- ============================================================
-- 025: Fix RLS recursion in calendar policies
-- ============================================================
-- 42P17 "infinite recursion detected in policy" occurred because:
-- - reuniones_calendario SELECT policy referenced participantes table
-- - participantes SELECT policy referenced reuniones_calendario table
-- This migration removes the reverse reference to break the cycle.

DROP POLICY IF EXISTS "calendar_participants_select" ON reuniones_calendario_participantes;

CREATE POLICY "calendar_participants_select"
ON reuniones_calendario_participantes
FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid()
  OR fn_calendar_can_schedule_meetings(auth.uid())
);

-- Limitar edición/eliminación de reuniones a quien la creó (o admin).
DROP POLICY IF EXISTS "calendar_meetings_update" ON reuniones_calendario;
CREATE POLICY "calendar_meetings_update"
ON reuniones_calendario
FOR UPDATE
TO authenticated
USING (
  fn_calendar_can_schedule_meetings(auth.uid())
  AND (
    reuniones_calendario.created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM socios s
      WHERE s.usuario_id = auth.uid()
        AND s.rol = 'admin'
    )
  )
)
WITH CHECK (
  fn_calendar_can_schedule_meetings(auth.uid())
  AND (
    reuniones_calendario.created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM socios s
      WHERE s.usuario_id = auth.uid()
        AND s.rol = 'admin'
    )
  )
);

DROP POLICY IF EXISTS "calendar_meetings_delete" ON reuniones_calendario;
CREATE POLICY "calendar_meetings_delete"
ON reuniones_calendario
FOR DELETE
TO authenticated
USING (
  fn_calendar_can_schedule_meetings(auth.uid())
  AND (
    reuniones_calendario.created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM socios s
      WHERE s.usuario_id = auth.uid()
        AND s.rol = 'admin'
    )
  )
);

CREATE OR REPLACE FUNCTION rpc_calendar_update_meeting(
  p_reunion_id UUID,
  p_titulo TEXT DEFAULT NULL,
  p_descripcion TEXT DEFAULT NULL,
  p_lugar TEXT DEFAULT NULL,
  p_fecha_inicio TIMESTAMPTZ DEFAULT NULL,
  p_fecha_fin TIMESTAMPTZ DEFAULT NULL,
  p_alcance calendario_alcance_reunion DEFAULT NULL,
  p_usuario_ids_involucrados UUID[] DEFAULT NULL,
  p_usuario_ids_invitados UUID[] DEFAULT NULL
)
RETURNS reuniones_calendario
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := auth.uid();
  v_reunion reuniones_calendario;
  v_titulo TEXT;
  v_descripcion TEXT;
  v_lugar TEXT;
  v_fecha_inicio TIMESTAMPTZ;
  v_fecha_fin TIMESTAMPTZ;
  v_alcance calendario_alcance_reunion;
  v_involucrados UUID[] := COALESCE(p_usuario_ids_involucrados, ARRAY[]::UUID[]);
  v_invitados UUID[] := COALESCE(p_usuario_ids_invitados, ARRAY[]::UUID[]);
  v_invalid_count INTEGER := 0;
  v_inserted_participants INTEGER := 0;
  v_fecha_texto TEXT;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF p_reunion_id IS NULL THEN
    RAISE EXCEPTION 'Debes indicar la reunion a actualizar';
  END IF;

  SELECT *
  INTO v_reunion
  FROM reuniones_calendario
  WHERE id = p_reunion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reunion no encontrada';
  END IF;

  IF NOT fn_calendar_can_schedule_meetings(v_actor_user_id) THEN
    RAISE EXCEPTION 'No autorizado para editar reuniones';
  END IF;

  IF v_reunion.created_by <> v_actor_user_id AND NOT EXISTS (
    SELECT 1
    FROM socios s
    WHERE s.usuario_id = v_actor_user_id
      AND s.rol = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo la persona organizadora (o admin) puede editar esta reunion';
  END IF;

  IF p_usuario_ids_involucrados IS NULL AND p_usuario_ids_invitados IS NULL THEN
    SELECT
      COALESCE(array_agg(rp.usuario_id) FILTER (WHERE rp.participacion = 'involucrado'), ARRAY[]::UUID[]),
      COALESCE(array_agg(rp.usuario_id) FILTER (WHERE rp.participacion = 'invitado'), ARRAY[]::UUID[])
    INTO v_involucrados, v_invitados
    FROM reuniones_calendario_participantes rp
    WHERE rp.reunion_id = p_reunion_id;
  END IF;

  v_titulo := COALESCE(NULLIF(btrim(COALESCE(p_titulo, '')), ''), v_reunion.titulo);
  v_descripcion := CASE
    WHEN p_descripcion IS NULL THEN v_reunion.descripcion
    ELSE NULLIF(btrim(p_descripcion), '')
  END;
  v_lugar := CASE
    WHEN p_lugar IS NULL THEN v_reunion.lugar
    ELSE NULLIF(btrim(p_lugar), '')
  END;
  v_fecha_inicio := COALESCE(p_fecha_inicio, v_reunion.fecha_inicio);
  v_fecha_fin := COALESCE(p_fecha_fin, v_reunion.fecha_fin);
  v_alcance := COALESCE(p_alcance, v_reunion.alcance);

  IF v_titulo IS NULL OR btrim(v_titulo) = '' THEN
    RAISE EXCEPTION 'El titulo de la reunion es obligatorio';
  END IF;

  IF v_fecha_inicio IS NULL OR v_fecha_fin IS NULL THEN
    RAISE EXCEPTION 'La fecha de inicio y fin son obligatorias';
  END IF;

  IF v_fecha_fin <= v_fecha_inicio THEN
    RAISE EXCEPTION 'La fecha de finalizacion debe ser posterior al inicio';
  END IF;

  IF v_alcance = 'personalizada'
     AND COALESCE(array_length(v_involucrados, 1), 0) = 0
     AND COALESCE(array_length(v_invitados, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Debes seleccionar al menos una persona invitada o involucrada';
  END IF;

  IF v_alcance = 'comision_directiva' THEN
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

  IF v_alcance = 'personalizada' THEN
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

  UPDATE reuniones_calendario
  SET
    titulo = v_titulo,
    descripcion = v_descripcion,
    lugar = v_lugar,
    fecha_inicio = v_fecha_inicio,
    fecha_fin = v_fecha_fin,
    alcance = v_alcance
  WHERE id = p_reunion_id;

  DELETE FROM reuniones_calendario_participantes
  WHERE reunion_id = p_reunion_id;

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
        WHEN v_alcance = 'personalizada' THEN su.participacion
        ELSE COALESCE(su.participacion, 'invitado'::calendario_participacion_reunion)
      END AS participacion
    FROM usuarios_activos ua
    LEFT JOIN solicitados_unicos su ON su.usuario_id = ua.usuario_id
    WHERE (
      (v_alcance = 'personalizada' AND su.usuario_id IS NOT NULL)
      OR (v_alcance = 'comision_directiva' AND ua.es_comision_directiva)
      OR (v_alcance = 'general')
    )
  )
  INSERT INTO reuniones_calendario_participantes (
    reunion_id,
    usuario_id,
    socio_id,
    participacion
  )
  SELECT
    p_reunion_id,
    d.usuario_id,
    d.socio_id,
    d.participacion
  FROM destinatarios d;

  GET DIAGNOSTICS v_inserted_participants = ROW_COUNT;

  IF v_inserted_participants = 0 THEN
    RAISE EXCEPTION 'No hay destinatarios validos para esta reunion';
  END IF;

  v_fecha_texto := to_char(
    v_fecha_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires',
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
    format('Reunion actualizada: %s', v_titulo),
    format('Hubo cambios en la reunion. Nueva fecha/hora: %s.', v_fecha_texto),
    'info'::tipo_notificacion,
    '/calendario'
  FROM reuniones_calendario_participantes rp
  WHERE rp.reunion_id = p_reunion_id
    AND rp.usuario_id <> v_actor_user_id;

  SELECT *
  INTO v_reunion
  FROM reuniones_calendario
  WHERE id = p_reunion_id;

  RETURN v_reunion;
END;
$$;
