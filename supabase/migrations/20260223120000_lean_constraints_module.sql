-- ============================================================
-- Lean Constraints Management Module (LPS - Last Planner System)
-- Safe migration: uses IF NOT EXISTS to avoid errors on re-run
-- ============================================================

-- ============================================================
-- ENUMS (safe creation)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.lps_constraint_type AS ENUM (
    'projeto_nao_liberado',
    'material_nao_entregue',
    'equipe_indisponivel',
    'interferencia_tecnica',
    'falta_equipamento',
    'condicao_climatica',
    'aprovacao_pendente',
    'restricao_contratual',
    'restricao_externa'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lps_constraint_status AS ENUM ('ativa', 'resolvida', 'critica');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lps_impact_level AS ENUM ('baixo', 'medio', 'alto');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lps_commitment_status AS ENUM ('planejado', 'cumprido', 'nao_cumprido', 'parcial');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Ensure update_updated_at_column() function exists
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: lps_constraints
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lps_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service_front_id UUID REFERENCES public.service_fronts(id) ON DELETE SET NULL,
  tipo_restricao public.lps_constraint_type NOT NULL,
  descricao TEXT NOT NULL,
  responsavel_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  responsavel_nome TEXT,
  data_identificacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista_resolucao DATE,
  data_resolvida DATE,
  status public.lps_constraint_status NOT NULL DEFAULT 'ativa',
  impacto public.lps_impact_level NOT NULL DEFAULT 'medio',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  origem TEXT NOT NULL DEFAULT 'manual',
  justification_id UUID REFERENCES public.justifications(id) ON DELETE SET NULL,
  daily_report_id UUID REFERENCES public.daily_reports(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lps_constraints ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their own constraints"
    ON public.lps_constraints FOR SELECT TO authenticated
    USING (created_by_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create constraints"
    ON public.lps_constraints FOR INSERT TO authenticated
    WITH CHECK (created_by_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own constraints"
    ON public.lps_constraints FOR UPDATE TO authenticated
    USING (created_by_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own constraints"
    ON public.lps_constraints FOR DELETE TO authenticated
    USING (created_by_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP TRIGGER IF EXISTS update_lps_constraints_updated_at ON public.lps_constraints;
CREATE TRIGGER update_lps_constraints_updated_at
  BEFORE UPDATE ON public.lps_constraints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_lps_constraints_project ON public.lps_constraints(project_id);
CREATE INDEX IF NOT EXISTS idx_lps_constraints_status ON public.lps_constraints(status);
CREATE INDEX IF NOT EXISTS idx_lps_constraints_front ON public.lps_constraints(service_front_id);
CREATE INDEX IF NOT EXISTS idx_lps_constraints_date ON public.lps_constraints(data_identificacao DESC);
CREATE INDEX IF NOT EXISTS idx_lps_constraints_type ON public.lps_constraints(tipo_restricao);

-- ============================================================
-- TABLE: lps_weekly_commitments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lps_weekly_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service_front_id UUID REFERENCES public.service_fronts(id) ON DELETE SET NULL,
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  descricao_tarefa TEXT NOT NULL,
  service_id UUID REFERENCES public.services_catalog(id) ON DELETE SET NULL,
  quantidade_planejada NUMERIC(12,2),
  quantidade_executada NUMERIC(12,2) DEFAULT 0,
  unidade TEXT,
  status public.lps_commitment_status NOT NULL DEFAULT 'planejado',
  motivo_nao_cumprimento TEXT,
  constraint_id UUID REFERENCES public.lps_constraints(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lps_weekly_commitments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their own commitments"
    ON public.lps_weekly_commitments FOR SELECT TO authenticated
    USING (created_by_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create commitments"
    ON public.lps_weekly_commitments FOR INSERT TO authenticated
    WITH CHECK (created_by_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own commitments"
    ON public.lps_weekly_commitments FOR UPDATE TO authenticated
    USING (created_by_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own commitments"
    ON public.lps_weekly_commitments FOR DELETE TO authenticated
    USING (created_by_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP TRIGGER IF EXISTS update_lps_weekly_commitments_updated_at ON public.lps_weekly_commitments;
CREATE TRIGGER update_lps_weekly_commitments_updated_at
  BEFORE UPDATE ON public.lps_weekly_commitments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_lps_commitments_project ON public.lps_weekly_commitments(project_id);
CREATE INDEX IF NOT EXISTS idx_lps_commitments_week ON public.lps_weekly_commitments(semana_inicio);
CREATE INDEX IF NOT EXISTS idx_lps_commitments_status ON public.lps_weekly_commitments(status);

-- ============================================================
-- TABLE: lps_five_whys
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lps_five_whys (
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

DO $$ BEGIN
  CREATE POLICY "Users can view their own analyses"
    ON public.lps_five_whys FOR SELECT TO authenticated
    USING (created_by_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create analyses"
    ON public.lps_five_whys FOR INSERT TO authenticated
    WITH CHECK (created_by_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own analyses"
    ON public.lps_five_whys FOR UPDATE TO authenticated
    USING (created_by_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own analyses"
    ON public.lps_five_whys FOR DELETE TO authenticated
    USING (created_by_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP TRIGGER IF EXISTS update_lps_five_whys_updated_at ON public.lps_five_whys;
CREATE TRIGGER update_lps_five_whys_updated_at
  BEFORE UPDATE ON public.lps_five_whys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_lps_five_whys_constraint ON public.lps_five_whys(constraint_id);

-- ============================================================
-- Reload PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload schema';
