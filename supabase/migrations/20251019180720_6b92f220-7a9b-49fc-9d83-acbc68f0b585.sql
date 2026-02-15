-- Criar extensão para UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de Obras
CREATE TABLE public.obras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  tipo_obra TEXT NOT NULL, -- residencial, comercial, infraestrutura
  localizacao TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  data_inicio DATE NOT NULL,
  data_prevista_fim DATE,
  status TEXT DEFAULT 'ativa', -- ativa, pausada, concluida
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Modelos de Formulários
CREATE TABLE public.formulario_modelos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  tipo_obra TEXT, -- para categorização
  descricao TEXT,
  campos JSONB NOT NULL, -- estrutura dos campos e lógica condicional
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Formulários de Produção (instâncias)
CREATE TABLE public.formularios_producao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  modelo_id UUID REFERENCES public.formulario_modelos(id) ON DELETE SET NULL,
  data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  frente_servico TEXT NOT NULL,
  equipe_nome TEXT,
  responsavel_nome TEXT,
  localizacao_gps TEXT,
  observacoes TEXT,
  respostas JSONB NOT NULL, -- respostas do formulário
  fotos_urls TEXT[], -- URLs das fotos
  videos_urls TEXT[], -- URLs dos vídeos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de RDO (Relatório Diário de Obra)
CREATE TABLE public.rdos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  clima_temperatura DECIMAL(5, 2),
  clima_umidade INTEGER,
  clima_vento_velocidade DECIMAL(5, 2),
  clima_previsao_chuva BOOLEAN,
  condicao_terreno TEXT, -- umido, seco, lamacento
  localizacao_validada TEXT,
  fotos_validacao TEXT[],
  observacoes_gerais TEXT,
  producao_ids UUID[], -- IDs dos formulários de produção do dia
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(obra_id, data)
);

-- Tabela de Metas de Produção
CREATE TABLE public.metas_producao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  frente_servico TEXT NOT NULL,
  meta_diaria DECIMAL(10, 2),
  unidade TEXT NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Configuração de Alertas
CREATE TABLE public.alertas_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE,
  tipo_alerta TEXT NOT NULL, -- producao_baixa, ausencias, equipamento
  condicao JSONB NOT NULL, -- threshold e parâmetros
  destinatarios TEXT[] NOT NULL, -- emails
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Histórico de Alertas Enviados
CREATE TABLE public.alertas_historico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alerta_config_id UUID REFERENCES public.alertas_config(id) ON DELETE CASCADE NOT NULL,
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  mensagem TEXT NOT NULL,
  enviado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulario_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formularios_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_historico ENABLE ROW LEVEL SECURITY;

-- RLS Policies para obras
CREATE POLICY "Usuários podem ver suas próprias obras"
  ON public.obras FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias obras"
  ON public.obras FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias obras"
  ON public.obras FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias obras"
  ON public.obras FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para formulario_modelos
CREATE POLICY "Usuários podem ver seus próprios modelos"
  ON public.formulario_modelos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios modelos"
  ON public.formulario_modelos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios modelos"
  ON public.formulario_modelos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios modelos"
  ON public.formulario_modelos FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para formularios_producao
CREATE POLICY "Usuários podem ver formulários de suas obras"
  ON public.formularios_producao FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = formularios_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar formulários em suas obras"
  ON public.formularios_producao FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = formularios_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar formulários de suas obras"
  ON public.formularios_producao FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = formularios_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar formulários de suas obras"
  ON public.formularios_producao FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = formularios_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

-- RLS Policies para rdos
CREATE POLICY "Usuários podem ver RDOs de suas obras"
  ON public.rdos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = rdos.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar RDOs em suas obras"
  ON public.rdos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = rdos.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar RDOs de suas obras"
  ON public.rdos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = rdos.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar RDOs de suas obras"
  ON public.rdos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = rdos.obra_id
      AND obras.user_id = auth.uid()
    )
  );

-- RLS Policies para metas_producao
CREATE POLICY "Usuários podem ver metas de suas obras"
  ON public.metas_producao FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = metas_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar metas em suas obras"
  ON public.metas_producao FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = metas_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar metas de suas obras"
  ON public.metas_producao FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = metas_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar metas de suas obras"
  ON public.metas_producao FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = metas_producao.obra_id
      AND obras.user_id = auth.uid()
    )
  );

-- RLS Policies para alertas_config
CREATE POLICY "Usuários podem ver suas próprias configurações de alertas"
  ON public.alertas_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias configurações de alertas"
  ON public.alertas_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias configurações de alertas"
  ON public.alertas_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias configurações de alertas"
  ON public.alertas_config FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para alertas_historico
CREATE POLICY "Usuários podem ver histórico de alertas de suas obras"
  ON public.alertas_historico FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = alertas_historico.obra_id
      AND obras.user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_obras_updated_at
  BEFORE UPDATE ON public.obras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_formulario_modelos_updated_at
  BEFORE UPDATE ON public.formulario_modelos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_formularios_producao_updated_at
  BEFORE UPDATE ON public.formularios_producao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rdos_updated_at
  BEFORE UPDATE ON public.rdos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_metas_producao_updated_at
  BEFORE UPDATE ON public.metas_producao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alertas_config_updated_at
  BEFORE UPDATE ON public.alertas_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();