import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Calculator, FileSpreadsheet, Download, Pickaxe, Route, ClipboardList, DollarSign, BarChart3 } from "lucide-react";
import { Trecho } from "@/engine/domain";
import { PontoTopografico } from "@/engine/reader";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

// Minimum pipe slope for self-cleaning velocity (NBR 9649 / NBR 12207)
const getMinSlope = (dn: number): number => {
  if (dn <= 150) return 0.005;    // 0.5%
  if (dn <= 200) return 0.0033;   // 0.33%
  if (dn <= 250) return 0.0025;   // 0.25%
  if (dn <= 300) return 0.002;    // 0.20%
  return 0.0015;                   // 0.15% (DN400+)
};

// SINAPI reference cost table (Ref: SINAPI 12/2024 - Desonerado - SP)
const SINAPI_COSTS = {
  escavacao: {
    "0-1.5": { codigo: "96995", descricao: "Escavação mecanizada 1ª cat. até 1,5m", unit: "m³", custo: 28.50 },
    "1.5-3": { codigo: "96996", descricao: "Escavação mecanizada 1ª cat. 1,5-3m", unit: "m³", custo: 35.20 },
    "3-4.5": { codigo: "96997", descricao: "Escavação mecanizada 1ª cat. 3-4,5m", unit: "m³", custo: 42.80 },
    "rocha": { codigo: "96999", descricao: "Escavação 3ª cat. (rocha)", unit: "m³", custo: 125.50 },
  },
  escoramento: {
    madeira: { codigo: "95241", descricao: "Escoramento contínuo madeira", unit: "m²", custo: 45.80 },
    metalico: { codigo: "95242", descricao: "Escoramento metálico", unit: "m²", custo: 38.50 },
    estaca: { codigo: "95243", descricao: "Estaca-prancha", unit: "m²", custo: 85.20 },
  },
  tubulacao: {
    150: { codigo: "89356", descricao: "Tubo PVC DN150 implantado", unit: "m", custo: 125.50 },
    200: { codigo: "89357", descricao: "Tubo PVC DN200 implantado", unit: "m", custo: 185.30 },
    250: { codigo: "89358", descricao: "Tubo PVC DN250 implantado", unit: "m", custo: 265.80 },
    300: { codigo: "89359", descricao: "Tubo PVC DN300 implantado", unit: "m", custo: 355.20 },
    400: { codigo: "89361", descricao: "Tubo PVC DN400 implantado", unit: "m", custo: 485.60 },
  },
  reaterro: {
    compactado: { codigo: "97914", descricao: "Reaterro compactado", unit: "m³", custo: 18.50 },
    berco: { codigo: "97905", descricao: "Berço de areia", unit: "m³", custo: 95.30 },
    envoltoria: { codigo: "97906", descricao: "Envoltória com areia", unit: "m³", custo: 85.50 },
  },
  pavimentacao: {
    subbase: { codigo: "95995", descricao: "Sub-base BGS", unit: "m³", custo: 125.30 },
    base: { codigo: "95996", descricao: "Base brita graduada", unit: "m³", custo: 145.80 },
    cbuq: { codigo: "95998", descricao: "CBUQ 5cm (asfalto)", unit: "m²", custo: 28.50 },
    concreto: { codigo: "96001", descricao: "Pavimento concreto", unit: "m²", custo: 85.00 },
    bloquete: { codigo: "96003", descricao: "Bloquete intertravado", unit: "m²", custo: 55.00 },
  },
  pv: {
    "0-1.5": { codigo: "89709", descricao: "PV concreto até 1,5m", unit: "un", custo: 2850.00 },
    "1.5-2.5": { codigo: "89710", descricao: "PV concreto 1,5-2,5m", unit: "un", custo: 4250.00 },
    "2.5-4": { codigo: "89711", descricao: "PV concreto 2,5-4,0m", unit: "un", custo: 6850.00 },
  },
  botafora: { codigo: "97918", descricao: "Carga, transporte e descarga - bota-fora", unit: "m³", custo: 12.50 },
} as const;

export interface QuantRow {
  id: string;
  trecho: string;
  comp: number;
  dn: number;
  prof: number;
  profInicio: number;
  profFim: number;
  larguraVala: number;
  escavacao: number;
  reaterro: number;
  botafora: number;
  pavimento: number;
  escoramento: boolean;
  // Intermediate volumes/areas for budget module
  bercoVol: number;
  envoltoriaVol: number;
  escorArea: number;
  // Coordinates from topography
  xInicio: number;
  yInicio: number;
  cotaInicio: number;
  xFim: number;
  yFim: number;
  cotaFim: number;
  // Costs
  custoEscavacao: number;
  custoEscoramento: number;
  custoTubo: number;
  custoBerco: number;
  custoEnvoltoria: number;
  custoReaterro: number;
  custoBotafora: number;
  custoPavimento: number;
  custoPV: number;
  custoTotal: number;
}

export interface QuantityParams {
  tipoPavimento: string;
  tipoEscoramento: string;
}

interface QuantitiesModuleProps {
  trechos: Trecho[];
  pontos?: PontoTopografico[];
  onQuantitiesCalculated?: (rows: QuantRow[], params: QuantityParams) => void;
}

export const QuantitiesModule = ({ trechos, pontos, onQuantitiesCalculated }: QuantitiesModuleProps) => {
  const navigate = useNavigate();
  const [tipoPavimento, setTipoPavimento] = useState("terra");
  const [larguraMinVala, setLarguraMinVala] = useState(0.6);
  const [folgaLateral, setFolgaLateral] = useState(0.15);
  const [empolamento, setEmpolamento] = useState(1.25);
  const [espBerco, setEspBerco] = useState(0.10);
  const [espEnvoltoria, setEspEnvoltoria] = useState(0.30);
  const [faixaTecnica, setFaixaTecnica] = useState(0.30);
  const [espSubbase, setEspSubbase] = useState(0.20);
  const [espBase, setEspBase] = useState(0.15);
  const [espAsfalto, setEspAsfalto] = useState(0.05);
  const [tipoEscoramento, setTipoEscoramento] = useState("madeira");
  const [recobrimentoMin, setRecobrimentoMin] = useState(1.0);
  const [rows, setRows] = useState<QuantRow[]>([]);

  // Minimum depth fallback when topography has no elevation data
  const baseProfundidadeMin = 1.20;

  const getEscavacaoCusto = (prof: number) => {
    if (prof <= 1.5) return SINAPI_COSTS.escavacao["0-1.5"].custo;
    if (prof <= 3.0) return SINAPI_COSTS.escavacao["1.5-3"].custo;
    return SINAPI_COSTS.escavacao["3-4.5"].custo;
  };

  const getEscoramentoCusto = () => {
    const k = tipoEscoramento as keyof typeof SINAPI_COSTS.escoramento;
    return SINAPI_COSTS.escoramento[k]?.custo ?? 45.80;
  };

  const getTuboCusto = (dn: number) => {
    const k = dn as keyof typeof SINAPI_COSTS.tubulacao;
    return SINAPI_COSTS.tubulacao[k]?.custo ?? 185.30;
  };

  const getPavCusto = () => {
    if (tipoPavimento === "asfalto") return SINAPI_COSTS.pavimentacao.cbuq.custo;
    if (tipoPavimento === "concreto") return SINAPI_COSTS.pavimentacao.concreto.custo;
    if (tipoPavimento === "bloquete") return SINAPI_COSTS.pavimentacao.bloquete.custo;
    return 0;
  };

  const getPVCusto = (prof: number) => {
    if (prof <= 1.5) return SINAPI_COSTS.pv["0-1.5"].custo;
    if (prof <= 2.5) return SINAPI_COSTS.pv["1.5-2.5"].custo;
    return SINAPI_COSTS.pv["2.5-4"].custo;
  };

  const calculate = () => {
    if (trechos.length === 0) { toast.error("Sem trechos carregados. Importe topografia primeiro."); return; }
    const result: QuantRow[] = trechos.map((t, idx) => {
      const dnM = t.diametroMm / 1000;
      const lv = Math.max(larguraMinVala, dnM + 2 * folgaLateral);

      // --- Profundidade baseada nas cotas topográficas ---
      // iTerreno = (cotaInicio - cotaFim) / comprimento (positivo = descida)
      const iTerreno = t.declividade;
      const iMin = getMinSlope(t.diametroMm);
      // Pipe slope: at least iMin for self-cleaning (gravity sections)
      const isGravity = t.tipoRede === "Esgoto por Gravidade";
      const iTubo = isGravity ? Math.max(iTerreno, iMin) : iTerreno;

      // Depth at start (montante): minimum cover + pipe diameter
      const profInicioRaw = recobrimentoMin + dnM;
      // Depth at end (jusante): additional depth when pipe slope > terrain slope
      const profFimRaw = profInicioRaw + (iTubo - iTerreno) * t.comprimento;

      const profInicio = Math.max(profInicioRaw, baseProfundidadeMin);
      const profFim = Math.max(profFimRaw, baseProfundidadeMin);
      // Average depth (trapezoidal) for volume calculation
      const prof = (profInicio + profFim) / 2;

      const escavacao = t.comprimento * lv * prof;
      const volTubo = t.comprimento * Math.PI * (dnM / 2) ** 2;
      const bercoVol = t.comprimento * lv * espBerco;
      const envoltoriaVol = t.comprimento * lv * espEnvoltoria;
      const reaterro = escavacao - volTubo - bercoVol - envoltoriaVol;
      const botafora = (escavacao - reaterro) * empolamento;

      const needEscoramento = prof > 1.25;
      const escorArea = needEscoramento ? t.comprimento * prof * 2 : 0;
      const areaPav = t.comprimento * (lv + 2 * faixaTecnica);

      const custoEscavacao = escavacao * getEscavacaoCusto(prof);
      const custoEscoramento = escorArea * getEscoramentoCusto();
      const custoTubo = t.comprimento * getTuboCusto(t.diametroMm);
      const custoBerco = bercoVol * SINAPI_COSTS.reaterro.berco.custo;
      const custoEnvoltoria = envoltoriaVol * SINAPI_COSTS.reaterro.envoltoria.custo;
      const custoReaterro = reaterro * SINAPI_COSTS.reaterro.compactado.custo;
      const custoBotafora = botafora * SINAPI_COSTS.botafora.custo;
      const custoPavimento = tipoPavimento === "terra" ? 0 : areaPav * getPavCusto();
      const custoPV = getPVCusto(prof);

      const custoTotal = custoEscavacao + custoEscoramento + custoTubo + custoBerco +
        custoEnvoltoria + custoReaterro + custoBotafora + custoPavimento + custoPV;

      return {
        id: `T${String(idx + 1).padStart(2, "0")}`,
        trecho: t.nomeTrecho || `${t.idInicio}→${t.idFim}`,
        comp: t.comprimento, dn: t.diametroMm,
        prof, profInicio, profFim, larguraVala: lv,
        escavacao, reaterro, botafora, pavimento: areaPav,
        escoramento: needEscoramento,
        bercoVol, envoltoriaVol, escorArea,
        xInicio: t.xInicio, yInicio: t.yInicio, cotaInicio: t.cotaInicio,
        xFim: t.xFim, yFim: t.yFim, cotaFim: t.cotaFim,
        custoEscavacao, custoEscoramento, custoTubo, custoBerco, custoEnvoltoria,
        custoReaterro, custoBotafora, custoPavimento, custoPV, custoTotal,
      };
    });
    setRows(result);
    onQuantitiesCalculated?.(result, { tipoPavimento, tipoEscoramento });
    toast.success(`Quantitativos SINAPI calculados para ${result.length} trechos`);
  };

  const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtC = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totals = useMemo(() => {
    const totalCusto = rows.reduce((s, r) => s + r.custoTotal, 0);
    const totalEscav = rows.reduce((s, r) => s + r.escavacao, 0);
    const totalReat = rows.reduce((s, r) => s + r.reaterro, 0);
    const totalBotafora = rows.reduce((s, r) => s + r.botafora, 0);
    const totalPav = rows.reduce((s, r) => s + r.pavimento, 0);
    const totalComp = rows.reduce((s, r) => s + r.comp, 0);
    return { totalCusto, totalEscav, totalReat, totalBotafora, totalPav, totalComp };
  }, [rows]);

  return (
    <div className="space-y-4">
      {trechos.length > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-600">✓ Topografia carregada</Badge>
              <span className="text-sm text-muted-foreground">{trechos.length} trechos | {fmt(trechos.reduce((s, t) => s + t.comprimento, 0), 0)}m</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="parametros">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
          <TabsTrigger value="resultados">Resultados</TabsTrigger>
          <TabsTrigger value="sinapi">SINAPI</TabsTrigger>
        </TabsList>

        <TabsContent value="parametros" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-yellow-600" /> Parâmetros de Quantitativos</CardTitle>
              <CardDescription>Composições SINAPI (Ref: 12/2024 - Desonerado)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tipo de Pavimento</Label>
                  <Select value={tipoPavimento} onValueChange={setTipoPavimento}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[["terra", "Terra"], ["paralelepipedo", "Paralelepípedo"], ["asfalto", "Asfalto (CBUQ)"], ["concreto", "Concreto"], ["bloquete", "Bloquete"]].map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Escoramento</Label>
                  <Select value={tipoEscoramento} onValueChange={setTipoEscoramento}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="madeira">Contínuo (Madeira)</SelectItem>
                      <SelectItem value="metalico">Metálico</SelectItem>
                      <SelectItem value="estaca">Estaca-prancha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Largura mín. vala (m)</Label><Input type="number" step="0.05" value={larguraMinVala} onChange={e => setLarguraMinVala(Number(e.target.value))} /></div>
                <div><Label>Folga lateral (m)</Label><Input type="number" step="0.05" value={folgaLateral} onChange={e => setFolgaLateral(Number(e.target.value))} /></div>
                <div><Label>Empolamento</Label><Input type="number" step="0.05" value={empolamento} onChange={e => setEmpolamento(Number(e.target.value))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Esp. berço (m)</Label><Input type="number" step="0.01" value={espBerco} onChange={e => setEspBerco(Number(e.target.value))} /></div>
                <div><Label>Esp. envoltória (m)</Label><Input type="number" step="0.01" value={espEnvoltoria} onChange={e => setEspEnvoltoria(Number(e.target.value))} /></div>
                <div><Label>Faixa técnica (m)</Label><Input type="number" step="0.05" value={faixaTecnica} onChange={e => setFaixaTecnica(Number(e.target.value))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Esp. sub-base (m)</Label><Input type="number" step="0.01" value={espSubbase} onChange={e => setEspSubbase(Number(e.target.value))} /></div>
                <div><Label>Esp. base (m)</Label><Input type="number" step="0.01" value={espBase} onChange={e => setEspBase(Number(e.target.value))} /></div>
                <div><Label>Esp. asfalto (m)</Label><Input type="number" step="0.01" value={espAsfalto} onChange={e => setEspAsfalto(Number(e.target.value))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Recobrimento mín. (m)</Label><Input type="number" step="0.1" value={recobrimentoMin} onChange={e => setRecobrimentoMin(Number(e.target.value))} /></div>
              </div>
            </CardContent>
          </Card>
          <Button onClick={calculate} className="w-full"><Calculator className="h-4 w-4 mr-1" /> Calcular Quantitativos (SINAPI)</Button>
        </TabsContent>

        <TabsContent value="resultados" className="space-y-4">
          {rows.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">Configure os parâmetros e clique em "Calcular" para ver resultados.</CardContent></Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { icon: "🔗", label: "Trechos", value: rows.length },
                  { icon: "📏", label: "Extensão Total", value: `${fmt(totals.totalComp, 1)} m` },
                  { icon: <Pickaxe className="h-6 w-6 inline-block" />, label: "Escavação", value: `${fmt(totals.totalEscav, 1)} m³` },
                  { icon: "🚛", label: "Bota-fora", value: `${fmt(totals.totalBotafora, 1)} m³` },
                  { icon: <Route className="h-6 w-6 inline-block" />, label: "Recomposição Pav.", value: `${fmt(totals.totalPav, 1)} m²` },
                ].map((item, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl">{item.icon}</div>
                      <div className="text-lg font-bold mt-1">{item.value}</div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader><CardTitle><ClipboardList className="h-4 w-4 inline-block mr-1" /> Resultados Detalhados</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Início (X,Y)</TableHead>
                          <TableHead>Fim (X,Y)</TableHead>
                          <TableHead>Cota Ini.</TableHead>
                          <TableHead>Cota Fim</TableHead>
                          <TableHead>Comp (m)</TableHead>
                          <TableHead>DN (mm)</TableHead>
                          <TableHead>Prof. Ini. (m)</TableHead>
                          <TableHead>Prof. Fim (m)</TableHead>
                          <TableHead>Prof. Méd. (m)</TableHead>
                          <TableHead>Largura</TableHead>
                          <TableHead>Escav. (m³)</TableHead>
                          <TableHead>Reaterro (m³)</TableHead>
                          <TableHead>Bota-fora (m³)</TableHead>
                          <TableHead>Pav. (m²)</TableHead>
                          <TableHead>Escor.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.id}</TableCell>
                            <TableCell className="text-xs font-mono">{fmt(r.xInicio, 1)}, {fmt(r.yInicio, 1)}</TableCell>
                            <TableCell className="text-xs font-mono">{fmt(r.xFim, 1)}, {fmt(r.yFim, 1)}</TableCell>
                            <TableCell>{fmt(r.cotaInicio, 2)}</TableCell>
                            <TableCell>{fmt(r.cotaFim, 2)}</TableCell>
                            <TableCell>{fmt(r.comp, 1)}</TableCell>
                            <TableCell>{r.dn}</TableCell>
                            <TableCell>{fmt(r.profInicio, 2)}</TableCell>
                            <TableCell>{fmt(r.profFim, 2)}</TableCell>
                            <TableCell>{fmt(r.prof, 2)}</TableCell>
                            <TableCell>{fmt(r.larguraVala, 2)}</TableCell>
                            <TableCell>{fmt(r.escavacao, 2)}</TableCell>
                            <TableCell>{fmt(r.reaterro, 2)}</TableCell>
                            <TableCell>{fmt(r.botafora, 2)}</TableCell>
                            <TableCell>{fmt(r.pavimento, 2)}</TableCell>
                            <TableCell>{r.escoramento ? "Sim" : "Não"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Summary */}
              <Card>
                <CardHeader><CardTitle><DollarSign className="h-4 w-4 inline-block mr-1" /> Resumo de Custos (SINAPI)</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Escavação", value: rows.reduce((s, r) => s + r.custoEscavacao, 0) },
                      { label: "Escoramento", value: rows.reduce((s, r) => s + r.custoEscoramento, 0) },
                      { label: "Tubulação", value: rows.reduce((s, r) => s + r.custoTubo, 0) },
                      { label: "Pavimentação", value: rows.reduce((s, r) => s + r.custoPavimento, 0) },
                    ].map((item, i) => (
                      <div key={i} className="bg-muted/50 rounded-lg p-3 text-center">
                        <div className="text-sm font-bold">{fmtC(item.value)}</div>
                        <div className="text-xs text-muted-foreground">{item.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-primary/10 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{fmtC(totals.totalCusto)}</div>
                    <div className="text-xs text-muted-foreground">Custo Total (SINAPI) | {fmtC(totals.totalComp > 0 ? totals.totalCusto / totals.totalComp : 0)}/m</div>
                  </div>
                </CardContent>
              </Card>

              {/* Curva ABC */}
              <Card>
                <CardHeader><CardTitle><BarChart3 className="h-4 w-4 inline-block mr-1" /> Curva ABC (Pareto)</CardTitle></CardHeader>
                <CardContent>
                  {(() => {
                    const categories = [
                      { item: "Escoramento", total: rows.reduce((s, r) => s + r.custoEscoramento, 0) },
                      { item: "Tubulação", total: rows.reduce((s, r) => s + r.custoTubo, 0) },
                      { item: "Pavimentação", total: rows.reduce((s, r) => s + r.custoPavimento, 0) },
                      { item: "Escavação", total: rows.reduce((s, r) => s + r.custoEscavacao, 0) },
                      { item: "Poços de Visita", total: rows.reduce((s, r) => s + r.custoPV, 0) },
                      { item: "Berço/Envoltória", total: rows.reduce((s, r) => s + r.custoBerco + r.custoEnvoltoria, 0) },
                      { item: "Reaterro", total: rows.reduce((s, r) => s + r.custoReaterro, 0) },
                      { item: "Bota-fora", total: rows.reduce((s, r) => s + r.custoBotafora, 0) },
                    ].sort((a, b) => b.total - a.total);
                    let acum = 0;
                    return (
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Item</TableHead><TableHead>Valor</TableHead><TableHead>%</TableHead><TableHead>Acum.</TableHead><TableHead>Classe</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {categories.map((cat, i) => {
                            const pct = totals.totalCusto > 0 ? (cat.total / totals.totalCusto) * 100 : 0;
                            acum += pct;
                            const classe = acum <= 80 ? "A" : acum <= 95 ? "B" : "C";
                            return (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{cat.item}</TableCell>
                                <TableCell>{fmtC(cat.total)}</TableCell>
                                <TableCell>{fmt(pct, 1)}%</TableCell>
                                <TableCell>{fmt(acum, 1)}%</TableCell>
                                <TableCell><Badge variant={classe === "A" ? "default" : classe === "B" ? "secondary" : "outline"}>{classe}</Badge></TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    );
                  })()}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  const wb = XLSX.utils.book_new();
                  const data = rows.map(r => ({
                    ID: r.id, Trecho: r.trecho,
                    "X Início": r.xInicio, "Y Início": r.yInicio, "Cota Início": r.cotaInicio,
                    "X Fim": r.xFim, "Y Fim": r.yFim, "Cota Fim": r.cotaFim,
                    "Comp (m)": r.comp, "DN (mm)": r.dn,
                    "Prof Início (m)": r.profInicio, "Prof Fim (m)": r.profFim, "Prof Média (m)": r.prof,
                    "Largura Vala (m)": r.larguraVala, "Escavação (m³)": r.escavacao, "Reaterro (m³)": r.reaterro,
                    "Bota-fora (m³)": r.botafora, "Pavimento (m²)": r.pavimento, Escoramento: r.escoramento ? "Sim" : "Não",
                    "Custo Escav.": r.custoEscavacao, "Custo Escor.": r.custoEscoramento, "Custo Tubo": r.custoTubo,
                    "Custo Berço": r.custoBerco, "Custo Envolt.": r.custoEnvoltoria, "Custo Reat.": r.custoReaterro,
                    "Custo Pav.": r.custoPavimento, "Custo PV": r.custoPV, "Custo Total": r.custoTotal,
                  }));
                  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Quantitativos");
                  XLSX.writeFile(wb, "quantitativos_sinapi.xlsx");
                  toast.success("Excel exportado!");
                }} className="flex-1">
                  <Download className="h-4 w-4 mr-1" /> Exportar Excel
                </Button>
                <Button onClick={() => {
                  onQuantitiesCalculated?.(rows, { tipoPavimento, tipoEscoramento });
                  navigate("/hydronetwork/orcamento");
                }} className="flex-1">
                  <DollarSign className="h-4 w-4 mr-1" /> Levar para Orçamento
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="sinapi">
          <Card>
            <CardHeader>
              <CardTitle><ClipboardList className="h-4 w-4 inline-block mr-1" /> Composições SINAPI Utilizadas</CardTitle>
              <CardDescription>Custos unitários de referência (SINAPI 12/2024 - Desonerado - SP)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Código</TableHead><TableHead>Descrição</TableHead><TableHead>Unidade</TableHead><TableHead>Custo Unit.</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {[
                      SINAPI_COSTS.escavacao["0-1.5"], SINAPI_COSTS.escavacao["1.5-3"], SINAPI_COSTS.escavacao["3-4.5"],
                      SINAPI_COSTS.escoramento.madeira, SINAPI_COSTS.escoramento.metalico, SINAPI_COSTS.escoramento.estaca,
                      SINAPI_COSTS.tubulacao[150], SINAPI_COSTS.tubulacao[200], SINAPI_COSTS.tubulacao[300], SINAPI_COSTS.tubulacao[400],
                      SINAPI_COSTS.reaterro.compactado, SINAPI_COSTS.reaterro.berco, SINAPI_COSTS.reaterro.envoltoria,
                      SINAPI_COSTS.pavimentacao.cbuq, SINAPI_COSTS.pavimentacao.concreto, SINAPI_COSTS.pavimentacao.bloquete, SINAPI_COSTS.pavimentacao.subbase,
                      SINAPI_COSTS.pv["0-1.5"], SINAPI_COSTS.pv["1.5-2.5"], SINAPI_COSTS.pv["2.5-4"],
                      SINAPI_COSTS.botafora,
                    ].map((item, i) => (
                      <TableRow key={i}>
                        <TableCell><Badge variant="outline">{item.codigo}</Badge></TableCell>
                        <TableCell>{item.descricao}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="font-medium">{fmtC(item.custo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
