export const CONSTRAINT_TYPES = {
  projeto_nao_liberado: 'Projeto Não Liberado',
  material_nao_entregue: 'Material Não Entregue',
  equipe_indisponivel: 'Equipe Indisponível',
  interferencia_tecnica: 'Interferência Técnica',
  falta_equipamento: 'Falta de Equipamento',
  condicao_climatica: 'Condição Climática',
  aprovacao_pendente: 'Aprovação Pendente',
  restricao_contratual: 'Restrição Contratual',
  restricao_externa: 'Restrição Externa',
} as const;

export type ConstraintType = keyof typeof CONSTRAINT_TYPES;
export type ConstraintStatus = 'ativa' | 'resolvida' | 'critica';
export type ImpactLevel = 'baixo' | 'medio' | 'alto';
export type CommitmentStatus = 'planejado' | 'cumprido' | 'nao_cumprido' | 'parcial';

export interface LpsConstraint {
  id: string;
  created_by_user_id: string;
  project_id: string;
  service_front_id: string | null;
  tipo_restricao: ConstraintType;
  descricao: string;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  data_identificacao: string;
  data_prevista_resolucao: string | null;
  data_resolvida: string | null;
  status: ConstraintStatus;
  impacto: ImpactLevel;
  latitude: number | null;
  longitude: number | null;
  origem: 'manual' | 'rdo_justificativa' | 'planejamento';
  justification_id: string | null;
  daily_report_id: string | null;
  parent_constraint_id: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  service_fronts?: { id: string; name: string };
  employees?: { id: string; name: string };
  projects?: { id: string; name: string };
  lps_five_whys?: LpsFiveWhys[];
  parent_constraint?: { id: string; descricao: string } | null;
  child_constraints?: { id: string; descricao: string; status: ConstraintStatus }[];
}

export interface LpsWeeklyCommitment {
  id: string;
  created_by_user_id: string;
  project_id: string;
  service_front_id: string | null;
  semana_inicio: string;
  semana_fim: string;
  descricao_tarefa: string;
  service_id: string | null;
  quantidade_planejada: number | null;
  quantidade_executada: number | null;
  unidade: string | null;
  status: CommitmentStatus;
  motivo_nao_cumprimento: string | null;
  constraint_id: string | null;
  created_at: string;
  updated_at: string;
  service_fronts?: { id: string; name: string };
  lps_constraints?: { id: string; descricao: string };
}

export interface LpsFiveWhys {
  id: string;
  created_by_user_id: string;
  constraint_id: string;
  why_1: string;
  why_2: string | null;
  why_3: string | null;
  why_4: string | null;
  why_5: string | null;
  causa_raiz: string;
  acao_corretiva: string;
  responsavel_acao: string | null;
  prazo_acao: string | null;
  status_acao: string;
  created_at: string;
  updated_at: string;
}

export interface PPCResult {
  weekStart: string;
  weekEnd: string;
  totalCommitments: number;
  completed: number;
  partial: number;
  notCompleted: number;
  ppc: number;
  ppcAdjusted: number;
}

export interface ConstraintsByArea {
  areaName: string;
  areaId: string;
  total: number;
  ativas: number;
  criticas: number;
  resolvidas: number;
}

export interface ConstraintFilters {
  projectId?: string;
  serviceFrontId?: string;
  status?: ConstraintStatus | 'todas';
  tipo?: ConstraintType | 'todos';
  impacto?: ImpactLevel | 'todos';
  responsavelId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const IMPACT_LABELS: Record<ImpactLevel, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
};

export const STATUS_LABELS: Record<ConstraintStatus, string> = {
  ativa: 'Ativa',
  resolvida: 'Resolvida',
  critica: 'Crítica',
};

export const COMMITMENT_STATUS_LABELS: Record<CommitmentStatus, string> = {
  planejado: 'Planejado',
  cumprido: 'Cumprido',
  nao_cumprido: 'Não Cumprido',
  parcial: 'Parcial',
};

export type DeadlineStatus = 'overdue' | 'critical' | 'warning' | 'ok' | 'no_deadline' | 'resolved';

export interface ConstraintAuditEntry {
  id: string;
  constraint_id: string;
  action: 'created' | 'updated' | 'resolved' | 'deleted' | 'status_changed';
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  user_name: string;
  created_at: string;
}

export interface CorrectiveAction {
  id: string;
  constraint_id: string;
  constraint_descricao: string;
  constraint_status: ConstraintStatus;
  acao_corretiva: string;
  causa_raiz: string;
  responsavel_acao: string | null;
  prazo_acao: string | null;
  status_acao: string;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  totalAtivas: number;
  totalCriticas: number;
  novasSemana: number;
  resolvidasSemana: number;
  vencidas: number;
  ppc: number;
  ppcAdjusted: number;
  topConstraintTypes: { tipo: ConstraintType; count: number }[];
  topAreas: { areaName: string; total: number }[];
}

export const PERIOD_PRESETS = [
  { label: 'Últimos 7 dias', days: 7 },
  { label: 'Últimos 15 dias', days: 15 },
  { label: 'Últimos 30 dias', days: 30 },
  { label: 'Últimos 90 dias', days: 90 },
  { label: 'Tudo', days: 0 },
] as const;
