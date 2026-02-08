-- ============================================================
-- 001: Agregar columnas faltantes a tablas existentes
-- ============================================================
-- La tabla `socios` fue creada sin algunas columnas que el
-- frontend necesita. Este script las agrega de forma segura.
-- ============================================================

-- Columna email: se usa en la UI para mostrar y buscar socios
ALTER TABLE socios ADD COLUMN IF NOT EXISTS email TEXT;

-- Columna rol: define el nivel de acceso del usuario en el sistema
-- Valores posibles: 'socio', 'comision_directiva', 'revisor_cuentas', 'admin'
ALTER TABLE socios ADD COLUMN IF NOT EXISTS rol TEXT DEFAULT 'socio';

-- Columna avatar_url: URL de la foto de perfil del socio
ALTER TABLE socios ADD COLUMN IF NOT EXISTS avatar_url TEXT;
