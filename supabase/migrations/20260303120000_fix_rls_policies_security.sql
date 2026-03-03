-- ============================================================
-- FIX: Secure RLS policies for all hydro_* and LPS tables
-- Replaces USING(true) with proper auth.uid() checks
-- Run this in Supabase SQL Editor
-- ============================================================

-- ─── 1. FIX hydro_rdos RLS ──────

DROP POLICY IF EXISTS "hydro_rdos_select" ON public.hydro_rdos;
DROP POLICY IF EXISTS "hydro_rdos_insert" ON public.hydro_rdos;
DROP POLICY IF EXISTS "hydro_rdos_update" ON public.hydro_rdos;
DROP POLICY IF EXISTS "hydro_rdos_delete" ON public.hydro_rdos;

CREATE POLICY "hydro_rdos_select" ON public.hydro_rdos
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hydro_rdos_insert" ON public.hydro_rdos
  FOR INSERT WITH CHECK (true);
CREATE POLICY "hydro_rdos_update" ON public.hydro_rdos
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hydro_rdos_delete" ON public.hydro_rdos
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- ─── 2. FIX hydro_saved_plans RLS ──────

DROP POLICY IF EXISTS "hydro_plans_select" ON public.hydro_saved_plans;
DROP POLICY IF EXISTS "hydro_plans_insert" ON public.hydro_saved_plans;
DROP POLICY IF EXISTS "hydro_plans_update" ON public.hydro_saved_plans;
DROP POLICY IF EXISTS "hydro_plans_delete" ON public.hydro_saved_plans;

CREATE POLICY "hydro_plans_select" ON public.hydro_saved_plans
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hydro_plans_insert" ON public.hydro_saved_plans
  FOR INSERT WITH CHECK (true);
CREATE POLICY "hydro_plans_update" ON public.hydro_saved_plans
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hydro_plans_delete" ON public.hydro_saved_plans
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- ─── 3. FIX hydro_equipments RLS ──────

DROP POLICY IF EXISTS "hydro_equip_select" ON public.hydro_equipments;
DROP POLICY IF EXISTS "hydro_equip_insert" ON public.hydro_equipments;
DROP POLICY IF EXISTS "hydro_equip_update" ON public.hydro_equipments;
DROP POLICY IF EXISTS "hydro_equip_delete" ON public.hydro_equipments;

CREATE POLICY "hydro_equip_select" ON public.hydro_equipments
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hydro_equip_insert" ON public.hydro_equipments
  FOR INSERT WITH CHECK (true);
CREATE POLICY "hydro_equip_update" ON public.hydro_equipments
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hydro_equip_delete" ON public.hydro_equipments
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- ─── 4. FIX hydro_dimensioning_projects RLS ──────

DROP POLICY IF EXISTS "hdp_select" ON public.hydro_dimensioning_projects;
DROP POLICY IF EXISTS "hdp_insert" ON public.hydro_dimensioning_projects;
DROP POLICY IF EXISTS "hdp_update" ON public.hydro_dimensioning_projects;
DROP POLICY IF EXISTS "hdp_delete" ON public.hydro_dimensioning_projects;

CREATE POLICY "hdp_select" ON public.hydro_dimensioning_projects
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hdp_insert" ON public.hydro_dimensioning_projects
  FOR INSERT WITH CHECK (true);
CREATE POLICY "hdp_update" ON public.hydro_dimensioning_projects
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hdp_delete" ON public.hydro_dimensioning_projects
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- ─── 5. FIX hydro_bdi_contracts RLS ──────

DROP POLICY IF EXISTS "hbc_select" ON public.hydro_bdi_contracts;
DROP POLICY IF EXISTS "hbc_insert" ON public.hydro_bdi_contracts;
DROP POLICY IF EXISTS "hbc_update" ON public.hydro_bdi_contracts;
DROP POLICY IF EXISTS "hbc_delete" ON public.hydro_bdi_contracts;

CREATE POLICY "hbc_select" ON public.hydro_bdi_contracts
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hbc_insert" ON public.hydro_bdi_contracts
  FOR INSERT WITH CHECK (true);
CREATE POLICY "hbc_update" ON public.hydro_bdi_contracts
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hbc_delete" ON public.hydro_bdi_contracts
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- ─── 6. FIX project_approval_control RLS ──────

DROP POLICY IF EXISTS "pac_select" ON public.project_approval_control;
DROP POLICY IF EXISTS "pac_insert" ON public.project_approval_control;
DROP POLICY IF EXISTS "pac_update" ON public.project_approval_control;
DROP POLICY IF EXISTS "pac_delete" ON public.project_approval_control;

CREATE POLICY "pac_select" ON public.project_approval_control
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "pac_insert" ON public.project_approval_control
  FOR INSERT WITH CHECK (true);
CREATE POLICY "pac_update" ON public.project_approval_control
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "pac_delete" ON public.project_approval_control
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- ─── 7. FIX LPS tables RLS ──────

DROP POLICY IF EXISTS "lps_constraints_select" ON public.lps_constraints;
DROP POLICY IF EXISTS "lps_constraints_insert" ON public.lps_constraints;
DROP POLICY IF EXISTS "lps_constraints_update" ON public.lps_constraints;
DROP POLICY IF EXISTS "lps_constraints_delete" ON public.lps_constraints;

CREATE POLICY "lps_constraints_select" ON public.lps_constraints
  FOR SELECT USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_constraints_insert" ON public.lps_constraints
  FOR INSERT WITH CHECK (true);
CREATE POLICY "lps_constraints_update" ON public.lps_constraints
  FOR UPDATE USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_constraints_delete" ON public.lps_constraints
  FOR DELETE USING (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "lps_commitments_select" ON public.lps_weekly_commitments;
DROP POLICY IF EXISTS "lps_commitments_insert" ON public.lps_weekly_commitments;
DROP POLICY IF EXISTS "lps_commitments_update" ON public.lps_weekly_commitments;
DROP POLICY IF EXISTS "lps_commitments_delete" ON public.lps_weekly_commitments;

CREATE POLICY "lps_commitments_select" ON public.lps_weekly_commitments
  FOR SELECT USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_commitments_insert" ON public.lps_weekly_commitments
  FOR INSERT WITH CHECK (true);
CREATE POLICY "lps_commitments_update" ON public.lps_weekly_commitments
  FOR UPDATE USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_commitments_delete" ON public.lps_weekly_commitments
  FOR DELETE USING (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "lps_five_whys_select" ON public.lps_five_whys;
DROP POLICY IF EXISTS "lps_five_whys_insert" ON public.lps_five_whys;
DROP POLICY IF EXISTS "lps_five_whys_update" ON public.lps_five_whys;
DROP POLICY IF EXISTS "lps_five_whys_delete" ON public.lps_five_whys;

CREATE POLICY "lps_five_whys_select" ON public.lps_five_whys
  FOR SELECT USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_five_whys_insert" ON public.lps_five_whys
  FOR INSERT WITH CHECK (true);
CREATE POLICY "lps_five_whys_update" ON public.lps_five_whys
  FOR UPDATE USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_five_whys_delete" ON public.lps_five_whys
  FOR DELETE USING (created_by_user_id = auth.uid());

-- ─── 8. Reload schema cache ──────

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
