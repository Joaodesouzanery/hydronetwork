import { useState } from 'react';
import { AlertTriangle, Copy, Check, ChevronDown, ChevronUp, RefreshCw, Database, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// ===================================================================
// SQL ROBUSTO: SEM FK INLINE para garantir que CREATE TABLE nunca falhe
// FKs são adicionadas depois via ALTER TABLE + exception handler
// ===================================================================
const SETUP_SQL = `-- ===========================================
-- SCRIPT DEFINITIVO - Módulo LPS / Lean
-- Cole no SQL Editor do Supabase e clique Run
-- ===========================================

-- PASSO 1: Limpar tudo que existia antes
DROP TABLE IF EXISTS public.lps_constraint_audit CASCADE;
DROP TABLE IF EXISTS public.lps_five_whys CASCADE;
DROP TABLE IF EXISTS public.lps_weekly_commitments CASCADE;
DROP TABLE IF EXISTS public.lps_constraints CASCADE;
DROP TYPE IF EXISTS public.lps_constraint_type CASCADE;
DROP TYPE IF EXISTS public.lps_constraint_status CASCADE;
DROP TYPE IF EXISTS public.lps_impact_level CASCADE;
DROP TYPE IF EXISTS public.lps_commitment_status CASCADE;

-- PASSO 2: Função helper para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- PASSO 3: Tabela lps_constraints (SEM foreign keys inline)
CREATE TABLE public.lps_constraints (
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

-- PASSO 4: Tabela lps_weekly_commitments (SEM foreign keys inline)
CREATE TABLE public.lps_weekly_commitments (
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

-- PASSO 5: Tabela lps_five_whys (SEM foreign keys inline)
CREATE TABLE public.lps_five_whys (
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

-- PASSO 6: Tabela lps_constraint_audit (SEM foreign keys inline)
CREATE TABLE public.lps_constraint_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  constraint_id UUID NOT NULL,
  action TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  user_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PASSO 7: Foreign Keys (cada uma em bloco protegido)
DO $$ BEGIN
  ALTER TABLE public.lps_constraints
    ADD CONSTRAINT lps_constraints_project_fk
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK projects ignorada: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_constraints
    ADD CONSTRAINT lps_constraints_front_fk
    FOREIGN KEY (service_front_id) REFERENCES public.service_fronts(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK service_fronts ignorada: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_constraints
    ADD CONSTRAINT lps_constraints_responsavel_fk
    FOREIGN KEY (responsavel_id) REFERENCES public.employees(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK employees ignorada: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_constraints
    ADD CONSTRAINT lps_constraints_parent_fk
    FOREIGN KEY (parent_constraint_id) REFERENCES public.lps_constraints(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK parent ignorada: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_constraints
    ADD CONSTRAINT lps_constraints_justification_fk
    FOREIGN KEY (justification_id) REFERENCES public.justifications(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK justifications ignorada: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_constraints
    ADD CONSTRAINT lps_constraints_daily_report_fk
    FOREIGN KEY (daily_report_id) REFERENCES public.daily_reports(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK daily_reports ignorada: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_weekly_commitments
    ADD CONSTRAINT lps_commitments_project_fk
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK commitments->projects ignorada: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_weekly_commitments
    ADD CONSTRAINT lps_commitments_front_fk
    FOREIGN KEY (service_front_id) REFERENCES public.service_fronts(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK commitments->fronts ignorada: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_weekly_commitments
    ADD CONSTRAINT lps_commitments_constraint_fk
    FOREIGN KEY (constraint_id) REFERENCES public.lps_constraints(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK commitments->constraints ignorada: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_weekly_commitments
    ADD CONSTRAINT lps_commitments_service_fk
    FOREIGN KEY (service_id) REFERENCES public.services_catalog(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK commitments->services ignorada: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_five_whys
    ADD CONSTRAINT lps_five_whys_constraint_fk
    FOREIGN KEY (constraint_id) REFERENCES public.lps_constraints(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK five_whys->constraints ignorada: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE public.lps_constraint_audit
    ADD CONSTRAINT lps_audit_constraint_fk
    FOREIGN KEY (constraint_id) REFERENCES public.lps_constraints(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'FK audit->constraints ignorada: %', SQLERRM;
END $$;

-- PASSO 8: RLS (Row Level Security)
ALTER TABLE public.lps_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_weekly_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_five_whys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lps_constraint_audit ENABLE ROW LEVEL SECURITY;

-- Policies para lps_constraints
CREATE POLICY "lps_constraints_select" ON public.lps_constraints FOR SELECT USING (true);
CREATE POLICY "lps_constraints_insert" ON public.lps_constraints FOR INSERT WITH CHECK (true);
CREATE POLICY "lps_constraints_update" ON public.lps_constraints FOR UPDATE USING (true);
CREATE POLICY "lps_constraints_delete" ON public.lps_constraints FOR DELETE USING (true);

-- Policies para lps_weekly_commitments
CREATE POLICY "lps_commitments_select" ON public.lps_weekly_commitments FOR SELECT USING (true);
CREATE POLICY "lps_commitments_insert" ON public.lps_weekly_commitments FOR INSERT WITH CHECK (true);
CREATE POLICY "lps_commitments_update" ON public.lps_weekly_commitments FOR UPDATE USING (true);
CREATE POLICY "lps_commitments_delete" ON public.lps_weekly_commitments FOR DELETE USING (true);

-- Policies para lps_five_whys
CREATE POLICY "lps_five_whys_select" ON public.lps_five_whys FOR SELECT USING (true);
CREATE POLICY "lps_five_whys_insert" ON public.lps_five_whys FOR INSERT WITH CHECK (true);
CREATE POLICY "lps_five_whys_update" ON public.lps_five_whys FOR UPDATE USING (true);
CREATE POLICY "lps_five_whys_delete" ON public.lps_five_whys FOR DELETE USING (true);

-- Policies para lps_constraint_audit
CREATE POLICY "lps_audit_select" ON public.lps_constraint_audit FOR SELECT USING (true);
CREATE POLICY "lps_audit_insert" ON public.lps_constraint_audit FOR INSERT WITH CHECK (true);

-- PASSO 9: Triggers
CREATE TRIGGER update_lps_constraints_updated_at BEFORE UPDATE ON public.lps_constraints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lps_weekly_commitments_updated_at BEFORE UPDATE ON public.lps_weekly_commitments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lps_five_whys_updated_at BEFORE UPDATE ON public.lps_five_whys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PASSO 10: Indexes
CREATE INDEX idx_lps_constraints_project ON public.lps_constraints(project_id);
CREATE INDEX idx_lps_constraints_status ON public.lps_constraints(status);
CREATE INDEX idx_lps_constraints_front ON public.lps_constraints(service_front_id);
CREATE INDEX idx_lps_constraints_date ON public.lps_constraints(data_identificacao DESC);
CREATE INDEX idx_lps_constraints_type ON public.lps_constraints(tipo_restricao);
CREATE INDEX idx_lps_constraints_parent ON public.lps_constraints(parent_constraint_id);
CREATE INDEX idx_lps_commitments_project ON public.lps_weekly_commitments(project_id);
CREATE INDEX idx_lps_commitments_week ON public.lps_weekly_commitments(semana_inicio);
CREATE INDEX idx_lps_commitments_status ON public.lps_weekly_commitments(status);
CREATE INDEX idx_lps_five_whys_constraint ON public.lps_five_whys(constraint_id);
CREATE INDEX idx_lps_audit_constraint ON public.lps_constraint_audit(constraint_id);
CREATE INDEX idx_lps_audit_created ON public.lps_constraint_audit(created_at DESC);

-- PASSO 11: GRANT (CRÍTICO para o PostgREST enxergar as tabelas)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.lps_constraints TO anon, authenticated, service_role;
GRANT ALL ON public.lps_weekly_commitments TO anon, authenticated, service_role;
GRANT ALL ON public.lps_five_whys TO anon, authenticated, service_role;
GRANT ALL ON public.lps_constraint_audit TO anon, authenticated, service_role;

-- PASSO 12: Forçar reload do schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');

-- PASSO 13: VERIFICAÇÃO - Confirme que todas as 4 tabelas aparecem
SELECT table_name,
       (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as num_columns
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('lps_constraints', 'lps_weekly_commitments', 'lps_five_whys', 'lps_constraint_audit')
ORDER BY table_name;

-- Se aparecerem 4 linhas acima, as tabelas foram criadas com sucesso!
-- Aguarde 30 segundos e recarregue a página da aplicação.`;

async function tryReloadSchemaCache(): Promise<boolean> {
  try {
    // Try to call pg_notify via RPC to reload schema cache
    const { error } = await supabase.rpc('pg_notify', { channel: 'pgrst', payload: 'reload schema' });
    if (!error) return true;
  } catch {
    // pg_notify RPC might not exist, try a simple query
  }

  try {
    // Fallback: try a simple select on the table to test connectivity
    const { error } = await supabase.from('lps_constraints').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export function LpsSetupBanner({ onRetry }: { onRetry: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SQL);
      setCopied(true);
      toast.success('SQL copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Falha ao copiar. Expanda o SQL e copie manualmente.');
    }
  };

  const handleRetryWithDelay = async () => {
    setChecking(true);
    toast.info('Tentando recarregar o schema cache...');

    // Try to access the table, with 3 attempts, 3 seconds apart
    for (let attempt = 1; attempt <= 3; attempt++) {
      const ok = await tryReloadSchemaCache();
      if (ok) {
        toast.success('Tabelas encontradas! Recarregando dados...');
        setChecking(false);
        onRetry();
        return;
      }
      if (attempt < 3) {
        toast.info(`Tentativa ${attempt}/3 - aguardando schema cache atualizar...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setChecking(false);
    toast.warning(
      'Schema cache ainda não atualizou. Aguarde 1-2 minutos e tente novamente, ou reinicie o projeto no Supabase Dashboard.',
      { duration: 8000 }
    );
    onRetry();
  };

  return (
    <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-2 flex-1">
          <h3 className="font-bold text-amber-900 text-lg">
            Tabelas do Módulo Lean não encontradas
          </h3>
          <p className="text-amber-800 text-sm">
            A tabela <code className="bg-amber-100 px-1 rounded">lps_constraints</code> não existe ou o PostgREST ainda não atualizou o schema cache.
          </p>

          <div className="bg-amber-100 rounded-lg p-3 text-amber-900 text-sm space-y-2">
            <p className="font-semibold">Siga estes passos:</p>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Acesse o <strong>Supabase Dashboard</strong> do seu projeto</li>
              <li>Vá em <strong>SQL Editor</strong> (menu lateral esquerdo)</li>
              <li>Clique em <strong>"New Query"</strong></li>
              <li>Cole o SQL (botão "Copiar SQL" abaixo) e clique <strong>"Run"</strong></li>
              <li><strong>IMPORTANTE:</strong> No resultado, confirme que aparecem <strong>4 linhas</strong> (4 tabelas) na verificação final</li>
              <li><strong>Aguarde 30-60 segundos</strong> para o PostgREST atualizar o cache</li>
              <li>Clique em <strong>"Verificar Novamente"</strong> abaixo</li>
            </ol>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-xs space-y-1">
            <p className="font-semibold">Se o erro persistir após rodar o SQL:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Verifique se as 4 tabelas aparecem no resultado da verificação</li>
              <li>Vá em <strong>Table Editor</strong> no Supabase e confirme que as tabelas <code>lps_constraints</code>, <code>lps_weekly_commitments</code>, <code>lps_five_whys</code>, <code>lps_constraint_audit</code> existem</li>
              <li>Aguarde 2 minutos (o schema cache atualiza automaticamente)</li>
              <li>Se nada funcionar: vá em <strong>Settings &gt; General</strong> e clique <strong>"Restart project"</strong></li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryWithDelay}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-1" />
              )}
              {checking ? 'Verificando...' : 'Verificar Novamente'}
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
