-- ============================================================
-- 033: Alineacion de permisos segun auditoria de roles
-- ============================================================

-- ------------------------------------------------------------
-- CALENDARIO
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_calendar_is_global_manager_user(p_usuario_id UUID DEFAULT auth.uid())
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
        OR s.rol = 'comision_directiva'
        OR lower(COALESCE(rad.nombre, s.rol_aile, '')) IN (
          'presidente',
          'tesorero',
          'secretario general',
          'vocal titular'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION fn_calendar_can_schedule_meetings(p_usuario_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fn_calendar_is_global_manager_user(COALESCE(p_usuario_id, auth.uid()));
$$;

CREATE OR REPLACE FUNCTION fn_calendar_is_committee_member_user(p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    fn_calendar_is_global_manager_user(p_usuario_id)
    OR EXISTS (
      SELECT 1
      FROM socios s
      LEFT JOIN rol_aile_definitions rad ON rad.id = s.rol_aile_id
      WHERE s.usuario_id = p_usuario_id
        AND COALESCE(s.estado, 'activo') = 'activo'
        AND lower(COALESCE(rad.nombre, s.rol_aile, '')) = 'vocal suplente'
    )
  );
$$;

DROP POLICY IF EXISTS "calendar_meetings_select" ON reuniones_calendario;
CREATE POLICY "calendar_meetings_select"
ON reuniones_calendario
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "calendar_participants_select" ON reuniones_calendario_participantes;
CREATE POLICY "calendar_participants_select"
ON reuniones_calendario_participantes
FOR SELECT
TO authenticated
USING (true);

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
    RAISE EXCEPTION 'Solo la Comision Directiva puede editar reuniones';
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
      RAISE EXCEPTION 'En reuniones de Comision Directiva solo se puede incluir a miembros habilitados';
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
      fn_calendar_is_committee_member_user(s.usuario_id) AS es_comision_directiva
    FROM socios s
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

-- ------------------------------------------------------------
-- REINTEGROS
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_is_director_finanzas()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    (SELECT fn_has_rol_aile('Director de Finanzas'))
    OR (SELECT fn_has_rol_aile('Miembro de Finanzas'))
  );
$$;

CREATE OR REPLACE FUNCTION fn_reintegros_is_global_manager()
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
    WHERE s.usuario_id = auth.uid()
      AND COALESCE(s.estado, 'activo') = 'activo'
      AND (
        s.rol = 'admin'
        OR s.rol = 'comision_directiva'
        OR lower(COALESCE(rad.nombre, s.rol_aile, '')) IN (
          'presidente',
          'tesorero',
          'secretario general',
          'vocal titular'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION fn_reintegros_can_create_requests()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    (SELECT fn_reintegros_is_global_manager())
    OR (SELECT fn_is_director_finanzas())
  );
$$;

CREATE OR REPLACE FUNCTION fn_reintegros_can_operate_workflow()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    (SELECT fn_reintegros_is_global_manager())
    OR (SELECT fn_is_tesorero())
  );
$$;

CREATE OR REPLACE FUNCTION fn_can_view_solicitud_reintegro(p_solicitud_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitud solicitudes_reintegro%ROWTYPE;
  v_socio_id UUID;
BEGIN
  SELECT *
  INTO v_solicitud
  FROM solicitudes_reintegro sr
  WHERE sr.id = p_solicitud_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF (SELECT fn_reintegros_is_global_manager())
     OR (SELECT fn_is_revisor_cuentas()) THEN
    RETURN true;
  END IF;

  v_socio_id := (SELECT fn_current_socio_id());

  IF v_socio_id IS NULL THEN
    RETURN false;
  END IF;

  IF (SELECT fn_is_director_finanzas())
     AND v_solicitud.solicitante_socio_id = v_socio_id THEN
    RETURN true;
  END IF;

  IF (SELECT fn_is_tesorero())
     AND (
       v_solicitud.tesorero_socio_id = v_socio_id
       OR v_solicitud.estado IN ('pendiente_aprobacion', 'aprobada_pendiente_pago')
     ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_crear_solicitud_reintegro(p_payload JSONB)
RETURNS solicitudes_reintegro
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := (SELECT auth.uid());
  v_actor_socio_id UUID := (SELECT fn_current_socio_id());
  v_solicitante_socio_id UUID;
  v_tesorero_socio_id UUID;
  v_fecha_gasto DATE;
  v_categoria_id UUID;
  v_monto_solicitado NUMERIC(12,2);
  v_moneda TEXT;
  v_descripcion TEXT;
  v_factura_url TEXT;
  v_factura_numero TEXT;
  v_factura_emisor TEXT;
  v_result solicitudes_reintegro;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF NOT (SELECT fn_reintegros_can_create_requests()) THEN
    RAISE EXCEPTION 'No autorizado para crear solicitudes de reintegro';
  END IF;

  v_fecha_gasto := (p_payload ->> 'fecha_gasto')::DATE;
  v_categoria_id := NULLIF(p_payload ->> 'categoria_id', '')::UUID;
  v_monto_solicitado := (p_payload ->> 'monto_solicitado')::NUMERIC(12,2);
  v_moneda := COALESCE(NULLIF(btrim(p_payload ->> 'moneda'), ''), 'ARS');
  v_descripcion := btrim(COALESCE(p_payload ->> 'descripcion', ''));
  v_factura_url := btrim(COALESCE(p_payload ->> 'factura_url', ''));
  v_factura_numero := NULLIF(btrim(COALESCE(p_payload ->> 'factura_numero', '')), '');
  v_factura_emisor := NULLIF(btrim(COALESCE(p_payload ->> 'factura_emisor', '')), '');

  IF (SELECT fn_reintegros_is_global_manager()) THEN
    v_solicitante_socio_id := NULLIF(p_payload ->> 'solicitante_socio_id', '')::UUID;
    IF v_solicitante_socio_id IS NULL THEN
      v_solicitante_socio_id := v_actor_socio_id;
    END IF;
  ELSE
    v_solicitante_socio_id := v_actor_socio_id;
  END IF;

  v_tesorero_socio_id := NULLIF(p_payload ->> 'tesorero_socio_id', '')::UUID;

  IF v_solicitante_socio_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo resolver el solicitante de la solicitud';
  END IF;

  IF v_fecha_gasto IS NULL THEN
    RAISE EXCEPTION 'fecha_gasto es obligatoria';
  END IF;

  IF v_monto_solicitado IS NULL OR v_monto_solicitado <= 0 THEN
    RAISE EXCEPTION 'monto_solicitado debe ser mayor a 0';
  END IF;

  IF v_descripcion = '' THEN
    RAISE EXCEPTION 'descripcion es obligatoria';
  END IF;

  IF v_factura_url = '' THEN
    RAISE EXCEPTION 'factura_url es obligatoria';
  END IF;

  PERFORM fn_validate_reintegro_categoria_egreso(v_categoria_id);

  IF v_tesorero_socio_id IS NOT NULL
     AND NOT (SELECT fn_reintegros_socio_is_tesorero(v_tesorero_socio_id)) THEN
    RAISE EXCEPTION 'tesorero_socio_id no corresponde a un tesorero';
  END IF;

  INSERT INTO solicitudes_reintegro (
    solicitante_socio_id,
    tesorero_socio_id,
    estado,
    fecha_gasto,
    categoria_id,
    monto_solicitado,
    moneda,
    descripcion,
    factura_url,
    factura_numero,
    factura_emisor,
    created_by,
    updated_by
  )
  VALUES (
    v_solicitante_socio_id,
    v_tesorero_socio_id,
    'borrador',
    v_fecha_gasto,
    v_categoria_id,
    v_monto_solicitado,
    v_moneda,
    v_descripcion,
    v_factura_url,
    v_factura_numero,
    v_factura_emisor,
    v_actor_user_id,
    v_actor_user_id
  )
  RETURNING * INTO v_result;

  PERFORM fn_reintegros_append_historial(
    p_solicitud_id => v_result.id,
    p_accion => 'crear',
    p_estado_anterior => NULL,
    p_estado_nuevo => v_result.estado,
    p_comentario => NULL,
    p_metadata => jsonb_build_object(
      'monto_solicitado', v_result.monto_solicitado,
      'categoria_id', v_result.categoria_id,
      'factura_url', v_result.factura_url
    ),
    p_actor_user_id => v_actor_user_id,
    p_actor_socio_id => v_actor_socio_id
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_enviar_solicitud_reintegro(p_solicitud_id UUID)
RETURNS solicitudes_reintegro
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := (SELECT auth.uid());
  v_actor_socio_id UUID := (SELECT fn_current_socio_id());
  v_solicitud solicitudes_reintegro%ROWTYPE;
  v_tesorero_socio_id UUID;
  v_tesorero_user_id UUID;
  v_result solicitudes_reintegro;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT *
  INTO v_solicitud
  FROM solicitudes_reintegro sr
  WHERE sr.id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de reintegro no encontrada';
  END IF;

  IF NOT (SELECT fn_reintegros_can_create_requests()) THEN
    RAISE EXCEPTION 'No autorizado para enviar solicitudes';
  END IF;

  IF NOT (SELECT fn_reintegros_is_global_manager())
     AND v_solicitud.solicitante_socio_id <> v_actor_socio_id THEN
    RAISE EXCEPTION 'Solo el solicitante puede enviar esta solicitud';
  END IF;

  IF NOT (SELECT fn_reintegro_transition_allowed(v_solicitud.estado, 'pendiente_aprobacion')) THEN
    RAISE EXCEPTION 'Transicion de estado invalida: % -> pendiente_aprobacion', v_solicitud.estado;
  END IF;

  IF v_solicitud.categoria_id IS NULL THEN
    RAISE EXCEPTION 'categoria_id es obligatoria para enviar a aprobacion';
  END IF;

  PERFORM fn_validate_reintegro_categoria_egreso(v_solicitud.categoria_id);

  IF char_length(btrim(COALESCE(v_solicitud.factura_url, ''))) = 0 THEN
    RAISE EXCEPTION 'factura_url es obligatoria para enviar a aprobacion';
  END IF;

  v_tesorero_socio_id := v_solicitud.tesorero_socio_id;

  IF v_tesorero_socio_id IS NULL THEN
    v_tesorero_socio_id := (SELECT fn_reintegros_default_tesorero_socio_id());
  END IF;

  IF v_tesorero_socio_id IS NULL THEN
    RAISE EXCEPTION 'No existe un tesorero asignable para la solicitud';
  END IF;

  UPDATE solicitudes_reintegro
  SET
    estado = 'pendiente_aprobacion',
    fecha_solicitud = now(),
    tesorero_socio_id = v_tesorero_socio_id,
    updated_by = v_actor_user_id,
    motivo_observacion = NULL,
    motivo_rechazo = NULL
  WHERE id = p_solicitud_id
  RETURNING * INTO v_result;

  PERFORM fn_reintegros_append_historial(
    p_solicitud_id => v_result.id,
    p_accion => CASE WHEN v_solicitud.estado = 'observada' THEN 'reenviar' ELSE 'enviar' END,
    p_estado_anterior => v_solicitud.estado,
    p_estado_nuevo => v_result.estado,
    p_comentario => NULL,
    p_metadata => jsonb_build_object('tesorero_socio_id', v_tesorero_socio_id),
    p_actor_user_id => v_actor_user_id,
    p_actor_socio_id => v_actor_socio_id
  );

  v_tesorero_user_id := (SELECT fn_usuario_id_from_socio(v_tesorero_socio_id));

  PERFORM fn_reintegros_notify(
    p_usuario_id => v_tesorero_user_id,
    p_titulo => 'Nueva solicitud de reintegro',
    p_mensaje => format('La solicitud %s fue enviada para aprobacion.', v_result.numero),
    p_tipo => 'info',
    p_link => format('/reintegros?solicitud=%s', v_result.id)
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_observar_solicitud_reintegro(
  p_solicitud_id UUID,
  p_motivo TEXT
)
RETURNS solicitudes_reintegro
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := (SELECT auth.uid());
  v_actor_socio_id UUID := (SELECT fn_current_socio_id());
  v_solicitud solicitudes_reintegro%ROWTYPE;
  v_motivo TEXT := btrim(COALESCE(p_motivo, ''));
  v_solicitante_user_id UUID;
  v_result solicitudes_reintegro;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF NOT (SELECT fn_reintegros_can_operate_workflow()) THEN
    RAISE EXCEPTION 'No autorizado para observar solicitudes';
  END IF;

  IF v_motivo = '' THEN
    RAISE EXCEPTION 'El motivo de observacion es obligatorio';
  END IF;

  SELECT *
  INTO v_solicitud
  FROM solicitudes_reintegro sr
  WHERE sr.id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de reintegro no encontrada';
  END IF;

  IF v_solicitud.tesorero_socio_id IS NOT NULL
     AND v_solicitud.tesorero_socio_id <> v_actor_socio_id
     AND NOT (SELECT fn_reintegros_is_global_manager()) THEN
    RAISE EXCEPTION 'La solicitud esta asignada a otro tesorero';
  END IF;

  IF NOT (SELECT fn_reintegro_transition_allowed(v_solicitud.estado, 'observada')) THEN
    RAISE EXCEPTION 'Transicion de estado invalida: % -> observada', v_solicitud.estado;
  END IF;

  UPDATE solicitudes_reintegro
  SET
    estado = 'observada',
    motivo_observacion = v_motivo,
    motivo_rechazo = NULL,
    updated_by = v_actor_user_id
  WHERE id = p_solicitud_id
  RETURNING * INTO v_result;

  PERFORM fn_reintegros_append_historial(
    p_solicitud_id => v_result.id,
    p_accion => 'observar',
    p_estado_anterior => v_solicitud.estado,
    p_estado_nuevo => v_result.estado,
    p_comentario => v_motivo,
    p_metadata => '{}'::jsonb,
    p_actor_user_id => v_actor_user_id,
    p_actor_socio_id => v_actor_socio_id
  );

  v_solicitante_user_id := (SELECT fn_usuario_id_from_socio(v_result.solicitante_socio_id));

  PERFORM fn_reintegros_notify(
    p_usuario_id => v_solicitante_user_id,
    p_titulo => 'Solicitud observada',
    p_mensaje => format('La solicitud %s requiere correcciones.', v_result.numero),
    p_tipo => 'alerta',
    p_link => format('/reintegros?solicitud=%s', v_result.id)
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_aprobar_solicitud_reintegro(
  p_solicitud_id UUID,
  p_monto_aprobado NUMERIC(12,2)
)
RETURNS solicitudes_reintegro
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := (SELECT auth.uid());
  v_actor_socio_id UUID := (SELECT fn_current_socio_id());
  v_solicitud solicitudes_reintegro%ROWTYPE;
  v_monto_aprobado NUMERIC(12,2);
  v_solicitante_user_id UUID;
  v_result solicitudes_reintegro;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF NOT (SELECT fn_reintegros_can_operate_workflow()) THEN
    RAISE EXCEPTION 'No autorizado para aprobar solicitudes';
  END IF;

  SELECT *
  INTO v_solicitud
  FROM solicitudes_reintegro sr
  WHERE sr.id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de reintegro no encontrada';
  END IF;

  IF v_solicitud.tesorero_socio_id IS NOT NULL
     AND v_solicitud.tesorero_socio_id <> v_actor_socio_id
     AND NOT (SELECT fn_reintegros_is_global_manager()) THEN
    RAISE EXCEPTION 'La solicitud esta asignada a otro tesorero';
  END IF;

  IF NOT (SELECT fn_reintegro_transition_allowed(v_solicitud.estado, 'aprobada_pendiente_pago')) THEN
    RAISE EXCEPTION 'Transicion de estado invalida: % -> aprobada_pendiente_pago', v_solicitud.estado;
  END IF;

  v_monto_aprobado := COALESCE(p_monto_aprobado, v_solicitud.monto_solicitado);

  IF v_monto_aprobado IS NULL OR v_monto_aprobado <= 0 THEN
    RAISE EXCEPTION 'monto_aprobado debe ser mayor a 0';
  END IF;

  IF v_monto_aprobado > v_solicitud.monto_solicitado THEN
    RAISE EXCEPTION 'monto_aprobado no puede ser mayor al monto_solicitado';
  END IF;

  UPDATE solicitudes_reintegro
  SET
    estado = 'aprobada_pendiente_pago',
    monto_aprobado = v_monto_aprobado,
    fecha_aprobacion = now(),
    motivo_observacion = NULL,
    motivo_rechazo = NULL,
    updated_by = v_actor_user_id
  WHERE id = p_solicitud_id
  RETURNING * INTO v_result;

  PERFORM fn_reintegros_append_historial(
    p_solicitud_id => v_result.id,
    p_accion => 'aprobar',
    p_estado_anterior => v_solicitud.estado,
    p_estado_nuevo => v_result.estado,
    p_comentario => NULL,
    p_metadata => jsonb_build_object('monto_aprobado', v_monto_aprobado),
    p_actor_user_id => v_actor_user_id,
    p_actor_socio_id => v_actor_socio_id
  );

  v_solicitante_user_id := (SELECT fn_usuario_id_from_socio(v_result.solicitante_socio_id));

  PERFORM fn_reintegros_notify(
    p_usuario_id => v_solicitante_user_id,
    p_titulo => 'Solicitud aprobada',
    p_mensaje => format('La solicitud %s fue aprobada y queda pendiente de pago.', v_result.numero),
    p_tipo => 'exito',
    p_link => format('/reintegros?solicitud=%s', v_result.id)
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_rechazar_solicitud_reintegro(
  p_solicitud_id UUID,
  p_motivo TEXT
)
RETURNS solicitudes_reintegro
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := (SELECT auth.uid());
  v_actor_socio_id UUID := (SELECT fn_current_socio_id());
  v_solicitud solicitudes_reintegro%ROWTYPE;
  v_motivo TEXT := btrim(COALESCE(p_motivo, ''));
  v_solicitante_user_id UUID;
  v_result solicitudes_reintegro;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF NOT (SELECT fn_reintegros_can_operate_workflow()) THEN
    RAISE EXCEPTION 'No autorizado para rechazar solicitudes';
  END IF;

  IF v_motivo = '' THEN
    RAISE EXCEPTION 'El motivo de rechazo es obligatorio';
  END IF;

  SELECT *
  INTO v_solicitud
  FROM solicitudes_reintegro sr
  WHERE sr.id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de reintegro no encontrada';
  END IF;

  IF v_solicitud.tesorero_socio_id IS NOT NULL
     AND v_solicitud.tesorero_socio_id <> v_actor_socio_id
     AND NOT (SELECT fn_reintegros_is_global_manager()) THEN
    RAISE EXCEPTION 'La solicitud esta asignada a otro tesorero';
  END IF;

  IF NOT (SELECT fn_reintegro_transition_allowed(v_solicitud.estado, 'rechazada')) THEN
    RAISE EXCEPTION 'Transicion de estado invalida: % -> rechazada', v_solicitud.estado;
  END IF;

  UPDATE solicitudes_reintegro
  SET
    estado = 'rechazada',
    motivo_rechazo = v_motivo,
    motivo_observacion = NULL,
    updated_by = v_actor_user_id
  WHERE id = p_solicitud_id
  RETURNING * INTO v_result;

  PERFORM fn_reintegros_append_historial(
    p_solicitud_id => v_result.id,
    p_accion => 'rechazar',
    p_estado_anterior => v_solicitud.estado,
    p_estado_nuevo => v_result.estado,
    p_comentario => v_motivo,
    p_metadata => '{}'::jsonb,
    p_actor_user_id => v_actor_user_id,
    p_actor_socio_id => v_actor_socio_id
  );

  v_solicitante_user_id := (SELECT fn_usuario_id_from_socio(v_result.solicitante_socio_id));

  PERFORM fn_reintegros_notify(
    p_usuario_id => v_solicitante_user_id,
    p_titulo => 'Solicitud rechazada',
    p_mensaje => format('La solicitud %s fue rechazada.', v_result.numero),
    p_tipo => 'error',
    p_link => format('/reintegros?solicitud=%s', v_result.id)
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_registrar_pago_reintegro(
  p_solicitud_id UUID,
  p_cuenta_pago_id UUID,
  p_fecha_pago TIMESTAMPTZ,
  p_comprobante_pago_url TEXT
)
RETURNS solicitudes_reintegro
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := (SELECT auth.uid());
  v_actor_socio_id UUID := (SELECT fn_current_socio_id());
  v_solicitud solicitudes_reintegro%ROWTYPE;
  v_monto NUMERIC(12,2);
  v_movimiento_id UUID;
  v_comprobante TEXT := btrim(COALESCE(p_comprobante_pago_url, ''));
  v_solicitante_user_id UUID;
  v_result solicitudes_reintegro;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF NOT (SELECT fn_reintegros_can_operate_workflow()) THEN
    RAISE EXCEPTION 'No autorizado para registrar pagos';
  END IF;

  IF p_cuenta_pago_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_pago_id es obligatoria';
  END IF;

  IF p_fecha_pago IS NULL THEN
    RAISE EXCEPTION 'fecha_pago es obligatoria';
  END IF;

  IF v_comprobante = '' THEN
    RAISE EXCEPTION 'comprobante_pago_url es obligatorio';
  END IF;

  SELECT *
  INTO v_solicitud
  FROM solicitudes_reintegro sr
  WHERE sr.id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de reintegro no encontrada';
  END IF;

  IF v_solicitud.tesorero_socio_id IS NOT NULL
     AND v_solicitud.tesorero_socio_id <> v_actor_socio_id
     AND NOT (SELECT fn_reintegros_is_global_manager()) THEN
    RAISE EXCEPTION 'La solicitud esta asignada a otro tesorero';
  END IF;

  IF NOT (SELECT fn_reintegro_transition_allowed(v_solicitud.estado, 'pagada')) THEN
    RAISE EXCEPTION 'Transicion de estado invalida: % -> pagada', v_solicitud.estado;
  END IF;

  IF v_solicitud.movimiento_id IS NOT NULL THEN
    RAISE EXCEPTION 'La solicitud ya tiene un movimiento de pago asociado';
  END IF;

  IF v_solicitud.categoria_id IS NULL THEN
    RAISE EXCEPTION 'La solicitud no tiene categoria_id';
  END IF;

  PERFORM fn_validate_reintegro_categoria_egreso(v_solicitud.categoria_id);

  IF NOT EXISTS (
    SELECT 1
    FROM cuentas c
    WHERE c.id = p_cuenta_pago_id
      AND COALESCE(c.activa, true) = true
  ) THEN
    RAISE EXCEPTION 'cuenta_pago_id invalida o inactiva';
  END IF;

  v_monto := COALESCE(v_solicitud.monto_aprobado, v_solicitud.monto_solicitado);

  IF v_monto IS NULL OR v_monto <= 0 THEN
    RAISE EXCEPTION 'Monto invalido para registrar el pago';
  END IF;

  INSERT INTO movimientos (
    tipo,
    categoria_id,
    monto,
    fecha,
    descripcion,
    comprobante_url,
    registrado_por,
    aprobado_por,
    periodo,
    cuenta_id,
    socio_id,
    moneda
  )
  VALUES (
    'egreso',
    v_solicitud.categoria_id,
    v_monto,
    p_fecha_pago::DATE,
    format('Reintegro %s - %s', v_solicitud.numero, left(v_solicitud.descripcion, 120)),
    v_comprobante,
    v_actor_user_id,
    v_actor_user_id,
    to_char(p_fecha_pago::DATE, 'YYYY-MM'),
    p_cuenta_pago_id,
    v_solicitud.solicitante_socio_id,
    COALESCE(v_solicitud.moneda, 'ARS')
  )
  RETURNING id INTO v_movimiento_id;

  UPDATE solicitudes_reintegro
  SET
    estado = 'pagada',
    fecha_pago = p_fecha_pago,
    cuenta_pago_id = p_cuenta_pago_id,
    comprobante_pago_url = v_comprobante,
    movimiento_id = v_movimiento_id,
    monto_aprobado = v_monto,
    updated_by = v_actor_user_id
  WHERE id = p_solicitud_id
  RETURNING * INTO v_result;

  PERFORM fn_reintegros_append_historial(
    p_solicitud_id => v_result.id,
    p_accion => 'pagar',
    p_estado_anterior => v_solicitud.estado,
    p_estado_nuevo => v_result.estado,
    p_comentario => NULL,
    p_metadata => jsonb_build_object(
      'movimiento_id', v_movimiento_id,
      'cuenta_pago_id', p_cuenta_pago_id,
      'fecha_pago', p_fecha_pago,
      'monto', v_monto
    ),
    p_actor_user_id => v_actor_user_id,
    p_actor_socio_id => v_actor_socio_id
  );

  v_solicitante_user_id := (SELECT fn_usuario_id_from_socio(v_result.solicitante_socio_id));

  PERFORM fn_reintegros_notify(
    p_usuario_id => v_solicitante_user_id,
    p_titulo => 'Pago de reintegro registrado',
    p_mensaje => format('La solicitud %s fue pagada correctamente.', v_result.numero),
    p_tipo => 'exito',
    p_link => format('/reintegros?solicitud=%s', v_result.id)
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_cancelar_solicitud_reintegro(
  p_solicitud_id UUID,
  p_motivo TEXT
)
RETURNS solicitudes_reintegro
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := (SELECT auth.uid());
  v_actor_socio_id UUID := (SELECT fn_current_socio_id());
  v_solicitud solicitudes_reintegro%ROWTYPE;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_motivo, '')), '');
  v_result solicitudes_reintegro;
  v_solicitante_user_id UUID;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT *
  INTO v_solicitud
  FROM solicitudes_reintegro sr
  WHERE sr.id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de reintegro no encontrada';
  END IF;

  IF v_solicitud.estado = 'borrador' THEN
    IF NOT (SELECT fn_reintegros_can_create_requests()) THEN
      RAISE EXCEPTION 'No autorizado para cancelar borradores';
    END IF;

    IF NOT (SELECT fn_reintegros_is_global_manager())
       AND v_solicitud.solicitante_socio_id <> v_actor_socio_id THEN
      RAISE EXCEPTION 'Solo el solicitante puede cancelar su borrador';
    END IF;

  ELSIF v_solicitud.estado = 'aprobada_pendiente_pago' THEN
    IF NOT (SELECT fn_reintegros_can_operate_workflow()) THEN
      RAISE EXCEPTION 'No autorizado para cancelar solicitudes aprobadas';
    END IF;

    IF v_motivo IS NULL THEN
      RAISE EXCEPTION 'Debe indicar motivo para cancelar una solicitud aprobada';
    END IF;

  ELSE
    RAISE EXCEPTION 'Solo se puede cancelar desde borrador o aprobada_pendiente_pago';
  END IF;

  IF NOT (SELECT fn_reintegro_transition_allowed(v_solicitud.estado, 'cancelada')) THEN
    RAISE EXCEPTION 'Transicion de estado invalida: % -> cancelada', v_solicitud.estado;
  END IF;

  UPDATE solicitudes_reintegro
  SET
    estado = 'cancelada',
    updated_by = v_actor_user_id
  WHERE id = p_solicitud_id
  RETURNING * INTO v_result;

  PERFORM fn_reintegros_append_historial(
    p_solicitud_id => v_result.id,
    p_accion => 'cancelar',
    p_estado_anterior => v_solicitud.estado,
    p_estado_nuevo => v_result.estado,
    p_comentario => v_motivo,
    p_metadata => '{}'::jsonb,
    p_actor_user_id => v_actor_user_id,
    p_actor_socio_id => v_actor_socio_id
  );

  IF v_solicitud.solicitante_socio_id <> v_actor_socio_id THEN
    v_solicitante_user_id := (SELECT fn_usuario_id_from_socio(v_result.solicitante_socio_id));

    PERFORM fn_reintegros_notify(
      p_usuario_id => v_solicitante_user_id,
      p_titulo => 'Solicitud cancelada',
      p_mensaje => format('La solicitud %s fue cancelada.', v_result.numero),
      p_tipo => 'alerta',
      p_link => format('/reintegros?solicitud=%s', v_result.id)
    );
  END IF;

  RETURN v_result;
END;
$$;
