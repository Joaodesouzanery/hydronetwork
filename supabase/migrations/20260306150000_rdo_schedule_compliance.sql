-- ============================================================
-- RDO Schedule & Compliance System
-- Controle de frequência de preenchimento de RDO com alertas
-- e escalação para superior hierárquico
-- ============================================================

-- 1. Configuração de agenda de RDO por obra/projeto
CREATE TABLE IF NOT EXISTS public.rdo_schedule_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE,

  -- Frequência: 'diario', 'dias_uteis', 'dia_sim_dia_nao', 'semanal', 'personalizado'
  frequencia TEXT NOT NULL DEFAULT 'diario',

  -- Para frequência 'semanal': quais dias (0=dom, 1=seg, ..., 6=sab)
  dias_semana INTEGER[] DEFAULT '{1,2,3,4,5}',

  -- Para frequência 'personalizado': intervalo em dias
  intervalo_dias INTEGER DEFAULT 1,

  -- Configuração de alertas
  alerta_hora_limite TIME DEFAULT '18:00',  -- Hora limite para preencher
  alerta_apos_horas INTEGER DEFAULT 2,       -- Horas após limite para 1º alerta
  escalacao_apos_dias INTEGER DEFAULT 3,     -- Dias sem RDO para escalar ao superior

  -- Hierarquia
  encarregado_user_id UUID REFERENCES auth.users(id),
  encarregado_nome TEXT,
  encarregado_email TEXT,
  supervisor_user_id UUID REFERENCES auth.users(id),
  supervisor_nome TEXT,
  supervisor_email TEXT,

  -- Status
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: precisa de projeto OU obra
  CONSTRAINT rdo_schedule_project_or_obra CHECK (project_id IS NOT NULL OR obra_id IS NOT NULL)
);

-- 2. Registro de conformidade diária
CREATE TABLE IF NOT EXISTS public.rdo_compliance_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.rdo_schedule_config(id) ON DELETE CASCADE,
  data_esperada DATE NOT NULL,

  -- Status: 'pendente', 'preenchido', 'atrasado', 'ausente', 'justificado'
  status TEXT NOT NULL DEFAULT 'pendente',

  -- Referência ao RDO preenchido (se houver)
  rdo_id UUID,
  hydro_rdo_id UUID,
  daily_report_id UUID,

  -- Alertas enviados
  alerta_enviado BOOLEAN DEFAULT FALSE,
  alerta_enviado_em TIMESTAMPTZ,
  escalacao_enviada BOOLEAN DEFAULT FALSE,
  escalacao_enviada_em TIMESTAMPTZ,

  -- Justificativa (para ausências justificadas)
  justificativa TEXT,
  justificado_por UUID REFERENCES auth.users(id),
  justificado_em TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(schedule_id, data_esperada)
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_rdo_schedule_user ON public.rdo_schedule_config(user_id);
CREATE INDEX IF NOT EXISTS idx_rdo_schedule_project ON public.rdo_schedule_config(project_id);
CREATE INDEX IF NOT EXISTS idx_rdo_schedule_obra ON public.rdo_schedule_config(obra_id);
CREATE INDEX IF NOT EXISTS idx_rdo_compliance_schedule ON public.rdo_compliance_log(schedule_id);
CREATE INDEX IF NOT EXISTS idx_rdo_compliance_data ON public.rdo_compliance_log(data_esperada DESC);
CREATE INDEX IF NOT EXISTS idx_rdo_compliance_status ON public.rdo_compliance_log(status);

-- 4. RLS Policies
ALTER TABLE public.rdo_schedule_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_compliance_log ENABLE ROW LEVEL SECURITY;

-- Schedule config: usuário vê suas próprias + onde é supervisor
CREATE POLICY "rdo_schedule_select" ON public.rdo_schedule_config
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() = encarregado_user_id
    OR auth.uid() = supervisor_user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "rdo_schedule_insert" ON public.rdo_schedule_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "rdo_schedule_update" ON public.rdo_schedule_config
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "rdo_schedule_delete" ON public.rdo_schedule_config
  FOR DELETE USING (auth.uid() = user_id);

-- Compliance log: quem pode ver a config pode ver o log
CREATE POLICY "rdo_compliance_select" ON public.rdo_compliance_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rdo_schedule_config sc
      WHERE sc.id = schedule_id
      AND (sc.user_id = auth.uid() OR sc.encarregado_user_id = auth.uid() OR sc.supervisor_user_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "rdo_compliance_insert" ON public.rdo_compliance_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "rdo_compliance_update" ON public.rdo_compliance_log
  FOR UPDATE USING (true);

-- 5. Função para gerar datas esperadas de RDO com base na configuração
CREATE OR REPLACE FUNCTION public.generate_expected_rdo_dates(
  p_schedule_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(expected_date DATE) AS $$
DECLARE
  v_config RECORD;
  v_current DATE;
  v_day_of_week INTEGER;
  v_day_count INTEGER := 0;
BEGIN
  SELECT * INTO v_config FROM public.rdo_schedule_config WHERE id = p_schedule_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_current := p_start_date;

  WHILE v_current <= p_end_date LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current)::INTEGER;

    CASE v_config.frequencia
      WHEN 'diario' THEN
        expected_date := v_current;
        RETURN NEXT;

      WHEN 'dias_uteis' THEN
        IF v_day_of_week BETWEEN 1 AND 5 THEN
          expected_date := v_current;
          RETURN NEXT;
        END IF;

      WHEN 'dia_sim_dia_nao' THEN
        IF v_day_count % 2 = 0 THEN
          expected_date := v_current;
          RETURN NEXT;
        END IF;

      WHEN 'semanal' THEN
        IF v_day_of_week = ANY(v_config.dias_semana) THEN
          expected_date := v_current;
          RETURN NEXT;
        END IF;

      WHEN 'personalizado' THEN
        IF v_day_count % COALESCE(v_config.intervalo_dias, 1) = 0 THEN
          expected_date := v_current;
          RETURN NEXT;
        END IF;
    END CASE;

    v_current := v_current + 1;
    v_day_count := v_day_count + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Função para verificar conformidade e criar alertas
CREATE OR REPLACE FUNCTION public.check_rdo_compliance()
RETURNS void AS $$
DECLARE
  v_config RECORD;
  v_expected_date DATE;
  v_has_rdo BOOLEAN;
  v_days_missing INTEGER;
BEGIN
  -- Para cada configuração ativa
  FOR v_config IN
    SELECT * FROM public.rdo_schedule_config WHERE ativo = TRUE
  LOOP
    -- Para cada data esperada nos últimos 7 dias
    FOR v_expected_date IN
      SELECT expected_date FROM public.generate_expected_rdo_dates(
        v_config.id, CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE
      )
    LOOP
      -- Verificar se já existe registro de conformidade
      IF NOT EXISTS (
        SELECT 1 FROM public.rdo_compliance_log
        WHERE schedule_id = v_config.id AND data_esperada = v_expected_date
      ) THEN
        -- Verificar se existe RDO preenchido para essa data
        v_has_rdo := EXISTS (
          SELECT 1 FROM public.daily_reports
          WHERE project_id = v_config.project_id
          AND report_date = v_expected_date
        ) OR EXISTS (
          SELECT 1 FROM public.hydro_rdos
          WHERE project_id = v_config.project_id::TEXT
          AND date = v_expected_date::TEXT
        );

        -- Inserir registro de conformidade
        INSERT INTO public.rdo_compliance_log (schedule_id, data_esperada, status)
        VALUES (
          v_config.id,
          v_expected_date,
          CASE
            WHEN v_has_rdo THEN 'preenchido'
            WHEN v_expected_date < CURRENT_DATE THEN 'atrasado'
            ELSE 'pendente'
          END
        )
        ON CONFLICT (schedule_id, data_esperada) DO UPDATE
        SET status = CASE
          WHEN EXCLUDED.status = 'preenchido' THEN 'preenchido'
          WHEN rdo_compliance_log.status = 'justificado' THEN 'justificado'
          ELSE EXCLUDED.status
        END,
        updated_at = NOW();
      END IF;
    END LOOP;

    -- Contar dias consecutivos sem RDO
    SELECT COUNT(*) INTO v_days_missing
    FROM public.rdo_compliance_log
    WHERE schedule_id = v_config.id
    AND status IN ('atrasado', 'pendente')
    AND data_esperada >= CURRENT_DATE - (v_config.escalacao_apos_dias || ' days')::INTERVAL;

    -- Se passou do limite, criar alerta de escalação
    IF v_days_missing >= v_config.escalacao_apos_dias THEN
      INSERT INTO public.alertas_historico (
        user_id, obra_id, tipo_alerta, mensagem, dados_extras
      ) VALUES (
        COALESCE(v_config.supervisor_user_id, v_config.user_id),
        v_config.obra_id,
        'rdo_ausente',
        format('ALERTA: %s dias consecutivos sem RDO preenchido. Encarregado: %s',
          v_days_missing, COALESCE(v_config.encarregado_nome, 'Não definido')),
        jsonb_build_object(
          'schedule_id', v_config.id,
          'dias_sem_rdo', v_days_missing,
          'encarregado', v_config.encarregado_nome,
          'escalado_para', COALESCE(v_config.supervisor_nome, 'Admin')
        )
      )
      ON CONFLICT DO NOTHING;

      -- Marcar escalação como enviada
      UPDATE public.rdo_compliance_log
      SET escalacao_enviada = TRUE, escalacao_enviada_em = NOW()
      WHERE schedule_id = v_config.id
      AND status IN ('atrasado', 'pendente')
      AND escalacao_enviada = FALSE;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger: quando um RDO é criado, marcar conformidade automaticamente
CREATE OR REPLACE FUNCTION public.on_rdo_created_compliance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.rdo_compliance_log cl
  SET status = 'preenchido',
      daily_report_id = NEW.id,
      updated_at = NOW()
  FROM public.rdo_schedule_config sc
  WHERE cl.schedule_id = sc.id
  AND sc.project_id = NEW.project_id
  AND cl.data_esperada = NEW.report_date
  AND cl.status != 'preenchido';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger na tabela daily_reports (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_reports') THEN
    DROP TRIGGER IF EXISTS trg_rdo_compliance_check ON public.daily_reports;
    CREATE TRIGGER trg_rdo_compliance_check
      AFTER INSERT ON public.daily_reports
      FOR EACH ROW EXECUTE FUNCTION public.on_rdo_created_compliance();
  END IF;
END $$;
