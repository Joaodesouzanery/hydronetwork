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