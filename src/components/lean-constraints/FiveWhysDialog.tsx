import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { LpsConstraint, LpsFiveWhys } from '@/types/lean-constraints';

interface FiveWhysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  constraint: LpsConstraint;
  existingAnalysis?: LpsFiveWhys;
  onSubmit: (data: Omit<LpsFiveWhys, 'id' | 'created_at' | 'updated_at'>) => void;
  userId: string;
}

export function FiveWhysDialog({
  open, onOpenChange, constraint, existingAnalysis, onSubmit, userId,
}: FiveWhysDialogProps) {
  const [why1, setWhy1] = useState(existingAnalysis?.why_1 || '');
  const [why2, setWhy2] = useState(existingAnalysis?.why_2 || '');
  const [why3, setWhy3] = useState(existingAnalysis?.why_3 || '');
  const [why4, setWhy4] = useState(existingAnalysis?.why_4 || '');
  const [why5, setWhy5] = useState(existingAnalysis?.why_5 || '');
  const [causaRaiz, setCausaRaiz] = useState(existingAnalysis?.causa_raiz || '');
  const [acaoCorretiva, setAcaoCorretiva] = useState(existingAnalysis?.acao_corretiva || '');
  const [responsavelAcao, setResponsavelAcao] = useState(existingAnalysis?.responsavel_acao || '');
  const [prazoAcao, setPrazoAcao] = useState(existingAnalysis?.prazo_acao || '');

  const handleSubmit = () => {
    if (!why1.trim() || !causaRaiz.trim() || !acaoCorretiva.trim()) return;

    onSubmit({
      created_by_user_id: userId,
      constraint_id: constraint.id,
      why_1: why1.trim(),
      why_2: why2.trim() || null,
      why_3: why3.trim() || null,
      why_4: why4.trim() || null,
      why_5: why5.trim() || null,
      causa_raiz: causaRaiz.trim(),
      acao_corretiva: acaoCorretiva.trim(),
      responsavel_acao: responsavelAcao.trim() || null,
      prazo_acao: prazoAcao || null,
      status_acao: 'pendente',
    });

    onOpenChange(false);
  };

  const whyFields = [
    { label: '1. Por quê? *', value: why1, set: setWhy1 },
    { label: '2. Por quê?', value: why2, set: setWhy2 },
    { label: '3. Por quê?', value: why3, set: setWhy3 },
    { label: '4. Por quê?', value: why4, set: setWhy4 },
    { label: '5. Por quê?', value: why5, set: setWhy5 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Análise 5 Porquês</DialogTitle>
        </DialogHeader>

        <div className="bg-muted p-3 rounded-md text-sm mb-4">
          <strong>Restrição:</strong> {constraint.descricao}
        </div>

        <div className="space-y-3">
          {whyFields.map((field, i) => (
            <div key={i} className="space-y-1">
              <Label className="text-sm">{field.label}</Label>
              <Input
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                placeholder={`Por que ${i > 0 ? 'isso aconteceu' : 'o problema ocorreu'}?`}
              />
            </div>
          ))}

          <div className="border-t pt-3 space-y-3">
            <div className="space-y-1">
              <Label>Causa Raiz *</Label>
              <Textarea
                value={causaRaiz}
                onChange={(e) => setCausaRaiz(e.target.value)}
                placeholder="Qual a causa raiz identificada?"
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label>Ação Corretiva *</Label>
              <Textarea
                value={acaoCorretiva}
                onChange={(e) => setAcaoCorretiva(e.target.value)}
                placeholder="Qual ação será tomada?"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Responsável</Label>
                <Input
                  value={responsavelAcao}
                  onChange={(e) => setResponsavelAcao(e.target.value)}
                  placeholder="Nome..."
                />
              </div>
              <div className="space-y-1">
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={prazoAcao}
                  onChange={(e) => setPrazoAcao(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!why1.trim() || !causaRaiz.trim() || !acaoCorretiva.trim()}
          >
            Salvar Análise
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
