import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Plus, Edit, CheckCircle, Trash2, ArrowRight } from 'lucide-react';
import type { ConstraintAuditEntry } from '@/types/lean-constraints';

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Plus; color: string }> = {
  created: { label: 'Criada', icon: Plus, color: 'text-green-600' },
  updated: { label: 'Atualizada', icon: Edit, color: 'text-blue-600' },
  resolved: { label: 'Resolvida', icon: CheckCircle, color: 'text-emerald-600' },
  deleted: { label: 'Excluída', icon: Trash2, color: 'text-red-600' },
  status_changed: { label: 'Status Alterado', icon: ArrowRight, color: 'text-purple-600' },
};

interface ConstraintHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  constraintId: string;
  constraintDescription: string;
}

const STORAGE_KEY = 'lean-constraint-history';

export function getStoredHistory(): ConstraintAuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addHistoryEntry(entry: Omit<ConstraintAuditEntry, 'id' | 'timestamp'>) {
  const history = getStoredHistory();
  history.unshift({
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });
  // Keep last 500 entries
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 500)));
}

export function ConstraintHistory({ open, onOpenChange, constraintId, constraintDescription }: ConstraintHistoryProps) {
  const [entries, setEntries] = useState<ConstraintAuditEntry[]>([]);

  useEffect(() => {
    if (open) {
      const all = getStoredHistory();
      setEntries(all.filter(e => e.constraintId === constraintId));
    }
  }, [open, constraintId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Histórico de Alterações
          </DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{constraintDescription}</p>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          {entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma alteração registrada.
            </p>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => {
                const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.updated;
                const Icon = config.icon;
                return (
                  <div key={entry.id} className="flex gap-3 text-sm">
                    <div className={`mt-0.5 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{config.label}</Badge>
                        <span className="text-muted-foreground text-xs">
                          {new Date(entry.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {entry.field && (
                        <p className="text-muted-foreground mt-0.5">
                          <strong>{entry.field}:</strong> {entry.oldValue} → {entry.newValue}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{entry.userName}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
