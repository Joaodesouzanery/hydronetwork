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