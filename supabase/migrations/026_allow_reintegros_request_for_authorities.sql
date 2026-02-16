-- ============================================================
-- 026: Habilitar solicitud de reintegros para autoridades clave
-- ============================================================

-- Se extiende el helper usado por los RPC/políticas de reintegros para
-- permitir solicitudes también a Presidente, Tesorero y Secretario General.
CREATE OR REPLACE FUNCTION fn_is_director_finanzas()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    (SELECT fn_has_rol_aile('Director de Finanzas'))
    OR (SELECT fn_has_rol_aile('Presidente'))
    OR (SELECT fn_has_rol_aile('Tesorero'))
    OR (SELECT fn_has_rol_aile('Secretario General'))
  );
$$;
