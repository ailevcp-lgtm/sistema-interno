-- ============================================================
-- 004: Crear el primer socio administrador
-- ============================================================
-- ANTES de ejecutar este script:
--   1. Crear un usuario en Supabase Auth (Authentication > Users > Add User)
--   2. Copiar el UUID del usuario creado
--   3. Reemplazar los valores de abajo con tus datos reales
-- ============================================================

-- IMPORTANTE: Reemplazar estos valores antes de ejecutar
INSERT INTO socios (
  usuario_id,
  nombre,
  apellido,
  dni,
  email,
  telefono,
  estado,
  rol,
  fecha_ingreso,
  tiene_deuda
) VALUES (
  '5b0a0f88-0403-46a7-a4f2-c6a103d7b6ec',  -- << REEMPLAZAR con el UUID del usuario Auth
  'Lautaro',                                 -- << REEMPLAZAR con tu nombre
  'Lopez Labrin',                               -- << REEMPLAZAR con tu apellido
  '43.992.870',                             -- << REEMPLAZAR con tu DNI
  'lautarolopezlabrin@gmail.com',                           -- << REEMPLAZAR con tu email (mismo que en Auth)
  '+54 3513970227',                       -- << REEMPLAZAR con tu telefono
  'activo',
  'admin',
  CURRENT_DATE,
  false
);
