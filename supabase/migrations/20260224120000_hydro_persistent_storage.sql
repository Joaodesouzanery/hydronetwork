-- ============================================================
-- HYDRO PERSISTENT STORAGE: RDO, Saved Plans, Equipment
-- Migrates localStorage-only modules to Supabase
-- ============================================================

-- Helper function (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ─── 1. HYDRO RDO (Relatório Diário de Obra - Trechos) ──────

CREATE TABLE IF NOT EXISTS public.hydro_rdos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  project_id TEXT NOT NULL DEFAULT 'default',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  project_name TEXT NOT NULL DEFAULT '',
  obra_name TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  occurrences TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hydro_rdos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hydro_rdos_select" ON public.hydro_rdos FOR SELECT USING (true);
CREATE POLICY "hydro_rdos_insert" ON public.hydro_rdos FOR INSERT WITH CHECK (true);
CREATE POLICY "hydro_rdos_update" ON public.hydro_rdos FOR UPDATE USING (true);
CREATE POLICY "hydro_rdos_delete" ON public.hydro_rdos FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_hydro_rdos_project ON public.hydro_rdos(project_id);
CREATE INDEX IF NOT EXISTS idx_hydro_rdos_date ON public.hydro_rdos(date DESC);
CREATE INDEX IF NOT EXISTS idx_hydro_rdos_user ON public.hydro_rdos(user_id);

CREATE TRIGGER update_hydro_rdos_updated_at
  BEFORE UPDATE ON public.hydro_rdos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 2. HYDRO SAVED PLANS (Planejamentos Salvos) ──────

CREATE TABLE IF NOT EXISTS public.hydro_saved_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  nome TEXT NOT NULL,
  descricao TEXT,
  num_equipes INTEGER NOT NULL DEFAULT 1,
  team_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  metros_dia NUMERIC(10,2) NOT NULL DEFAULT 30,
  horas_trabalho NUMERIC(4,1) NOT NULL DEFAULT 8,
  work_days INTEGER NOT NULL DEFAULT 6,
  data_inicio DATE,
  data_termino DATE,
  productivity JSONB NOT NULL DEFAULT '[]'::jsonb,
  holidays JSONB NOT NULL DEFAULT '[]'::jsonb,
  trecho_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  service_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  trecho_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
  grouping_mode TEXT NOT NULL DEFAULT 'trecho',
  schedule_snapshot JSONB,
  total_metros NUMERIC(12,2),
  total_dias INTEGER,
  custo_total NUMERIC(14,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hydro_saved_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hydro_plans_select" ON public.hydro_saved_plans FOR SELECT USING (true);
CREATE POLICY "hydro_plans_insert" ON public.hydro_saved_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "hydro_plans_update" ON public.hydro_saved_plans FOR UPDATE USING (true);
CREATE POLICY "hydro_plans_delete" ON public.hydro_saved_plans FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_hydro_plans_user ON public.hydro_saved_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_hydro_plans_name ON public.hydro_saved_plans(nome);

CREATE TRIGGER update_hydro_plans_updated_at
  BEFORE UPDATE ON public.hydro_saved_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 3. HYDRO EQUIPMENT (Equipamentos) ──────

CREATE TABLE IF NOT EXISTS public.hydro_equipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Retroescavadeira',
  placa TEXT,
  proprietario TEXT,
  custo_hora NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'disponivel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hydro_equipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hydro_equip_select" ON public.hydro_equipments FOR SELECT USING (true);
CREATE POLICY "hydro_equip_insert" ON public.hydro_equipments FOR INSERT WITH CHECK (true);
CREATE POLICY "hydro_equip_update" ON public.hydro_equipments FOR UPDATE USING (true);
CREATE POLICY "hydro_equip_delete" ON public.hydro_equipments FOR DELETE USING (true);

CREATE TRIGGER update_hydro_equip_updated_at
  BEFORE UPDATE ON public.hydro_equipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 4. GRANTS ──────

GRANT ALL ON public.hydro_rdos TO anon, authenticated, service_role;
GRANT ALL ON public.hydro_saved_plans TO anon, authenticated, service_role;
GRANT ALL ON public.hydro_equipments TO anon, authenticated, service_role;

-- ─── 5. Reload PostgREST schema cache ──────
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
