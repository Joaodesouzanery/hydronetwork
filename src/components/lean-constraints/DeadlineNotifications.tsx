import { useState } from 'react';
import { AlertTriangle, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CONSTRAINT_TYPES, type LpsConstraint } from '@/types/lean-constraints';
import { getOverdueConstraints, getNearDeadlineConstraints, getDaysUntilDeadline } from '@/engine/lean-constraints';

interface DeadlineNotificationsProps {
  constraints: LpsConstraint[];
  onGoToConstraint?: (constraint: LpsConstraint) => void;
}

export function DeadlineNotifications({ constraints, onGoToConstraint }: DeadlineNotificationsProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const overdue = getOverdueConstraints(constraints);
  const nearDeadline = getNearDeadlineConstraints(constraints);

  if (dismissed || (overdue.length === 0 && nearDeadline.length === 0)) return null;

  return (
    <div className="space-y-2">
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5 animate-pulse" />
              <span className="font-semibold">
                {overdue.length} restrição(ões) vencida(s)!
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-600"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-600"
                onClick={() => setDismissed(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {expanded && (
            <div className="mt-2 space-y-1">
              {overdue.map(c => {
                const days = getDaysUntilDeadline(c);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-sm text-red-700 p-1.5 bg-red-100 rounded cursor-pointer hover:bg-red-200"
                    onClick={() => onGoToConstraint?.(c)}
                  >
                    <span className="truncate flex-1">
                      <strong>{CONSTRAINT_TYPES[c.tipo_restricao]}:</strong> {c.descricao}
                    </span>
                    <span className="ml-2 font-semibold whitespace-nowrap">
                      {days !== null ? `${Math.abs(days)}d atraso` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {nearDeadline.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-3">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">
              {nearDeadline.length} restrição(ões) vencem nos próximos 7 dias
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
