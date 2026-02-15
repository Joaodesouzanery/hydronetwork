-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, project_id)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role, _project_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (project_id = _project_id OR _project_id IS NULL)
  )
$$;

-- Create function to check if user is admin of any project
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles in their projects"
ON public.user_roles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin', project_id)
);

CREATE POLICY "Admins can insert roles in their projects"
ON public.user_roles
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin', project_id)
);

CREATE POLICY "Admins can update roles in their projects"
ON public.user_roles
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin', project_id)
);

CREATE POLICY "Admins can delete roles in their projects"
ON public.user_roles
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin', project_id)
);

-- Create trigger for updated_at
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for backups metadata
CREATE TABLE public.backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  backup_type TEXT NOT NULL, -- 'manual' or 'automatic'
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'failed', 'in_progress'
  file_path TEXT,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for backups
CREATE POLICY "Users can view their own backups"
ON public.backups
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create backups"
ON public.backups
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all backups in their projects"
ON public.backups
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin', project_id)
);