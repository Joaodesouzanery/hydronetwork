-- Habilitar realtime para tabelas de alertas e notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas_historico;
ALTER PUBLICATION supabase_realtime ADD TABLE public.material_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.executed_services;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_reports;

-- Criar função para verificar se produção está abaixo da meta
CREATE OR REPLACE FUNCTION check_production_target()
RETURNS TRIGGER AS $$
DECLARE
  target_record RECORD;
  total_executed NUMERIC;
  target_percentage NUMERIC := 0.8; -- 80% da meta
BEGIN
  -- Buscar meta para este serviço e frente
  SELECT * INTO target_record
  FROM production_targets pt
  JOIN daily_reports dr ON dr.service_front_id = pt.service_front_id
  WHERE pt.service_id = NEW.service_id
    AND dr.id = NEW.daily_report_id
    AND pt.target_date = dr.report_date
  LIMIT 1;

  IF target_record IS NOT NULL THEN
    -- Calcular total executado para esta meta
    SELECT COALESCE(SUM(es.quantity), 0) INTO total_executed
    FROM executed_services es
    JOIN daily_reports dr ON dr.id = es.daily_report_id
    WHERE es.service_id = NEW.service_id
      AND dr.service_front_id = target_record.service_front_id
      AND dr.report_date = target_record.target_date;

    -- Verificar se está abaixo da meta
    IF total_executed < (target_record.target_quantity * target_percentage) THEN
      -- Buscar configuração de alerta ativa
      INSERT INTO alertas_historico (alerta_config_id, obra_id, mensagem)
      SELECT 
        ac.id,
        NULL, -- obra_id será preenchido se existir relação
        format('Produção abaixo da meta: %.2f de %.2f (%.0f%% da meta)', 
               total_executed, 
               target_record.target_quantity,
               target_percentage * 100)
      FROM alertas_config ac
      WHERE ac.tipo_alerta = 'producao_baixa'
        AND ac.ativo = true
      LIMIT 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para verificar produção após inserção de serviço executado
CREATE TRIGGER check_production_after_insert
  AFTER INSERT ON executed_services
  FOR EACH ROW
  EXECUTE FUNCTION check_production_target();

-- Criar função para registrar usuário em todas as operações
CREATE OR REPLACE FUNCTION ensure_user_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o campo user_id existe e não foi preenchido, preencher com auth.uid()
  IF TG_TABLE_NAME IN ('material_requests', 'material_control') THEN
    IF NEW.requested_by_user_id IS NULL OR NEW.recorded_by_user_id IS NULL THEN
      IF TG_TABLE_NAME = 'material_requests' THEN
        NEW.requested_by_user_id := auth.uid();
      ELSE
        NEW.recorded_by_user_id := auth.uid();
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Comentário nas tabelas para documentar rastreamento de usuário
COMMENT ON COLUMN executed_services.created_by_user_id IS 'Usuário que registrou o serviço executado - preenchido automaticamente';
COMMENT ON COLUMN daily_reports.executed_by_user_id IS 'Usuário que executou/registrou o RDO - preenchido automaticamente';
COMMENT ON COLUMN material_requests.requested_by_user_id IS 'Usuário que solicitou o material - preenchido automaticamente';
COMMENT ON COLUMN material_control.recorded_by_user_id IS 'Usuário que registrou o controle - preenchido automaticamente';