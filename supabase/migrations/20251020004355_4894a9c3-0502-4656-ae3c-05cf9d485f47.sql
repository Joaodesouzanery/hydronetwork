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