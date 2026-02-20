-- PARTE 5 DE 5: Storage Buckets
-- Cole este SQL no Supabase SQL Editor e clique Run
-- RODE ESTE POR ÚLTIMO, depois das partes 1 a 4

-- Criar buckets de storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('rdo-photos', 'rdo-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('interactive-maps', 'interactive-maps', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('connection-report-photos', 'connection-report-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-request-photos', 'maintenance-request-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies para rdo-photos
CREATE POLICY "Authenticated users can upload rdo photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rdo-photos');

CREATE POLICY "Anyone can view rdo photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'rdo-photos');

CREATE POLICY "Users can delete own rdo photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rdo-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policies para interactive-maps
CREATE POLICY "Authenticated users can upload maps"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'interactive-maps');

CREATE POLICY "Anyone can view maps"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'interactive-maps');

CREATE POLICY "Authenticated users can update maps"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'interactive-maps');

CREATE POLICY "Authenticated users can delete maps"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'interactive-maps');

-- Policies para connection-report-photos
CREATE POLICY "Authenticated users can upload connection report photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'connection-report-photos');

CREATE POLICY "Anyone can view connection report photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'connection-report-photos');

CREATE POLICY "Users can delete own connection report photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'connection-report-photos');

-- Policies para maintenance-request-photos
CREATE POLICY "Authenticated users can upload maintenance photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'maintenance-request-photos');

CREATE POLICY "Anyone can view maintenance photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'maintenance-request-photos');

CREATE POLICY "Users can delete own maintenance photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'maintenance-request-photos');
