-- ============================================================
-- HYDRO BDI CONTRACTS: Persistent storage for BDI contracts
-- Replaces localStorage-only approach with Supabase persistence
-- Stores full contract data as JSONB for flexibility
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hydro_bdi_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  nome TEXT NOT NULL,
  contratante TEXT,
  tipo_contrato TEXT,
  numero_edital TEXT,
  status TEXT DEFAULT 'proposta',
  municipio TEXT,
  estado TEXT DEFAULT 'SP',
  data_inicio TEXT,
  data_termino TEXT,
  duracao_meses INTEGER DEFAULT 0,
  custo_direto_total NUMERIC(14,2) DEFAULT 0,
  bdi_percentual NUMERIC(5,2) DEFAULT 0,
  preco_venda NUMERIC(14,2) DEFAULT 0,
  valor_edital NUMERIC(14,2) DEFAULT 0,
  contract_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hydro_bdi_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hbc_select" ON public.hydro_bdi_contracts FOR SELECT USING (true);
CREATE POLICY "hbc_insert" ON public.hydro_bdi_contracts FOR INSERT WITH CHECK (true);
CREATE POLICY "hbc_update" ON public.hydro_bdi_contracts FOR UPDATE USING (true);
CREATE POLICY "hbc_delete" ON public.hydro_bdi_contracts FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_hbc_user ON public.hydro_bdi_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_hbc_nome ON public.hydro_bdi_contracts(nome);
CREATE INDEX IF NOT EXISTS idx_hbc_status ON public.hydro_bdi_contracts(status);

CREATE TRIGGER update_hbc_updated_at
  BEFORE UPDATE ON public.hydro_bdi_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT ALL ON public.hydro_bdi_contracts TO anon, authenticated, service_role;

-- ============================================================
-- ADMIN MONITORING VIEWS
-- Provides admin visibility into client data across modules
-- ============================================================

-- View: All LPS constraints with project context
CREATE OR REPLACE VIEW public.admin_lps_overview AS
SELECT
  c.id,
  c.user_id,
  c.project_id,
  p.name AS project_name,
  c.descricao,
  c.tipo_restricao,
  c.status,
  c.impacto,
  c.data_identificacao,
  c.data_prevista,
  c.data_resolvida,
  c.created_at,
  c.updated_at
FROM public.lps_constraints c
LEFT JOIN public.projects p ON p.id = c.project_id::uuid;

-- View: LPS weekly commitments summary
CREATE OR REPLACE VIEW public.admin_lps_commitments AS
SELECT
  wc.id,
  wc.user_id,
  wc.project_id,
  p.name AS project_name,
  wc.semana_inicio,
  wc.semana_fim,
  wc.descricao,
  wc.status,
  wc.created_at
FROM public.lps_weekly_commitments wc
LEFT JOIN public.projects p ON p.id = wc.project_id::uuid;

-- View: BDI contracts summary for admin
CREATE OR REPLACE VIEW public.admin_bdi_contracts AS
SELECT
  bc.id,
  bc.user_id,
  bc.nome,
  bc.contratante,
  bc.tipo_contrato,
  bc.status,
  bc.municipio,
  bc.estado,
  bc.custo_direto_total,
  bc.bdi_percentual,
  bc.preco_venda,
  bc.valor_edital,
  bc.created_at,
  bc.updated_at
FROM public.hydro_bdi_contracts bc;

-- View: Cross-module activity summary per user
CREATE OR REPLACE VIEW public.admin_user_activity AS
SELECT
  u.id AS user_id,
  u.email,
  (SELECT COUNT(*) FROM public.lps_constraints lc WHERE lc.user_id = u.id::text) AS total_constraints,
  (SELECT COUNT(*) FROM public.lps_weekly_commitments wc WHERE wc.user_id = u.id::text) AS total_commitments,
  (SELECT COUNT(*) FROM public.hydro_bdi_contracts bc WHERE bc.user_id = u.id) AS total_bdi_contracts,
  (SELECT COUNT(*) FROM public.hydro_dimensioning_projects hp WHERE hp.user_id = u.id) AS total_hydro_projects,
  (SELECT COUNT(*) FROM public.daily_reports dr WHERE dr.user_id = u.id) AS total_daily_reports
FROM auth.users u;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
