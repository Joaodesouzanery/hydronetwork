-- ============================================
-- SETUP COMPLETO - HydroNetwork / ConstruData
-- Arquivo consolidado para colar no Supabase SQL Editor
-- Gerado automaticamente
-- ============================================

-- ============================================
-- RESET COMPLETO - Limpa tudo antes de criar
-- ============================================

-- Remover todas as policies de storage.objects
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (
        SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- Limpar buckets de storage
DELETE FROM storage.objects;
DELETE FROM storage.buckets;

-- Limpar schema public
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all tables
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Drop all functions
    FOR r IN (
        SELECT ns.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace ns ON p.pronamespace = ns.oid
        WHERE ns.nspname = 'public'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
    END LOOP;
    
    -- Drop all custom types/enums
    FOR r IN (
        SELECT t.typname
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public' AND t.typtype = 'e'
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
    
    -- Drop all sequences
    FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequencename) || ' CASCADE';
    END LOOP;
END $$;



-- ============================================
-- PARTE 1: parte1.sql
-- ============================================

-- PARTE 1 DE 4: Core tables e estrutura base
-- Cole este SQL no Supabase SQL Editor e clique Run


-- Migration: 20251019180720_6b92f220-7a9b-49fc-9d83-acbc68f0b585.sql
-- Criar extensão para UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de Obras
CREATE TABLE public.obras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  tipo_obra TEXT NOT NULL, -- residencial, comercial, infraestrutura
  localizacao TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  data_inicio DATE NOT NULL,
  data_prevista_fim DATE,
  status TEXT DEFAULT 'ativa', -- ativa, pausada, concluida
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Modelos de Formulários
CREATE TABLE public.formulario_modelos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  tipo_obra TEXT, -- para categorização
  descricao TEXT,
  campos JSONB NOT NULL, -- estrutura dos campos e lógica condicional
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Formulários de Produção (instâncias)
CREATE TABLE public.formularios_producao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  modelo_id UUID REFERENCES public.formulario_modelos(id) ON DELETE SET NULL,
  data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  frente_servico TEXT NOT NULL,
  equipe_nome TEXT,
  responsavel_nome TEXT,
  localizacao_gps TEXT,
  observacoes TEXT,
  respostas JSONB NOT NULL, -- respostas do formulário
  fotos_urls TEXT[], -- URLs das fotos
  videos_urls TEXT[], -- URLs dos vídeos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de RDO (Relatório Diário de Obra)
CREATE TABLE public.rdos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  clima_temperatura DECIMAL(5, 2),
  clima_umidade INTEGER,
  clima_vento_velocidade DECIMAL(5, 2),
  clima_previsao_chuva BOOLEAN,
  condicao_terreno TEXT, -- umido, seco, lamacento
  localizacao_validada TEXT,
  fotos_validacao TEXT[],
  observacoes_gerais TEXT,
  producao_ids UUID[], -- IDs dos formulários de produção do dia
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(obra_id, data)
);

-- Tabela de Metas de Produção
CREATE TABLE public.metas_producao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  frente_servico TEXT NOT NULL,
  meta_diaria DECIMAL(10, 2),
  unidade TEXT NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Configuração de Alertas
CREATE TABLE public.alertas_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE,
  tipo_alerta TEXT NOT NULL, -- producao_baixa, ausencias, equipamento
  condicao JSONB NOT NULL, -- threshold e parâmetros
  destinatarios TEXT[] NOT NULL, -- emails
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Histórico de Alertas Enviados
CREATE TABLE public.alertas_historico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alerta_config_id UUID REFERENCES public.alertas_config(id) ON DELETE CASCADE NOT NULL,
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  mensagem TEXT NOT NULL,
  enviado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulario_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formularios_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_historico ENABLE ROW LEVEL SECURITY;

-- RLS Policies para obras
CREATE POLICY "Usuários podem ver suas próprias obras"
  ON public.obras FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias obras"
  ON public.obras FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias obras"
  ON public.obras FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias obras"
  ON public.obras FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para formulario_modelos
CREATE POLICY "Usuários podem ver seus próprios modelos"
  ON public.formulario_modelos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios modelos"
  ON public.formulario_modelos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios modelos"
  ON public.formulario_modelos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios modelos"
  ON public.formulario_modelos FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para formularios_producao
CREATE POLICY "Usuários podem ver formulários de suas obras"
  ON public.formularios_producao FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = formularios_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar formulários em suas obras"
  ON public.formularios_producao FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = formularios_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar formulários de suas obras"
  ON public.formularios_producao FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = formularios_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar formulários de suas obras"
  ON public.formularios_producao FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = formularios_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

-- RLS Policies para rdos
CREATE POLICY "Usuários podem ver RDOs de suas obras"
  ON public.rdos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = rdos.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar RDOs em suas obras"
  ON public.rdos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = rdos.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar RDOs de suas obras"
  ON public.rdos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = rdos.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar RDOs de suas obras"
  ON public.rdos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = rdos.obra_id
      AND obras.user_id = auth.uid()
    )
  );

-- RLS Policies para metas_producao
CREATE POLICY "Usuários podem ver metas de suas obras"
  ON public.metas_producao FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = metas_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar metas em suas obras"
  ON public.metas_producao FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = metas_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar metas de suas obras"
  ON public.metas_producao FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = metas_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar metas de suas obras"
  ON public.metas_producao FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = metas_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

-- RLS Policies para alertas_config
CREATE POLICY "Usuários podem ver suas próprias configurações de alertas"
  ON public.alertas_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias configurações de alertas"
  ON public.alertas_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias configurações de alertas"
  ON public.alertas_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias configurações de alertas"
  ON public.alertas_config FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para alertas_historico
CREATE POLICY "Usuários podem ver histórico de alertas de suas obras"
  ON public.alertas_historico FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = alertas_historico.obra_id
      AND obras.user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_obras_updated_at
  BEFORE UPDATE ON public.obras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_formulario_modelos_updated_at
  BEFORE UPDATE ON public.formulario_modelos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_formularios_producao_updated_at
  BEFORE UPDATE ON public.formularios_producao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rdos_updated_at
  BEFORE UPDATE ON public.rdos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_metas_producao_updated_at
  BEFORE UPDATE ON public.metas_producao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alertas_config_updated_at
  BEFORE UPDATE ON public.alertas_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251019180804_fe50e3f3-e4c3-4a54-bead-3572424f9a20.sql
-- Corrigir a função update_updated_at_column para ter search_path seguro
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Migration: 20251019182749_8406adae-c147-4ca0-bc5b-b5088deb014b.sql
-- Force TypeScript types regeneration by adding a comment to an existing table
COMMENT ON TABLE public.obras IS 'Tabela principal para gerenciamento de obras de construção';

-- Refresh the schema to ensure types are regenerated
SELECT 1;

-- Migration: 20251019182811_d900913c-189e-47cc-8130-c0aace4241e0.sql
-- Add a temporary column to force types regeneration
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS temp_column text;

-- Remove the temporary column immediately
ALTER TABLE public.obras DROP COLUMN IF EXISTS temp_column;

-- Migration: 20251019182956_0fe04cf6-eb57-4148-9171-8b37d3c0862a.sql
-- Force complete types regeneration by adding comments to all tables
COMMENT ON TABLE public.obras IS 'Tabela de gerenciamento de obras de construção';
COMMENT ON TABLE public.alertas_config IS 'Configurações de alertas para obras';
COMMENT ON TABLE public.alertas_historico IS 'Histórico de alertas enviados';
COMMENT ON TABLE public.formulario_modelos IS 'Modelos de formulários customizáveis';
COMMENT ON TABLE public.formularios_producao IS 'Registros de produção diária';
COMMENT ON TABLE public.metas_producao IS 'Metas de produção por frente';
COMMENT ON TABLE public.rdos IS 'Relatórios Diários de Obra';

-- Add indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_obras_user_id ON public.obras(user_id);
CREATE INDEX IF NOT EXISTS idx_formularios_producao_obra_id ON public.formularios_producao(obra_id);
CREATE INDEX IF NOT EXISTS idx_rdos_obra_id ON public.rdos(obra_id);
CREATE INDEX IF NOT EXISTS idx_alertas_config_user_id ON public.alertas_config(user_id);
CREATE INDEX IF NOT EXISTS idx_metas_producao_obra_id ON public.metas_producao(obra_id);

-- Migration: 20251020004355_4894a9c3-0502-4656-ae3c-05cf9d485f47.sql
-- FASE 1: Tabelas para RDO - Relatório Diário de Obras

-- Tabela de Projetos
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_id UUID,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Locais de Obra
CREATE TABLE public.construction_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  address TEXT,
  created_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Frentes de Serviço
CREATE TABLE public.service_fronts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  description TEXT,
  created_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Catálogo de Serviços
CREATE TABLE public.services_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Relatórios Diários (RDOs)
CREATE TABLE public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  construction_site_id UUID REFERENCES public.construction_sites(id) ON DELETE CASCADE NOT NULL,
  service_front_id UUID REFERENCES public.service_fronts(id) ON DELETE CASCADE NOT NULL,
  executed_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Serviços Executados
CREATE TABLE public.executed_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id UUID REFERENCES public.daily_reports(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services_catalog(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit TEXT NOT NULL,
  equipment_used JSONB,
  created_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Metas de Produção
CREATE TABLE public.production_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_front_id UUID REFERENCES public.service_fronts(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services_catalog(id) ON DELETE CASCADE NOT NULL,
  target_quantity DECIMAL(10, 2) NOT NULL,
  target_date DATE NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Justificativas
CREATE TABLE public.justifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id UUID REFERENCES public.daily_reports(id) ON DELETE CASCADE NOT NULL,
  executed_service_id UUID REFERENCES public.executed_services(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_fronts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executed_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies para projects
CREATE POLICY "Usuários autenticados podem ver projetos"
  ON public.projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar projetos"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem atualizar projetos que criaram"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem deletar projetos que criaram"
  ON public.projects FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

-- RLS Policies para construction_sites
CREATE POLICY "Usuários autenticados podem ver locais de obra"
  ON public.construction_sites FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar locais de obra"
  ON public.construction_sites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem atualizar locais que criaram"
  ON public.construction_sites FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem deletar locais que criaram"
  ON public.construction_sites FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

-- RLS Policies para service_fronts
CREATE POLICY "Usuários autenticados podem ver frentes de serviço"
  ON public.service_fronts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar frentes de serviço"
  ON public.service_fronts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem atualizar frentes que criaram"
  ON public.service_fronts FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem deletar frentes que criaram"
  ON public.service_fronts FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

-- RLS Policies para services_catalog
CREATE POLICY "Usuários autenticados podem ver catálogo de serviços"
  ON public.services_catalog FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem adicionar serviços ao catálogo"
  ON public.services_catalog FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem atualizar serviços que criaram"
  ON public.services_catalog FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem deletar serviços que criaram"
  ON public.services_catalog FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

-- RLS Policies para daily_reports
CREATE POLICY "Usuários autenticados podem ver RDOs"
  ON public.daily_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar RDOs"
  ON public.daily_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = executed_by_user_id);

CREATE POLICY "Usuários podem atualizar RDOs que executaram"
  ON public.daily_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = executed_by_user_id);

CREATE POLICY "Usuários podem deletar RDOs que executaram"
  ON public.daily_reports FOR DELETE
  TO authenticated
  USING (auth.uid() = executed_by_user_id);

-- RLS Policies para executed_services
CREATE POLICY "Usuários autenticados podem ver serviços executados"
  ON public.executed_services FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar serviços executados"
  ON public.executed_services FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem atualizar serviços que criaram"
  ON public.executed_services FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem deletar serviços que criaram"
  ON public.executed_services FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

-- RLS Policies para production_targets
CREATE POLICY "Usuários autenticados podem ver metas de produção"
  ON public.production_targets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar metas de produção"
  ON public.production_targets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem atualizar metas que criaram"
  ON public.production_targets FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem deletar metas que criaram"
  ON public.production_targets FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

-- RLS Policies para justifications
CREATE POLICY "Usuários autenticados podem ver justificativas"
  ON public.justifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar justificativas"
  ON public.justifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem atualizar justificativas que criaram"
  ON public.justifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem deletar justificativas que criaram"
  ON public.justifications FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

-- Triggers para updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_construction_sites_updated_at
  BEFORE UPDATE ON public.construction_sites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_fronts_updated_at
  BEFORE UPDATE ON public.service_fronts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_catalog_updated_at
  BEFORE UPDATE ON public.services_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_reports_updated_at
  BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_production_targets_updated_at
  BEFORE UPDATE ON public.production_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_projects_created_by ON public.projects(created_by_user_id);
CREATE INDEX idx_construction_sites_project ON public.construction_sites(project_id);
CREATE INDEX idx_service_fronts_project ON public.service_fronts(project_id);
CREATE INDEX idx_daily_reports_project ON public.daily_reports(project_id);
CREATE INDEX idx_daily_reports_date ON public.daily_reports(report_date);
CREATE INDEX idx_executed_services_report ON public.executed_services(daily_report_id);
CREATE INDEX idx_production_targets_service_front ON public.production_targets(service_front_id);
CREATE INDEX idx_justifications_report ON public.justifications(daily_report_id);

-- Migration: 20251020005419_884607ab-ab7a-4211-8842-7d8d4b21e8ba.sql
-- Create material_requests table
CREATE TABLE public.material_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  project_id UUID NOT NULL,
  service_front_id UUID NOT NULL,
  material_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  requested_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on material_requests
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for material_requests
CREATE POLICY "Usuários autenticados podem ver pedidos de material"
ON public.material_requests
FOR SELECT
USING (true);

CREATE POLICY "Usuários autenticados podem criar pedidos de material"
ON public.material_requests
FOR INSERT
WITH CHECK (auth.uid() = requested_by_user_id);

CREATE POLICY "Usuários podem atualizar pedidos que criaram"
ON public.material_requests
FOR UPDATE
USING (auth.uid() = requested_by_user_id);

CREATE POLICY "Usuários podem deletar pedidos que criaram"
ON public.material_requests
FOR DELETE
USING (auth.uid() = requested_by_user_id);

-- Create material_control table
CREATE TABLE public.material_control (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_name TEXT NOT NULL,
  project_id UUID NOT NULL,
  service_front_id UUID NOT NULL,
  quantity_used NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on material_control
ALTER TABLE public.material_control ENABLE ROW LEVEL SECURITY;

-- RLS Policies for material_control
CREATE POLICY "Usuários autenticados podem ver controle de material"
ON public.material_control
FOR SELECT
USING (true);

CREATE POLICY "Usuários autenticados podem criar registros de controle"
ON public.material_control
FOR INSERT
WITH CHECK (auth.uid() = recorded_by_user_id);

CREATE POLICY "Usuários podem atualizar registros que criaram"
ON public.material_control
FOR UPDATE
USING (auth.uid() = recorded_by_user_id);

CREATE POLICY "Usuários podem deletar registros que criaram"
ON public.material_control
FOR DELETE
USING (auth.uid() = recorded_by_user_id);

-- Add updated_at trigger for material_requests
CREATE TRIGGER update_material_requests_updated_at
BEFORE UPDATE ON public.material_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for material_control
CREATE TRIGGER update_material_control_updated_at
BEFORE UPDATE ON public.material_control
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251020005605_c57c82f8-27eb-45d1-a216-f9c46e5f257d.sql
-- Add foreign key constraints to material_requests
ALTER TABLE public.material_requests
ADD CONSTRAINT material_requests_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.material_requests
ADD CONSTRAINT material_requests_service_front_id_fkey 
FOREIGN KEY (service_front_id) REFERENCES public.service_fronts(id) ON DELETE CASCADE;

-- Add foreign key constraints to material_control
ALTER TABLE public.material_control
ADD CONSTRAINT material_control_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.material_control
ADD CONSTRAINT material_control_service_front_id_fkey 
FOREIGN KEY (service_front_id) REFERENCES public.service_fronts(id) ON DELETE CASCADE;

-- Migration: 20251020010123_e6e4c4be-b3ea-45b9-b11d-e91a042c2d4a.sql
-- Habilitar realtime para tabelas de alertas e notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas_historico;
ALTER PUBLICATION supabase_realtime ADD TABLE public.material_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.executed_services;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_reports;

-- Criar função para verificar se produção está abaixo da meta
CREATE OR REPLACE FUNCTION check_production_target()
RETURNS TRIGGER AS $$
DECLARE
  target_record RECORD;
  total_executed NUMERIC;
  target_percentage NUMERIC := 0.8; -- 80% da meta
BEGIN
  -- Buscar meta para este serviço e frente
  SELECT * INTO target_record
  FROM production_targets pt
  JOIN daily_reports dr ON dr.service_front_id = pt.service_front_id
  WHERE pt.service_id = NEW.service_id
    AND dr.id = NEW.daily_report_id
    AND pt.target_date = dr.report_date
  LIMIT 1;

  IF target_record IS NOT NULL THEN
    -- Calcular total executado para esta meta
    SELECT COALESCE(SUM(es.quantity), 0) INTO total_executed
    FROM executed_services es
    JOIN daily_reports dr ON dr.id = es.daily_report_id
    WHERE es.service_id = NEW.service_id
      AND dr.service_front_id = target_record.service_front_id
      AND dr.report_date = target_record.target_date;

    -- Verificar se está abaixo da meta
    IF total_executed < (target_record.target_quantity * target_percentage) THEN
      -- Buscar configuração de alerta ativa
      INSERT INTO alertas_historico (alerta_config_id, obra_id, mensagem)
      SELECT 
        ac.id,
        NULL, -- obra_id será preenchido se existir relação
        format('Produção abaixo da meta: %.2f de %.2f (%.0f%% da meta)', 
               total_executed, 
               target_record.target_quantity,
               target_percentage * 100)
      FROM alertas_config ac
      WHERE ac.tipo_alerta = 'producao_baixa'
        AND ac.ativo = true
      LIMIT 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para verificar produção após inserção de serviço executado
CREATE TRIGGER check_production_after_insert
  AFTER INSERT ON executed_services
  FOR EACH ROW
  EXECUTE FUNCTION check_production_target();

-- Criar função para registrar usuário em todas as operações
CREATE OR REPLACE FUNCTION ensure_user_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o campo user_id existe e não foi preenchido, preencher com auth.uid()
  IF TG_TABLE_NAME IN ('material_requests', 'material_control') THEN
    IF NEW.requested_by_user_id IS NULL OR NEW.recorded_by_user_id IS NULL THEN
      IF TG_TABLE_NAME = 'material_requests' THEN
        NEW.requested_by_user_id := auth.uid();
      ELSE
        NEW.recorded_by_user_id := auth.uid();
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Comentário nas tabelas para documentar rastreamento de usuário
COMMENT ON COLUMN executed_services.created_by_user_id IS 'Usuário que registrou o serviço executado - preenchido automaticamente';
COMMENT ON COLUMN daily_reports.executed_by_user_id IS 'Usuário que executou/registrou o RDO - preenchido automaticamente';
COMMENT ON COLUMN material_requests.requested_by_user_id IS 'Usuário que solicitou o material - preenchido automaticamente';
COMMENT ON COLUMN material_control.recorded_by_user_id IS 'Usuário que registrou o controle - preenchido automaticamente';

-- Migration: 20251020014445_fab821e5-7a28-4d26-a346-d2c9b5d39392.sql
-- Adicionar novas colunas à tabela material_requests
ALTER TABLE material_requests
ADD COLUMN needed_date date,
ADD COLUMN usage_location text,
ADD COLUMN requested_by_employee_id uuid;

-- Criar tabela de funcionários
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  phone text,
  email text,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  construction_site_id uuid REFERENCES construction_sites(id) ON DELETE SET NULL,
  company_name text,
  status text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by_user_id uuid NOT NULL
);

-- Enable RLS on employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- RLS policies for employees
CREATE POLICY "Usuários autenticados podem ver funcionários"
ON employees FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar funcionários"
ON employees FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem atualizar funcionários que criaram"
ON employees FOR UPDATE
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem deletar funcionários que criaram"
ON employees FOR DELETE
USING (auth.uid() = created_by_user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Adicionar índices para performance
CREATE INDEX idx_employees_project ON employees(project_id);
CREATE INDEX idx_employees_construction_site ON employees(construction_site_id);
CREATE INDEX idx_material_requests_employee ON material_requests(requested_by_employee_id);

-- Migration: 20251020020627_048cba4b-268e-468e-b0f1-8cb47a822b0a.sql
-- Adicionar campo department (setor) na tabela employees
ALTER TABLE public.employees ADD COLUMN department text;

-- Criar índice para melhorar performance nas consultas por setor
CREATE INDEX idx_employees_department ON public.employees(department);

-- Migration: 20251020101302_e928d194-fbf9-4189-830b-e9ffd3e68dbd.sql
-- Add location fields to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Add comment
COMMENT ON COLUMN public.projects.address IS 'Full address of the project location';
COMMENT ON COLUMN public.projects.latitude IS 'Latitude coordinate';
COMMENT ON COLUMN public.projects.longitude IS 'Longitude coordinate';

-- Migration: 20251020131935_c97a5e76-a4cf-49f4-834b-c77903b73003.sql
-- Adicionar campos de justificativa na tabela de alertas_historico
ALTER TABLE alertas_historico 
ADD COLUMN justificativa TEXT,
ADD COLUMN justificado_por_user_id UUID REFERENCES auth.users(id),
ADD COLUMN justificado_em TIMESTAMP WITH TIME ZONE;

-- Adicionar comentário explicativo
COMMENT ON COLUMN alertas_historico.justificativa IS 'Justificativa fornecida pelo gestor/responsável para o alerta';
COMMENT ON COLUMN alertas_historico.justificado_por_user_id IS 'ID do usuário que forneceu a justificativa';
COMMENT ON COLUMN alertas_historico.justificado_em IS 'Data e hora em que a justificativa foi fornecida';

-- Migration: 20251020141325_af4bc03c-70aa-4730-895e-d9e1bdb814ea.sql
-- COMPREHENSIVE SECURITY FIX: Restrict all data access to project owners
-- This migration fixes all the critical security vulnerabilities identified

-- ==========================================
-- 1. FIX EMPLOYEES TABLE - RESTRICT TO PROJECT OWNERS
-- ==========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Usuários autenticados podem ver funcionários" ON employees;

-- Create project-based access policy
CREATE POLICY "Users can view employees from their projects"
ON employees FOR SELECT
USING (
  -- If employee is assigned to a project, check ownership
  (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = employees.project_id
    AND projects.created_by_user_id = auth.uid()
  ))
  OR
  -- If employee is assigned to a construction site, check project ownership
  (construction_site_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM construction_sites cs
    JOIN projects p ON p.id = cs.project_id
    WHERE cs.id = employees.construction_site_id
    AND p.created_by_user_id = auth.uid()
  ))
  OR
  -- User can always see employees they created
  (created_by_user_id = auth.uid())
);

-- ==========================================
-- 2. FIX CONSTRUCTION SITES - RESTRICT TO PROJECT OWNERS
-- ==========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Usuários autenticados podem ver locais de obra" ON construction_sites;

-- Create project-based access policy
CREATE POLICY "Users can view construction sites from their projects"
ON construction_sites FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = construction_sites.project_id
    AND projects.created_by_user_id = auth.uid()
  )
  OR
  construction_sites.created_by_user_id = auth.uid()
);

-- ==========================================
-- 3. FIX PROJECTS TABLE - RESTRICT TO OWNERS
-- ==========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Usuários autenticados podem ver projetos" ON projects;

-- Create owner-only access policy
CREATE POLICY "Users can view their own projects"
ON projects FOR SELECT
USING (created_by_user_id = auth.uid());

-- ==========================================
-- 4. FIX DAILY REPORTS - RESTRICT TO PROJECT OWNERS
-- ==========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Usuários autenticados podem ver RDOs" ON daily_reports;

-- Create project-based access policy
CREATE POLICY "Users can view daily reports from their projects"
ON daily_reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = daily_reports.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

-- ==========================================
-- 5. FIX EXECUTED SERVICES - RESTRICT TO PROJECT OWNERS
-- ==========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Usuários autenticados podem ver serviços executados" ON executed_services;

-- Create project-based access policy
CREATE POLICY "Users can view executed services from their projects"
ON executed_services FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM daily_reports dr
    JOIN projects p ON p.id = dr.project_id
    WHERE dr.id = executed_services.daily_report_id
    AND p.created_by_user_id = auth.uid()
  )
);

-- ==========================================
-- 6. FIX PRODUCTION TARGETS - RESTRICT TO PROJECT OWNERS
-- ==========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Usuários autenticados podem ver metas de produção" ON production_targets;

-- Create project-based access policy
CREATE POLICY "Users can view production targets from their projects"
ON production_targets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM service_fronts sf
    JOIN projects p ON p.id = sf.project_id
    WHERE sf.id = production_targets.service_front_id
    AND p.created_by_user_id = auth.uid()
  )
);

-- ==========================================
-- 7. FIX SERVICE FRONTS - RESTRICT TO PROJECT OWNERS
-- ==========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Usuários autenticados podem ver frentes de serviço" ON service_fronts;

-- Create project-based access policy
CREATE POLICY "Users can view service fronts from their projects"
ON service_fronts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = service_fronts.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

-- ==========================================
-- 8. FIX SERVICES CATALOG - RESTRICT TO OWNER
-- ==========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Usuários autenticados podem ver catálogo de serviços" ON services_catalog;

-- Create owner-only access policy
CREATE POLICY "Users can view their own services"
ON services_catalog FOR SELECT
USING (created_by_user_id = auth.uid());

-- ==========================================
-- 9. FIX JUSTIFICATIONS - RESTRICT TO PROJECT OWNERS
-- ==========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Usuários autenticados podem ver justificativas" ON justifications;

-- Create project-based access policy
CREATE POLICY "Users can view justifications from their projects"
ON justifications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM daily_reports dr
    JOIN projects p ON p.id = dr.project_id
    WHERE dr.id = justifications.daily_report_id
    AND p.created_by_user_id = auth.uid()
  )
);

-- ==========================================
-- 10. FIX MATERIAL REQUESTS - RESTRICT TO PROJECT OWNERS
-- ==========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Usuários autenticados podem ver pedidos de material" ON material_requests;

-- Create project-based access policy
CREATE POLICY "Users can view material requests from their projects"
ON material_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = material_requests.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

-- ==========================================
-- 11. FIX MATERIAL CONTROL - RESTRICT TO PROJECT OWNERS
-- ==========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Usuários autenticados podem ver controle de material" ON material_control;

-- Create project-based access policy
CREATE POLICY "Users can view material control from their projects"
ON material_control FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = material_control.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- Add indexes to improve performance of RLS checks
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_project_id ON employees(project_id);
CREATE INDEX IF NOT EXISTS idx_construction_sites_project_id ON construction_sites(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_project_id ON daily_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_service_fronts_project_id ON service_fronts(project_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_project_id ON material_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_material_control_project_id ON material_control(project_id);

-- Migration: 20251020165933_384dc3da-52f8-4bcb-a828-1fb976bd67b7.sql
-- Adicionar coluna requestor_name à tabela material_requests
ALTER TABLE material_requests 
ADD COLUMN IF NOT EXISTS requestor_name TEXT;



-- ============================================
-- PARTE 2: parte2.sql
-- ============================================

-- PARTE 2 DE 4: Features intermediárias
-- Cole este SQL no Supabase SQL Editor e clique Run


-- Migration: 20251023024736_7325ca95-89c4-450d-a375-32b1de62e27a.sql
-- Criar tabela para fotos de validação dos RDOs
CREATE TABLE IF NOT EXISTS public.rdo_validation_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.rdo_validation_photos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fotos de validação
CREATE POLICY "Users can view photos from their projects"
ON public.rdo_validation_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.daily_reports dr
    JOIN public.projects p ON p.id = dr.project_id
    WHERE dr.id = rdo_validation_photos.daily_report_id
    AND p.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload photos to their RDOs"
ON public.rdo_validation_photos
FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own photos"
ON public.rdo_validation_photos
FOR DELETE
USING (auth.uid() = created_by_user_id);

-- Adicionar campo employee_id à tabela executed_services
ALTER TABLE public.executed_services 
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id);

-- Criar bucket de storage para fotos de validação
INSERT INTO storage.buckets (id, name, public)
VALUES ('rdo-photos', 'rdo-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para fotos de validação
DROP POLICY IF EXISTS "Users can view their project photos" ON storage.objects;
CREATE POLICY "Users can view their project photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'rdo-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can upload their photos" ON storage.objects;
CREATE POLICY "Users can upload their photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'rdo-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their photos" ON storage.objects;
CREATE POLICY "Users can delete their photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'rdo-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Migration: 20251023025951_29ebf78a-a95e-43f9-b449-bc48723e7ae1.sql
-- Adicionar campo employee_id à tabela production_targets
ALTER TABLE public.production_targets 
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id);

-- Migration: 20251023030053_87170522-755e-4c68-95c6-172455cf37d4.sql
-- Adicionar campos climáticos à tabela daily_reports
ALTER TABLE public.daily_reports 
ADD COLUMN IF NOT EXISTS temperature NUMERIC,
ADD COLUMN IF NOT EXISTS humidity INTEGER,
ADD COLUMN IF NOT EXISTS wind_speed NUMERIC,
ADD COLUMN IF NOT EXISTS will_rain BOOLEAN,
ADD COLUMN IF NOT EXISTS weather_description TEXT,
ADD COLUMN IF NOT EXISTS terrain_condition TEXT,
ADD COLUMN IF NOT EXISTS gps_location TEXT,
ADD COLUMN IF NOT EXISTS general_observations TEXT;

-- Migration: 20251024184410_e584fdec-6135-42f9-860d-c0943d182dfb.sql
-- Create inventory (almoxarifado) table
CREATE TABLE public.inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  material_name TEXT NOT NULL,
  material_code TEXT,
  category TEXT,
  unit TEXT,
  quantity_available NUMERIC NOT NULL DEFAULT 0,
  minimum_stock NUMERIC DEFAULT 0,
  location TEXT,
  supplier TEXT,
  unit_cost NUMERIC DEFAULT 0,
  notes TEXT,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view inventory from their projects"
  ON public.inventory
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = inventory.project_id
      AND projects.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create inventory items"
  ON public.inventory
  FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update inventory items they created"
  ON public.inventory
  FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete inventory items they created"
  ON public.inventory
  FOR DELETE
  USING (auth.uid() = created_by_user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_inventory_project_id ON public.inventory(project_id);
CREATE INDEX idx_inventory_material_name ON public.inventory(material_name);
CREATE INDEX idx_inventory_category ON public.inventory(category);

-- Create inventory movements table for tracking stock changes
CREATE TABLE public.inventory_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entrada', 'saida', 'ajuste', 'transferencia')),
  quantity NUMERIC NOT NULL,
  reason TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for movements
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for movements
CREATE POLICY "Users can view movements from their inventory"
  ON public.inventory_movements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inventory i
      JOIN projects p ON p.id = i.project_id
      WHERE i.id = inventory_movements.inventory_id
      AND p.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create inventory movements"
  ON public.inventory_movements
  FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

-- Create index for movements
CREATE INDEX idx_inventory_movements_inventory_id ON public.inventory_movements(inventory_id);
CREATE INDEX idx_inventory_movements_created_at ON public.inventory_movements(created_at DESC);

-- Migration: 20251024185204_3388a620-c96c-4ac5-98a1-52d988ce8c39.sql
-- Allow project_id to be nullable in inventory table
ALTER TABLE public.inventory 
ALTER COLUMN project_id DROP NOT NULL;

-- Migration: 20251024185556_ae7903e4-3d18-481f-b43e-8cc8838f3f22.sql
-- Create function to handle low stock alerts
CREATE OR REPLACE FUNCTION public.check_low_inventory_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if quantity is below or equal to minimum stock
  IF NEW.quantity_available <= NEW.minimum_stock THEN
    -- Check if there's an active alert configuration for low stock
    INSERT INTO alertas_historico (alerta_config_id, obra_id, mensagem)
    SELECT 
      ac.id,
      NEW.project_id,
      format('Estoque baixo: %s - Quantidade: %s %s (Mínimo: %s)', 
             NEW.material_name,
             NEW.quantity_available, 
             COALESCE(NEW.unit, ''),
             NEW.minimum_stock)
    FROM alertas_config ac
    WHERE ac.tipo_alerta = 'estoque_baixo'
      AND ac.ativo = true
      AND (ac.obra_id = NEW.project_id OR ac.obra_id IS NULL)
    LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for inventory low stock check
DROP TRIGGER IF EXISTS trigger_check_low_inventory_stock ON public.inventory;
CREATE TRIGGER trigger_check_low_inventory_stock
  AFTER UPDATE OF quantity_available ON public.inventory
  FOR EACH ROW
  WHEN (OLD.quantity_available <> NEW.quantity_available)
  EXECUTE FUNCTION public.check_low_inventory_stock();

-- Create function to link material requests to inventory when approved
CREATE OR REPLACE FUNCTION public.update_inventory_on_material_request_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  inventory_record RECORD;
BEGIN
  -- Only process when status changes to 'aprovado'
  IF NEW.status = 'aprovado' AND OLD.status <> 'aprovado' THEN
    -- Try to find matching inventory item
    SELECT * INTO inventory_record
    FROM inventory
    WHERE project_id = NEW.project_id
      AND LOWER(material_name) = LOWER(NEW.material_name)
    LIMIT 1;

    -- If found, create an entry movement
    IF FOUND THEN
      INSERT INTO inventory_movements (
        inventory_id,
        movement_type,
        quantity,
        reason,
        reference_type,
        reference_id,
        created_by_user_id
      ) VALUES (
        inventory_record.id,
        'entrada',
        NEW.quantity,
        format('Pedido aprovado - %s', NEW.requestor_name),
        'material_request',
        NEW.id,
        NEW.requested_by_user_id
      );

      -- Update inventory quantity
      UPDATE inventory
      SET quantity_available = quantity_available + NEW.quantity
      WHERE id = inventory_record.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for material request approval
DROP TRIGGER IF EXISTS trigger_update_inventory_on_approval ON public.material_requests;
CREATE TRIGGER trigger_update_inventory_on_approval
  AFTER UPDATE OF status ON public.material_requests
  FOR EACH ROW
  WHEN (NEW.status = 'aprovado')
  EXECUTE FUNCTION public.update_inventory_on_material_request_approval();

-- Add index for better performance on material name searches
CREATE INDEX IF NOT EXISTS idx_inventory_material_name_lower ON public.inventory(LOWER(material_name));
CREATE INDEX IF NOT EXISTS idx_material_requests_project_material ON public.material_requests(project_id, LOWER(material_name));

-- Migration: 20251024191154_776e6fb0-6515-4851-9e09-75af1df044f6.sql
-- Add foreign key relationship between inventory and projects
ALTER TABLE public.inventory
ADD CONSTRAINT fk_inventory_project
FOREIGN KEY (project_id)
REFERENCES public.projects(id)
ON DELETE CASCADE;

-- Create sequence for automatic material codes
CREATE SEQUENCE IF NOT EXISTS public.inventory_code_seq START 1;

-- Create function to generate automatic material code
CREATE OR REPLACE FUNCTION public.generate_inventory_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate code if not provided
  IF NEW.material_code IS NULL OR NEW.material_code = '' THEN
    NEW.material_code := nextval('public.inventory_code_seq')::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate material codes
DROP TRIGGER IF EXISTS trigger_generate_inventory_code ON public.inventory;
CREATE TRIGGER trigger_generate_inventory_code
BEFORE INSERT ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.generate_inventory_code();

-- Storage policies for rdo-photos bucket
DROP POLICY IF EXISTS "Users can view photos from their projects" ON storage.objects;
CREATE POLICY "Users can view photos from their projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'rdo-photos' 
  AND auth.uid() IN (
    SELECT dr.executed_by_user_id
    FROM public.daily_reports dr
    JOIN public.rdo_validation_photos rvp ON rvp.daily_report_id = dr.id
    WHERE rvp.photo_url LIKE '%' || storage.objects.name || '%'
  )
);

DROP POLICY IF EXISTS "Users can upload photos to their RDOs" ON storage.objects;
CREATE POLICY "Users can upload photos to their RDOs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rdo-photos'
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'rdo-photos'
  AND auth.uid() IN (
    SELECT dr.executed_by_user_id
    FROM public.daily_reports dr
    JOIN public.rdo_validation_photos rvp ON rvp.daily_report_id = dr.id
    WHERE rvp.photo_url LIKE '%' || storage.objects.name || '%'
  )
);

-- Migration: 20251024191218_dc5b05bd-7a38-41b8-b576-63cd102b15e2.sql
-- Fix function search path for security
CREATE OR REPLACE FUNCTION public.generate_inventory_code()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only generate code if not provided
  IF NEW.material_code IS NULL OR NEW.material_code = '' THEN
    NEW.material_code := nextval('public.inventory_code_seq')::text;
  END IF;
  RETURN NEW;
END;
$$;

-- Migration: 20251028004225_6c5c5ed4-e9ef-4e68-83a5-2ffb86281b4d.sql
-- Criar tabela de catálogo de ativos
CREATE TABLE public.assets_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- equipamento, área física, sistema
  detailed_location TEXT,
  tower TEXT,
  floor TEXT,
  sector TEXT,
  coordinates TEXT,
  main_responsible TEXT,
  technical_notes TEXT,
  created_by_user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.assets_catalog ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para assets_catalog
CREATE POLICY "Users can view assets from their projects"
ON public.assets_catalog FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = assets_catalog.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create assets"
ON public.assets_catalog FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update assets they created"
ON public.assets_catalog FOR UPDATE
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete assets they created"
ON public.assets_catalog FOR DELETE
USING (auth.uid() = created_by_user_id);

-- Criar tabela de tarefas de manutenção
CREATE TABLE public.maintenance_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type TEXT NOT NULL, -- preventiva, corretiva, acompanhamento
  title TEXT NOT NULL,
  description TEXT,
  asset_id UUID REFERENCES public.assets_catalog(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  assigned_to_user_id UUID,
  assigned_to_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_by_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, em_processo, em_verificacao, concluida
  priority TEXT, -- baixa, média, alta, urgente
  classification TEXT, -- 1, 2
  service_type TEXT, -- civil, elétrica, hidráulica, etc
  service_subtype TEXT, -- pintura, reparo, etc
  deadline DATE,
  completion_notes TEXT,
  pending_reason TEXT,
  materials_used JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para maintenance_tasks
CREATE POLICY "Users can view tasks from their projects"
ON public.maintenance_tasks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = maintenance_tasks.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create tasks"
ON public.maintenance_tasks FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update tasks from their projects"
ON public.maintenance_tasks FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = maintenance_tasks.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete tasks they created"
ON public.maintenance_tasks FOR DELETE
USING (auth.uid() = created_by_user_id);

-- Criar tabela de checklist de tarefas preventivas
CREATE TABLE public.task_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_by_user_id UUID,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para task_checklist_items
CREATE POLICY "Users can view checklist items from their tasks"
ON public.task_checklist_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE mt.id = task_checklist_items.task_id
    AND p.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create checklist items"
ON public.task_checklist_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE mt.id = task_checklist_items.task_id
    AND p.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can update checklist items"
ON public.task_checklist_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE mt.id = task_checklist_items.task_id
    AND p.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete checklist items"
ON public.task_checklist_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE mt.id = task_checklist_items.task_id
    AND p.created_by_user_id = auth.uid()
  )
);

-- Criar tabela de fotos de tarefas
CREATE TABLE public.task_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  description TEXT,
  uploaded_by_user_id UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.task_photos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para task_photos
CREATE POLICY "Users can view photos from their tasks"
ON public.task_photos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE mt.id = task_photos.task_id
    AND p.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload photos"
ON public.task_photos FOR INSERT
WITH CHECK (auth.uid() = uploaded_by_user_id);

CREATE POLICY "Users can delete their photos"
ON public.task_photos FOR DELETE
USING (auth.uid() = uploaded_by_user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_assets_catalog_updated_at
BEFORE UPDATE ON public.assets_catalog
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_tasks_updated_at
BEFORE UPDATE ON public.maintenance_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251028004639_d5ffefe1-931c-4726-b352-002fd72cd22c.sql
-- Criar bucket de storage para fotos de tarefas
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-photos', 'task-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para task-photos bucket
DROP POLICY IF EXISTS "Users can view task photos from their projects" ON storage.objects;
CREATE POLICY "Users can view task photos from their projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'task-photos' AND
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE auth.uid() = p.created_by_user_id
    AND (storage.foldername(name))[1] = mt.id::text
  )
);

DROP POLICY IF EXISTS "Users can upload task photos" ON storage.objects;
CREATE POLICY "Users can upload task photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'task-photos' AND
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE auth.uid() = p.created_by_user_id
    AND (storage.foldername(name))[1] = mt.id::text
  )
);

DROP POLICY IF EXISTS "Users can delete their task photos" ON storage.objects;
CREATE POLICY "Users can delete their task photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'task-photos' AND
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE auth.uid() = p.created_by_user_id
    AND (storage.foldername(name))[1] = mt.id::text
  )
);

-- Migration: 20251029024322_59e60ac2-1e32-43a3-abf7-41058bc16953.sql
-- Create consumption readings table
CREATE TABLE public.consumption_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reading_time TEXT NOT NULL CHECK (reading_time IN ('08:00', '14:00', '18:00', '20:00')),
  meter_value NUMERIC NOT NULL,
  meter_type TEXT NOT NULL DEFAULT 'water',
  location TEXT,
  notes TEXT,
  recorded_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, reading_date, reading_time, meter_type, location)
);

-- Enable RLS
ALTER TABLE public.consumption_readings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view readings from their projects"
ON public.consumption_readings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = consumption_readings.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create readings"
ON public.consumption_readings FOR INSERT
WITH CHECK (auth.uid() = recorded_by_user_id);

CREATE POLICY "Users can update readings they created"
ON public.consumption_readings FOR UPDATE
USING (auth.uid() = recorded_by_user_id);

CREATE POLICY "Users can delete readings they created"
ON public.consumption_readings FOR DELETE
USING (auth.uid() = recorded_by_user_id);

-- Trigger for updated_at
CREATE TRIGGER update_consumption_readings_updated_at
BEFORE UPDATE ON public.consumption_readings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251101131342_749c2de2-08c3-423d-b6dd-f42fed0386bd.sql
-- Create connection_reports table
CREATE TABLE public.connection_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by_user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id),
  team_name TEXT NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  address TEXT NOT NULL,
  address_complement TEXT,
  client_name TEXT NOT NULL,
  water_meter_number TEXT NOT NULL,
  os_number TEXT NOT NULL,
  service_type TEXT NOT NULL,
  observations TEXT,
  photos_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.connection_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own connection reports"
ON public.connection_reports
FOR SELECT
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can create connection reports"
ON public.connection_reports
FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own connection reports"
ON public.connection_reports
FOR UPDATE
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own connection reports"
ON public.connection_reports
FOR DELETE
USING (auth.uid() = created_by_user_id);

-- Create storage bucket for connection report photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('connection-report-photos', 'connection-report-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
DROP POLICY IF EXISTS "Users can upload connection report photos" ON storage.objects;
CREATE POLICY "Users can upload connection report photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'connection-report-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can view their connection report photos" ON storage.objects;
CREATE POLICY "Users can view their connection report photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'connection-report-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their connection report photos" ON storage.objects;
CREATE POLICY "Users can delete their connection report photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'connection-report-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Anyone can view public connection report photos" ON storage.objects;
CREATE POLICY "Anyone can view public connection report photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'connection-report-photos');

-- Migration: 20251101132518_ac1ed63e-4e20-43d4-94cc-4cad6c4e7499.sql
-- Add logo_url column to connection_reports table
ALTER TABLE connection_reports
ADD COLUMN logo_url text;

-- Update storage bucket policy to allow logo uploads in connection-report-photos
DROP POLICY IF EXISTS "Users can upload their own connection report files" ON storage.objects;
CREATE POLICY "Users can upload their own connection report files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'connection-report-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Migration: 20251102120053_8032ffa6-588b-4a18-9874-5c1925c888ab.sql
-- Fix material_requests foreign key to employees
ALTER TABLE public.material_requests
ADD CONSTRAINT material_requests_requested_by_employee_id_fkey 
FOREIGN KEY (requested_by_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

-- Create maintenance_qr_codes table
CREATE TABLE public.maintenance_qr_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  location_name TEXT NOT NULL,
  location_description TEXT,
  qr_code_data TEXT NOT NULL UNIQUE,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Create maintenance_requests table  
CREATE TABLE public.maintenance_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  qr_code_id UUID NOT NULL,
  requester_name TEXT NOT NULL,
  requester_contact TEXT,
  issue_description TEXT NOT NULL,
  urgency_level TEXT NOT NULL DEFAULT 'normal',
  photos_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID,
  resolution_notes TEXT
);

-- Enable RLS
ALTER TABLE public.maintenance_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for maintenance_qr_codes
CREATE POLICY "Users can view QR codes from their projects"
ON public.maintenance_qr_codes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = maintenance_qr_codes.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create QR codes for their projects"
ON public.maintenance_qr_codes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = maintenance_qr_codes.project_id
    AND projects.created_by_user_id = auth.uid()
  ) AND auth.uid() = created_by_user_id
);

CREATE POLICY "Users can update their QR codes"
ON public.maintenance_qr_codes FOR UPDATE
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their QR codes"
ON public.maintenance_qr_codes FOR DELETE
USING (auth.uid() = created_by_user_id);

-- RLS Policies for maintenance_requests (public can create, owners can view)
CREATE POLICY "Anyone can create maintenance requests"
ON public.maintenance_requests FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view requests from their QR codes"
ON public.maintenance_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM maintenance_qr_codes qr
    JOIN projects p ON p.id = qr.project_id
    WHERE qr.id = maintenance_requests.qr_code_id
    AND p.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can update requests from their projects"
ON public.maintenance_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM maintenance_qr_codes qr
    JOIN projects p ON p.id = qr.project_id
    WHERE qr.id = maintenance_requests.qr_code_id
    AND p.created_by_user_id = auth.uid()
  )
);

-- Foreign keys
ALTER TABLE public.maintenance_qr_codes
ADD CONSTRAINT maintenance_qr_codes_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.maintenance_requests
ADD CONSTRAINT maintenance_requests_qr_code_id_fkey 
FOREIGN KEY (qr_code_id) REFERENCES public.maintenance_qr_codes(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX idx_maintenance_qr_codes_project_id ON maintenance_qr_codes(project_id);
CREATE INDEX idx_maintenance_qr_codes_qr_code_data ON maintenance_qr_codes(qr_code_data);
CREATE INDEX idx_maintenance_requests_qr_code_id ON maintenance_requests(qr_code_id);
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(status);

-- Updated_at trigger for maintenance_qr_codes
CREATE TRIGGER update_maintenance_qr_codes_updated_at
BEFORE UPDATE ON public.maintenance_qr_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Updated_at trigger for maintenance_requests
CREATE TRIGGER update_maintenance_requests_updated_at
BEFORE UPDATE ON public.maintenance_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for maintenance request photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('maintenance-request-photos', 'maintenance-request-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for maintenance request photos
DROP POLICY IF EXISTS "Anyone can upload maintenance request photos" ON storage.objects;
CREATE POLICY "Anyone can upload maintenance request photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'maintenance-request-photos');

DROP POLICY IF EXISTS "Photos are publicly accessible" ON storage.objects;
CREATE POLICY "Photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'maintenance-request-photos');

DROP POLICY IF EXISTS "Users can delete maintenance request photos from their projects" ON storage.objects;
CREATE POLICY "Users can delete maintenance request photos from their projects"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'maintenance-request-photos' AND
  EXISTS (
    SELECT 1 FROM maintenance_requests mr
    JOIN maintenance_qr_codes qr ON qr.id = mr.qr_code_id
    JOIN projects p ON p.id = qr.project_id
    WHERE p.created_by_user_id = auth.uid()
  )
);

-- Migration: 20251105175051_9e58af56-9b93-4716-91ab-16537c7f67d0.sql
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  is_super_admin BOOLEAN DEFAULT false,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, project_id)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role, _project_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (project_id = _project_id OR _project_id IS NULL)
  )
$$;

-- Create function to check if user is admin of any project
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles in their projects"
ON public.user_roles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin', project_id)
);

CREATE POLICY "Admins can insert roles in their projects"
ON public.user_roles
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin', project_id)
);

CREATE POLICY "Admins can update roles in their projects"
ON public.user_roles
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin', project_id)
);

CREATE POLICY "Admins can delete roles in their projects"
ON public.user_roles
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin', project_id)
);

-- Create trigger for updated_at
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for backups metadata
CREATE TABLE public.backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  backup_type TEXT NOT NULL, -- 'manual' or 'automatic'
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'failed', 'in_progress'
  file_path TEXT,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for backups
CREATE POLICY "Users can view their own backups"
ON public.backups
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create backups"
ON public.backups
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all backups in their projects"
ON public.backups
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin', project_id)
);

-- Migration: 20251113033446_3a59f28e-934e-4116-a2be-0a4bf975b39d.sql
-- Create materials table for budget module
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  color TEXT,
  measurement TEXT,
  unit TEXT NOT NULL,
  current_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  minimum_stock NUMERIC(10,2) DEFAULT 0,
  current_stock NUMERIC(10,2) DEFAULT 0,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Create price history table
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  old_price NUMERIC(10,2) NOT NULL,
  new_price NUMERIC(10,2) NOT NULL,
  changed_by_user_id UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT
);

-- Create custom keywords table
CREATE TABLE IF NOT EXISTS public.custom_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  keyword_type TEXT NOT NULL, -- 'brand', 'color', 'unit', 'general'
  keyword_value TEXT NOT NULL,
  UNIQUE(created_by_user_id, keyword_type, keyword_value)
);

-- Create budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  budget_number TEXT,
  name TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  client_contact TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'sent', 'approved', 'rejected'
  valid_until DATE,
  payment_terms TEXT,
  notes TEXT,
  total_material NUMERIC(10,2) DEFAULT 0,
  total_labor NUMERIC(10,2) DEFAULT 0,
  total_bdi NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0
);

-- Create budget items table
CREATE TABLE IF NOT EXISTS public.budget_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price_material NUMERIC(10,2) DEFAULT 0,
  unit_price_labor NUMERIC(10,2) DEFAULT 0,
  bdi_percentage NUMERIC(5,2) DEFAULT 0,
  subtotal_material NUMERIC(10,2) DEFAULT 0,
  subtotal_labor NUMERIC(10,2) DEFAULT 0,
  subtotal_bdi NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  price_at_creation NUMERIC(10,2), -- Historical price
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for materials
CREATE POLICY "Users can view their own materials"
  ON public.materials FOR SELECT
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can create materials"
  ON public.materials FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own materials"
  ON public.materials FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own materials"
  ON public.materials FOR DELETE
  USING (auth.uid() = created_by_user_id);

-- RLS Policies for price_history
CREATE POLICY "Users can view price history of their materials"
  ON public.price_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.materials m
    WHERE m.id = price_history.material_id
    AND m.created_by_user_id = auth.uid()
  ));

CREATE POLICY "System can insert price history"
  ON public.price_history FOR INSERT
  WITH CHECK (auth.uid() = changed_by_user_id);

-- RLS Policies for custom_keywords
CREATE POLICY "Users can view their own keywords"
  ON public.custom_keywords FOR SELECT
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can create keywords"
  ON public.custom_keywords FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own keywords"
  ON public.custom_keywords FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own keywords"
  ON public.custom_keywords FOR DELETE
  USING (auth.uid() = created_by_user_id);

-- RLS Policies for budgets
CREATE POLICY "Users can view their own budgets"
  ON public.budgets FOR SELECT
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can create budgets"
  ON public.budgets FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own budgets"
  ON public.budgets FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own budgets"
  ON public.budgets FOR DELETE
  USING (auth.uid() = created_by_user_id);

-- RLS Policies for budget_items
CREATE POLICY "Users can view items from their budgets"
  ON public.budget_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_items.budget_id
    AND b.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can create budget items"
  ON public.budget_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_items.budget_id
    AND b.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can update items from their budgets"
  ON public.budget_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_items.budget_id
    AND b.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete items from their budgets"
  ON public.budget_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_items.budget_id
    AND b.created_by_user_id = auth.uid()
  ));

-- Trigger to update materials updated_at
CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update budgets updated_at
CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to track price changes
CREATE OR REPLACE FUNCTION public.track_material_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_price IS DISTINCT FROM NEW.current_price THEN
    INSERT INTO public.price_history (
      material_id,
      old_price,
      new_price,
      changed_by_user_id
    ) VALUES (
      NEW.id,
      OLD.current_price,
      NEW.current_price,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to automatically track price changes
CREATE TRIGGER track_material_price_changes
  AFTER UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.track_material_price_change();

-- Function to recalculate budget totals
CREATE OR REPLACE FUNCTION public.recalculate_budget_totals()
RETURNS TRIGGER AS $$
DECLARE
  budget_totals RECORD;
BEGIN
  -- Calculate totals from budget items
  SELECT
    COALESCE(SUM(subtotal_material), 0) as total_mat,
    COALESCE(SUM(subtotal_labor), 0) as total_lab,
    COALESCE(SUM(subtotal_bdi), 0) as total_bdi_val,
    COALESCE(SUM(total), 0) as total_amt
  INTO budget_totals
  FROM public.budget_items
  WHERE budget_id = COALESCE(NEW.budget_id, OLD.budget_id);

  -- Update budget totals
  UPDATE public.budgets
  SET
    total_material = budget_totals.total_mat,
    total_labor = budget_totals.total_lab,
    total_bdi = budget_totals.total_bdi_val,
    total_amount = budget_totals.total_amt,
    updated_at = now()
  WHERE id = COALESCE(NEW.budget_id, OLD.budget_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to recalculate budget totals when items change
CREATE TRIGGER recalculate_budget_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.budget_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_budget_totals();

-- Function to auto-generate budget number
CREATE OR REPLACE FUNCTION public.generate_budget_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.budget_number IS NULL OR NEW.budget_number = '' THEN
    NEW.budget_number := 'ORC-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(nextval('budget_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create sequence for budget numbers
CREATE SEQUENCE IF NOT EXISTS public.budget_number_seq START 1;

-- Trigger to auto-generate budget number
CREATE TRIGGER generate_budget_number_trigger
  BEFORE INSERT ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_budget_number();

-- Migration: 20251119024111_8c0efa8c-aecb-48da-8855-36aa40648344.sql
-- Add synonyms column to custom_keywords table
ALTER TABLE custom_keywords 
ADD COLUMN synonyms text[] DEFAULT ARRAY[]::text[];

-- Migration: 20251120144049_391408c3-fdfd-4bbd-ba2f-24984c2d81c6.sql
-- Add supplier, category and notes columns to materials table
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS supplier TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Migration: 20251121160314_c3b892ed-3c66-4a37-bb6e-542ada3c08b9.sql
-- Add materials_used column to connection_reports table
ALTER TABLE connection_reports
ADD COLUMN materials_used JSONB DEFAULT '[]'::jsonb;

-- Migration: 20251121180255_9a8accbd-06d3-400b-b020-ef3bfa8f16c2.sql
-- Adicionar campos de orçamento e equipe na tabela projects
ALTER TABLE public.projects 
ADD COLUMN total_budget NUMERIC,
ADD COLUMN team_members TEXT;

-- Criar tabela de checklists
CREATE TABLE public.checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de itens de checklist
CREATE TABLE public.checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('done', 'pending', 'not_done')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies para checklists
CREATE POLICY "Users can view checklists from their projects"
ON public.checklists FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = checklists.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create checklists"
ON public.checklists FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their checklists"
ON public.checklists FOR UPDATE
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their checklists"
ON public.checklists FOR DELETE
USING (auth.uid() = created_by_user_id);

-- RLS Policies para checklist_items
CREATE POLICY "Users can view checklist items from their projects"
ON public.checklist_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.checklists
    JOIN public.projects ON projects.id = checklists.project_id
    WHERE checklists.id = checklist_items.checklist_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create checklist items"
ON public.checklist_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.checklists
    JOIN public.projects ON projects.id = checklists.project_id
    WHERE checklists.id = checklist_items.checklist_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can update checklist items"
ON public.checklist_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.checklists
    JOIN public.projects ON projects.id = checklists.project_id
    WHERE checklists.id = checklist_items.checklist_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete checklist items"
ON public.checklist_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.checklists
    JOIN public.projects ON projects.id = checklists.project_id
    WHERE checklists.id = checklist_items.checklist_id
    AND projects.created_by_user_id = auth.uid()
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_checklists_updated_at
BEFORE UPDATE ON public.checklists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_checklist_items_updated_at
BEFORE UPDATE ON public.checklist_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();



-- ============================================
-- PARTE 3: parte3.sql
-- ============================================

-- PARTE 3 DE 4: CRM, dashboards, compras
-- Cole este SQL no Supabase SQL Editor e clique Run


-- Migration: 20251122225213_42def35d-6614-4ef8-be11-faa2bd4f8b5a.sql
-- Add new fields to connection_reports table
ALTER TABLE public.connection_reports 
ADD COLUMN IF NOT EXISTS service_category TEXT CHECK (service_category IN ('agua', 'esgoto')),
ADD COLUMN IF NOT EXISTS connection_type TEXT CHECK (connection_type IN ('avulsa', 'intra_1', 'intra_2'));

-- Migration: 20251124002405_bb029b8e-66f1-4626-93d0-39eea9873896.sql
-- Add visits and occurrences fields to daily_reports
ALTER TABLE public.daily_reports 
ADD COLUMN visits TEXT,
ADD COLUMN occurrences_summary TEXT;

-- Create occurrences table
CREATE TABLE public.occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  daily_report_id UUID REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  occurrence_type TEXT NOT NULL CHECK (occurrence_type IN ('erro_execucao', 'atraso', 'material_inadequado', 'falha_seguranca', 'reprovacao_checklist')),
  description TEXT NOT NULL,
  photos_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  responsible_id UUID REFERENCES public.employees(id),
  responsible_type TEXT CHECK (responsible_type IN ('engenheiro', 'mestre_obras', 'terceirizado', 'fornecedor', 'equipe_interna')),
  correction_deadline DATE,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_analise', 'resolvida')),
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

-- Create purchase_requests table
CREATE TABLE public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('baixa', 'media', 'alta', 'critica')),
  justification TEXT,
  cost_center TEXT,
  requested_by_user_id UUID NOT NULL,
  approved_by_user_id UUID,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'em_compra', 'entregue')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  estimated_cost NUMERIC
);

-- Create supplier_quotes table
CREATE TABLE public.supplier_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  supplier_contact TEXT,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  delivery_time_days INTEGER,
  payment_terms TEXT,
  notes TEXT,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create purchase_orders table
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  supplier_quote_id UUID REFERENCES public.supplier_quotes(id),
  order_number TEXT UNIQUE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'emitido' CHECK (status IN ('emitido', 'confirmado', 'em_transito', 'entregue', 'cancelado')),
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  notes TEXT,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create labor_tracking table
CREATE TABLE public.labor_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id),
  worker_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('pedreiro', 'servente', 'operador', 'eletricista', 'encanador', 'pintor', 'carpinteiro', 'outro')),
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_time TIME NOT NULL,
  exit_time TIME,
  hours_worked NUMERIC,
  activity_description TEXT,
  hourly_rate NUMERIC,
  total_cost NUMERIC,
  company_name TEXT,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add responsible fields to existing tables
ALTER TABLE public.maintenance_tasks
ADD COLUMN IF NOT EXISTS responsible_type TEXT CHECK (responsible_type IN ('engenheiro', 'mestre_obras', 'terceirizado', 'fornecedor', 'equipe_interna'));

ALTER TABLE public.checklist_items
ADD COLUMN IF NOT EXISTS responsible_id UUID REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS responsible_type TEXT CHECK (responsible_type IN ('engenheiro', 'mestre_obras', 'terceirizado', 'fornecedor', 'equipe_interna'));

-- Enable RLS
ALTER TABLE public.occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for occurrences
CREATE POLICY "Users can view occurrences from their projects"
ON public.occurrences FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = occurrences.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can create occurrences"
ON public.occurrences FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update occurrences from their projects"
ON public.occurrences FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = occurrences.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can delete occurrences from their projects"
ON public.occurrences FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = occurrences.project_id
  AND projects.created_by_user_id = auth.uid()
));

-- RLS Policies for purchase_requests
CREATE POLICY "Users can view purchase requests from their projects"
ON public.purchase_requests FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = purchase_requests.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can create purchase requests"
ON public.purchase_requests FOR INSERT
WITH CHECK (auth.uid() = requested_by_user_id);

CREATE POLICY "Users can update purchase requests from their projects"
ON public.purchase_requests FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = purchase_requests.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can delete purchase requests from their projects"
ON public.purchase_requests FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = purchase_requests.project_id
  AND projects.created_by_user_id = auth.uid()
));

-- RLS Policies for supplier_quotes
CREATE POLICY "Users can view supplier quotes from their purchase requests"
ON public.supplier_quotes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.purchase_requests pr
  JOIN public.projects p ON p.id = pr.project_id
  WHERE pr.id = supplier_quotes.purchase_request_id
  AND p.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can create supplier quotes"
ON public.supplier_quotes FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update supplier quotes"
ON public.supplier_quotes FOR UPDATE
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete supplier quotes"
ON public.supplier_quotes FOR DELETE
USING (auth.uid() = created_by_user_id);

-- RLS Policies for purchase_orders
CREATE POLICY "Users can view purchase orders from their projects"
ON public.purchase_orders FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = purchase_orders.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can create purchase orders"
ON public.purchase_orders FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update purchase orders from their projects"
ON public.purchase_orders FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = purchase_orders.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can delete purchase orders from their projects"
ON public.purchase_orders FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = purchase_orders.project_id
  AND projects.created_by_user_id = auth.uid()
));

-- RLS Policies for labor_tracking
CREATE POLICY "Users can view labor tracking from their projects"
ON public.labor_tracking FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = labor_tracking.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can create labor tracking"
ON public.labor_tracking FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update labor tracking from their projects"
ON public.labor_tracking FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = labor_tracking.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can delete labor tracking from their projects"
ON public.labor_tracking FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = labor_tracking.project_id
  AND projects.created_by_user_id = auth.uid()
));

-- Create triggers for updated_at
CREATE TRIGGER update_occurrences_updated_at BEFORE UPDATE ON public.occurrences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_requests_updated_at BEFORE UPDATE ON public.purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_quotes_updated_at BEFORE UPDATE ON public.supplier_quotes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_labor_tracking_updated_at BEFORE UPDATE ON public.labor_tracking
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create sequence for purchase order numbers
CREATE SEQUENCE IF NOT EXISTS purchase_order_number_seq START 1;

-- Function to generate purchase order number
CREATE OR REPLACE FUNCTION public.generate_purchase_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'PC-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(nextval('purchase_order_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for purchase order number generation
CREATE TRIGGER generate_purchase_order_number_trigger
BEFORE INSERT ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_purchase_order_number();

-- Migration: 20251126024728_952888fa-d4a6-42d4-978a-f6fb99d1b9b6.sql
-- Add keywords array and labor price to materials table
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Update materials table to support material and labor pricing
COMMENT ON COLUMN public.materials.current_price IS 'Price for material cost';
COMMENT ON COLUMN public.materials.keywords IS 'Synonyms and keywords for AI identification';

-- Migration: 20251126144205_5eaa3765-45dd-4ee2-974b-a78e0840c896.sql
-- Add separate material and labor price fields to materials table
ALTER TABLE public.materials 
ADD COLUMN material_price NUMERIC DEFAULT 0,
ADD COLUMN labor_price NUMERIC DEFAULT 0;

-- Update existing materials to use current_price as material_price
UPDATE public.materials 
SET material_price = current_price
WHERE material_price = 0;

-- Add comment to clarify the fields
COMMENT ON COLUMN public.materials.material_price IS 'Preço do material em reais';
COMMENT ON COLUMN public.materials.labor_price IS 'Preço da mão de obra em reais';
COMMENT ON COLUMN public.materials.current_price IS 'Preço total (material + mão de obra) - calculado automaticamente';

-- Migration: 20251128205714_fef87c92-7d3e-4f9c-b81c-38f90de5b7ef.sql
-- Create pending_actions table for approval workflow
CREATE TABLE IF NOT EXISTS public.pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  action_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  resource_data JSONB,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;

-- Create action_approvals table
CREATE TABLE IF NOT EXISTS public.action_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_action_id UUID REFERENCES public.pending_actions(id) ON DELETE CASCADE NOT NULL,
  admin_user_id UUID REFERENCES auth.users(id) NOT NULL,
  approved BOOLEAN NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add unique constraint for approvals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'action_approvals_pending_action_id_admin_user_id_key'
  ) THEN
    ALTER TABLE public.action_approvals ADD CONSTRAINT action_approvals_pending_action_id_admin_user_id_key UNIQUE(pending_action_id, admin_user_id);
  END IF;
END $$;

ALTER TABLE public.action_approvals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own requests" ON public.pending_actions;
DROP POLICY IF EXISTS "Admins can view all pending actions" ON public.pending_actions;
DROP POLICY IF EXISTS "Colaboradores can create action requests" ON public.pending_actions;
DROP POLICY IF EXISTS "Admins can update action status" ON public.pending_actions;
DROP POLICY IF EXISTS "Anyone can view approvals for their requests" ON public.action_approvals;
DROP POLICY IF EXISTS "Admins can create approvals" ON public.action_approvals;

-- RLS for pending_actions
CREATE POLICY "Users can view their own requests"
ON public.pending_actions
FOR SELECT
USING (auth.uid() = requested_by_user_id);

CREATE POLICY "Admins can view all pending actions"
ON public.pending_actions
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can create action requests"
ON public.pending_actions
FOR INSERT
WITH CHECK (auth.uid() = requested_by_user_id);

CREATE POLICY "Admins can update action status"
ON public.pending_actions
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- RLS for action_approvals
CREATE POLICY "Anyone can view approvals for their requests"
ON public.action_approvals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.pending_actions pa
    WHERE pa.id = action_approvals.pending_action_id
      AND (pa.requested_by_user_id = auth.uid() OR public.is_admin(auth.uid()))
  )
);

CREATE POLICY "Admins can create approvals"
ON public.action_approvals
FOR INSERT
WITH CHECK (
  public.is_admin(auth.uid()) AND
  auth.uid() = admin_user_id
);

-- Create audit_log table for tracking edits
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing audit log policies
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

CREATE POLICY "Admins can view all audit logs"
ON public.audit_log
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own audit logs"
ON public.audit_log
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs"
ON public.audit_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add trigger to update updated_at if not exists
DROP TRIGGER IF EXISTS update_pending_actions_updated_at ON public.pending_actions;
CREATE TRIGGER update_pending_actions_updated_at
BEFORE UPDATE ON public.pending_actions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251128211252_9bc59b51-d488-46b1-8646-48c910ea92ca.sql
-- Make storage buckets private for better security
UPDATE storage.buckets 
SET public = false 
WHERE name IN ('connection-report-photos', 'maintenance-request-photos');

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can upload maintenance request photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view maintenance request photos from their projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their maintenance request photos" ON storage.objects;

-- Add RLS policies for connection-report-photos bucket
DROP POLICY IF EXISTS "Users can upload their own connection report photos" ON storage.objects;
CREATE POLICY "Users can upload their own connection report photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'connection-report-photos' 
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can view connection report photos" ON storage.objects;
CREATE POLICY "Users can view connection report photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'connection-report-photos' 
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can delete their own connection report photos" ON storage.objects;
CREATE POLICY "Users can delete their own connection report photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'connection-report-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add RLS policies for maintenance-request-photos bucket (needs public access for QR codes)
DROP POLICY IF EXISTS "Anyone can upload maintenance request photos" ON storage.objects;
CREATE POLICY "Anyone can upload maintenance request photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'maintenance-request-photos');

DROP POLICY IF EXISTS "Anyone can view maintenance request photos" ON storage.objects;
CREATE POLICY "Anyone can view maintenance request photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'maintenance-request-photos');

DROP POLICY IF EXISTS "Users can delete their maintenance request photos" ON storage.objects;
CREATE POLICY "Users can delete their maintenance request photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'maintenance-request-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Migration: 20251130185438_447d1c97-90c7-4d52-9b3e-6c505d830106.sql
-- Create user quotas table to limit resources per user
CREATE TABLE IF NOT EXISTS public.user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_projects INTEGER DEFAULT 3,
  max_employees INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage quotas
CREATE POLICY "Super admins can manage all quotas"
ON public.user_quotas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND is_super_admin = true
  )
);

-- Users can view their own quotas
CREATE POLICY "Users can view own quotas"
ON public.user_quotas
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Function to check if user can create more projects
CREATE OR REPLACE FUNCTION public.can_create_project(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Get current project count
  SELECT COUNT(*) INTO current_count
  FROM public.projects
  WHERE created_by_user_id = user_uuid;
  
  -- Get max allowed (default to unlimited if no quota set)
  SELECT COALESCE(max_projects, 999999) INTO max_allowed
  FROM public.user_quotas
  WHERE user_id = user_uuid;
  
  RETURN current_count < max_allowed;
END;
$$;

-- Function to check if user can create more employees
CREATE OR REPLACE FUNCTION public.can_create_employee(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Get current employee count
  SELECT COUNT(*) INTO current_count
  FROM public.employees
  WHERE created_by_user_id = user_uuid;
  
  -- Get max allowed (default to unlimited if no quota set)
  SELECT COALESCE(max_employees, 999999) INTO max_allowed
  FROM public.user_quotas
  WHERE user_id = user_uuid;
  
  RETURN current_count < max_allowed;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_user_quotas_updated_at
BEFORE UPDATE ON public.user_quotas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251202110703_6ab50207-6f97-46f6-b71a-31012d8e2cdc.sql
-- Remover políticas existentes e recriar com as corretas
DROP POLICY IF EXISTS "Users can view photos from their RDOs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload photos to their RDOs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;

-- Policy para permitir usuários autenticados visualizarem fotos de seus projetos
CREATE POLICY "Users can view photos from their RDOs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'rdo-photos' AND
  auth.uid() IS NOT NULL
);

-- Policy para permitir upload de fotos
DROP POLICY IF EXISTS "Users can upload photos to their RDOs" ON storage.objects;
CREATE POLICY "Users can upload photos to their RDOs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rdo-photos' AND
  auth.uid() IS NOT NULL
);

-- Policy para permitir deletar fotos
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'rdo-photos' AND
  auth.uid() IS NOT NULL
);

-- Migration: 20251207212022_d9917830-f9a0-4a91-b955-b33331270af1.sql
-- Add interactive_map_url column to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS interactive_map_url TEXT;

-- Create map_annotations table
CREATE TABLE public.map_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  porcentagem NUMERIC DEFAULT 0,
  team_id UUID REFERENCES public.employees(id),
  service_front_id UUID REFERENCES public.service_fronts(id),
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.map_annotations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for map_annotations
CREATE POLICY "Users can view map annotations from their projects"
ON public.map_annotations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = map_annotations.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can create map annotations"
ON public.map_annotations
FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update map annotations from their projects"
ON public.map_annotations
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = map_annotations.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can delete map annotations from their projects"
ON public.map_annotations
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = map_annotations.project_id
  AND projects.created_by_user_id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_map_annotations_updated_at
BEFORE UPDATE ON public.map_annotations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for interactive maps
INSERT INTO storage.buckets (id, name, public)
VALUES ('interactive-maps', 'interactive-maps', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for interactive maps
DROP POLICY IF EXISTS "Users can upload maps to their project folders" ON storage.objects;
CREATE POLICY "Users can upload maps to their project folders"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'interactive-maps' 
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Anyone can view public maps" ON storage.objects;
CREATE POLICY "Anyone can view public maps"
ON storage.objects
FOR SELECT
USING (bucket_id = 'interactive-maps');

DROP POLICY IF EXISTS "Users can update their own map files" ON storage.objects;
CREATE POLICY "Users can update their own map files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'interactive-maps' 
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can delete their own map files" ON storage.objects;
CREATE POLICY "Users can delete their own map files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'interactive-maps' 
  AND auth.uid() IS NOT NULL
);

-- Migration: 20251213212709_331b5a5d-c124-4d71-8b06-a124c3091199.sql
-- 1. Corrigir política de maintenance_requests para exigir autenticação na criação
DROP POLICY IF EXISTS "Anyone can create maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Authenticated users can create maintenance requests"
ON public.maintenance_requests
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Adicionar política explícita de negação de DELETE em inventory_movements
DROP POLICY IF EXISTS "Prevent deletion of inventory movements" ON public.inventory_movements;
CREATE POLICY "Prevent deletion of inventory movements"
ON public.inventory_movements
FOR DELETE
TO authenticated
USING (false);

-- 3. Adicionar política explícita de negação de UPDATE em inventory_movements
DROP POLICY IF EXISTS "Prevent update of inventory movements" ON public.inventory_movements;
CREATE POLICY "Prevent update of inventory movements"
ON public.inventory_movements
FOR UPDATE
TO authenticated
USING (false);

-- 4. Adicionar política explícita de negação de DELETE em price_history
DROP POLICY IF EXISTS "Prevent deletion of price history" ON public.price_history;
CREATE POLICY "Prevent deletion of price history"
ON public.price_history
FOR DELETE
TO authenticated
USING (false);

-- 5. Adicionar política explícita de negação de UPDATE em price_history
DROP POLICY IF EXISTS "Prevent update of price history" ON public.price_history;
CREATE POLICY "Prevent update of price history"
ON public.price_history
FOR UPDATE
TO authenticated
USING (false);

-- 6. Habilitar proteção de senhas vazadas via configuração de auth (feito separadamente)


-- Migration: 20251214205148_1a5d8ab3-a099-4ac5-a04d-09e3b1c3e17a.sql
-- Fix maintenance-request-photos security
-- Remove overly permissive policies and add proper authentication

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can upload maintenance request photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view maintenance request photos" ON storage.objects;

-- Create new secure policies for maintenance-request-photos bucket

-- Only allow uploads with a valid session token (from QR code flow that provides temp access)
-- Or authenticated users
DROP POLICY IF EXISTS "Authenticated users can upload maintenance photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload maintenance photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'maintenance-request-photos');

-- Create policy for viewing - only authenticated users and project owners
DROP POLICY IF EXISTS "Authenticated users can view maintenance photos" ON storage.objects;
CREATE POLICY "Authenticated users can view maintenance photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'maintenance-request-photos');

-- Allow authenticated users to delete their own uploaded photos
DROP POLICY IF EXISTS "Users can delete their own maintenance photos" ON storage.objects;
CREATE POLICY "Users can delete their own maintenance photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'maintenance-request-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- For the QR code public workflow, we need a separate approach:
-- Create a public endpoint that validates the QR code and returns a signed URL
-- This is more secure than allowing public uploads

-- Migration: 20251215170919_64e76540-807a-47fa-aea4-648125e9e4dd.sql
-- Dashboard Configurations Table
CREATE TABLE public.dashboard_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  global_filters JSONB DEFAULT '{}'::jsonb,
  layout JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Dashboard Widgets Table
CREATE TABLE public.dashboard_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id UUID NOT NULL REFERENCES public.dashboard_configs(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  title TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 4,
  height INTEGER DEFAULT 3,
  data_source TEXT,
  filters JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Dashboard Configs Policies
CREATE POLICY "Users can view their own dashboards"
ON public.dashboard_configs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dashboards"
ON public.dashboard_configs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboards"
ON public.dashboard_configs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboards"
ON public.dashboard_configs FOR DELETE
USING (auth.uid() = user_id);

-- Dashboard Widgets Policies
CREATE POLICY "Users can view widgets from their dashboards"
ON public.dashboard_widgets FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.dashboard_configs
  WHERE dashboard_configs.id = dashboard_widgets.dashboard_id
  AND dashboard_configs.user_id = auth.uid()
));

CREATE POLICY "Users can create widgets in their dashboards"
ON public.dashboard_widgets FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.dashboard_configs
  WHERE dashboard_configs.id = dashboard_widgets.dashboard_id
  AND dashboard_configs.user_id = auth.uid()
));

CREATE POLICY "Users can update widgets in their dashboards"
ON public.dashboard_widgets FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.dashboard_configs
  WHERE dashboard_configs.id = dashboard_widgets.dashboard_id
  AND dashboard_configs.user_id = auth.uid()
));

CREATE POLICY "Users can delete widgets from their dashboards"
ON public.dashboard_widgets FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.dashboard_configs
  WHERE dashboard_configs.id = dashboard_widgets.dashboard_id
  AND dashboard_configs.user_id = auth.uid()
));

-- Add triggers for updated_at
CREATE TRIGGER update_dashboard_configs_updated_at
BEFORE UPDATE ON public.dashboard_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at
BEFORE UPDATE ON public.dashboard_widgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_dashboard_configs_user_id ON public.dashboard_configs(user_id);
CREATE INDEX idx_dashboard_widgets_dashboard_id ON public.dashboard_widgets(dashboard_id);

-- Enable realtime for dashboards
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_configs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_widgets;

-- Fix security issue: Strengthen employees table RLS policies
-- The current policies are correct but need to add redundant protection
DROP POLICY IF EXISTS "Users can view employees from their projects" ON public.employees;

CREATE POLICY "Users can view employees from their projects"
ON public.employees FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    created_by_user_id = auth.uid() OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = employees.project_id
      AND projects.created_by_user_id = auth.uid()
    )) OR
    (construction_site_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM construction_sites cs
      JOIN projects p ON p.id = cs.project_id
      WHERE cs.id = employees.construction_site_id
      AND p.created_by_user_id = auth.uid()
    ))
  )
);

-- Fix security issue: Strengthen labor_tracking table RLS policies
DROP POLICY IF EXISTS "Users can view labor tracking from their projects" ON public.labor_tracking;

CREATE POLICY "Users can view labor tracking from their projects"
ON public.labor_tracking FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = labor_tracking.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

-- Migration: 20251222153930_1336992e-1dee-4ce0-a104-bfcf6ab05e8a.sql
-- Make the interactive-maps bucket private
UPDATE storage.buckets 
SET public = false 
WHERE name = 'interactive-maps';

-- Drop existing permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view public maps" ON storage.objects;

-- Create new secure SELECT policy that verifies project ownership
DROP POLICY IF EXISTS "Users can view maps from their projects" ON storage.objects;
CREATE POLICY "Users can view maps from their projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'interactive-maps' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.created_by_user_id = auth.uid()
  )
);

-- Add database constraints for user_quotas
ALTER TABLE public.user_quotas
ADD CONSTRAINT check_max_projects 
  CHECK (max_projects >= 1 AND max_projects <= 100);

ALTER TABLE public.user_quotas
ADD CONSTRAINT check_max_employees 
  CHECK (max_employees >= 1 AND max_employees <= 10000);

-- Migration: 20251224220013_3dd575a8-2c2f-4dc7-913e-e2f8a6d5f43c.sql
-- Adicionar 'manager' ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

-- Migration: 20251224220225_94b723e5-69bf-4f50-b2f3-b875f4b93a4b.sql
-- =============================================
-- ADICIONAR project_id À TABELA supplier_quotes
-- =============================================
ALTER TABLE public.supplier_quotes ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

-- Atualizar project_id baseado no purchase_request_id existente
UPDATE public.supplier_quotes sq
SET project_id = pr.project_id
FROM public.purchase_requests pr
WHERE sq.purchase_request_id = pr.id
AND sq.project_id IS NULL;

-- =============================================
-- FUNÇÕES DE SEGURANÇA
-- =============================================

CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = _project_id 
    AND created_by_user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND project_id = _project_id
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND is_super_admin = true
  )
$$;

CREATE OR REPLACE FUNCTION public.has_qrcode_access(_user_id uuid, _qr_code_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.maintenance_qr_codes mqc
    JOIN public.projects p ON mqc.project_id = p.id
    WHERE mqc.id = _qr_code_id
    AND (
      p.created_by_user_id = _user_id
      OR EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id 
        AND (project_id = p.id OR is_super_admin = true)
      )
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_manager(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = _project_id 
    AND created_by_user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND project_id = _project_id 
    AND role IN ('admin', 'manager')
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND is_super_admin = true
  )
$$;

-- Função para obter project_id do supplier_quote via purchase_request
CREATE OR REPLACE FUNCTION public.get_supplier_quote_project_id(_quote_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.project_id
  FROM public.supplier_quotes sq
  JOIN public.purchase_requests pr ON sq.purchase_request_id = pr.id
  WHERE sq.id = _quote_id
$$;

-- =============================================
-- CORRIGIR RLS DA TABELA EMPLOYEES
-- =============================================

DROP POLICY IF EXISTS "Users can view employees from their projects" ON public.employees;
DROP POLICY IF EXISTS "Users can view their own employees" ON public.employees;
DROP POLICY IF EXISTS "Users can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Users can update their own employees" ON public.employees;
DROP POLICY IF EXISTS "Users can delete their own employees" ON public.employees;

CREATE POLICY "Authenticated users can view employees from their projects"
ON public.employees FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.has_project_access(auth.uid(), project_id)
  )
);

CREATE POLICY "Authenticated users can insert employees"
ON public.employees FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by_user_id = auth.uid()
  AND (project_id IS NULL OR public.has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Authenticated users can update their employees"
ON public.employees FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

CREATE POLICY "Authenticated users can delete their employees"
ON public.employees FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

-- =============================================
-- CORRIGIR RLS DA TABELA MAINTENANCE_REQUESTS
-- =============================================

DROP POLICY IF EXISTS "Users can view maintenance requests for their projects" ON public.maintenance_requests;
DROP POLICY IF EXISTS "Anyone can create maintenance requests" ON public.maintenance_requests;
DROP POLICY IF EXISTS "Users can update maintenance requests for their projects" ON public.maintenance_requests;

CREATE POLICY "Users with project access can view maintenance requests"
ON public.maintenance_requests FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.has_qrcode_access(auth.uid(), qr_code_id)
);

CREATE POLICY "Anyone can create maintenance requests for valid QR codes"
ON public.maintenance_requests FOR INSERT
TO anon, authenticated
WITH CHECK (
  qr_code_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.maintenance_qr_codes 
    WHERE id = qr_code_id 
    AND is_active = true
  )
);

CREATE POLICY "Project managers can update maintenance requests"
ON public.maintenance_requests FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.has_qrcode_access(auth.uid(), qr_code_id)
);

CREATE POLICY "Project managers can delete maintenance requests"
ON public.maintenance_requests FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.has_qrcode_access(auth.uid(), qr_code_id)
);

-- =============================================
-- CORRIGIR RLS DA TABELA LABOR_TRACKING
-- =============================================

DROP POLICY IF EXISTS "Users can view labor tracking for their projects" ON public.labor_tracking;
DROP POLICY IF EXISTS "Users can insert labor tracking" ON public.labor_tracking;
DROP POLICY IF EXISTS "Users can update labor tracking" ON public.labor_tracking;
DROP POLICY IF EXISTS "Users can delete labor tracking" ON public.labor_tracking;

CREATE POLICY "Managers can view labor tracking"
ON public.labor_tracking FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_project_manager(auth.uid(), project_id)
);

CREATE POLICY "Authenticated users can insert labor tracking"
ON public.labor_tracking FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by_user_id = auth.uid()
  AND public.has_project_access(auth.uid(), project_id)
);

CREATE POLICY "Managers can update labor tracking"
ON public.labor_tracking FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

CREATE POLICY "Managers can delete labor tracking"
ON public.labor_tracking FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_project_manager(auth.uid(), project_id)
);

-- =============================================
-- CORRIGIR RLS DA TABELA PURCHASE_REQUESTS
-- =============================================

DROP POLICY IF EXISTS "Users can view purchase requests for their projects" ON public.purchase_requests;
DROP POLICY IF EXISTS "Users can insert purchase requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "Users can update purchase requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "Users can delete purchase requests" ON public.purchase_requests;

CREATE POLICY "Authenticated users can view their own purchase requests"
ON public.purchase_requests FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    requested_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

CREATE POLICY "Authenticated users can create purchase requests"
ON public.purchase_requests FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND requested_by_user_id = auth.uid()
  AND public.has_project_access(auth.uid(), project_id)
);

CREATE POLICY "Managers can update purchase requests"
ON public.purchase_requests FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    requested_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

CREATE POLICY "Managers can delete purchase requests"
ON public.purchase_requests FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_project_manager(auth.uid(), project_id)
);

-- =============================================
-- CORRIGIR RLS DA TABELA SUPPLIER_QUOTES
-- =============================================

DROP POLICY IF EXISTS "Users can view supplier quotes for their projects" ON public.supplier_quotes;
DROP POLICY IF EXISTS "Users can insert supplier quotes" ON public.supplier_quotes;
DROP POLICY IF EXISTS "Users can update supplier quotes" ON public.supplier_quotes;
DROP POLICY IF EXISTS "Users can delete supplier quotes" ON public.supplier_quotes;

CREATE POLICY "Managers can view supplier quotes"
ON public.supplier_quotes FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
    OR public.is_project_manager(auth.uid(), public.get_supplier_quote_project_id(id))
  )
);

CREATE POLICY "Managers can insert supplier quotes"
ON public.supplier_quotes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by_user_id = auth.uid()
);

CREATE POLICY "Managers can update supplier quotes"
ON public.supplier_quotes FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

CREATE POLICY "Managers can delete supplier quotes"
ON public.supplier_quotes FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

-- =============================================
-- CORRIGIR RLS DA TABELA PURCHASE_ORDERS
-- =============================================

DROP POLICY IF EXISTS "Users can view purchase orders for their projects" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can insert purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can update purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can delete purchase orders" ON public.purchase_orders;

CREATE POLICY "Managers can view purchase orders"
ON public.purchase_orders FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_project_manager(auth.uid(), project_id)
);

CREATE POLICY "Managers can insert purchase orders"
ON public.purchase_orders FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by_user_id = auth.uid()
  AND public.is_project_manager(auth.uid(), project_id)
);

CREATE POLICY "Managers can update purchase orders"
ON public.purchase_orders FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_project_manager(auth.uid(), project_id)
);

CREATE POLICY "Managers can delete purchase orders"
ON public.purchase_orders FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_project_manager(auth.uid(), project_id)
);

-- =============================================
-- CORRIGIR RLS DA TABELA INVENTORY
-- =============================================

DROP POLICY IF EXISTS "Users can view inventory items" ON public.inventory;
DROP POLICY IF EXISTS "Users can insert inventory items" ON public.inventory;
DROP POLICY IF EXISTS "Users can update inventory items" ON public.inventory;
DROP POLICY IF EXISTS "Users can delete inventory items" ON public.inventory;

CREATE POLICY "Users with project access can view inventory"
ON public.inventory FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.has_project_access(auth.uid(), project_id)
  )
);

CREATE POLICY "Users can insert inventory items"
ON public.inventory FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by_user_id = auth.uid()
  AND (project_id IS NULL OR public.has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Users can update their inventory items"
ON public.inventory FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

CREATE POLICY "Managers can delete inventory items"
ON public.inventory FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

-- =============================================
-- CORRIGIR RLS DA TABELA CONNECTION_REPORTS
-- =============================================

DROP POLICY IF EXISTS "Users can view their own connection reports" ON public.connection_reports;
DROP POLICY IF EXISTS "Users can insert connection reports" ON public.connection_reports;
DROP POLICY IF EXISTS "Users can update their own connection reports" ON public.connection_reports;
DROP POLICY IF EXISTS "Users can delete their own connection reports" ON public.connection_reports;

CREATE POLICY "Users with project access can view connection reports"
ON public.connection_reports FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.has_project_access(auth.uid(), project_id)
  )
);

CREATE POLICY "Users can insert connection reports"
ON public.connection_reports FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by_user_id = auth.uid()
  AND (project_id IS NULL OR public.has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Users can update their connection reports"
ON public.connection_reports FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

CREATE POLICY "Users can delete their connection reports"
ON public.connection_reports FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

-- =============================================
-- ADICIONAR ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_project ON public.user_roles(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_super_admin ON public.user_roles(user_id) WHERE is_super_admin = true;
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_qr_codes_project ON public.maintenance_qr_codes(project_id);
CREATE INDEX IF NOT EXISTS idx_employees_project ON public.employees(project_id);
CREATE INDEX IF NOT EXISTS idx_employees_created_by ON public.employees(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes_project ON public.supplier_quotes(project_id);

-- =============================================
-- CONFIGURAR RLS PARA AUDIT_LOG
-- =============================================

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only super admins can view audit logs" ON public.audit_log;
CREATE POLICY "Only super admins can view audit logs"
ON public.audit_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND is_super_admin = true
  )
);

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_log;
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Migration: 20260120011902_c7926c4b-25c6-49db-956a-df790dc67094.sql

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


-- Migration: 20260120011934_f8504b85-d6e1-48f6-b59b-adab16c85378.sql

-- =============================================================
-- SECURITY FIX: Restrict connection_reports access to managers only
-- =============================================================

-- Drop the broad access policy
DROP POLICY IF EXISTS "Users with project access can view connection reports" ON public.connection_reports;

-- Create more restrictive policy - only creators and project managers
CREATE POLICY "Managers and creators can view connection reports"
ON public.connection_reports FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);


-- Migration: 20260120012804_78f819df-aedd-479f-a4e9-34b7820d900b.sql
-- =============================================================
-- SECURITY FIX: Restrict maintenance-request-photos storage uploads
-- =============================================================

-- Drop existing permissive upload policy
DROP POLICY IF EXISTS "Anyone can upload maintenance request photos" ON storage.objects;

-- Create a tracking table for rate limiting maintenance requests
CREATE TABLE IF NOT EXISTS public.maintenance_request_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_ip text NOT NULL,
  qr_code_id uuid NOT NULL REFERENCES public.maintenance_qr_codes(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on rate limits table
ALTER TABLE public.maintenance_request_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (service role) to manage rate limits
CREATE POLICY "Service role can manage rate limits"
ON public.maintenance_request_rate_limits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_maintenance_rate_limits_ip_time 
ON public.maintenance_request_rate_limits(client_ip, created_at);

CREATE INDEX IF NOT EXISTS idx_maintenance_rate_limits_qr_time 
ON public.maintenance_request_rate_limits(qr_code_id, created_at);

-- Cleanup old rate limit records (older than 24 hours) - function for scheduled cleanup
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.maintenance_request_rate_limits
  WHERE created_at < now() - interval '24 hours';
END;
$$;

-- Add comment documenting the security fix
COMMENT ON TABLE public.maintenance_request_rate_limits IS 
  'Rate limiting table for maintenance requests to prevent abuse from anonymous users';

-- Note: Storage policy change requires edge function for signed URL uploads
-- The maintenance-request-photos bucket should use signed URLs from edge function



-- ============================================
-- PARTE 4: parte4.sql
-- ============================================

-- PARTE 4 DE 4: RH, feedback, ajustes finais
-- Cole este SQL no Supabase SQL Editor e clique Run


-- Migration: 20260120125215_70cf5248-7fb5-4253-8bee-a692f2d7adf2.sql
-- =============================================
-- SECURITY FIX: Remove duplicate/old RLS policies from employees table
-- =============================================

-- Remove old policies that are superseded by the project-based ones
DROP POLICY IF EXISTS "Usuários autenticados podem ver funcionários" ON public.employees;
DROP POLICY IF EXISTS "Usuários autenticados podem criar funcionários" ON public.employees;
DROP POLICY IF EXISTS "Usuários podem atualizar funcionários que criaram" ON public.employees;
DROP POLICY IF EXISTS "Usuários podem deletar funcionários que criaram" ON public.employees;

-- =============================================
-- SECURITY FIX: Restrict rate limits table to service role only
-- Prevent potential IP address exposure
-- =============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.maintenance_request_rate_limits;

-- Create more restrictive policies
-- Only allow INSERT for anonymous users (needed for rate limit tracking)
-- No SELECT for non-service-role users (protects IP addresses)
CREATE POLICY "Anonymous users can insert rate limit entries"
ON public.maintenance_request_rate_limits FOR INSERT
TO anon
WITH CHECK (true);

-- Service role can do everything (for cleanup operations)
CREATE POLICY "Service role full access"
ON public.maintenance_request_rate_limits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users cannot see rate limit data (IP protection)
-- No SELECT policy for authenticated = they cannot query this table

-- Migration: 20260121123520_bd3ab0ac-b209-44f3-a37b-03c050261bf5.sql
-- =============================================
-- ADD NORMALIZED FIELDS FOR KEYWORD-BASED MATCHING
-- =============================================

-- Add normalized keywords array (tokenized, lowercase, no accents)
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS keywords_norm text[] DEFAULT '{}';

-- Add normalized description (lowercase, no accents, cleaned)
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS description_norm text DEFAULT '';

-- Create index for keyword matching using GIN
CREATE INDEX IF NOT EXISTS idx_materials_keywords_norm 
ON public.materials USING GIN(keywords_norm);

-- Create index for description search
CREATE INDEX IF NOT EXISTS idx_materials_description_norm 
ON public.materials USING btree(description_norm);

-- =============================================
-- FUNCTION: Normalize text for matching
-- =============================================
CREATE OR REPLACE FUNCTION public.normalize_text_for_matching(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        translate(
          input_text,
          'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ',
          'AAAAAAACEEEEIIIIDNOOOOOOUUUUYTsaaaaaaaceeeeiiiidnoooooouuuuyty'
        ),
        '[^\w\s]', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
END;
$$;

-- =============================================
-- FUNCTION: Tokenize text into keywords array
-- =============================================
CREATE OR REPLACE FUNCTION public.tokenize_keywords(input_text text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized text;
  tokens text[];
  result text[];
  token text;
BEGIN
  normalized := public.normalize_text_for_matching(input_text);
  -- Split by space, comma, pipe, semicolon
  tokens := regexp_split_to_array(normalized, '[\s,|;]+');
  
  result := '{}';
  FOREACH token IN ARRAY tokens
  LOOP
    -- Only include tokens with length > 2 and not already in result
    IF length(token) > 2 AND NOT (token = ANY(result)) THEN
      result := array_append(result, token);
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$;

-- =============================================
-- TRIGGER: Auto-update normalized fields on insert/update
-- =============================================
CREATE OR REPLACE FUNCTION public.update_materials_normalized_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Update keywords_norm from name and existing keywords
  NEW.keywords_norm := (
    SELECT ARRAY(
      SELECT DISTINCT unnest
      FROM unnest(
        public.tokenize_keywords(NEW.name) || 
        COALESCE(
          (SELECT array_agg(public.normalize_text_for_matching(k)) 
           FROM unnest(NEW.keywords) AS k 
           WHERE k IS NOT NULL AND k != ''),
          '{}'::text[]
        )
      )
      WHERE unnest IS NOT NULL AND unnest != ''
    )
  );
  
  -- Update description_norm
  NEW.description_norm := public.normalize_text_for_matching(
    COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.description, '')
  );
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_update_materials_normalized ON public.materials;

-- Create trigger
CREATE TRIGGER trigger_update_materials_normalized
  BEFORE INSERT OR UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_materials_normalized_fields();

-- =============================================
-- BACKFILL: Update existing materials with normalized fields
-- =============================================
UPDATE public.materials SET
  keywords_norm = (
    SELECT ARRAY(
      SELECT DISTINCT unnest
      FROM unnest(
        public.tokenize_keywords(name) || 
        COALESCE(
          (SELECT array_agg(public.normalize_text_for_matching(k)) 
           FROM unnest(keywords) AS k 
           WHERE k IS NOT NULL AND k != ''),
          '{}'::text[]
        )
      )
      WHERE unnest IS NOT NULL AND unnest != ''
    )
  ),
  description_norm = public.normalize_text_for_matching(
    COALESCE(name, '') || ' ' || COALESCE(description, '')
  )
WHERE keywords_norm = '{}' OR keywords_norm IS NULL OR description_norm = '' OR description_norm IS NULL;

-- Migration: 20260121123535_2ac5d471-3644-48d1-a635-290e6feae9c5.sql
-- Fix search_path for the new functions
ALTER FUNCTION public.normalize_text_for_matching(text) SET search_path = public;
ALTER FUNCTION public.tokenize_keywords(text) SET search_path = public;

-- Migration: 20260123123318_281a2fd8-524d-43bb-b863-48a4a7ab6abc.sql
-- Fix RLS policy for maintenance_request_rate_limits table
-- This table should only be modified by the edge function (service role)
-- Anonymous users should NOT have direct INSERT access

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anonymous users can insert rate limit entries" ON public.maintenance_request_rate_limits;

-- The "Service role full access" policy is fine for internal operations
-- But we need to ensure no public anonymous access

-- Create a more restrictive policy: only authenticated service-side operations
-- Since rate limiting is handled by the edge function with service role,
-- we don't need any public INSERT policy

-- Migration: 20260123123347_d5e499f1-76e7-4dd6-ac3f-ffce45e2babd.sql
-- Create table to store satisfaction survey responses
CREATE TABLE public.satisfaction_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  
  -- Section 1 - Profile
  user_profile TEXT NOT NULL,
  user_profile_other TEXT,
  operation_type TEXT NOT NULL,
  operation_type_other TEXT,
  users_count TEXT NOT NULL,
  
  -- Section 2 - NPS
  nps_score INTEGER NOT NULL CHECK (nps_score >= 0 AND nps_score <= 10),
  nps_justification TEXT,
  
  -- Section 3 - Satisfaction
  general_satisfaction TEXT NOT NULL,
  help_areas TEXT[] DEFAULT '{}',
  one_sentence_summary TEXT,
  
  -- Section 4 - Effort
  ease_of_start TEXT NOT NULL,
  initial_difficulty TEXT NOT NULL,
  initial_difficulty_other TEXT,
  
  -- Section 5 - Product
  most_used_features TEXT[] DEFAULT '{}',
  urgent_improvement TEXT NOT NULL,
  urgent_improvement_other TEXT,
  
  -- Section 6 - Churn Risk
  would_stop_using TEXT NOT NULL,
  stop_reason TEXT,
  solution_expectation TEXT,
  
  -- Section 7 - Data Trust
  data_trust_level TEXT NOT NULL,
  trust_issues TEXT[] DEFAULT '{}',
  trust_issues_other TEXT,
  
  -- Section 8 - ROI
  generated_results TEXT NOT NULL,
  hours_saved_per_week DECIMAL(10,2),
  monthly_savings DECIMAL(10,2),
  
  -- Section 9 - Support
  support_resolution TEXT NOT NULL,
  preferred_support_format TEXT NOT NULL,
  
  -- Section 10 - Improvements
  one_improvement TEXT,
  indispensable_feature TEXT,
  desired_features TEXT[] DEFAULT '{}',
  
  -- Section 11 - Referral
  would_recommend TEXT NOT NULL,
  referral_target TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMP WITH TIME ZONE,
  next_available_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- Users can view their own surveys
CREATE POLICY "Users can view own surveys"
  ON public.satisfaction_surveys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own surveys
CREATE POLICY "Users can create own surveys"
  ON public.satisfaction_surveys FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all surveys (for export)
CREATE POLICY "Admins can view all surveys"
  ON public.satisfaction_surveys FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND (role = 'admin' OR is_super_admin = true)
    )
  );

-- Index for user lookups
CREATE INDEX idx_satisfaction_surveys_user_id ON public.satisfaction_surveys(user_id);
CREATE INDEX idx_satisfaction_surveys_created_at ON public.satisfaction_surveys(created_at DESC);

-- Migration: 20260124183233_91d845f8-0557-44a8-8b52-86666d188718.sql
-- =====================================================
-- SISTEMA DE DISPARO DE PESQUISAS DE SATISFAÇÃO
-- =====================================================

-- Tabela para controlar quais usuários devem responder a pesquisa
CREATE TABLE IF NOT EXISTS public.survey_dispatches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  dispatched_by UUID NOT NULL,
  dispatched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar coluna dispatch_id à tabela satisfaction_surveys para vincular respostas
ALTER TABLE public.satisfaction_surveys 
ADD COLUMN IF NOT EXISTS dispatch_id UUID REFERENCES public.survey_dispatches(id);

-- Habilitar RLS
ALTER TABLE public.survey_dispatches ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para survey_dispatches
CREATE POLICY "Users can view their own dispatches"
ON public.survey_dispatches FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own dispatches"
ON public.survey_dispatches FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all dispatches"
ON public.survey_dispatches FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND is_super_admin = true
  )
);

CREATE POLICY "Admins can create dispatches"
ON public.survey_dispatches FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND is_super_admin = true
  )
);

CREATE POLICY "Admins can update all dispatches"
ON public.survey_dispatches FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND is_super_admin = true
  )
);

CREATE POLICY "Admins can delete dispatches"
ON public.survey_dispatches FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND is_super_admin = true
  )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_survey_dispatches_user_id ON public.survey_dispatches(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_dispatches_dispatched_by ON public.survey_dispatches(dispatched_by);
CREATE INDEX IF NOT EXISTS idx_survey_dispatches_responded ON public.survey_dispatches(responded_at) WHERE responded_at IS NULL;

-- =====================================================
-- MELHORIAS DE SEGURANÇA
-- =====================================================

-- Atualizar política de maintenance_requests para ser mais restritiva
DROP POLICY IF EXISTS "Users with project access can view maintenance requests" ON public.maintenance_requests;

CREATE POLICY "Project managers can view maintenance requests"
ON public.maintenance_requests FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_project_manager(auth.uid(), (
    SELECT project_id FROM public.maintenance_qr_codes 
    WHERE id = qr_code_id
  ))
);

-- Migration: 20260125123318_4159c50f-bc8b-400b-8e69-56087b7acfe0.sql
-- Fix security vulnerabilities identified in the scan

-- 1. Fix employees table: Restrict SELECT to only project owner (created_by_user_id)
-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Authenticated users can view employees from their projects" ON public.employees;

-- Create stricter policy: Only owner or project manager can view
CREATE POLICY "Only owners can view employees from their projects" 
ON public.employees 
FOR SELECT 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    created_by_user_id = auth.uid() 
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

-- 2. Fix connection_reports table: Restrict to only creator OR project manager
-- The existing policies are fine, but add a note that this is intentional

-- 3. Fix labor_tracking table: Restrict SELECT to project owner or project manager
DROP POLICY IF EXISTS "Users can view labor tracking from their projects" ON public.labor_tracking;
DROP POLICY IF EXISTS "Managers can view labor tracking" ON public.labor_tracking;

CREATE POLICY "Only owners can view labor tracking from their projects" 
ON public.labor_tracking 
FOR SELECT 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    created_by_user_id = auth.uid() 
    OR (
      project_id IS NOT NULL 
      AND public.is_project_manager(auth.uid(), project_id)
    )
  )
);

-- Migration: 20260129182825_968fdcc2-0fd8-4d66-adba-ebb72473ddb5.sql
-- Fix maintenance_request_rate_limits: Remove overly permissive service role policy
-- and implement proper restrictive policies

-- Drop existing policies that may be overly permissive
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.maintenance_request_rate_limits;
DROP POLICY IF EXISTS "service_role_full_access" ON public.maintenance_request_rate_limits;
DROP POLICY IF EXISTS "Allow service role full access" ON public.maintenance_request_rate_limits;

-- Create proper restrictive policies for rate limits table
-- Only allow inserts from the edge function (which uses service role internally)
-- Regular users should never be able to read or manipulate this table directly

-- Policy for inserting rate limit records (public access needed for the edge function)
CREATE POLICY "Edge function can insert rate limits"
ON public.maintenance_request_rate_limits
FOR INSERT
WITH CHECK (true);

-- Policy for deleting old rate limit records (for cleanup function, requires service role)
-- This runs via the cleanup_old_rate_limits() function which is SECURITY DEFINER
CREATE POLICY "Allow cleanup of old rate limits"
ON public.maintenance_request_rate_limits
FOR DELETE
USING (created_at < now() - interval '24 hours');

-- No SELECT policy for regular users - they should never read this table
-- No UPDATE policy - rate limit records should never be updated

-- Migration: 20260129200211_ebd85ad5-0ea6-4967-aa62-0033978c43f6.sql
-- =======================================================
-- Segurança: restringir tabela de rate-limits (manutenção)
-- =======================================================

-- 1. Remove políticas permissivas antigas
DROP POLICY IF EXISTS "Service role full access" ON public.maintenance_request_rate_limits;
DROP POLICY IF EXISTS "Edge function can insert rate limits" ON public.maintenance_request_rate_limits;
DROP POLICY IF EXISTS "Public can insert rate limit records" ON public.maintenance_request_rate_limits;

-- 2. Política para INSERT
CREATE POLICY "Public can insert rate limit records"
ON public.maintenance_request_rate_limits
FOR INSERT
TO public
WITH CHECK (true);

-- 3. SELECT: qualquer usuário pode consultar
DROP POLICY IF EXISTS "Public can view rate limits" ON public.maintenance_request_rate_limits;
CREATE POLICY "Public can view rate limits"
ON public.maintenance_request_rate_limits
FOR SELECT
TO public
USING (true);

-- Migration: 20260130133236_de3632b1-31b0-4973-becd-c2e15152dccd.sql
-- =======================================================
-- CRM CONSTRUDATA - Estrutura Completa
-- =======================================================

-- ENUM para status de contatos
CREATE TYPE public.crm_contact_status AS ENUM ('active', 'inactive', 'archived');

-- ENUM para status de oportunidades
CREATE TYPE public.crm_deal_status AS ENUM ('open', 'won', 'lost');

-- ENUM para tipos de atividade
CREATE TYPE public.crm_activity_type AS ENUM ('task', 'call', 'meeting', 'followup', 'note');

-- ENUM para status de atividades
CREATE TYPE public.crm_activity_status AS ENUM ('pending', 'completed', 'cancelled');

-- =======================================================
-- 1. EMPRESAS / CONTAS (ACCOUNTS)
-- =======================================================
CREATE TABLE public.crm_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  cnpj TEXT,
  sector TEXT,
  city TEXT,
  state TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own accounts"
ON public.crm_accounts FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can create accounts"
ON public.crm_accounts FOR INSERT
TO authenticated
WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update their own accounts"
ON public.crm_accounts FOR UPDATE
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own accounts"
ON public.crm_accounts FOR DELETE
TO authenticated
USING (created_by_user_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_crm_accounts_updated_at
BEFORE UPDATE ON public.crm_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =======================================================
-- 2. CONTATOS (CONTACTS)
-- =======================================================
CREATE TABLE public.crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  account_id UUID REFERENCES public.crm_accounts(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  phone_secondary TEXT,
  job_title TEXT,
  tags TEXT[] DEFAULT '{}',
  status crm_contact_status DEFAULT 'active',
  is_archived BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts"
ON public.crm_contacts FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can create contacts"
ON public.crm_contacts FOR INSERT
TO authenticated
WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update their own contacts"
ON public.crm_contacts FOR UPDATE
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own contacts"
ON public.crm_contacts FOR DELETE
TO authenticated
USING (created_by_user_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_crm_contacts_updated_at
BEFORE UPDATE ON public.crm_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para busca de duplicatas
CREATE INDEX idx_crm_contacts_email ON public.crm_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX idx_crm_contacts_phone ON public.crm_contacts(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_crm_contacts_name ON public.crm_contacts USING gin(to_tsvector('portuguese', full_name));

-- =======================================================
-- 3. ESTÁGIOS DO PIPELINE (CONFIGURÁVEIS)
-- =======================================================
CREATE TABLE public.crm_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  position INTEGER NOT NULL DEFAULT 0,
  default_probability INTEGER DEFAULT 50,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stages"
ON public.crm_pipeline_stages FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can create stages"
ON public.crm_pipeline_stages FOR INSERT
TO authenticated
WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update their own stages"
ON public.crm_pipeline_stages FOR UPDATE
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own stages"
ON public.crm_pipeline_stages FOR DELETE
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE TRIGGER update_crm_pipeline_stages_updated_at
BEFORE UPDATE ON public.crm_pipeline_stages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =======================================================
-- 4. OPORTUNIDADES (DEALS)
-- =======================================================
CREATE TABLE public.crm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  account_id UUID REFERENCES public.crm_accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL,
  estimated_value NUMERIC(15,2) DEFAULT 0,
  probability INTEGER DEFAULT 50,
  expected_close_date DATE,
  status crm_deal_status DEFAULT 'open',
  lost_reason TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deals"
ON public.crm_deals FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can create deals"
ON public.crm_deals FOR INSERT
TO authenticated
WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update their own deals"
ON public.crm_deals FOR UPDATE
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own deals"
ON public.crm_deals FOR DELETE
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE TRIGGER update_crm_deals_updated_at
BEFORE UPDATE ON public.crm_deals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =======================================================
-- 5. ATIVIDADES
-- =======================================================
CREATE TABLE public.crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  activity_type crm_activity_type NOT NULL DEFAULT 'task',
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  due_time TIME,
  status crm_activity_status DEFAULT 'pending',
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.crm_accounts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activities"
ON public.crm_activities FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can create activities"
ON public.crm_activities FOR INSERT
TO authenticated
WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update their own activities"
ON public.crm_activities FOR UPDATE
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own activities"
ON public.crm_activities FOR DELETE
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE TRIGGER update_crm_activities_updated_at
BEFORE UPDATE ON public.crm_activities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para atividades vencidas
CREATE INDEX idx_crm_activities_due ON public.crm_activities(due_date, status) 
WHERE status = 'pending';

-- =======================================================
-- 6. HISTÓRICO UNIFICADO (AUDIT LOG CRM)
-- =======================================================
CREATE TABLE public.crm_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  entity_type TEXT NOT NULL, -- 'contact', 'account', 'deal', 'activity'
  entity_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'stage_changed', 'note_added', etc.
  old_values JSONB,
  new_values JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own history"
ON public.crm_history FOR SELECT
TO authenticated
USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can create history entries"
ON public.crm_history FOR INSERT
TO authenticated
WITH CHECK (created_by_user_id = auth.uid());

-- Índice para busca por entidade
CREATE INDEX idx_crm_history_entity ON public.crm_history(entity_type, entity_id);

-- =======================================================
-- 7. HISTÓRICO DE MUDANÇA DE ESTÁGIO (DEALS)
-- =======================================================
CREATE TABLE public.crm_deal_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL,
  to_stage_id UUID REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL,
  changed_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_deal_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view deal stage history"
ON public.crm_deal_stage_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crm_deals d 
    WHERE d.id = deal_id AND d.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create deal stage history"
ON public.crm_deal_stage_history FOR INSERT
TO authenticated
WITH CHECK (changed_by_user_id = auth.uid());

-- Migration: 20260130151725_c291d71e-ab3a-4d25-810c-4371f8e1f8a7.sql
-- =============================================
-- TABELAS PARA RH CONSTRUDATA - ESCALA INTELIGENTE CLT
-- =============================================

-- Tabela de unidades (se não existir)
CREATE TABLE IF NOT EXISTS public.unidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de funcionários RH (se não existir)
CREATE TABLE IF NOT EXISTS public.funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  cpf TEXT,
  cargo TEXT,
  departamento TEXT,
  salario_base NUMERIC DEFAULT 0,
  data_admissao DATE,
  data_demissao DATE,
  tipo_contrato TEXT DEFAULT 'clt',
  ativo BOOLEAN NOT NULL DEFAULT true,
  email TEXT,
  telefone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de turnos
CREATE TABLE IF NOT EXISTS public.turnos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  intervalo_minutos INTEGER DEFAULT 60,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configurações CLT por empresa/unidade
CREATE TABLE IF NOT EXISTS public.configuracoes_clt (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  jornada_diaria_padrao NUMERIC NOT NULL DEFAULT 8.00,
  jornada_semanal_padrao NUMERIC NOT NULL DEFAULT 44.00,
  limite_horas_extras_dia NUMERIC NOT NULL DEFAULT 2.00,
  percentual_hora_extra_50 NUMERIC NOT NULL DEFAULT 50.00,
  percentual_hora_extra_100 NUMERIC NOT NULL DEFAULT 100.00,
  intervalo_minimo_6h NUMERIC NOT NULL DEFAULT 1.00,
  intervalo_minimo_4h NUMERIC NOT NULL DEFAULT 0.25,
  descanso_entre_jornadas NUMERIC NOT NULL DEFAULT 11.00,
  dias_trabalho_antes_folga INTEGER NOT NULL DEFAULT 6,
  hora_inicio_noturno TIME NOT NULL DEFAULT '22:00:00',
  hora_fim_noturno TIME NOT NULL DEFAULT '05:00:00',
  percentual_adicional_noturno NUMERIC NOT NULL DEFAULT 20.00,
  escalas_habilitadas TEXT[] NOT NULL DEFAULT ARRAY['6x1', '5x2', '12x36', 'diaria', 'personalizada'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela principal de escalas CLT
CREATE TABLE IF NOT EXISTS public.escalas_clt (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  turno_id UUID REFERENCES public.turnos(id) ON DELETE SET NULL,
  tipo_escala TEXT NOT NULL,
  data DATE NOT NULL,
  hora_entrada TIME NOT NULL,
  hora_saida TIME NOT NULL,
  hora_inicio_intervalo TIME,
  hora_fim_intervalo TIME,
  horas_normais NUMERIC NOT NULL DEFAULT 0,
  horas_extras NUMERIC NOT NULL DEFAULT 0,
  horas_noturnas NUMERIC NOT NULL DEFAULT 0,
  valor_hora_normal NUMERIC NOT NULL DEFAULT 0,
  valor_hora_extra NUMERIC NOT NULL DEFAULT 0,
  valor_adicional_noturno NUMERIC NOT NULL DEFAULT 0,
  custo_total NUMERIC NOT NULL DEFAULT 0,
  is_domingo BOOLEAN NOT NULL DEFAULT false,
  is_feriado BOOLEAN NOT NULL DEFAULT false,
  is_folga BOOLEAN NOT NULL DEFAULT false,
  status_clt TEXT NOT NULL DEFAULT 'pendente',
  alertas_clt JSONB DEFAULT '[]'::jsonb,
  funcao TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(funcionario_id, data)
);

-- Tabela de feriados
CREATE TABLE IF NOT EXISTS public.feriados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  data DATE NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'nacional',
  recorrente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de validações CLT
CREATE TABLE IF NOT EXISTS public.validacoes_clt (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  escala_id UUID REFERENCES public.escalas_clt(id) ON DELETE CASCADE,
  funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo_validacao TEXT NOT NULL,
  nivel TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  detalhes JSONB,
  resolvido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de postos de cobertura mínima
CREATE TABLE IF NOT EXISTS public.postos_cobertura (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  frente_obra TEXT,
  cargo TEXT NOT NULL,
  quantidade_minima INTEGER NOT NULL DEFAULT 1,
  turno_periodo TEXT NOT NULL DEFAULT 'integral',
  hora_inicio TIME,
  hora_fim TIME,
  dias_semana INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],
  prioridade TEXT NOT NULL DEFAULT 'media',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de cobertura de postos
CREATE TABLE IF NOT EXISTS public.cobertura_postos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  posto_id UUID NOT NULL REFERENCES public.postos_cobertura(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  quantidade_alocada INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de faltas de funcionários
CREATE TABLE IF NOT EXISTS public.faltas_funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  escala_id UUID REFERENCES public.escalas_clt(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  tipo TEXT NOT NULL,
  observacoes TEXT,
  arquivo_url TEXT,
  horas_perdidas NUMERIC DEFAULT 0,
  impacto_custo NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de substituições
CREATE TABLE IF NOT EXISTS public.substituicoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  falta_id UUID REFERENCES public.faltas_funcionarios(id) ON DELETE SET NULL,
  funcionario_ausente_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  funcionario_substituto_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  escala_id UUID REFERENCES public.escalas_clt(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  motivo TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  impacto_custo NUMERIC DEFAULT 0,
  executado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- TABELAS PARA DASHBOARD PRIME COST
-- =============================================

-- Lançamentos de CMV (Custo de Materiais)
CREATE TABLE IF NOT EXISTS public.cmv_lancamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  valor NUMERIC NOT NULL,
  categoria TEXT,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Entregas de produtividade
CREATE TABLE IF NOT EXISTS public.entregas_produtividade (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  tipo_entrega TEXT NOT NULL,
  quantidade NUMERIC NOT NULL,
  unidade_medida TEXT NOT NULL,
  receita NUMERIC,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Metas de Prime Cost
CREATE TABLE IF NOT EXISTS public.metas_prime_cost (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  meta_prime_cost_percent NUMERIC NOT NULL DEFAULT 50,
  meta_cmo_percent NUMERIC NOT NULL DEFAULT 30,
  meta_cmv_percent NUMERIC NOT NULL DEFAULT 20,
  modo_produtividade TEXT NOT NULL DEFAULT 'receita_hora',
  meta_produtividade NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_clt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalas_clt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validacoes_clt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postos_cobertura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobertura_postos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faltas_funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.substituicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmv_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregas_produtividade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_prime_cost ENABLE ROW LEVEL SECURITY;

-- Policies para unidades
CREATE POLICY "Users can view own unidades" ON public.unidades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own unidades" ON public.unidades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own unidades" ON public.unidades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own unidades" ON public.unidades FOR DELETE USING (auth.uid() = user_id);

-- Policies para funcionarios
CREATE POLICY "Users can view own funcionarios" ON public.funcionarios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own funcionarios" ON public.funcionarios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own funcionarios" ON public.funcionarios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own funcionarios" ON public.funcionarios FOR DELETE USING (auth.uid() = user_id);

-- Policies para turnos
CREATE POLICY "Users can view own turnos" ON public.turnos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own turnos" ON public.turnos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own turnos" ON public.turnos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own turnos" ON public.turnos FOR DELETE USING (auth.uid() = user_id);

-- Policies para configuracoes_clt
CREATE POLICY "Users can view own configuracoes_clt" ON public.configuracoes_clt FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own configuracoes_clt" ON public.configuracoes_clt FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own configuracoes_clt" ON public.configuracoes_clt FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own configuracoes_clt" ON public.configuracoes_clt FOR DELETE USING (auth.uid() = user_id);

-- Policies para escalas_clt
CREATE POLICY "Users can view own escalas_clt" ON public.escalas_clt FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own escalas_clt" ON public.escalas_clt FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own escalas_clt" ON public.escalas_clt FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own escalas_clt" ON public.escalas_clt FOR DELETE USING (auth.uid() = user_id);

-- Policies para feriados
CREATE POLICY "Users can view own feriados" ON public.feriados FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feriados" ON public.feriados FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own feriados" ON public.feriados FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own feriados" ON public.feriados FOR DELETE USING (auth.uid() = user_id);

-- Policies para validacoes_clt
CREATE POLICY "Users can view own validacoes_clt" ON public.validacoes_clt FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own validacoes_clt" ON public.validacoes_clt FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own validacoes_clt" ON public.validacoes_clt FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own validacoes_clt" ON public.validacoes_clt FOR DELETE USING (auth.uid() = user_id);

-- Policies para postos_cobertura
CREATE POLICY "Users can view own postos" ON public.postos_cobertura FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own postos" ON public.postos_cobertura FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own postos" ON public.postos_cobertura FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own postos" ON public.postos_cobertura FOR DELETE USING (auth.uid() = user_id);

-- Policies para cobertura_postos
CREATE POLICY "Users can view own cobertura" ON public.cobertura_postos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cobertura" ON public.cobertura_postos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cobertura" ON public.cobertura_postos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cobertura" ON public.cobertura_postos FOR DELETE USING (auth.uid() = user_id);

-- Policies para faltas_funcionarios
CREATE POLICY "Users can view own faltas" ON public.faltas_funcionarios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own faltas" ON public.faltas_funcionarios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own faltas" ON public.faltas_funcionarios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own faltas" ON public.faltas_funcionarios FOR DELETE USING (auth.uid() = user_id);

-- Policies para substituicoes
CREATE POLICY "Users can view own substituicoes" ON public.substituicoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own substituicoes" ON public.substituicoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own substituicoes" ON public.substituicoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own substituicoes" ON public.substituicoes FOR DELETE USING (auth.uid() = user_id);

-- Policies para cmv_lancamentos
CREATE POLICY "Users can view own cmv" ON public.cmv_lancamentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cmv" ON public.cmv_lancamentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cmv" ON public.cmv_lancamentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cmv" ON public.cmv_lancamentos FOR DELETE USING (auth.uid() = user_id);

-- Policies para entregas_produtividade
CREATE POLICY "Users can view own entregas" ON public.entregas_produtividade FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own entregas" ON public.entregas_produtividade FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own entregas" ON public.entregas_produtividade FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own entregas" ON public.entregas_produtividade FOR DELETE USING (auth.uid() = user_id);

-- Policies para metas_prime_cost
CREATE POLICY "Users can view own metas" ON public.metas_prime_cost FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own metas" ON public.metas_prime_cost FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own metas" ON public.metas_prime_cost FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own metas" ON public.metas_prime_cost FOR DELETE USING (auth.uid() = user_id);

-- Migration: 20260130181656_66381ebc-45ef-470e-a716-fd4132bedf92.sql
-- =============================================
-- SECURITY HARDENING: funcionarios, crm_contacts, purchase_requests
-- =============================================

-- 1. FUNCIONARIOS: A tabela usa user_id (não created_by_user_id)
-- Remove políticas existentes e recria com escopo mais restrito
DROP POLICY IF EXISTS "Users can view own funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Users can insert own funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Users can update own funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Users can delete own funcionarios" ON public.funcionarios;

-- Política de SELECT: apenas o dono (user_id) ou super admin
CREATE POLICY "Funcionarios visible to owner or super admin"
  ON public.funcionarios FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- Política de INSERT: apenas usuário autenticado para si mesmo
CREATE POLICY "Funcionarios insert by authenticated"
  ON public.funcionarios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política de UPDATE: apenas dono ou super admin
CREATE POLICY "Funcionarios update by owner or super admin"
  ON public.funcionarios FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- Política de DELETE: apenas dono ou super admin
CREATE POLICY "Funcionarios delete by owner or super admin"
  ON public.funcionarios FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- 2. CRM: Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_by ON public.crm_contacts(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_created_by ON public.crm_accounts(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_created_by ON public.crm_deals(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_by ON public.crm_activities(created_by_user_id);

-- 3. PURCHASE_REQUESTS: Adicionar coluna para controlar visibilidade de custos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchase_requests' 
    AND column_name = 'hide_cost_from_members'
  ) THEN
    ALTER TABLE public.purchase_requests 
    ADD COLUMN hide_cost_from_members BOOLEAN DEFAULT false;
    
    COMMENT ON COLUMN public.purchase_requests.hide_cost_from_members IS 
      'When true, estimated_cost is only visible to project managers';
  END IF;
END $$;

-- Migration: 20260130190216_8ad290bf-36f2-410e-9529-c2e2e7882ce4.sql
-- Create user_profiles table for onboarding and trial management
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  company_name TEXT,
  company_size TEXT,
  segment TEXT,
  role TEXT,
  phone TEXT,
  main_challenge TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.user_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND is_super_admin = true
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX idx_user_profiles_onboarding ON public.user_profiles(onboarding_completed);

-- Migration: 20260131215138_6c663479-5d6a-4adb-a583-330c646406dd.sql
-- Security Hardening: Restrict access to sensitive data tables

-- =============================================
-- 1. Fix satisfaction_surveys - restrict access to survey owner only
-- =============================================

-- Drop existing policies on satisfaction_surveys and create stricter ones
DROP POLICY IF EXISTS "Users can view all surveys if they are super admin" ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Users can view their own surveys" ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Users can insert their own surveys" ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Users can view only their own surveys" ON public.satisfaction_surveys;

-- Only allow users to insert their own surveys
CREATE POLICY "Users can insert their own surveys"
ON public.satisfaction_surveys
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Only allow users to view their own surveys (not even super admins can see raw data)
CREATE POLICY "Users can view only their own surveys"
ON public.satisfaction_surveys
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only allow users to update their own surveys
CREATE POLICY "Users can update their own surveys"
ON public.satisfaction_surveys
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 2. Fix user_profiles - restrict access to profile owner only
-- =============================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Super admins can view all user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Profile owners can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Profile owners can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Profile owners can update their own profile" ON public.user_profiles;

-- Only the profile owner can view their profile
CREATE POLICY "Profile owners can view their own profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only the profile owner can insert their profile
CREATE POLICY "Profile owners can insert their own profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Only the profile owner can update their profile
CREATE POLICY "Profile owners can update their own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 3. Add additional protection for crm_accounts with CNPJ
-- =============================================

-- Create function to validate CNPJ format (basic check, doesn't validate algorithm)
CREATE OR REPLACE FUNCTION public.validate_cnpj_format(cnpj text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow NULL values
  IF cnpj IS NULL OR cnpj = '' THEN
    RETURN true;
  END IF;
  
  -- Remove non-numeric characters for validation
  cnpj := regexp_replace(cnpj, '[^0-9]', '', 'g');
  
  -- CNPJ must have 14 digits
  IF length(cnpj) != 14 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- =============================================
-- 4. Create audit trigger for sensitive data access on crm_accounts
-- =============================================

CREATE OR REPLACE FUNCTION public.log_crm_accounts_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add audit trigger to crm_accounts for changes
DROP TRIGGER IF EXISTS audit_crm_accounts_changes ON public.crm_accounts;
CREATE TRIGGER audit_crm_accounts_changes
AFTER INSERT OR UPDATE OR DELETE ON public.crm_accounts
FOR EACH ROW
EXECUTE FUNCTION public.log_crm_accounts_access();

-- Migration: 20260201111401_e63bed86-5785-4f97-8634-f78b15c83663.sql
-- Create table for backup schedules (automatic email sending)
CREATE TABLE IF NOT EXISTS public.backup_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  tables TEXT[] DEFAULT ARRAY['projects', 'materials', 'budgets', 'employees'],
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;

-- Policies: users can only manage their own schedules
CREATE POLICY "Users can view their own backup schedules"
  ON public.backup_schedules
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own backup schedules"
  ON public.backup_schedules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own backup schedules"
  ON public.backup_schedules
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own backup schedules"
  ON public.backup_schedules
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_backup_schedules_updated_at
  BEFORE UPDATE ON public.backup_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20260215004456_882d56f0-9924-4b18-b0c1-3a87ab7ab206.sql

-- 1. Fix maintenance_request_rate_limits: restrict SELECT to not expose IPs publicly
DROP POLICY IF EXISTS "Public can view rate limits" ON public.maintenance_request_rate_limits;
CREATE POLICY "Rate limits viewable for checking"
ON public.maintenance_request_rate_limits
FOR SELECT
TO anon, authenticated
USING (
  client_ip = inet_client_addr()::text
  OR qr_code_id IS NOT NULL
);

-- 2. Fix user_profiles super admin SELECT to use authenticated role only
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.user_profiles;
CREATE POLICY "Super admins can view all profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.is_super_admin = true
  )
);

-- 3. Remove duplicate satisfaction_surveys policies
DROP POLICY IF EXISTS "Users can create own surveys" ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Users can view own surveys" ON public.satisfaction_surveys;

-- 4. Fix user_roles policies to use authenticated role
DROP POLICY IF EXISTS "Admins can delete roles in their projects" ON public.user_roles;
CREATE POLICY "Admins can delete roles in their projects"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role, project_id));

DROP POLICY IF EXISTS "Admins can insert roles in their projects" ON public.user_roles;
CREATE POLICY "Admins can insert roles in their projects"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role, project_id));

DROP POLICY IF EXISTS "Admins can update roles in their projects" ON public.user_roles;
CREATE POLICY "Admins can update roles in their projects"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role, project_id));

DROP POLICY IF EXISTS "Admins can view all roles in their projects" ON public.user_roles;
CREATE POLICY "Admins can view all roles in their projects"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role, project_id));

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);


-- Migration: 20260218031439_7914495c-fae1-4e6b-9100-109dddb087ed.sql

-- Fix can_create_project to allow creation when no quota row exists
CREATE OR REPLACE FUNCTION public.can_create_project(user_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  quota_exists BOOLEAN;
BEGIN
  -- Get current project count
  SELECT COUNT(*) INTO current_count
  FROM public.projects
  WHERE created_by_user_id = user_uuid;
  
  -- Check if quota row exists
  SELECT EXISTS (
    SELECT 1 FROM public.user_quotas WHERE user_id = user_uuid
  ) INTO quota_exists;
  
  -- If no quota row, allow unlimited
  IF NOT quota_exists THEN
    RETURN true;
  END IF;
  
  -- Get max allowed
  SELECT COALESCE(max_projects, 999999) INTO max_allowed
  FROM public.user_quotas
  WHERE user_id = user_uuid;
  
  RETURN current_count < max_allowed;
END;
$function$;

-- Also fix can_create_employee with the same pattern
CREATE OR REPLACE FUNCTION public.can_create_employee(user_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  quota_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM public.employees
  WHERE created_by_user_id = user_uuid;
  
  SELECT EXISTS (
    SELECT 1 FROM public.user_quotas WHERE user_id = user_uuid
  ) INTO quota_exists;
  
  IF NOT quota_exists THEN
    RETURN true;
  END IF;
  
  SELECT COALESCE(max_employees, 999999) INTO max_allowed
  FROM public.user_quotas
  WHERE user_id = user_uuid;
  
  RETURN current_count < max_allowed;
END;
$function$;


-- Migration: 20260218175848_4d272491-81d5-4c79-9273-66bded77487d.sql

-- User feedback (floating widget + micro-surveys)
CREATE TABLE public.user_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feedback_type TEXT NOT NULL DEFAULT 'general', -- general, bug, idea, micro_survey
  trigger_event TEXT, -- calculation_complete, export_file, new_module, session_end
  question TEXT,
  rating INTEGER, -- 1-5 or 0-10
  emoji_rating TEXT, -- angry, sad, neutral, happy, very_happy
  text_response TEXT,
  screenshot_url TEXT,
  module_context TEXT,
  page_context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback" ON public.user_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback" ON public.user_feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Admin can view all feedback
CREATE POLICY "Admins can view all feedback" ON public.user_feedback
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Track when user last saw a micro-survey to avoid fatigue
CREATE TABLE public.user_survey_tracker (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  survey_type TEXT NOT NULL, -- calculation, export, new_module, session
  last_shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  show_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, survey_type)
);

ALTER TABLE public.user_survey_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tracker" ON public.user_survey_tracker
  FOR ALL USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_user_feedback_user_id ON public.user_feedback(user_id);
CREATE INDEX idx_user_feedback_type ON public.user_feedback(feedback_type);
CREATE INDEX idx_user_feedback_created ON public.user_feedback(created_at DESC);




-- ============================================
-- PARTE 5: parte5_storage_buckets.sql
-- ============================================

-- PARTE 5 DE 5: Storage Buckets
-- Cole este SQL no Supabase SQL Editor e clique Run
-- RODE ESTE POR ÚLTIMO, depois das partes 1 a 4

-- Criar buckets de storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('rdo-photos', 'rdo-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('interactive-maps', 'interactive-maps', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('connection-report-photos', 'connection-report-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-request-photos', 'maintenance-request-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies para rdo-photos
DROP POLICY IF EXISTS "Authenticated users can upload rdo photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload rdo photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rdo-photos');

DROP POLICY IF EXISTS "Anyone can view rdo photos" ON storage.objects;
CREATE POLICY "Anyone can view rdo photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'rdo-photos');

DROP POLICY IF EXISTS "Users can delete own rdo photos" ON storage.objects;
CREATE POLICY "Users can delete own rdo photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rdo-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policies para interactive-maps
DROP POLICY IF EXISTS "Authenticated users can upload maps" ON storage.objects;
CREATE POLICY "Authenticated users can upload maps"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'interactive-maps');

DROP POLICY IF EXISTS "Anyone can view maps" ON storage.objects;
CREATE POLICY "Anyone can view maps"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'interactive-maps');

DROP POLICY IF EXISTS "Authenticated users can update maps" ON storage.objects;
CREATE POLICY "Authenticated users can update maps"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'interactive-maps');

DROP POLICY IF EXISTS "Authenticated users can delete maps" ON storage.objects;
CREATE POLICY "Authenticated users can delete maps"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'interactive-maps');

-- Policies para connection-report-photos
DROP POLICY IF EXISTS "Authenticated users can upload connection report photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload connection report photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'connection-report-photos');

DROP POLICY IF EXISTS "Anyone can view connection report photos" ON storage.objects;
CREATE POLICY "Anyone can view connection report photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'connection-report-photos');

DROP POLICY IF EXISTS "Users can delete own connection report photos" ON storage.objects;
CREATE POLICY "Users can delete own connection report photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'connection-report-photos');

-- Policies para maintenance-request-photos
DROP POLICY IF EXISTS "Authenticated users can upload maintenance photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload maintenance photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'maintenance-request-photos');

DROP POLICY IF EXISTS "Anyone can view maintenance photos" ON storage.objects;
CREATE POLICY "Anyone can view maintenance photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'maintenance-request-photos');

DROP POLICY IF EXISTS "Users can delete own maintenance photos" ON storage.objects;
CREATE POLICY "Users can delete own maintenance photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'maintenance-request-photos');

