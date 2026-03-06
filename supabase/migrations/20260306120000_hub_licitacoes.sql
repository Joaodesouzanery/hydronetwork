-- ============================================================
-- Hub Licitações - Tabela para armazenar licitações do PNCP
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hub_licitacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_controle TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  orgao TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'BR',
  categoria TEXT NOT NULL DEFAULT 'Engenharia',
  data_abertura DATE,
  valor_estimado NUMERIC(18,2) DEFAULT 0,
  valor_estimado_fmt TEXT,
  link TEXT NOT NULL,
  modalidade TEXT,
  modalidade_id INTEGER,
  cnpj_orgao TEXT,
  ano_compra INTEGER,
  sequencial_compra INTEGER,
  fonte TEXT DEFAULT 'PNCP',
  verificado BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_hub_licitacoes_data ON public.hub_licitacoes(data_abertura DESC);
CREATE INDEX IF NOT EXISTS idx_hub_licitacoes_estado ON public.hub_licitacoes(estado);
CREATE INDEX IF NOT EXISTS idx_hub_licitacoes_categoria ON public.hub_licitacoes(categoria);
CREATE INDEX IF NOT EXISTS idx_hub_licitacoes_modalidade ON public.hub_licitacoes(modalidade);
CREATE INDEX IF NOT EXISTS idx_hub_licitacoes_valor ON public.hub_licitacoes(valor_estimado DESC);

-- RLS: leitura pública, escrita via service_role (Edge Function)
ALTER TABLE public.hub_licitacoes ENABLE ROW LEVEL SECURITY;

-- Drop policies first to make migration idempotent (PostgreSQL has no CREATE POLICY IF NOT EXISTS)
DROP POLICY IF EXISTS "hub_licitacoes_read_all" ON public.hub_licitacoes;
DROP POLICY IF EXISTS "hub_licitacoes_insert_service" ON public.hub_licitacoes;
DROP POLICY IF EXISTS "hub_licitacoes_update_service" ON public.hub_licitacoes;

CREATE POLICY "hub_licitacoes_read_all"
  ON public.hub_licitacoes FOR SELECT
  USING (true);

CREATE POLICY "hub_licitacoes_insert_service"
  ON public.hub_licitacoes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "hub_licitacoes_update_service"
  ON public.hub_licitacoes FOR UPDATE
  USING (true);

-- Tabela de metadados de coleta
CREATE TABLE IF NOT EXISTS public.hub_coleta_meta (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL, -- 'licitacoes', 'noticias', etc.
  ultima_coleta TIMESTAMPTZ DEFAULT NOW(),
  total_coletado INTEGER DEFAULT 0,
  total_novos INTEGER DEFAULT 0,
  fonte TEXT,
  status TEXT DEFAULT 'ok',
  erro TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.hub_coleta_meta ENABLE ROW LEVEL SECURITY;

-- Drop policies first to make migration idempotent
DROP POLICY IF EXISTS "hub_coleta_meta_read_all" ON public.hub_coleta_meta;
DROP POLICY IF EXISTS "hub_coleta_meta_insert_service" ON public.hub_coleta_meta;

CREATE POLICY "hub_coleta_meta_read_all"
  ON public.hub_coleta_meta FOR SELECT
  USING (true);

CREATE POLICY "hub_coleta_meta_insert_service"
  ON public.hub_coleta_meta FOR INSERT
  WITH CHECK (true);
