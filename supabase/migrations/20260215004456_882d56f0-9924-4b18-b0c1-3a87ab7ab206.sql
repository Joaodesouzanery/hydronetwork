
-- 1. Fix maintenance_request_rate_limits: restrict SELECT to not expose IPs publicly
DROP POLICY IF EXISTS "Public can view rate limits" ON public.maintenance_request_rate_limits;
CREATE POLICY "Rate limits viewable for checking"
ON public.maintenance_request_rate_limits
FOR SELECT
TO anon, authenticated
USING (
  client_ip = inet_client_addr()::text
  OR qr_code_id IS NOT NULL
);

-- 2. Fix user_profiles super admin SELECT to use authenticated role only
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.user_profiles;
CREATE POLICY "Super admins can view all profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.is_super_admin = true
  )
);

-- 3. Remove duplicate satisfaction_surveys policies
DROP POLICY IF EXISTS "Users can create own surveys" ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Users can view own surveys" ON public.satisfaction_surveys;

-- 4. Fix user_roles policies to use authenticated role
DROP POLICY IF EXISTS "Admins can delete roles in their projects" ON public.user_roles;
CREATE POLICY "Admins can delete roles in their projects"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role, project_id));

DROP POLICY IF EXISTS "Admins can insert roles in their projects" ON public.user_roles;
CREATE POLICY "Admins can insert roles in their projects"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role, project_id));

DROP POLICY IF EXISTS "Admins can update roles in their projects" ON public.user_roles;
CREATE POLICY "Admins can update roles in their projects"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role, project_id));

DROP POLICY IF EXISTS "Admins can view all roles in their projects" ON public.user_roles;
CREATE POLICY "Admins can view all roles in their projects"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role, project_id));

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
