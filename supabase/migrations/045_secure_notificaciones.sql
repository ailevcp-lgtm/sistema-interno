-- ============================================================
-- 045: Secure notifications RLS
-- ============================================================
--
-- Replace the legacy "any authenticated user can insert" policy
-- with a permission-aware policy aligned to the modules that
-- actually create notifications from the client.
--
-- Own select/update/delete remain available so the notification
-- UI can continue to read, mark as read, and remove records.

DROP POLICY IF EXISTS "Usuarios pueden ver sus propias notificaciones" ON notificaciones;
DROP POLICY IF EXISTS "Usuarios pueden actualizar sus propias notificaciones" ON notificaciones;
DROP POLICY IF EXISTS "Usuarios pueden crear notificaciones" ON notificaciones;
DROP POLICY IF EXISTS notificaciones_select_own ON notificaciones;
DROP POLICY IF EXISTS notificaciones_update_own ON notificaciones;
DROP POLICY IF EXISTS notificaciones_delete_own ON notificaciones;
DROP POLICY IF EXISTS notificaciones_insert_guard ON notificaciones;

CREATE POLICY notificaciones_select_own ON notificaciones
  FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY notificaciones_update_own ON notificaciones
  FOR UPDATE TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY notificaciones_delete_own ON notificaciones
  FOR DELETE TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY notificaciones_insert_guard ON notificaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    fn_has_resource_permission('balances', 'crear')
    OR fn_has_resource_permission('balances', 'editar')
    OR fn_has_resource_permission('resoluciones', 'crear')
    OR fn_has_resource_permission('resoluciones', 'editar')
  );
