-- Fix maintenance-request-photos security
-- Remove overly permissive policies and add proper authentication

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can upload maintenance request photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view maintenance request photos" ON storage.objects;

-- Create new secure policies for maintenance-request-photos bucket

-- Only allow uploads with a valid session token (from QR code flow that provides temp access)
-- Or authenticated users
CREATE POLICY "Authenticated users can upload maintenance photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'maintenance-request-photos');

-- Create policy for viewing - only authenticated users and project owners
CREATE POLICY "Authenticated users can view maintenance photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'maintenance-request-photos');

-- Allow authenticated users to delete their own uploaded photos
CREATE POLICY "Users can delete their own maintenance photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'maintenance-request-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- For the QR code public workflow, we need a separate approach:
-- Create a public endpoint that validates the QR code and returns a signed URL
-- This is more secure than allowing public uploads