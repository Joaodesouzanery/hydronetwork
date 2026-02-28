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
import { Calculator, Download, Upload, Database, FileSpreadsheet } from "lucide-react";
import { Trecho } from "@/engine/domain";
import { PontoTopografico } from "@/engine/reader";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart, Area } from "recharts";
import * as XLSX from "xlsx";

// ─── Cost Databases ───
const SINAPI_DESONERADO = {
  label: "SINAPI (Caixa/IBGE) - Desonerado",
  escavacao: [
    { codigo: "96995", desc: "Escav. 1ª cat. (0-1,5m)", unit: "m³", custo: 28.50 },
    { codigo: "96996", desc: "Escav. 1ª cat. (1,5-3m)", unit: "m³", custo: 35.20 },
    { codigo: "96997", desc: "Escav. 1ª cat. (3-4,5m)", unit: "m³", custo: 42.80 },
    { codigo: "96998", desc: "Escav. 2ª cat.", unit: "m³", custo: 65.30 },
    { codigo: "96999", desc: "Escav. 3ª cat.", unit: "m³", custo: 125.50 },
  ],
  escoramento: [
    { codigo: "95241", desc: "Escoramento madeira", unit: "m²", custo: 45.80 },
    { codigo: "95242", desc: "Escoramento metálico", unit: "m²", custo: 38.50 },
    { codigo: "95243", desc: "Estaca-prancha", unit: "m²", custo: 85.20 },
  ],
  tubulacao: [
    { codigo: "89356", desc: "PVC DN150 implantado", unit: "m", custo: 125.50, dn: 150 },
    { codigo: "89357", desc: "PVC DN200 implantado", unit: "m", custo: 185.30, dn: 200 },
    { codigo: "89358", desc: "PVC DN250 implantado", unit: "m", custo: 265.80, dn: 250 },
    { codigo: "89359", desc: "PVC DN300 implantado", unit: "m", custo: 355.20, dn: 300 },
    { codigo: "89361", desc: "PVC DN400 implantado", unit: "m", custo: 485.60, dn: 400 },
    { codigo: "89363", desc: "PEAD DN500 implantado", unit: "m", custo: 650.80, dn: 500 },
    { codigo: "89365", desc: "Concreto DN600 implantado", unit: "m", custo: 820.50, dn: 600 },
  ],
  reaterro: [
    { codigo: "97914", desc: "Reaterro compactado", unit: "m³", custo: 18.50 },
    { codigo: "97905", desc: "Berço de areia", unit: "m³", custo: 95.30 },
    { codigo: "97906", desc: "Envoltória c/ areia", unit: "m³", custo: 85.50 },
  ],
  pavimentacao: [
    { codigo: "95995", desc: "Sub-base BGS", unit: "m³", custo: 125.30 },
    { codigo: "95996", desc: "Base brita grad.", unit: "m³", custo: 145.80 },
    { codigo: "95998", desc: "CBUQ 5cm", unit: "m²", custo: 28.50 },
  ],
  pv: [
    { codigo: "89709", desc: "PV concreto até 1,5m", unit: "un", custo: 2850.00 },
    { codigo: "89710", desc: "PV concreto 1,5-2,5m", unit: "un", custo: 4250.00 },
    { codigo: "89711", desc: "PV concreto 2,5-4,0m", unit: "un", custo: 6850.00 },
  ],
};

const SINAPI_ONERADO = {
  ...SINAPI_DESONERADO,
  label: "SINAPI (Caixa/IBGE) - Onerado",
  escavacao: SINAPI_DESONERADO.escavacao.map(e => ({ ...e, custo: e.custo * 1.28 })),
  escoramento: SINAPI_DESONERADO.escoramento.map(e => ({ ...e, custo: e.custo * 1.28 })),
  tubulacao: SINAPI_DESONERADO.tubulacao.map(e => ({ ...e, custo: e.custo * 1.28 })),
  reaterro: SINAPI_DESONERADO.reaterro.map(e => ({ ...e, custo: e.custo * 1.28 })),
  pavimentacao: SINAPI_DESONERADO.pavimentacao.map(e => ({ ...e, custo: e.custo * 1.28 })),
  pv: SINAPI_DESONERADO.pv.map(e => ({ ...e, custo: e.custo * 1.28 })),
};

const SICRO = {
  ...SINAPI_DESONERADO,
  label: "SICRO (DNIT)",
  escavacao: SINAPI_DESONERADO.escavacao.map(e => ({ ...e, custo: e.custo * 0.92 })),
  escoramento: SINAPI_DESONERADO.escoramento.map(e => ({ ...e, custo: e.custo * 0.95 })),
  tubulacao: SINAPI_DESONERADO.tubulacao.map(e => ({ ...e, custo: e.custo * 1.05 })),
  reaterro: SINAPI_DESONERADO.reaterro.map(e => ({ ...e, custo: e.custo * 0.90 })),
  pavimentacao: SINAPI_DESONERADO.pavimentacao.map(e => ({ ...e, custo: e.custo * 1.10 })),
  pv: SINAPI_DESONERADO.pv.map(e => ({ ...e, custo: e.custo * 1.03 })),
};

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

interface BudgetTrecho {
  id: string; inicio: string; fim: string; comp: number; dn: number; prof: number;
  escavacao: number; escoramento: number; tubo: number; berco: number; envoltoria: number;
  reaterro: number; botafora: number; subbase: number; base: number; asfalto: number;
  pvCusto: number; subtotal: number; bdi: number; total: number;
}

interface BudgetCostModuleProps {
  trechos: Trecho[];
  pontos?: PontoTopografico[];
}

export const BudgetCostModule = ({ trechos, pontos }: BudgetCostModuleProps) => {
  const [baseCustos, setBaseCustos] = useState("sinapi_des");
  const [uf, setUf] = useState("SP");
  const [mesRef, setMesRef] = useState("12/2024");
  const [bdiPct, setBdiPct] = useState(25);
  const [tipoPavimento, setTipoPavimento] = useState("terra");
  const [customCosts, setCustomCosts] = useState<any[] | null>(null);
  const [rows, setRows] = useState<BudgetTrecho[]>([]);

  const getDB = () => {
    if (baseCustos === "sinapi_des") return SINAPI_DESONERADO;
    if (baseCustos === "sinapi_one") return SINAPI_ONERADO;
    if (baseCustos === "sicro") return SICRO;
    return SINAPI_DESONERADO;
  };

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        setCustomCosts(data as any[]);
        toast.success(`Base própria carregada: ${data.length} itens`);
      } catch { toast.error("Erro ao ler arquivo"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const calculate = () => {
    if (trechos.length === 0) { toast.error("Carregue a topografia primeiro."); return; }
    const db = getDB();
    const baseProfundidade = 1.35;
    const incremento = 0.10;
    const larguraMin = 0.6;
    const folgaLateral = 0.15;
    const empolamento = 1.25;
    const espBerco = 0.10;
    const espEnvoltoria = 0.30;
    const faixaTecnica = 0.30;

    const getEscCusto = (prof: number) => {
      if (prof <= 1.5) return db.escavacao[0].custo;
      if (prof <= 3.0) return db.escavacao[1].custo;
      return db.escavacao[2].custo;
    };
    const getTuboCusto = (dn: number) => db.tubulacao.find(t => t.dn === dn)?.custo ?? db.tubulacao[1].custo;
    const getPVCusto = (prof: number) => {
      if (prof <= 1.5) return db.pv[0].custo;
      if (prof <= 2.5) return db.pv[1].custo;
      return db.pv[2].custo;
    };

    const result: BudgetTrecho[] = trechos.map((t, idx) => {
      const dnM = t.diametroMm / 1000;
      const lv = Math.max(larguraMin, dnM + 2 * folgaLateral);
      const prof = baseProfundidade + idx * incremento;
      const volEsc = t.comprimento * lv * prof;
      const volTubo = t.comprimento * Math.PI * (dnM / 2) ** 2;
      const volBerco = t.comprimento * lv * espBerco;
      const volEnv = t.comprimento * lv * espEnvoltoria;
      const volReat = volEsc - volTubo - volBerco - volEnv;
      const volBota = (volEsc - volReat) * empolamento;
      const needEsc = prof > 1.25;
      const escorArea = needEsc ? t.comprimento * prof * 2 : 0;
      const areaPav = t.comprimento * (lv + 2 * faixaTecnica);

      const custoEsc = volEsc * getEscCusto(prof);
      const custoEscor = escorArea * db.escoramento[0].custo;
      const custoTubo = t.comprimento * getTuboCusto(t.diametroMm);
      const custoBerco = volBerco * db.reaterro[1].custo;
      const custoEnv = volEnv * db.reaterro[2].custo;
      const custoReat = volReat * db.reaterro[0].custo;
      const custoBota = volBota * 12.50;
      let custoSubbase = 0, custoBase = 0, custoAsfalto = 0;
      if (tipoPavimento !== "terra") {
        custoSubbase = areaPav * 0.20 * db.pavimentacao[0].custo;
        custoBase = areaPav * 0.15 * db.pavimentacao[1].custo;
        if (tipoPavimento === "asfalto") custoAsfalto = areaPav * db.pavimentacao[2].custo;
      }
      const custoPV = getPVCusto(prof);

      const subtotal = custoEsc + custoEscor + custoTubo + custoBerco + custoEnv + custoReat + custoBota + custoSubbase + custoBase + custoAsfalto + custoPV;
      const bdiVal = subtotal * (bdiPct / 100);

      return {
        id: `T-${String(idx + 1).padStart(2, "0")}`,
        nome: t.nomeTrecho || "", inicio: t.idInicio, fim: t.idFim, comp: t.comprimento, dn: t.diametroMm, prof,
        escavacao: custoEsc, escoramento: custoEscor, tubo: custoTubo,
        berco: custoBerco, envoltoria: custoEnv, reaterro: custoReat,
        botafora: custoBota, subbase: custoSubbase, base: custoBase,
        asfalto: custoAsfalto, pvCusto: custoPV, subtotal, bdi: bdiVal, total: subtotal + bdiVal,
      };
    });
    setRows(result);
    toast.success(`Orçamento calculado para ${result.length} trechos`);
  };

  const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtC = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Consolidated summary
  const consolidated = useMemo(() => {
    if (rows.length === 0) return null;
    const sums = {
      escavacao: rows.reduce((s, r) => s + r.escavacao, 0),
      escoramento: rows.reduce((s, r) => s + r.escoramento, 0),
      tubulacao: rows.reduce((s, r) => s + r.tubo, 0),
      bercoEnvoltoria: rows.reduce((s, r) => s + r.berco + r.envoltoria, 0),
      reaterro: rows.reduce((s, r) => s + r.reaterro, 0),
      pavimentacao: rows.reduce((s, r) => s + r.subbase + r.base + r.asfalto, 0),
      pocosVisita: rows.reduce((s, r) => s + r.pvCusto, 0),
      botafora: rows.reduce((s, r) => s + r.botafora, 0),
    };
    const subtotal = Object.values(sums).reduce((a, b) => a + b, 0);
    const bdiVal = subtotal * (bdiPct / 100);
    const totalComp = rows.reduce((s, r) => s + r.comp, 0);
    return { ...sums, subtotal, bdiVal, totalGeral: subtotal + bdiVal, custoPorMetro: totalComp > 0 ? (subtotal + bdiVal) / totalComp : 0, totalComp };
  }, [rows, bdiPct]);

  // ABC Curve
  const curvaABC = useMemo(() => {
    if (!consolidated) return [];
    const items = [
      { item: "Escoramento", valor: consolidated.escoramento },
      { item: "Tubulação", valor: consolidated.tubulacao },
      { item: "Pavimentação", valor: consolidated.pavimentacao },
      { item: "Escavação", valor: consolidated.escavacao },
      { item: "Poços de Visita", valor: consolidated.pocosVisita },
      { item: "Reaterro", valor: consolidated.reaterro },
      { item: "Berço/Envoltória", valor: consolidated.bercoEnvoltoria },
      { item: "Bota-fora", valor: consolidated.botafora },
    ].sort((a, b) => b.valor - a.valor);
    let acum = 0;
    return items.map(i => {
      const pct = consolidated.subtotal > 0 ? (i.valor / consolidated.subtotal) * 100 : 0;
      acum += pct;
      return { ...i, percentual: pct, acumulado: acum, classe: acum <= 80 ? "A" : acum <= 95 ? "B" : "C" };
    });
  }, [consolidated]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    // Per-segment sheet
    const segData = rows.map(r => ({
      "ID": r.id, "Início": r.inicio, "Fim": r.fim, "Comp (m)": r.comp, "DN (mm)": r.dn,
      "Escavação": r.escavacao, "Escoramento": r.escoramento, "Tubulação": r.tubo,
      "Berço": r.berco, "Envoltória": r.envoltoria, "Reaterro": r.reaterro,
      "Bota-fora": r.botafora, "Sub-base": r.subbase, "Base": r.base, "Asfalto": r.asfalto,
      "PV": r.pvCusto, "Subtotal": r.subtotal, "BDI": r.bdi, "Total": r.total,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(segData), "Orçamento por Trecho");
    if (consolidated) {
      const consData = [
        { Serviço: "Escavação", "Custo Total (R$)": consolidated.escavacao },
        { Serviço: "Escoramento", "Custo Total (R$)": consolidated.escoramento },
        { Serviço: "Tubulação", "Custo Total (R$)": consolidated.tubulacao },
        { Serviço: "Berço/Envoltória", "Custo Total (R$)": consolidated.bercoEnvoltoria },
        { Serviço: "Reaterro", "Custo Total (R$)": consolidated.reaterro },
        { Serviço: "Pavimentação", "Custo Total (R$)": consolidated.pavimentacao },
        { Serviço: "Poços de Visita", "Custo Total (R$)": consolidated.pocosVisita },
        { Serviço: "Bota-fora", "Custo Total (R$)": consolidated.botafora },
        { Serviço: "SUBTOTAL", "Custo Total (R$)": consolidated.subtotal },
        { Serviço: `BDI (${bdiPct}%)`, "Custo Total (R$)": consolidated.bdiVal },
        { Serviço: "TOTAL GERAL", "Custo Total (R$)": consolidated.totalGeral },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(consData), "Resumo Consolidado");
    }
    if (curvaABC.length > 0) {
      const abcData = curvaABC.map(c => ({ Item: c.item, "Valor (R$)": c.valor, "%": c.percentual, "Acum. %": c.acumulado, Classe: c.classe }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(abcData), "Curva ABC");
    }
    XLSX.writeFile(wb, "orcamento_rede.xlsx");
    toast.success("Excel exportado!");
  };

  const db = getDB();

  return (
    <div className="space-y-4">
      {trechos.length > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-600">✓ Topografia carregada</Badge>
              <span className="text-sm text-muted-foreground">{trechos.length} trechos | {fmt(trechos.reduce((s, t) => s + t.comprimento, 0))}m</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="config">
        <TabsList className="grid w-full max-w-xl grid-cols-5">
          <TabsTrigger value="config">Base de Custos</TabsTrigger>
          <TabsTrigger value="composicoes">Composições</TabsTrigger>
          <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
          <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
          <TabsTrigger value="abc">Curva ABC</TabsTrigger>
        </TabsList>

        {/* 5.1 Base de Custos */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-blue-600" /> Base de Custos</CardTitle>
              <CardDescription>Selecione a base de referência ou carregue sua própria</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Base de Custos</Label>
                  <Select value={baseCustos} onValueChange={setBaseCustos}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sinapi_des">SINAPI (Caixa/IBGE) - Desonerado</SelectItem>
                      <SelectItem value="sinapi_one">SINAPI (Caixa/IBGE) - Onerado</SelectItem>
                      <SelectItem value="sicro">SICRO (DNIT)</SelectItem>
                      <SelectItem value="custom">Base Própria (Upload)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estado/UF</Label>
                  <Select value={uf} onValueChange={setUf}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mês/Ano de Referência</Label>
                  <Select value={mesRef} onValueChange={setMesRef}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["12/2024","11/2024","10/2024","09/2024","08/2024","07/2024","06/2024","01/2025","02/2025"].map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>BDI (%)</Label>
                  <Input type="number" value={bdiPct} onChange={e => setBdiPct(Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground mt-1">Bonificação e Despesas Indiretas (padrão: 25%)</p>
                </div>
                <div>
                  <Label>Tipo de Pavimento</Label>
                  <Select value={tipoPavimento} onValueChange={setTipoPavimento}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[["terra", "Terra (sem pavimentação)"], ["asfalto", "Asfalto (CBUQ)"], ["concreto", "Concreto"], ["bloquete", "Bloquete"]].map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {baseCustos === "custom" && (
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">Carregue sua base de custos (CSV ou Excel)</p>
                  <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleCustomUpload} />
                  {customCosts && <Badge className="mt-2" variant="outline">✓ {customCosts.length} itens carregados</Badge>}
                </div>
              )}
              <Button onClick={calculate} className="w-full" disabled={trechos.length === 0}>
                <Calculator className="h-4 w-4 mr-2" /> Calcular Orçamento
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5.2 Composições por Serviço */}
        <TabsContent value="composicoes" className="space-y-4">
          {[
            { title: "Escavação", items: db.escavacao },
            { title: "Escoramento", items: db.escoramento },
            { title: "Tubulação (implantada)", items: db.tubulacao },
            { title: "Reaterro", items: db.reaterro },
            { title: "Pavimentação", items: db.pavimentacao },
            { title: "Poços de Visita", items: db.pv },
          ].map(section => (
            <Card key={section.title}>
              <CardHeader><CardTitle className="text-sm">{section.title}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Código SINAPI</TableHead><TableHead>Serviço</TableHead><TableHead>Unidade</TableHead><TableHead>Custo (R$)</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {section.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell><Badge variant="outline">{item.codigo}</Badge></TableCell>
                        <TableCell>{item.desc}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="font-medium">{fmtC(item.custo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* 5.4 Orçamento por Trecho */}
        <TabsContent value="orcamento" className="space-y-4">
          {rows.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Configure a base de custos e clique em "Calcular Orçamento"</CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-primary">{rows.length}</div><div className="text-xs text-muted-foreground">Trechos</div></CardContent></Card>
                <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-green-600">{fmt(rows.reduce((s, r) => s + r.comp, 0))}m</div><div className="text-xs text-muted-foreground">Extensão</div></CardContent></Card>
                <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-blue-600">{fmtC(rows.reduce((s, r) => s + r.subtotal, 0))}</div><div className="text-xs text-muted-foreground">Subtotal</div></CardContent></Card>
                <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-orange-600">{fmtC(rows.reduce((s, r) => s + r.total, 0))}</div><div className="text-xs text-muted-foreground">Total c/ BDI</div></CardContent></Card>
              </div>
              <Card>
                <CardHeader><CardTitle>Orçamento por Trecho</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>ID</TableHead><TableHead>Trecho</TableHead><TableHead>Comp</TableHead>
                        <TableHead>Escav.</TableHead><TableHead>Escor.</TableHead><TableHead>Tubo</TableHead>
                        <TableHead>Berço</TableHead><TableHead>Envolt.</TableHead><TableHead>Reat.</TableHead>
                        <TableHead>Pav.</TableHead><TableHead>PV</TableHead><TableHead>Subtotal</TableHead>
                        <TableHead>BDI</TableHead><TableHead>Total</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {rows.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.id}</TableCell>
                            <TableCell className="text-xs">{r.nome || `${r.inicio}→${r.fim}`}</TableCell>
                            <TableCell>{fmt(r.comp)}</TableCell>
                            <TableCell>{fmtC(r.escavacao)}</TableCell>
                            <TableCell>{fmtC(r.escoramento)}</TableCell>
                            <TableCell>{fmtC(r.tubo)}</TableCell>
                            <TableCell>{fmtC(r.berco)}</TableCell>
                            <TableCell>{fmtC(r.envoltoria)}</TableCell>
                            <TableCell>{fmtC(r.reaterro)}</TableCell>
                            <TableCell>{fmtC(r.subbase + r.base + r.asfalto)}</TableCell>
                            <TableCell>{fmtC(r.pvCusto)}</TableCell>
                            <TableCell className="font-semibold">{fmtC(r.subtotal)}</TableCell>
                            <TableCell>{fmtC(r.bdi)}</TableCell>
                            <TableCell className="font-bold">{fmtC(r.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              <Button variant="outline" onClick={exportExcel} className="w-full">
                <Download className="h-4 w-4 mr-2" /> Exportar Orçamento (Excel)
              </Button>
            </>
          )}
        </TabsContent>

        {/* 5.5 Consolidado */}
        <TabsContent value="consolidado" className="space-y-4">
          {!consolidated ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Calcule o orçamento primeiro</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle>📊 Orçamento Consolidado</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Serviço</TableHead><TableHead>Custo Total</TableHead><TableHead>%</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {[
                        { label: "Escavação", val: consolidated.escavacao },
                        { label: "Escoramento", val: consolidated.escoramento },
                        { label: "Tubulação", val: consolidated.tubulacao },
                        { label: "Berço/Envoltória", val: consolidated.bercoEnvoltoria },
                        { label: "Reaterro", val: consolidated.reaterro },
                        { label: "Pavimentação", val: consolidated.pavimentacao },
                        { label: "Poços de Visita", val: consolidated.pocosVisita },
                        { label: "Bota-fora", val: consolidated.botafora },
                      ].map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{s.label}</TableCell>
                          <TableCell>{fmtC(s.val)}</TableCell>
                          <TableCell>{consolidated.subtotal > 0 ? fmt((s.val / consolidated.subtotal) * 100) + "%" : "0%"}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>SUBTOTAL</TableCell><TableCell>{fmtC(consolidated.subtotal)}</TableCell><TableCell>100%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>BDI ({bdiPct}%)</TableCell><TableCell>{fmtC(consolidated.bdiVal)}</TableCell><TableCell />
                      </TableRow>
                      <TableRow className="bg-primary/10 font-bold text-lg">
                        <TableCell>TOTAL GERAL</TableCell><TableCell>{fmtC(consolidated.totalGeral)}</TableCell>
                        <TableCell>{fmtC(consolidated.custoPorMetro)}/m</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Distribuição de Custos</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { name: "Escavação", valor: consolidated.escavacao },
                      { name: "Escoramento", valor: consolidated.escoramento },
                      { name: "Tubulação", valor: consolidated.tubulacao },
                      { name: "Pavim.", valor: consolidated.pavimentacao },
                      { name: "PVs", valor: consolidated.pocosVisita },
                      { name: "Reaterro", valor: consolidated.reaterro },
                      { name: "Berço/Env.", valor: consolidated.bercoEnvoltoria },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis fontSize={10} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                      <RechartsTooltip formatter={(v: number) => fmtC(v)} />
                      <Bar dataKey="valor" fill="hsl(210, 70%, 50%)" name="Custo (R$)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* 5.6 Curva ABC */}
        <TabsContent value="abc" className="space-y-4">
          {curvaABC.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Calcule o orçamento primeiro</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle>📊 Curva ABC (Pareto)</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Item</TableHead><TableHead>Valor</TableHead><TableHead>%</TableHead><TableHead>Acum.</TableHead><TableHead>Classe</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {curvaABC.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{c.item}</TableCell>
                          <TableCell>{fmtC(c.valor)}</TableCell>
                          <TableCell>{fmt(c.percentual)}%</TableCell>
                          <TableCell>{fmt(c.acumulado)}%</TableCell>
                          <TableCell><Badge variant={c.classe === "A" ? "default" : c.classe === "B" ? "secondary" : "outline"}>{c.classe}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Gráfico de Pareto</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={curvaABC}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="item" fontSize={10} />
                      <YAxis yAxisId="left" fontSize={10} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" fontSize={10} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                      <RechartsTooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="valor" fill="hsl(210, 70%, 50%)" name="Valor (R$)" />
                      <Line yAxisId="right" type="monotone" dataKey="acumulado" stroke="hsl(0, 70%, 50%)" name="% Acumulado" strokeWidth={2} dot />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
