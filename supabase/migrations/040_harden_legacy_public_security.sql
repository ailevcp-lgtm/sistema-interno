-- ============================================================
-- 040: Harden legacy public schema security defaults
-- ============================================================
--
-- Goals:
-- 1. Remove SECURITY DEFINER behavior from legacy views.
-- 2. Fix mutable search_path warnings on legacy functions.
-- 3. Replace blanket-write RLS policies with permission-aware guards
--    aligned with the app's current role model.
-- 4. Enable RLS on public.events when that table exists.

-- ------------------------------------------------------------
-- 1) Shared permission helpers
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_has_resource_permission(
  p_recurso TEXT,
  p_accion TEXT,
  p_usuario_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := COALESCE(p_usuario_id, auth.uid());
  v_recurso TEXT := fn_tasks_normalize_text(p_recurso);
  v_accion TEXT := fn_tasks_normalize_text(p_accion);
  v_rol TEXT;
  v_rol_aile_id UUID;
  v_rol_aile_name TEXT;
  v_override BOOLEAN;
BEGIN
  IF v_actor_user_id IS NULL OR v_recurso = '' OR v_accion = '' THEN
    RETURN false;
  END IF;

  IF fn_is_global_manager_user(v_actor_user_id) THEN
    RETURN true;
  END IF;

  SELECT
    s.rol,
    s.rol_aile_id,
    fn_tasks_normalize_text(COALESCE(rad.nombre, s.rol_aile, ''))
  INTO
    v_rol,
    v_rol_aile_id,
    v_rol_aile_name
  FROM socios s
  LEFT JOIN rol_aile_definitions rad ON rad.id = s.rol_aile_id
  WHERE s.usuario_id = v_actor_user_id
    AND COALESCE(s.estado, 'activo') = 'activo'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT rpo.permitido
  INTO v_override
  FROM role_permission_overrides rpo
  WHERE rpo.recurso = v_recurso
    AND rpo.accion = v_accion
    AND (
      (v_rol_aile_id IS NOT NULL AND rpo.rol_aile_definition_id = v_rol_aile_id)
      OR (
        v_rol_aile_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM rol_aile_definitions rad2
          WHERE rad2.id = rpo.rol_aile_definition_id
            AND fn_tasks_normalize_text(rad2.nombre) = v_rol_aile_name
        )
      )
    )
  ORDER BY
    CASE
      WHEN v_rol_aile_id IS NOT NULL AND rpo.rol_aile_definition_id = v_rol_aile_id THEN 0
      ELSE 1
    END
  LIMIT 1;

  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;

  CASE v_recurso
    WHEN 'dashboard' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('socio', 'comision_directiva', 'revisor_cuentas', 'admin')
        ELSE false
      END;
    WHEN 'calendario' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('socio', 'comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol IN ('comision_directiva', 'admin')
        ELSE false
      END;
    WHEN 'tareas' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('socio', 'comision_directiva', 'revisor_cuentas', 'admin')
        ELSE false
      END;
    WHEN 'socios' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'deudas' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'movimientos' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('socio', 'comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'finanzas' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'tesoreria' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'reintegros' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        WHEN 'aprobar' THEN v_rol IN ('comision_directiva', 'admin')
        ELSE false
      END;
    WHEN 'documentos' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'configuracion' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'estatuto' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'editar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'resoluciones' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'balances' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        WHEN 'aprobar' THEN v_rol IN ('comision_directiva', 'admin')
        ELSE false
      END;
    WHEN 'logs' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'admin')
        ELSE false
      END;
    ELSE
      RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION fn_socios_self_link_target(p_row public.socios)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_email TEXT := lower(btrim(COALESCE(auth.jwt() ->> 'email', '')));
BEGIN
  IF auth.uid() IS NULL OR v_auth_email = '' THEN
    RETURN false;
  END IF;

  RETURN p_row.id IS NOT NULL
    AND p_row.usuario_id IS NULL
    AND COALESCE(p_row.estado, 'activo') = 'activo'
    AND lower(btrim(COALESCE(p_row.email, ''))) = v_auth_email;
END;
$$;

CREATE OR REPLACE FUNCTION fn_socios_self_link_new_row(p_row public.socios)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.socios;
  v_auth_email TEXT := lower(btrim(COALESCE(auth.jwt() ->> 'email', '')));
BEGIN
  IF auth.uid() IS NULL OR v_auth_email = '' OR p_row.id IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_existing
  FROM socios
  WHERE id = p_row.id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_existing.usuario_id IS NOT NULL THEN
    RETURN false;
  END IF;

  IF COALESCE(v_existing.estado, 'activo') <> 'activo' THEN
    RETURN false;
  END IF;

  IF lower(btrim(COALESCE(v_existing.email, ''))) <> v_auth_email THEN
    RETURN false;
  END IF;

  RETURN p_row.usuario_id = auth.uid()
    AND (to_jsonb(p_row) - 'usuario_id') = (to_jsonb(v_existing) - 'usuario_id');
END;
$$;

-- ------------------------------------------------------------
-- 2) Views must execute with caller permissions
-- ------------------------------------------------------------

ALTER VIEW IF EXISTS public.v_event_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_deudas_kpis SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_category_contribution SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_monthly_detail SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_cuotas_resumen SET (security_invoker = true);

-- ------------------------------------------------------------
-- 3) Fix mutable search_path warnings
-- ------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.fn_tasks_normalize_text(text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.fn_tasks_normalize_text(TEXT) SET search_path = public';
  END IF;

  IF to_regprocedure('public.fn_tasks_direction_code_from_input(text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.fn_tasks_direction_code_from_input(TEXT) SET search_path = public';
  END IF;

  IF to_regprocedure('public.fn_recalc_cuota()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.fn_recalc_cuota() SET search_path = public';
  END IF;

  IF to_regprocedure('public.fn_movimiento_anulado()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.fn_movimiento_anulado() SET search_path = public';
  END IF;

  IF to_regprocedure('public.fn_reintegros_path_solicitud_id(text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.fn_reintegros_path_solicitud_id(TEXT) SET search_path = public';
  END IF;

  IF to_regprocedure('public.fn_solicitudes_reintegro_historial_lock()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.fn_solicitudes_reintegro_historial_lock() SET search_path = public';
  END IF;

  IF to_regprocedure('public.fn_reintegro_transition_allowed(public.reintegro_estado,public.reintegro_estado)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.fn_reintegro_transition_allowed(public.reintegro_estado, public.reintegro_estado) SET search_path = public';
  END IF;

  IF to_regprocedure('public.fn_socios_normalize_email()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.fn_socios_normalize_email() SET search_path = public';
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 4) Enable RLS on public.events if the table exists
-- ------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.events') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.events ENABLE ROW LEVEL SECURITY';

  EXECUTE 'DROP POLICY IF EXISTS events_select_guard ON public.events';
  EXECUTE 'DROP POLICY IF EXISTS events_insert_guard ON public.events';
  EXECUTE 'DROP POLICY IF EXISTS events_update_guard ON public.events';
  EXECUTE 'DROP POLICY IF EXISTS events_delete_guard ON public.events';

  EXECUTE 'CREATE POLICY events_select_guard ON public.events
    FOR SELECT TO authenticated
    USING (fn_has_resource_permission(''calendario'', ''ver''))';

  EXECUTE 'CREATE POLICY events_insert_guard ON public.events
    FOR INSERT TO authenticated
    WITH CHECK (fn_has_resource_permission(''calendario'', ''crear''))';

  EXECUTE 'CREATE POLICY events_update_guard ON public.events
    FOR UPDATE TO authenticated
    USING (fn_has_resource_permission(''calendario'', ''editar''))
    WITH CHECK (fn_has_resource_permission(''calendario'', ''editar''))';

  EXECUTE 'CREATE POLICY events_delete_guard ON public.events
    FOR DELETE TO authenticated
    USING (fn_has_resource_permission(''calendario'', ''eliminar''))';
END;
$$;

-- ------------------------------------------------------------
-- 5) Replace legacy blanket-write policies
-- ------------------------------------------------------------

-- socios
DROP POLICY IF EXISTS "Public insert socios" ON public.socios;
DROP POLICY IF EXISTS "Public update socios" ON public.socios;
DROP POLICY IF EXISTS auth_insert ON public.socios;
DROP POLICY IF EXISTS auth_update ON public.socios;
DROP POLICY IF EXISTS auth_delete ON public.socios;
DROP POLICY IF EXISTS socios_insert_guard ON public.socios;
DROP POLICY IF EXISTS socios_update_guard ON public.socios;
DROP POLICY IF EXISTS socios_delete_guard ON public.socios;

CREATE POLICY socios_insert_guard ON public.socios
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('socios', 'crear'));

CREATE POLICY socios_update_guard ON public.socios
  FOR UPDATE TO authenticated
  USING (
    fn_has_resource_permission('socios', 'editar')
    OR fn_socios_self_link_target(socios)
  )
  WITH CHECK (
    fn_has_resource_permission('socios', 'editar')
    OR fn_socios_self_link_new_row(socios)
  );

CREATE POLICY socios_delete_guard ON public.socios
  FOR DELETE TO authenticated
  USING (fn_has_resource_permission('socios', 'eliminar'));

-- cuotas
DROP POLICY IF EXISTS "Public insert cuotas" ON public.cuotas;
DROP POLICY IF EXISTS "Public update cuotas" ON public.cuotas;
DROP POLICY IF EXISTS auth_insert ON public.cuotas;
DROP POLICY IF EXISTS auth_update ON public.cuotas;
DROP POLICY IF EXISTS auth_delete ON public.cuotas;
DROP POLICY IF EXISTS cuotas_insert_guard ON public.cuotas;
DROP POLICY IF EXISTS cuotas_update_guard ON public.cuotas;
DROP POLICY IF EXISTS cuotas_delete_guard ON public.cuotas;

CREATE POLICY cuotas_insert_guard ON public.cuotas
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('deudas', 'crear'));

CREATE POLICY cuotas_update_guard ON public.cuotas
  FOR UPDATE TO authenticated
  USING (fn_has_resource_permission('deudas', 'editar'))
  WITH CHECK (fn_has_resource_permission('deudas', 'editar'));

CREATE POLICY cuotas_delete_guard ON public.cuotas
  FOR DELETE TO authenticated
  USING (fn_has_resource_permission('deudas', 'eliminar'));

-- movimientos
DROP POLICY IF EXISTS "Public insert movimientos" ON public.movimientos;
DROP POLICY IF EXISTS auth_insert ON public.movimientos;
DROP POLICY IF EXISTS auth_update ON public.movimientos;
DROP POLICY IF EXISTS auth_delete ON public.movimientos;
DROP POLICY IF EXISTS movimientos_insert_guard ON public.movimientos;
DROP POLICY IF EXISTS movimientos_update_guard ON public.movimientos;
DROP POLICY IF EXISTS movimientos_delete_guard ON public.movimientos;

CREATE POLICY movimientos_insert_guard ON public.movimientos
  FOR INSERT TO authenticated
  WITH CHECK (
    fn_has_resource_permission('finanzas', 'crear')
    OR fn_has_resource_permission('finanzas', 'editar')
    OR fn_has_resource_permission('tesoreria', 'crear')
    OR fn_has_resource_permission('tesoreria', 'editar')
    OR fn_has_resource_permission('deudas', 'editar')
  );

CREATE POLICY movimientos_update_guard ON public.movimientos
  FOR UPDATE TO authenticated
  USING (
    fn_has_resource_permission('finanzas', 'editar')
    OR fn_has_resource_permission('tesoreria', 'editar')
    OR fn_has_resource_permission('deudas', 'eliminar')
  )
  WITH CHECK (
    fn_has_resource_permission('finanzas', 'editar')
    OR fn_has_resource_permission('tesoreria', 'editar')
    OR fn_has_resource_permission('deudas', 'eliminar')
  );

CREATE POLICY movimientos_delete_guard ON public.movimientos
  FOR DELETE TO authenticated
  USING (
    fn_has_resource_permission('finanzas', 'eliminar')
    OR fn_has_resource_permission('tesoreria', 'eliminar')
    OR fn_has_resource_permission('deudas', 'eliminar')
  );

-- categorias_financieras
DROP POLICY IF EXISTS "Public insert categorias" ON public.categorias_financieras;
DROP POLICY IF EXISTS auth_insert ON public.categorias_financieras;
DROP POLICY IF EXISTS auth_update ON public.categorias_financieras;
DROP POLICY IF EXISTS categorias_financieras_insert_guard ON public.categorias_financieras;
DROP POLICY IF EXISTS categorias_financieras_update_guard ON public.categorias_financieras;

CREATE POLICY categorias_financieras_insert_guard ON public.categorias_financieras
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('configuracion', 'editar'));

CREATE POLICY categorias_financieras_update_guard ON public.categorias_financieras
  FOR UPDATE TO authenticated
  USING (fn_has_resource_permission('configuracion', 'editar'))
  WITH CHECK (fn_has_resource_permission('configuracion', 'editar'));

-- estatuto_articulos
DROP POLICY IF EXISTS "Public insert doc tables" ON public.estatuto_articulos;
DROP POLICY IF EXISTS auth_insert ON public.estatuto_articulos;
DROP POLICY IF EXISTS auth_update ON public.estatuto_articulos;
DROP POLICY IF EXISTS auth_delete ON public.estatuto_articulos;
DROP POLICY IF EXISTS estatuto_articulos_insert_guard ON public.estatuto_articulos;
DROP POLICY IF EXISTS estatuto_articulos_update_guard ON public.estatuto_articulos;
DROP POLICY IF EXISTS estatuto_articulos_delete_guard ON public.estatuto_articulos;

CREATE POLICY estatuto_articulos_insert_guard ON public.estatuto_articulos
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('estatuto', 'editar'));

CREATE POLICY estatuto_articulos_update_guard ON public.estatuto_articulos
  FOR UPDATE TO authenticated
  USING (fn_has_resource_permission('estatuto', 'editar'))
  WITH CHECK (fn_has_resource_permission('estatuto', 'editar'));

CREATE POLICY estatuto_articulos_delete_guard ON public.estatuto_articulos
  FOR DELETE TO authenticated
  USING (fn_has_resource_permission('estatuto', 'editar'));

-- resoluciones
DROP POLICY IF EXISTS "Public insert res" ON public.resoluciones;
DROP POLICY IF EXISTS auth_insert ON public.resoluciones;
DROP POLICY IF EXISTS auth_update ON public.resoluciones;
DROP POLICY IF EXISTS auth_delete ON public.resoluciones;
DROP POLICY IF EXISTS resoluciones_insert_guard ON public.resoluciones;
DROP POLICY IF EXISTS resoluciones_update_guard ON public.resoluciones;
DROP POLICY IF EXISTS resoluciones_delete_guard ON public.resoluciones;

CREATE POLICY resoluciones_insert_guard ON public.resoluciones
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('resoluciones', 'crear'));

CREATE POLICY resoluciones_update_guard ON public.resoluciones
  FOR UPDATE TO authenticated
  USING (fn_has_resource_permission('resoluciones', 'editar'))
  WITH CHECK (fn_has_resource_permission('resoluciones', 'editar'));

CREATE POLICY resoluciones_delete_guard ON public.resoluciones
  FOR DELETE TO authenticated
  USING (fn_has_resource_permission('resoluciones', 'eliminar'));

-- balances
DROP POLICY IF EXISTS "Public insert bal" ON public.balances;
DROP POLICY IF EXISTS auth_insert ON public.balances;
DROP POLICY IF EXISTS auth_update ON public.balances;
DROP POLICY IF EXISTS auth_delete ON public.balances;
DROP POLICY IF EXISTS balances_insert_guard ON public.balances;
DROP POLICY IF EXISTS balances_update_guard ON public.balances;
DROP POLICY IF EXISTS balances_delete_guard ON public.balances;

CREATE POLICY balances_insert_guard ON public.balances
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('balances', 'crear'));

CREATE POLICY balances_update_guard ON public.balances
  FOR UPDATE TO authenticated
  USING (fn_has_resource_permission('balances', 'editar'))
  WITH CHECK (fn_has_resource_permission('balances', 'editar'));

CREATE POLICY balances_delete_guard ON public.balances
  FOR DELETE TO authenticated
  USING (fn_has_resource_permission('balances', 'eliminar'));

-- logs_actividad
DROP POLICY IF EXISTS "Public insert logs" ON public.logs_actividad;
DROP POLICY IF EXISTS auth_insert ON public.logs_actividad;
DROP POLICY IF EXISTS logs_actividad_insert_guard ON public.logs_actividad;

CREATE POLICY logs_actividad_insert_guard ON public.logs_actividad
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

-- configuracion
DROP POLICY IF EXISTS auth_insert ON public.configuracion;
DROP POLICY IF EXISTS auth_update ON public.configuracion;
DROP POLICY IF EXISTS configuracion_insert_guard ON public.configuracion;
DROP POLICY IF EXISTS configuracion_update_guard ON public.configuracion;

CREATE POLICY configuracion_insert_guard ON public.configuracion
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('configuracion', 'crear'));

CREATE POLICY configuracion_update_guard ON public.configuracion
  FOR UPDATE TO authenticated
  USING (fn_has_resource_permission('configuracion', 'editar'))
  WITH CHECK (fn_has_resource_permission('configuracion', 'editar'));

-- eventos
DROP POLICY IF EXISTS auth_insert ON public.eventos;
DROP POLICY IF EXISTS auth_update ON public.eventos;
DROP POLICY IF EXISTS eventos_insert_guard ON public.eventos;
DROP POLICY IF EXISTS eventos_update_guard ON public.eventos;

CREATE POLICY eventos_insert_guard ON public.eventos
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('finanzas', 'crear'));

CREATE POLICY eventos_update_guard ON public.eventos
  FOR UPDATE TO authenticated
  USING (fn_has_resource_permission('finanzas', 'editar'))
  WITH CHECK (fn_has_resource_permission('finanzas', 'editar'));

-- subcategorias_financieras
DROP POLICY IF EXISTS auth_insert ON public.subcategorias_financieras;
DROP POLICY IF EXISTS subcategorias_financieras_insert_guard ON public.subcategorias_financieras;

CREATE POLICY subcategorias_financieras_insert_guard ON public.subcategorias_financieras
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('finanzas', 'crear'));

-- cuentas
DROP POLICY IF EXISTS auth_insert ON public.cuentas;
DROP POLICY IF EXISTS cuentas_insert_guard ON public.cuentas;

CREATE POLICY cuentas_insert_guard ON public.cuentas
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('tesoreria', 'crear'));

-- import_batches
DROP POLICY IF EXISTS auth_insert ON public.import_batches;
DROP POLICY IF EXISTS import_batches_insert_guard ON public.import_batches;

CREATE POLICY import_batches_insert_guard ON public.import_batches
  FOR INSERT TO authenticated
  WITH CHECK (
    fn_has_resource_permission('finanzas', 'crear')
    OR fn_has_resource_permission('tesoreria', 'crear')
  );

-- fee_status
DROP POLICY IF EXISTS auth_insert ON public.fee_status;
DROP POLICY IF EXISTS auth_update ON public.fee_status;
DROP POLICY IF EXISTS auth_delete ON public.fee_status;
DROP POLICY IF EXISTS fee_status_insert_guard ON public.fee_status;
DROP POLICY IF EXISTS fee_status_update_guard ON public.fee_status;
DROP POLICY IF EXISTS fee_status_delete_guard ON public.fee_status;

CREATE POLICY fee_status_insert_guard ON public.fee_status
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('deudas', 'crear'));

CREATE POLICY fee_status_update_guard ON public.fee_status
  FOR UPDATE TO authenticated
  USING (fn_has_resource_permission('deudas', 'editar'))
  WITH CHECK (fn_has_resource_permission('deudas', 'editar'));

CREATE POLICY fee_status_delete_guard ON public.fee_status
  FOR DELETE TO authenticated
  USING (
    fn_has_resource_permission('deudas', 'eliminar')
    OR fn_has_resource_permission('socios', 'eliminar')
  );

-- arqueos
DROP POLICY IF EXISTS auth_insert ON public.arqueos;
DROP POLICY IF EXISTS auth_update ON public.arqueos;
DROP POLICY IF EXISTS arqueos_insert_guard ON public.arqueos;
DROP POLICY IF EXISTS arqueos_update_guard ON public.arqueos;

CREATE POLICY arqueos_insert_guard ON public.arqueos
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('tesoreria', 'editar'));

CREATE POLICY arqueos_update_guard ON public.arqueos
  FOR UPDATE TO authenticated
  USING (fn_has_resource_permission('tesoreria', 'editar'))
  WITH CHECK (fn_has_resource_permission('tesoreria', 'editar'));

-- configuracion_sistema
DROP POLICY IF EXISTS auth_update_config ON public.configuracion_sistema;
DROP POLICY IF EXISTS configuracion_sistema_insert_guard ON public.configuracion_sistema;
DROP POLICY IF EXISTS configuracion_sistema_update_guard ON public.configuracion_sistema;

CREATE POLICY configuracion_sistema_insert_guard ON public.configuracion_sistema
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('configuracion', 'crear'));

CREATE POLICY configuracion_sistema_update_guard ON public.configuracion_sistema
  FOR UPDATE TO authenticated
  USING (fn_has_resource_permission('configuracion', 'editar'))
  WITH CHECK (fn_has_resource_permission('configuracion', 'editar'));

-- cuota_aplicaciones
DROP POLICY IF EXISTS "Authenticated users can INSERT cuota_aplicaciones" ON public.cuota_aplicaciones;
DROP POLICY IF EXISTS "Authenticated users can UPDATE cuota_aplicaciones" ON public.cuota_aplicaciones;
DROP POLICY IF EXISTS "Authenticated users can DELETE cuota_aplicaciones" ON public.cuota_aplicaciones;
DROP POLICY IF EXISTS cuota_aplicaciones_insert_guard ON public.cuota_aplicaciones;
DROP POLICY IF EXISTS cuota_aplicaciones_update_guard ON public.cuota_aplicaciones;
DROP POLICY IF EXISTS cuota_aplicaciones_delete_guard ON public.cuota_aplicaciones;

CREATE POLICY cuota_aplicaciones_insert_guard ON public.cuota_aplicaciones
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('deudas', 'editar'));

CREATE POLICY cuota_aplicaciones_update_guard ON public.cuota_aplicaciones
  FOR UPDATE TO authenticated
  USING (fn_has_resource_permission('deudas', 'editar'))
  WITH CHECK (fn_has_resource_permission('deudas', 'editar'));

CREATE POLICY cuota_aplicaciones_delete_guard ON public.cuota_aplicaciones
  FOR DELETE TO authenticated
  USING (fn_has_resource_permission('deudas', 'eliminar'));

-- promociones_cuotas
DROP POLICY IF EXISTS "Authenticated users can INSERT promociones_cuotas" ON public.promociones_cuotas;
DROP POLICY IF EXISTS "Authenticated users can UPDATE promociones_cuotas" ON public.promociones_cuotas;
DROP POLICY IF EXISTS "Authenticated users can DELETE promociones_cuotas" ON public.promociones_cuotas;
DROP POLICY IF EXISTS promociones_cuotas_insert_guard ON public.promociones_cuotas;
DROP POLICY IF EXISTS promociones_cuotas_update_guard ON public.promociones_cuotas;
DROP POLICY IF EXISTS promociones_cuotas_delete_guard ON public.promociones_cuotas;

CREATE POLICY promociones_cuotas_insert_guard ON public.promociones_cuotas
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('deudas', 'eliminar'));

CREATE POLICY promociones_cuotas_update_guard ON public.promociones_cuotas
  FOR UPDATE TO authenticated
  USING (fn_has_resource_permission('deudas', 'eliminar'))
  WITH CHECK (fn_has_resource_permission('deudas', 'eliminar'));

CREATE POLICY promociones_cuotas_delete_guard ON public.promociones_cuotas
  FOR DELETE TO authenticated
  USING (fn_has_resource_permission('deudas', 'eliminar'));

-- movimiento_promocion_cuotas
DROP POLICY IF EXISTS "Authenticated users can INSERT movimiento_promocion_cuotas" ON public.movimiento_promocion_cuotas;
DROP POLICY IF EXISTS "Authenticated users can UPDATE movimiento_promocion_cuotas" ON public.movimiento_promocion_cuotas;
DROP POLICY IF EXISTS "Authenticated users can DELETE movimiento_promocion_cuotas" ON public.movimiento_promocion_cuotas;
DROP POLICY IF EXISTS movimiento_promocion_cuotas_insert_guard ON public.movimiento_promocion_cuotas;
DROP POLICY IF EXISTS movimiento_promocion_cuotas_update_guard ON public.movimiento_promocion_cuotas;
DROP POLICY IF EXISTS movimiento_promocion_cuotas_delete_guard ON public.movimiento_promocion_cuotas;

CREATE POLICY movimiento_promocion_cuotas_insert_guard ON public.movimiento_promocion_cuotas
  FOR INSERT TO authenticated
  WITH CHECK (fn_has_resource_permission('deudas', 'editar'));

CREATE POLICY movimiento_promocion_cuotas_update_guard ON public.movimiento_promocion_cuotas
  FOR UPDATE TO authenticated
  USING (fn_has_resource_permission('deudas', 'editar'))
  WITH CHECK (fn_has_resource_permission('deudas', 'editar'));

CREATE POLICY movimiento_promocion_cuotas_delete_guard ON public.movimiento_promocion_cuotas
  FOR DELETE TO authenticated
  USING (fn_has_resource_permission('deudas', 'eliminar'));
