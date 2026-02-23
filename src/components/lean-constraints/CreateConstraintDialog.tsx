import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import {
  CONSTRAINT_TYPES,
  IMPACT_LABELS,
  type ConstraintType,
  type ImpactLevel,
  type LpsConstraint,
} from '@/types/lean-constraints';

type ConstraintPayload = Omit<LpsConstraint, 'id' | 'created_at' | 'updated_at' | 'service_fronts' | 'employees' | 'projects' | 'lps_five_whys'>;

interface CreateConstraintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ConstraintPayload) => void;
  editingConstraint?: LpsConstraint | null;
  serviceFronts: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  projectId: string;
  userId: string;
  submitting?: boolean;
}

export function CreateConstraintDialog({
  open, onOpenChange, onSubmit, editingConstraint, serviceFronts, employees, projectId, userId, submitting,
}: CreateConstraintDialogProps) {
  const [tipo, setTipo] = useState<ConstraintType>('restricao_externa');
  const [descricao, setDescricao] = useState('');
  const [serviceFrontId, setServiceFrontId] = useState<string>('');
  const [responsavelId, setResponsavelId] = useState<string>('');
  const [responsavelNome, setResponsavelNome] = useState('');
  const [impacto, setImpacto] = useState<ImpactLevel>('medio');
  const [dataPrevista, setDataPrevista] = useState('');
  const [notas, setNotas] = useState('');

  useEffect(() => {
    if (editingConstraint) {
      setTipo(editingConstraint.tipo_restricao);
      setDescricao(editingConstraint.descricao);
      setServiceFrontId(editingConstraint.service_front_id || '');
      setResponsavelId(editingConstraint.responsavel_id || '');
      setResponsavelNome(editingConstraint.responsavel_nome || '');
      setImpacto(editingConstraint.impacto);
      setDataPrevista(editingConstraint.data_prevista_resolucao || '');
      setNotas(editingConstraint.notas || '');
    } else {
      setTipo('restricao_externa');
      setDescricao('');
      setServiceFrontId('');
      setResponsavelId('');
      setResponsavelNome('');
      setImpacto('medio');
      setDataPrevista('');
      setNotas('');
    }
  }, [editingConstraint, open]);

  const handleSubmit = () => {
    if (!descricao.trim()) return;

    onSubmit({
      created_by_user_id: userId,
      project_id: projectId,
      service_front_id: serviceFrontId || null,
      tipo_restricao: tipo,
      descricao: descricao.trim(),
      responsavel_id: responsavelId || null,
      responsavel_nome: responsavelNome || null,
      impacto,
      data_prevista_resolucao: dataPrevista || null,
      data_resolvida: editingConstraint?.data_resolvida || null,
      notas: notas || null,
      status: editingConstraint?.status || 'ativa',
      origem: editingConstraint?.origem || 'manual',
      data_identificacao: editingConstraint?.data_identificacao || new Date().toISOString().split('T')[0],
      latitude: editingConstraint?.latitude || null,
      longitude: editingConstraint?.longitude || null,
      justification_id: editingConstraint?.justification_id || null,
      daily_report_id: editingConstraint?.daily_report_id || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingConstraint ? 'Editar Restrição' : 'Nova Restrição'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo de Restrição <span className="text-red-500">*</span></Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as ConstraintType)}>
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CONSTRAINT_TYPES) as ConstraintType[]).map((t) => (
                  <SelectItem key={t} value={t}>{CONSTRAINT_TYPES[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição <span className="text-red-500">*</span></Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva a restrição de forma clara e objetiva..."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="frente">Frente de Serviço</Label>
            <Select value={serviceFrontId || 'none'} onValueChange={(v) => setServiceFrontId(v === 'none' ? '' : v)}>
              <SelectTrigger id="frente">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {serviceFronts.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="responsavel">Responsável</Label>
              <Select value={responsavelId || 'none'} onValueChange={(v) => setResponsavelId(v === 'none' ? '' : v)}>
                <SelectTrigger id="responsavel">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resp-nome">Ou nome do responsável</Label>
              <Input
                id="resp-nome"
                value={responsavelNome}
                onChange={(e) => setResponsavelNome(e.target.value)}
                placeholder="Nome..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="impacto">Impacto</Label>
              <Select value={impacto} onValueChange={(v) => setImpacto(v as ImpactLevel)}>
                <SelectTrigger id="impacto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(IMPACT_LABELS) as ImpactLevel[]).map((i) => (
                    <SelectItem key={i} value={i}>{IMPACT_LABELS[i]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="data-prevista">Previsão Resolução</Label>
              <Input
                id="data-prevista"
                type="date"
                value={dataPrevista}
                onChange={(e) => setDataPrevista(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observações adicionais..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!descricao.trim() || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {editingConstraint ? 'Salvar Alterações' : 'Criar Restrição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
