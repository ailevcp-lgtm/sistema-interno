-- ============================================================
-- 018: Create Documents Schema
-- ============================================================

-- 1. Ensure 'resoluciones' has content and file columns
ALTER TABLE resoluciones 
ADD COLUMN IF NOT EXISTS contenido TEXT, -- For Markdown/Text content
ADD COLUMN IF NOT EXISTS archivo_url TEXT; -- For PDF URL

-- 2. Ensure 'estatuto_articulos' has content and file columns (hybrid approach)
-- Note: 'contenido' likely already exists, checking just in case
ALTER TABLE estatuto_articulos 
ADD COLUMN IF NOT EXISTS archivo_url TEXT; -- For linking to a specific PDF page if needed, though mostly used for the full document

-- 3. Ensure 'balances' has file column
ALTER TABLE balances 
ADD COLUMN IF NOT EXISTS archivo_url TEXT;

-- 4. Create a system configuration table for global settings (like Official Estatuto PDF)
CREATE TABLE IF NOT EXISTS configuracion_sistema (
    key TEXT PRIMARY KEY,
    value TEXT, -- JSON or simple text
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE configuracion_sistema ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can view config
CREATE POLICY "auth_view_config" ON configuracion_sistema
    FOR SELECT TO authenticated USING (true);

-- Policy: Only admins/commission can update config (simplified to auth for now, can be restricted later)
CREATE POLICY "auth_update_config" ON configuracion_sistema
    FOR UPDATE TO authenticated USING (true);

-- Insert default value for Estatuto PDF if not exists
INSERT INTO configuracion_sistema (key, value, description)
VALUES ('estatuto_pdf_url', NULL, 'URL del PDF oficial del Estatuto firmado')
ON CONFLICT (key) DO NOTHING;
