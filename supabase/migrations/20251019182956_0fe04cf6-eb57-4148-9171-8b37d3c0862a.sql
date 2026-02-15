-- Force complete types regeneration by adding comments to all tables
COMMENT ON TABLE public.obras IS 'Tabela de gerenciamento de obras de construção';
COMMENT ON TABLE public.alertas_config IS 'Configurações de alertas para obras';
COMMENT ON TABLE public.alertas_historico IS 'Histórico de alertas enviados';
COMMENT ON TABLE public.formulario_modelos IS 'Modelos de formulários customizáveis';
COMMENT ON TABLE public.formularios_producao IS 'Registros de produção diária';
COMMENT ON TABLE public.metas_producao IS 'Metas de produção por frente';
COMMENT ON TABLE public.rdos IS 'Relatórios Diários de Obra';

-- Add indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_obras_user_id ON public.obras(user_id);
CREATE INDEX IF NOT EXISTS idx_formularios_producao_obra_id ON public.formularios_producao(obra_id);
CREATE INDEX IF NOT EXISTS idx_rdos_obra_id ON public.rdos(obra_id);
CREATE INDEX IF NOT EXISTS idx_alertas_config_user_id ON public.alertas_config(user_id);
CREATE INDEX IF NOT EXISTS idx_metas_producao_obra_id ON public.metas_producao(obra_id);