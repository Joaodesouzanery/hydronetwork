-- =============================================
-- TABELAS PARA RH CONSTRUDATA - ESCALA INTELIGENTE CLT
-- =============================================

-- Tabela de unidades (se não existir)
CREATE TABLE IF NOT EXISTS public.unidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de funcionários RH (se não existir)
CREATE TABLE IF NOT EXISTS public.funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  cpf TEXT,
  cargo TEXT,
  departamento TEXT,
  salario_base NUMERIC DEFAULT 0,
  data_admissao DATE,
  data_demissao DATE,
  tipo_contrato TEXT DEFAULT 'clt',
  ativo BOOLEAN NOT NULL DEFAULT true,
  email TEXT,
  telefone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de turnos
CREATE TABLE IF NOT EXISTS public.turnos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  intervalo_minutos INTEGER DEFAULT 60,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configurações CLT por empresa/unidade
CREATE TABLE IF NOT EXISTS public.configuracoes_clt (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  jornada_diaria_padrao NUMERIC NOT NULL DEFAULT 8.00,
  jornada_semanal_padrao NUMERIC NOT NULL DEFAULT 44.00,
  limite_horas_extras_dia NUMERIC NOT NULL DEFAULT 2.00,
  percentual_hora_extra_50 NUMERIC NOT NULL DEFAULT 50.00,
  percentual_hora_extra_100 NUMERIC NOT NULL DEFAULT 100.00,
  intervalo_minimo_6h NUMERIC NOT NULL DEFAULT 1.00,
  intervalo_minimo_4h NUMERIC NOT NULL DEFAULT 0.25,
  descanso_entre_jornadas NUMERIC NOT NULL DEFAULT 11.00,
  dias_trabalho_antes_folga INTEGER NOT NULL DEFAULT 6,
  hora_inicio_noturno TIME NOT NULL DEFAULT '22:00:00',
  hora_fim_noturno TIME NOT NULL DEFAULT '05:00:00',
  percentual_adicional_noturno NUMERIC NOT NULL DEFAULT 20.00,
  escalas_habilitadas TEXT[] NOT NULL DEFAULT ARRAY['6x1', '5x2', '12x36', 'diaria', 'personalizada'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela principal de escalas CLT
CREATE TABLE IF NOT EXISTS public.escalas_clt (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  turno_id UUID REFERENCES public.turnos(id) ON DELETE SET NULL,
  tipo_escala TEXT NOT NULL,
  data DATE NOT NULL,
  hora_entrada TIME NOT NULL,
  hora_saida TIME NOT NULL,
  hora_inicio_intervalo TIME,
  hora_fim_intervalo TIME,
  horas_normais NUMERIC NOT NULL DEFAULT 0,
  horas_extras NUMERIC NOT NULL DEFAULT 0,
  horas_noturnas NUMERIC NOT NULL DEFAULT 0,
  valor_hora_normal NUMERIC NOT NULL DEFAULT 0,
  valor_hora_extra NUMERIC NOT NULL DEFAULT 0,
  valor_adicional_noturno NUMERIC NOT NULL DEFAULT 0,
  custo_total NUMERIC NOT NULL DEFAULT 0,
  is_domingo BOOLEAN NOT NULL DEFAULT false,
  is_feriado BOOLEAN NOT NULL DEFAULT false,
  is_folga BOOLEAN NOT NULL DEFAULT false,
  status_clt TEXT NOT NULL DEFAULT 'pendente',
  alertas_clt JSONB DEFAULT '[]'::jsonb,
  funcao TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(funcionario_id, data)
);

-- Tabela de feriados
CREATE TABLE IF NOT EXISTS public.feriados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  data DATE NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'nacional',
  recorrente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de validações CLT
CREATE TABLE IF NOT EXISTS public.validacoes_clt (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  escala_id UUID REFERENCES public.escalas_clt(id) ON DELETE CASCADE,
  funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo_validacao TEXT NOT NULL,
  nivel TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  detalhes JSONB,
  resolvido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de postos de cobertura mínima
CREATE TABLE IF NOT EXISTS public.postos_cobertura (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  frente_obra TEXT,
  cargo TEXT NOT NULL,
  quantidade_minima INTEGER NOT NULL DEFAULT 1,
  turno_periodo TEXT NOT NULL DEFAULT 'integral',
  hora_inicio TIME,
  hora_fim TIME,
  dias_semana INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],
  prioridade TEXT NOT NULL DEFAULT 'media',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de cobertura de postos
CREATE TABLE IF NOT EXISTS public.cobertura_postos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  posto_id UUID NOT NULL REFERENCES public.postos_cobertura(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  quantidade_alocada INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de faltas de funcionários
CREATE TABLE IF NOT EXISTS public.faltas_funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  escala_id UUID REFERENCES public.escalas_clt(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  tipo TEXT NOT NULL,
  observacoes TEXT,
  arquivo_url TEXT,
  horas_perdidas NUMERIC DEFAULT 0,
  impacto_custo NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de substituições
CREATE TABLE IF NOT EXISTS public.substituicoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  falta_id UUID REFERENCES public.faltas_funcionarios(id) ON DELETE SET NULL,
  funcionario_ausente_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  funcionario_substituto_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  escala_id UUID REFERENCES public.escalas_clt(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  motivo TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  impacto_custo NUMERIC DEFAULT 0,
  executado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- TABELAS PARA DASHBOARD PRIME COST
-- =============================================

-- Lançamentos de CMV (Custo de Materiais)
CREATE TABLE IF NOT EXISTS public.cmv_lancamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  valor NUMERIC NOT NULL,
  categoria TEXT,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Entregas de produtividade
CREATE TABLE IF NOT EXISTS public.entregas_produtividade (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  tipo_entrega TEXT NOT NULL,
  quantidade NUMERIC NOT NULL,
  unidade_medida TEXT NOT NULL,
  receita NUMERIC,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Metas de Prime Cost
CREATE TABLE IF NOT EXISTS public.metas_prime_cost (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  meta_prime_cost_percent NUMERIC NOT NULL DEFAULT 50,
  meta_cmo_percent NUMERIC NOT NULL DEFAULT 30,
  meta_cmv_percent NUMERIC NOT NULL DEFAULT 20,
  modo_produtividade TEXT NOT NULL DEFAULT 'receita_hora',
  meta_produtividade NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_clt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalas_clt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validacoes_clt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postos_cobertura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobertura_postos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faltas_funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.substituicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmv_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregas_produtividade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_prime_cost ENABLE ROW LEVEL SECURITY;

-- Policies para unidades
CREATE POLICY "Users can view own unidades" ON public.unidades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own unidades" ON public.unidades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own unidades" ON public.unidades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own unidades" ON public.unidades FOR DELETE USING (auth.uid() = user_id);

-- Policies para funcionarios
CREATE POLICY "Users can view own funcionarios" ON public.funcionarios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own funcionarios" ON public.funcionarios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own funcionarios" ON public.funcionarios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own funcionarios" ON public.funcionarios FOR DELETE USING (auth.uid() = user_id);

-- Policies para turnos
CREATE POLICY "Users can view own turnos" ON public.turnos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own turnos" ON public.turnos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own turnos" ON public.turnos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own turnos" ON public.turnos FOR DELETE USING (auth.uid() = user_id);

-- Policies para configuracoes_clt
CREATE POLICY "Users can view own configuracoes_clt" ON public.configuracoes_clt FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own configuracoes_clt" ON public.configuracoes_clt FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own configuracoes_clt" ON public.configuracoes_clt FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own configuracoes_clt" ON public.configuracoes_clt FOR DELETE USING (auth.uid() = user_id);

-- Policies para escalas_clt
CREATE POLICY "Users can view own escalas_clt" ON public.escalas_clt FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own escalas_clt" ON public.escalas_clt FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own escalas_clt" ON public.escalas_clt FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own escalas_clt" ON public.escalas_clt FOR DELETE USING (auth.uid() = user_id);

-- Policies para feriados
CREATE POLICY "Users can view own feriados" ON public.feriados FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feriados" ON public.feriados FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own feriados" ON public.feriados FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own feriados" ON public.feriados FOR DELETE USING (auth.uid() = user_id);

-- Policies para validacoes_clt
CREATE POLICY "Users can view own validacoes_clt" ON public.validacoes_clt FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own validacoes_clt" ON public.validacoes_clt FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own validacoes_clt" ON public.validacoes_clt FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own validacoes_clt" ON public.validacoes_clt FOR DELETE USING (auth.uid() = user_id);

-- Policies para postos_cobertura
CREATE POLICY "Users can view own postos" ON public.postos_cobertura FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own postos" ON public.postos_cobertura FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own postos" ON public.postos_cobertura FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own postos" ON public.postos_cobertura FOR DELETE USING (auth.uid() = user_id);

-- Policies para cobertura_postos
CREATE POLICY "Users can view own cobertura" ON public.cobertura_postos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cobertura" ON public.cobertura_postos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cobertura" ON public.cobertura_postos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cobertura" ON public.cobertura_postos FOR DELETE USING (auth.uid() = user_id);

-- Policies para faltas_funcionarios
CREATE POLICY "Users can view own faltas" ON public.faltas_funcionarios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own faltas" ON public.faltas_funcionarios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own faltas" ON public.faltas_funcionarios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own faltas" ON public.faltas_funcionarios FOR DELETE USING (auth.uid() = user_id);

-- Policies para substituicoes
CREATE POLICY "Users can view own substituicoes" ON public.substituicoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own substituicoes" ON public.substituicoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own substituicoes" ON public.substituicoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own substituicoes" ON public.substituicoes FOR DELETE USING (auth.uid() = user_id);

-- Policies para cmv_lancamentos
CREATE POLICY "Users can view own cmv" ON public.cmv_lancamentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cmv" ON public.cmv_lancamentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cmv" ON public.cmv_lancamentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cmv" ON public.cmv_lancamentos FOR DELETE USING (auth.uid() = user_id);

-- Policies para entregas_produtividade
CREATE POLICY "Users can view own entregas" ON public.entregas_produtividade FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own entregas" ON public.entregas_produtividade FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own entregas" ON public.entregas_produtividade FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own entregas" ON public.entregas_produtividade FOR DELETE USING (auth.uid() = user_id);

-- Policies para metas_prime_cost
CREATE POLICY "Users can view own metas" ON public.metas_prime_cost FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own metas" ON public.metas_prime_cost FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own metas" ON public.metas_prime_cost FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own metas" ON public.metas_prime_cost FOR DELETE USING (auth.uid() = user_id);