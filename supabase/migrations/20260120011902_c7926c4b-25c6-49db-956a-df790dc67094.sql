
-- =============================================================
-- SECURITY FIX: Consolidate and fix RLS policies
-- =============================================================

-- 1. Fix the overly permissive maintenance_requests INSERT policy
-- Drop the problematic policy that has WITH CHECK (true)
DROP POLICY IF EXISTS "Authenticated users can create maintenance requests" ON public.maintenance_requests;

-- 2. Consolidate audit_log SELECT policies - keep only super admin access
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_log;
-- Keep only "Only super admins can view audit logs" policy

-- 3. Add index for better performance on security function queries
CREATE INDEX IF NOT EXISTS idx_employees_project_id ON public.employees(project_id);
CREATE INDEX IF NOT EXISTS idx_employees_created_by ON public.employees(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_connection_reports_project_id ON public.connection_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_budgets_created_by ON public.budgets(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_labor_tracking_project_id ON public.labor_tracking(project_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes_created_by ON public.supplier_quotes(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id ON public.purchase_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_obras_user_id ON public.obras(user_id);

-- 4. Add rate limiting awareness comment (actual rate limiting should be done at edge function level)
COMMENT ON POLICY "Anyone can create maintenance requests for valid QR codes" ON public.maintenance_requests IS 
  'Public QR code requests are allowed but should be rate-limited at the application level';
