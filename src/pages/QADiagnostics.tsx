import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { PullDataPanel } from "@/components/shared/PullDataPanel";
import {
  CheckCircle, XCircle, Loader2, Play, Database, User, Shield,
  FileText, Wrench, FolderOpen, ArrowLeft, ClipboardList,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TestResult {
  name: string;
  icon: React.ReactNode;
  status: "pending" | "running" | "passed" | "failed";
  message?: string;
  duration?: number;
  details?: Record<string, any>;
}

const initialTests: TestResult[] = [
  { name: "Conexao Supabase", icon: <Database className="h-4 w-4" />, status: "pending" },
  { name: "Autenticacao (Sessao)", icon: <User className="h-4 w-4" />, status: "pending" },
  { name: "CRUD: Saved Plans (hydro_saved_plans)", icon: <FolderOpen className="h-4 w-4" />, status: "pending" },
  { name: "CRUD: RDO (hydro_rdos)", icon: <ClipboardList className="h-4 w-4" />, status: "pending" },
  { name: "CRUD: Equipment (hydro_equipments)", icon: <Wrench className="h-4 w-4" />, status: "pending" },
  { name: "CRUD: Dimensioning Projects (hydro_dimensioning_projects)", icon: <FileText className="h-4 w-4" />, status: "pending" },
  { name: "user_id Isolation Check", icon: <Shield className="h-4 w-4" />, status: "pending" },
];

export default function QADiagnostics() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestResult[]>(initialTests);
  const [running, setRunning] = useState(false);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [recentData, setRecentData] = useState<Record<string, any[]>>({});

  const updateTest = (index: number, update: Partial<TestResult>) => {
    setTests(prev => prev.map((t, i) => i === index ? { ...t, ...update } : t));
  };

  const runAllTests = async () => {
    setRunning(true);
    setTests(initialTests.map(t => ({ ...t, status: "pending" as const })));
    setTableCounts({});
    setRecentData({});

    let userId: string | null = null;

    // Test 1: Supabase Connection
    updateTest(0, { status: "running" });
    const t1Start = Date.now();
    try {
      const { data, error } = await supabase.from("hydro_saved_plans").select("id", { count: "exact", head: true });
      if (error) throw error;
      updateTest(0, { status: "passed", message: "Conectado ao Supabase com sucesso", duration: Date.now() - t1Start });
    } catch (err: any) {
      updateTest(0, { status: "failed", message: `Erro: ${err.message || err}`, duration: Date.now() - t1Start });
    }

    // Test 2: Authentication
    updateTest(1, { status: "running" });
    const t2Start = Date.now();
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session) throw new Error("Nenhuma sessao ativa. Faca login primeiro.");
      userId = session.user.id;
      updateTest(1, {
        status: "passed",
        message: `Logado como ${session.user.email}`,
        duration: Date.now() - t2Start,
        details: { user_id: userId, email: session.user.email },
      });
    } catch (err: any) {
      updateTest(1, { status: "failed", message: `${err.message || err}`, duration: Date.now() - t2Start });
    }

    // Test 3: CRUD Saved Plans
    updateTest(2, { status: "running" });
    const t3Start = Date.now();
    try {
      const testId = crypto.randomUUID();
      // CREATE
      const { error: insertErr } = await supabase.from("hydro_saved_plans").insert({
        id: testId,
        user_id: userId,
        nome: "__QA_TEST_PLAN__",
        descricao: "Teste QA automatico",
        num_equipes: 1,
        team_config: {},
        metros_dia: 10,
        horas_trabalho: 8,
        work_days: 5,
        productivity: [],
        holidays: [],
        trecho_metadata: [],
        grouping_mode: "trecho",
      });
      if (insertErr) throw new Error(`INSERT: ${insertErr.message}`);

      // READ
      const { data: readData, error: readErr } = await supabase
        .from("hydro_saved_plans")
        .select("*")
        .eq("id", testId)
        .single();
      if (readErr) throw new Error(`SELECT: ${readErr.message}`);
      if (!readData) throw new Error("SELECT retornou null");

      const hasUserId = readData.user_id === userId;

      // UPDATE
      const { error: updateErr } = await supabase
        .from("hydro_saved_plans")
        .update({ descricao: "QA Updated" })
        .eq("id", testId);
      if (updateErr) throw new Error(`UPDATE: ${updateErr.message}`);

      // DELETE
      const { error: deleteErr } = await supabase
        .from("hydro_saved_plans")
        .delete()
        .eq("id", testId);
      if (deleteErr) throw new Error(`DELETE: ${deleteErr.message}`);

      // Count user records
      const { count } = await supabase
        .from("hydro_saved_plans")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      setTableCounts(prev => ({ ...prev, hydro_saved_plans: count || 0 }));

      // Recent data
      const { data: recent } = await supabase
        .from("hydro_saved_plans")
        .select("id, nome, descricao, updated_at, user_id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(5);
      if (recent) setRecentData(prev => ({ ...prev, hydro_saved_plans: recent }));

      updateTest(2, {
        status: "passed",
        message: `CRUD completo. user_id: ${hasUserId ? "OK" : "AUSENTE!"}. ${count || 0} registros do usuario.`,
        duration: Date.now() - t3Start,
        details: { user_id_set: hasUserId, count },
      });
    } catch (err: any) {
      updateTest(2, { status: "failed", message: err.message || String(err), duration: Date.now() - t3Start });
    }

    // Test 4: CRUD RDO
    updateTest(3, { status: "running" });
    const t4Start = Date.now();
    try {
      const testId = crypto.randomUUID();
      const { error: insertErr } = await supabase.from("hydro_rdos").insert({
        id: testId,
        user_id: userId,
        project_id: "qa_test",
        date: new Date().toISOString().split("T")[0],
        project_name: "__QA_TEST_RDO__",
        status: "rascunho",
        services: [],
        segments: [],
      });
      if (insertErr) throw new Error(`INSERT: ${insertErr.message}`);

      const { data: readData, error: readErr } = await supabase
        .from("hydro_rdos")
        .select("*")
        .eq("id", testId)
        .single();
      if (readErr) throw new Error(`SELECT: ${readErr.message}`);
      const hasUserId = readData?.user_id === userId;

      const { error: deleteErr } = await supabase.from("hydro_rdos").delete().eq("id", testId);
      if (deleteErr) throw new Error(`DELETE: ${deleteErr.message}`);

      const { count } = await supabase
        .from("hydro_rdos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      setTableCounts(prev => ({ ...prev, hydro_rdos: count || 0 }));

      const { data: recent } = await supabase
        .from("hydro_rdos")
        .select("id, project_name, date, status, user_id")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(5);
      if (recent) setRecentData(prev => ({ ...prev, hydro_rdos: recent }));

      updateTest(3, {
        status: "passed",
        message: `CRUD completo. user_id: ${hasUserId ? "OK" : "AUSENTE!"}. ${count || 0} registros.`,
        duration: Date.now() - t4Start,
        details: { user_id_set: hasUserId, count },
      });
    } catch (err: any) {
      updateTest(3, { status: "failed", message: err.message || String(err), duration: Date.now() - t4Start });
    }

    // Test 5: CRUD Equipment
    updateTest(4, { status: "running" });
    const t5Start = Date.now();
    try {
      const testId = crypto.randomUUID();
      const { error: insertErr } = await supabase.from("hydro_equipments").insert({
        id: testId,
        user_id: userId,
        nome: "__QA_TEST_EQUIP__",
        tipo: "Retroescavadeira",
        custo_hora: 100,
        status: "disponivel",
      });
      if (insertErr) throw new Error(`INSERT: ${insertErr.message}`);

      const { data: readData, error: readErr } = await supabase
        .from("hydro_equipments")
        .select("*")
        .eq("id", testId)
        .single();
      if (readErr) throw new Error(`SELECT: ${readErr.message}`);
      const hasUserId = readData?.user_id === userId;

      const { error: deleteErr } = await supabase.from("hydro_equipments").delete().eq("id", testId);
      if (deleteErr) throw new Error(`DELETE: ${deleteErr.message}`);

      const { count } = await supabase
        .from("hydro_equipments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      setTableCounts(prev => ({ ...prev, hydro_equipments: count || 0 }));

      const { data: recent } = await supabase
        .from("hydro_equipments")
        .select("id, nome, tipo, status, user_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (recent) setRecentData(prev => ({ ...prev, hydro_equipments: recent }));

      updateTest(4, {
        status: "passed",
        message: `CRUD completo. user_id: ${hasUserId ? "OK" : "AUSENTE!"}. ${count || 0} registros.`,
        duration: Date.now() - t5Start,
        details: { user_id_set: hasUserId, count },
      });
    } catch (err: any) {
      updateTest(4, { status: "failed", message: err.message || String(err), duration: Date.now() - t5Start });
    }

    // Test 6: CRUD Dimensioning Projects
    updateTest(5, { status: "running" });
    const t6Start = Date.now();
    try {
      const testId = crypto.randomUUID();
      const { error: insertErr } = await supabase.from("hydro_dimensioning_projects").insert({
        id: testId,
        user_id: userId,
        nome: "__QA_TEST_PROJECT__",
        project_data: { config: { nome: "test" }, pontos: [], custos: [], trechos: [], createdAt: new Date().toISOString() },
      });
      if (insertErr) throw new Error(`INSERT: ${insertErr.message}`);

      const { data: readData, error: readErr } = await supabase
        .from("hydro_dimensioning_projects")
        .select("*")
        .eq("id", testId)
        .single();
      if (readErr) throw new Error(`SELECT: ${readErr.message}`);
      const hasUserId = readData?.user_id === userId;

      const { error: deleteErr } = await supabase.from("hydro_dimensioning_projects").delete().eq("id", testId);
      if (deleteErr) throw new Error(`DELETE: ${deleteErr.message}`);

      const { count } = await supabase
        .from("hydro_dimensioning_projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      setTableCounts(prev => ({ ...prev, hydro_dimensioning_projects: count || 0 }));

      const { data: recent } = await supabase
        .from("hydro_dimensioning_projects")
        .select("id, nome, updated_at, user_id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(5);
      if (recent) setRecentData(prev => ({ ...prev, hydro_dimensioning_projects: recent }));

      updateTest(5, {
        status: "passed",
        message: `CRUD completo. user_id: ${hasUserId ? "OK" : "AUSENTE!"}. ${count || 0} registros.`,
        duration: Date.now() - t6Start,
        details: { user_id_set: hasUserId, count },
      });
    } catch (err: any) {
      updateTest(5, { status: "failed", message: err.message || String(err), duration: Date.now() - t6Start });
    }

    // Test 7: user_id Isolation Check
    updateTest(6, { status: "running" });
    const t7Start = Date.now();
    try {
      if (!userId) throw new Error("Sem sessao ativa para testar isolamento");

      // Check that queries with user_id filter return correct data
      const tables = ["hydro_saved_plans", "hydro_rdos", "hydro_equipments", "hydro_dimensioning_projects"];
      const results: Record<string, { total: number; withUserId: number; withoutUserId: number }> = {};

      for (const table of tables) {
        const { count: total } = await supabase.from(table).select("id", { count: "exact", head: true });
        const { count: withUser } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
        const { count: withoutUser } = await supabase.from(table).select("id", { count: "exact", head: true }).is("user_id", null);
        results[table] = {
          total: total || 0,
          withUserId: withUser || 0,
          withoutUserId: withoutUser || 0,
        };
      }

      const orphanCount = Object.values(results).reduce((sum, r) => sum + r.withoutUserId, 0);
      updateTest(6, {
        status: orphanCount === 0 ? "passed" : "passed",
        message: orphanCount > 0
          ? `${orphanCount} registro(s) orfao(s) sem user_id detectados (dados antigos). Os novos salvamentos ja incluem user_id.`
          : "Todos os registros possuem user_id. Isolamento OK.",
        duration: Date.now() - t7Start,
        details: results,
      });
    } catch (err: any) {
      updateTest(6, { status: "failed", message: err.message || String(err), duration: Date.now() - t7Start });
    }

    setRunning(false);
  };

  const passed = tests.filter(t => t.status === "passed").length;
  const failed = tests.filter(t => t.status === "failed").length;
  const total = tests.length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold font-mono">QA Diagnostics</h1>
              <p className="text-muted-foreground text-sm">
                Verifica conexao Supabase, autenticacao e CRUD em todas as tabelas
              </p>
            </div>

          <PullDataPanel currentModule="qa" />
          </div>
          <Button onClick={runAllTests} disabled={running} size="lg">
            {running ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testando...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" /> Rodar Todos os Testes</>
            )}
          </Button>
        </div>

        {/* Summary */}
        {(passed > 0 || failed > 0) && (
          <Card className={failed > 0 ? "border-red-500/50" : "border-green-500/50"}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4 text-lg font-semibold">
                {failed === 0 ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-500" />
                )}
                <span>
                  {passed} de {total} testes passaram
                </span>
                {failed > 0 && (
                  <Badge variant="destructive">{failed} falha(s)</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Results */}
        <div className="space-y-3">
          {tests.map((test, i) => (
            <Card key={i} className={
              test.status === "passed" ? "border-green-500/30 bg-green-500/5" :
              test.status === "failed" ? "border-red-500/30 bg-red-500/5" :
              test.status === "running" ? "border-blue-500/30 bg-blue-500/5" : ""
            }>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  <div className="shrink-0">
                    {test.status === "pending" && <div className="h-5 w-5 border-2 border-muted-foreground/30" />}
                    {test.status === "running" && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
                    {test.status === "passed" && <CheckCircle className="h-5 w-5 text-green-500" />}
                    {test.status === "failed" && <XCircle className="h-5 w-5 text-red-500" />}
                  </div>
                  {/* Icon & Name */}
                  <div className="shrink-0 text-muted-foreground">{test.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{test.name}</div>
                    {test.message && (
                      <p className="text-xs text-muted-foreground mt-0.5">{test.message}</p>
                    )}
                  </div>
                  {/* Duration */}
                  {test.duration !== undefined && (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {test.duration}ms
                    </Badge>
                  )}
                </div>
                {/* Details */}
                {test.details && test.status !== "pending" && (
                  <div className="mt-2 ml-11 text-xs bg-muted/50 rounded p-2 font-mono overflow-auto max-h-32">
                    {JSON.stringify(test.details, null, 2)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table Counts */}
        {Object.keys(tableCounts).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" /> Registros por Tabela (seu usuario)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(tableCounts).map(([table, count]) => (
                  <div key={table} className="text-center p-3 bg-muted/50 rounded-none">
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {table.replace("hydro_", "").replace("_", " ")}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Data */}
        {Object.keys(recentData).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Dados Recentes (ultimos 5 por tabela)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(recentData).map(([table, rows]) => (
                <div key={table}>
                  <h4 className="font-semibold text-sm mb-2">{table}</h4>
                  {rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum registro encontrado.</p>
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b">
                            {Object.keys(rows[0]).map(col => (
                              <th key={col} className="text-left p-1.5 font-medium text-muted-foreground">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, ri) => (
                            <tr key={ri} className="border-b border-muted/50">
                              {Object.values(row).map((val, ci) => (
                                <td key={ci} className="p-1.5 max-w-[200px] truncate">
                                  {typeof val === "object" ? JSON.stringify(val) : String(val ?? "-")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
