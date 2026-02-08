-- ============================================================
-- 017: Update foreign key constraint to ON DELETE SET NULL
-- ============================================================

-- Drop the existing constraint
ALTER TABLE socios DROP CONSTRAINT IF EXISTS socios_rol_aile_id_fkey;

-- Re-add the constraint with ON DELETE SET NULL
ALTER TABLE socios
ADD CONSTRAINT socios_rol_aile_id_fkey
FOREIGN KEY (rol_aile_id)
REFERENCES rol_aile_definitions(id)
ON DELETE SET NULL;
