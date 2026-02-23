import { Badge } from '@/components/ui/badge';
import type { ConstraintStatus, ImpactLevel } from '@/types/lean-constraints';
import { STATUS_LABELS, IMPACT_LABELS } from '@/types/lean-constraints';

const STATUS_VARIANTS: Record<ConstraintStatus, string> = {
  ativa: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  critica: 'bg-red-100 text-red-800 border-red-300',
  resolvida: 'bg-green-100 text-green-800 border-green-300',
};

const IMPACT_VARIANTS: Record<ImpactLevel, string> = {
  baixo: 'bg-blue-100 text-blue-800 border-blue-300',
  medio: 'bg-orange-100 text-orange-800 border-orange-300',
  alto: 'bg-red-100 text-red-800 border-red-300',
};

export function ConstraintStatusBadge({ status }: { status: ConstraintStatus }) {
  return (
    <Badge variant="outline" className={STATUS_VARIANTS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function ImpactBadge({ impact }: { impact: ImpactLevel }) {
  return (
    <Badge variant="outline" className={IMPACT_VARIANTS[impact]}>
      {IMPACT_LABELS[impact]}
    </Badge>
  );
}
