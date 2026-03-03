/**
 * QEsgConfigDialog — Modal configuration dialog replicating the QEsg QGIS plugin.
 *
 * Tabs:
 *   - Layers: Rede, Nós, Interferências, MDT
 *   - Dados: Population, hydraulic parameters
 *   - Tubos: Editable pipe table (DN, rugosidade, material)
 *   - Opções de Cálculo: Hydraulic norms and parameters
 *
 * Configuration is saved per project via callback.
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Settings, Layers, Database, Wrench, Calculator, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  type QEsgProjectConfig,
  type QEsgTuboConfig,
  DEFAULT_QESG_CONFIG,
  DEFAULT_TUBOS_CONFIG,
} from "@/engine/qesgFields";

interface QEsgConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: QEsgProjectConfig;
  onConfigChange: (config: QEsgProjectConfig) => void;
  availableLayers?: { id: string; name: string; type: "line" | "point" | "raster" | "polygon" }[];
}

export const QEsgConfigDialog = ({
  open,
  onOpenChange,
  config,
  onConfigChange,
  availableLayers = [],
}: QEsgConfigDialogProps) => {
  const [draft, setDraft] = useState<QEsgProjectConfig>({ ...config });
  const [activeTab, setActiveTab] = useState("layers");

  // Reset draft when dialog opens
  useEffect(() => {
    if (open) {
      setDraft({ ...config });
      setActiveTab("layers");
    }
  }, [open, config]);

  const updateDraft = (partial: Partial<QEsgProjectConfig>) => {
    setDraft(prev => ({ ...prev, ...partial }));
  };

  const handleOk = () => {
    onConfigChange(draft);
    toast.success("Configuração salva");
    onOpenChange(false);
  };

  const handleClear = () => {
    setDraft({ ...DEFAULT_QESG_CONFIG });
    toast.info("Configuração limpa (valores padrão restaurados)");
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  // Layer filtering helpers
  const lineLayers = availableLayers.filter(l => l.type === "line");
  const pointLayers = availableLayers.filter(l => l.type === "point");
  const rasterLayers = availableLayers.filter(l => l.type === "raster");

  // Tubos editing
  const updateTubo = (index: number, field: keyof QEsgTuboConfig, value: string | number) => {
    const newTubos = [...draft.tubos];
    newTubos[index] = { ...newTubos[index], [field]: value };
    updateDraft({ tubos: newTubos });
  };

  const addTubo = () => {
    updateDraft({
      tubos: [...draft.tubos, { dn: 200, rugosidade: 0.013, material: "PVC" }],
    });
  };

  const removeTubo = (index: number) => {
    const newTubos = draft.tubos.filter((_, i) => i !== index);
    updateDraft({ tubos: newTubos });
  };

  const resetTubos = () => {
    updateDraft({ tubos: [...DEFAULT_TUBOS_CONFIG] });
    toast.info("Tabela de tubos restaurada");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-amber-600" />
            QEsg — Configuração do Projeto
          </DialogTitle>
          <DialogDescription>
            Configure layers, parâmetros hidráulicos, tubos e opções de cálculo.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="layers" className="flex items-center gap-1 text-xs">
              <Layers className="h-3.5 w-3.5" /> Layers
            </TabsTrigger>
            <TabsTrigger value="dados" className="flex items-center gap-1 text-xs">
              <Database className="h-3.5 w-3.5" /> Dados
            </TabsTrigger>
            <TabsTrigger value="tubos" className="flex items-center gap-1 text-xs">
              <Wrench className="h-3.5 w-3.5" /> Tubos
            </TabsTrigger>
            <TabsTrigger value="opcoes" className="flex items-center gap-1 text-xs">
              <Calculator className="h-3.5 w-3.5" /> Opções
            </TabsTrigger>
          </TabsList>

          {/* ═══ LAYERS ═══ */}
          <TabsContent value="layers" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium">Rede (Layer de Linhas)</Label>
                <Select value={draft.layerRede} onValueChange={v => updateDraft({ layerRede: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar layer de rede..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">Auto-detectar</SelectItem>
                    {lineLayers.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                    {lineLayers.length === 0 && (
                      <SelectItem value="__none__" disabled>Nenhum layer de linha importado</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium">Nós (Layer de Pontos)</Label>
                <Select value={draft.layerNos} onValueChange={v => updateDraft({ layerNos: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar layer de nós..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">Auto-detectar</SelectItem>
                    {pointLayers.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                    {pointLayers.length === 0 && (
                      <SelectItem value="__none__" disabled>Nenhum layer de ponto importado</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium">Interferências (Opcional)</Label>
                <Select value={draft.layerInterferencias} onValueChange={v => updateDraft({ layerInterferencias: v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {availableLayers.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name} ({l.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium">MDT / MDE (Raster)</Label>
                <Select value={draft.layerMDT} onValueChange={v => updateDraft({ layerMDT: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar raster MDT..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__rasterstore__">Raster carregado (GeoTIFF)</SelectItem>
                    {rasterLayers.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                    {rasterLayers.length === 0 && (
                      <SelectItem value="__none__" disabled>Nenhum raster importado</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Importe um arquivo .tif (GeoTIFF) na aba Mapa para usar como MDT.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ═══ DADOS ═══ */}
          <TabsContent value="dados" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">População Inicial</Label>
                <Input
                  type="number"
                  value={draft.populacaoInicial}
                  onChange={e => updateDraft({ populacaoInicial: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">População de Saturação</Label>
                <Input
                  type="number"
                  value={draft.populacaoSaturacao}
                  onChange={e => updateDraft({ populacaoSaturacao: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Diâmetro Mínimo (mm)</Label>
                <Input
                  type="number"
                  step="50"
                  value={draft.diametroMinimo}
                  onChange={e => updateDraft({ diametroMinimo: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Recobrimento Mínimo (m)</Label>
                <Input
                  type="number"
                  step="0.05"
                  value={draft.recobrimentoMinimo}
                  onChange={e => updateDraft({ recobrimentoMinimo: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Per Capita (L/hab.dia)</Label>
                <Input
                  type="number"
                  step="10"
                  value={draft.perCapita}
                  onChange={e => updateDraft({ perCapita: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Taxa de Infiltração (L/s.m)</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={draft.taxaInfiltracao}
                  onChange={e => updateDraft({ taxaInfiltracao: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">K1 (máx diária)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={draft.k1}
                  onChange={e => updateDraft({ k1: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">K2 (máx horária)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={draft.k2}
                  onChange={e => updateDraft({ k2: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Coeficiente de Retorno (C)</Label>
                <Input
                  type="number"
                  step="0.05"
                  value={draft.coefRetorno}
                  onChange={e => updateDraft({ coefRetorno: Number(e.target.value) })}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Fração da água consumida que retorna como esgoto (típico: 0.80)
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ═══ TUBOS ═══ */}
          <TabsContent value="tubos" className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Tabela de tubos padrão (DN, rugosidade, material)
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={addTubo}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
                <Button variant="ghost" size="sm" onClick={resetTubos}>
                  Restaurar Padrão
                </Button>
              </div>
            </div>
            <div className="border overflow-auto max-h-60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">DN (mm)</TableHead>
                    <TableHead className="w-24">Rugosidade (n)</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.tubos.map((tubo, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input
                          type="number"
                          value={tubo.dn}
                          onChange={e => updateTubo(i, "dn", Number(e.target.value))}
                          className="h-7 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.001"
                          value={tubo.rugosidade}
                          onChange={e => updateTubo(i, "rugosidade", Number(e.target.value))}
                          className="h-7 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={tubo.material}
                          onValueChange={v => updateTubo(i, "material", v)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PVC">PVC</SelectItem>
                            <SelectItem value="Concreto">Concreto</SelectItem>
                            <SelectItem value="PEAD">PEAD</SelectItem>
                            <SelectItem value="Ferro">Ferro</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTubo(i)}
                          className="h-7 w-7 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ═══ OPÇÕES DE CÁLCULO ═══ */}
          <TabsContent value="opcoes" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium">Norma Técnica</Label>
                <Select
                  value={draft.norma}
                  onValueChange={v => updateDraft({ norma: v as QEsgProjectConfig["norma"] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NBR 9649">NBR 9649 — Projeto de redes coletoras de esgoto</SelectItem>
                    <SelectItem value="NBR 14486">NBR 14486 — Sistemas enterrados para condução de esgoto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Material Padrão</Label>
                  <Select
                    value={draft.material}
                    onValueChange={v => {
                      const n = v === "PVC" ? 0.013 : 0.015;
                      updateDraft({ material: v, manning: n });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PVC">PVC (n=0.013)</SelectItem>
                      <SelectItem value="Concreto">Concreto (n=0.015)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Manning (n)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={draft.manning}
                    onChange={e => updateDraft({ manning: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Lâmina Máxima (y/D)</Label>
                  <Input
                    type="number"
                    step="0.05"
                    value={draft.laminaMaxima}
                    onChange={e => updateDraft({ laminaMaxima: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Tensão Trativa Mín (Pa)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={draft.tensaoMinima}
                    onChange={e => updateDraft({ tensaoMinima: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Velocidade Mín (m/s)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={draft.velMinima}
                    onChange={e => updateDraft({ velMinima: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Velocidade Máx (m/s)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={draft.velMaxima}
                    onChange={e => updateDraft({ velMaxima: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="bg-muted/50 rounded p-3 text-xs space-y-1">
                <p className="font-medium">Fórmulas (NBR 9649 / QEsg):</p>
                <p>Tensão trativa: τ = 10000 · Rh · I (Pa)</p>
                <p>Velocidade crítica: v_c = 6 · √(g · Rh)</p>
                <p>Declividade mínima: I_min = 0.0055 · Q^(-0.47)</p>
                <p>Diâmetro: D = [n·Q / (√I·(A/D²)·(Rh/D)^(2/3))]^(3/8) × 1000</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button variant="destructive" onClick={handleClear} size="sm">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpa Configs
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button onClick={handleOk}>
              OK
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
