import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import type { LpsConstraint, DeadlineStatus } from '@/types/lean-constraints';
import { getDeadlineStatus, getDaysUntilDeadline } from '@/engine/lean-constraints';

const DEADLINE_CONFIG: Record<DeadlineStatus, {
  label: string;
  className: string;
  icon: typeof AlertTriangle;
}> = {
  overdue: {
    label: 'Vencida',
    className: 'bg-red-600 text-white border-red-700 animate-pulse',
    icon: AlertCircle,
  },
  critical: {
    label: 'Urgente',
    className: 'bg-red-100 text-red-800 border-red-300',
    icon: AlertTriangle,
  },
  warning: {
    label: 'Atenção',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: Clock,
  },
  ok: {
    label: 'No prazo',
    className: 'bg-green-100 text-green-800 border-green-300',
    icon: CheckCircle,
  },
  no_deadline: {
    label: 'Sem prazo',
    className: 'bg-gray-100 text-gray-600 border-gray-300',
    icon: Clock,
  },
  resolved: {
    label: 'Resolvida',
    className: 'bg-green-100 text-green-800 border-green-300',
    icon: CheckCircle,
  },
};

interface DeadlineIndicatorProps {
  constraint: LpsConstraint;
  compact?: boolean;
}

export function DeadlineIndicator({ constraint, compact = false }: DeadlineIndicatorProps) {
  const deadlineStatus = getDeadlineStatus(constraint);
  const daysLeft = getDaysUntilDeadline(constraint);
  const config = DEADLINE_CONFIG[deadlineStatus];
  const Icon = config.icon;

  const tooltipText = daysLeft !== null
    ? daysLeft < 0
      ? `Vencida há ${Math.abs(daysLeft)} dia(s)`
      : daysLeft === 0
        ? 'Vence hoje!'
        : `Vence em ${daysLeft} dia(s)`
    : 'Sem prazo definido';

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Icon className={`h-4 w-4 ${
            deadlineStatus === 'overdue' ? 'text-red-600 animate-pulse' :
            deadlineStatus === 'critical' ? 'text-red-500' :
            deadlineStatus === 'warning' ? 'text-amber-500' :
            'text-gray-400'
          }`} />
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant="outline" className={`${config.className} gap-1`}>
          <Icon className="h-3 w-3" />
          {daysLeft !== null ? (
            daysLeft < 0 ? `${Math.abs(daysLeft)}d atraso` :
            daysLeft === 0 ? 'Hoje' :
            `${daysLeft}d`
          ) : config.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}
