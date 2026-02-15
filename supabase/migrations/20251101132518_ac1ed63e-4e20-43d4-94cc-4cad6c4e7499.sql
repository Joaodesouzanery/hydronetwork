-- Add logo_url column to connection_reports table
ALTER TABLE connection_reports
ADD COLUMN logo_url text;

-- Update storage bucket policy to allow logo uploads in connection-report-photos
CREATE POLICY "Users can upload their own connection report files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'connection-report-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);