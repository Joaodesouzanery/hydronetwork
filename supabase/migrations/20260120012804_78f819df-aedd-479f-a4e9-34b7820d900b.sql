-- =============================================================
-- SECURITY FIX: Restrict maintenance-request-photos storage uploads
-- =============================================================

-- Drop existing permissive upload policy
DROP POLICY IF EXISTS "Anyone can upload maintenance request photos" ON storage.objects;

-- Create a tracking table for rate limiting maintenance requests
CREATE TABLE IF NOT EXISTS public.maintenance_request_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_ip text NOT NULL,
  qr_code_id uuid NOT NULL REFERENCES public.maintenance_qr_codes(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on rate limits table
ALTER TABLE public.maintenance_request_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (service role) to manage rate limits
CREATE POLICY "Service role can manage rate limits"
ON public.maintenance_request_rate_limits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_maintenance_rate_limits_ip_time 
ON public.maintenance_request_rate_limits(client_ip, created_at);

CREATE INDEX IF NOT EXISTS idx_maintenance_rate_limits_qr_time 
ON public.maintenance_request_rate_limits(qr_code_id, created_at);

-- Cleanup old rate limit records (older than 24 hours) - function for scheduled cleanup
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.maintenance_request_rate_limits
  WHERE created_at < now() - interval '24 hours';
END;
$$;

-- Add comment documenting the security fix
COMMENT ON TABLE public.maintenance_request_rate_limits IS 
  'Rate limiting table for maintenance requests to prevent abuse from anonymous users';

-- Note: Storage policy change requires edge function for signed URL uploads
-- The maintenance-request-photos bucket should use signed URLs from edge function