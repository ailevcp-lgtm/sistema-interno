BEGIN;

-- La decisión se registra únicamente desde la ruta de servidor, que primero
-- autentica al usuario y valida el permiso socios.editar. El RPC conserva su
-- segunda validación sobre el actor informado.
REVOKE ALL ON FUNCTION public.fn_registrar_decision_admision(UUID, TEXT, UUID, UUID, DATE, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_registrar_decision_admision(UUID, TEXT, UUID, UUID, DATE, TEXT, TEXT, UUID)
  TO service_role;

-- Evita que una política FOR ALL se superponga con la política específica de
-- lectura. No cambia permisos ni datos; sólo separa cada operación.
DROP POLICY IF EXISTS asociados_membresias_write ON public.asociados_membresias;
CREATE POLICY asociados_membresias_insert ON public.asociados_membresias
FOR INSERT TO authenticated
WITH CHECK (public.fn_has_resource_permission('socios', 'editar'));
CREATE POLICY asociados_membresias_update ON public.asociados_membresias
FOR UPDATE TO authenticated
USING (public.fn_has_resource_permission('socios', 'editar'))
WITH CHECK (public.fn_has_resource_permission('socios', 'editar'));
CREATE POLICY asociados_membresias_delete ON public.asociados_membresias
FOR DELETE TO authenticated
USING (public.fn_has_resource_permission('socios', 'editar'));

DROP POLICY IF EXISTS habilitaciones_nna_write ON public.habilitaciones_nna;
CREATE POLICY habilitaciones_nna_insert ON public.habilitaciones_nna
FOR INSERT TO authenticated
WITH CHECK (public.fn_has_resource_permission('socios', 'editar'));
CREATE POLICY habilitaciones_nna_update ON public.habilitaciones_nna
FOR UPDATE TO authenticated
USING (public.fn_has_resource_permission('socios', 'editar'))
WITH CHECK (public.fn_has_resource_permission('socios', 'editar'));
CREATE POLICY habilitaciones_nna_delete ON public.habilitaciones_nna
FOR DELETE TO authenticated
USING (public.fn_has_resource_permission('socios', 'editar'));

COMMIT;
