/**
 * CustomCostTrechoModule — Complete module for custom cost base management,
 * cost allocation per trecho, measurement tracking, schedule generation,
 * and Gantt chart visualization.
 *
 * Replaces SINAPI dependency with user-importable cost bases.
 * All fields are 100% editable.
 */

import { useState, useMemo, useCallback, useRef, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, DollarSign, Calendar, Plus, Trash2,
  Edit3, Download, Search, MapPin, BarChart3, Check, Settings2,
  ArrowRight, Layers, Package, ClipboardCheck, GanttChart,
  FileJson, FileText, Table2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from "recharts";

import type { Trecho } from "@/engine/domain";
import {
  type CostBase, type CostBaseItem, type ColumnMapping, type ImportPreview,
  loadCostBases, saveCostBase, deleteCostBase,
  parseFile, applyMapping, createCostBaseFromImport,
  addItemToBase, updateItemInBase, removeItemFromBase,
  exportCostBaseToCSV,
} from "@/engine/costBase";
import {
  type TrechoCostAllocation, type TrechoCostItem,
  loadAllocations, saveAllocations,
  getAllocation, recalculateAllocation,
  addItemToTrecho, removeItemFromTrecho, updateTrechoItem, updateTrechoBDI,
  getAllocationSummary,
} from "@/engine/costAllocation";
import {
  type TrechoMeasurement, type MeasurementEntry,
  loadMeasurements, saveMeasurements,
  getMeasurement, initializeMeasurement,
  addMeasurementEntry, removeMeasurementEntry,
  setMeasurementDirect, getMeasurementSummary,
} from "@/engine/trechoMeasurement";
import {
  type TrechoScheduleItem, type GanttItem, type ScheduleConfig,
  loadScheduleItems, loadScheduleConfig, saveScheduleConfig,
  generateSchedule, updateScheduleItem, generateGanttData,
  getScheduleSummary, calculateDuration,
} from "@/engine/trechoSchedule";

// ── Helpers ──

function fmtC(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmt(n: number, d = 2): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ── Props ──

interface CustomCostTrechoModuleProps {
  trechos: Trecho[];
}

// ── Main Component ──

export function CustomCostTrechoModule({ trechos }: CustomCostTrechoModuleProps) {
  const [activeTab, setActiveTab] = useState("base-custo");

  // ── Cost Base state ──
  const [costBases, setCostBases] = useState<CostBase[]>(() => loadCostBases());
  const [activeCostBaseId, setActiveCostBaseId] = useState<string>(() => costBases[0]?.id || "");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importName, setImportName] = useState("");
  const [importDesc, setImportDesc] = useState("");
  const [importMapping, setImportMapping] = useState<ColumnMapping>({
    codigo: "", descricao: "", unidade: "", custoUnitario: "", produtividade: "", composicao: "",
  });
  const [editingItem, setEditingItem] = useState<CostBaseItem | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newItem, setNewItem] = useState<Partial<CostBaseItem>>({
    codigo: "", descricao: "", unidade: "m", custoUnitario: 0, produtividade: 0, composicao: "", categoria: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [searchBase, setSearchBase] = useState("");

  // ── Cost Allocation state ──
  const [allocations, setAllocations] = useState<TrechoCostAllocation[]>(() => loadAllocations());
  const [selectedTrechoKey, setSelectedTrechoKey] = useState<string>("");
  const [allocItemSearch, setAllocItemSearch] = useState("");
  const [allocQty, setAllocQty] = useState<number>(0);

  // ── Measurement state ──
  const [measurements, setMeasurements] = useState<TrechoMeasurement[]>(() => loadMeasurements());
  const [measTrechoKey, setMeasTrechoKey] = useState<string>("");
  const [measValue, setMeasValue] = useState<number>(0);
  const [measObs, setMeasObs] = useState("");
  const [measResponsavel, setMeasResponsavel] = useState("");

  // ── Schedule/Gantt state ──
  const [scheduleItems, setScheduleItems] = useState<TrechoScheduleItem[]>(() => loadScheduleItems());
  const [schedConfig, setSchedConfig] = useState<ScheduleConfig>(() => loadScheduleConfig());
  const [ganttData, setGanttData] = useState<GanttItem[]>([]);

  // ── Derived data ──
  const activeCostBase = useMemo(
    () => costBases.find(b => b.id === activeCostBaseId),
    [costBases, activeCostBaseId]
  );

  const filteredBaseItems = useMemo(() => {
    if (!activeCostBase) return [];
    if (!searchBase) return activeCostBase.items;
    const s = searchBase.toLowerCase();
    return activeCostBase.items.filter(i =>
      i.codigo.toLowerCase().includes(s) ||
      i.descricao.toLowerCase().includes(s) ||
      i.categoria.toLowerCase().includes(s)
    );
  }, [activeCostBase, searchBase]);

  const trechoOptions = useMemo(() =>
    trechos.map(t => ({
      key: `${t.idInicio}-${t.idFim}`,
      nome: t.nomeTrecho || `${t.idInicio}→${t.idFim}`,
      comprimento: t.comprimento,
    })),
    [trechos]
  );

  const selectedAllocation = useMemo(
    () => allocations.find(a => a.trechoKey === selectedTrechoKey),
    [allocations, selectedTrechoKey]
  );

  const selectedMeasurement = useMemo(
    () => measurements.find(m => m.trechoKey === measTrechoKey),
    [measurements, measTrechoKey]
  );

  const allocSummary = useMemo(() => getAllocationSummary(), [allocations]);
  const measSummary = useMemo(() => getMeasurementSummary(), [measurements]);
  const schedSummary = useMemo(() => getScheduleSummary(scheduleItems), [scheduleItems]);

  // ══════════════════════════════
  // COST BASE HANDLERS
  // ══════════════════════════════

  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const preview = await parseFile(file);
      setImportPreview(preview);
      setImportName(file.name.replace(/\.[^.]+$/, ""));
      // Auto-map common columns
      const mapping: ColumnMapping = { codigo: "", descricao: "", unidade: "", custoUnitario: "", produtividade: "", composicao: "" };
      for (const h of preview.headers) {
        const hl = h.toLowerCase();
        if (hl.includes("codigo") || hl.includes("code") || hl.includes("item")) mapping.codigo = h;
        else if (hl.includes("descri") || hl.includes("desc")) mapping.descricao = h;
        else if (hl.includes("unid") || hl.includes("unit")) mapping.unidade = h;
        else if (hl.includes("custo") || hl.includes("preco") || hl.includes("price") || hl.includes("valor")) mapping.custoUnitario = h;
        else if (hl.includes("produt") || hl.includes("rendim")) mapping.produtividade = h;
        else if (hl.includes("compos") || hl.includes("comp")) mapping.composicao = h;
      }
      setImportMapping(mapping);
      setImportDialogOpen(true);
    } catch (err) {
      toast.error(`Erro ao importar: ${(err as Error).message}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const confirmImport = useCallback(() => {
    if (!importPreview || !importName) {
      toast.error("Preencha o nome da base.");
      return;
    }
    if (!importMapping.descricao) {
      toast.error("Mapeie pelo menos a coluna de Descrição.");
      return;
    }
    const base = createCostBaseFromImport(importName, importDesc, importPreview.rawData, importMapping);
    setCostBases(loadCostBases());
    setActiveCostBaseId(base.id);
    setImportDialogOpen(false);
    setImportPreview(null);
    toast.success(`Base "${importName}" importada com ${base.items.length} itens.`);
  }, [importPreview, importName, importDesc, importMapping]);

  const handleDeleteBase = useCallback((id: string) => {
    deleteCostBase(id);
    const updated = loadCostBases();
    setCostBases(updated);
    if (activeCostBaseId === id) setActiveCostBaseId(updated[0]?.id || "");
    toast.success("Base removida.");
  }, [activeCostBaseId]);

  const handleUpdateItem = useCallback((itemId: string, field: keyof CostBaseItem, value: string | number) => {
    if (!activeCostBaseId) return;
    updateItemInBase(activeCostBaseId, itemId, { [field]: value });
    setCostBases(loadCostBases());
  }, [activeCostBaseId]);

  const handleRemoveItem = useCallback((itemId: string) => {
    if (!activeCostBaseId) return;
    removeItemFromBase(activeCostBaseId, itemId);
    setCostBases(loadCostBases());
    toast.success("Item removido.");
  }, [activeCostBaseId]);

  const handleAddItem = useCallback(() => {
    if (!activeCostBaseId) return;
    addItemToBase(activeCostBaseId, {
      codigo: newItem.codigo || `ITEM-${Date.now()}`,
      descricao: newItem.descricao || "Novo item",
      unidade: newItem.unidade || "un",
      custoUnitario: newItem.custoUnitario || 0,
      produtividade: newItem.produtividade || 0,
      composicao: newItem.composicao || "",
      fonte: activeCostBase?.nome || "",
      categoria: newItem.categoria || "",
    });
    setCostBases(loadCostBases());
    setAddItemOpen(false);
    setNewItem({ codigo: "", descricao: "", unidade: "m", custoUnitario: 0, produtividade: 0, composicao: "", categoria: "" });
    toast.success("Item adicionado.");
  }, [activeCostBaseId, newItem, activeCostBase]);

  const handleExportBase = useCallback(() => {
    if (!activeCostBase) return;
    const csv = exportCostBaseToCSV(activeCostBase);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeCostBase.nome}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Base exportada.");
  }, [activeCostBase]);

  // ══════════════════════════════
  // COST ALLOCATION HANDLERS
  // ══════════════════════════════

  const handleAllocateItem = useCallback((costItem: CostBaseItem) => {
    if (!selectedTrechoKey) {
      toast.error("Selecione um trecho primeiro.");
      return;
    }
    const trecho = trechoOptions.find(t => t.key === selectedTrechoKey);
    if (!trecho) return;
    const qty = allocQty > 0 ? allocQty : trecho.comprimento;
    addItemToTrecho(selectedTrechoKey, trecho.nome, trecho.comprimento, costItem, qty);
    setAllocations(loadAllocations());
    toast.success(`"${costItem.descricao}" alocado ao trecho ${trecho.nome}.`);
  }, [selectedTrechoKey, allocQty, trechoOptions]);

  const handleRemoveAllocItem = useCallback((trechoKey: string, itemId: string) => {
    removeItemFromTrecho(trechoKey, itemId);
    setAllocations(loadAllocations());
    toast.success("Item removido do trecho.");
  }, []);

  const handleUpdateAllocItem = useCallback((trechoKey: string, itemId: string, field: keyof TrechoCostItem, value: number) => {
    updateTrechoItem(trechoKey, itemId, { [field]: value });
    setAllocations(loadAllocations());
  }, []);

  const handleUpdateBDI = useCallback((trechoKey: string, bdi: number) => {
    updateTrechoBDI(trechoKey, bdi);
    setAllocations(loadAllocations());
  }, []);

  // ══════════════════════════════
  // MEASUREMENT HANDLERS
  // ══════════════════════════════

  const handleInitMeasurements = useCallback(() => {
    for (const t of trechoOptions) {
      const alloc = getAllocation(t.key);
      const custoOrcado = alloc?.custoComBDI || 0;
      initializeMeasurement(t.key, t.nome, t.comprimento, custoOrcado);
    }
    setMeasurements(loadMeasurements());
    toast.success(`${trechoOptions.length} trechos inicializados para medição.`);
  }, [trechoOptions]);

  const handleAddMeasEntry = useCallback(() => {
    if (!measTrechoKey) {
      toast.error("Selecione um trecho.");
      return;
    }
    if (measValue <= 0) {
      toast.error("Informe a quantidade medida.");
      return;
    }
    addMeasurementEntry(measTrechoKey, {
      data: new Date().toISOString().slice(0, 10),
      comprimentoMedido: measValue,
      observacao: measObs,
      responsavel: measResponsavel,
    });
    setMeasurements(loadMeasurements());
    setMeasValue(0);
    setMeasObs("");
    toast.success("Medição registrada.");
  }, [measTrechoKey, measValue, measObs, measResponsavel]);

  const handleMeasureComplete = useCallback((trechoKey: string) => {
    const meas = getMeasurement(trechoKey);
    if (!meas) return;
    setMeasurementDirect(trechoKey, meas.comprimentoTotal, "Medição total (100%)");
    setMeasurements(loadMeasurements());
    toast.success("Trecho medido como 100%.");
  }, []);

  // ══════════════════════════════
  // SCHEDULE/GANTT HANDLERS
  // ══════════════════════════════

  const handleGenerateSchedule = useCallback(() => {
    const inputs = trechoOptions.map(t => {
      const alloc = getAllocation(t.key);
      const meas = getMeasurement(t.key);
      return {
        trechoKey: t.key,
        nomeTrecho: t.nome,
        comprimento: t.comprimento,
        custoTotal: alloc?.custoComBDI || 0,
        progressoPct: meas?.progressoPct || 0,
      };
    });
    const items = generateSchedule(inputs, schedConfig);
    setScheduleItems(items);
    setGanttData(generateGanttData(items));
    toast.success(`Cronograma gerado para ${items.length} trechos.`);
  }, [trechoOptions, schedConfig]);

  const handleUpdateScheduleConfig = useCallback((field: keyof ScheduleConfig, value: unknown) => {
    const updated = { ...schedConfig, [field]: value };
    setSchedConfig(updated);
    saveScheduleConfig(updated);
  }, [schedConfig]);

  const handleUpdateScheduleItem = useCallback((trechoKey: string, field: keyof TrechoScheduleItem, value: number | string) => {
    updateScheduleItem(trechoKey, { [field]: value } as Partial<TrechoScheduleItem>);
    const items = loadScheduleItems();
    setScheduleItems(items);
    setGanttData(generateGanttData(items));
  }, []);

  // ══════════════════════════════
  // RENDER
  // ══════════════════════════════

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" /> Edição por Trechos — Base Personalizada
          </CardTitle>
          <CardDescription>
            Importe sua base de custos, aloque nos trechos, meça e gere cronograma + Gantt.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="base-custo" className="flex items-center gap-1">
            <Package className="h-4 w-4" /> Base de Custo
          </TabsTrigger>
          <TabsTrigger value="alocacao" className="flex items-center gap-1">
            <MapPin className="h-4 w-4" /> Alocação
          </TabsTrigger>
          <TabsTrigger value="medicao" className="flex items-center gap-1">
            <ClipboardCheck className="h-4 w-4" /> Medição
          </TabsTrigger>
          <TabsTrigger value="cronograma-gantt" className="flex items-center gap-1">
            <GanttChart className="h-4 w-4" /> Cronograma / Gantt
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════
            TAB 1: BASE DE CUSTO
        ════════════════════════════════════════════ */}
        <TabsContent value="base-custo">
          <div className="space-y-4">
            {/* Import + Base selector */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.json,.txt"
                    className="hidden"
                    onChange={handleFileImport}
                  />
                  <Button onClick={() => fileRef.current?.click()} variant="outline" className="gap-1">
                    <Upload className="h-4 w-4" /> Importar Base
                  </Button>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileSpreadsheet className="h-3 w-3" /> XLSX
                    <FileText className="h-3 w-3 ml-1" /> CSV
                    <FileJson className="h-3 w-3 ml-1" /> JSON
                  </div>
                  <div className="flex-1" />
                  {costBases.length > 0 && (
                    <>
                      <Select value={activeCostBaseId} onValueChange={setActiveCostBaseId}>
                        <SelectTrigger className="w-52 h-8 text-sm">
                          <SelectValue placeholder="Selecione uma base" />
                        </SelectTrigger>
                        <SelectContent>
                          {costBases.map(b => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.nome} ({b.items.length} itens)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={handleExportBase} title="Exportar CSV">
                        <Download className="h-4 w-4" />
                      </Button>
                      {activeCostBaseId && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteBase(activeCostBaseId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Active base items */}
            {activeCostBase ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {activeCostBase.nome}
                      <Badge variant="outline" className="ml-2 text-xs">{activeCostBase.items.length} itens</Badge>
                    </CardTitle>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Buscar..."
                        value={searchBase}
                        onChange={e => setSearchBase(e.target.value)}
                        className="h-8 w-44 text-sm"
                      />
                      <Button size="sm" onClick={() => setAddItemOpen(true)} className="gap-1">
                        <Plus className="h-3 w-3" /> Novo Item
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[450px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-24">Código</TableHead>
                          <TableHead className="text-xs">Descrição</TableHead>
                          <TableHead className="text-xs w-16">Unid.</TableHead>
                          <TableHead className="text-xs w-28">Custo Unit.</TableHead>
                          <TableHead className="text-xs w-24">Produtiv.</TableHead>
                          <TableHead className="text-xs w-36">Composição</TableHead>
                          <TableHead className="text-xs w-16">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBaseItems.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Input
                                value={item.codigo}
                                onChange={e => handleUpdateItem(item.id, "codigo", e.target.value)}
                                className="h-7 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.descricao}
                                onChange={e => handleUpdateItem(item.id, "descricao", e.target.value)}
                                className="h-7 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.unidade}
                                onChange={e => handleUpdateItem(item.id, "unidade", e.target.value)}
                                className="h-7 text-xs w-14"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={item.custoUnitario}
                                onChange={e => handleUpdateItem(item.id, "custoUnitario", parseFloat(e.target.value) || 0)}
                                className="h-7 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={item.produtividade}
                                onChange={e => handleUpdateItem(item.id, "produtividade", parseFloat(e.target.value) || 0)}
                                className="h-7 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.composicao}
                                onChange={e => handleUpdateItem(item.id, "composicao", e.target.value)}
                                className="h-7 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" className="h-6 text-destructive" onClick={() => handleRemoveItem(item.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhuma base de custo importada</p>
                  <p className="text-sm">Importe uma planilha XLSX, CSV ou JSON com seus custos.</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Import Dialog */}
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Importar Base de Custo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Nome da Base</Label>
                    <Input value={importName} onChange={e => setImportName(e.target.value)} placeholder="Ex: Minha Base 2026" className="h-8" />
                  </div>
                  <div>
                    <Label className="text-sm">Descrição</Label>
                    <Input value={importDesc} onChange={e => setImportDesc(e.target.value)} placeholder="Descrição opcional" className="h-8" />
                  </div>
                </div>

                {importPreview && (
                  <>
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-1">
                        <Table2 className="h-4 w-4" /> Mapeamento de Colunas ({importPreview.totalRows} linhas detectadas)
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {(["codigo", "descricao", "unidade", "custoUnitario", "produtividade", "composicao"] as const).map(field => (
                          <div key={field} className="flex items-center gap-2">
                            <span className="text-xs w-24 text-right capitalize">{field === "custoUnitario" ? "Custo Unit." : field}:</span>
                            <Select
                              value={importMapping[field]}
                              onValueChange={v => setImportMapping({ ...importMapping, [field]: v })}
                            >
                              <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue placeholder="— Selecionar —" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— Nenhum —</SelectItem>
                                {importPreview.headers.map(h => (
                                  <SelectItem key={h} value={h}>{h}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Preview */}
                    <div>
                      <p className="text-xs font-medium mb-1">Preview (primeiras 5 linhas)</p>
                      <div className="max-h-40 overflow-auto border rounded">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {importPreview.headers.slice(0, 6).map(h => (
                                <TableHead key={h} className="text-[10px] px-2">{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importPreview.sampleRows.map((row, i) => (
                              <TableRow key={i}>
                                {importPreview!.headers.slice(0, 6).map(h => (
                                  <TableCell key={h} className="text-[10px] px-2">{String(row[h] ?? "")}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
                <Button onClick={confirmImport}>Importar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Item Dialog */}
          <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Código</Label>
                    <Input value={newItem.codigo} onChange={e => setNewItem({ ...newItem, codigo: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Unidade</Label>
                    <Input value={newItem.unidade} onChange={e => setNewItem({ ...newItem, unidade: e.target.value })} className="h-8 text-sm" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Input value={newItem.descricao} onChange={e => setNewItem({ ...newItem, descricao: e.target.value })} className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Custo Unitário (R$)</Label>
                    <Input type="number" value={newItem.custoUnitario} onChange={e => setNewItem({ ...newItem, custoUnitario: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Produtividade</Label>
                    <Input type="number" value={newItem.produtividade} onChange={e => setNewItem({ ...newItem, produtividade: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Composição</Label>
                  <Input value={newItem.composicao} onChange={e => setNewItem({ ...newItem, composicao: e.target.value })} className="h-8 text-sm" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddItem}>Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ════════════════════════════════════════════
            TAB 2: ALOCAÇÃO DE CUSTOS POR TRECHO
        ════════════════════════════════════════════ */}
        <TabsContent value="alocacao">
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-2xl font-bold">{allocSummary.totalTrechos}</p>
                  <p className="text-xs text-muted-foreground">Trechos c/ custos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-2xl font-bold">{allocSummary.totalItems}</p>
                  <p className="text-xs text-muted-foreground">Itens alocados</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-2xl font-bold text-orange-600">{fmtC(allocSummary.custoTotal)}</p>
                  <p className="text-xs text-muted-foreground">Custo Total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{fmtC(allocSummary.custoComBDI)}</p>
                  <p className="text-xs text-muted-foreground">Total c/ BDI</p>
                </CardContent>
              </Card>
            </div>

            {/* Trecho selector + allocation */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Alocar Custos ao Trecho</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs">Trecho</Label>
                    <Select value={selectedTrechoKey} onValueChange={setSelectedTrechoKey}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Selecione um trecho" />
                      </SelectTrigger>
                      <SelectContent>
                        {trechoOptions.map(t => (
                          <SelectItem key={t.key} value={t.key}>
                            {t.nome} ({fmt(t.comprimento)} m)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28">
                    <Label className="text-xs">Qtd. manual</Label>
                    <Input
                      type="number"
                      value={allocQty}
                      onChange={e => setAllocQty(parseFloat(e.target.value) || 0)}
                      placeholder="Auto"
                      className="h-8 text-sm"
                    />
                  </div>
                  {selectedTrechoKey && activeCostBase && (
                    <div className="w-44">
                      <Label className="text-xs">BDI (%)</Label>
                      <Input
                        type="number"
                        value={selectedAllocation?.bdiPct ?? 25}
                        onChange={e => handleUpdateBDI(selectedTrechoKey, parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Available items from active base */}
                {selectedTrechoKey && activeCostBase && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Input
                        placeholder="Buscar item para alocar..."
                        value={allocItemSearch}
                        onChange={e => setAllocItemSearch(e.target.value)}
                        className="h-7 text-xs w-56"
                      />
                      <Badge variant="outline" className="text-xs">
                        Base: {activeCostBase.nome}
                      </Badge>
                    </div>
                    <div className="max-h-[200px] overflow-auto border rounded">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Código</TableHead>
                            <TableHead className="text-[10px]">Descrição</TableHead>
                            <TableHead className="text-[10px]">Unid.</TableHead>
                            <TableHead className="text-[10px]">Custo Unit.</TableHead>
                            <TableHead className="text-[10px] w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeCostBase.items
                            .filter(i => !allocItemSearch || i.descricao.toLowerCase().includes(allocItemSearch.toLowerCase()) || i.codigo.toLowerCase().includes(allocItemSearch.toLowerCase()))
                            .slice(0, 20)
                            .map(item => (
                              <TableRow key={item.id}>
                                <TableCell className="text-[10px]">{item.codigo}</TableCell>
                                <TableCell className="text-[10px]">{item.descricao}</TableCell>
                                <TableCell className="text-[10px]">{item.unidade}</TableCell>
                                <TableCell className="text-[10px]">{fmtC(item.custoUnitario)}</TableCell>
                                <TableCell>
                                  <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => handleAllocateItem(item)}>
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Allocated items for selected trecho */}
            {selectedAllocation && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Custos do Trecho: {selectedAllocation.nomeTrecho}
                    </CardTitle>
                    <div className="flex gap-2 text-sm">
                      <Badge variant="secondary">Subtotal: {fmtC(selectedAllocation.custoTotalTrecho)}</Badge>
                      <Badge>c/ BDI: {fmtC(selectedAllocation.custoComBDI)}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[300px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Código</TableHead>
                          <TableHead className="text-xs">Descrição</TableHead>
                          <TableHead className="text-xs">Unid.</TableHead>
                          <TableHead className="text-xs">Custo Unit.</TableHead>
                          <TableHead className="text-xs">Qtd.</TableHead>
                          <TableHead className="text-xs">Total</TableHead>
                          <TableHead className="text-xs w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedAllocation.items.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs">{item.codigo}</TableCell>
                            <TableCell className="text-xs">{item.descricao}</TableCell>
                            <TableCell className="text-xs">{item.unidade}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={item.custoUnitario}
                                onChange={e => handleUpdateAllocItem(selectedTrechoKey, item.id, "custoUnitario", parseFloat(e.target.value) || 0)}
                                className="h-6 text-xs w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={item.quantidade}
                                onChange={e => handleUpdateAllocItem(selectedTrechoKey, item.id, "quantidade", parseFloat(e.target.value) || 0)}
                                className="h-6 text-xs w-20"
                              />
                            </TableCell>
                            <TableCell className="text-xs font-medium">{fmtC(item.custoTotal)}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" className="h-5 text-destructive" onClick={() => handleRemoveAllocItem(selectedTrechoKey, item.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All allocations overview */}
            {allocations.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Visão Geral — Todos os Trechos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[250px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Trecho</TableHead>
                          <TableHead className="text-xs">Comp. (m)</TableHead>
                          <TableHead className="text-xs">Itens</TableHead>
                          <TableHead className="text-xs">Custo</TableHead>
                          <TableHead className="text-xs">BDI</TableHead>
                          <TableHead className="text-xs">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allocations.map(a => (
                          <TableRow
                            key={a.trechoKey}
                            className={a.trechoKey === selectedTrechoKey ? "bg-primary/10 cursor-pointer" : "cursor-pointer"}
                            onClick={() => setSelectedTrechoKey(a.trechoKey)}
                          >
                            <TableCell className="text-xs font-mono">{a.nomeTrecho}</TableCell>
                            <TableCell className="text-xs">{fmt(a.comprimento)}</TableCell>
                            <TableCell className="text-xs">{a.items.length}</TableCell>
                            <TableCell className="text-xs">{fmtC(a.custoTotalTrecho)}</TableCell>
                            <TableCell className="text-xs">{a.bdiPct}%</TableCell>
                            <TableCell className="text-xs font-bold">{fmtC(a.custoComBDI)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════
            TAB 3: MEDIÇÃO POR TRECHO
        ════════════════════════════════════════════ */}
        <TabsContent value="medicao">
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-2xl font-bold">{measSummary.totalTrechos}</p>
                  <p className="text-xs text-muted-foreground">Trechos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{measSummary.trechosConcluidos}</p>
                  <p className="text-xs text-muted-foreground">Concluídos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{fmt(measSummary.progressoGeral)}%</p>
                  <p className="text-xs text-muted-foreground">Progresso Geral</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-2xl font-bold text-orange-600">{fmtC(measSummary.custoExecutadoTotal)}</p>
                  <p className="text-xs text-muted-foreground">Custo Executado</p>
                </CardContent>
              </Card>
            </div>

            {/* Init + add measurement */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Medição por Trecho</CardTitle>
                  <Button size="sm" onClick={handleInitMeasurements} variant="outline" className="gap-1">
                    <Settings2 className="h-3 w-3" /> Inicializar Trechos
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs">Trecho</Label>
                    <Select value={measTrechoKey} onValueChange={setMeasTrechoKey}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Selecione um trecho" />
                      </SelectTrigger>
                      <SelectContent>
                        {trechoOptions.map(t => {
                          const m = measurements.find(mm => mm.trechoKey === t.key);
                          return (
                            <SelectItem key={t.key} value={t.key}>
                              {t.nome} ({fmt(t.comprimento)} m) {m ? `— ${fmt(m.progressoPct)}%` : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28">
                    <Label className="text-xs">Metros medidos</Label>
                    <Input
                      type="number"
                      value={measValue}
                      onChange={e => setMeasValue(parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="w-44">
                    <Label className="text-xs">Observação</Label>
                    <Input
                      value={measObs}
                      onChange={e => setMeasObs(e.target.value)}
                      placeholder="Obs."
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button size="sm" onClick={handleAddMeasEntry} className="gap-1">
                    <Check className="h-3 w-3" /> Registrar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Selected trecho measurement detail */}
            {selectedMeasurement && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{selectedMeasurement.nomeTrecho}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant={selectedMeasurement.status === "concluido" ? "default" : selectedMeasurement.status === "em_andamento" ? "secondary" : "outline"}>
                        {selectedMeasurement.status === "concluido" ? "Concluído" : selectedMeasurement.status === "em_andamento" ? "Em Andamento" : "Não Iniciado"}
                      </Badge>
                      {selectedMeasurement.status !== "concluido" && (
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => handleMeasureComplete(measTrechoKey)}>
                          Medir 100%
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Executado: {fmt(selectedMeasurement.comprimentoExecutado)} m / {fmt(selectedMeasurement.comprimentoTotal)} m</span>
                        <span className="font-bold">{fmt(selectedMeasurement.progressoPct)}%</span>
                      </div>
                      <Progress value={selectedMeasurement.progressoPct} className="h-3" />
                    </div>
                    <div className="text-right text-xs">
                      <p>Orçado: {fmtC(selectedMeasurement.custoOrcado)}</p>
                      <p className="font-bold">Executado: {fmtC(selectedMeasurement.custoExecutado)}</p>
                    </div>
                  </div>

                  {/* Measurement entries */}
                  {selectedMeasurement.medicoes.length > 0 && (
                    <div className="max-h-[200px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Data</TableHead>
                            <TableHead className="text-xs">Metros</TableHead>
                            <TableHead className="text-xs">Observação</TableHead>
                            <TableHead className="text-xs">Responsável</TableHead>
                            <TableHead className="text-xs w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedMeasurement.medicoes.map(entry => (
                            <TableRow key={entry.id}>
                              <TableCell className="text-xs">{entry.data}</TableCell>
                              <TableCell className="text-xs">{fmt(entry.comprimentoMedido)} m</TableCell>
                              <TableCell className="text-xs">{entry.observacao}</TableCell>
                              <TableCell className="text-xs">{entry.responsavel}</TableCell>
                              <TableCell>
                                <Button size="sm" variant="ghost" className="h-5 text-destructive" onClick={() => {
                                  removeMeasurementEntry(measTrechoKey, entry.id);
                                  setMeasurements(loadMeasurements());
                                }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* All measurements overview */}
            {measurements.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Visão Geral — Medições</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[300px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Trecho</TableHead>
                          <TableHead className="text-xs">Total (m)</TableHead>
                          <TableHead className="text-xs">Executado (m)</TableHead>
                          <TableHead className="text-xs">Progresso</TableHead>
                          <TableHead className="text-xs">Custo Exec.</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {measurements.map(m => (
                          <TableRow
                            key={m.trechoKey}
                            className={m.trechoKey === measTrechoKey ? "bg-primary/10 cursor-pointer" : "cursor-pointer"}
                            onClick={() => setMeasTrechoKey(m.trechoKey)}
                          >
                            <TableCell className="text-xs font-mono">{m.nomeTrecho}</TableCell>
                            <TableCell className="text-xs">{fmt(m.comprimentoTotal)}</TableCell>
                            <TableCell className="text-xs">{fmt(m.comprimentoExecutado)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={m.progressoPct} className="h-2 w-20" />
                                <span className="text-xs">{fmt(m.progressoPct)}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{fmtC(m.custoExecutado)}</TableCell>
                            <TableCell>
                              <Badge variant={m.status === "concluido" ? "default" : m.status === "em_andamento" ? "secondary" : "outline"} className="text-[10px]">
                                {m.status === "concluido" ? "OK" : m.status === "em_andamento" ? "Exec." : "Pend."}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════
            TAB 4: CRONOGRAMA + GANTT
        ════════════════════════════════════════════ */}
        <TabsContent value="cronograma-gantt">
          <div className="space-y-4">
            {/* Config */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Configuração do Cronograma</CardTitle>
                  <Button size="sm" onClick={handleGenerateSchedule} className="gap-1">
                    <Calendar className="h-3 w-3" /> Gerar Cronograma
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 flex-wrap items-end">
                  <div>
                    <Label className="text-xs">Data Início</Label>
                    <Input
                      type="date"
                      value={schedConfig.dataInicioGlobal}
                      onChange={e => handleUpdateScheduleConfig("dataInicioGlobal", e.target.value)}
                      className="h-8 text-sm w-36"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Produtividade (m/dia)</Label>
                    <Input
                      type="number"
                      value={schedConfig.produtividadeGlobal}
                      onChange={e => handleUpdateScheduleConfig("produtividadeGlobal", parseFloat(e.target.value) || 1)}
                      className="h-8 text-sm w-28"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Equipes</Label>
                    <Input
                      type="number"
                      value={schedConfig.numEquipesGlobal}
                      onChange={e => handleUpdateScheduleConfig("numEquipesGlobal", parseInt(e.target.value) || 1)}
                      className="h-8 text-sm w-20"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Dias/semana</Label>
                    <Select
                      value={String(schedConfig.diasUteisPorSemana)}
                      onValueChange={v => handleUpdateScheduleConfig("diasUteisPorSemana", parseInt(v))}
                    >
                      <SelectTrigger className="h-8 text-sm w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="6">6</SelectItem>
                        <SelectItem value="7">7</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            {scheduleItems.length > 0 && (
              <>
                <div className="grid grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-3 pb-3 text-center">
                      <p className="text-2xl font-bold">{schedSummary.totalTrechos}</p>
                      <p className="text-xs text-muted-foreground">Trechos</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-3 text-center">
                      <p className="text-2xl font-bold">{schedSummary.duracaoTotal} dias</p>
                      <p className="text-xs text-muted-foreground">Duração Total</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-3 text-center">
                      <p className="text-xs text-muted-foreground">Início</p>
                      <p className="text-lg font-bold">{schedSummary.dataInicioProjeto}</p>
                      <ArrowRight className="h-3 w-3 inline" />
                      <p className="text-xs text-muted-foreground">Fim</p>
                      <p className="text-lg font-bold">{schedSummary.dataFimProjeto}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-3 pb-3 text-center">
                      <p className="text-2xl font-bold">{fmt(schedSummary.progressoMedio)}%</p>
                      <p className="text-xs text-muted-foreground">Progresso Médio</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Editable schedule table */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cronograma por Trecho</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[300px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Trecho</TableHead>
                            <TableHead className="text-xs">Comp. (m)</TableHead>
                            <TableHead className="text-xs">Produt. (m/dia)</TableHead>
                            <TableHead className="text-xs">Equipes</TableHead>
                            <TableHead className="text-xs">Duração (dias)</TableHead>
                            <TableHead className="text-xs">Data Início</TableHead>
                            <TableHead className="text-xs">Data Fim</TableHead>
                            <TableHead className="text-xs">Progresso</TableHead>
                            <TableHead className="text-xs">Custo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scheduleItems.map(item => (
                            <TableRow key={item.trechoKey}>
                              <TableCell className="text-xs font-mono">{item.nomeTrecho}</TableCell>
                              <TableCell className="text-xs">{fmt(item.comprimento)}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={item.produtividade}
                                  onChange={e => handleUpdateScheduleItem(item.trechoKey, "produtividade", parseFloat(e.target.value) || 1)}
                                  className="h-6 text-xs w-16"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={item.numEquipes}
                                  onChange={e => handleUpdateScheduleItem(item.trechoKey, "numEquipes", parseInt(e.target.value) || 1)}
                                  className="h-6 text-xs w-14"
                                />
                              </TableCell>
                              <TableCell className="text-xs font-medium">{item.duracao}</TableCell>
                              <TableCell>
                                <Input
                                  type="date"
                                  value={item.dataInicio}
                                  onChange={e => handleUpdateScheduleItem(item.trechoKey, "dataInicio", e.target.value)}
                                  className="h-6 text-xs w-32"
                                />
                              </TableCell>
                              <TableCell className="text-xs">{item.dataFim}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Progress value={item.progressoPct} className="h-2 w-12" />
                                  <span className="text-[10px]">{fmt(item.progressoPct)}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">{fmtC(item.custoTotal)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* GANTT CHART */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <GanttChart className="h-5 w-5" /> Gráfico de Gantt
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <GanttChartView items={ganttData} scheduleItems={scheduleItems} />
                  </CardContent>
                </Card>

                {/* Cost bar chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Custo por Trecho
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={scheduleItems.map(i => ({ trecho: i.nomeTrecho, custo: i.custoTotal, progresso: i.progressoPct }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="trecho" fontSize={9} angle={-45} textAnchor="end" height={60} />
                        <YAxis fontSize={10} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                        <RechartsTooltip formatter={(v: number) => fmtC(v)} />
                        <Legend />
                        <Bar dataKey="custo" fill="#ea580c" name="Custo (R$)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════
// GANTT CHART COMPONENT
// ══════════════════════════════════

interface GanttChartViewProps {
  items: GanttItem[];
  scheduleItems: TrechoScheduleItem[];
}

function GanttChartView({ items, scheduleItems }: GanttChartViewProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dado de cronograma disponível.</p>;
  }

  const maxDays = Math.max(...items.map(i => i.startDay + i.widthDays), 30);
  const dayWidth = Math.max(18, Math.min(40, 800 / maxDays));
  const rowHeight = 36;
  const labelWidth = 160;
  const headerHeight = 30;
  const totalWidth = labelWidth + maxDays * dayWidth + 20;
  const totalHeight = headerHeight + items.length * rowHeight + 10;

  // Generate day labels (every 5 days or every day depending on scale)
  const dayStep = maxDays > 60 ? 10 : maxDays > 30 ? 5 : maxDays > 15 ? 3 : 1;
  const projectStart = items.length > 0
    ? new Date(scheduleItems.reduce((min, i) => i.dataInicio < min ? i.dataInicio : min, scheduleItems[0].dataInicio) + "T12:00:00")
    : new Date();

  return (
    <div className="overflow-auto border rounded" style={{ maxHeight: 500 }}>
      <svg width={totalWidth} height={totalHeight} className="text-xs">
        {/* Header — Day labels */}
        <g>
          {Array.from({ length: Math.ceil(maxDays / dayStep) + 1 }, (_, i) => {
            const day = i * dayStep;
            const x = labelWidth + day * dayWidth;
            const date = new Date(projectStart);
            date.setDate(date.getDate() + day);
            const label = `${date.getDate()}/${date.getMonth() + 1}`;
            return (
              <g key={day}>
                <line x1={x} y1={headerHeight} x2={x} y2={totalHeight} stroke="#e5e7eb" strokeWidth={0.5} />
                <text x={x + 2} y={headerHeight - 8} fontSize={9} fill="#6b7280">{label}</text>
              </g>
            );
          })}
        </g>

        {/* Rows */}
        {items.map((item, idx) => {
          const y = headerHeight + idx * rowHeight;
          const barX = labelWidth + item.startDay * dayWidth;
          const barW = Math.max(dayWidth, item.widthDays * dayWidth);
          const progressW = barW * (item.progresso / 100);

          return (
            <g key={item.id}>
              {/* Row background */}
              {idx % 2 === 0 && (
                <rect x={0} y={y} width={totalWidth} height={rowHeight} fill="#f9fafb" />
              )}

              {/* Label */}
              <text x={8} y={y + rowHeight / 2 + 4} fontSize={10} fill="#374151" className="font-mono">
                {item.trecho.length > 18 ? item.trecho.slice(0, 18) + "…" : item.trecho}
              </text>

              {/* Bar background */}
              <rect
                x={barX}
                y={y + 6}
                width={barW}
                height={rowHeight - 12}
                rx={3}
                fill={item.cor}
                opacity={0.3}
              />

              {/* Progress fill */}
              {progressW > 0 && (
                <rect
                  x={barX}
                  y={y + 6}
                  width={Math.min(progressW, barW)}
                  height={rowHeight - 12}
                  rx={3}
                  fill={item.cor}
                  opacity={0.8}
                />
              )}

              {/* Duration label */}
              <text
                x={barX + barW / 2}
                y={y + rowHeight / 2 + 3}
                fontSize={9}
                fill="white"
                textAnchor="middle"
                fontWeight="bold"
              >
                {item.duracao}d | {fmt(item.progresso, 0)}%
              </text>
            </g>
          );
        })}

        {/* Today line */}
        {(() => {
          const today = new Date();
          const todayOffset = Math.round((today.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
          if (todayOffset >= 0 && todayOffset <= maxDays) {
            const x = labelWidth + todayOffset * dayWidth;
            return (
              <g>
                <line x1={x} y1={headerHeight} x2={x} y2={totalHeight} stroke="#dc2626" strokeWidth={2} strokeDasharray="4 2" />
                <text x={x + 3} y={headerHeight + 12} fontSize={8} fill="#dc2626" fontWeight="bold">Hoje</text>
              </g>
            );
          }
          return null;
        })()}
      </svg>
    </div>
  );
}
