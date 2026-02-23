import { useState } from 'react';
import { AlertTriangle, Copy, Check, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const SETUP_SQL = `-- ===========================================
-- EXECUTAR NO SQL EDITOR DO SUPABASE
-- (Supabase Dashboard > SQL Editor > New Query)
-- ===========================================

-- Limpar tabelas/tipos antigos se existirem
DROP TABLE IF EXISTS public.lps_constraint_audit CASCADE;
DROP TABLE IF EXISTS public.lps_five_whys CASCADE;
DROP TABLE IF EXISTS public.lps_weekly_commitments CASCADE;
DROP TABLE IF EXISTS public.lps_constraints CASCADE;
DROP TYPE IF EXISTS public.lps_constraint_type CASCADE;
DROP TYPE IF EXISTS public.lps_constraint_status CASCADE;
DROP TYPE IF EXISTS public.lps_impact_level CASCADE;
DROP TYPE IF EXISTS public.lps_commitment_status CASCADE;

-- Funcao helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Tabela principal: lps_constraints (usa TEXT, nao ENUM)
CREATE TABLE public.lps_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service_front_id UUID REFERENCES public.service_fronts(id) ON DELETE SET NULL,
  tipo_restricao TEXT NOT NULL,
  descricao TEXT NOT NULL,
  responsavel_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  responsavel_nome TEXT,
  data_identificacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista_resolucao DATE,
  data_resolvida DATE,
  status TEXT NOT NULL DEFAULT 'ativa',
  impacto TEXT NOT NULL DEFAULT 'medio',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  origem TEXT NOT NULL DEFAULT 'manual',
  justification_id UUID,
  daily_report_id UUID,
  parent_constraint_id UUID,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lps_constraints ADD CONSTRAINT lps_constraints_parent_fk FOREIGN KEY (parent_constraint_id) REFERENCES public.lps_constraints(id) ON DELETE SET NULL;
ALTER TABLE public.lps_constraints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lps_constraints_select" ON public.lps_constraints FOR SELECT TO authenticated USING (true);
CREATE POLICY "lps_constraints_insert" ON public.lps_constraints FOR INSERT TO authenticated WITH CHECK (created_by_user_id = auth.uid());
CREATE POLICY "lps_constraints_update" ON public.lps_constraints FOR UPDATE TO authenticated USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_constraints_delete" ON public.lps_constraints FOR DELETE TO authenticated USING (created_by_user_id = auth.uid());
CREATE TRIGGER update_lps_constraints_updated_at BEFORE UPDATE ON public.lps_constraints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela: lps_weekly_commitments
CREATE TABLE public.lps_weekly_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service_front_id UUID REFERENCES public.service_fronts(id) ON DELETE SET NULL,
  semana_inicio DATE NOT NULL, semana_fim DATE NOT NULL,
  descricao_tarefa TEXT NOT NULL, service_id UUID,
  quantidade_planejada NUMERIC(12,2), quantidade_executada NUMERIC(12,2) DEFAULT 0,
  unidade TEXT, status TEXT NOT NULL DEFAULT 'planejado',
  motivo_nao_cumprimento TEXT,
  constraint_id UUID REFERENCES public.lps_constraints(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lps_weekly_commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lps_commitments_select" ON public.lps_weekly_commitments FOR SELECT TO authenticated USING (true);
CREATE POLICY "lps_commitments_insert" ON public.lps_weekly_commitments FOR INSERT TO authenticated WITH CHECK (created_by_user_id = auth.uid());
CREATE POLICY "lps_commitments_update" ON public.lps_weekly_commitments FOR UPDATE TO authenticated USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_commitments_delete" ON public.lps_weekly_commitments FOR DELETE TO authenticated USING (created_by_user_id = auth.uid());
CREATE TRIGGER update_lps_weekly_commitments_updated_at BEFORE UPDATE ON public.lps_weekly_commitments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela: lps_five_whys
CREATE TABLE public.lps_five_whys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  constraint_id UUID NOT NULL REFERENCES public.lps_constraints(id) ON DELETE CASCADE,
  why_1 TEXT NOT NULL, why_2 TEXT, why_3 TEXT, why_4 TEXT, why_5 TEXT,
  causa_raiz TEXT NOT NULL, acao_corretiva TEXT NOT NULL,
  responsavel_acao TEXT, prazo_acao DATE, status_acao TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lps_five_whys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lps_five_whys_select" ON public.lps_five_whys FOR SELECT TO authenticated USING (true);
CREATE POLICY "lps_five_whys_insert" ON public.lps_five_whys FOR INSERT TO authenticated WITH CHECK (created_by_user_id = auth.uid());
CREATE POLICY "lps_five_whys_update" ON public.lps_five_whys FOR UPDATE TO authenticated USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_five_whys_delete" ON public.lps_five_whys FOR DELETE TO authenticated USING (created_by_user_id = auth.uid());
CREATE TRIGGER update_lps_five_whys_updated_at BEFORE UPDATE ON public.lps_five_whys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela: lps_constraint_audit
CREATE TABLE public.lps_constraint_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  constraint_id UUID NOT NULL REFERENCES public.lps_constraints(id) ON DELETE CASCADE,
  action TEXT NOT NULL, field TEXT, old_value TEXT, new_value TEXT,
  user_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lps_constraint_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lps_audit_select" ON public.lps_constraint_audit FOR SELECT TO authenticated USING (true);
CREATE POLICY "lps_audit_insert" ON public.lps_constraint_audit FOR INSERT TO authenticated WITH CHECK (true);

-- GRANT (obrigatorio para PostgREST enxergar as tabelas)
GRANT ALL ON public.lps_constraints TO anon, authenticated, service_role;
GRANT ALL ON public.lps_weekly_commitments TO anon, authenticated, service_role;
GRANT ALL ON public.lps_five_whys TO anon, authenticated, service_role;
GRANT ALL ON public.lps_constraint_audit TO anon, authenticated, service_role;

-- Recarregar schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');`;

export function LpsSetupBanner({ onRetry }: { onRetry: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SQL);
      setCopied(true);
      toast.success('SQL copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Falha ao copiar. Expanda e copie manualmente.');
    }
  };

  return (
    <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-2 flex-1">
          <h3 className="font-bold text-amber-900 text-lg">
            Tabelas do Modulo Lean nao encontradas no banco de dados
          </h3>
          <p className="text-amber-800 text-sm">
            A tabela <code className="bg-amber-100 px-1 rounded">lps_constraints</code> nao existe ou nao esta acessivel no Supabase.
            Siga os passos abaixo para configurar:
          </p>

          <ol className="text-amber-800 text-sm space-y-1 list-decimal list-inside">
            <li>Acesse o <strong>Supabase Dashboard</strong> do seu projeto</li>
            <li>Va em <strong>SQL Editor</strong> (menu lateral)</li>
            <li>Clique em <strong>"New Query"</strong></li>
            <li>Cole o SQL abaixo e clique em <strong>"Run"</strong></li>
            <li>Volte aqui e clique em <strong>"Verificar Novamente"</strong></li>
          </ol>

          <div className="flex gap-2 pt-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleCopy}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? 'Copiado!' : 'Copiar SQL'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              {expanded ? 'Ocultar SQL' : 'Ver SQL'}
            </Button>
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-1" /> Verificar Novamente
            </Button>
          </div>

          {expanded && (
            <pre className="mt-3 bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-auto max-h-96 whitespace-pre-wrap">
              {SETUP_SQL}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
