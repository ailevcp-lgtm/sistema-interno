-- ============================================================
-- 022: Modulo de Reintegros (fase 1 backend)
-- ============================================================

-- 0) Roles institucionales requeridos por el modulo
INSERT INTO rol_aile_definitions (nombre)
VALUES ('Director de Finanzas'), ('Revisor de Cuentas')
ON CONFLICT (nombre) DO NOTHING;

-- 1) Tipo de estado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'reintegro_estado'
  ) THEN
    CREATE TYPE reintegro_estado AS ENUM (
      'borrador',
      'pendiente_aprobacion',
      'observada',
      'aprobada_pendiente_pago',
      'rechazada',
      'pagada',
      'cancelada'
    );
  END IF;
END;
$$;

-- 2) Secuencia para numeracion
CREATE SEQUENCE IF NOT EXISTS reintegros_numero_seq;

-- 3) Tabla principal
CREATE TABLE IF NOT EXISTS solicitudes_reintegro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE,
  solicitante_socio_id UUID NOT NULL REFERENCES socios(id),
  tesorero_socio_id UUID REFERENCES socios(id),
  estado reintegro_estado NOT NULL DEFAULT 'borrador',
  fecha_gasto DATE NOT NULL,
  fecha_solicitud TIMESTAMPTZ,
  fecha_aprobacion TIMESTAMPTZ,
  fecha_pago TIMESTAMPTZ,
  categoria_id UUID REFERENCES categorias_financieras(id),
  cuenta_pago_id UUID REFERENCES cuentas(id),
  monto_solicitado NUMERIC(12,2) NOT NULL CHECK (monto_solicitado > 0),
  monto_aprobado NUMERIC(12,2),
  moneda TEXT NOT NULL DEFAULT 'ARS',
  descripcion TEXT NOT NULL,
  factura_url TEXT NOT NULL,
  factura_numero TEXT,
  factura_emisor TEXT,
  motivo_rechazo TEXT,
  motivo_observacion TEXT,
  comprobante_pago_url TEXT,
  movimiento_id UUID UNIQUE REFERENCES movimientos(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  CONSTRAINT solicitudes_reintegro_monto_aprobado_chk
    CHECK (monto_aprobado IS NULL OR (monto_aprobado >= 0 AND monto_aprobado <= monto_solicitado)),
  CONSTRAINT solicitudes_reintegro_observada_motivo_chk
    CHECK (
      estado <> 'observada'
      OR char_length(btrim(COALESCE(motivo_observacion, ''))) > 0
    ),
  CONSTRAINT solicitudes_reintegro_rechazada_motivo_chk
    CHECK (
      estado <> 'rechazada'
      OR char_length(btrim(COALESCE(motivo_rechazo, ''))) > 0
    ),
  CONSTRAINT solicitudes_reintegro_aprobada_monto_chk
    CHECK (
      estado <> 'aprobada_pendiente_pago'
      OR monto_aprobado IS NOT NULL
    ),
  CONSTRAINT solicitudes_reintegro_pagada_campos_chk
    CHECK (
      estado <> 'pagada'
      OR (
        fecha_pago IS NOT NULL
        AND cuenta_pago_id IS NOT NULL
        AND movimiento_id IS NOT NULL
        AND char_length(btrim(COALESCE(comprobante_pago_url, ''))) > 0
      )
    )
);

-- 4) Tabla append-only de historial
CREATE TABLE IF NOT EXISTS solicitudes_reintegro_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id UUID NOT NULL REFERENCES solicitudes_reintegro(id) ON DELETE CASCADE,
  accion TEXT NOT NULL CHECK (char_length(btrim(accion)) > 0),
  estado_anterior reintegro_estado,
  estado_nuevo reintegro_estado,
  comentario TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  actor_socio_id UUID REFERENCES socios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) Indices
CREATE INDEX IF NOT EXISTS idx_reintegros_estado_fecha_solicitud
  ON solicitudes_reintegro (estado, fecha_solicitud DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_reintegros_solicitante_created_at
  ON solicitudes_reintegro (solicitante_socio_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reintegros_tesorero_estado_created_at
  ON solicitudes_reintegro (tesorero_socio_id, estado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reintegros_fecha_gasto
  ON solicitudes_reintegro (fecha_gasto);

CREATE INDEX IF NOT EXISTS idx_reintegros_categoria_id
  ON solicitudes_reintegro (categoria_id);

CREATE INDEX IF NOT EXISTS idx_reintegros_cuenta_pago_id
  ON solicitudes_reintegro (cuenta_pago_id);

CREATE INDEX IF NOT EXISTS idx_reintegros_factura_numero_emisor
  ON solicitudes_reintegro (factura_numero, factura_emisor)
  WHERE
    factura_numero IS NOT NULL
    AND factura_emisor IS NOT NULL
    AND btrim(factura_numero) <> ''
    AND btrim(factura_emisor) <> '';

CREATE INDEX IF NOT EXISTS idx_reintegros_historial_solicitud_created_at
  ON solicitudes_reintegro_historial (solicitud_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_reintegros_historial_actor_created_at
  ON solicitudes_reintegro_historial (actor_user_id, created_at DESC);

-- 6) Helpers de identidad/roles
CREATE OR REPLACE FUNCTION fn_current_socio_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM socios s
  WHERE s.usuario_id = (SELECT auth.uid())
  ORDER BY s.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM socios s
    WHERE s.usuario_id = (SELECT auth.uid())
      AND s.rol = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION fn_has_rol_aile(nombre_rol TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM socios s
    LEFT JOIN rol_aile_definitions rad
      ON rad.id = s.rol_aile_id
    WHERE s.usuario_id = (SELECT auth.uid())
      AND lower(COALESCE(rad.nombre, s.rol_aile, '')) = lower(btrim(COALESCE(nombre_rol, '')))
  );
$$;

CREATE OR REPLACE FUNCTION fn_is_director_finanzas()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT fn_has_rol_aile('Director de Finanzas'));
$$;

CREATE OR REPLACE FUNCTION fn_is_tesorero()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT fn_has_rol_aile('Tesorero'));
$$;

CREATE OR REPLACE FUNCTION fn_is_revisor_cuentas()
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
    WHERE s.usuario_id = (SELECT auth.uid())
      AND (
        s.rol = 'revisor_cuentas'
        OR lower(COALESCE(rad.nombre, s.rol_aile, '')) LIKE 'revisor de cuentas%'
      )
  );
$$;

CREATE OR REPLACE FUNCTION fn_reintegros_default_tesorero_socio_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM socios s
  LEFT JOIN rol_aile_definitions rad ON rad.id = s.rol_aile_id
  WHERE COALESCE(s.estado, '') = 'activo'
    AND lower(COALESCE(rad.nombre, s.rol_aile, '')) = 'tesorero'
  ORDER BY s.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_reintegros_socio_is_tesorero(p_socio_id UUID)
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
    WHERE s.id = p_socio_id
      AND lower(COALESCE(rad.nombre, s.rol_aile, '')) = 'tesorero'
  );
$$;

CREATE OR REPLACE FUNCTION fn_usuario_id_from_socio(p_socio_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.usuario_id
  FROM socios s
  WHERE s.id = p_socio_id
  LIMIT 1;
$$;

-- 7) Helpers de negocio
CREATE OR REPLACE FUNCTION fn_next_reintegro_numero(p_ref_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq BIGINT;
BEGIN
  v_seq := nextval('reintegros_numero_seq');
  RETURN format('RIN-%s-%s', to_char(COALESCE(p_ref_date, CURRENT_DATE), 'YYYY'), lpad(v_seq::TEXT, 6, '0'));
END;
$$;

CREATE OR REPLACE FUNCTION fn_validate_reintegro_categoria_egreso(p_categoria_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_categoria_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM categorias_financieras c
    WHERE c.id = p_categoria_id
      AND c.tipo = 'egreso'
      AND COALESCE(c.activa, true) = true
  ) THEN
    RAISE EXCEPTION 'Categoria invalida para reintegro. Debe ser egreso activa.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_reintegro_transition_allowed(
  p_estado_actual reintegro_estado,
  p_estado_nuevo reintegro_estado
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_estado_actual = 'borrador' AND p_estado_nuevo IN ('pendiente_aprobacion', 'cancelada') THEN true
    WHEN p_estado_actual = 'pendiente_aprobacion' AND p_estado_nuevo IN ('observada', 'aprobada_pendiente_pago', 'rechazada') THEN true
    WHEN p_estado_actual = 'observada' AND p_estado_nuevo = 'pendiente_aprobacion' THEN true
    WHEN p_estado_actual = 'aprobada_pendiente_pago' AND p_estado_nuevo IN ('pagada', 'cancelada') THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION fn_reintegros_notify(
  p_usuario_id UUID,
  p_titulo TEXT,
  p_mensaje TEXT,
  p_tipo tipo_notificacion DEFAULT 'info',
  p_link TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_usuario_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, link)
  VALUES (p_usuario_id, p_titulo, p_mensaje, COALESCE(p_tipo, 'info'), p_link);
END;
$$;

CREATE OR REPLACE FUNCTION fn_reintegros_append_historial(
  p_solicitud_id UUID,
  p_accion TEXT,
  p_estado_anterior reintegro_estado,
  p_estado_nuevo reintegro_estado,
  p_comentario TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_actor_user_id UUID DEFAULT NULL,
  p_actor_socio_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := COALESCE(p_actor_user_id, auth.uid());
  v_actor_socio_id UUID := COALESCE(p_actor_socio_id, fn_current_socio_id());
BEGIN
  INSERT INTO solicitudes_reintegro_historial (
    solicitud_id,
    accion,
    estado_anterior,
    estado_nuevo,
    comentario,
    metadata,
    actor_user_id,
    actor_socio_id
  )
  VALUES (
    p_solicitud_id,
    p_accion,
    p_estado_anterior,
    p_estado_nuevo,
    p_comentario,
    COALESCE(p_metadata, '{}'::jsonb),
    v_actor_user_id,
    v_actor_socio_id
  );
END;
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

  IF (SELECT fn_is_admin())
     OR (SELECT fn_is_revisor_cuentas())
     OR (SELECT fn_has_rol_aile('Presidente'))
     OR (SELECT fn_has_rol_aile('Secretario General')) THEN
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

CREATE OR REPLACE FUNCTION fn_can_manage_reintegro_files(p_solicitud_id UUID)
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

  IF (SELECT fn_is_admin()) THEN
    RETURN true;
  END IF;

  v_socio_id := (SELECT fn_current_socio_id());

  IF v_socio_id IS NULL THEN
    RETURN false;
  END IF;

  IF (SELECT fn_is_director_finanzas())
     AND v_solicitud.solicitante_socio_id = v_socio_id
     AND v_solicitud.estado IN ('borrador', 'observada') THEN
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

CREATE OR REPLACE FUNCTION fn_reintegros_path_solicitud_id(p_storage_key TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_head TEXT;
BEGIN
  v_head := split_part(COALESCE(p_storage_key, ''), '/', 1);
  IF v_head = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN v_head::UUID;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

-- 8) Triggers
CREATE OR REPLACE FUNCTION fn_solicitudes_reintegro_biu()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_auth_uid UUID;
BEGIN
  v_auth_uid := (SELECT auth.uid());

  IF TG_OP = 'INSERT' THEN
    IF NEW.numero IS NULL OR btrim(NEW.numero) = '' THEN
      NEW.numero := fn_next_reintegro_numero(COALESCE(NEW.fecha_gasto, CURRENT_DATE));
    END IF;

    IF NEW.created_at IS NULL THEN
      NEW.created_at := now();
    END IF;

    IF NEW.created_by IS NULL THEN
      NEW.created_by := v_auth_uid;
    END IF;
  END IF;

  NEW.updated_at := now();
  NEW.updated_by := v_auth_uid;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_solicitudes_reintegro_biu ON solicitudes_reintegro;
CREATE TRIGGER trg_solicitudes_reintegro_biu
  BEFORE INSERT OR UPDATE ON solicitudes_reintegro
  FOR EACH ROW
  EXECUTE FUNCTION fn_solicitudes_reintegro_biu();

CREATE OR REPLACE FUNCTION fn_solicitudes_reintegro_historial_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'solicitudes_reintegro_historial es append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_solicitudes_reintegro_historial_no_ud ON solicitudes_reintegro_historial;
CREATE TRIGGER trg_solicitudes_reintegro_historial_no_ud
  BEFORE UPDATE OR DELETE ON solicitudes_reintegro_historial
  FOR EACH ROW
  EXECUTE FUNCTION fn_solicitudes_reintegro_historial_lock();

-- 9) RPCs del workflow
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

  IF NOT ((SELECT fn_is_director_finanzas()) OR (SELECT fn_is_admin())) THEN
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

  IF (SELECT fn_is_admin()) THEN
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

  IF NOT ((SELECT fn_is_director_finanzas()) OR (SELECT fn_is_admin())) THEN
    RAISE EXCEPTION 'No autorizado para enviar solicitudes';
  END IF;

  IF NOT (SELECT fn_is_admin())
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

  IF NOT (SELECT fn_is_tesorero()) THEN
    RAISE EXCEPTION 'Solo tesoreria puede observar solicitudes';
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
     AND v_solicitud.tesorero_socio_id <> v_actor_socio_id THEN
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

  IF NOT (SELECT fn_is_tesorero()) THEN
    RAISE EXCEPTION 'Solo tesoreria puede aprobar solicitudes';
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
     AND v_solicitud.tesorero_socio_id <> v_actor_socio_id THEN
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

  IF NOT (SELECT fn_is_tesorero()) THEN
    RAISE EXCEPTION 'Solo tesoreria puede rechazar solicitudes';
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
     AND v_solicitud.tesorero_socio_id <> v_actor_socio_id THEN
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

  IF NOT (SELECT fn_is_tesorero()) THEN
    RAISE EXCEPTION 'Solo tesoreria puede registrar pagos';
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
     AND v_solicitud.tesorero_socio_id <> v_actor_socio_id THEN
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
    IF NOT ((SELECT fn_is_director_finanzas()) OR (SELECT fn_is_admin())) THEN
      RAISE EXCEPTION 'No autorizado para cancelar borradores';
    END IF;

    IF NOT (SELECT fn_is_admin())
       AND v_solicitud.solicitante_socio_id <> v_actor_socio_id THEN
      RAISE EXCEPTION 'Solo el solicitante puede cancelar su borrador';
    END IF;

  ELSIF v_solicitud.estado = 'aprobada_pendiente_pago' THEN
    IF NOT ((SELECT fn_is_tesorero()) OR (SELECT fn_is_admin())) THEN
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

-- 10) Permisos de ejecucion de RPC
GRANT EXECUTE ON FUNCTION rpc_crear_solicitud_reintegro(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_enviar_solicitud_reintegro(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_observar_solicitud_reintegro(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_aprobar_solicitud_reintegro(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_rechazar_solicitud_reintegro(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_registrar_pago_reintegro(UUID, UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_cancelar_solicitud_reintegro(UUID, TEXT) TO authenticated;

-- 11) RLS en tablas del modulo
ALTER TABLE solicitudes_reintegro ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_reintegro_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reintegros_select ON solicitudes_reintegro;
CREATE POLICY reintegros_select
ON solicitudes_reintegro
FOR SELECT
TO authenticated
USING ((SELECT fn_can_view_solicitud_reintegro(id)));

DROP POLICY IF EXISTS reintegros_insert ON solicitudes_reintegro;
CREATE POLICY reintegros_insert
ON solicitudes_reintegro
FOR INSERT
TO authenticated
WITH CHECK (
  (
    (
      (SELECT fn_is_director_finanzas())
      AND solicitante_socio_id = (SELECT fn_current_socio_id())
    )
    OR (SELECT fn_is_admin())
  )
  AND estado = 'borrador'
  AND created_by = (SELECT auth.uid())
);

DROP POLICY IF EXISTS reintegros_update_block ON solicitudes_reintegro;
CREATE POLICY reintegros_update_block
ON solicitudes_reintegro
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS reintegros_delete_block ON solicitudes_reintegro;
CREATE POLICY reintegros_delete_block
ON solicitudes_reintegro
FOR DELETE
TO authenticated
USING (false);

DROP POLICY IF EXISTS reintegros_historial_select ON solicitudes_reintegro_historial;
CREATE POLICY reintegros_historial_select
ON solicitudes_reintegro_historial
FOR SELECT
TO authenticated
USING ((SELECT fn_can_view_solicitud_reintegro(solicitud_id)));

DROP POLICY IF EXISTS reintegros_historial_insert_block ON solicitudes_reintegro_historial;
CREATE POLICY reintegros_historial_insert_block
ON solicitudes_reintegro_historial
FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS reintegros_historial_update_block ON solicitudes_reintegro_historial;
CREATE POLICY reintegros_historial_update_block
ON solicitudes_reintegro_historial
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS reintegros_historial_delete_block ON solicitudes_reintegro_historial;
CREATE POLICY reintegros_historial_delete_block
ON solicitudes_reintegro_historial
FOR DELETE
TO authenticated
USING (false);

-- 12) Storage bucket privado + politicas
INSERT INTO storage.buckets (id, name, public)
VALUES ('reintegros', 'reintegros', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS reintegros_storage_read ON storage.objects;
CREATE POLICY reintegros_storage_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'reintegros'
  AND (
    SELECT fn_can_view_solicitud_reintegro(
      fn_reintegros_path_solicitud_id(name)
    )
  )
);

DROP POLICY IF EXISTS reintegros_storage_insert ON storage.objects;
CREATE POLICY reintegros_storage_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reintegros'
  AND (
    SELECT fn_can_manage_reintegro_files(
      fn_reintegros_path_solicitud_id(name)
    )
  )
);

DROP POLICY IF EXISTS reintegros_storage_update ON storage.objects;
CREATE POLICY reintegros_storage_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'reintegros'
  AND (
    SELECT fn_can_manage_reintegro_files(
      fn_reintegros_path_solicitud_id(name)
    )
  )
)
WITH CHECK (
  bucket_id = 'reintegros'
  AND (
    SELECT fn_can_manage_reintegro_files(
      fn_reintegros_path_solicitud_id(name)
    )
  )
);

DROP POLICY IF EXISTS reintegros_storage_delete ON storage.objects;
CREATE POLICY reintegros_storage_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'reintegros'
  AND (
    SELECT fn_can_manage_reintegro_files(
      fn_reintegros_path_solicitud_id(name)
    )
  )
);
