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
