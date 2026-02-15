import { useState, useMemo } from "react";
import {
  Link2, Ruler, DollarSign, BarChart3, AlertTriangle, Info,
  ArrowUpDown, Download, FileText, ArrowLeft, TrendingDown, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import {
  type ProjectData, calculateSummary, formatCurrency, formatNumber, generateAlerts,
} from "./planningUtils";
import { exportToExcel, exportToPDF } from "./planningExport";

interface ProjectResultsProps {
  project: ProjectData;
  onBack: () => void;
  onEdit: () => void;
}

const GRAVITY_COLOR = "#3B82F6";
const PUMP_COLOR = "#F97316";
const PAGE_SIZE = 20;

export function ProjectResults({ project, onBack, onEdit }: ProjectResultsProps) {
  const summary = useMemo(() => calculateSummary(project.trechos, project.pontos), [project]);
  const alerts = useMemo(() => generateAlerts(project.trechos), [project]);

  const [sortKey, setSortKey] = useState<string>("index");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Filtered & sorted trechos
  const filtered = useMemo(() => {
    let data = [...project.trechos];
    if (filterType !== "all") data = data.filter(t => t.tipo_rede === filterType);
    if (search) data = data.filter(t => t.id_inicio.toLowerCase().includes(search.toLowerCase()) || t.id_fim.toLowerCase().includes(search.toLowerCase()));
    data.sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return data;
  }, [project.trechos, filterType, search, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Pie chart data
  const pieData = [
    { name: "Gravidade", value: summary.gravityCount, color: GRAVITY_COLOR },
    { name: "Elevatória", value: summary.pumpCount, color: PUMP_COLOR },
  ].filter(d => d.value > 0);

  // Profile data
  const profileData = useMemo(() => {
    let dist = 0;
    return project.pontos.map((p, i) => {
      if (i > 0) {
        const prev = project.pontos[i - 1];
        dist += Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2);
      }
      return { id: p.id, distancia: parseFloat(dist.toFixed(2)), cota: p.cota };
    });
  }, [project.pontos]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{project.config.nome}</h2>
          <p className="text-sm text-muted-foreground">Processado em {new Date(project.createdAt).toLocaleString('pt-BR')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
          <Button variant="outline" size="sm" onClick={onEdit}>Editar Dados</Button>
          <Button variant="outline" size="sm" onClick={() => exportToExcel(project)}><Download className="h-4 w-4 mr-1" /> Excel</Button>
          <Button variant="outline" size="sm" onClick={() => exportToPDF(project)}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Link2 className="h-4 w-4" /><span className="text-xs">Total de Trechos</span></div>
          <p className="text-2xl font-bold">{summary.totalTrechos}</p>
          <p className="text-xs text-muted-foreground">segmentos calculados</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Ruler className="h-4 w-4" /><span className="text-xs">Comprimento Total</span></div>
          <p className="text-2xl font-bold">{formatNumber(summary.comprimentoTotal)}</p>
          <p className="text-xs text-muted-foreground">metros</p>
        </CardContent></Card>
        <Card className="border-green-500/30"><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-green-600 mb-1"><DollarSign className="h-4 w-4" /><span className="text-xs">Custo Total</span></div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.custoTotal)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><BarChart3 className="h-4 w-4" /><span className="text-xs">Custo Médio</span></div>
          <p className="text-2xl font-bold">{formatCurrency(summary.custoMedio)}</p>
          <p className="text-xs text-muted-foreground">por metro linear</p>
        </CardContent></Card>
      </div>

      {/* Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Tipo</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><TrendingDown className="h-4 w-4 text-blue-500" /> Esgoto por Gravidade</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-muted-foreground text-xs">Trechos</p><p className="font-medium">{summary.gravityCount}</p></div>
                <div><p className="text-muted-foreground text-xs">Comprimento</p><p className="font-medium">{formatNumber(summary.gravityLength)} m</p></div>
                <div><p className="text-muted-foreground text-xs">Custo</p><p className="font-medium">{formatCurrency(summary.gravityCost)}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-4">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-orange-500" /> Elevatória / Booster</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-muted-foreground text-xs">Trechos</p><p className="font-medium">{summary.pumpCount}</p></div>
                <div><p className="text-muted-foreground text-xs">Comprimento</p><p className="font-medium">{formatNumber(summary.pumpLength)} m</p></div>
                <div><p className="text-muted-foreground text-xs">Custo</p><p className="font-medium">{formatCurrency(summary.pumpCost)}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Decliv. Mínima", value: `${summary.declivMin}%` },
          { label: "Decliv. Máxima", value: `${summary.declivMax}%` },
          { label: "Decliv. Média", value: `${summary.declivMedia}%` },
          { label: "Desnível Total", value: `${formatNumber(summary.desnivelTotal)} m` },
        ].map(ind => (
          <Card key={ind.label}><CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-muted-foreground">{ind.label}</p>
            <p className="text-lg font-bold">{ind.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Perfil Topográfico */}
      <Card>
        <CardHeader><CardTitle className="text-base">Perfil Topográfico</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profileData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="distancia" label={{ value: 'Distância (m)', position: 'insideBottomRight', offset: -5 }} fontSize={11} />
                <YAxis domain={['auto', 'auto']} label={{ value: 'Cota (m)', angle: -90, position: 'insideLeft' }} fontSize={11} />
                <Tooltip formatter={(v: number) => [`${formatNumber(v)} m`, 'Cota']} labelFormatter={(l) => `Dist: ${l} m`} />
                <Line type="monotone" dataKey="cota" stroke={GRAVITY_COLOR} strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert, i) => (
            <Card key={i} className={alert.type === 'warning' ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-blue-500/50 bg-blue-500/5'}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2">
                  {alert.type === 'warning' ? <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" /> : <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-medium text-sm">{alert.message}</p>
                    {alert.trechos && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {alert.trechos.map((t, j) => <Badge key={j} variant="outline" className="text-xs">{t}</Badge>)}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabela de Trechos */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Tabela de Trechos</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="Buscar por ID..." className="w-40 h-8 text-sm" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(1); }}>
                <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="Esgoto por Gravidade">Gravidade</SelectItem>
                  <SelectItem value="Elevatória / Booster">Elevatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    { key: 'index', label: '#' },
                    { key: 'id_inicio', label: 'ID Início' },
                    { key: 'id_fim', label: 'ID Fim' },
                    { key: 'comprimento', label: 'Comp. (m)' },
                    { key: 'declividade_percentual', label: 'Decliv. (%)' },
                    { key: 'tipo_rede', label: 'Tipo' },
                    { key: 'diametro_mm', label: 'Ø (mm)' },
                    { key: 'material', label: 'Material' },
                    { key: 'custo_unitario', label: 'Custo Unit.' },
                    { key: 'custo_total', label: 'Custo Total' },
                  ].map(col => (
                    <TableHead key={col.key} className="cursor-pointer select-none text-xs" onClick={() => handleSort(col.key)}>
                      <span className="flex items-center gap-1">{col.label} {sortKey === col.key && <ArrowUpDown className="h-3 w-3" />}</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(t => (
                  <TableRow key={t.index} className="hover:bg-muted/50">
                    <TableCell className="text-xs">{t.index}</TableCell>
                    <TableCell className="text-xs font-mono">{t.id_inicio}</TableCell>
                    <TableCell className="text-xs font-mono">{t.id_fim}</TableCell>
                    <TableCell className="text-xs">{formatNumber(t.comprimento)}</TableCell>
                    <TableCell className="text-xs">{t.declividade_percentual}%</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${t.tipo_rede === 'Esgoto por Gravidade' ? 'border-blue-500 text-blue-600' : 'border-orange-500 text-orange-600'}`}>
                        {t.tipo_rede === 'Esgoto por Gravidade' ? 'Gravidade' : 'Elevatória'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{t.diametro_mm}</TableCell>
                    <TableCell className="text-xs">{t.material}</TableCell>
                    <TableCell className="text-xs">{formatCurrency(t.custo_unitario)}</TableCell>
                    <TableCell className="text-xs font-medium">{formatCurrency(t.custo_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">{filtered.length} resultado(s)</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <span className="text-sm px-2 py-1">{page}/{totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próximo</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
