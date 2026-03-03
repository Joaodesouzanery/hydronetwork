-- ============================================================
-- PROJECT APPROVAL CONTROL
-- Tracks document/project submissions through approval stages
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_approval_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  project_id UUID,
  nome_projeto TEXT NOT NULL,
  etapa TEXT NOT NULL,
  sub_etapa TEXT,
  emissor TEXT NOT NULL,
  destinatario TEXT,
  data_envio TIMESTAMPTZ NOT NULL DEFAULT now(),
  prazo TIMESTAMPTZ,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','em_analise','aprovado','reprovado','revisao')),
  observacoes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_approval_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pac_select" ON public.project_approval_control FOR SELECT USING (true);
CREATE POLICY "pac_insert" ON public.project_approval_control FOR INSERT WITH CHECK (true);
CREATE POLICY "pac_update" ON public.project_approval_control FOR UPDATE USING (true);
CREATE POLICY "pac_delete" ON public.project_approval_control FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_pac_user ON public.project_approval_control(user_id);
CREATE INDEX IF NOT EXISTS idx_pac_status ON public.project_approval_control(status);
CREATE INDEX IF NOT EXISTS idx_pac_prazo ON public.project_approval_control(prazo);

CREATE TRIGGER update_pac_updated_at
  BEFORE UPDATE ON public.project_approval_control
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT ALL ON public.project_approval_control TO anon, authenticated, service_role;

-- Admin view
CREATE OR REPLACE VIEW public.admin_approval_control AS
SELECT
  pac.id,
  pac.user_id,
  pac.nome_projeto,
  pac.etapa,
  pac.sub_etapa,
  pac.emissor,
  pac.destinatario,
  pac.data_envio,
  pac.prazo,
  pac.status,
  pac.observacoes,
  pac.updated_at,
  CASE WHEN pac.prazo < now() AND pac.status IN ('pendente','em_analise') THEN true ELSE false END AS vencido
FROM public.project_approval_control pac;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
