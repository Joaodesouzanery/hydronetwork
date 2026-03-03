import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Link2, AlertCircle } from 'lucide-react';
import {
  CONSTRAINT_TYPES,
  IMPACT_LABELS,
  STATUS_LABELS,
  type ConstraintType,
  type ImpactLevel,
  type ConstraintStatus,
  type LpsConstraint,
} from '@/types/lean-constraints';

type ConstraintPayload = Omit<LpsConstraint, 'id' | 'created_at' | 'updated_at' | 'service_fronts' | 'employees' | 'projects' | 'lps_five_whys' | 'parent_constraint' | 'child_constraints'>;

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
  initialCoordinates?: { lat: number; lng: number } | null;
  constraints?: LpsConstraint[];
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function CreateConstraintDialog({
  open, onOpenChange, onSubmit, editingConstraint, serviceFronts, employees,
  projectId, userId, submitting, initialCoordinates, constraints = [],
}: CreateConstraintDialogProps) {
  const [tipo, setTipo] = useState<ConstraintType>('restricao_externa');
  const [descricao, setDescricao] = useState('');
  const [serviceFrontId, setServiceFrontId] = useState<string>('');
  const [responsavelNome, setResponsavelNome] = useState('');
  const [impacto, setImpacto] = useState<ImpactLevel>('medio');
  const [status, setStatus] = useState<ConstraintStatus>('ativa');
  const [dataIdentificacao, setDataIdentificacao] = useState(getTodayDate());
  const [dataPrevista, setDataPrevista] = useState('');
  const [notas, setNotas] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [parentConstraintId, setParentConstraintId] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (editingConstraint) {
      setTipo(editingConstraint.tipo_restricao);
      setDescricao(editingConstraint.descricao);
      setServiceFrontId(editingConstraint.service_front_id || '');
      setResponsavelNome(editingConstraint.responsavel_nome || '');
      setImpacto(editingConstraint.impacto);
      setStatus(editingConstraint.status);
      setDataIdentificacao(editingConstraint.data_identificacao || getTodayDate());
      setDataPrevista(editingConstraint.data_prevista_resolucao || '');
      setNotas(editingConstraint.notas || '');
      setLatitude(editingConstraint.latitude?.toString() || '');
      setLongitude(editingConstraint.longitude?.toString() || '');
      setParentConstraintId(editingConstraint.parent_constraint_id || '');
    } else {
      setTipo('restricao_externa');
      setDescricao('');
      setServiceFrontId('');
      setResponsavelNome('');
      setImpacto('medio');
      setStatus('ativa');
      setDataIdentificacao(getTodayDate());
      setDataPrevista('');
      setNotas('');
      setLatitude(initialCoordinates?.lat?.toString() || '');
      setLongitude(initialCoordinates?.lng?.toString() || '');
      setParentConstraintId('');
    }
    setErrors({});
    setSaving(false);
  }, [editingConstraint, open, initialCoordinates]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!descricao.trim()) newErrors.descricao = 'Descricao e obrigatoria';
    if (!dataIdentificacao) newErrors.dataIdentificacao = 'Data e obrigatoria';
    if (!projectId) newErrors.project = 'Selecione um projeto primeiro';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setSaving(true);

    const payload: ConstraintPayload = {
      created_by_user_id: userId || 'local-user',
      project_id: projectId,
      service_front_id: serviceFrontId || null,
      tipo_restricao: tipo,
      descricao: descricao.trim(),
      responsavel_id: null,
      responsavel_nome: responsavelNome.trim() || null,
      impacto,
      status: editingConstraint ? status : 'ativa',
      data_identificacao: dataIdentificacao,
      data_prevista_resolucao: dataPrevista || null,
      data_resolvida: editingConstraint?.data_resolvida || null,
      notas: notas.trim() || null,
      origem: editingConstraint?.origem || 'manual',
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      justification_id: editingConstraint?.justification_id || null,
      daily_report_id: editingConstraint?.daily_report_id || null,
      parent_constraint_id: parentConstraintId || null,
    };

    onSubmit(payload);
    onOpenChange(false);
    setSaving(false);
  };

  const availableParents = constraints.filter(c => c.id !== editingConstraint?.id && c.status !== 'resolvida');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {editingConstraint ? 'Editar Restricao' : 'Nova Restricao'}
            {initialCoordinates && !editingConstraint && (
              <Badge variant="outline" className="ml-2 text-xs">
                <MapPin className="h-3 w-3 mr-1" /> Via mapa
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {errors.project && (
          <div className="bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {errors.project}
          </div>
        )}

        <div className="space-y-4">
          {/* Row 1: Tipo + Impacto + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo de Restricao <span className="text-red-500">*</span></Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as ConstraintType)}>
                <SelectTrigger>
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
              <Label>Impacto</Label>
              <Select value={impacto} onValueChange={(v) => setImpacto(v as ImpactLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(IMPACT_LABELS) as ImpactLevel[]).map((i) => (
                    <SelectItem key={i} value={i}>{IMPACT_LABELS[i]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editingConstraint ? (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ConstraintStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as ConstraintStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <div className="h-10 flex items-center">
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Ativa</Badge>
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Descricao */}
          <div className="space-y-1.5">
            <Label>Descricao <span className="text-red-500">*</span></Label>
            <Textarea
              value={descricao}
              onChange={(e) => { setDescricao(e.target.value); setErrors(prev => ({ ...prev, descricao: '' })); }}
              placeholder="Descreva a restricao de forma clara e objetiva. Ex: Falta de material para tubulacao DN 200mm no trecho 3..."
              rows={3}
              className={errors.descricao ? 'border-red-400' : ''}
            />
            {errors.descricao && <p className="text-xs text-red-500">{errors.descricao}</p>}
          </div>

          {/* Row 3: Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Data de Identificacao <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={dataIdentificacao}
                onChange={(e) => { setDataIdentificacao(e.target.value); setErrors(prev => ({ ...prev, dataIdentificacao: '' })); }}
                className={errors.dataIdentificacao ? 'border-red-400' : ''}
              />
              {errors.dataIdentificacao && <p className="text-xs text-red-500">{errors.dataIdentificacao}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Previsao de Resolucao</Label>
              <Input
                type="date"
                value={dataPrevista}
                onChange={(e) => setDataPrevista(e.target.value)}
              />
            </div>
          </div>

          {/* Row 4: Responsavel + Frente de Servico */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Responsavel</Label>
              <Input
                value={responsavelNome}
                onChange={(e) => setResponsavelNome(e.target.value)}
                placeholder="Nome do responsavel..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Frente de Servico</Label>
              <Select value={serviceFrontId || 'none'} onValueChange={(v) => setServiceFrontId(v === 'none' ? '' : v)}>
                <SelectTrigger>
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
          </div>

          {/* Row 5: Notas */}
          <div className="space-y-1.5">
            <Label>Notas / Observacoes</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Informacoes adicionais, contexto, acoes ja tomadas..."
              rows={2}
            />
          </div>

          {/* Row 6: Coordenadas (colapsavel) */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Localizacao no mapa (opcional)
            </summary>
            <div className="grid grid-cols-2 gap-4 mt-2 pl-5">
              <div className="space-y-1">
                <Label className="text-xs">Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="-15.7801"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="-47.9292"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </details>

          {/* Row 7: Restricao pai (se houver) */}
          {availableParents.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5" /> Vincular a outra restricao (opcional)
              </summary>
              <div className="mt-2 pl-5">
                <Select value={parentConstraintId || 'none'} onValueChange={(v) => setParentConstraintId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem dependencia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem dependencia</SelectItem>
                    {availableParents.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.descricao.length > 60 ? c.descricao.substring(0, 60) + '...' : c.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </details>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || submitting}>
            {(saving || submitting) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {editingConstraint ? 'Salvar Alteracoes' : 'Criar Restricao'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
