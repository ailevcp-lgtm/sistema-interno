-- Create propuestas table
CREATE TABLE IF NOT EXISTS public.propuestas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug character varying NOT NULL UNIQUE,
  titulo character varying NOT NULL,
  contenido text,
  estado character varying NOT NULL DEFAULT 'borrador',
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by uuid REFERENCES public.socios(id) ON DELETE SET NULL,
  CONSTRAINT prop_estado_ckeck CHECK ((estado IN ('borrador', 'publicado')))
);

-- Turn on RLS
ALTER TABLE public.propuestas ENABLE ROW LEVEL SECURITY;

-- Allow public to view published proposals
CREATE POLICY "Public can view published proposals" 
ON public.propuestas FOR SELECT
USING (estado = 'publicado');

-- Allow authenticated users to view all proposals
CREATE POLICY "auth_select" ON public.propuestas FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert/update/delete (RBAC is handled by app layer)
CREATE POLICY "auth_insert" ON public.propuestas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.propuestas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON public.propuestas FOR DELETE TO authenticated USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_propuestas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_propuestas_updated_at
  BEFORE UPDATE ON public.propuestas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_propuestas_updated_at();
