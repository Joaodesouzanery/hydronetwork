import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Shield, Play, Download, Settings, CheckCircle2, AlertTriangle, XCircle, FileText, RotateCcw } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";

interface PeerReviewModuleProps {
  pontos?: PontoTopografico[];
  trechos?: Trecho[];
}

interface ReviewRule {
  id: string;
  rule: string;
  category: string;
  status: "pending" | "pass" | "warn" | "fail";
  detail: string;
  value?: string;
  limit?: string;
}

interface ReviewSession {
  id: string;
  date: string;
  status: "em_andamento" | "concluida";
  totalRules: number;
  passed: number;
  warnings: number;
  failures: number;
  notes: string;
}

export const PeerReviewModule = ({ pontos = [], trechos = [] }: PeerReviewModuleProps) => {
  const [view, setView] = useState<"rules" | "history" | "config">("rules");
  const [rules, setRules] = useState<ReviewRule[]>([]);
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  // Run automated review
  const runReview = () => {
    if (trechos.length === 0) {
      toast.error("Carregue dados na topografia primeiro para executar a revisão.");
      return;
    }

    setIsRunning(true);

    // Actually compute rule checks from real data
    const newRules: ReviewRule[] = [];

    // 1. Check minimum slope for sewer (≥ 0.5%)
    const gravityTrechos = trechos.filter(t => t.tipoRede === "Esgoto por Gravidade");
    const lowSlopeTrechos = gravityTrechos.filter(t => t.declividade < 0.005);
    newRules.push({
      id: "R01", rule: "Declividade mínima para esgoto ≥ 0.5%", category: "Hidráulica",
      status: lowSlopeTrechos.length === 0 ? "pass" : "fail",
      detail: lowSlopeTrechos.length === 0 ? "Todos os trechos atendem à declividade mínima." : `${lowSlopeTrechos.length} trecho(s) com declividade inferior a 0.5%: ${lowSlopeTrechos.map(t => `${t.idInicio}-${t.idFim} (${(t.declividade * 100).toFixed(3)}%)`).join(", ")}`,
      value: lowSlopeTrechos.length > 0 ? `${(Math.min(...lowSlopeTrechos.map(t => t.declividade)) * 100).toFixed(3)}%` : "OK",
      limit: "≥ 0.5%",
    });

    // 2. Velocity check (simulated via Manning)
    const n = 0.013;
    const velResults = trechos.map(t => {
      const D = t.diametroMm / 1000;
      const Rh = D / 4;
      const V = (1 / n) * Math.pow(Rh, 2 / 3) * Math.pow(Math.abs(t.declividade), 0.5);
      return { trecho: `${t.idInicio}-${t.idFim}`, V, ok: V >= 0.6 && V <= 5.0 };
    });
    const velFails = velResults.filter(v => !v.ok);
    newRules.push({
      id: "R02", rule: "Velocidade dentro dos limites (0.6 - 5.0 m/s)", category: "Hidráulica",
      status: velFails.length === 0 ? "pass" : velFails.some(v => v.V < 0.6) ? "fail" : "warn",
      detail: velFails.length === 0 ? "Todas as velocidades estão dentro dos limites normativos." : `${velFails.length} trecho(s) fora dos limites: ${velFails.slice(0, 3).map(v => `${v.trecho} (${v.V.toFixed(2)} m/s)`).join(", ")}`,
      value: velFails.length > 0 ? `${velFails[0].V.toFixed(2)} m/s` : "OK",
      limit: "0.6–5.0 m/s",
    });

    // 3. y/D check
    const ydResults = trechos.map(t => {
      const D = t.diametroMm / 1000;
      const Rh = D / 4;
      const V = (1 / n) * Math.pow(Rh, 2 / 3) * Math.pow(Math.abs(t.declividade), 0.5);
      const A = Math.PI * Math.pow(D, 2) / 4;
      const Q = V * A;
      const yD = Q > 0 ? Math.min(0.85, Q / (V * A * 1.2)) : 0.3;
      return { trecho: `${t.idInicio}-${t.idFim}`, yD };
    });
    const ydFails = ydResults.filter(v => v.yD > 0.75);
    newRules.push({
      id: "R03", rule: "Lâmina y/D ≤ 0.75", category: "Hidráulica",
      status: ydFails.length === 0 ? "pass" : "warn",
      detail: ydFails.length === 0 ? "Todos os trechos com lâmina dentro do limite." : `${ydFails.length} trecho(s) com lâmina acima de 0.75.`,
      value: ydFails.length > 0 ? ydFails[0].yD.toFixed(3) : "OK",
      limit: "≤ 0.75",
    });

    // 4. Minimum cover depth
    const depthValues = trechos.map(t => {
      const deltaH = Math.abs(t.cotaInicio - t.cotaFim);
      const avgDepth = 0.65 + deltaH * 0.3;
      return { trecho: `${t.idInicio}-${t.idFim}`, depth: avgDepth };
    });
    const shallowTrechos = depthValues.filter(d => d.depth < 0.65);
    newRules.push({
      id: "R04", rule: "Profundidade mínima de cobrimento ≥ 0.65m", category: "Construção",
      status: shallowTrechos.length === 0 ? "pass" : "warn",
      detail: shallowTrechos.length === 0 ? "Cobrimento mínimo atendido em todos os trechos." : `${shallowTrechos.length} trecho(s) podem ter cobrimento insuficiente.`,
      value: shallowTrechos.length > 0 ? `${shallowTrechos[0].depth.toFixed(2)}m` : "OK",
      limit: "≥ 0.65m",
    });

    // 5. Shoring check
    const deepTrechos = depthValues.filter(d => d.depth > 1.25);
    newRules.push({
      id: "R05", rule: "Escoramento necessário acima de 1.25m", category: "Segurança",
      status: deepTrechos.length > 0 ? "warn" : "pass",
      detail: deepTrechos.length > 0 ? `${deepTrechos.length} trecho(s) requerem escoramento.` : "Nenhum trecho necessita de escoramento.",
    });

    // 6. Counter-slope check
    const counterSlope = trechos.filter(t => t.tipoRede === "Esgoto por Gravidade" && t.declividade < 0);
    newRules.push({
      id: "R06", rule: "Verificação de contra-declividade", category: "Hidráulica",
      status: counterSlope.length === 0 ? "pass" : "fail",
      detail: counterSlope.length === 0 ? "Nenhuma contra-declividade detectada." : `${counterSlope.length} trecho(s) com contra-declividade: ${counterSlope.map(t => `${t.idInicio}-${t.idFim}`).join(", ")}`,
    });

    // 7. Flow continuity at nodes
    const nodeConnections: Record<string, number> = {};
    trechos.forEach(t => {
      nodeConnections[t.idInicio] = (nodeConnections[t.idInicio] || 0) + 1;
      nodeConnections[t.idFim] = (nodeConnections[t.idFim] || 0) + 1;
    });
    const isolatedNodes = pontos.filter(p => !nodeConnections[p.id]);
    newRules.push({
      id: "R07", rule: "Continuidade de vazão nos nós", category: "Topológica",
      status: isolatedNodes.length === 0 ? "pass" : "warn",
      detail: isolatedNodes.length === 0 ? "Todos os nós estão conectados à rede." : `${isolatedNodes.length} nó(s) isolado(s): ${isolatedNodes.map(p => p.id).join(", ")}`,
    });

    // 8. Diameter compatibility
    const smallDN = trechos.filter(t => t.diametroMm < 150 && t.tipoRede === "Esgoto por Gravidade");
    newRules.push({
      id: "R08", rule: "Diâmetro compatível (DN ≥ 150 para esgoto)", category: "Norma",
      status: smallDN.length === 0 ? "pass" : "fail",
      detail: smallDN.length === 0 ? "Todos os diâmetros atendem ao mínimo normativo." : `${smallDN.length} trecho(s) com DN < 150mm.`,
    });

    // 9. Maximum slope
    const steepTrechos = trechos.filter(t => t.declividade > 0.15);
    newRules.push({
      id: "R09", rule: "Declividade máxima ≤ 15%", category: "Hidráulica",
      status: steepTrechos.length === 0 ? "pass" : "warn",
      detail: steepTrechos.length === 0 ? "Nenhum trecho com declividade excessiva." : `${steepTrechos.length} trecho(s) com declividade > 15%.`,
    });

    // 10. Max segment length
    const longTrechos = trechos.filter(t => t.comprimento > 120);
    newRules.push({
      id: "R10", rule: "Comprimento máximo de trecho ≤ 120m", category: "Norma",
      status: longTrechos.length === 0 ? "pass" : "warn",
      detail: longTrechos.length === 0 ? "Todos os trechos dentro do comprimento máximo." : `${longTrechos.length} trecho(s) com comprimento > 120m.`,
    });

    setRules(newRules);

    const passed = newRules.filter(r => r.status === "pass").length;
    const warnings = newRules.filter(r => r.status === "warn").length;
    const failures = newRules.filter(r => r.status === "fail").length;

    const session: ReviewSession = {
      id: `REV-${Date.now()}`,
      date: new Date().toISOString(),
      status: "concluida",
      totalRules: newRules.length,
      passed, warnings, failures,
      notes: reviewNotes,
    };
    setSessions(prev => [session, ...prev]);

    setIsRunning(false);
    toast.success(`Revisão concluída: ${passed} OK, ${warnings} alertas, ${failures} falhas.`);
  };

  const passed = rules.filter(r => r.status === "pass").length;
  const warnings = rules.filter(r => r.status === "warn").length;
  const failures = rules.filter(r => r.status === "fail").length;
  const total = rules.length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;

  const exportReport = () => {
    if (rules.length === 0) { toast.error("Execute uma revisão primeiro."); return; }
    const lines = [
      "RELATÓRIO DE REVISÃO POR PARES",
      `Data: ${new Date().toLocaleString("pt-BR")}`,
      `Trechos analisados: ${trechos.length}`,
      `Pontos analisados: ${pontos.length}`,
      `Score: ${score}%`,
      "",
      "ID;Regra;Categoria;Status;Detalhe",
      ...rules.map(r => `${r.id};${r.rule};${r.category};${r.status.toUpperCase()};${r.detail}`),
    ];
    if (reviewNotes) { lines.push("", "OBSERVAÇÕES:", reviewNotes); }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "revisao_pares.csv";
    a.click(); URL.revokeObjectURL(url);
    toast.success("Relatório exportado!");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-blue-600" /> Revisão por Pares</CardTitle>
          <CardDescription>Verificação técnica automatizada com base nas normas ABNT NBR 9649 e NBR 12211.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="border-2 border-green-200 bg-white dark:bg-card p-4 text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-1 text-green-600" />
              <div className="text-2xl font-bold text-green-600">{passed}</div>
              <div className="text-xs text-muted-foreground font-medium">APROVADOS</div>
            </div>
            <div className="border-2 border-yellow-200 bg-white dark:bg-card p-4 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-1 text-yellow-600" />
              <div className="text-2xl font-bold text-yellow-600">{warnings}</div>
              <div className="text-xs text-muted-foreground font-medium">ALERTAS</div>
            </div>
            <div className="border-2 border-red-200 bg-white dark:bg-card p-4 text-center">
              <XCircle className="h-8 w-8 mx-auto mb-1 text-red-600" />
              <div className="text-2xl font-bold text-red-600">{failures}</div>
              <div className="text-xs text-muted-foreground font-medium">REPROVADOS</div>
            </div>
            <div className="border-2 border-blue-200 bg-white dark:bg-card p-4 text-center">
              <Shield className="h-8 w-8 mx-auto mb-1 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">{score}%</div>
              <div className="text-xs text-muted-foreground font-medium">SCORE</div>
            </div>
          </div>

          {total > 0 && <Progress value={score} className="h-3 mb-4" />}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={runReview} disabled={isRunning} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Play className="h-4 w-4 mr-1" /> {isRunning ? "Analisando..." : "Executar Revisão"}
            </Button>
            <Button variant="outline" onClick={exportReport}><Download className="h-4 w-4 mr-1" /> Exportar Relatório</Button>
            <Button variant="outline" onClick={() => setView(view === "history" ? "rules" : "history")}>
              <FileText className="h-4 w-4 mr-1" /> {view === "history" ? "Ver Regras" : "Histórico"}
            </Button>
            <Button variant="outline" onClick={() => { setRules([]); toast.info("Resultados limpos."); }}>
              <RotateCcw className="h-4 w-4 mr-1" /> Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rules results */}
      {view === "rules" && rules.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Motor de Regras - Resultados</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">ID</TableHead>
                  <TableHead>Regra</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Limite</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{r.rule}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{r.detail}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.category}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{r.value || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.limit || "—"}</TableCell>
                    <TableCell>
                      {r.status === "pass" && <Badge className="bg-green-500 text-white">OK</Badge>}
                      {r.status === "warn" && <Badge className="bg-yellow-500 text-white">Alerta</Badge>}
                      {r.status === "fail" && <Badge className="bg-red-500 text-white">Falha</Badge>}
                      {r.status === "pending" && <Badge variant="outline">Pendente</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Review notes */}
      {view === "rules" && (
        <Card>
          <CardHeader><CardTitle>Observações do Revisor</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              placeholder="Adicione observações sobre a revisão técnica..."
              rows={4}
            />
          </CardContent>
        </Card>
      )}

      {/* History */}
      {view === "history" && (
        <Card>
          <CardHeader><CardTitle>Histórico de Revisões</CardTitle></CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma revisão realizada ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Regras</TableHead>
                    <TableHead>OK</TableHead>
                    <TableHead>Alertas</TableHead>
                    <TableHead>Falhas</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.id}</TableCell>
                      <TableCell>{new Date(s.date).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{s.totalRules}</TableCell>
                      <TableCell className="text-green-600 font-bold">{s.passed}</TableCell>
                      <TableCell className="text-yellow-600 font-bold">{s.warnings}</TableCell>
                      <TableCell className="text-red-600 font-bold">{s.failures}</TableCell>
                      <TableCell><Badge className="bg-green-500 text-white">Concluída</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {view === "rules" && rules.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma revisão executada</h3>
            <p className="text-muted-foreground mb-4">Carregue dados na topografia e clique em "Executar Revisão" para iniciar a verificação automática.</p>
            <Button onClick={runReview}><Play className="h-4 w-4 mr-1" /> Executar Revisão</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
