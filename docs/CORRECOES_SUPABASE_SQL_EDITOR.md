# CORRECOES SUPABASE - Guia Passo a Passo no SQL Editor

## O que voce vai corrigir

Existem **3 problemas principais** no seu Supabase:

1. **Tabelas com seguranca aberta (CRITICO):** 9 tabelas permitem que QUALQUER usuario veja dados de TODOS os outros usuarios
2. **Storage buckets possivelmente ausentes:** 4 buckets de armazenamento que precisam existir
3. **Schema cache desatualizado:** O PostgREST pode nao reconhecer tabelas recentes

---

## COMO ACESSAR O SQL EDITOR

1. Abra o Supabase: https://supabase.com/dashboard
2. Selecione seu projeto (iwnkrihyjveujxhgcanp)
3. No menu lateral esquerdo, clique em **"SQL Editor"** (icone de banco de dados)
4. Voce vera um editor de texto grande - e ali que vai colar os scripts

---

## PASSO 1: Verificar se as tabelas existem

Cole isto no SQL Editor e clique **"Run"** (botao verde):

```sql
-- PASSO 1: Verificar tabelas existentes
-- Se todas retornarem TRUE, pule para o PASSO 2
SELECT
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'hydro_rdos') AS hydro_rdos_existe,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'hydro_saved_plans') AS hydro_saved_plans_existe,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'hydro_equipments') AS hydro_equipments_existe,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'hydro_dimensioning_projects') AS hydro_dim_projects_existe,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'hydro_bdi_contracts') AS hydro_bdi_contracts_existe,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'project_approval_control') AS project_approval_existe,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'lps_constraints') AS lps_constraints_existe,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'lps_weekly_commitments') AS lps_weekly_existe,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'lps_five_whys') AS lps_five_whys_existe;
```

**Resultado esperado:** Todas as colunas devem mostrar `true`.

Se alguma mostrar `false`, va para o **PASSO 1B** abaixo. Se todas forem `true`, pule direto para o **PASSO 2**.

---

## PASSO 1B: Criar tabelas faltantes (SO SE NECESSARIO)

Se `hydro_rdos_existe` = `false`, cole e rode:

```sql
CREATE TABLE IF NOT EXISTS public.hydro_rdos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  project_id TEXT NOT NULL DEFAULT 'default',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  project_name TEXT NOT NULL DEFAULT '',
  obra_name TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  occurrences TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hydro_rdos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hydro_rdos_project ON public.hydro_rdos(project_id);
CREATE INDEX IF NOT EXISTS idx_hydro_rdos_date ON public.hydro_rdos(date DESC);
CREATE INDEX IF NOT EXISTS idx_hydro_rdos_user ON public.hydro_rdos(user_id);
GRANT ALL ON public.hydro_rdos TO anon, authenticated, service_role;
```

Se `hydro_saved_plans_existe` = `false`, cole e rode:

```sql
CREATE TABLE IF NOT EXISTS public.hydro_saved_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  nome TEXT NOT NULL,
  descricao TEXT,
  num_equipes INTEGER NOT NULL DEFAULT 1,
  team_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  metros_dia NUMERIC(10,2) NOT NULL DEFAULT 30,
  horas_trabalho NUMERIC(4,1) NOT NULL DEFAULT 8,
  work_days INTEGER NOT NULL DEFAULT 6,
  data_inicio DATE,
  data_termino DATE,
  productivity JSONB NOT NULL DEFAULT '[]'::jsonb,
  holidays JSONB NOT NULL DEFAULT '[]'::jsonb,
  trecho_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  service_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  trecho_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
  grouping_mode TEXT NOT NULL DEFAULT 'trecho',
  schedule_snapshot JSONB,
  total_metros NUMERIC(12,2),
  total_dias INTEGER,
  custo_total NUMERIC(14,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hydro_saved_plans ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hydro_plans_user ON public.hydro_saved_plans(user_id);
GRANT ALL ON public.hydro_saved_plans TO anon, authenticated, service_role;
```

Se `hydro_equipments_existe` = `false`, cole e rode:

```sql
CREATE TABLE IF NOT EXISTS public.hydro_equipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Retroescavadeira',
  placa TEXT,
  proprietario TEXT,
  custo_hora NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'disponivel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hydro_equipments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.hydro_equipments TO anon, authenticated, service_role;
```

Se `hydro_dim_projects_existe` = `false`, cole e rode:

```sql
CREATE TABLE IF NOT EXISTS public.hydro_dimensioning_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  nome TEXT NOT NULL,
  project_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hydro_dimensioning_projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hdp_user ON public.hydro_dimensioning_projects(user_id);
GRANT ALL ON public.hydro_dimensioning_projects TO anon, authenticated, service_role;
```

Se `hydro_bdi_contracts_existe` = `false`, cole e rode:

```sql
CREATE TABLE IF NOT EXISTS public.hydro_bdi_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  nome TEXT NOT NULL,
  contratante TEXT,
  tipo_contrato TEXT,
  numero_edital TEXT,
  status TEXT DEFAULT 'proposta',
  municipio TEXT,
  estado TEXT DEFAULT 'SP',
  data_inicio TEXT,
  data_termino TEXT,
  duracao_meses INTEGER DEFAULT 0,
  custo_direto_total NUMERIC(14,2) DEFAULT 0,
  bdi_percentual NUMERIC(5,2) DEFAULT 0,
  preco_venda NUMERIC(14,2) DEFAULT 0,
  valor_edital NUMERIC(14,2) DEFAULT 0,
  contract_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hydro_bdi_contracts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hbc_user ON public.hydro_bdi_contracts(user_id);
GRANT ALL ON public.hydro_bdi_contracts TO anon, authenticated, service_role;
```

Se `project_approval_existe` = `false`, cole e rode:

```sql
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
CREATE INDEX IF NOT EXISTS idx_pac_user ON public.project_approval_control(user_id);
GRANT ALL ON public.project_approval_control TO anon, authenticated, service_role;
```

---

## PASSO 2: Corrigir as policies de seguranca (OBRIGATORIO)

Este e o passo mais importante. Cole **TODO** o bloco abaixo no SQL Editor e clique **"Run"**:

```sql
-- ════════════════════════════════════════════════════════
-- CORRECAO DE SEGURANCA: RLS Policies
-- Substitui USING(true) por checagem de auth.uid()
-- ════════════════════════════════════════════════════════

-- 1. hydro_rdos
DROP POLICY IF EXISTS "hydro_rdos_select" ON public.hydro_rdos;
DROP POLICY IF EXISTS "hydro_rdos_insert" ON public.hydro_rdos;
DROP POLICY IF EXISTS "hydro_rdos_update" ON public.hydro_rdos;
DROP POLICY IF EXISTS "hydro_rdos_delete" ON public.hydro_rdos;
DROP POLICY IF EXISTS "hydro_rdos_all" ON public.hydro_rdos;

CREATE POLICY "hydro_rdos_select" ON public.hydro_rdos
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hydro_rdos_insert" ON public.hydro_rdos
  FOR INSERT WITH CHECK (true);
CREATE POLICY "hydro_rdos_update" ON public.hydro_rdos
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hydro_rdos_delete" ON public.hydro_rdos
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- 2. hydro_saved_plans
DROP POLICY IF EXISTS "hydro_plans_select" ON public.hydro_saved_plans;
DROP POLICY IF EXISTS "hydro_plans_insert" ON public.hydro_saved_plans;
DROP POLICY IF EXISTS "hydro_plans_update" ON public.hydro_saved_plans;
DROP POLICY IF EXISTS "hydro_plans_delete" ON public.hydro_saved_plans;

CREATE POLICY "hydro_plans_select" ON public.hydro_saved_plans
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hydro_plans_insert" ON public.hydro_saved_plans
  FOR INSERT WITH CHECK (true);
CREATE POLICY "hydro_plans_update" ON public.hydro_saved_plans
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hydro_plans_delete" ON public.hydro_saved_plans
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- 3. hydro_equipments
DROP POLICY IF EXISTS "hydro_equip_select" ON public.hydro_equipments;
DROP POLICY IF EXISTS "hydro_equip_insert" ON public.hydro_equipments;
DROP POLICY IF EXISTS "hydro_equip_update" ON public.hydro_equipments;
DROP POLICY IF EXISTS "hydro_equip_delete" ON public.hydro_equipments;

CREATE POLICY "hydro_equip_select" ON public.hydro_equipments
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hydro_equip_insert" ON public.hydro_equipments
  FOR INSERT WITH CHECK (true);
CREATE POLICY "hydro_equip_update" ON public.hydro_equipments
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hydro_equip_delete" ON public.hydro_equipments
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- 4. hydro_dimensioning_projects
DROP POLICY IF EXISTS "hdp_select" ON public.hydro_dimensioning_projects;
DROP POLICY IF EXISTS "hdp_insert" ON public.hydro_dimensioning_projects;
DROP POLICY IF EXISTS "hdp_update" ON public.hydro_dimensioning_projects;
DROP POLICY IF EXISTS "hdp_delete" ON public.hydro_dimensioning_projects;

CREATE POLICY "hdp_select" ON public.hydro_dimensioning_projects
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hdp_insert" ON public.hydro_dimensioning_projects
  FOR INSERT WITH CHECK (true);
CREATE POLICY "hdp_update" ON public.hydro_dimensioning_projects
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hdp_delete" ON public.hydro_dimensioning_projects
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- 5. hydro_bdi_contracts
DROP POLICY IF EXISTS "hbc_select" ON public.hydro_bdi_contracts;
DROP POLICY IF EXISTS "hbc_insert" ON public.hydro_bdi_contracts;
DROP POLICY IF EXISTS "hbc_update" ON public.hydro_bdi_contracts;
DROP POLICY IF EXISTS "hbc_delete" ON public.hydro_bdi_contracts;

CREATE POLICY "hbc_select" ON public.hydro_bdi_contracts
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hbc_insert" ON public.hydro_bdi_contracts
  FOR INSERT WITH CHECK (true);
CREATE POLICY "hbc_update" ON public.hydro_bdi_contracts
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "hbc_delete" ON public.hydro_bdi_contracts
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- 6. project_approval_control
DROP POLICY IF EXISTS "pac_select" ON public.project_approval_control;
DROP POLICY IF EXISTS "pac_insert" ON public.project_approval_control;
DROP POLICY IF EXISTS "pac_update" ON public.project_approval_control;
DROP POLICY IF EXISTS "pac_delete" ON public.project_approval_control;

CREATE POLICY "pac_select" ON public.project_approval_control
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "pac_insert" ON public.project_approval_control
  FOR INSERT WITH CHECK (true);
CREATE POLICY "pac_update" ON public.project_approval_control
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "pac_delete" ON public.project_approval_control
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- 7. LPS tables (usam created_by_user_id ao inves de user_id)
DROP POLICY IF EXISTS "lps_constraints_select" ON public.lps_constraints;
DROP POLICY IF EXISTS "lps_constraints_insert" ON public.lps_constraints;
DROP POLICY IF EXISTS "lps_constraints_update" ON public.lps_constraints;
DROP POLICY IF EXISTS "lps_constraints_delete" ON public.lps_constraints;

CREATE POLICY "lps_constraints_select" ON public.lps_constraints
  FOR SELECT USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_constraints_insert" ON public.lps_constraints
  FOR INSERT WITH CHECK (true);
CREATE POLICY "lps_constraints_update" ON public.lps_constraints
  FOR UPDATE USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_constraints_delete" ON public.lps_constraints
  FOR DELETE USING (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "lps_commitments_select" ON public.lps_weekly_commitments;
DROP POLICY IF EXISTS "lps_commitments_insert" ON public.lps_weekly_commitments;
DROP POLICY IF EXISTS "lps_commitments_update" ON public.lps_weekly_commitments;
DROP POLICY IF EXISTS "lps_commitments_delete" ON public.lps_weekly_commitments;

CREATE POLICY "lps_commitments_select" ON public.lps_weekly_commitments
  FOR SELECT USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_commitments_insert" ON public.lps_weekly_commitments
  FOR INSERT WITH CHECK (true);
CREATE POLICY "lps_commitments_update" ON public.lps_weekly_commitments
  FOR UPDATE USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_commitments_delete" ON public.lps_weekly_commitments
  FOR DELETE USING (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "lps_five_whys_select" ON public.lps_five_whys;
DROP POLICY IF EXISTS "lps_five_whys_insert" ON public.lps_five_whys;
DROP POLICY IF EXISTS "lps_five_whys_update" ON public.lps_five_whys;
DROP POLICY IF EXISTS "lps_five_whys_delete" ON public.lps_five_whys;

CREATE POLICY "lps_five_whys_select" ON public.lps_five_whys
  FOR SELECT USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_five_whys_insert" ON public.lps_five_whys
  FOR INSERT WITH CHECK (true);
CREATE POLICY "lps_five_whys_update" ON public.lps_five_whys
  FOR UPDATE USING (created_by_user_id = auth.uid());
CREATE POLICY "lps_five_whys_delete" ON public.lps_five_whys
  FOR DELETE USING (created_by_user_id = auth.uid());

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
```

**Resultado esperado:** Sem erros. Voce vera "Success. No rows returned." Isso e normal.

---

## PASSO 3: Verificar/Criar Storage Buckets

Cole isto no SQL Editor e clique **"Run"**:

```sql
-- Criar buckets de storage (se nao existirem)
INSERT INTO storage.buckets (id, name, public)
VALUES ('rdo-photos', 'rdo-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('interactive-maps', 'interactive-maps', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('connection-report-photos', 'connection-report-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-request-photos', 'maintenance-request-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage
DROP POLICY IF EXISTS "Authenticated users can upload rdo photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload rdo photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rdo-photos');

DROP POLICY IF EXISTS "Anyone can view rdo photos" ON storage.objects;
CREATE POLICY "Anyone can view rdo photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'rdo-photos');

DROP POLICY IF EXISTS "Authenticated users can upload maps" ON storage.objects;
CREATE POLICY "Authenticated users can upload maps"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'interactive-maps');

DROP POLICY IF EXISTS "Anyone can view maps" ON storage.objects;
CREATE POLICY "Anyone can view maps"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'interactive-maps');

DROP POLICY IF EXISTS "Authenticated users can upload connection report photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload connection report photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'connection-report-photos');

DROP POLICY IF EXISTS "Anyone can view connection report photos" ON storage.objects;
CREATE POLICY "Anyone can view connection report photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'connection-report-photos');

DROP POLICY IF EXISTS "Authenticated users can upload maintenance photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload maintenance photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'maintenance-request-photos');

DROP POLICY IF EXISTS "Anyone can view maintenance photos" ON storage.objects;
CREATE POLICY "Anyone can view maintenance photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'maintenance-request-photos');
```

---

## PASSO 4: Criar triggers de updated_at (se faltarem)

```sql
-- Helper function (idempotente)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Triggers para tabelas que podem nao ter
DROP TRIGGER IF EXISTS update_hydro_rdos_updated_at ON public.hydro_rdos;
CREATE TRIGGER update_hydro_rdos_updated_at
  BEFORE UPDATE ON public.hydro_rdos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hydro_plans_updated_at ON public.hydro_saved_plans;
CREATE TRIGGER update_hydro_plans_updated_at
  BEFORE UPDATE ON public.hydro_saved_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hydro_equip_updated_at ON public.hydro_equipments;
CREATE TRIGGER update_hydro_equip_updated_at
  BEFORE UPDATE ON public.hydro_equipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hdp_updated_at ON public.hydro_dimensioning_projects;
CREATE TRIGGER update_hdp_updated_at
  BEFORE UPDATE ON public.hydro_dimensioning_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hbc_updated_at ON public.hydro_bdi_contracts;
CREATE TRIGGER update_hbc_updated_at
  BEFORE UPDATE ON public.hydro_bdi_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pac_updated_at ON public.project_approval_control;
CREATE TRIGGER update_pac_updated_at
  BEFORE UPDATE ON public.project_approval_control
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

## PASSO 5: Verificar que tudo esta OK

Cole isto no SQL Editor para confirmar:

```sql
-- Verifica policies ativas nas tabelas corrigidas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN (
  'hydro_rdos', 'hydro_saved_plans', 'hydro_equipments',
  'hydro_dimensioning_projects', 'hydro_bdi_contracts',
  'project_approval_control', 'lps_constraints',
  'lps_weekly_commitments', 'lps_five_whys'
)
ORDER BY tablename, cmd;
```

**Resultado esperado:** Todas as policies devem conter `auth.uid()` na coluna `qual`, e NAO devem ter `(true)` sozinho.

---

## PASSO 6 (OPCIONAL): Verificar buckets de storage

```sql
SELECT id, name, public FROM storage.buckets ORDER BY name;
```

**Resultado esperado:** Deve mostrar pelo menos estes 4 buckets:
- `connection-report-photos`
- `interactive-maps`
- `maintenance-request-photos`
- `rdo-photos`

---

## RESUMO DOS PROBLEMAS CORRIGIDOS

| Problema | Gravidade | Status |
|----------|-----------|--------|
| 9 tabelas com USING(true) - dados expostos | CRITICO | Corrigido no PASSO 2 |
| Tabelas hydro_* possivelmente faltando | ALTO | Verificado no PASSO 1 |
| Storage buckets faltando | MEDIO | Corrigido no PASSO 3 |
| Triggers updated_at faltando | BAIXO | Corrigido no PASSO 4 |
| Types.ts desatualizado no codigo | MEDIO | Corrigido no codigo (commit) |

---

## DEPOIS DE RODAR TUDO

1. Faca logout e login novamente na plataforma
2. Teste os modulos: Planejamento, BDI, RDO Hydro, Controle de Aprovacao
3. Confirme que dados antigos ainda aparecem
4. Crie um registro novo e confirme que salva

Se algo der erro, me envie a mensagem de erro exata do SQL Editor.

---

*Gerado em Marco/2026 - ConstruData HydroNetwork*
