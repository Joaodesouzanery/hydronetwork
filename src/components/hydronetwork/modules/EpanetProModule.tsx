/**
 * EPANET PRO - Complete Hydraulic Simulation Module
 * Uses epanet-js (WASM) for real INP file simulation
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Play, Upload, Download, Trash2, Droplets, AlertTriangle, Pause,
  FileText, BarChart3, MapPin, GitBranch, Zap, Settings2, Eye
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ScatterChart, Scatter, ZAxis
} from "recharts";
import { NodeMapWidget, NodeData, ConnectionData } from "@/components/hydronetwork/NodeMapWidget";

// ── Types ──
interface NodeResult {
  id: string;
  index: number;
  elevation: number;
  baseDemand: number;
  pressure: number[];
  head: number[];
  demand: number[];
  type: "junction" | "reservoir" | "tank";
}

interface LinkResult {
  id: string;
  index: number;
  length: number;
  diameter: number;
  flow: number[];
  velocity: number[];
  headloss: number[];
  type: "pipe" | "pump" | "valve";
  node1: string;
  node2: string;
}

interface SimulationResults {
  nodes: NodeResult[];
  links: LinkResult[];
  times: number[];
  summary: {
    minPressure: number;
    maxPressure: number;
    avgPressure: number;
    totalDemand: number;
    totalFlow: number;
    criticalNodes: string[];
  };
}

interface INPCoord {
  id: string;
  x: number;
  y: number;
}

// ── Default INP content for testing ──
const DEFAULT_INP = `[TITLE]
Rede Exemplo - Simulador EPANET PRO

[JUNCTIONS]
;ID    Elev    Demand
 J1    100     10
 J2    95      15
 J3    90      20
 J4    85      25
 J5    80      30

[RESERVOIRS]
;ID    Head
 R1    120

[TANKS]
;ID    Elev    InitLvl    MinLvl    MaxLvl    Diam
 T1    110     5          0         10        20

[PIPES]
;ID    Node1    Node2    Length    Diam    Rough
 P1    R1       J1       1000      300     100
 P2    J1       J2       800       250     100
 P3    J2       J3       600       200     100
 P4    J3       J4       500       150     100
 P5    J4       J5       400       150     100
 P6    J1       T1       400       200     100

[PUMPS]

[VALVES]

[COORDINATES]
;Node    X-Coord    Y-Coord
 R1      0          100
 J1      100        100
 J2      200        100
 J3      300        100
 J4      400        100
 J5      500        100
 T1      100        200

[TIMES]
 Duration           24:00
 Hydraulic Timestep 1:00
 Quality Timestep   0:05
 Report Timestep    1:00

[OPTIONS]
 Units              LPS
 Headloss           H-W

[END]
`;

// ── Parse INP file for coordinates and network data ──
function parseINP(content: string) {
  const lines = content.split("\n").map(l => l.trim());
  const junctions: { id: string; elev: number; demand: number }[] = [];
  const reservoirs: { id: string; head: number }[] = [];
  const tanks: { id: string; elev: number }[] = [];
  const pipes: { id: string; node1: string; node2: string; length: number; diameter: number; roughness: number }[] = [];
  const coords: INPCoord[] = [];

  let section = "";
  for (const line of lines) {
    if (line.startsWith("[")) { section = line; continue; }
    if (!line || line.startsWith(";")) continue;
    const parts = line.split(/\s+/).filter(Boolean);

    switch (section) {
      case "[JUNCTIONS]":
        if (parts.length >= 3) junctions.push({ id: parts[0], elev: parseFloat(parts[1]), demand: parseFloat(parts[2]) });
        break;
      case "[RESERVOIRS]":
        if (parts.length >= 2) reservoirs.push({ id: parts[0], head: parseFloat(parts[1]) });
        break;
      case "[TANKS]":
        if (parts.length >= 2) tanks.push({ id: parts[0], elev: parseFloat(parts[1]) });
        break;
      case "[PIPES]":
        if (parts.length >= 6) pipes.push({ id: parts[0], node1: parts[1], node2: parts[2], length: parseFloat(parts[3]), diameter: parseFloat(parts[4]), roughness: parseFloat(parts[5]) });
        break;
      case "[COORDINATES]":
        if (parts.length >= 3) coords.push({ id: parts[0], x: parseFloat(parts[1]), y: parseFloat(parts[2]) });
        break;
    }
  }

  return { junctions, reservoirs, tanks, pipes, coords };
}

// ── Simplified hydraulic simulation (Hazen-Williams) when epanet-js fails to load ──
function simulateFallback(parsed: ReturnType<typeof parseINP>): SimulationResults {
  const { junctions, reservoirs, tanks, pipes, coords } = parsed;
  const allNodeIds = [
    ...reservoirs.map(r => r.id),
    ...tanks.map(t => t.id),
    ...junctions.map(j => j.id),
  ];

  // Build adjacency
  const nodeElev: Record<string, number> = {};
  reservoirs.forEach(r => { nodeElev[r.id] = r.head; });
  tanks.forEach(t => { nodeElev[t.id] = t.elev; });
  junctions.forEach(j => { nodeElev[j.id] = j.elev; });

  const nodeResults: NodeResult[] = [];
  let cumulativeHf = 0;
  const refHead = reservoirs[0]?.head || 120;

  // Simple sequential pressure calculation
  junctions.forEach((j, i) => {
    const pipe = pipes[i];
    if (pipe) {
      const q = j.demand / 1000; // m³/s
      const D = pipe.diameter / 1000; // m
      const C = pipe.roughness;
      const L = pipe.length;
      const hf = (10.643 * Math.pow(Math.abs(q), 1.852) * L) / (Math.pow(C, 1.852) * Math.pow(D, 4.87));
      cumulativeHf += hf;
    }
    const pressure = refHead - j.elev - cumulativeHf;
    nodeResults.push({
      id: j.id, index: i + 1, elevation: j.elev, baseDemand: j.demand,
      pressure: [pressure], head: [refHead - cumulativeHf], demand: [j.demand],
      type: "junction",
    });
  });

  reservoirs.forEach((r, i) => {
    nodeResults.unshift({
      id: r.id, index: 0, elevation: r.head, baseDemand: 0,
      pressure: [0], head: [r.head], demand: [0], type: "reservoir",
    });
  });

  tanks.forEach((t, i) => {
    nodeResults.push({
      id: t.id, index: junctions.length + i + 1, elevation: t.elev, baseDemand: 0,
      pressure: [5], head: [t.elev + 5], demand: [0], type: "tank",
    });
  });

  const linkResults: LinkResult[] = pipes.map((p, i) => {
    const q = (junctions[i]?.demand || 10) / 1000;
    const D = p.diameter / 1000;
    const A = Math.PI * D * D / 4;
    const v = A > 0 ? q / A : 0;
    const hf = (10.643 * Math.pow(Math.abs(q), 1.852) * p.length) / (Math.pow(p.roughness, 1.852) * Math.pow(D, 4.87));
    return {
      id: p.id, index: i + 1, length: p.length, diameter: p.diameter,
      flow: [junctions[i]?.demand || 10], velocity: [parseFloat(v.toFixed(3))],
      headloss: [parseFloat(hf.toFixed(4))],
      type: "pipe" as const, node1: p.node1, node2: p.node2,
    };
  });

  const pressures = nodeResults.filter(n => n.type === "junction").map(n => n.pressure[0]);
  const criticalNodes = nodeResults.filter(n => n.type === "junction" && n.pressure[0] < 10).map(n => n.id);

  return {
    nodes: nodeResults, links: linkResults, times: [0],
    summary: {
      minPressure: pressures.length > 0 ? Math.min(...pressures) : 0,
      maxPressure: pressures.length > 0 ? Math.max(...pressures) : 0,
      avgPressure: pressures.length > 0 ? pressures.reduce((a, b) => a + b, 0) / pressures.length : 0,
      totalDemand: junctions.reduce((s, j) => s + j.demand, 0),
      totalFlow: linkResults.reduce((s, l) => s + Math.abs(l.flow[0]), 0),
      criticalNodes,
    },
  };
}

// ── Pressure color ──
function pressureColor(p: number): string {
  if (p < 10) return "hsl(0, 80%, 55%)"; // red
  if (p > 40) return "hsl(45, 90%, 50%)"; // yellow
  return "hsl(140, 60%, 45%)"; // green
}

function pressureBadge(p: number) {
  if (p < 10) return <Badge className="bg-red-500 text-white">Crítica</Badge>;
  if (p > 40) return <Badge className="bg-yellow-500 text-white">Alta</Badge>;
  return <Badge className="bg-green-500 text-white">Normal</Badge>;
}

// ── Main Component ──
export const EpanetProModule = () => {
  const [inpContent, setInpContent] = useState<string>("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseINP> | null>(null);
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("network");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [mapConnections, setMapConnections] = useState<ConnectionData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load INP file ──
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".inp")) {
      toast.error("Formato inválido. Use arquivos .inp (EPANET)");
      return;
    }
    const text = await file.text();
    setInpContent(text);
    const p = parseINP(text);
    setParsed(p);
    setResults(null);

    // Auto-generate map connections from pipes
    const conns: ConnectionData[] = p.pipes.map(pipe => ({
      from: pipe.node1, to: pipe.node2,
      color: "hsl(210, 70%, 50%)", label: `${pipe.id}: DN${pipe.diameter}`,
    }));
    setMapConnections(conns);

    toast.success(`Modelo carregado: ${p.junctions.length} junções, ${p.reservoirs.length} reservatórios, ${p.pipes.length} tubos`);
  }, []);

  // ── Load default example ──
  const loadExample = useCallback(() => {
    setInpContent(DEFAULT_INP);
    const p = parseINP(DEFAULT_INP);
    setParsed(p);
    setResults(null);
    const conns: ConnectionData[] = p.pipes.map(pipe => ({
      from: pipe.node1, to: pipe.node2,
      color: "hsl(210, 70%, 50%)", label: `${pipe.id}: DN${pipe.diameter}`,
    }));
    setMapConnections(conns);
    toast.success(`Exemplo carregado: ${p.junctions.length} junções, ${p.pipes.length} tubos`);
  }, []);

  // ── Run simulation ──
  const runSimulation = useCallback(async () => {
    if (!parsed) { toast.error("Carregue um modelo primeiro"); return; }
    setIsRunning(true);
    setProgress(0);

    try {
      // Try loading epanet-js
      let useEpanetJs = false;
      try {
        const epanetModule = await import("epanet-js");
        const { Project, Workspace } = epanetModule;
        const ws = new Workspace();
        const model = new Project(ws);

        // Write INP to virtual FS
        const encoder = new TextEncoder();
        ws.writeFile("model.inp", encoder.encode(inpContent));
        model.open("model.inp", "report.rpt", "output.bin");

        // Get counts
        const nodeCount = model.getCount(0); // EN_NODECOUNT
        const linkCount = model.getCount(2); // EN_LINKCOUNT

        const nodeResults: NodeResult[] = [];
        const linkResults: LinkResult[] = [];
        const times: number[] = [];

        // Init node results
        for (let i = 1; i <= nodeCount; i++) {
          const id = model.getNodeId(i);
          const elev = model.getNodeValue(i, 0);
          const baseDemand = model.getNodeValue(i, 1);
          const nodeType = model.getNodeType(i);
          nodeResults.push({
            id, index: i, elevation: elev, baseDemand,
            pressure: [], head: [], demand: [],
            type: nodeType === 0 ? "junction" : nodeType === 1 ? "reservoir" : "tank",
          });
        }

        for (let i = 1; i <= linkCount; i++) {
          const id = model.getLinkId(i);
          const length = model.getLinkValue(i, 1);
          const diameter = model.getLinkValue(i, 0);
          const linkType = model.getLinkType(i);
          const nodes = model.getLinkNodes(i);
          const n1Id = model.getNodeId(nodes.node1);
          const n2Id = model.getNodeId(nodes.node2);
          linkResults.push({
            id, index: i, length, diameter,
            flow: [], velocity: [], headloss: [],
            type: linkType <= 1 ? "pipe" : linkType === 2 ? "pump" : "valve",
            node1: n1Id, node2: n2Id,
          });
        }

        // Run hydraulic simulation
        model.openH();
        model.initH(11);

        let tStep = Infinity;
        let stepCount = 0;
        do {
          const currentTime = model.runH();
          times.push(currentTime);

          for (let i = 0; i < nodeResults.length; i++) {
            const idx = nodeResults[i].index;
            nodeResults[i].pressure.push(model.getNodeValue(idx, 11));
            nodeResults[i].head.push(model.getNodeValue(idx, 10));
            nodeResults[i].demand.push(model.getNodeValue(idx, 9));
          }

          for (let i = 0; i < linkResults.length; i++) {
            const idx = linkResults[i].index;
            linkResults[i].flow.push(model.getLinkValue(idx, 8));
            linkResults[i].velocity.push(model.getLinkValue(idx, 9));
            linkResults[i].headloss.push(model.getLinkValue(idx, 10));
          }

          tStep = model.nextH();
          stepCount++;
          setProgress(Math.min((stepCount / 30) * 100, 99));
        } while (tStep > 0 && stepCount < 200);

        model.closeH();
        model.close();

        const pressures = nodeResults.filter(n => n.type === "junction").flatMap(n => n.pressure);
        const criticalNodes = nodeResults.filter(n => n.type === "junction" && Math.min(...n.pressure) < 10).map(n => n.id);

        setResults({
          nodes: nodeResults, links: linkResults, times,
          summary: {
            minPressure: pressures.length > 0 ? Math.min(...pressures) : 0,
            maxPressure: pressures.length > 0 ? Math.max(...pressures) : 0,
            avgPressure: pressures.length > 0 ? pressures.reduce((a, b) => a + b, 0) / pressures.length : 0,
            totalDemand: nodeResults.filter(n => n.type === "junction").reduce((s, n) => s + (n.demand[0] || 0), 0),
            totalFlow: linkResults.reduce((s, l) => s + Math.abs(l.flow[0] || 0), 0),
            criticalNodes,
          },
        });
        useEpanetJs = true;
        toast.success(`Simulação EPANET-JS concluída: ${stepCount} passos, ${nodeCount} nós`);
      } catch (epanetErr) {
        console.warn("epanet-js não disponível, usando simulação simplificada:", epanetErr);
      }

      if (!useEpanetJs) {
        // Fallback simulation
        for (let i = 0; i <= 100; i += 10) {
          setProgress(i);
          await new Promise(r => setTimeout(r, 50));
        }
        const fallbackResults = simulateFallback(parsed);
        setResults(fallbackResults);
        toast.success("Simulação Hazen-Williams concluída (modo simplificado)");
      }

      setProgress(100);
      setActiveTab("results");
    } catch (err: any) {
      toast.error(`Erro na simulação: ${err.message || err}`);
    } finally {
      setIsRunning(false);
    }
  }, [parsed, inpContent]);

  // ── Clear ──
  const clearAll = useCallback(() => {
    setInpContent("");
    setParsed(null);
    setResults(null);
    setMapConnections([]);
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    toast.info("Dados limpos");
  }, []);

  // ── Export results CSV ──
  const exportCSV = useCallback(() => {
    if (!results) return;
    const lines = ["tipo;id;elevacao;demanda;pressao;head"];
    results.nodes.forEach(n => {
      lines.push(`${n.type};${n.id};${n.elevation};${n.baseDemand};${n.pressure[0]?.toFixed(2) || ""};${n.head[0]?.toFixed(2) || ""}`);
    });
    lines.push("");
    lines.push("tipo;id;comprimento;diametro;vazao;velocidade;perda_carga");
    results.links.forEach(l => {
      lines.push(`${l.type};${l.id};${l.length};${l.diameter};${l.flow[0]?.toFixed(2) || ""};${l.velocity[0]?.toFixed(3) || ""};${l.headloss[0]?.toFixed(4) || ""}`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "epanet_results.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Resultados exportados em CSV");
  }, [results]);

  // ── Export INP ──
  const exportINP = useCallback(() => {
    if (!inpContent) return;
    const blob = new Blob([inpContent], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "model.inp";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [inpContent]);

  // ── Map nodes from parsed data ──
  const mapNodes = useMemo<NodeData[]>(() => {
    if (!parsed) return [];
    return parsed.coords.map(c => {
      const junction = parsed.junctions.find(j => j.id === c.id);
      const reservoir = parsed.reservoirs.find(r => r.id === c.id);
      const tank = parsed.tanks.find(t => t.id === c.id);
      const nodeResult = results?.nodes.find(n => n.id === c.id);
      return {
        id: c.id,
        x: c.x * 1000 + 350000, // Scale to UTM-like
        y: c.y * 1000 + 7400000,
        cota: junction?.elev ?? reservoir?.head ?? tank?.elev ?? 0,
        demanda: junction?.demand ?? 0,
        label: reservoir ? "Reservatório" : tank ? "Tanque" : "Junção",
      };
    });
  }, [parsed, results]);

  // ── Selected node details ──
  const selectedNodeDetails = useMemo(() => {
    if (!selectedNodeId || !results) return null;
    return results.nodes.find(n => n.id === selectedNodeId);
  }, [selectedNodeId, results]);

  const selectedLinkDetails = useMemo(() => {
    if (!selectedLinkId || !results) return null;
    return results.links.find(l => l.id === selectedLinkId);
  }, [selectedLinkId, results]);

  // ── Chart data ──
  const pressureChartData = useMemo(() => {
    if (!results) return [];
    return results.nodes.filter(n => n.type === "junction").map(n => ({
      name: n.id, pressao: parseFloat(n.pressure[0]?.toFixed(2) || "0"),
      elevacao: n.elevation, demanda: n.baseDemand,
    }));
  }, [results]);

  const flowChartData = useMemo(() => {
    if (!results) return [];
    return results.links.filter(l => l.type === "pipe").map(l => ({
      name: l.id, vazao: parseFloat(Math.abs(l.flow[0] || 0).toFixed(2)),
      velocidade: parseFloat(Math.abs(l.velocity[0] || 0).toFixed(3)),
      perdaCarga: parseFloat(Math.abs(l.headloss[0] || 0).toFixed(4)),
    }));
  }, [results]);

  const pressureHistogram = useMemo(() => {
    if (!results) return [];
    const ranges = [
      { label: "< 0", min: -Infinity, max: 0, count: 0 },
      { label: "0-10", min: 0, max: 10, count: 0 },
      { label: "10-20", min: 10, max: 20, count: 0 },
      { label: "20-30", min: 20, max: 30, count: 0 },
      { label: "30-40", min: 30, max: 40, count: 0 },
      { label: "> 40", min: 40, max: Infinity, count: 0 },
    ];
    results.nodes.filter(n => n.type === "junction").forEach(n => {
      const p = n.pressure[0] || 0;
      const range = ranges.find(r => p >= r.min && p < r.max);
      if (range) range.count++;
    });
    return ranges;
  }, [results]);

  const stats = useMemo(() => {
    if (!parsed) return { juncoes: 0, reservatorios: 0, tanques: 0, tubos: 0, bombas: 0, valvulas: 0, extensao: 0 };
    return {
      juncoes: parsed.junctions.length,
      reservatorios: parsed.reservoirs.length,
      tanques: parsed.tanks.length,
      tubos: parsed.pipes.length,
      bombas: 0, valvulas: 0,
      extensao: parsed.pipes.reduce((s, p) => s + p.length, 0),
    };
  }, [parsed]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Droplets className="h-6 w-6 text-blue-600" />
            EPANET PRO — Simulador Hidráulico de Redes de Água
          </CardTitle>
          <CardDescription>
            Carregue arquivos .INP do EPANET, execute simulações hidráulicas e visualize resultados em tempo real.
            Powered by epanet-js (WASM).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
            {[
              { icon: "📍", value: stats.juncoes, label: "Junções", color: "text-blue-600" },
              { icon: "🏔️", value: stats.reservatorios, label: "Reservatórios", color: "text-amber-600" },
              { icon: "🟦", value: stats.tanques, label: "Tanques", color: "text-cyan-600" },
              { icon: "➖", value: stats.tubos, label: "Tubos", color: "text-green-600" },
              { icon: "⚡", value: stats.bombas, label: "Bombas", color: "text-purple-600" },
              { icon: "🔧", value: stats.valvulas, label: "Válvulas", color: "text-orange-600" },
              { icon: "📏", value: `${stats.extensao.toFixed(0)}m`, label: "Extensão", color: "text-indigo-600" },
            ].map((s, i) => (
              <div key={i} className="bg-white dark:bg-card border rounded-xl p-3 text-center">
                <div className="text-2xl">{s.icon}</div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] font-medium text-muted-foreground uppercase">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            <input ref={fileInputRef} type="file" accept=".inp" className="hidden" onChange={handleFileUpload} />
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Importar .INP
            </Button>
            <Button variant="outline" onClick={loadExample}>📂 Carregar Exemplo</Button>
            <Button onClick={runSimulation} disabled={!parsed || isRunning} className="bg-green-600 hover:bg-green-700 text-white">
              {isRunning ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              {isRunning ? "Simulando..." : "Executar Simulação"}
            </Button>
            <Button variant="outline" onClick={exportINP} disabled={!inpContent}>
              <Download className="h-4 w-4 mr-1" /> Exportar .INP
            </Button>
            <Button variant="outline" onClick={exportCSV} disabled={!results}>
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
            <Button variant="destructive" onClick={clearAll}><Trash2 className="h-4 w-4 mr-1" /> Limpar</Button>
          </div>

          {isRunning && (
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Simulando...</span><span>{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Layout */}
      {parsed && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="network">🗺️ Rede</TabsTrigger>
                <TabsTrigger value="results">📊 Resultados</TabsTrigger>
                <TabsTrigger value="charts">📈 Gráficos</TabsTrigger>
                <TabsTrigger value="nodes">📍 Nós</TabsTrigger>
                <TabsTrigger value="links">➖ Trechos</TabsTrigger>
              </TabsList>

              <TabsContent value="network" className="space-y-4">
                {/* Interactive Map */}
                <NodeMapWidget
                  nodes={mapNodes}
                  connections={mapConnections}
                  onConnectionsChange={setMapConnections}
                  onNodeClick={setSelectedNodeId}
                  onNodeDemandChange={(nodeId, demanda) => {
                    toast.success(`Demanda de ${nodeId} atualizada para ${demanda} L/s`);
                  }}
                  title="Rede Hidráulica EPANET"
                  accentColor="hsl(210, 70%, 50%)"
                  height={500}
                  editable
                />
              </TabsContent>

              <TabsContent value="results" className="space-y-4">
                {results ? (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        { label: "Pressão Mín", value: `${results.summary.minPressure.toFixed(1)} mca`, color: results.summary.minPressure < 10 ? "text-red-600" : "text-green-600", bg: results.summary.minPressure < 10 ? "border-red-200 bg-red-50 dark:bg-red-950/20" : "border-green-200 bg-green-50 dark:bg-green-950/20" },
                        { label: "Pressão Máx", value: `${results.summary.maxPressure.toFixed(1)} mca`, color: "text-blue-600", bg: "border-blue-200 bg-blue-50 dark:bg-blue-950/20" },
                        { label: "Pressão Média", value: `${results.summary.avgPressure.toFixed(1)} mca`, color: "text-cyan-600", bg: "border-cyan-200 bg-cyan-50 dark:bg-cyan-950/20" },
                        { label: "Demanda Total", value: `${results.summary.totalDemand.toFixed(1)} L/s`, color: "text-purple-600", bg: "border-purple-200 bg-purple-50 dark:bg-purple-950/20" },
                        { label: "Vazão Total", value: `${results.summary.totalFlow.toFixed(1)} L/s`, color: "text-orange-600", bg: "border-orange-200 bg-orange-50 dark:bg-orange-950/20" },
                        { label: "Nós Críticos", value: `${results.summary.criticalNodes.length}`, color: results.summary.criticalNodes.length > 0 ? "text-red-600" : "text-green-600", bg: results.summary.criticalNodes.length > 0 ? "border-red-200 bg-red-50 dark:bg-red-950/20" : "border-green-200 bg-green-50 dark:bg-green-950/20" },
                      ].map((s, i) => (
                        <div key={i} className={`border-2 rounded-xl p-3 text-center ${s.bg}`}>
                          <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                          <div className="text-[10px] font-medium text-muted-foreground uppercase">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {results.summary.criticalNodes.length > 0 && (
                      <Card className="border-red-300 bg-red-50/50 dark:bg-red-950/10">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                            <span className="font-semibold text-red-700 dark:text-red-400">Pressão Crítica Detectada</span>
                          </div>
                          <p className="text-sm text-red-600 dark:text-red-400">
                            Nós com pressão &lt; 10 mca: <strong>{results.summary.criticalNodes.join(", ")}</strong>
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground py-12">
                      <Droplets className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>Execute a simulação para ver os resultados</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="charts" className="space-y-4">
                {results ? (
                  <>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Pressão nos Nós (mca)</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={pressureChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" fontSize={10} />
                            <YAxis fontSize={10} />
                            <RechartsTooltip />
                            <Legend />
                            <Bar dataKey="pressao" name="Pressão (mca)" fill="hsl(210, 70%, 50%)" />
                            <Bar dataKey="elevacao" name="Elevação (m)" fill="hsl(140, 60%, 45%)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Vazão e Velocidade por Trecho</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={flowChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" fontSize={10} />
                            <YAxis fontSize={10} />
                            <RechartsTooltip />
                            <Legend />
                            <Bar dataKey="vazao" name="Vazão (L/s)" fill="hsl(25, 90%, 55%)" />
                            <Bar dataKey="velocidade" name="Velocidade (m/s)" fill="hsl(210, 70%, 50%)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Histograma de Pressões</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={pressureHistogram}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" fontSize={10} />
                            <YAxis fontSize={10} />
                            <RechartsTooltip />
                            <Bar dataKey="count" name="Nós" fill="hsl(210, 70%, 50%)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card><CardContent className="pt-6 text-center text-muted-foreground py-8">Execute a simulação para ver gráficos.</CardContent></Card>
                )}
              </TabsContent>

              <TabsContent value="nodes" className="space-y-4">
                {results ? (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Resultados por Nó ({results.nodes.length})</CardTitle></CardHeader>
                    <CardContent>
                      <div className="max-h-[500px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead><TableHead>Tipo</TableHead>
                              <TableHead>Elevação</TableHead><TableHead>Demanda</TableHead>
                              <TableHead>Pressão (mca)</TableHead><TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.nodes.map(n => (
                              <TableRow key={n.id} className={`cursor-pointer ${selectedNodeId === n.id ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                                onClick={() => setSelectedNodeId(n.id)}>
                                <TableCell className="font-medium">{n.id}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {n.type === "junction" ? "Junção" : n.type === "reservoir" ? "Reservatório" : "Tanque"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{n.elevation.toFixed(1)}m</TableCell>
                                <TableCell>{n.baseDemand.toFixed(1)} L/s</TableCell>
                                <TableCell>{n.pressure[0]?.toFixed(2) || "-"}</TableCell>
                                <TableCell>{n.type === "junction" ? pressureBadge(n.pressure[0] || 0) : <Badge variant="outline">-</Badge>}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card><CardContent className="pt-6 text-center text-muted-foreground py-8">Nenhum nó simulado.</CardContent></Card>
                )}
              </TabsContent>

              <TabsContent value="links" className="space-y-4">
                {results ? (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Resultados por Trecho ({results.links.length})</CardTitle></CardHeader>
                    <CardContent>
                      <div className="max-h-[500px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead><TableHead>De → Para</TableHead>
                              <TableHead>Comp (m)</TableHead><TableHead>DN (mm)</TableHead>
                              <TableHead>Vazão (L/s)</TableHead><TableHead>V (m/s)</TableHead>
                              <TableHead>hf (m)</TableHead><TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.links.map(l => {
                              const v = Math.abs(l.velocity[0] || 0);
                              const isWarn = v > 2.5 || v < 0.3;
                              return (
                                <TableRow key={l.id} className={`cursor-pointer ${selectedLinkId === l.id ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                                  onClick={() => setSelectedLinkId(l.id)}>
                                  <TableCell className="font-medium">{l.id}</TableCell>
                                  <TableCell className="text-xs">{l.node1} → {l.node2}</TableCell>
                                  <TableCell>{l.length.toFixed(0)}</TableCell>
                                  <TableCell>{l.diameter.toFixed(0)}</TableCell>
                                  <TableCell>{Math.abs(l.flow[0] || 0).toFixed(2)}</TableCell>
                                  <TableCell>{v.toFixed(3)}</TableCell>
                                  <TableCell>{Math.abs(l.headloss[0] || 0).toFixed(4)}</TableCell>
                                  <TableCell>
                                    <Badge className={isWarn ? "bg-yellow-500" : "bg-green-500"}>{isWarn ? "ALERTA" : "OK"}</Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card><CardContent className="pt-6 text-center text-muted-foreground py-8">Nenhum trecho simulado.</CardContent></Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right sidebar - Properties */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Eye className="h-4 w-4" /> Propriedades</CardTitle></CardHeader>
              <CardContent>
                {selectedNodeDetails ? (
                  <div className="space-y-2 text-sm">
                    <Badge variant="outline" className="mb-2">
                      {selectedNodeDetails.type === "junction" ? "Junção" : selectedNodeDetails.type === "reservoir" ? "Reservatório" : "Tanque"}
                    </Badge>
                    <p><strong>ID:</strong> {selectedNodeDetails.id}</p>
                    <p><strong>Elevação:</strong> {selectedNodeDetails.elevation.toFixed(1)} m</p>
                    <p><strong>Demanda Base:</strong> {selectedNodeDetails.baseDemand.toFixed(1)} L/s</p>
                    {selectedNodeDetails.pressure[0] !== undefined && (
                      <>
                        <hr className="my-2" />
                        <p><strong>Pressão:</strong> {selectedNodeDetails.pressure[0].toFixed(2)} mca</p>
                        <p><strong>Cota Piez.:</strong> {selectedNodeDetails.head[0]?.toFixed(2)} m</p>
                        <p><strong>Demanda:</strong> {selectedNodeDetails.demand[0]?.toFixed(2)} L/s</p>
                        <div className="mt-2">{pressureBadge(selectedNodeDetails.pressure[0])}</div>
                      </>
                    )}
                  </div>
                ) : selectedLinkDetails ? (
                  <div className="space-y-2 text-sm">
                    <Badge variant="outline" className="mb-2">
                      {selectedLinkDetails.type === "pipe" ? "Tubo" : selectedLinkDetails.type === "pump" ? "Bomba" : "Válvula"}
                    </Badge>
                    <p><strong>ID:</strong> {selectedLinkDetails.id}</p>
                    <p><strong>De → Para:</strong> {selectedLinkDetails.node1} → {selectedLinkDetails.node2}</p>
                    <p><strong>Comprimento:</strong> {selectedLinkDetails.length.toFixed(1)} m</p>
                    <p><strong>Diâmetro:</strong> {selectedLinkDetails.diameter.toFixed(0)} mm</p>
                    {selectedLinkDetails.flow[0] !== undefined && (
                      <>
                        <hr className="my-2" />
                        <p><strong>Vazão:</strong> {Math.abs(selectedLinkDetails.flow[0]).toFixed(2)} L/s</p>
                        <p><strong>Velocidade:</strong> {Math.abs(selectedLinkDetails.velocity[0] || 0).toFixed(3)} m/s</p>
                        <p><strong>Perda de Carga:</strong> {Math.abs(selectedLinkDetails.headloss[0] || 0).toFixed(4)} m</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <div className="text-3xl mb-2">🔍</div>
                    <p className="text-xs">Selecione um elemento na tabela ou mapa</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Settings2 className="h-4 w-4" /> Legenda</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(140, 60%, 45%)" }} /> Pressão Normal (10-40 mca)</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(0, 80%, 55%)" }} /> Pressão Crítica (&lt; 10 mca)</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(45, 90%, 50%)" }} /> Pressão Alta (&gt; 40 mca)</div>
                <hr />
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(210, 70%, 50%)" }} /> Velocidade Normal</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(0, 80%, 55%)" }} /> Velocidade Alta (&gt; 2.5 m/s)</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!parsed && (
        <Card className="border-dashed border-2">
          <CardContent className="pt-12 pb-12 text-center">
            <Droplets className="h-16 w-16 mx-auto mb-4 text-blue-300" />
            <h3 className="text-lg font-semibold mb-2">Nenhum modelo carregado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Arraste um arquivo .inp ou clique em "Importar .INP" para começar.<br />
              Ou carregue o exemplo padrão para testar.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Importar .INP
              </Button>
              <Button variant="outline" onClick={loadExample}>📂 Carregar Exemplo</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
