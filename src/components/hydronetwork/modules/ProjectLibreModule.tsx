import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Upload, Download, Trash2, Calendar, ZoomIn, ZoomOut, Maximize, Package, RefreshCw, GitCompare, FileText, Edit } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";

interface Resource { name: string; type: string; qty: number; }
interface Task {
  id: string; name: string; duration: number; start: string; resource: string;
  predecessors: string; progress: number; color: string;
}

interface ProjectLibreModuleProps {
  pontos?: PontoTopografico[];
  trechos?: Trecho[];
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const diffDays = (a: string, b: string) => {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
};

export const ProjectLibreModule = ({ pontos = [], trechos = [] }: ProjectLibreModuleProps) => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [ganttView, setGanttView] = useState("day");
  const [tasks, setTasks] = useState<Task[]>([]);

  const addTask = () => {
    setTasks([...tasks, {
      id: `T${tasks.length + 1}`, name: "", duration: 1, start: startDate,
      resource: "", predecessors: "", progress: 0, color: COLORS[tasks.length % COLORS.length]
    }]);
  };

  const loadPlatformData = () => {
    if (trechos.length === 0) {
      toast.error("Carregue topografia primeiro.");
      return;
    }
    const newTasks: Task[] = [];
    let currentDate = startDate;
    const prodPerDay = 50;
    trechos.forEach((t, i) => {
      const dur = Math.max(1, Math.ceil(t.comprimento / prodPerDay));
      newTasks.push({
        id: `T${i + 1}`,
        name: `Trecho ${t.idInicio}-${t.idFim} (${t.comprimento.toFixed(1)}m)`,
        duration: dur, start: currentDate, resource: "",
        predecessors: i > 0 ? `T${i}` : "", progress: 0,
        color: COLORS[i % COLORS.length],
      });
      currentDate = addDays(currentDate, dur);
    });
    setTasks(newTasks);
    toast.success(`${newTasks.length} tarefas geradas.`);
  };

  const ganttData = useMemo(() => {
    if (tasks.length === 0) return null;
    const allDates = tasks.map(t => ({ start: new Date(t.start), end: new Date(addDays(t.start, t.duration)) }));
    const minDate = new Date(Math.min(...allDates.map(d => d.start.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.end.getTime())));
    const totalDays = Math.max(1, diffDays(minDate.toISOString().split("T")[0], maxDate.toISOString().split("T")[0]));
    const columns: string[] = [];
    const colDate = new Date(minDate);
    for (let i = 0; i <= totalDays; i++) {
      if (ganttView === "day") columns.push(`${colDate.getDate()}/${colDate.getMonth() + 1}`);
      else if (ganttView === "week") { if (i % 7 === 0) columns.push(`S${Math.floor(i / 7) + 1}`); }
      else { if (i === 0 || colDate.getDate() === 1) columns.push(colDate.toLocaleString("pt-BR", { month: "short" })); }
      colDate.setDate(colDate.getDate() + 1);
    }
    return {
      minDate: minDate.toISOString().split("T")[0], totalDays,
      columns: ganttView === "day" ? columns : columns.length > 0 ? columns : [""],
      tasks: tasks.map(t => {
        const offset = diffDays(minDate.toISOString().split("T")[0], t.start);
        return { ...t, offsetPct: (offset / totalDays) * 100, widthPct: (t.duration / totalDays) * 100 };
      }),
    };
  }, [tasks, ganttView]);

  const totalDuration = tasks.length > 0 ? tasks.reduce((sum, t) => Math.max(sum, diffDays(startDate, addDays(t.start, t.duration))), 0) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-pink-600" /> ProjectLibre</CardTitle>
          <CardDescription>Gerenciamento de projetos com Gráfico de Gantt editável</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Data de Início</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-blue-600">{tasks.length}</div>
              <div className="text-xs text-muted-foreground">Tarefas</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-orange-600">{totalDuration}d</div>
              <div className="text-xs text-muted-foreground">Duração</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline"><Upload className="h-4 w-4 mr-1" /> Importar .pod/.xml</Button>
        <Button onClick={loadPlatformData}><Package className="h-4 w-4 mr-1" /> Usar Dados da Plataforma</Button>
        <Button size="sm" onClick={addTask} variant="outline"><Plus className="h-4 w-4 mr-1" /> Add Tarefa</Button>
        <Button variant="outline" onClick={() => { setTasks([]); toast.info("Tarefas limpas."); }}><Trash2 className="h-4 w-4 mr-1" /> Limpar</Button>
      </div>

      {/* Gantt Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>📅 Gráfico de Gantt</CardTitle>
            <div className="flex gap-2 items-center">
              <Select value={ganttView} onValueChange={setGanttView}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Por Dia</SelectItem>
                  <SelectItem value="week">Por Semana</SelectItem>
                  <SelectItem value="month">Por Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Adicione tarefas ou use dados da plataforma</p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  <div className="flex border-b border-border">
                    <div className="w-[40px] shrink-0 p-2 text-xs font-semibold text-muted-foreground">ID</div>
                    <div className="w-[180px] shrink-0 p-2 text-xs font-semibold text-muted-foreground">Tarefa</div>
                    <div className="w-[60px] shrink-0 p-2 text-xs font-semibold text-muted-foreground">Dias</div>
                    <div className="w-[90px] shrink-0 p-2 text-xs font-semibold text-muted-foreground">Início</div>
                    <div className="w-[50px] shrink-0 p-2 text-xs font-semibold text-muted-foreground">%</div>
                    <div className="w-[40px] shrink-0 p-2"></div>
                    <div className="flex-1 p-2 relative">
                      {ganttData && (
                        <div className="flex">
                          {ganttData.columns.map((col, ci) => (
                            <div key={ci} className="text-[10px] text-muted-foreground text-center" style={{ width: `${100 / ganttData.columns.length}%` }}>{col}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {ganttData?.tasks.map((t, i) => (
                    <div key={i} className="flex items-center border-b border-border/50 hover:bg-muted/30 group">
                      <div className="w-[40px] shrink-0 p-2 text-xs font-mono">{t.id}</div>
                      <div className="w-[180px] shrink-0 p-2">
                        <Input value={t.name} className="h-7 text-xs" onChange={e => { const u = [...tasks]; u[i].name = e.target.value; setTasks(u); }} />
                      </div>
                      <div className="w-[60px] shrink-0 p-2">
                        <Input type="number" value={t.duration} className="h-7 text-xs w-14" onChange={e => { const u = [...tasks]; u[i].duration = Math.max(1, Number(e.target.value)); setTasks(u); }} />
                      </div>
                      <div className="w-[90px] shrink-0 p-2">
                        <Input type="date" value={t.start} className="h-7 text-xs" onChange={e => { const u = [...tasks]; u[i].start = e.target.value; setTasks(u); }} />
                      </div>
                      <div className="w-[50px] shrink-0 p-2">
                        <Input type="number" value={t.progress} className="h-7 text-xs w-12" min={0} max={100} onChange={e => { const u = [...tasks]; u[i].progress = Math.min(100, Math.max(0, Number(e.target.value))); setTasks(u); }} />
                      </div>
                      <div className="w-[40px] shrink-0 p-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => {
                          setTasks(tasks.filter((_, j) => j !== i));
                          toast.info(`Tarefa removida.`);
                        }}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex-1 p-2 relative h-10">
                        <div className="absolute inset-0 flex">
                          {ganttData.columns.map((_, ci) => (
                            <div key={ci} className="border-r border-border/20" style={{ width: `${100 / ganttData.columns.length}%` }} />
                          ))}
                        </div>
                        <div className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md shadow-sm flex items-center justify-center text-[10px] text-white font-medium" style={{ left: `${t.offsetPct}%`, width: `${Math.max(t.widthPct, 1.5)}%`, backgroundColor: t.color }} title={`${t.name} (${t.duration}d, ${t.progress}%)`}>
                          {t.widthPct > 5 && <span className="truncate px-1">{t.duration}d</span>}
                        </div>
                        {t.progress > 0 && (
                          <div className="absolute top-1/2 -translate-y-1/2 h-6 rounded-l-md opacity-30 bg-black" style={{ left: `${t.offsetPct}%`, width: `${(t.widthPct * t.progress) / 100}%` }} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>📊 {tasks.length} tarefas</span>
                <span>📅 {totalDuration} dias totais</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline"><Download className="h-4 w-4 mr-1" /> Exportar POD</Button>
        <Button variant="outline"><Download className="h-4 w-4 mr-1" /> Exportar XML</Button>
        <Button variant="outline" onClick={() => toast.info("Sincronizando...")}><RefreshCw className="h-4 w-4 mr-1" /> Sincronizar</Button>
        <Button variant="outline" onClick={() => toast.info("Comparando versões...")}><GitCompare className="h-4 w-4 mr-1" /> Comparar</Button>
      </div>
    </div>
  );
};
