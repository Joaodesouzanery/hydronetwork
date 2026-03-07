-- ============================================================
-- SECURITY HARDENING: Fix all RLS policies and revoke anon grants
--
-- Problems fixed:
-- 1. INSERT WITH CHECK (true) → force user_id = auth.uid()
-- 2. GRANT ALL TO anon → revoke, only grant to authenticated
-- 3. user_id IS NULL fallback → remove (legacy data should be migrated)
--
-- Run via: supabase db push (or paste in SQL Editor)
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- STEP 1: Revoke anon access on all hydro/lps tables
-- anon users should NEVER access project data
-- ═══════════════════════════════════════════════════════════

REVOKE ALL ON public.hydro_rdos FROM anon;
REVOKE ALL ON public.hydro_saved_plans FROM anon;
REVOKE ALL ON public.hydro_equipments FROM anon;
REVOKE ALL ON public.hydro_dimensioning_projects FROM anon;
REVOKE ALL ON public.hydro_bdi_contracts FROM anon;
REVOKE ALL ON public.project_approval_control FROM anon;
REVOKE ALL ON public.lps_constraints FROM anon;
REVOKE ALL ON public.lps_weekly_commitments FROM anon;
REVOKE ALL ON public.lps_five_whys FROM anon;
REVOKE ALL ON public.lps_constraint_audit FROM anon;

-- ═══════════════════════════════════════════════════════════
-- STEP 2: Ensure proper grants (only authenticated + service_role)
-- ═══════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hydro_rdos TO authenticated;
GRANT ALL ON public.hydro_rdos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hydro_saved_plans TO authenticated;
GRANT ALL ON public.hydro_saved_plans TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hydro_equipments TO authenticated;
GRANT ALL ON public.hydro_equipments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hydro_dimensioning_projects TO authenticated;
GRANT ALL ON public.hydro_dimensioning_projects TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hydro_bdi_contracts TO authenticated;
GRANT ALL ON public.hydro_bdi_contracts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_approval_control TO authenticated;
GRANT ALL ON public.project_approval_control TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lps_constraints TO authenticated;
GRANT ALL ON public.lps_constraints TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lps_weekly_commitments TO authenticated;
GRANT ALL ON public.lps_weekly_commitments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lps_five_whys TO authenticated;
GRANT ALL ON public.lps_five_whys TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lps_constraint_audit TO authenticated;
GRANT ALL ON public.lps_constraint_audit TO service_role;

-- ═══════════════════════════════════════════════════════════
-- STEP 3: Migrate legacy data (user_id IS NULL → set to first admin)
-- This ensures all data has an owner before we tighten policies
-- ═══════════════════════════════════════════════════════════

-- First, backfill user_id where NULL using auth.uid() of first super_admin
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles
    WHERE is_super_admin = true LIMIT 1;

  IF admin_id IS NOT NULL THEN
    UPDATE public.hydro_rdos SET user_id = admin_id WHERE user_id IS NULL;
    UPDATE public.hydro_saved_plans SET user_id = admin_id WHERE user_id IS NULL;
    UPDATE public.hydro_equipments SET user_id = admin_id WHERE user_id IS NULL;
    UPDATE public.hydro_dimensioning_projects SET user_id = admin_id WHERE user_id IS NULL;
    UPDATE public.hydro_bdi_contracts SET user_id = admin_id WHERE user_id IS NULL;
    UPDATE public.project_approval_control SET user_id = admin_id WHERE user_id IS NULL;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- STEP 4: Replace ALL RLS policies with strict user_id checks
-- No more USING(true) or WITH CHECK(true)
-- ═══════════════════════════════════════════════════════════

-- ─── hydro_rdos ──────
DROP POLICY IF EXISTS "hydro_rdos_select" ON public.hydro_rdos;
DROP POLICY IF EXISTS "hydro_rdos_insert" ON public.hydro_rdos;
DROP POLICY IF EXISTS "hydro_rdos_update" ON public.hydro_rdos;
DROP POLICY IF EXISTS "hydro_rdos_delete" ON public.hydro_rdos;

CREATE POLICY "hydro_rdos_select" ON public.hydro_rdos
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "hydro_rdos_insert" ON public.hydro_rdos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "hydro_rdos_update" ON public.hydro_rdos
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "hydro_rdos_delete" ON public.hydro_rdos
  FOR DELETE USING (user_id = auth.uid());

-- ─── hydro_saved_plans ──────
DROP POLICY IF EXISTS "hydro_plans_select" ON public.hydro_saved_plans;
DROP POLICY IF EXISTS "hydro_plans_insert" ON public.hydro_saved_plans;
DROP POLICY IF EXISTS "hydro_plans_update" ON public.hydro_saved_plans;
DROP POLICY IF EXISTS "hydro_plans_delete" ON public.hydro_saved_plans;

CREATE POLICY "hydro_plans_select" ON public.hydro_saved_plans
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "hydro_plans_insert" ON public.hydro_saved_plans
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "hydro_plans_update" ON public.hydro_saved_plans
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "hydro_plans_delete" ON public.hydro_saved_plans
  FOR DELETE USING (user_id = auth.uid());

-- ─── hydro_equipments ──────
DROP POLICY IF EXISTS "hydro_equip_select" ON public.hydro_equipments;
DROP POLICY IF EXISTS "hydro_equip_insert" ON public.hydro_equipments;
DROP POLICY IF EXISTS "hydro_equip_update" ON public.hydro_equipments;
DROP POLICY IF EXISTS "hydro_equip_delete" ON public.hydro_equipments;

CREATE POLICY "hydro_equip_select" ON public.hydro_equipments
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "hydro_equip_insert" ON public.hydro_equipments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "hydro_equip_update" ON public.hydro_equipments
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "hydro_equip_delete" ON public.hydro_equipments
  FOR DELETE USING (user_id = auth.uid());

-- ─── hydro_dimensioning_projects ──────
DROP POLICY IF EXISTS "hdp_select" ON public.hydro_dimensioning_projects;
DROP POLICY IF EXISTS "hdp_insert" ON public.hydro_dimensioning_projects;
DROP POLICY IF EXISTS "hdp_update" ON public.hydro_dimensioning_projects;
DROP POLICY IF EXISTS "hdp_delete" ON public.hydro_dimensioning_projects;

CREATE POLICY "hdp_select" ON public.hydro_dimensioning_projects
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "hdp_insert" ON public.hydro_dimensioning_projects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "hdp_update" ON public.hydro_dimensioning_projects
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "hdp_delete" ON public.hydro_dimensioning_projects
  FOR DELETE USING (user_id = auth.uid());

-- ─── hydro_bdi_contracts ──────
DROP POLICY IF EXISTS "hbc_select" ON public.hydro_bdi_contracts;
DROP POLICY IF EXISTS "hbc_insert" ON public.hydro_bdi_contracts;
DROP POLICY IF EXISTS "hbc_update" ON public.hydro_bdi_contracts;
DROP POLICY IF EXISTS "hbc_delete" ON public.hydro_bdi_contracts;

CREATE POLICY "hbc_select" ON public.hydro_bdi_contracts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "hbc_insert" ON public.hydro_bdi_contracts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "hbc_update" ON public.hydro_bdi_contracts
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "hbc_delete" ON public.hydro_bdi_contracts
  FOR DELETE USING (user_id = auth.uid());

-- ─── project_approval_control ──────
DROP POLICY IF EXISTS "pac_select" ON public.project_approval_control;
DROP POLICY IF EXISTS "pac_insert" ON public.project_approval_control;
DROP POLICY IF EXISTS "pac_update" ON public.project_approval_control;
DROP POLICY IF EXISTS "pac_delete" ON public.project_approval_control;

CREATE POLICY "pac_select" ON public.project_approval_control
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pac_insert" ON public.project_approval_control
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "pac_update" ON public.project_approval_control
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "pac_delete" ON public.project_approval_control
  FOR DELETE USING (user_id = auth.uid());

-- ─── lps_constraints ──────
DROP POLICY IF EXISTS "lps_constraints_select" ON public.lps_constraints;
DROP POLICY IF EXISTS "lps_constraints_insert" ON public.lps_constraints;
DROP POLICY IF EXISTS "lps_constraints_update" ON public.lps_constraints;
DROP POLICY IF EXISTS "lps_constraints_delete" ON public.lps_constraints;

CREATE POLICY "lps_constraints_select" ON public.lps_constraints
  FOR SELECT USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_constraints_insert" ON public.lps_constraints
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "lps_constraints_update" ON public.lps_constraints
  FOR UPDATE USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_constraints_delete" ON public.lps_constraints
  FOR DELETE USING (created_by_user_id = auth.uid());

-- ─── lps_weekly_commitments ──────
DROP POLICY IF EXISTS "lps_commitments_select" ON public.lps_weekly_commitments;
DROP POLICY IF EXISTS "lps_commitments_insert" ON public.lps_weekly_commitments;
DROP POLICY IF EXISTS "lps_commitments_update" ON public.lps_weekly_commitments;
DROP POLICY IF EXISTS "lps_commitments_delete" ON public.lps_weekly_commitments;

CREATE POLICY "lps_commitments_select" ON public.lps_weekly_commitments
  FOR SELECT USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_commitments_insert" ON public.lps_weekly_commitments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "lps_commitments_update" ON public.lps_weekly_commitments
  FOR UPDATE USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_commitments_delete" ON public.lps_weekly_commitments
  FOR DELETE USING (created_by_user_id = auth.uid());

-- ─── lps_five_whys ──────
DROP POLICY IF EXISTS "lps_five_whys_select" ON public.lps_five_whys;
DROP POLICY IF EXISTS "lps_five_whys_insert" ON public.lps_five_whys;
DROP POLICY IF EXISTS "lps_five_whys_update" ON public.lps_five_whys;
DROP POLICY IF EXISTS "lps_five_whys_delete" ON public.lps_five_whys;

CREATE POLICY "lps_five_whys_select" ON public.lps_five_whys
  FOR SELECT USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_five_whys_insert" ON public.lps_five_whys
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "lps_five_whys_update" ON public.lps_five_whys
  FOR UPDATE USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_five_whys_delete" ON public.lps_five_whys
  FOR DELETE USING (created_by_user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════
-- STEP 5: Make user_id NOT NULL on hydro tables (prevent future orphans)
-- ═══════════════════════════════════════════════════════════

-- Set default to auth.uid() so inserts auto-populate
ALTER TABLE public.hydro_rdos
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.hydro_saved_plans
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.hydro_equipments
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.hydro_dimensioning_projects
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.hydro_bdi_contracts
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

-- ═══════════════════════════════════════════════════════════
-- STEP 6: Reload PostgREST schema cache
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
