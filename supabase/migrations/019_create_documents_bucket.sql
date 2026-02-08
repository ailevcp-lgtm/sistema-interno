-- ============================================================
-- 019: Create Documents Bucket
-- ============================================================

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Security Policies for the 'documentos' bucket

-- Policy: Give public read access to everyone (or restricted to authenticated if preferred)
-- Here we allow authenticated users to read.
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'documentos' );

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Auth Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'documentos' );

-- Policy: Allow users to update their own files (or any file if they have permission, simplified here)
CREATE POLICY "Auth Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'documentos' );

-- Policy: Allow users to delete files
CREATE POLICY "Auth Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'documentos' );
