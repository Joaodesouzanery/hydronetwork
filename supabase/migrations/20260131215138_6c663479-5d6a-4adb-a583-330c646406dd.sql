-- Security Hardening: Restrict access to sensitive data tables

-- =============================================
-- 1. Fix satisfaction_surveys - restrict access to survey owner only
-- =============================================

-- Drop existing policies on satisfaction_surveys and create stricter ones
DROP POLICY IF EXISTS "Users can view all surveys if they are super admin" ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Users can view their own surveys" ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Users can insert their own surveys" ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "Users can view only their own surveys" ON public.satisfaction_surveys;

-- Only allow users to insert their own surveys
CREATE POLICY "Users can insert their own surveys"
ON public.satisfaction_surveys
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Only allow users to view their own surveys (not even super admins can see raw data)
CREATE POLICY "Users can view only their own surveys"
ON public.satisfaction_surveys
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only allow users to update their own surveys
CREATE POLICY "Users can update their own surveys"
ON public.satisfaction_surveys
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 2. Fix user_profiles - restrict access to profile owner only
-- =============================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Super admins can view all user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Profile owners can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Profile owners can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Profile owners can update their own profile" ON public.user_profiles;

-- Only the profile owner can view their profile
CREATE POLICY "Profile owners can view their own profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only the profile owner can insert their profile
CREATE POLICY "Profile owners can insert their own profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Only the profile owner can update their profile
CREATE POLICY "Profile owners can update their own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 3. Add additional protection for crm_accounts with CNPJ
-- =============================================

-- Create function to validate CNPJ format (basic check, doesn't validate algorithm)
CREATE OR REPLACE FUNCTION public.validate_cnpj_format(cnpj text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow NULL values
  IF cnpj IS NULL OR cnpj = '' THEN
    RETURN true;
  END IF;
  
  -- Remove non-numeric characters for validation
  cnpj := regexp_replace(cnpj, '[^0-9]', '', 'g');
  
  -- CNPJ must have 14 digits
  IF length(cnpj) != 14 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- =============================================
-- 4. Create audit trigger for sensitive data access on crm_accounts
-- =============================================

CREATE OR REPLACE FUNCTION public.log_crm_accounts_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add audit trigger to crm_accounts for changes
DROP TRIGGER IF EXISTS audit_crm_accounts_changes ON public.crm_accounts;
CREATE TRIGGER audit_crm_accounts_changes
AFTER INSERT OR UPDATE OR DELETE ON public.crm_accounts
FOR EACH ROW
EXECUTE FUNCTION public.log_crm_accounts_access();