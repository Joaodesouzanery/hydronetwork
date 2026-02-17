/**
 * BDI Module — Benefícios e Despesas Indiretas
 * Complete contract management, BDI composition, viability analysis
 */
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Calculator, DollarSign, Plus, Trash2, Download, Upload,
  FileText, BarChart3, Users, Wrench, TrendingUp, CheckCircle,
  AlertTriangle, XCircle, Copy, Printer, Info
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine, ComposedChart, Line
} from "recharts";
import * as XLSX from "xlsx";
import {
  TipoContrato, StatusContrato, CargoEquipe, EquipamentoContrato,
  ComposicaoBDI, ContratoBDI, AnaliseViabilidade, CenarioBDI,
  DEFAULT_COMPOSICAO_BDI, ESTADOS_BR, DEMO_CONTRATO,
  calcularCustoCargo, calcularCustoEquipamento, calcularBDI_TCU,
  calcularPrecoVenda, analisarViabilidade, gerarCenarios
} from "@/engine/bdi";

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;
const genId = () => Math.random().toString(36).substring(2, 10);

const STATUS_COLORS: Record<string, string> = {
  'Proposta': 'bg-yellow-500',
  'Em Andamento': 'bg-blue-500',
  'Concluído': 'bg-green-500',
  'Cancelado': 'bg-red-500',
};

const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#22c55e", "#ef4444", "#14b8a6"];

export const BdiModule = () => {
  // Contract data
  const [nome, setNome] = useState("");
  const [contratante, setContratante] = useState("");
  const [tipoContrato, setTipoContrato] = useState<TipoContrato>(TipoContrato.MISTO);
  const [numeroEdital, setNumeroEdital] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataTermino, setDataTermino] = useState("");
  const [duracaoMeses, setDuracaoMeses] = useState(12);
  const [municipio, setMunicipio] = useState("");
  const [estado, setEstado] = useState("SP");
  const [statusContrato, setStatusContrato] = useState<StatusContrato>(StatusContrato.PROPOSTA);

  // Teams
  const [maoDeObra, setMaoDeObra] = useState<CargoEquipe[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoContrato[]>([]);
  const [custoMateriaisMes, setCustoMateriaisMes] = useState(0);
  const [usarOrcamento, setUsarOrcamento] = useState(false);

  // BDI
  const [modoSimplificado, setModoSimplificado] = useState(true);
  const [bdiSimplificado, setBdiSimplificado] = useState(12);
  const [composicao, setComposicao] = useState<ComposicaoBDI>({ ...DEFAULT_COMPOSICAO_BDI });

  // Viability
  const [valorEdital, setValorEdital] = useState(0);

  // History
  const [contratos, setContratos] = useState<ContratoBDI[]>(() => {
    try { return JSON.parse(localStorage.getItem("contratos_bdi") || "[]"); } catch { return []; }
  });

  const [activeTab, setActiveTab] = useState("contrato");

  // Auto-calculate duration from dates
  const calcDuration = useCallback((ini: string, fim: string) => {
    if (!ini || !fim) return;
    const d1 = new Date(ini); const d2 = new Date(fim);
    const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    if (months > 0) setDuracaoMeses(months);
  }, []);

  // Computed values
  const custoMaoObraMes = useMemo(() => maoDeObra.reduce((s, c) => s + calcularCustoCargo(c), 0), [maoDeObra]);
  const custoEquipamentosMes = useMemo(() => equipamentos.reduce((s, e) => s + calcularCustoEquipamento(e), 0), [equipamentos]);
  const custoDiretoMes = custoMaoObraMes + custoEquipamentosMes + custoMateriaisMes;
  const custoDiretoTotal = custoDiretoMes * duracaoMeses;

  const bdiPercentual = useMemo(() =>
    modoSimplificado ? bdiSimplificado : calcularBDI_TCU(composicao),
    [modoSimplificado, bdiSimplificado, composicao]
  );

  const bdiValor = custoDiretoTotal * (bdiPercentual / 100);
  const precoVenda = custoDiretoTotal + bdiValor;
  const precoVendaMes = duracaoMeses > 0 ? precoVenda / duracaoMeses : 0;

  const viabilidade = useMemo<AnaliseViabilidade | null>(() => {
    if (valorEdital <= 0 || custoDiretoTotal <= 0) return null;
    return analisarViabilidade(custoDiretoTotal, precoVenda, valorEdital);
  }, [custoDiretoTotal, precoVenda, valorEdital]);

  const cenarios = useMemo(() =>
    custoDiretoTotal > 0 ? gerarCenarios(custoDiretoTotal, valorEdital) : [],
    [custoDiretoTotal, valorEdital]
  );

  // Actions
  const addCargo = () => {
    setMaoDeObra([...maoDeObra, { id: genId(), cargo: "", quantidade: 1, salarioMensal: 0, encargosPercent: 73.33, custoTotalMes: 0 }]);
  };

  const updateCargo = (idx: number, field: keyof CargoEquipe, val: any) => {
    const u = [...maoDeObra]; (u[idx] as any)[field] = val;
    u[idx].custoTotalMes = calcularCustoCargo(u[idx]);
    setMaoDeObra(u);
  };

  const removeCargo = (idx: number) => setMaoDeObra(maoDeObra.filter((_, i) => i !== idx));

  const addEquipamento = () => {
    setEquipamentos([...equipamentos, { id: genId(), equipamento: "", quantidade: 1, proprioOuAlugado: 'Alugado', custoMensal: 0, horasMes: 176 }]);
  };

  const updateEquipamento = (idx: number, field: keyof EquipamentoContrato, val: any) => {
    const u = [...equipamentos]; (u[idx] as any)[field] = val;
    setEquipamentos(u);
  };

  const removeEquipamento = (idx: number) => setEquipamentos(equipamentos.filter((_, i) => i !== idx));

  const updateComposicao = (field: keyof ComposicaoBDI, val: number) => {
    setComposicao({ ...composicao, [field]: val });
  };

  const loadDemo = () => {
    const d = DEMO_CONTRATO;
    setNome(d.nome); setContratante(d.contratante); setTipoContrato(d.tipoContrato);
    setNumeroEdital(d.numeroEdital); setDataInicio(d.dataInicio); setDataTermino(d.dataTermino);
    setDuracaoMeses(d.duracaoMeses); setMunicipio(d.municipio); setEstado(d.estado);
    setStatusContrato(d.status); setMaoDeObra([...d.maoDeObra]); setEquipamentos([...d.equipamentos]);
    setCustoMateriaisMes(d.custoMateriaisMes); setComposicao({ ...d.composicaoBDI });
    setModoSimplificado(d.modoSimplificado); setBdiSimplificado(d.bdiSimplificado);
    setValorEdital(d.valorEdital);
    toast.success("Demo carregado: Itapetininga — R$ 112M");
  };

  const saveContrato = () => {
    if (!nome) { toast.error("Preencha o nome do contrato"); return; }
    const contrato: ContratoBDI = {
      id: genId(), nome, contratante, tipoContrato, numeroEdital, dataInicio, dataTermino,
      duracaoMeses, municipio, estado, status: statusContrato, maoDeObra, equipamentos,
      custoMateriaisMes, usarOrcamentoPlataforma: usarOrcamento, composicaoBDI: composicao,
      modoSimplificado, bdiSimplificado, valorEdital,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const updated = [...contratos, contrato];
    setContratos(updated);
    localStorage.setItem("contratos_bdi", JSON.stringify(updated));
    toast.success("Contrato salvo!");
  };

  const deleteContrato = (id: string) => {
    const updated = contratos.filter(c => c.id !== id);
    setContratos(updated);
    localStorage.setItem("contratos_bdi", JSON.stringify(updated));
    toast.success("Contrato excluído");
  };

  const loadContrato = (c: ContratoBDI) => {
    setNome(c.nome); setContratante(c.contratante); setTipoContrato(c.tipoContrato);
    setNumeroEdital(c.numeroEdital); setDataInicio(c.dataInicio); setDataTermino(c.dataTermino);
    setDuracaoMeses(c.duracaoMeses); setMunicipio(c.municipio); setEstado(c.estado);
    setStatusContrato(c.status); setMaoDeObra([...c.maoDeObra]); setEquipamentos([...c.equipamentos]);
    setCustoMateriaisMes(c.custoMateriaisMes); setComposicao({ ...c.composicaoBDI });
    setModoSimplificado(c.modoSimplificado); setBdiSimplificado(c.bdiSimplificado);
    setValorEdital(c.valorEdital);
    setActiveTab("contrato");
    toast.success("Contrato carregado");
  };

  // Export
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Campo: "Nome", Valor: nome }, { Campo: "Contratante", Valor: contratante },
      { Campo: "Tipo", Valor: tipoContrato }, { Campo: "Edital", Valor: numeroEdital },
      { Campo: "Início", Valor: dataInicio }, { Campo: "Término", Valor: dataTermino },
      { Campo: "Duração (meses)", Valor: duracaoMeses }, { Campo: "Município", Valor: municipio },
      { Campo: "Estado", Valor: estado }, { Campo: "Status", Valor: statusContrato },
    ]), "Dados do Contrato");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      maoDeObra.map(c => ({ Cargo: c.cargo, Qtde: c.quantidade, "Salário (R$)": c.salarioMensal, "Encargos (%)": c.encargosPercent, "Custo/Mês (R$)": calcularCustoCargo(c) }))
    ), "Mão de Obra");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      equipamentos.map(e => ({ Equipamento: e.equipamento, Qtde: e.quantidade, Tipo: e.proprioOuAlugado, "Custo/Mês (R$)": e.custoMensal, "Horas/Mês": e.horasMes }))
    ), "Equipamentos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Item: "Custo Mão de Obra/Mês", Valor: custoMaoObraMes },
      { Item: "Custo Equipamentos/Mês", Valor: custoEquipamentosMes },
      { Item: "Custo Materiais/Mês", Valor: custoMateriaisMes },
      { Item: "Custo Direto/Mês", Valor: custoDiretoMes },
      { Item: "Duração (meses)", Valor: duracaoMeses },
      { Item: "Custo Direto Total", Valor: custoDiretoTotal },
      { Item: "BDI (%)", Valor: bdiPercentual },
      { Item: "Valor BDI", Valor: bdiValor },
      { Item: "Preço de Venda", Valor: precoVenda },
      { Item: "Valor do Edital", Valor: valorEdital },
    ]), "Resumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      cenarios.map(c => ({ Cenário: c.nome, "BDI (%)": c.bdiPercent, "Preço Venda (R$)": c.precoVenda, "Margem (R$)": c.margemVsEdital, "Margem (%)": c.margemPercent, Status: c.status }))
    ), "Cenários");
    XLSX.writeFile(wb, `BDI_${nome || 'contrato'}.xlsx`);
    toast.success("Excel exportado!");
  };

  const exportCSV = () => {
    const lines = ["Item;Descrição;Valor"];
    lines.push(`Contrato;${nome};`);
    lines.push(`Custo Direto Total;;${custoDiretoTotal}`);
    lines.push(`BDI (%);;${bdiPercentual}`);
    lines.push(`Preço de Venda;;${precoVenda}`);
    lines.push(`Valor Edital;;${valorEdital}`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `BDI_${nome || 'contrato'}.csv`; a.click();
    toast.success("CSV exportado!");
  };

  // Pie chart data
  const pieData = useMemo(() => {
    if (precoVenda <= 0) return [];
    return [
      { name: "Mão de Obra", value: custoMaoObraMes * duracaoMeses },
      { name: "Equipamentos", value: custoEquipamentosMes * duracaoMeses },
      { name: "Materiais", value: custoMateriaisMes * duracaoMeses },
      { name: "BDI", value: bdiValor },
    ].filter(d => d.value > 0);
  }, [custoMaoObraMes, custoEquipamentosMes, custoMateriaisMes, duracaoMeses, bdiValor, precoVenda]);

  // Scenarios chart data
  const scenarioChartData = useMemo(() =>
    cenarios.map(c => ({ ...c, edital: valorEdital })),
    [cenarios, valorEdital]
  );

  const composicaoBDIItems = [
    { key: "administracaoCentral", label: "Administração Central (AC)" },
    { key: "seguroGarantia", label: "Seguro e Garantia (SG)" },
    { key: "risco", label: "Risco (R)" },
    { key: "despesasFinanceiras", label: "Despesas Financeiras (DF)" },
    { key: "lucro", label: "Lucro (L)" },
    { key: "pis", label: "PIS" },
    { key: "cofins", label: "COFINS" },
    { key: "iss", label: "ISS" },
    { key: "cprb", label: "CPRB" },
    { key: "irpj", label: "IRPJ (estimativa)" },
    { key: "csll", label: "CSLL (estimativa)" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="h-6 w-6 text-green-600" />
            BDI — Benefícios e Despesas Indiretas
          </CardTitle>
          <CardDescription>Cadastre contratos, compose o BDI (Acórdão TCU 2622/2013), simule cenários e analise viabilidade.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={loadDemo}>🎯 Carregar Demo</Button>
            <Button variant="outline" onClick={saveContrato}><FileText className="h-4 w-4 mr-1" /> Salvar Contrato</Button>
            <Button variant="outline" onClick={exportExcel} className="text-green-700"><Download className="h-4 w-4 mr-1" /> Excel</Button>
            <Button variant="outline" onClick={exportCSV} className="text-orange-700"><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Button variant="outline" onClick={() => window.print()} className="text-gray-700"><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="contrato">📋 Contrato</TabsTrigger>
          <TabsTrigger value="equipes">👷 Equipes</TabsTrigger>
          <TabsTrigger value="orcamento">💰 Orçamento</TabsTrigger>
          <TabsTrigger value="bdi">📊 BDI</TabsTrigger>
          <TabsTrigger value="venda">🏷️ Preço de Venda</TabsTrigger>
          <TabsTrigger value="viabilidade">✅ Viabilidade</TabsTrigger>
          <TabsTrigger value="cenarios">🔮 Cenários</TabsTrigger>
          <TabsTrigger value="historico">📁 Histórico</TabsTrigger>
        </TabsList>

        {/* TAB 1: Contract Data */}
        <TabsContent value="contrato">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader>
              <CardTitle>Dados do Contrato</CardTitle>
              <CardDescription>Preencha as informações básicas do contrato com a concessionária</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Nome do Contrato</Label>
                  <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Itapetininga - Assentamento Rede Água/Esgoto" />
                </div>
                <div>
                  <Label>Contratante/Concessionária</Label>
                  <Input value={contratante} onChange={e => setContratante(e.target.value)} placeholder="Ex: SABESP, SAAE, DAE" />
                </div>
                <div>
                  <Label>Tipo de Contrato</Label>
                  <Select value={tipoContrato} onValueChange={v => setTipoContrato(v as TipoContrato)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.values(TipoContrato).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nº do Edital/Contrato</Label>
                  <Input value={numeroEdital} onChange={e => setNumeroEdital(e.target.value)} placeholder="PE-2025/0142" />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={statusContrato} onValueChange={v => setStatusContrato(v as StatusContrato)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.values(StatusContrato).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data de Início</Label>
                  <Input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); calcDuration(e.target.value, dataTermino); }} />
                </div>
                <div>
                  <Label>Data de Término Previsto</Label>
                  <Input type="date" value={dataTermino} onChange={e => { setDataTermino(e.target.value); calcDuration(dataInicio, e.target.value); }} />
                </div>
                <div>
                  <Label>Duração (meses)</Label>
                  <Input type="number" min={1} value={duracaoMeses} onChange={e => setDuracaoMeses(+e.target.value)} />
                </div>
                <div>
                  <Label>Município</Label>
                  <Input value={municipio} onChange={e => setMunicipio(e.target.value)} placeholder="Itapetininga" />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Select value={estado} onValueChange={setEstado}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Teams */}
        <TabsContent value="equipes">
          <div className="space-y-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><Users className="h-5 w-5" /> Mão de Obra ({maoDeObra.length})</span>
                  <Button size="sm" onClick={addCargo}><Plus className="h-3 w-3 mr-1" /> Adicionar Cargo</Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Cargo/Função</TableHead>
                      <TableHead className="w-20">Qtde</TableHead>
                      <TableHead className="w-32">Salário (R$)</TableHead>
                      <TableHead className="w-24">Encargos (%)</TableHead>
                      <TableHead className="w-36 text-right">Custo Total/Mês</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {maoDeObra.map((c, i) => (
                        <TableRow key={c.id}>
                          <TableCell><Input className="h-8 text-xs" value={c.cargo} onChange={e => updateCargo(i, "cargo", e.target.value)} placeholder="Cargo" /></TableCell>
                          <TableCell><Input className="h-8 w-16 text-xs" type="number" min={1} value={c.quantidade} onChange={e => updateCargo(i, "quantidade", +e.target.value)} /></TableCell>
                          <TableCell><Input className="h-8 text-xs" type="number" step="100" value={c.salarioMensal} onChange={e => updateCargo(i, "salarioMensal", +e.target.value)} /></TableCell>
                          <TableCell><Input className="h-8 w-20 text-xs" type="number" step="0.01" value={c.encargosPercent} onChange={e => updateCargo(i, "encargosPercent", +e.target.value)} /></TableCell>
                          <TableCell className="text-right font-medium text-xs">{fmtBRL(calcularCustoCargo(c))}</TableCell>
                          <TableCell><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeCargo(i)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 flex justify-between items-center bg-muted/50 rounded-lg p-3">
                  <span className="text-sm font-medium">Subtotal Mão de Obra/Mês</span>
                  <span className="text-lg font-bold text-blue-600">{fmtBRL(custoMaoObraMes)}</span>
                </div>
                <div className="mt-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-800 dark:text-yellow-200"><Info className="h-3 w-3 inline mr-1" />
                    Os encargos sociais incluem: INSS, FGTS, 13º salário, férias, aviso prévio, multa FGTS, etc. O valor padrão de 73,33% é referência para obras de construção civil (desonerado).</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Equipamentos ({equipamentos.length})</span>
                  <Button size="sm" onClick={addEquipamento}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Equipamento</TableHead>
                      <TableHead className="w-16">Qtde</TableHead>
                      <TableHead className="w-28">Próprio/Alugado</TableHead>
                      <TableHead className="w-32">Custo Mensal (R$)</TableHead>
                      <TableHead className="w-24">Horas/Mês</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {equipamentos.map((e, i) => (
                        <TableRow key={e.id}>
                          <TableCell><Input className="h-8 text-xs" value={e.equipamento} onChange={ev => updateEquipamento(i, "equipamento", ev.target.value)} /></TableCell>
                          <TableCell><Input className="h-8 w-14 text-xs" type="number" min={1} value={e.quantidade} onChange={ev => updateEquipamento(i, "quantidade", +ev.target.value)} /></TableCell>
                          <TableCell>
                            <Select value={e.proprioOuAlugado} onValueChange={v => updateEquipamento(i, "proprioOuAlugado", v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="Próprio">Próprio</SelectItem><SelectItem value="Alugado">Alugado</SelectItem></SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell><Input className="h-8 text-xs" type="number" value={e.custoMensal} onChange={ev => updateEquipamento(i, "custoMensal", +ev.target.value)} /></TableCell>
                          <TableCell><Input className="h-8 w-20 text-xs" type="number" value={e.horasMes} onChange={ev => updateEquipamento(i, "horasMes", +ev.target.value)} /></TableCell>
                          <TableCell><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeEquipamento(i)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 flex justify-between items-center bg-muted/50 rounded-lg p-3">
                  <span className="text-sm font-medium">Subtotal Equipamentos/Mês</span>
                  <span className="text-lg font-bold text-purple-600">{fmtBRL(custoEquipamentosMes)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <CardTitle>Materiais Estimados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch checked={usarOrcamento} onCheckedChange={setUsarOrcamento} />
                  <Label>Usar Orçamento da Plataforma</Label>
                </div>
                {usarOrcamento ? (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-muted-foreground">Integração com módulo de Orçamento — em desenvolvimento</p>
                  </div>
                ) : (
                  <div>
                    <Label>Custo Estimado de Materiais/Mês (R$)</Label>
                    <Input type="number" step="1000" value={custoMateriaisMes} onChange={e => setCustoMateriaisMes(+e.target.value)} className="text-right" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: Budget Summary */}
        <TabsContent value="orcamento">
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader>
              <CardTitle>Resumo do Orçamento do Contrato</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Custo Mão de Obra/Mês", value: custoMaoObraMes, color: "text-blue-600", border: "border-blue-500" },
                  { label: "Custo Equipamentos/Mês", value: custoEquipamentosMes, color: "text-purple-600", border: "border-purple-500" },
                  { label: "Custo Materiais/Mês", value: custoMateriaisMes, color: "text-orange-600", border: "border-orange-500" },
                  { label: "Custo Direto Total/Mês", value: custoDiretoMes, color: "text-green-600", border: "border-green-500" },
                  { label: "Duração do Contrato", value: `${duracaoMeses} meses`, color: "text-teal-600", border: "border-teal-500", raw: true },
                  { label: "Custo Direto Total", value: custoDiretoTotal, color: "text-red-600", border: "border-red-500" },
                ].map((item, i) => (
                  <Card key={i} className={`border-l-4 ${item.border}`}>
                    <CardContent className="pt-4 pb-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                      <p className={`text-xl font-bold ${item.color}`}>
                        {item.raw ? item.value : fmtBRL(item.value as number)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: BDI Composition */}
        <TabsContent value="bdi">
          <div className="space-y-4">
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle>Composição do BDI</CardTitle>
                <CardDescription>O BDI (Benefícios e Despesas Indiretas) é o percentual aplicado sobre o custo direto para formar o preço de venda.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch checked={modoSimplificado} onCheckedChange={setModoSimplificado} />
                  <Label>Modo Simplificado</Label>
                </div>

                {modoSimplificado ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Percentual de BDI Desejado: {bdiSimplificado}%</Label>
                      <Slider value={[bdiSimplificado]} onValueChange={v => setBdiSimplificado(v[0])} min={5} max={40} step={0.5} className="mt-2" />
                    </div>
                    <Input type="number" step="0.5" value={bdiSimplificado} onChange={e => setBdiSimplificado(+e.target.value)} className="w-32" />
                    <p className="text-xs text-muted-foreground">No modo simplificado, o BDI é aplicado como um percentual único sobre o custo direto total.</p>
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Componente</TableHead>
                        <TableHead className="w-28">Percentual (%)</TableHead>
                        <TableHead className="w-36 text-right">Valor (R$)</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {composicaoBDIItems.map(item => (
                          <TableRow key={item.key}>
                            <TableCell className="text-sm">{item.label}</TableCell>
                            <TableCell>
                              <Input className="h-8 w-24 text-xs" type="number" step="0.01"
                                value={composicao[item.key as keyof ComposicaoBDI]}
                                onChange={e => updateComposicao(item.key as keyof ComposicaoBDI, +e.target.value)} />
                            </TableCell>
                            <TableCell className="text-right text-sm">{fmtBRL(custoDiretoTotal * (composicao[item.key as keyof ComposicaoBDI] / 100))}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-muted/50">
                          <TableCell>BDI TOTAL</TableCell>
                          <TableCell className="text-green-600 text-lg">{fmtPct(bdiPercentual)}</TableCell>
                          <TableCell className="text-right text-green-600">{fmtBRL(bdiValor)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}

                <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-2">📐 Fórmula TCU (Acórdão 2622/2013):</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-mono">BDI = [(1+AC+SG+R+DF) × (1+L) × (1+I)] - 1</p>
                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 space-y-0.5">
                      <p><strong>Obras de Saneamento:</strong> 20,34% a 25,00%</p>
                      <p><strong>Fornecimento:</strong> 11,10% a 14,02%</p>
                      <p><strong>Serviços:</strong> 16,80% a 20,97%</p>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 5: Sale Price */}
        <TabsContent value="venda">
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-white to-green-50 dark:from-card dark:to-green-950/10">
            <CardHeader>
              <CardTitle>Preço de Venda do Contrato</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-xs text-muted-foreground">Custo Direto Total</p>
                    <p className="text-xl font-bold">{fmtBRL(custoDiretoTotal)}</p>
                  </CardContent>
                </Card>
                <Card className="border-green-300">
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-xs text-muted-foreground">BDI</p>
                    <p className="text-xl font-bold text-green-600">{fmtPct(bdiPercentual)}</p>
                    <p className="text-sm text-green-600">{fmtBRL(bdiValor)}</p>
                  </CardContent>
                </Card>
                <Card className="border-green-300">
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-xs text-muted-foreground">Valor do BDI</p>
                    <p className="text-xl font-bold text-green-600">{fmtBRL(bdiValor)}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-green-600 text-white">
                  <CardContent className="pt-6 pb-5 text-center">
                    <p className="text-sm opacity-80">PREÇO DE VENDA (TOTAL)</p>
                    <p className="text-3xl font-bold mt-1">{fmtBRL(precoVenda)}</p>
                  </CardContent>
                </Card>
                <Card className="border-teal-300">
                  <CardContent className="pt-6 pb-5 text-center">
                    <p className="text-xs text-muted-foreground">Preço de Venda/Mês</p>
                    <p className="text-2xl font-bold text-teal-600">{fmtBRL(precoVendaMes)}</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: Viability */}
        <TabsContent value="viabilidade">
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader>
              <CardTitle>Análise de Viabilidade — Orçado vs. Contrato</CardTitle>
              <CardDescription>Compare o preço de venda calculado com o valor do edital/contrato</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Valor do Contrato/Edital (R$)</Label>
                <Input type="number" step="10000" value={valorEdital || ""} onChange={e => setValorEdital(+e.target.value)} placeholder="Valor que a concessionária vai pagar" className="text-right max-w-md" />
              </div>

              {viabilidade && (
                <>
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Preço de Venda Calculado</TableHead>
                        <TableHead>Valor do Edital</TableHead>
                        <TableHead>Diferença</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">{fmtBRL(viabilidade.precoVendaCalculado)}</TableCell>
                          <TableCell>{fmtBRL(viabilidade.valorEdital)}</TableCell>
                          <TableCell className={viabilidade.diferenca >= 0 ? "text-green-600" : "text-red-600"}>
                            {fmtBRL(viabilidade.diferenca)} ({fmtPct(viabilidade.diferencaPercent)})
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              viabilidade.status === 'VIAVEL' ? 'bg-green-500 text-white' :
                              viabilidade.status === 'ATENCAO' ? 'bg-yellow-500 text-white' :
                              'bg-red-500 text-white'
                            }>
                              {viabilidade.status === 'VIAVEL' && <><CheckCircle className="h-3 w-3 mr-1" />VIÁVEL</>}
                              {viabilidade.status === 'ATENCAO' && <><AlertTriangle className="h-3 w-3 mr-1" />ATENÇÃO</>}
                              {viabilidade.status === 'INVIAVEL' && <><XCircle className="h-3 w-3 mr-1" />INVIÁVEL</>}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <Card className={`border-l-4 ${viabilidade.lucroRealPercent > 10 ? 'border-l-green-500' : viabilidade.lucroRealPercent > 5 ? 'border-l-yellow-500' : 'border-l-red-500'}`}>
                    <CardContent className="pt-4 pb-3">
                      <h4 className="text-sm font-semibold mb-2">Margem Real do Contrato</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Lucro Real</p>
                          <p className={`text-lg font-bold ${viabilidade.lucroReal >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtBRL(viabilidade.lucroReal)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Lucro Real (%)</p>
                          <p className={`text-lg font-bold ${viabilidade.lucroRealPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtPct(viabilidade.lucroRealPercent)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">BDI Real</p>
                          <p className="text-lg font-bold text-blue-600">{fmtPct(viabilidade.bdiReal)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 7: Scenarios */}
        <TabsContent value="cenarios">
          <div className="space-y-4">
            <Card className="border-l-4 border-l-teal-500">
              <CardHeader>
                <CardTitle>Simulador de Cenários</CardTitle>
                <CardDescription>Varie o BDI e veja o impacto no preço de venda e na margem</CardDescription>
              </CardHeader>
              <CardContent>
                {cenarios.length > 0 ? (
                  <>
                    <div className="overflow-auto mb-4">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Cenário</TableHead>
                          <TableHead>BDI (%)</TableHead>
                          <TableHead className="text-right">Preço de Venda</TableHead>
                          <TableHead className="text-right">Margem vs Edital</TableHead>
                          <TableHead>Margem (%)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {cenarios.map((c, i) => (
                            <TableRow key={i} className={c.bdiPercent === Math.round(bdiPercentual) ? "bg-green-50 dark:bg-green-950/20" : ""}>
                              <TableCell className="font-medium">{c.nome}</TableCell>
                              <TableCell>{fmtPct(c.bdiPercent)}</TableCell>
                              <TableCell className="text-right">{fmtBRL(c.precoVenda)}</TableCell>
                              <TableCell className={`text-right ${c.margemVsEdital >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtBRL(c.margemVsEdital)}</TableCell>
                              <TableCell>{fmtPct(c.margemPercent)}</TableCell>
                              <TableCell>
                                <Badge className={c.status === 'VIAVEL' ? 'bg-green-500 text-white' : c.status === 'ATENCAO' ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'} variant="default">
                                  {c.status === 'VIAVEL' ? 'Viável' : c.status === 'ATENCAO' ? 'Atenção' : 'Inviável'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Scenario chart */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Impacto do BDI no Preço de Venda</CardTitle></CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={scenarioChartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                              <YAxis yAxisId="left" tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} />
                              <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} />
                              <RechartsTooltip formatter={(v: number, name: string) => name === 'margemPercent' ? `${v.toFixed(1)}%` : fmtBRL(v)} />
                              <Bar yAxisId="left" dataKey="precoVenda" fill="#3b82f6" name="Preço Venda" />
                              <Line yAxisId="right" dataKey="margemPercent" stroke="#22c55e" strokeWidth={2} name="Margem %" />
                              {valorEdital > 0 && <ReferenceLine yAxisId="left" y={valorEdital} stroke="#ef4444" strokeDasharray="5 5" label="Edital" />}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Composição do Preço de Venda</CardTitle></CardHeader>
                        <CardContent>
                          {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                              <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                </Pie>
                                <RechartsTooltip formatter={(v: number) => fmtBRL(v)} />
                              </PieChart>
                            </ResponsiveContainer>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-12">Preencha os custos para ver o gráfico</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Preencha o custo direto total para gerar cenários</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 8: History */}
        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Contratos</CardTitle>
              <CardDescription>Contratos cadastrados e seus BDIs</CardDescription>
            </CardHeader>
            <CardContent>
              {contratos.length > 0 ? (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Contratante</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor (R$)</TableHead>
                      <TableHead>BDI</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {contratos.map(c => {
                        const bdi = c.modoSimplificado ? c.bdiSimplificado : calcularBDI_TCU(c.composicaoBDI);
                        const cdm = (c.maoDeObra?.reduce((s, x) => s + calcularCustoCargo(x), 0) || 0)
                          + (c.equipamentos?.reduce((s, x) => s + calcularCustoEquipamento(x), 0) || 0)
                          + (c.custoMateriaisMes || 0);
                        const total = calcularPrecoVenda(cdm * c.duracaoMeses, bdi);
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">{c.nome}</TableCell>
                            <TableCell>{c.contratante}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{c.tipoContrato}</Badge></TableCell>
                            <TableCell className="text-right">{fmtBRL(total)}</TableCell>
                            <TableCell>{fmtPct(bdi)}</TableCell>
                            <TableCell><Badge className={`${STATUS_COLORS[c.status] || 'bg-gray-500'} text-white text-xs`}>{c.status}</Badge></TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => loadContrato(c)}>Ver</Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteContrato(c.id)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum contrato salvo. Use "Salvar Contrato" para criar o primeiro.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
