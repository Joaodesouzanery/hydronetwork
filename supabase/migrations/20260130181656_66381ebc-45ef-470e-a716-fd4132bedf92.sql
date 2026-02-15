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