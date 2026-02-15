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