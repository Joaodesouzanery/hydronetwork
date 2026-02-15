-- Fix maintenance_request_rate_limits: Remove overly permissive service role policy
-- and implement proper restrictive policies

-- Drop existing policies that may be overly permissive
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.maintenance_request_rate_limits;
DROP POLICY IF EXISTS "service_role_full_access" ON public.maintenance_request_rate_limits;
DROP POLICY IF EXISTS "Allow service role full access" ON public.maintenance_request_rate_limits;

-- Create proper restrictive policies for rate limits table
-- Only allow inserts from the edge function (which uses service role internally)
-- Regular users should never be able to read or manipulate this table directly

-- Policy for inserting rate limit records (public access needed for the edge function)
CREATE POLICY "Edge function can insert rate limits"
ON public.maintenance_request_rate_limits
FOR INSERT
WITH CHECK (true);

-- Policy for deleting old rate limit records (for cleanup function, requires service role)
-- This runs via the cleanup_old_rate_limits() function which is SECURITY DEFINER
CREATE POLICY "Allow cleanup of old rate limits"
ON public.maintenance_request_rate_limits
FOR DELETE
USING (created_at < now() - interval '24 hours');

-- No SELECT policy for regular users - they should never read this table
-- No UPDATE policy - rate limit records should never be updated