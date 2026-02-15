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