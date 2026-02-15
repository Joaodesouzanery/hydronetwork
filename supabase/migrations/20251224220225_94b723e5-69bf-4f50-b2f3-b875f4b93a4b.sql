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