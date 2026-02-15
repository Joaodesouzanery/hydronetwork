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