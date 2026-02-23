-- ============================================================
-- DEFINITIVE FIX: LPS Constraints Module
-- Replaces ENUM types with TEXT (PostgREST schema cache compatible)
-- Adds explicit GRANTs for authenticated/anon/service_role
-- ============================================================

-- ============================================================
-- STEP 1: Drop dependent objects safely (in order)
-- ============================================================

-- Drop indexes
DROP INDEX IF EXISTS idx_lps_audit_constraint;
DROP INDEX IF EXISTS idx_lps_audit_created;
DROP INDEX IF EXISTS idx_lps_constraints_parent;
DROP INDEX IF EXISTS idx_lps_five_whys_constraint;
DROP INDEX IF EXISTS idx_lps_commitments_project;
DROP INDEX IF EXISTS idx_lps_commitments_week;
DROP INDEX IF EXISTS idx_lps_commitments_status;
DROP INDEX IF EXISTS idx_lps_constraints_project;
DROP INDEX IF EXISTS idx_lps_constraints_status;
DROP INDEX IF EXISTS idx_lps_constraints_front;
DROP INDEX IF EXISTS idx_lps_constraints_date;
DROP INDEX IF EXISTS idx_lps_constraints_type;

-- Drop triggers
DROP TRIGGER IF EXISTS update_lps_constraints_updated_at ON public.lps_constraints;
DROP TRIGGER IF EXISTS update_lps_weekly_commitments_updated_at ON public.lps_weekly_commitments;
DROP TRIGGER IF EXISTS update_lps_five_whys_updated_at ON public.lps_five_whys;

-- Drop tables (order matters due to FKs)
DROP TABLE IF EXISTS public.lps_constraint_audit CASCADE;
DROP TABLE IF EXISTS public.lps_five_whys CASCADE;
DROP TABLE IF EXISTS public.lps_weekly_commitments CASCADE;
DROP TABLE IF EXISTS public.lps_constraints CASCADE;

-- Drop ENUM types (these cause PostgREST schema cache issues)
DROP TYPE IF EXISTS public.lps_constraint_type CASCADE;
DROP TYPE IF EXISTS public.lps_constraint_status CASCADE;
DROP TYPE IF EXISTS public.lps_impact_level CASCADE;
DROP TYPE IF EXISTS public.lps_commitment_status CASCADE;

-- ============================================================
-- STEP 2: Ensure helper function exists
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 3: Create lps_constraints (TEXT instead of ENUMs)
-- ============================================================

CREATE TABLE public.lps_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service_front_id UUID REFERENCES public.service_fronts(id) ON DELETE SET NULL,
  tipo_restricao TEXT NOT NULL CHECK (tipo_restricao IN (
    'projeto_nao_liberado', 'material_nao_entregue', 'equipe_indisponivel',
    'interferencia_tecnica', 'falta_equipamento', 'condicao_climatica',
    'aprovacao_pendente', 'restricao_contratual', 'restricao_externa'
  )),
  descricao TEXT NOT NULL,
  responsavel_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  responsavel_nome TEXT,
  data_identificacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista_resolucao DATE,
  data_resolvida DATE,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'resolvida', 'critica')),
  impacto TEXT NOT NULL DEFAULT 'medio' CHECK (impacto IN ('baixo', 'medio', 'alto')),
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

-- Self-reference for parent constraint
ALTER TABLE public.lps_constraints
  ADD CONSTRAINT lps_constraints_parent_fk
  FOREIGN KEY (parent_constraint_id)
  REFERENCES public.lps_constraints(id)
  ON DELETE SET NULL;

-- Optional FKs (only if referenced tables exist)
DO $$ BEGIN
  ALTER TABLE public.lps_constraints
    ADD CONSTRAINT lps_constraints_justification_fk
    FOREIGN KEY (justification_id) REFERENCES public.justifications(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_constraints
    ADD CONSTRAINT lps_constraints_daily_report_fk
    FOREIGN KEY (daily_report_id) REFERENCES public.daily_reports(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- RLS
ALTER TABLE public.lps_constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lps_constraints_select" ON public.lps_constraints
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lps_constraints_insert" ON public.lps_constraints
  FOR INSERT TO authenticated WITH CHECK (created_by_user_id = auth.uid());
CREATE POLICY "lps_constraints_update" ON public.lps_constraints
  FOR UPDATE TO authenticated USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_constraints_delete" ON public.lps_constraints
  FOR DELETE TO authenticated USING (created_by_user_id = auth.uid());

-- Trigger
CREATE TRIGGER update_lps_constraints_updated_at
  BEFORE UPDATE ON public.lps_constraints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_lps_constraints_project ON public.lps_constraints(project_id);
CREATE INDEX idx_lps_constraints_status ON public.lps_constraints(status);
CREATE INDEX idx_lps_constraints_front ON public.lps_constraints(service_front_id);
CREATE INDEX idx_lps_constraints_date ON public.lps_constraints(data_identificacao DESC);
CREATE INDEX idx_lps_constraints_type ON public.lps_constraints(tipo_restricao);
CREATE INDEX idx_lps_constraints_parent ON public.lps_constraints(parent_constraint_id);

-- ============================================================
-- STEP 4: Create lps_weekly_commitments
-- ============================================================

CREATE TABLE public.lps_weekly_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service_front_id UUID REFERENCES public.service_fronts(id) ON DELETE SET NULL,
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  descricao_tarefa TEXT NOT NULL,
  service_id UUID,
  quantidade_planejada NUMERIC(12,2),
  quantidade_executada NUMERIC(12,2) DEFAULT 0,
  unidade TEXT,
  status TEXT NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado', 'cumprido', 'nao_cumprido', 'parcial')),
  motivo_nao_cumprimento TEXT,
  constraint_id UUID REFERENCES public.lps_constraints(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional FK to services_catalog
DO $$ BEGIN
  ALTER TABLE public.lps_weekly_commitments
    ADD CONSTRAINT lps_commitments_service_fk
    FOREIGN KEY (service_id) REFERENCES public.services_catalog(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE public.lps_weekly_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lps_commitments_select" ON public.lps_weekly_commitments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lps_commitments_insert" ON public.lps_weekly_commitments
  FOR INSERT TO authenticated WITH CHECK (created_by_user_id = auth.uid());
CREATE POLICY "lps_commitments_update" ON public.lps_weekly_commitments
  FOR UPDATE TO authenticated USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_commitments_delete" ON public.lps_weekly_commitments
  FOR DELETE TO authenticated USING (created_by_user_id = auth.uid());

CREATE TRIGGER update_lps_weekly_commitments_updated_at
  BEFORE UPDATE ON public.lps_weekly_commitments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lps_commitments_project ON public.lps_weekly_commitments(project_id);
CREATE INDEX idx_lps_commitments_week ON public.lps_weekly_commitments(semana_inicio);
CREATE INDEX idx_lps_commitments_status ON public.lps_weekly_commitments(status);

-- ============================================================
-- STEP 5: Create lps_five_whys
-- ============================================================

CREATE TABLE public.lps_five_whys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  constraint_id UUID NOT NULL REFERENCES public.lps_constraints(id) ON DELETE CASCADE,
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

ALTER TABLE public.lps_five_whys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lps_five_whys_select" ON public.lps_five_whys
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lps_five_whys_insert" ON public.lps_five_whys
  FOR INSERT TO authenticated WITH CHECK (created_by_user_id = auth.uid());
CREATE POLICY "lps_five_whys_update" ON public.lps_five_whys
  FOR UPDATE TO authenticated USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_five_whys_delete" ON public.lps_five_whys
  FOR DELETE TO authenticated USING (created_by_user_id = auth.uid());

CREATE TRIGGER update_lps_five_whys_updated_at
  BEFORE UPDATE ON public.lps_five_whys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lps_five_whys_constraint ON public.lps_five_whys(constraint_id);

-- ============================================================
-- STEP 6: Create lps_constraint_audit
-- ============================================================

CREATE TABLE public.lps_constraint_audit (
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

CREATE POLICY "lps_audit_select" ON public.lps_constraint_audit
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lps_audit_insert" ON public.lps_constraint_audit
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_lps_audit_constraint ON public.lps_constraint_audit(constraint_id);
CREATE INDEX idx_lps_audit_created ON public.lps_constraint_audit(created_at DESC);

-- ============================================================
-- STEP 7: GRANT permissions (CRITICAL for PostgREST)
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON public.lps_constraints TO anon;
GRANT ALL ON public.lps_constraints TO authenticated;
GRANT ALL ON public.lps_constraints TO service_role;

GRANT ALL ON public.lps_weekly_commitments TO anon;
GRANT ALL ON public.lps_weekly_commitments TO authenticated;
GRANT ALL ON public.lps_weekly_commitments TO service_role;

GRANT ALL ON public.lps_five_whys TO anon;
GRANT ALL ON public.lps_five_whys TO authenticated;
GRANT ALL ON public.lps_five_whys TO service_role;

GRANT ALL ON public.lps_constraint_audit TO anon;
GRANT ALL ON public.lps_constraint_audit TO authenticated;
GRANT ALL ON public.lps_constraint_audit TO service_role;

-- ============================================================
-- STEP 8: Reload PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
