
-- User feedback (floating widget + micro-surveys)
CREATE TABLE public.user_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feedback_type TEXT NOT NULL DEFAULT 'general', -- general, bug, idea, micro_survey
  trigger_event TEXT, -- calculation_complete, export_file, new_module, session_end
  question TEXT,
  rating INTEGER, -- 1-5 or 0-10
  emoji_rating TEXT, -- angry, sad, neutral, happy, very_happy
  text_response TEXT,
  screenshot_url TEXT,
  module_context TEXT,
  page_context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback" ON public.user_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback" ON public.user_feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Admin can view all feedback
CREATE POLICY "Admins can view all feedback" ON public.user_feedback
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Track when user last saw a micro-survey to avoid fatigue
CREATE TABLE public.user_survey_tracker (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  survey_type TEXT NOT NULL, -- calculation, export, new_module, session
  last_shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  show_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, survey_type)
);

ALTER TABLE public.user_survey_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tracker" ON public.user_survey_tracker
  FOR ALL USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_user_feedback_user_id ON public.user_feedback(user_id);
CREATE INDEX idx_user_feedback_type ON public.user_feedback(feedback_type);
CREATE INDEX idx_user_feedback_created ON public.user_feedback(created_at DESC);
