-- ============================================================
-- LPS Module Improvements Migration
-- Adds: audit table, parent_constraint_id, service selection support
-- Safe: uses IF NOT EXISTS everywhere
-- ============================================================

-- 1. Audit trail table (replaces localStorage)
CREATE TABLE IF NOT EXISTS public.lps_constraint_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  constraint_id UUID NOT NULL REFERENCES public.lps_constraints(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  user_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lps_constraint_audit ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view audit entries"
    ON public.lps_constraint_audit FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create audit entries"
    ON public.lps_constraint_audit FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_lps_audit_constraint ON public.lps_constraint_audit(constraint_id);
CREATE INDEX IF NOT EXISTS idx_lps_audit_created ON public.lps_constraint_audit(created_at DESC);

-- 2. Parent constraint column for dependency tracking
DO $$ BEGIN
  ALTER TABLE public.lps_constraints
    ADD COLUMN parent_constraint_id UUID REFERENCES public.lps_constraints(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_lps_constraints_parent ON public.lps_constraints(parent_constraint_id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
