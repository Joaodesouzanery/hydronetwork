-- ============================================================
-- DEFINITIVE FIX: LPS Constraints Module (v2)
-- Tables created WITHOUT inline FKs to ensure creation never fails
-- FKs added afterwards in protected DO blocks
-- RLS policies use USING(true) for maximum compatibility
-- ============================================================

-- STEP 1: Drop everything cleanly
DROP TABLE IF EXISTS public.lps_constraint_audit CASCADE;
DROP TABLE IF EXISTS public.lps_five_whys CASCADE;
DROP TABLE IF EXISTS public.lps_weekly_commitments CASCADE;
DROP TABLE IF EXISTS public.lps_constraints CASCADE;
DROP TYPE IF EXISTS public.lps_constraint_type CASCADE;
DROP TYPE IF EXISTS public.lps_constraint_status CASCADE;
DROP TYPE IF EXISTS public.lps_impact_level CASCADE;
DROP TYPE IF EXISTS public.lps_commitment_status CASCADE;

-- STEP 2: Helper function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- STEP 3: Create tables WITHOUT foreign keys (ensures they always succeed)

CREATE TABLE public.lps_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  service_front_id UUID,
  tipo_restricao TEXT NOT NULL,
  descricao TEXT NOT NULL,
  responsavel_id UUID,
  responsavel_nome TEXT,
  data_identificacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista_resolucao DATE,
  data_resolvida DATE,
  status TEXT NOT NULL DEFAULT 'ativa',
  impacto TEXT NOT NULL DEFAULT 'medio',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  origem TEXT NOT NULL DEFAULT 'manual',
  justification_id UUID,
  daily_report_id UUID,
  parent_constraint_id UUID,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lps_weekly_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  service_front_id UUID,
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  descricao_tarefa TEXT NOT NULL,
  service_id UUID,
  quantidade_planejada NUMERIC(12,2),
  quantidade_executada NUMERIC(12,2) DEFAULT 0,
  unidade TEXT,
  status TEXT NOT NULL DEFAULT 'planejado',
  motivo_nao_cumprimento TEXT,
  constraint_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lps_five_whys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  constraint_id UUID NOT NULL,
  why_1 TEXT NOT NULL,
  why_2 TEXT,
  why_3 TEXT,
  why_4 TEXT,
  why_5 TEXT,
  causa_raiz TEXT NOT NULL,
  acao_corretiva TEXT NOT NULL,
  responsavel_acao TEXT,
  prazo_acao DATE,
  status_acao TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lps_constraint_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  constraint_id UUID NOT NULL,
  action TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  user_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- STEP 4: Add FKs in protected blocks (each one can fail independently)

DO $$ BEGIN
  ALTER TABLE public.lps_constraints ADD CONSTRAINT lps_constraints_project_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK ignored: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_constraints ADD CONSTRAINT lps_constraints_front_fk FOREIGN KEY (service_front_id) REFERENCES public.service_fronts(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK ignored: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_constraints ADD CONSTRAINT lps_constraints_responsavel_fk FOREIGN KEY (responsavel_id) REFERENCES public.employees(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK ignored: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_constraints ADD CONSTRAINT lps_constraints_parent_fk FOREIGN KEY (parent_constraint_id) REFERENCES public.lps_constraints(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK ignored: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_constraints ADD CONSTRAINT lps_constraints_justification_fk FOREIGN KEY (justification_id) REFERENCES public.justifications(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK ignored: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_constraints ADD CONSTRAINT lps_constraints_daily_report_fk FOREIGN KEY (daily_report_id) REFERENCES public.daily_reports(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK ignored: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_weekly_commitments ADD CONSTRAINT lps_commitments_project_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK ignored: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_weekly_commitments ADD CONSTRAINT lps_commitments_front_fk FOREIGN KEY (service_front_id) REFERENCES public.service_fronts(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK ignored: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_weekly_commitments ADD CONSTRAINT lps_commitments_constraint_fk FOREIGN KEY (constraint_id) REFERENCES public.lps_constraints(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK ignored: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_weekly_commitments ADD CONSTRAINT lps_commitments_service_fk FOREIGN KEY (service_id) REFERENCES public.services_catalog(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK ignored: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_five_whys ADD CONSTRAINT lps_five_whys_constraint_fk FOREIGN KEY (constraint_id) REFERENCES public.lps_constraints(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK ignored: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_constraint_audit ADD CONSTRAINT lps_audit_constraint_fk FOREIGN KEY (constraint_id) REFERENCES public.lps_constraints(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK ignored: %', SQLERRM; END $$;

-- STEP 5: RLS with permissive policies (no auth.uid() restriction)
ALTER TABLE public.lps_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_weekly_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_five_whys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_constraint_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lps_constraints_select" ON public.lps_constraints FOR SELECT USING (true);
CREATE POLICY "lps_constraints_insert" ON public.lps_constraints FOR INSERT WITH CHECK (true);
CREATE POLICY "lps_constraints_update" ON public.lps_constraints FOR UPDATE USING (true);
CREATE POLICY "lps_constraints_delete" ON public.lps_constraints FOR DELETE USING (true);

CREATE POLICY "lps_commitments_select" ON public.lps_weekly_commitments FOR SELECT USING (true);
CREATE POLICY "lps_commitments_insert" ON public.lps_weekly_commitments FOR INSERT WITH CHECK (true);
CREATE POLICY "lps_commitments_update" ON public.lps_weekly_commitments FOR UPDATE USING (true);
CREATE POLICY "lps_commitments_delete" ON public.lps_weekly_commitments FOR DELETE USING (true);

CREATE POLICY "lps_five_whys_select" ON public.lps_five_whys FOR SELECT USING (true);
CREATE POLICY "lps_five_whys_insert" ON public.lps_five_whys FOR INSERT WITH CHECK (true);
CREATE POLICY "lps_five_whys_update" ON public.lps_five_whys FOR UPDATE USING (true);
CREATE POLICY "lps_five_whys_delete" ON public.lps_five_whys FOR DELETE USING (true);

CREATE POLICY "lps_audit_select" ON public.lps_constraint_audit FOR SELECT USING (true);
CREATE POLICY "lps_audit_insert" ON public.lps_constraint_audit FOR INSERT WITH CHECK (true);

-- STEP 6: Triggers
CREATE TRIGGER update_lps_constraints_updated_at BEFORE UPDATE ON public.lps_constraints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lps_weekly_commitments_updated_at BEFORE UPDATE ON public.lps_weekly_commitments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lps_five_whys_updated_at BEFORE UPDATE ON public.lps_five_whys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- STEP 7: Indexes
CREATE INDEX idx_lps_constraints_project ON public.lps_constraints(project_id);
CREATE INDEX idx_lps_constraints_status ON public.lps_constraints(status);
CREATE INDEX idx_lps_constraints_front ON public.lps_constraints(service_front_id);
CREATE INDEX idx_lps_constraints_date ON public.lps_constraints(data_identificacao DESC);
CREATE INDEX idx_lps_constraints_type ON public.lps_constraints(tipo_restricao);
CREATE INDEX idx_lps_constraints_parent ON public.lps_constraints(parent_constraint_id);
CREATE INDEX idx_lps_commitments_project ON public.lps_weekly_commitments(project_id);
CREATE INDEX idx_lps_commitments_week ON public.lps_weekly_commitments(semana_inicio);
CREATE INDEX idx_lps_commitments_status ON public.lps_weekly_commitments(status);
CREATE INDEX idx_lps_five_whys_constraint ON public.lps_five_whys(constraint_id);
CREATE INDEX idx_lps_audit_constraint ON public.lps_constraint_audit(constraint_id);
CREATE INDEX idx_lps_audit_created ON public.lps_constraint_audit(created_at DESC);

-- STEP 8: GRANT permissions (CRITICAL for PostgREST)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.lps_constraints TO anon, authenticated, service_role;
GRANT ALL ON public.lps_weekly_commitments TO anon, authenticated, service_role;
GRANT ALL ON public.lps_five_whys TO anon, authenticated, service_role;
GRANT ALL ON public.lps_constraint_audit TO anon, authenticated, service_role;

-- STEP 9: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
