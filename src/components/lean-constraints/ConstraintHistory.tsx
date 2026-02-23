import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Plus, Edit, CheckCircle, Trash2, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
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

export async function addHistoryEntry(entry: {
  constraint_id: string;
  action: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  user_name: string;
}) {
  await supabase.from('lps_constraint_audit').insert([{
    constraint_id: entry.constraint_id,
    action: entry.action,
    field: entry.field || null,
    old_value: entry.old_value || null,
    new_value: entry.new_value || null,
    user_name: entry.user_name,
  }]);
}

export function ConstraintHistory({ open, onOpenChange, constraintId, constraintDescription }: ConstraintHistoryProps) {
  const [entries, setEntries] = useState<ConstraintAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('lps_constraint_audit')
      .select('*')
      .eq('constraint_id', constraintId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setEntries((data ?? []) as ConstraintAuditEntry[]);
        setLoading(false);
      });
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
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
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
                          {new Date(entry.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {entry.field && (
                        <p className="text-muted-foreground mt-0.5">
                          <strong>{entry.field}:</strong> {entry.old_value} → {entry.new_value}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{entry.user_name}</p>
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
