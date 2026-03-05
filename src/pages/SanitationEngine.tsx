import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, Download, Calculator, MapPin, Droplets, ArrowDown, ArrowUp, FileSpreadsheet, Settings2, Users } from "lucide-react";
import { PullDataPanel } from "@/components/shared/PullDataPanel";
import {
  parseTopographyFile,
  validateTopographySequence,
  PontoTopografico,
} from "@/engine/reader";
import {
  createTrechosFromTopography,
  summarizeNetwork,
  Trecho,
  NetworkSummary,
  DEFAULT_DIAMETRO_MM,
  DEFAULT_MATERIAL,
} from "@/engine/domain";
import {
  parseCostBaseFile,
  applyBudget,
  createBudgetSummary,
  exportBudgetExcel,
  BudgetRow,
  BudgetSummary,
  CostBase,
} from "@/engine/budget";
import {
  criarParametrosExecucao,
  ParametrosExecucao,
  TipoSolo,
  TipoEscavacao,
  TipoPavimento,
  TipoMaterial,
} from "@/engine/construction";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const SanitationEngine = () => {
  const [pontos, setPontos] = useState<PontoTopografico[]>([]);
  const [trechos, setTrechos] = useState<Trecho[]>([]);
  const [networkSummary, setNetworkSummary] = useState<NetworkSummary | null>(null);
  const [costBase, setCostBase] = useState<CostBase | null>(null);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [diametroMm, setDiametroMm] = useState(DEFAULT_DIAMETRO_MM);
  const [material, setMaterial] = useState(DEFAULT_MATERIAL);
  const [execParams, setExecParams] = useState<ParametrosExecucao | null>(null);

  // Construction params state
  const [tipoSolo, setTipoSolo] = useState<TipoSolo>("normal");
  const [tipoEscavacao, setTipoEscavacao] = useState<TipoEscavacao>("mecanizada");
  const [tipoPavimento, setTipoPavimento] = useState<TipoPavimento>("asfalto");
  const [tipoMaterial, setTipoMaterial] = useState<TipoMaterial>("PVC");
  const [profundidade, setProfundidade] = useState(1.5);

  const handleTopographyUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const pts = await parseTopographyFile(file);
      validateTopographySequence(pts);
      setPontos(pts);

      const segs = createTrechosFromTopography(pts, diametroMm, material);
      setTrechos(segs);

      const summary = summarizeNetwork(segs);
      setNetworkSummary(summary);

      // Reset budget when new topography is loaded
      setBudgetRows([]);
      setBudgetSummary(null);

      toast.success(`${pts.length} pontos carregados, ${segs.length} trechos criados.`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar arquivo de topografia.");
    }
  }, [diametroMm, material]);

  const handleCostBaseUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const cb = await parseCostBaseFile(file);
      setCostBase(cb);
      toast.success(`Base de custos carregada (${cb.size} entradas).`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar base de custos.");
    }
  }, []);

  const handleCalculateBudget = useCallback(() => {
    if (trechos.length === 0) {
      toast.error("Carregue a topografia primeiro.");
      return;
    }
    if (!costBase) {
      toast.error("Carregue a base de custos primeiro.");
      return;
    }

    try {
      const rows = applyBudget(trechos, costBase, false);
      setBudgetRows(rows);
      const summary = createBudgetSummary(rows);
      setBudgetSummary(summary);
      toast.success("Orçamento calculado com sucesso!");
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [trechos, costBase]);

  const handleExportExcel = useCallback(() => {
    if (budgetRows.length === 0) {
      toast.error("Calcule o orçamento primeiro.");
      return;
    }
    exportBudgetExcel(budgetRows);
    toast.success("Arquivo Excel exportado!");
  }, [budgetRows]);

  const handleCalcConstruction = useCallback(() => {
    const params = criarParametrosExecucao(tipoSolo, tipoEscavacao, tipoPavimento, tipoMaterial, profundidade);
    setExecParams(params);
    toast.success("Parâmetros de execução calculados!");
  }, [tipoSolo, tipoEscavacao, tipoPavimento, tipoMaterial, profundidade]);

  const formatNumber = (n: number, decimals = 2) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const formatCurrency = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold font-mono flex items-center gap-2">
                <Droplets className="h-8 w-8 text-blue-600" />
                Engine Rede - Saneamento
              </h1>
              <p className="text-muted-foreground mt-1">
                Pré-dimensionamento e orçamento de redes de saneamento
              </p>
            </div>

            <PullDataPanel currentModule="saneamento" />

            <Tabs defaultValue="topography" className="space-y-4">
              <TabsList className="grid grid-cols-4 w-full max-w-2xl">
                <TabsTrigger value="topography">
                  <MapPin className="h-4 w-4 mr-1" /> Topografia
                </TabsTrigger>
                <TabsTrigger value="budget">
                  <Calculator className="h-4 w-4 mr-1" /> Orçamento
                </TabsTrigger>
                <TabsTrigger value="construction">
                  <Settings2 className="h-4 w-4 mr-1" /> Execução
                </TabsTrigger>
                <TabsTrigger value="results">
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Resultados
                </TabsTrigger>
              </TabsList>

              {/* TOPOGRAPHY TAB */}
              <TabsContent value="topography" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" /> Carregar Topografia
                      </CardTitle>
                      <CardDescription>
                        Arquivo CSV ou Excel com colunas: id, x, y, cota
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Input
                        type="file"
                        accept=".csv,.txt,.xlsx,.xls"
                        onChange={handleTopographyUpload}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Diâmetro (mm)</Label>
                          <Select value={String(diametroMm)} onValueChange={(v) => setDiametroMm(Number(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="100">100 mm</SelectItem>
                              <SelectItem value="150">150 mm</SelectItem>
                              <SelectItem value="200">200 mm</SelectItem>
                              <SelectItem value="250">250 mm</SelectItem>
                              <SelectItem value="300">300 mm</SelectItem>
                              <SelectItem value="400">400 mm</SelectItem>
                              <SelectItem value="500">500 mm</SelectItem>
                              <SelectItem value="600">600 mm</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Material</Label>
                          <Select value={material} onValueChange={setMaterial}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PVC">PVC</SelectItem>
                              <SelectItem value="PEAD">PEAD</SelectItem>
                              <SelectItem value="Concreto">Concreto</SelectItem>
                              <SelectItem value="Ferro Fundido">Ferro Fundido</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {networkSummary && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Resumo da Rede</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-muted/50 rounded-none p-3 text-center">
                            <div className="text-2xl font-bold">{networkSummary.totalTrechos}</div>
                            <div className="text-xs text-muted-foreground">Trechos</div>
                          </div>
                          <div className="bg-muted/50 rounded-none p-3 text-center">
                            <div className="text-2xl font-bold">{formatNumber(networkSummary.comprimentoTotal, 1)}</div>
                            <div className="text-xs text-muted-foreground">Comprimento (m)</div>
                          </div>
                          <div className="bg-muted/50 rounded-none p-3 text-center">
                            <div className="text-2xl font-bold text-green-600">{networkSummary.trechosGravidade}</div>
                            <div className="text-xs text-muted-foreground">Gravidade</div>
                          </div>
                          <div className="bg-muted/50 rounded-none p-3 text-center">
                            <div className="text-2xl font-bold text-orange-600">{networkSummary.trechosElevatoria}</div>
                            <div className="text-xs text-muted-foreground">Elevatória</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Points Table */}
                {pontos.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Pontos Topográficos ({pontos.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[300px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>X</TableHead>
                              <TableHead>Y</TableHead>
                              <TableHead>Cota (m)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pontos.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.id}</TableCell>
                                <TableCell>{formatNumber(p.x, 3)}</TableCell>
                                <TableCell>{formatNumber(p.y, 3)}</TableCell>
                                <TableCell>{formatNumber(p.cota, 3)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Segments Table */}
                {trechos.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Trechos da Rede ({trechos.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[400px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Início</TableHead>
                              <TableHead>Fim</TableHead>
                              <TableHead>Comprimento (m)</TableHead>
                              <TableHead>Declividade</TableHead>
                              <TableHead>Tipo de Rede</TableHead>
                              <TableHead>Ø (mm)</TableHead>
                              <TableHead>Material</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {trechos.map((t, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{t.idInicio}</TableCell>
                                <TableCell>{t.idFim}</TableCell>
                                <TableCell>{formatNumber(t.comprimento, 2)}</TableCell>
                                <TableCell>
                                  <span className="flex items-center gap-1">
                                    {t.declividade >= 0 ? (
                                      <ArrowDown className="h-3 w-3 text-green-600" />
                                    ) : (
                                      <ArrowUp className="h-3 w-3 text-orange-600" />
                                    )}
                                    {(t.declividade * 100).toFixed(2)}%
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={t.tipoRede === "Esgoto por Gravidade" ? "default" : "destructive"}>
                                    {t.tipoRede === "Esgoto por Gravidade" ? "Gravidade" : "Elevatória"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{t.diametroMm}</TableCell>
                                <TableCell>{t.material}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* BUDGET TAB */}
              <TabsContent value="budget" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" /> Base de Custos
                      </CardTitle>
                      <CardDescription>
                        CSV ou Excel com colunas: tipo_rede, diametro_mm, custo_unitario
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Input
                        type="file"
                        accept=".csv,.txt,.xlsx,.xls"
                        onChange={handleCostBaseUpload}
                      />
                      {costBase && (
                        <Badge variant="outline" className="text-green-600">
                          ✓ {costBase.size} entradas carregadas
                        </Badge>
                      )}
                      <Button
                        onClick={handleCalculateBudget}
                        disabled={trechos.length === 0 || !costBase}
                        className="w-full"
                      >
                        <Calculator className="h-4 w-4 mr-2" />
                        Calcular Orçamento
                      </Button>
                    </CardContent>
                  </Card>

                  {budgetSummary && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Resumo do Orçamento</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="bg-primary/10 rounded-none p-4 text-center">
                            <div className="text-3xl font-bold text-primary">
                              {formatCurrency(budgetSummary.totalCost)}
                            </div>
                            <div className="text-sm text-muted-foreground">Custo Total</div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-muted/50 rounded-none p-3 text-center">
                              <div className="text-lg font-semibold">{budgetSummary.totalSegments}</div>
                              <div className="text-xs text-muted-foreground">Trechos</div>
                            </div>
                            <div className="bg-muted/50 rounded-none p-3 text-center">
                              <div className="text-lg font-semibold">{formatNumber(budgetSummary.totalLengthM, 1)} m</div>
                              <div className="text-xs text-muted-foreground">Extensão</div>
                            </div>
                          </div>
                          <div className="bg-muted/50 rounded-none p-3 text-center">
                            <div className="text-lg font-semibold">
                              {formatCurrency(budgetSummary.averageCostPerMeter)}/m
                            </div>
                            <div className="text-xs text-muted-foreground">Custo Médio</div>
                          </div>
                          {Object.entries(budgetSummary.costByNetworkType).map(([tipo, custo]) => (
                            <div key={tipo} className="flex justify-between items-center text-sm">
                              <span>{tipo}</span>
                              <span className="font-semibold">{formatCurrency(custo)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {budgetRows.length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Detalhamento do Orçamento</CardTitle>
                      <Button variant="outline" size="sm" onClick={handleExportExcel}>
                        <Download className="h-4 w-4 mr-2" /> Exportar Excel
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[400px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Início</TableHead>
                              <TableHead>Fim</TableHead>
                              <TableHead>Comp. (m)</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Ø (mm)</TableHead>
                              <TableHead>Custo Unit.</TableHead>
                              <TableHead>Custo Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {budgetRows.map((r, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{r.id_inicio}</TableCell>
                                <TableCell>{r.id_fim}</TableCell>
                                <TableCell>{formatNumber(r.comprimento, 2)}</TableCell>
                                <TableCell>
                                  <Badge variant={r.tipo_rede === "Esgoto por Gravidade" ? "default" : "destructive"} className="text-xs">
                                    {r.tipo_rede === "Esgoto por Gravidade" ? "Grav." : "Elev."}
                                  </Badge>
                                </TableCell>
                                <TableCell>{r.diametro_mm}</TableCell>
                                <TableCell>{r.custo_unitario !== null ? formatCurrency(r.custo_unitario) : "—"}</TableCell>
                                <TableCell className="font-semibold">
                                  {r.custo_total !== null ? formatCurrency(r.custo_total) : "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* CONSTRUCTION TAB */}
              <TabsContent value="construction" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings2 className="h-5 w-5" /> Parâmetros de Execução
                      </CardTitle>
                      <CardDescription>
                        Configure solo, escavação, pavimento e material para calcular requisitos
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Tipo de Solo</Label>
                          <Select value={tipoSolo} onValueChange={(v) => setTipoSolo(v as TipoSolo)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="saturado">Saturado</SelectItem>
                              <SelectItem value="rochoso">Rochoso</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Escavação</Label>
                          <Select value={tipoEscavacao} onValueChange={(v) => setTipoEscavacao(v as TipoEscavacao)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">Manual</SelectItem>
                              <SelectItem value="mecanizada">Mecanizada</SelectItem>
                              <SelectItem value="mista">Mista</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Pavimento</Label>
                          <Select value={tipoPavimento} onValueChange={(v) => setTipoPavimento(v as TipoPavimento)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="terra">Terra</SelectItem>
                              <SelectItem value="paralelepipedo">Paralelepípedo</SelectItem>
                              <SelectItem value="asfalto">Asfalto</SelectItem>
                              <SelectItem value="concreto">Concreto</SelectItem>
                              <SelectItem value="bloquete">Bloquete</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Material Tubo</Label>
                          <Select value={tipoMaterial} onValueChange={(v) => setTipoMaterial(v as TipoMaterial)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PVC">PVC</SelectItem>
                              <SelectItem value="PEAD">PEAD</SelectItem>
                              <SelectItem value="Concreto">Concreto</SelectItem>
                              <SelectItem value="Ferro Fundido">Ferro Fundido</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label>Profundidade (m)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="10"
                          value={profundidade}
                          onChange={(e) => setProfundidade(parseFloat(e.target.value) || 1.5)}
                        />
                      </div>
                      <Button onClick={handleCalcConstruction} className="w-full">
                        <Calculator className="h-4 w-4 mr-2" /> Calcular Parâmetros
                      </Button>
                    </CardContent>
                  </Card>

                  {execParams && (
                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Escoramento</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Badge variant={execParams.escoramento.necessario ? "destructive" : "outline"}>
                            {execParams.escoramento.necessario
                              ? `Necessário - ${execParams.escoramento.tipo}`
                              : "Não necessário (prof. ≤ 1,25m)"}
                          </Badge>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Embasamento</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {execParams.embasamento.necessario ? (
                            <div className="space-y-1">
                              {execParams.embasamento.lastroAreia && <Badge variant="secondary">Lastro de areia</Badge>}
                              {execParams.embasamento.lastroBrita && <Badge variant="secondary" className="ml-1">Lastro de brita</Badge>}
                              {execParams.embasamento.dreno && <Badge variant="secondary" className="ml-1">Dreno sub-superficial</Badge>}
                            </div>
                          ) : (
                            <Badge variant="outline">Padrão (solo normal)</Badge>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Assentamento</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                          {execParams.assentamento.termofusao && <Badge variant="secondary">Termofusão</Badge>}
                          {execParams.assentamento.equipamentoPesado && <Badge variant="secondary" className="ml-1">Equipamento de içamento</Badge>}
                          {execParams.assentamento.juntaEspecial && <Badge variant="secondary" className="ml-1">Junta especial</Badge>}
                          {!execParams.assentamento.termofusao && !execParams.assentamento.equipamentoPesado && !execParams.assentamento.juntaEspecial && (
                            <Badge variant="outline">Assentamento padrão</Badge>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" /> Composição da Equipe
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-primary/10 rounded-none p-3">
                              <div className="text-2xl font-bold">{execParams.equipe.totalEquipe}</div>
                              <div className="text-xs text-muted-foreground">Total</div>
                            </div>
                            <div className="bg-muted/50 rounded-none p-3">
                              <div className="text-xl font-semibold">{execParams.equipe.totalProfissionais}</div>
                              <div className="text-xs text-muted-foreground">Profissionais</div>
                            </div>
                            <div className="bg-muted/50 rounded-none p-3">
                              <div className="text-xl font-semibold">{execParams.equipe.totalAjudantes}</div>
                              <div className="text-xs text-muted-foreground">Ajudantes</div>
                            </div>
                          </div>
                          <div className="mt-3 text-sm space-y-1">
                            {execParams.equipe.encarregado > 0 && <div>• Encarregado: {execParams.equipe.encarregado}</div>}
                            {execParams.equipe.pedreiro > 0 && <div>• Pedreiro: {execParams.equipe.pedreiro}</div>}
                            {execParams.equipe.servente > 0 && <div>• Servente: {execParams.equipe.servente}</div>}
                            {execParams.equipe.operadorMaquina > 0 && <div>• Operador de máquina: {execParams.equipe.operadorMaquina}</div>}
                            {execParams.equipe.soldadorPead > 0 && <div>• Soldador PEAD: {execParams.equipe.soldadorPead}</div>}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* RESULTS TAB */}
              <TabsContent value="results" className="space-y-4">
                {trechos.length === 0 && budgetRows.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Carregue a topografia e calcule o orçamento para ver os resultados.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {networkSummary && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Resumo Geral da Rede</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-muted/50 rounded-none p-4 text-center">
                              <div className="text-2xl font-bold">{networkSummary.totalTrechos}</div>
                              <div className="text-sm text-muted-foreground">Trechos</div>
                            </div>
                            <div className="bg-muted/50 rounded-none p-4 text-center">
                              <div className="text-2xl font-bold">{formatNumber(networkSummary.comprimentoTotal, 1)} m</div>
                              <div className="text-sm text-muted-foreground">Extensão Total</div>
                            </div>
                            <div className="bg-green-100 rounded-none p-4 text-center">
                              <div className="text-2xl font-bold text-green-700">{networkSummary.trechosGravidade}</div>
                              <div className="text-sm text-green-600">Gravidade</div>
                            </div>
                            <div className="bg-orange-100 rounded-none p-4 text-center">
                              <div className="text-2xl font-bold text-orange-700">{networkSummary.trechosElevatoria}</div>
                              <div className="text-sm text-orange-600">Elevatória</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {budgetSummary && (
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle>Resumo Financeiro</CardTitle>
                          <Button variant="outline" size="sm" onClick={handleExportExcel}>
                            <Download className="h-4 w-4 mr-2" /> Exportar Excel
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-primary/10 rounded-none p-6 text-center mb-4">
                            <div className="text-4xl font-bold text-primary">
                              {formatCurrency(budgetSummary.totalCost)}
                            </div>
                            <div className="text-muted-foreground">Custo Total Estimado</div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                              <div className="text-xl font-semibold">{formatNumber(budgetSummary.totalLengthM, 1)} m</div>
                              <div className="text-sm text-muted-foreground">Extensão</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xl font-semibold">{formatCurrency(budgetSummary.averageCostPerMeter)}/m</div>
                              <div className="text-sm text-muted-foreground">Custo Médio</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default SanitationEngine;
