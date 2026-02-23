import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, Database, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const SETUP_SQL = `-- ===========================================
-- Módulo LPS / Lean - Setup das Tabelas
-- Cole no SQL Editor do Supabase e clique Run
-- ===========================================

-- Função helper para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Tabela lps_constraints
CREATE TABLE IF NOT EXISTS public.lps_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  service_front_id UUID,
  tipo_restricao TEXT NOT NULL,
  descricao TEXT NOT NULL,
  responsavel_id UUID,
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

-- Tabela lps_weekly_commitments
CREATE TABLE IF NOT EXISTS public.lps_weekly_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  service_front_id UUID,
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  descricao_tarefa TEXT NOT NULL,
  service_id UUID,
  quantidade_planejada NUMERIC(12,2),
  quantidade_executada NUMERIC(12,2) DEFAULT 0,
  unidade TEXT,
  status TEXT NOT NULL DEFAULT 'planejado',
  motivo_nao_cumprimento TEXT,
  constraint_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela lps_five_whys
CREATE TABLE IF NOT EXISTS public.lps_five_whys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  constraint_id UUID NOT NULL,
  why_1 TEXT NOT NULL,
  why_2 TEXT,
  why_3 TEXT,
  why_4 TEXT,
  why_5 TEXT,
  causa_raiz TEXT NOT NULL,
  acao_corretiva TEXT NOT NULL,
  responsavel_acao TEXT,
  prazo_acao DATE,
  status_acao TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela lps_constraint_audit
CREATE TABLE IF NOT EXISTS public.lps_constraint_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  constraint_id UUID NOT NULL,
  action TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  user_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.lps_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_weekly_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_five_whys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_constraint_audit ENABLE ROW LEVEL SECURITY;

-- Policies permissivas
DO $$ BEGIN
  CREATE POLICY "lps_constraints_select" ON public.lps_constraints FOR SELECT USING (true);
  CREATE POLICY "lps_constraints_insert" ON public.lps_constraints FOR INSERT WITH CHECK (true);
  CREATE POLICY "lps_constraints_update" ON public.lps_constraints FOR UPDATE USING (true);
  CREATE POLICY "lps_constraints_delete" ON public.lps_constraints FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "lps_commitments_select" ON public.lps_weekly_commitments FOR SELECT USING (true);
  CREATE POLICY "lps_commitments_insert" ON public.lps_weekly_commitments FOR INSERT WITH CHECK (true);
  CREATE POLICY "lps_commitments_update" ON public.lps_weekly_commitments FOR UPDATE USING (true);
  CREATE POLICY "lps_commitments_delete" ON public.lps_weekly_commitments FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "lps_five_whys_select" ON public.lps_five_whys FOR SELECT USING (true);
  CREATE POLICY "lps_five_whys_insert" ON public.lps_five_whys FOR INSERT WITH CHECK (true);
  CREATE POLICY "lps_five_whys_update" ON public.lps_five_whys FOR UPDATE USING (true);
  CREATE POLICY "lps_five_whys_delete" ON public.lps_five_whys FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "lps_audit_select" ON public.lps_constraint_audit FOR SELECT USING (true);
  CREATE POLICY "lps_audit_insert" ON public.lps_constraint_audit FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Triggers
DO $$ BEGIN
  CREATE TRIGGER update_lps_constraints_updated_at BEFORE UPDATE ON public.lps_constraints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_lps_weekly_commitments_updated_at BEFORE UPDATE ON public.lps_weekly_commitments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_lps_five_whys_updated_at BEFORE UPDATE ON public.lps_five_whys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lps_constraints_project ON public.lps_constraints(project_id);
CREATE INDEX IF NOT EXISTS idx_lps_constraints_status ON public.lps_constraints(status);
CREATE INDEX IF NOT EXISTS idx_lps_constraints_front ON public.lps_constraints(service_front_id);
CREATE INDEX IF NOT EXISTS idx_lps_constraints_date ON public.lps_constraints(data_identificacao DESC);
CREATE INDEX IF NOT EXISTS idx_lps_constraints_type ON public.lps_constraints(tipo_restricao);
CREATE INDEX IF NOT EXISTS idx_lps_commitments_project ON public.lps_weekly_commitments(project_id);
CREATE INDEX IF NOT EXISTS idx_lps_commitments_week ON public.lps_weekly_commitments(semana_inicio);
CREATE INDEX IF NOT EXISTS idx_lps_five_whys_constraint ON public.lps_five_whys(constraint_id);
CREATE INDEX IF NOT EXISTS idx_lps_audit_constraint ON public.lps_constraint_audit(constraint_id);

-- GRANT
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.lps_constraints TO anon, authenticated, service_role;
GRANT ALL ON public.lps_weekly_commitments TO anon, authenticated, service_role;
GRANT ALL ON public.lps_five_whys TO anon, authenticated, service_role;
GRANT ALL ON public.lps_constraint_audit TO anon, authenticated, service_role;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

-- Verificacao
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('lps_constraints', 'lps_weekly_commitments', 'lps_five_whys', 'lps_constraint_audit')
ORDER BY table_name;`;

export function LpsSetupBanner({ onRetry }: { onRetry: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SQL);
      setCopied(true);
      toast.success('SQL copiado! Agora cole no SQL Editor do Supabase.');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setExpanded(true);
      toast.error('Falha ao copiar. Expanda e copie manualmente.');
    }
  };

  const handleCheck = async () => {
    setChecking(true);

    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await supabase
        .from('lps_constraints')
        .select('id')
        .limit(0);

      if (!error) {
        toast.success('Tabelas encontradas! Carregando dados...');
        setChecking(false);
        onRetry();
        return;
      }

      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setChecking(false);
    toast.info(
      'Tabelas ainda nao detectadas. Aguarde 1-2 minutos apos rodar o SQL e tente novamente.',
      { duration: 6000 }
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="bg-indigo-100 rounded-lg p-2.5">
          <Database className="h-6 w-6 text-indigo-600" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">
              Configurar Modulo Lean / LPS
            </h3>
            <p className="text-gray-500 text-sm mt-1">
              Para usar as Restricoes Lean, e necessario criar as tabelas no banco de dados. Isso leva menos de 1 minuto.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 space-y-2">
            <p className="font-medium text-gray-900">Como configurar:</p>
            <ol className="space-y-1.5 list-decimal list-inside text-gray-600">
              <li>Clique em <strong>"Copiar SQL"</strong> abaixo</li>
              <li>Abra o <strong>Supabase Dashboard</strong> &rarr; <strong>SQL Editor</strong></li>
              <li>Clique em <strong>"New Query"</strong>, cole o SQL e clique <strong>"Run"</strong></li>
              <li>Confirme que aparecem <strong>4 tabelas</strong> no resultado</li>
              <li>Volte aqui e clique <strong>"Verificar"</strong></li>
            </ol>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleCopy}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? 'Copiado!' : 'Copiar SQL'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              {expanded ? 'Ocultar SQL' : 'Ver SQL'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheck}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Info className="h-4 w-4 mr-1" />
              )}
              {checking ? 'Verificando...' : 'Verificar'}
            </Button>
          </div>

          {expanded && (
            <pre className="mt-3 bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-auto max-h-80 whitespace-pre-wrap">
              {SETUP_SQL}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
