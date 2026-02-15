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