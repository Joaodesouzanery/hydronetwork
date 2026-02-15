import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardMetrics } from "@/engine/rdo";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend
} from "recharts";

interface RDODashboardViewProps {
  metrics: DashboardMetrics;
  rdoCount: number;
}

const fmt = (n: number, d = 1) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtCurrency = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const RDODashboardView = ({ metrics, rdoCount }: RDODashboardViewProps) => {
  // Mock data for donut chart (based on metrics)
  const totalTrechos = 40;
  const concluido = Math.round(metrics.progressPercent * totalTrechos / 100);
  const emExecucao = Math.round((totalTrechos - concluido) * 0.4);
  const naoIniciado = totalTrechos - concluido - emExecucao;

  const donutData = [
    { name: "Concluído", value: Math.max(concluido, rdoCount > 0 ? 14 : 0), color: "#22c55e" },
    { name: "Em Execução", value: Math.max(emExecucao, rdoCount > 0 ? 10 : 0), color: "#f59e0b" },
    { name: "Não Iniciado", value: Math.max(naoIniciado, rdoCount > 0 ? 16 : 0), color: "#ef4444" },
  ];

  // EVM calculations (mock based on metrics or realistic defaults)
  const bac = 500000;
  const pvPercent = Math.max(metrics.progressPercent, 40);
  const pv = bac * pvPercent / 100;
  const ev = pv * 0.9;
  const ac = ev * 1.083;
  const spi = ev / pv;
  const cpi = ev / ac;
  const eac = bac / cpi;
  const vac = bac - eac;

  const evmRows = [
    { metric: "BAC (Budget at Completion)", value: fmtCurrency(bac) },
    { metric: "PV (Planned Value)", value: fmtCurrency(pv) },
    { metric: "EV (Earned Value)", value: fmtCurrency(ev) },
    { metric: "AC (Actual Cost)", value: fmtCurrency(ac) },
    { metric: "SPI (Schedule Performance Index)", value: spi.toFixed(2), badge: spi >= 1 ? "success" : "warning" },
    { metric: "CPI (Cost Performance Index)", value: cpi.toFixed(2), badge: cpi >= 1 ? "success" : "warning" },
    { metric: "EAC (Estimate at Completion)", value: fmtCurrency(eac) },
    { metric: "VAC (Variance at Completion)", value: fmtCurrency(vac), badge: vac >= 0 ? "success" : "destructive" },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Planejado", value: `${fmt(metrics.totalPlanned || 850, 0)}m`, color: "text-blue-600" },
          { label: "Total Executado", value: `${fmt(metrics.totalExecuted || 320, 0)}m`, color: "text-green-600" },
          { label: "Restante", value: `${fmt(metrics.remaining || 530, 0)}m`, color: "text-orange-600" },
          { label: "Progresso", value: `${fmt(metrics.progressPercent || 37.6)}%`, color: "text-purple-600" },
        ].map((c, i) => (
          <Card key={i}>
            <CardContent className="pt-4 text-center">
              <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
              {i === 3 && <Progress value={metrics.progressPercent || 37.6} className="mt-2" />}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress bars by system */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: "💧", label: "Água", data: metrics.aguaProgress, color: "#60a5fa", fallback: { planned: 400, executed: 180, percent: 45 } },
          { icon: "🚰", label: "Esgoto", data: metrics.esgotoProgress, color: "#22c55e", fallback: { planned: 250, executed: 130, percent: 52 } },
          { icon: "🌧️", label: "Drenagem", data: metrics.drenagemProgress, color: "#f59e0b", fallback: { planned: 200, executed: 30, percent: 15 } },
        ].map((sys, i) => {
          const data = sys.data.planned > 0 ? sys.data : sys.fallback;
          return (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{sys.icon}</span>
                  <span className="font-semibold">{sys.label}</span>
                  <span className="ml-auto text-sm font-bold">{fmt(data.percent)}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(data.percent, 100)}%`, backgroundColor: sys.color }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{fmt(data.executed, 0)}m / {fmt(data.planned, 0)}m</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Donut Chart */}
        <Card>
          <CardHeader><CardTitle>Status dos Trechos</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {donutData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-center text-sm text-muted-foreground">{totalTrechos} trechos totais</p>
          </CardContent>
        </Card>

        {/* EVM Table */}
        <Card>
          <CardHeader><CardTitle>📊 EVM - Earned Value Management</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Métrica</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evmRows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{row.metric}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.badge ? (
                        <Badge variant={row.badge === "success" ? "default" : "destructive"}>{row.value}</Badge>
                      ) : row.value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
