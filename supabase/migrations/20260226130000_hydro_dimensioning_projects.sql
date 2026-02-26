-- ============================================================
-- HYDRO DIMENSIONING PROJECTS: Persistent storage for planning
-- Replaces localStorage-only approach with Supabase persistence
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hydro_dimensioning_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  nome TEXT NOT NULL,
  project_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hydro_dimensioning_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hdp_select" ON public.hydro_dimensioning_projects FOR SELECT USING (true);
CREATE POLICY "hdp_insert" ON public.hydro_dimensioning_projects FOR INSERT WITH CHECK (true);
CREATE POLICY "hdp_update" ON public.hydro_dimensioning_projects FOR UPDATE USING (true);
CREATE POLICY "hdp_delete" ON public.hydro_dimensioning_projects FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_hdp_user ON public.hydro_dimensioning_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_hdp_nome ON public.hydro_dimensioning_projects(nome);

CREATE TRIGGER update_hdp_updated_at
  BEFORE UPDATE ON public.hydro_dimensioning_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT ALL ON public.hydro_dimensioning_projects TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
