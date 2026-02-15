-- Make storage buckets private for better security
UPDATE storage.buckets 
SET public = false 
WHERE name IN ('connection-report-photos', 'maintenance-request-photos');

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can upload maintenance request photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view maintenance request photos from their projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their maintenance request photos" ON storage.objects;

-- Add RLS policies for connection-report-photos bucket
DROP POLICY IF EXISTS "Users can upload their own connection report photos" ON storage.objects;
CREATE POLICY "Users can upload their own connection report photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'connection-report-photos' 
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can view connection report photos" ON storage.objects;
CREATE POLICY "Users can view connection report photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'connection-report-photos' 
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can delete their own connection report photos" ON storage.objects;
CREATE POLICY "Users can delete their own connection report photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'connection-report-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add RLS policies for maintenance-request-photos bucket (needs public access for QR codes)
CREATE POLICY "Anyone can upload maintenance request photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'maintenance-request-photos');

CREATE POLICY "Anyone can view maintenance request photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'maintenance-request-photos');

CREATE POLICY "Users can delete their maintenance request photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'maintenance-request-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);