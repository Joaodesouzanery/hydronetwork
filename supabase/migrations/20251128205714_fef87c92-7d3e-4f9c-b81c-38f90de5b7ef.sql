-- Create pending_actions table for approval workflow
CREATE TABLE IF NOT EXISTS public.pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  action_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  resource_data JSONB,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;

-- Create action_approvals table
CREATE TABLE IF NOT EXISTS public.action_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_action_id UUID REFERENCES public.pending_actions(id) ON DELETE CASCADE NOT NULL,
  admin_user_id UUID REFERENCES auth.users(id) NOT NULL,
  approved BOOLEAN NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add unique constraint for approvals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'action_approvals_pending_action_id_admin_user_id_key'
  ) THEN
    ALTER TABLE public.action_approvals ADD CONSTRAINT action_approvals_pending_action_id_admin_user_id_key UNIQUE(pending_action_id, admin_user_id);
  END IF;
END $$;

ALTER TABLE public.action_approvals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own requests" ON public.pending_actions;
DROP POLICY IF EXISTS "Admins can view all pending actions" ON public.pending_actions;
DROP POLICY IF EXISTS "Colaboradores can create action requests" ON public.pending_actions;
DROP POLICY IF EXISTS "Admins can update action status" ON public.pending_actions;
DROP POLICY IF EXISTS "Anyone can view approvals for their requests" ON public.action_approvals;
DROP POLICY IF EXISTS "Admins can create approvals" ON public.action_approvals;

-- RLS for pending_actions
CREATE POLICY "Users can view their own requests"
ON public.pending_actions
FOR SELECT
USING (auth.uid() = requested_by_user_id);

CREATE POLICY "Admins can view all pending actions"
ON public.pending_actions
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can create action requests"
ON public.pending_actions
FOR INSERT
WITH CHECK (auth.uid() = requested_by_user_id);

CREATE POLICY "Admins can update action status"
ON public.pending_actions
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- RLS for action_approvals
CREATE POLICY "Anyone can view approvals for their requests"
ON public.action_approvals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.pending_actions pa
    WHERE pa.id = action_approvals.pending_action_id
      AND (pa.requested_by_user_id = auth.uid() OR public.is_admin(auth.uid()))
  )
);

CREATE POLICY "Admins can create approvals"
ON public.action_approvals
FOR INSERT
WITH CHECK (
  public.is_admin(auth.uid()) AND
  auth.uid() = admin_user_id
);

-- Create audit_log table for tracking edits
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing audit log policies
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

CREATE POLICY "Admins can view all audit logs"
ON public.audit_log
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own audit logs"
ON public.audit_log
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs"
ON public.audit_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add trigger to update updated_at if not exists
DROP TRIGGER IF EXISTS update_pending_actions_updated_at ON public.pending_actions;
CREATE TRIGGER update_pending_actions_updated_at
BEFORE UPDATE ON public.pending_actions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();