-- ============================================================
-- 016: Create rol_aile_definitions table and migrate data
-- ============================================================

-- Create table for roles
CREATE TABLE IF NOT EXISTS rol_aile_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rol_aile_definitions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for authenticated users" ON rol_aile_definitions
    FOR SELECT TO authenticated USING (true);

-- Allow admin and comision_directiva (and anyone with write access to configuration) to manage roles
-- Using a subquery to check the user's role in the socios table
CREATE POLICY "Enable write access for authorized roles" ON rol_aile_definitions
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM socios
            WHERE socios.usuario_id = auth.uid()
            AND (socios.rol IN ('admin', 'comision_directiva'))
        )
    );

-- Insert standard roles from constants
INSERT INTO rol_aile_definitions (nombre) VALUES
('Presidente'),
('Vicepresidente'),
('Secretario General'),
('Tesorero'),
('Vocal Titular'),
('Vocal Suplente'),
('Revisor de Cuentas Titular'),
('Revisor de Cuentas Suplente'),
('Socio')
ON CONFLICT (nombre) DO NOTHING;

-- Insert existing distinct roles from socios table
INSERT INTO rol_aile_definitions (nombre)
SELECT DISTINCT rol_aile FROM socios 
WHERE rol_aile IS NOT NULL AND rol_aile != ''
ON CONFLICT (nombre) DO NOTHING;

-- Add rol_aile_id column to socios
ALTER TABLE socios ADD COLUMN IF NOT EXISTS rol_aile_id UUID REFERENCES rol_aile_definitions(id);

-- Update socios to link to the new table
UPDATE socios
SET rol_aile_id = rol_aile_definitions.id
FROM rol_aile_definitions
WHERE socios.rol_aile = rol_aile_definitions.nombre;

-- We keep the original 'rol_aile' column for now to prevent immediate breakage,
-- but the application should start using 'rol_aile_id' and the relation.
