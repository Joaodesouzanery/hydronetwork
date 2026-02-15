-- Adicionar campos de justificativa na tabela de alertas_historico
ALTER TABLE alertas_historico 
ADD COLUMN justificativa TEXT,
ADD COLUMN justificado_por_user_id UUID REFERENCES auth.users(id),
ADD COLUMN justificado_em TIMESTAMP WITH TIME ZONE;

-- Adicionar comentário explicativo
COMMENT ON COLUMN alertas_historico.justificativa IS 'Justificativa fornecida pelo gestor/responsável para o alerta';
COMMENT ON COLUMN alertas_historico.justificado_por_user_id IS 'ID do usuário que forneceu a justificativa';
COMMENT ON COLUMN alertas_historico.justificado_em IS 'Data e hora em que a justificativa foi fornecida';