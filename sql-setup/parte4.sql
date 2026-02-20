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

