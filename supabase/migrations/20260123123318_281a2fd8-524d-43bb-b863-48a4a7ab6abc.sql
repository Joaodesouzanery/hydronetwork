-- Fix RLS policy for maintenance_request_rate_limits table
-- This table should only be modified by the edge function (service role)
-- Anonymous users should NOT have direct INSERT access

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anonymous users can insert rate limit entries" ON public.maintenance_request_rate_limits;

-- The "Service role full access" policy is fine for internal operations
-- But we need to ensure no public anonymous access

-- Create a more restrictive policy: only authenticated service-side operations
-- Since rate limiting is handled by the edge function with service role,
-- we don't need any public INSERT policy