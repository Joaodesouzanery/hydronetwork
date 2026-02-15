-- Create table to store satisfaction survey responses
CREATE TABLE public.satisfaction_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  
  -- Section 1 - Profile
  user_profile TEXT NOT NULL,
  user_profile_other TEXT,
  operation_type TEXT NOT NULL,
  operation_type_other TEXT,
  users_count TEXT NOT NULL,
  
  -- Section 2 - NPS
  nps_score INTEGER NOT NULL CHECK (nps_score >= 0 AND nps_score <= 10),
  nps_justification TEXT,
  
  -- Section 3 - Satisfaction
  general_satisfaction TEXT NOT NULL,
  help_areas TEXT[] DEFAULT '{}',
  one_sentence_summary TEXT,
  
  -- Section 4 - Effort
  ease_of_start TEXT NOT NULL,
  initial_difficulty TEXT NOT NULL,
  initial_difficulty_other TEXT,
  
  -- Section 5 - Product
  most_used_features TEXT[] DEFAULT '{}',
  urgent_improvement TEXT NOT NULL,
  urgent_improvement_other TEXT,
  
  -- Section 6 - Churn Risk
  would_stop_using TEXT NOT NULL,
  stop_reason TEXT,
  solution_expectation TEXT,
  
  -- Section 7 - Data Trust
  data_trust_level TEXT NOT NULL,
  trust_issues TEXT[] DEFAULT '{}',
  trust_issues_other TEXT,
  
  -- Section 8 - ROI
  generated_results TEXT NOT NULL,
  hours_saved_per_week DECIMAL(10,2),
  monthly_savings DECIMAL(10,2),
  
  -- Section 9 - Support
  support_resolution TEXT NOT NULL,
  preferred_support_format TEXT NOT NULL,
  
  -- Section 10 - Improvements
  one_improvement TEXT,
  indispensable_feature TEXT,
  desired_features TEXT[] DEFAULT '{}',
  
  -- Section 11 - Referral
  would_recommend TEXT NOT NULL,
  referral_target TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMP WITH TIME ZONE,
  next_available_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- Users can view their own surveys
CREATE POLICY "Users can view own surveys"
  ON public.satisfaction_surveys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own surveys
CREATE POLICY "Users can create own surveys"
  ON public.satisfaction_surveys FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all surveys (for export)
CREATE POLICY "Admins can view all surveys"
  ON public.satisfaction_surveys FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND (role = 'admin' OR is_super_admin = true)
    )
  );

-- Index for user lookups
CREATE INDEX idx_satisfaction_surveys_user_id ON public.satisfaction_surveys(user_id);
CREATE INDEX idx_satisfaction_surveys_created_at ON public.satisfaction_surveys(created_at DESC);