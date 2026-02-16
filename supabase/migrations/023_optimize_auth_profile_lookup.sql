-- 023_optimize_auth_profile_lookup.sql
-- Acelera la búsqueda de perfil por usuario_id usada en el flujo de autenticación.

CREATE INDEX IF NOT EXISTS idx_socios_usuario_id
  ON socios (usuario_id);
