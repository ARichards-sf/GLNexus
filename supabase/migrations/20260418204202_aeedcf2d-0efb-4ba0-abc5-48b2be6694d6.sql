-- Create storage bucket for firm logos
INSERT INTO storage.buckets (
  id, name, public, 
  file_size_limit, 
  allowed_mime_types
)
VALUES (
  'firm-logos',
  'firm-logos', 
  true,
  2097152, -- 2MB limit
  ARRAY[
    'image/jpeg', 
    'image/png', 
    'image/webp', 
    'image/svg+xml'
  ]
);

-- Public read access
CREATE POLICY "Public can view firm logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'firm-logos');

-- GL internal staff can upload
CREATE POLICY "GL internal can upload firm logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'firm-logos'
  AND public.is_gl_internal(auth.uid())
);

-- GL internal staff can update
CREATE POLICY "GL internal can update firm logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'firm-logos'
  AND public.is_gl_internal(auth.uid())
);

-- GL internal staff can delete
CREATE POLICY "GL internal can delete firm logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'firm-logos'
  AND public.is_gl_internal(auth.uid())
);