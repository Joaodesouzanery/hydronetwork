-- =============================================
-- SECURITY FIX: Remove duplicate/old RLS policies from employees table
-- =============================================

-- Remove old policies that are superseded by the project-based ones
DROP POLICY IF EXISTS "Usuários autenticados podem ver funcionários" ON public.employees;
DROP POLICY IF EXISTS "Usuários autenticados podem criar funcionários" ON public.employees;
DROP POLICY IF EXISTS "Usuários podem atualizar funcionários que criaram" ON public.employees;
DROP POLICY IF EXISTS "Usuários podem deletar funcionários que criaram" ON public.employees;

-- =============================================
-- SECURITY FIX: Restrict rate limits table to service role only
-- Prevent potential IP address exposure
-- =============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.maintenance_request_rate_limits;

-- Create more restrictive policies
-- Only allow INSERT for anonymous users (needed for rate limit tracking)
-- No SELECT for non-service-role users (protects IP addresses)
CREATE POLICY "Anonymous users can insert rate limit entries"
ON public.maintenance_request_rate_limits FOR INSERT
TO anon
WITH CHECK (true);

-- Service role can do everything (for cleanup operations)
CREATE POLICY "Service role full access"
ON public.maintenance_request_rate_limits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users cannot see rate limit data (IP protection)
-- No SELECT policy for authenticated = they cannot query this table