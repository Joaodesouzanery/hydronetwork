-- Dashboard Configurations Table
CREATE TABLE public.dashboard_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  global_filters JSONB DEFAULT '{}'::jsonb,
  layout JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Dashboard Widgets Table
CREATE TABLE public.dashboard_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id UUID NOT NULL REFERENCES public.dashboard_configs(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  title TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 4,
  height INTEGER DEFAULT 3,
  data_source TEXT,
  filters JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Dashboard Configs Policies
CREATE POLICY "Users can view their own dashboards"
ON public.dashboard_configs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dashboards"
ON public.dashboard_configs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboards"
ON public.dashboard_configs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboards"
ON public.dashboard_configs FOR DELETE
USING (auth.uid() = user_id);

-- Dashboard Widgets Policies
CREATE POLICY "Users can view widgets from their dashboards"
ON public.dashboard_widgets FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.dashboard_configs
  WHERE dashboard_configs.id = dashboard_widgets.dashboard_id
  AND dashboard_configs.user_id = auth.uid()
));

CREATE POLICY "Users can create widgets in their dashboards"
ON public.dashboard_widgets FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.dashboard_configs
  WHERE dashboard_configs.id = dashboard_widgets.dashboard_id
  AND dashboard_configs.user_id = auth.uid()
));

CREATE POLICY "Users can update widgets in their dashboards"
ON public.dashboard_widgets FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.dashboard_configs
  WHERE dashboard_configs.id = dashboard_widgets.dashboard_id
  AND dashboard_configs.user_id = auth.uid()
));

CREATE POLICY "Users can delete widgets from their dashboards"
ON public.dashboard_widgets FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.dashboard_configs
  WHERE dashboard_configs.id = dashboard_widgets.dashboard_id
  AND dashboard_configs.user_id = auth.uid()
));

-- Add triggers for updated_at
CREATE TRIGGER update_dashboard_configs_updated_at
BEFORE UPDATE ON public.dashboard_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at
BEFORE UPDATE ON public.dashboard_widgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_dashboard_configs_user_id ON public.dashboard_configs(user_id);
CREATE INDEX idx_dashboard_widgets_dashboard_id ON public.dashboard_widgets(dashboard_id);

-- Enable realtime for dashboards
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_configs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_widgets;

-- Fix security issue: Strengthen employees table RLS policies
-- The current policies are correct but need to add redundant protection
DROP POLICY IF EXISTS "Users can view employees from their projects" ON public.employees;

CREATE POLICY "Users can view employees from their projects"
ON public.employees FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    created_by_user_id = auth.uid() OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = employees.project_id
      AND projects.created_by_user_id = auth.uid()
    )) OR
    (construction_site_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM construction_sites cs
      JOIN projects p ON p.id = cs.project_id
      WHERE cs.id = employees.construction_site_id
      AND p.created_by_user_id = auth.uid()
    ))
  )
);

-- Fix security issue: Strengthen labor_tracking table RLS policies
DROP POLICY IF EXISTS "Users can view labor tracking from their projects" ON public.labor_tracking;

CREATE POLICY "Users can view labor tracking from their projects"
ON public.labor_tracking FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = labor_tracking.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);