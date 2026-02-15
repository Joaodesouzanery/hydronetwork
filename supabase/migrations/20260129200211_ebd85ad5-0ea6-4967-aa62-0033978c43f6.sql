-- =======================================================
-- Segurança: restringir tabela de rate-limits (manutenção)
-- =======================================================

-- 1. Remove políticas permissivas antigas
DROP POLICY IF EXISTS "Service role full access" ON public.maintenance_request_rate_limits;
DROP POLICY IF EXISTS "Edge function can insert rate limits" ON public.maintenance_request_rate_limits;
DROP POLICY IF EXISTS "Public can insert rate limit records" ON public.maintenance_request_rate_limits;

-- 2. Política para INSERT
CREATE POLICY "Public can insert rate limit records"
ON public.maintenance_request_rate_limits
FOR INSERT
TO public
WITH CHECK (true);

-- 3. SELECT: qualquer usuário pode consultar
DROP POLICY IF EXISTS "Public can view rate limits" ON public.maintenance_request_rate_limits;
CREATE POLICY "Public can view rate limits"
ON public.maintenance_request_rate_limits
FOR SELECT
TO public
USING (true);