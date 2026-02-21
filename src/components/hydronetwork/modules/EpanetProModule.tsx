/**
 * EPANET PRO - Complete Hydraulic Simulation Module
 * Full editable tables, interactive map, simulation config, demand patterns, INP import/export
 */
import { useState, useCallback, useMemo, useRef } from "react";
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
  FileText, BarChart3, MapPin, Plus, X, Settings2, Zap
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from "recharts";
import { NodeMapWidget, NodeData, ConnectionData } from "@/components/hydronetwork/NodeMapWidget";

// ── Types ──
interface Junction { id: string; elevation: number; demand: number; pattern: string; emitter?: number; quality?: number; }
interface Reservoir { id: string; head: number; pattern: string; quality?: number; }
interface Tank { id: string; elevation: number; initLevel: number; minLevel: number; maxLevel: number; diameter: number; quality?: number; }
interface Pipe { id: string; node1: string; node2: string; length: number; diameter: number; roughness: number; material: string; status: string; minorLoss?: number; }
interface Pump { id: string; node1: string; node2: string; power: number; headCurve?: string; speed?: number; pumpPattern?: string; }
interface Valve { id: string; node1: string; node2: string; diameter: number; type: string; setting: number; minorLoss?: number; }
interface Coord { id: string; x: number; y: number; }
interface Vertex { linkId: string; x: number; y: number; }
interface InpPattern { id: string; multipliers: number[]; }
interface InpCurve { id: string; type: string; points: { x: number; y: number }[]; }

interface NodeResult {
  id: string; type: "junction" | "reservoir" | "tank";
  elevation: number; demand: number; pressure: number; head: number; status: string;
}
interface LinkResult {
  id: string; type: "pipe" | "pump" | "valve";
  node1: string; node2: string; length: number; diameter: number;
  flow: number; velocity: number; headloss: number; status: string;
}
interface SimResults {
  nodes: NodeResult[]; links: LinkResult[];
  summary: { minPressure: number; maxPressure: number; maxVelocity: number; nodeErrors: number; linkErrors: number; };
}

// ── Default realistic example ──
const EXAMPLE_JUNCTIONS: Junction[] = [
  { id: "J1", elevation: 850, demand: 1.5, pattern: "Residencial" },
  { id: "J2", elevation: 845, demand: 2.0, pattern: "Residencial" },
  { id: "J3", elevation: 840, demand: 1.8, pattern: "Residencial" },
  { id: "J4", elevation: 835, demand: 2.5, pattern: "Comercial" },
  { id: "J5", elevation: 830, demand: 3.0, pattern: "Comercial" },
  { id: "J6", elevation: 825, demand: 1.2, pattern: "Residencial" },
  { id: "J7", elevation: 820, demand: 0.8, pattern: "Residencial" },
  { id: "J8", elevation: 815, demand: 1.0, pattern: "Residencial" },
  { id: "J9", elevation: 810, demand: 2.2, pattern: "Industrial" },
  { id: "J10", elevation: 805, demand: 0.5, pattern: "Residencial" },
];
const EXAMPLE_RESERVOIRS: Reservoir[] = [{ id: "R1", head: 900, pattern: "" }];
const EXAMPLE_TANKS: Tank[] = [{ id: "T1", elevation: 870, initLevel: 4, minLevel: 0, maxLevel: 8, diameter: 15 }];
const EXAMPLE_PIPES: Pipe[] = [
  { id: "P1", node1: "R1", node2: "J1", length: 500, diameter: 300, roughness: 130, material: "PVC", status: "Aberto" },
  { id: "P2", node1: "J1", node2: "J2", length: 300, diameter: 250, roughness: 130, material: "PVC", status: "Aberto" },
  { id: "P3", node1: "J2", node2: "J3", length: 250, diameter: 200, roughness: 130, material: "PVC", status: "Aberto" },
  { id: "P4", node1: "J3", node2: "J4", length: 400, diameter: 200, roughness: 130, material: "PVC", status: "Aberto" },
  { id: "P5", node1: "J4", node2: "J5", length: 350, diameter: 150, roughness: 130, material: "PVC", status: "Aberto" },
  { id: "P6", node1: "J1", node2: "J6", length: 200, diameter: 200, roughness: 130, material: "PEAD", status: "Aberto" },
  { id: "P7", node1: "J6", node2: "J7", length: 150, diameter: 150, roughness: 130, material: "PVC", status: "Aberto" },
  { id: "P8", node1: "J7", node2: "J8", length: 180, diameter: 150, roughness: 130, material: "PVC", status: "Aberto" },
  { id: "P9", node1: "J5", node2: "J9", length: 300, diameter: 150, roughness: 120, material: "Ferro Fundido", status: "Aberto" },
  { id: "P10", node1: "J9", node2: "J10", length: 200, diameter: 100, roughness: 130, material: "PVC", status: "Aberto" },
  { id: "P11", node1: "J3", node2: "J7", length: 280, diameter: 150, roughness: 130, material: "PVC", status: "Aberto" },
  { id: "P12", node1: "J1", node2: "T1", length: 100, diameter: 200, roughness: 130, material: "PVC", status: "Aberto" },
];
const EXAMPLE_PUMPS: Pump[] = [{ id: "B1", node1: "T1", node2: "J6", power: 15 }];
const EXAMPLE_COORDS: Coord[] = [
  { id: "R1", x: 0, y: 400 }, { id: "T1", x: 150, y: 500 },
  { id: "J1", x: 150, y: 350 }, { id: "J2", x: 350, y: 350 },
  { id: "J3", x: 550, y: 350 }, { id: "J4", x: 700, y: 450 },
  { id: "J5", x: 850, y: 350 }, { id: "J6", x: 150, y: 100 },
  { id: "J7", x: 400, y: 100 }, { id: "J8", x: 600, y: 50 },
  { id: "J9", x: 850, y: 150 }, { id: "J10", x: 1000, y: 100 },
];

const DEMAND_PATTERNS: Record<string, number[]> = {
  "Residencial": [0.5, 0.4, 0.3, 0.3, 0.4, 0.7, 1.2, 1.5, 1.3, 1.0, 0.9, 0.8, 0.9, 0.8, 0.7, 0.8, 1.0, 1.3, 1.5, 1.4, 1.2, 1.0, 0.8, 0.6],
  "Comercial": [0.2, 0.2, 0.2, 0.2, 0.3, 0.5, 0.8, 1.2, 1.5, 1.5, 1.4, 1.3, 1.0, 1.3, 1.4, 1.5, 1.3, 1.0, 0.5, 0.3, 0.2, 0.2, 0.2, 0.2],
  "Industrial": [0.6, 0.6, 0.6, 0.6, 0.6, 0.8, 1.0, 1.2, 1.2, 1.2, 1.2, 1.2, 1.0, 1.2, 1.2, 1.2, 1.2, 1.0, 0.8, 0.6, 0.6, 0.6, 0.6, 0.6],
};

// ── Parse INP (robust: handles tabs, semicolons mid-line, case-insensitive sections, EPANET2 format) ──
function parseINP(content: string) {
  const lines = content.split(/\r?\n/);
  const junctions: Junction[] = [];
  const reservoirs: Reservoir[] = [];
  const tanks: Tank[] = [];
  const pipes: Pipe[] = [];
  const pumps: Pump[] = [];
  const valves: Valve[] = [];
  const coords: Coord[] = [];
  const vertices: Vertex[] = [];
  const importedPatterns: InpPattern[] = [];
  const importedCurves: InpCurve[] = [];

  // Temporary maps for multi-line sections
  const emitterMap = new Map<string, number>();
  const statusMap = new Map<string, string>();
  const qualityMap = new Map<string, number>();
  const patternAccum = new Map<string, number[]>();
  const curveAccum = new Map<string, { x: number; y: number }[]>();
  const curveTypeMap = new Map<string, string>();

  let section = "";
  for (let li = 0; li < lines.length; li++) {
    const rawLine = lines[li];
    const line = rawLine.trim();
    if (line.startsWith("[")) { section = line.toUpperCase().replace(/\s/g, ""); continue; }
    if (!line) continue;

    // Detect curve type from comment line (EPANET convention)
    if (line.startsWith(";") && section === "[CURVES]") {
      const comment = line.substring(1).trim().toUpperCase();
      const nextLine = li + 1 < lines.length ? lines[li + 1].trim().split(";")[0].trim() : "";
      if (nextLine) {
        const nextP = nextLine.split(/[\s\t]+/).filter(Boolean);
        if (nextP.length >= 3) {
          if (comment.includes("PUMP")) curveTypeMap.set(nextP[0], "PUMP");
          else if (comment.includes("EFFICIENCY")) curveTypeMap.set(nextP[0], "EFFICIENCY");
          else if (comment.includes("VOLUME")) curveTypeMap.set(nextP[0], "VOLUME");
          else if (comment.includes("HEADLOSS")) curveTypeMap.set(nextP[0], "HEADLOSS");
        }
      }
      continue;
    }
    if (line.startsWith(";")) continue;

    // Strip inline comments (semicolons after data)
    const dataLine = line.split(";")[0].trim();
    if (!dataLine) continue;
    const p = dataLine.split(/[\s\t]+/).filter(Boolean);
    switch (section) {
      case "[JUNCTIONS]":
        if (p.length >= 2) junctions.push({ id: p[0], elevation: +p[1], demand: p.length >= 3 ? +p[2] : 0, pattern: p[3] || "" });
        break;
      case "[RESERVOIRS]":
        if (p.length >= 2) reservoirs.push({ id: p[0], head: +p[1], pattern: p[2] || "" });
        break;
      case "[TANKS]":
        if (p.length >= 6) tanks.push({ id: p[0], elevation: +p[1], initLevel: +p[2], minLevel: +p[3], maxLevel: +p[4], diameter: +p[5] });
        break;
      case "[PIPES]":
        if (p.length >= 6) pipes.push({
          id: p[0], node1: p[1], node2: p[2], length: +p[3], diameter: +p[4], roughness: +p[5],
          material: p.length >= 8 ? p[7] : "PVC", status: "Aberto",
          ...(p[6] && { minorLoss: +p[6] }),
        });
        break;
      case "[PUMPS]":
        if (p.length >= 3) {
          const powerIdx = p.findIndex(v => v.toUpperCase() === "POWER");
          const headIdx = p.findIndex(v => v.toUpperCase() === "HEAD");
          const speedIdx = p.findIndex(v => v.toUpperCase() === "SPEED");
          const patIdx = p.findIndex(v => v.toUpperCase() === "PATTERN");
          const power = powerIdx >= 0 && p[powerIdx + 1] ? +p[powerIdx + 1] : (+p[3] || 10);
          pumps.push({
            id: p[0], node1: p[1], node2: p[2], power,
            ...(headIdx >= 0 && p[headIdx + 1] && { headCurve: p[headIdx + 1] }),
            ...(speedIdx >= 0 && p[speedIdx + 1] && { speed: +p[speedIdx + 1] }),
            ...(patIdx >= 0 && p[patIdx + 1] && { pumpPattern: p[patIdx + 1] }),
          });
        }
        break;
      case "[VALVES]":
        if (p.length >= 6) valves.push({
          id: p[0], node1: p[1], node2: p[2], diameter: +p[3], type: p[4], setting: +p[5],
          ...(p[6] && { minorLoss: +p[6] }),
        });
        break;
      case "[COORDINATES]":
        if (p.length >= 3) coords.push({ id: p[0], x: +p[1], y: +p[2] });
        break;
      case "[VERTICES]":
        if (p.length >= 3) vertices.push({ linkId: p[0], x: +p[1], y: +p[2] });
        break;
      case "[EMITTERS]":
        if (p.length >= 2) emitterMap.set(p[0], +p[1]);
        break;
      case "[STATUS]":
        if (p.length >= 2) statusMap.set(p[0], p[1].toUpperCase());
        break;
      case "[QUALITY]":
        if (p.length >= 2) qualityMap.set(p[0], +p[1]);
        break;
      case "[PATTERNS]":
        if (p.length >= 2) {
          if (!patternAccum.has(p[0])) patternAccum.set(p[0], []);
          patternAccum.get(p[0])!.push(...p.slice(1).map(v => +v));
        }
        break;
      case "[CURVES]":
        if (p.length >= 3) {
          if (!curveAccum.has(p[0])) curveAccum.set(p[0], []);
          curveAccum.get(p[0])!.push({ x: +p[1], y: +p[2] });
        }
        break;
    }
  }

  // Apply emitters, status, quality to nodes
  for (const j of junctions) {
    if (emitterMap.has(j.id)) j.emitter = emitterMap.get(j.id);
    if (qualityMap.has(j.id)) j.quality = qualityMap.get(j.id);
  }
  for (const r of reservoirs) { if (qualityMap.has(r.id)) r.quality = qualityMap.get(r.id); }
  for (const t of tanks) { if (qualityMap.has(t.id)) t.quality = qualityMap.get(t.id); }

  // Apply status to links
  for (const pipe of pipes) { if (statusMap.has(pipe.id)) pipe.status = statusMap.get(pipe.id) === "CLOSED" ? "Fechado" : "Aberto"; }

  // Build patterns
  for (const [id, multipliers] of patternAccum) {
    importedPatterns.push({ id, multipliers });
  }

  // Build curves
  for (const [id, points] of curveAccum) {
    importedCurves.push({ id, type: curveTypeMap.get(id) || "GENERAL", points });
  }

  return { junctions, reservoirs, tanks, pipes, pumps, valves, coords, vertices, patterns: importedPatterns, curves: importedCurves };
}

// ── Generate INP file ──
function generateINP(
  j: Junction[], r: Reservoir[], t: Tank[], p: Pipe[], pu: Pump[], v: Valve[], c: Coord[],
  opts: { headloss: string; units: string; duration: number; timestep: number },
  verts?: Vertex[], pats?: InpPattern[], crvs?: InpCurve[]
): string {
  let out = `[TITLE]\nRede EPANET PRO\n\n[JUNCTIONS]\n;ID    Elev    Demand    Pattern\n`;
  j.forEach(n => { out += ` ${n.id}    ${n.elevation}     ${n.demand}    ${n.pattern || ""}\n`; });
  out += `\n[RESERVOIRS]\n;ID    Head\n`;
  r.forEach(n => { out += ` ${n.id}    ${n.head}\n`; });
  out += `\n[TANKS]\n;ID    Elev    InitLvl    MinLvl    MaxLvl    Diam\n`;
  t.forEach(n => { out += ` ${n.id}    ${n.elevation}     ${n.initLevel}          ${n.minLevel}         ${n.maxLevel}        ${n.diameter}\n`; });
  out += `\n[PIPES]\n;ID    Node1    Node2    Length    Diam    Rough    MinorLoss\n`;
  p.forEach(n => { out += ` ${n.id}    ${n.node1}       ${n.node2}       ${n.length}      ${n.diameter}     ${n.roughness}    ${n.minorLoss || 0}\n`; });
  out += `\n[PUMPS]\n;ID    Node1    Node2    Properties\n`;
  pu.forEach(n => {
    let props = n.headCurve ? `HEAD ${n.headCurve}` : `POWER ${n.power}`;
    if (n.speed !== undefined) props += ` SPEED ${n.speed}`;
    if (n.pumpPattern) props += ` PATTERN ${n.pumpPattern}`;
    out += ` ${n.id}    ${n.node1}       ${n.node2}    ${props}\n`;
  });
  out += `\n[VALVES]\n;ID    Node1    Node2    Diam    Type    Setting    MinorLoss\n`;
  v.forEach(n => { out += ` ${n.id}    ${n.node1}       ${n.node2}       ${n.diameter}     ${n.type}    ${n.setting}    ${n.minorLoss || 0}\n`; });

  // Emitters
  const emitterNodes = j.filter(n => n.emitter !== undefined && n.emitter > 0);
  if (emitterNodes.length > 0) {
    out += `\n[EMITTERS]\n;Junction    Coefficient\n`;
    emitterNodes.forEach(n => { out += ` ${n.id}    ${n.emitter}\n`; });
  }

  // Patterns
  if (pats && pats.length > 0) {
    out += `\n[PATTERNS]\n;ID    Multipliers\n`;
    pats.forEach(pat => {
      // EPANET splits patterns into lines of 6 multipliers
      for (let i = 0; i < pat.multipliers.length; i += 6) {
        const chunk = pat.multipliers.slice(i, i + 6);
        out += ` ${pat.id}    ${chunk.join("    ")}\n`;
      }
    });
  }

  // Curves
  if (crvs && crvs.length > 0) {
    out += `\n[CURVES]\n;ID    X-Value    Y-Value\n`;
    crvs.forEach(crv => {
      out += `;${crv.type}\n`;
      crv.points.forEach(pt => { out += ` ${crv.id}    ${pt.x}    ${pt.y}\n`; });
    });
  }

  // Quality
  const qualityNodes = [...j.filter(n => n.quality !== undefined), ...r.filter(n => n.quality !== undefined), ...t.filter(n => n.quality !== undefined)];
  if (qualityNodes.length > 0) {
    out += `\n[QUALITY]\n;Node    InitQual\n`;
    qualityNodes.forEach(n => { out += ` ${n.id}    ${(n as any).quality}\n`; });
  }

  out += `\n[COORDINATES]\n;Node    X-Coord    Y-Coord\n`;
  c.forEach(n => { out += ` ${n.id}      ${n.x}          ${n.y}\n`; });

  // Vertices
  if (verts && verts.length > 0) {
    out += `\n[VERTICES]\n;Link    X-Coord    Y-Coord\n`;
    verts.forEach(vt => { out += ` ${vt.linkId}      ${vt.x}          ${vt.y}\n`; });
  }

  out += `\n[TIMES]\n Duration           ${opts.duration}:00\n Hydraulic Timestep ${opts.timestep}:00\n Report Timestep    ${opts.timestep}:00\n\n`;
  out += `[OPTIONS]\n Units              ${opts.units}\n Headloss           ${opts.headloss === "hw" ? "H-W" : opts.headloss === "dw" ? "D-W" : "C-M"}\n\n[END]\n`;
  return out;
}

// ── Hazen-Williams simulation ──
function runHWSimulation(junctions: Junction[], reservoirs: Reservoir[], tanks: Tank[], pipes: Pipe[], pumps: Pump[], coords: Coord[]): SimResults {
  const nodeResults: NodeResult[] = [];
  const linkResults: LinkResult[] = [];
  const refHead = reservoirs[0]?.head || 900;
  let cumulativeHf = 0;

  // Reservoirs
  reservoirs.forEach(r => nodeResults.push({ id: r.id, type: "reservoir", elevation: r.head, demand: 0, pressure: 0, head: r.head, status: "OK" }));
  // Tanks
  tanks.forEach(t => nodeResults.push({ id: t.id, type: "tank", elevation: t.elevation, demand: 0, pressure: t.initLevel, head: t.elevation + t.initLevel, status: "OK" }));

  // Junctions
  junctions.forEach((j, i) => {
    const pipe = pipes[i];
    if (pipe) {
      const q = Math.max(j.demand, 0.001) / 1000;
      const D = pipe.diameter / 1000;
      const C = pipe.roughness;
      const L = pipe.length;
      const hf = (10.643 * Math.pow(Math.abs(q), 1.852) * L) / (Math.pow(C, 1.852) * Math.pow(D, 4.87));
      cumulativeHf += hf;
    }
    const pressure = refHead - j.elevation - cumulativeHf;
    const status = pressure < 10 ? "ERROR" : pressure > 50 ? "ERROR" : "OK";
    nodeResults.push({ id: j.id, type: "junction", elevation: j.elevation, demand: j.demand, pressure: +pressure.toFixed(2), head: +(refHead - cumulativeHf).toFixed(2), status });
  });

  // Links
  pipes.forEach((p, i) => {
    const fromJ = junctions.find(j => j.id === p.node1) || junctions[0];
    const q = Math.max(fromJ?.demand || 1, 0.001) / 1000;
    const D = p.diameter / 1000;
    const A = Math.PI * D * D / 4;
    const v = A > 0 ? Math.abs(q / A) : 0;
    const hf = (10.643 * Math.pow(Math.abs(q), 1.852) * p.length) / (Math.pow(p.roughness, 1.852) * Math.pow(D, 4.87));
    const status = v < 0.5 ? "WARN" : v > 3.5 ? "ERROR" : "OK";
    linkResults.push({ id: p.id, type: "pipe", node1: p.node1, node2: p.node2, length: p.length, diameter: p.diameter, flow: +(fromJ?.demand || 1).toFixed(2), velocity: +v.toFixed(3), headloss: +hf.toFixed(4), status });
  });

  // Pumps as links
  pumps.forEach(pu => {
    linkResults.push({ id: pu.id, type: "pump", node1: pu.node1, node2: pu.node2, length: 0, diameter: 0, flow: 0, velocity: 0, headloss: 0, status: "OK" });
  });

  const jPressures = nodeResults.filter(n => n.type === "junction").map(n => n.pressure);
  const velocities = linkResults.filter(l => l.type === "pipe").map(l => l.velocity);

  return {
    nodes: nodeResults, links: linkResults,
    summary: {
      minPressure: jPressures.length > 0 ? Math.min(...jPressures) : 0,
      maxPressure: jPressures.length > 0 ? Math.max(...jPressures) : 0,
      maxVelocity: velocities.length > 0 ? Math.max(...velocities) : 0,
      nodeErrors: nodeResults.filter(n => n.status === "ERROR").length,
      linkErrors: linkResults.filter(l => l.status === "ERROR" || l.status === "WARN").length,
    },
  };
}

function statusBadge(s: string) {
  if (s === "ERROR") return <Badge className="bg-red-500 text-white text-[10px]">ERRO</Badge>;
  if (s === "WARN") return <Badge className="bg-yellow-500 text-white text-[10px]">ALERTA</Badge>;
  return <Badge className="bg-green-500 text-white text-[10px]">OK</Badge>;
}

interface EpanetProModuleProps {
  pontos?: import("@/engine/reader").PontoTopografico[];
  trechos?: import("@/engine/domain").Trecho[];
}

// ── Main Component ──
export const EpanetProModule = ({ pontos: topoPontos = [], trechos: topoTrechos = [] }: EpanetProModuleProps) => {
  const [junctions, setJunctions] = useState<Junction[]>([]);
  const [reservoirs, setReservoirs] = useState<Reservoir[]>([]);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const [coords, setCoords] = useState<Coord[]>([]);
  const [pipeVertices, setPipeVertices] = useState<Vertex[]>([]);
  const [importedPatterns, setImportedPatterns] = useState<InpPattern[]>([]);
  const [importedCurves, setImportedCurves] = useState<InpCurve[]>([]);
  const [results, setResults] = useState<SimResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("network");
  const [mapConnections, setMapConnections] = useState<ConnectionData[]>([]);
  const [selectedPattern, setSelectedPattern] = useState("Residencial");
  // Simulation config
  const [headlossFormula, setHeadlossFormula] = useState("hw");
  const [flowUnits, setFlowUnits] = useState("LPS");
  const [simDuration, setSimDuration] = useState(24);
  const [simTimestep, setSimTimestep] = useState(60);
  const [simPrecision, setSimPrecision] = useState(0.001);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalNodes = junctions.length + reservoirs.length + tanks.length;
  const totalLinks = pipes.length + pumps.length + valves.length;
  const totalExtension = pipes.reduce((s, p) => s + p.length, 0);

  // ── Rebuild map connections from pipes/pumps ──
  const rebuildMapConnections = useCallback((p: Pipe[], pu: Pump[], v: Valve[]) => {
    const conns: ConnectionData[] = [
      ...p.map(pipe => ({ from: pipe.node1, to: pipe.node2, color: "#3b82f6", label: `${pipe.id}: DN${pipe.diameter}` })),
      ...pu.map(pump => ({ from: pump.node1, to: pump.node2, color: "#f59e0b", label: `${pump.id}: Bomba` })),
      ...v.map(valve => ({ from: valve.node1, to: valve.node2, color: "#8b5cf6", label: `${valve.id}: Válvula` })),
    ];
    setMapConnections(conns);
  }, []);

  // ── Load example ──
  const loadExample = useCallback(() => {
    setJunctions([...EXAMPLE_JUNCTIONS]);
    setReservoirs([...EXAMPLE_RESERVOIRS]);
    setTanks([...EXAMPLE_TANKS]);
    setPipes([...EXAMPLE_PIPES]);
    setPumps([...EXAMPLE_PUMPS]);
    setValves([]);
    setCoords([...EXAMPLE_COORDS]);
    setResults(null);
    rebuildMapConnections(EXAMPLE_PIPES, EXAMPLE_PUMPS, []);
    toast.success("Exemplo carregado: 10 junções, 1 reservatório, 1 tanque, 12 tubos, 1 bomba");
  }, [rebuildMapConnections]);

  // ── Import INP ──
  const [fileInputKey, setFileInputKey] = useState(0);
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".inp")) { toast.error("Use arquivos .inp"); return; }
    try {
      const text = await file.text();
      const parsed = parseINP(text);
      if (parsed.junctions.length === 0 && parsed.pipes.length === 0) {
        toast.error("Nenhum dado encontrado no arquivo .INP. Verifique o formato.");
        return;
      }
      setJunctions(parsed.junctions);
      setReservoirs(parsed.reservoirs);
      setTanks(parsed.tanks);
      setPipes(parsed.pipes);
      setPumps(parsed.pumps);
      setValves(parsed.valves);
      setCoords(parsed.coords);
      setPipeVertices(parsed.vertices || []);
      setImportedPatterns(parsed.patterns || []);
      setImportedCurves(parsed.curves || []);
      setResults(null);
      rebuildMapConnections(parsed.pipes, parsed.pumps, parsed.valves);
      const extras: string[] = [];
      if (parsed.vertices && parsed.vertices.length > 0) extras.push(`${parsed.vertices.length} vértices`);
      if (parsed.patterns && parsed.patterns.length > 0) extras.push(`${parsed.patterns.length} padrões`);
      if (parsed.curves && parsed.curves.length > 0) extras.push(`${parsed.curves.length} curvas`);
      const extrasMsg = extras.length > 0 ? `, ${extras.join(", ")}` : "";
      toast.success(`INP importado: ${parsed.junctions.length} junções, ${parsed.pipes.length} tubos, ${parsed.coords.length} coordenadas${extrasMsg}`);
    } catch (err: any) {
      toast.error(`Erro ao importar INP: ${err.message}`);
    }
    setFileInputKey(k => k + 1); // reset file input
  }, [rebuildMapConnections]);

  // ── Run simulation ──
  const runSimulation = useCallback(async () => {
    if (junctions.length === 0) { toast.error("Carregue dados primeiro"); return; }
    setIsRunning(true);
    setProgress(0);
    try {
      // Try epanet-js first
      let epanetUsed = false;
      try {
        const epanetModule = await import("epanet-js");
        const { Project, Workspace } = epanetModule;
        const ws = new Workspace();
        const model = new Project(ws);
        const inpContent = generateINP(junctions, reservoirs, tanks, pipes, pumps, valves, coords, { headloss: headlossFormula, units: flowUnits, duration: simDuration, timestep: simTimestep }, pipeVertices, importedPatterns, importedCurves);
        const encoder = new TextEncoder();
        ws.writeFile("model.inp", encoder.encode(inpContent));
        model.open("model.inp", "report.rpt", "output.bin");
        const nodeCount = model.getCount(0);
        const linkCount = model.getCount(2);

        const nodeRes: NodeResult[] = [];
        const linkRes: LinkResult[] = [];

        model.openH();
        model.initH(11);
        model.runH();

        for (let i = 1; i <= nodeCount; i++) {
          const id = model.getNodeId(i);
          const elev = model.getNodeValue(i, 0);
          const demand = model.getNodeValue(i, 9);
          const pressure = model.getNodeValue(i, 11);
          const head = model.getNodeValue(i, 10);
          const nodeType = model.getNodeType(i);
          const type = nodeType === 0 ? "junction" as const : nodeType === 1 ? "reservoir" as const : "tank" as const;
          const status = type === "junction" ? (pressure < 10 ? "ERROR" : pressure > 50 ? "ERROR" : "OK") : "OK";
          nodeRes.push({ id, type, elevation: elev, demand: +demand.toFixed(2), pressure: +pressure.toFixed(2), head: +head.toFixed(2), status });
        }
        for (let i = 1; i <= linkCount; i++) {
          const id = model.getLinkId(i);
          const length = model.getLinkValue(i, 1);
          const diameter = model.getLinkValue(i, 0);
          const flow = model.getLinkValue(i, 8);
          const velocity = model.getLinkValue(i, 9);
          const headloss = model.getLinkValue(i, 10);
          const linkType = model.getLinkType(i);
          const nodes = model.getLinkNodes(i);
          const type = linkType <= 1 ? "pipe" as const : linkType === 2 ? "pump" as const : "valve" as const;
          const status = type === "pipe" ? (Math.abs(velocity) < 0.5 ? "WARN" : Math.abs(velocity) > 3.5 ? "ERROR" : "OK") : "OK";
          nodeRes.length > 0 && linkRes.push({ id, type, node1: model.getNodeId(nodes.node1), node2: model.getNodeId(nodes.node2), length, diameter, flow: +Math.abs(flow).toFixed(2), velocity: +Math.abs(velocity).toFixed(3), headloss: +Math.abs(headloss).toFixed(4), status });
        }

        model.nextH();
        model.closeH();
        model.close();

        const jp = nodeRes.filter(n => n.type === "junction").map(n => n.pressure);
        const vel = linkRes.filter(l => l.type === "pipe").map(l => l.velocity);
        setResults({
          nodes: nodeRes, links: linkRes,
          summary: { minPressure: jp.length ? Math.min(...jp) : 0, maxPressure: jp.length ? Math.max(...jp) : 0, maxVelocity: vel.length ? Math.max(...vel) : 0, nodeErrors: nodeRes.filter(n => n.status === "ERROR").length, linkErrors: linkRes.filter(l => l.status !== "OK").length }
        });
        epanetUsed = true;
        toast.success("Simulação EPANET-JS (WASM) concluída!");
      } catch (err) {
        console.warn("epanet-js indisponível, usando Hazen-Williams:", err);
      }

      if (!epanetUsed) {
        for (let i = 0; i <= 100; i += 5) { setProgress(i); await new Promise(r => setTimeout(r, 30)); }
        const res = runHWSimulation(junctions, reservoirs, tanks, pipes, pumps, coords);
        setResults(res);
        toast.success("Simulação Hazen-Williams concluída (modo simplificado)");
      }
      setProgress(100);
      setActiveTab("results");
    } catch (err: any) {
      toast.error(`Erro: ${err.message || err}`);
    } finally { setIsRunning(false); }
  }, [junctions, reservoirs, tanks, pipes, pumps, valves, coords, headlossFormula, flowUnits, simDuration, simTimestep]);

  const clearAll = useCallback(() => {
    setJunctions([]); setReservoirs([]); setTanks([]); setPipes([]); setPumps([]); setValves([]); setCoords([]);
    setResults(null); setMapConnections([]);
    toast.info("Dados limpos");
  }, []);

  const exportCSV = useCallback(() => {
    if (!results) return;
    const lines = ["tipo;id;elevacao;demanda;pressao;head;status"];
    results.nodes.forEach(n => lines.push(`${n.type};${n.id};${n.elevation};${n.demand};${n.pressure};${n.head};${n.status}`));
    lines.push(""); lines.push("tipo;id;node1;node2;comprimento;diametro;vazao;velocidade;perda_carga;status");
    results.links.forEach(l => lines.push(`${l.type};${l.id};${l.node1};${l.node2};${l.length};${l.diameter};${l.flow};${l.velocity};${l.headloss};${l.status}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "epanet_results.csv"; a.click();
    toast.success("CSV exportado");
  }, [results]);

  const exportINP = useCallback(() => {
    const content = generateINP(junctions, reservoirs, tanks, pipes, pumps, valves, coords, { headloss: headlossFormula, units: flowUnits, duration: simDuration, timestep: simTimestep }, pipeVertices, importedPatterns, importedCurves);
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "model.inp"; a.click();
    toast.success("INP exportado");
  }, [junctions, reservoirs, tanks, pipes, pumps, valves, coords, headlossFormula, flowUnits, simDuration, simTimestep]);

  // ── Map nodes ──
  const mapNodes = useMemo<NodeData[]>(() => {
    return coords.map(c => {
      const j = junctions.find(jj => jj.id === c.id);
      const r = reservoirs.find(rr => rr.id === c.id);
      const t = tanks.find(tt => tt.id === c.id);
      // Check if coords are already large (UTM from topography import) or small (relative EPANET coords)
      const isLargeCoords = Math.abs(c.x) > 1000 || Math.abs(c.y) > 100000;
      const x = isLargeCoords ? c.x : c.x * 10 + 350000;
      const y = isLargeCoords ? c.y : c.y * 10 + 7400000;
      return { id: c.id, x, y, cota: j?.elevation ?? r?.head ?? t?.elevation ?? 0, demanda: j?.demand ?? 0, label: r ? "Reservatório" : t ? "Tanque" : "Junção" };
    });
  }, [coords, junctions, reservoirs, tanks]);

  // Chart data
  const pressureChartData = useMemo(() => results?.nodes.filter(n => n.type === "junction").map(n => ({ name: n.id, pressao: n.pressure, elevacao: n.elevation })) || [], [results]);
  const flowChartData = useMemo(() => results?.links.filter(l => l.type === "pipe").map(l => ({ name: l.id, vazao: l.flow, velocidade: l.velocity })) || [], [results]);
  // Merge default patterns with imported patterns
  const allPatterns = useMemo(() => {
    const merged: Record<string, number[]> = { ...DEMAND_PATTERNS };
    for (const p of importedPatterns) {
      merged[p.id] = p.multipliers;
    }
    return merged;
  }, [importedPatterns]);

  const patternChartData = useMemo(() => (allPatterns[selectedPattern] || []).map((v, i) => ({ hora: `${i}h`, multiplicador: v })), [selectedPattern, allPatterns]);

  // Editable table helpers
  const updateJunction = (idx: number, field: keyof Junction, val: string | number) => {
    const u = [...junctions]; (u[idx] as any)[field] = val; setJunctions(u);
  };
  const updatePipe = (idx: number, field: keyof Pipe, val: string | number) => {
    const u = [...pipes]; (u[idx] as any)[field] = val; setPipes(u); rebuildMapConnections(u, pumps, valves);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Droplets className="h-6 w-6 text-blue-600" />
            EPANET PRO — Simulador Hidráulico
          </CardTitle>
          <CardDescription>Carregue .INP, edite tabelas, simule e visualize resultados. Powered by epanet-js (WASM).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mb-4">
            {[
              { icon: "📍", value: junctions.length, label: "Junções", color: "text-blue-600" },
              { icon: "🏔️", value: reservoirs.length, label: "Reservatórios", color: "text-amber-600" },
              { icon: "🟦", value: tanks.length, label: "Tanques", color: "text-cyan-600" },
              { icon: "➖", value: pipes.length, label: "Tubos", color: "text-green-600" },
              { icon: "⚡", value: pumps.length, label: "Bombas", color: "text-purple-600" },
              { icon: "🔧", value: valves.length, label: "Válvulas", color: "text-orange-600" },
              { icon: "📏", value: `${totalExtension.toFixed(0)}m`, label: "Extensão", color: "text-indigo-600" },
            ].map((s, i) => (
              <div key={i} className="bg-white dark:bg-card border rounded-xl p-2 text-center">
                <div className="text-lg">{s.icon}</div>
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[9px] font-medium text-muted-foreground uppercase">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <input ref={fileInputRef} type="file" accept=".inp,.INP" className="hidden" onChange={handleFileUpload} key={fileInputKey} />
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Importar .INP</Button>
            <Button variant="outline" onClick={loadExample}>📂 Carregar Exemplo</Button>
            <Button variant="outline" onClick={() => {
              if (topoPontos.length === 0 || topoTrechos.length === 0) { toast.error("Carregue dados na Topografia primeiro"); return; }
              const newJunctions: Junction[] = topoPontos.map(p => ({ id: p.id, elevation: p.cota, demand: 1.0, pattern: "Residencial" }));
              const newCoords: Coord[] = topoPontos.map(p => ({ id: p.id, x: p.x, y: p.y }));
              const newPipes: Pipe[] = topoTrechos.map((t, i) => ({ id: `P${i + 1}`, node1: t.idInicio, node2: t.idFim, length: t.comprimento, diameter: t.diametroMm, roughness: 130, material: t.material, status: "Aberto" }));
              setJunctions(newJunctions); setReservoirs([]); setTanks([]); setPipes(newPipes); setPumps([]); setValves([]); setCoords(newCoords);
              setResults(null); rebuildMapConnections(newPipes, [], []);
              toast.success(`Importado da Topografia: ${newJunctions.length} junções, ${newPipes.length} tubos`);
            }} disabled={topoPontos.length === 0}>
              <MapPin className="h-4 w-4 mr-1" /> Importar da Topografia
            </Button>
            <Button onClick={runSimulation} disabled={totalNodes === 0 || isRunning} className="bg-green-600 hover:bg-green-700 text-white">
              {isRunning ? <><Pause className="h-4 w-4 mr-1" /> Simulando...</> : <><Play className="h-4 w-4 mr-1" /> Executar Simulação</>}
            </Button>
            <Button variant="outline" onClick={exportINP} disabled={totalNodes === 0}><Download className="h-4 w-4 mr-1" /> Exportar .INP</Button>
            <Button variant="outline" onClick={exportCSV} disabled={!results}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Button variant="destructive" onClick={clearAll}><Trash2 className="h-4 w-4 mr-1" /> Limpar</Button>
          </div>
          {isRunning && <div className="mt-3"><Progress value={progress} className="h-2" /></div>}
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="network">🗺️ Rede</TabsTrigger>
          <TabsTrigger value="junctions">📍 Junções</TabsTrigger>
          <TabsTrigger value="pipes">➖ Tubos</TabsTrigger>
          <TabsTrigger value="elements">🔧 Elementos</TabsTrigger>
          <TabsTrigger value="config">⚙️ Configuração</TabsTrigger>
          <TabsTrigger value="patterns">📊 Padrões</TabsTrigger>
          <TabsTrigger value="results">📈 Resultados</TabsTrigger>
          <TabsTrigger value="charts">📉 Gráficos</TabsTrigger>
        </TabsList>

        {/* Network Map */}
        <TabsContent value="network">
          {mapNodes.length > 0 ? (
            <NodeMapWidget
              nodes={mapNodes}
              connections={mapConnections}
              onConnectionsChange={setMapConnections}
              onNodeClick={(id) => {}}
              onNodeDemandChange={(id, d) => {
                setJunctions(junctions.map(j => j.id === id ? { ...j, demand: d } : j));
              }}
              onNodesDelete={(ids) => {
                const idSet = new Set(ids);
                setJunctions(prev => prev.filter(j => !idSet.has(j.id)));
                setReservoirs(prev => prev.filter(r => !idSet.has(r.id)));
                setTanks(prev => prev.filter(t => !idSet.has(t.id)));
                setCoords(prev => prev.filter(c => !idSet.has(c.id)));
                setPipes(prev => prev.filter(p => !idSet.has(p.node1) && !idSet.has(p.node2)));
                setResults(null);
              }}
              title="Rede Hidráulica EPANET PRO"
              accentColor="#3b82f6"
              height={500}
              editable
            />
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Droplets className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Carregue um modelo ou use o exemplo para visualizar a rede</p>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* Editable Junctions Table */}
        <TabsContent value="junctions">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                Junções ({junctions.length})
                <Button size="sm" onClick={() => { setJunctions([...junctions, { id: `J${junctions.length + 1}`, elevation: 800, demand: 1.0, pattern: "Residencial" }]); setCoords([...coords, { id: `J${junctions.length + 1}`, x: Math.random() * 500, y: Math.random() * 300 }]); }}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>ID</TableHead><TableHead>Elevação (m)</TableHead><TableHead>Demanda (L/s)</TableHead><TableHead>Padrão</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {junctions.map((j, idx) => (
                      <TableRow key={j.id}>
                        <TableCell><Input className="h-7 w-20 text-xs" value={j.id} onChange={e => updateJunction(idx, "id", e.target.value)} /></TableCell>
                        <TableCell><Input className="h-7 w-24 text-xs" type="number" value={j.elevation} onChange={e => updateJunction(idx, "elevation", +e.target.value)} /></TableCell>
                        <TableCell><Input className="h-7 w-24 text-xs" type="number" step="0.1" value={j.demand} onChange={e => updateJunction(idx, "demand", +e.target.value)} /></TableCell>
                        <TableCell>
                          <Select value={j.pattern} onValueChange={v => updateJunction(idx, "pattern", v)}>
                            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.keys(allPatterns).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setJunctions(junctions.filter((_, i) => i !== idx)); setCoords(coords.filter(c => c.id !== j.id)); }}><X className="h-3 w-3" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Reservoirs & Tanks inline */}
              <div className="mt-4 space-y-3">
                <h4 className="text-sm font-semibold flex items-center justify-between">
                  Reservatórios ({reservoirs.length})
                  <Button size="sm" variant="outline" onClick={() => { setReservoirs([...reservoirs, { id: `R${reservoirs.length + 1}`, head: 900, pattern: "" }]); setCoords([...coords, { id: `R${reservoirs.length + 1}`, x: 0, y: Math.random() * 300 }]); }}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                </h4>
                {reservoirs.map((r, idx) => (
                  <div key={r.id} className="flex gap-2 items-center bg-muted/30 rounded p-2">
                    <Input className="h-7 w-20 text-xs" value={r.id} onChange={e => { const u = [...reservoirs]; u[idx].id = e.target.value; setReservoirs(u); }} />
                    <Label className="text-xs">Head (m):</Label>
                    <Input className="h-7 w-24 text-xs" type="number" value={r.head} onChange={e => { const u = [...reservoirs]; u[idx].head = +e.target.value; setReservoirs(u); }} />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setReservoirs(reservoirs.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
                <h4 className="text-sm font-semibold flex items-center justify-between">
                  Tanques ({tanks.length})
                  <Button size="sm" variant="outline" onClick={() => { setTanks([...tanks, { id: `T${tanks.length + 1}`, elevation: 860, initLevel: 3, minLevel: 0, maxLevel: 8, diameter: 12 }]); setCoords([...coords, { id: `T${tanks.length + 1}`, x: Math.random() * 500, y: Math.random() * 300 }]); }}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                </h4>
                {tanks.map((t, idx) => (
                  <div key={t.id} className="flex gap-2 items-center bg-muted/30 rounded p-2 flex-wrap">
                    <Input className="h-7 w-16 text-xs" value={t.id} onChange={e => { const u = [...tanks]; u[idx].id = e.target.value; setTanks(u); }} />
                    <Input className="h-7 w-20 text-xs" type="number" placeholder="Elev" value={t.elevation} onChange={e => { const u = [...tanks]; u[idx].elevation = +e.target.value; setTanks(u); }} />
                    <Input className="h-7 w-16 text-xs" type="number" placeholder="Init" value={t.initLevel} onChange={e => { const u = [...tanks]; u[idx].initLevel = +e.target.value; setTanks(u); }} />
                    <Input className="h-7 w-16 text-xs" type="number" placeholder="Min" value={t.minLevel} onChange={e => { const u = [...tanks]; u[idx].minLevel = +e.target.value; setTanks(u); }} />
                    <Input className="h-7 w-16 text-xs" type="number" placeholder="Max" value={t.maxLevel} onChange={e => { const u = [...tanks]; u[idx].maxLevel = +e.target.value; setTanks(u); }} />
                    <Input className="h-7 w-16 text-xs" type="number" placeholder="Diam" value={t.diameter} onChange={e => { const u = [...tanks]; u[idx].diameter = +e.target.value; setTanks(u); }} />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setTanks(tanks.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Editable Pipes Table */}
        <TabsContent value="pipes">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                Tubos ({pipes.length})
                <Button size="sm" onClick={() => { const allNodes = [...junctions.map(j => j.id), ...reservoirs.map(r => r.id), ...tanks.map(t => t.id)]; setPipes([...pipes, { id: `P${pipes.length + 1}`, node1: allNodes[0] || "", node2: allNodes[1] || "", length: 200, diameter: 150, roughness: 130, material: "PVC", status: "Aberto" }]); }}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>ID</TableHead><TableHead>Nó1</TableHead><TableHead>Nó2</TableHead>
                    <TableHead>Comp (m)</TableHead><TableHead>DN (mm)</TableHead><TableHead>Rugos.</TableHead>
                    <TableHead>Material</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {pipes.map((p, idx) => (
                      <TableRow key={p.id}>
                        <TableCell><Input className="h-7 w-16 text-xs" value={p.id} onChange={e => updatePipe(idx, "id", e.target.value)} /></TableCell>
                        <TableCell><Input className="h-7 w-16 text-xs" value={p.node1} onChange={e => updatePipe(idx, "node1", e.target.value)} /></TableCell>
                        <TableCell><Input className="h-7 w-16 text-xs" value={p.node2} onChange={e => updatePipe(idx, "node2", e.target.value)} /></TableCell>
                        <TableCell><Input className="h-7 w-20 text-xs" type="number" value={p.length} onChange={e => updatePipe(idx, "length", +e.target.value)} /></TableCell>
                        <TableCell><Input className="h-7 w-20 text-xs" type="number" value={p.diameter} onChange={e => updatePipe(idx, "diameter", +e.target.value)} /></TableCell>
                        <TableCell><Input className="h-7 w-16 text-xs" type="number" value={p.roughness} onChange={e => updatePipe(idx, "roughness", +e.target.value)} /></TableCell>
                        <TableCell>
                          <Select value={p.material} onValueChange={v => updatePipe(idx, "material", v)}>
                            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["PVC", "PEAD", "Ferro Fundido", "Concreto", "Aço"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{p.status}</Badge></TableCell>
                        <TableCell><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { const u = pipes.filter((_, i) => i !== idx); setPipes(u); rebuildMapConnections(u, pumps, valves); }}><X className="h-3 w-3" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pumps & Valves */}
        <TabsContent value="elements">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  Bombas ({pumps.length})
                  <Button size="sm" onClick={() => setPumps([...pumps, { id: `B${pumps.length + 1}`, node1: "", node2: "", power: 10 }])}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pumps.map((p, idx) => (
                  <div key={p.id} className="flex gap-2 items-center bg-muted/30 rounded p-2 mb-2">
                    <Input className="h-7 w-16 text-xs" value={p.id} onChange={e => { const u = [...pumps]; u[idx].id = e.target.value; setPumps(u); }} />
                    <Input className="h-7 w-16 text-xs" placeholder="Nó1" value={p.node1} onChange={e => { const u = [...pumps]; u[idx].node1 = e.target.value; setPumps(u); rebuildMapConnections(pipes, u, valves); }} />
                    <Input className="h-7 w-16 text-xs" placeholder="Nó2" value={p.node2} onChange={e => { const u = [...pumps]; u[idx].node2 = e.target.value; setPumps(u); rebuildMapConnections(pipes, u, valves); }} />
                    <Label className="text-xs">kW:</Label>
                    <Input className="h-7 w-20 text-xs" type="number" value={p.power} onChange={e => { const u = [...pumps]; u[idx].power = +e.target.value; setPumps(u); }} />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { const u = pumps.filter((_, i) => i !== idx); setPumps(u); rebuildMapConnections(pipes, u, valves); }}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  Válvulas ({valves.length})
                  <Button size="sm" onClick={() => setValves([...valves, { id: `V${valves.length + 1}`, node1: "", node2: "", diameter: 150, type: "PRV", setting: 30 }])}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {valves.map((v, idx) => (
                  <div key={v.id} className="flex gap-2 items-center bg-muted/30 rounded p-2 mb-2 flex-wrap">
                    <Input className="h-7 w-16 text-xs" value={v.id} onChange={e => { const u = [...valves]; u[idx].id = e.target.value; setValves(u); }} />
                    <Input className="h-7 w-16 text-xs" placeholder="Nó1" value={v.node1} onChange={e => { const u = [...valves]; u[idx].node1 = e.target.value; setValves(u); rebuildMapConnections(pipes, pumps, u); }} />
                    <Input className="h-7 w-16 text-xs" placeholder="Nó2" value={v.node2} onChange={e => { const u = [...valves]; u[idx].node2 = e.target.value; setValves(u); rebuildMapConnections(pipes, pumps, u); }} />
                    <Input className="h-7 w-20 text-xs" type="number" placeholder="DN" value={v.diameter} onChange={e => { const u = [...valves]; u[idx].diameter = +e.target.value; setValves(u); }} />
                    <Select value={v.type} onValueChange={val => { const u = [...valves]; u[idx].type = val; setValves(u); }}>
                      <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{["PRV", "PSV", "FCV", "TCV"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input className="h-7 w-20 text-xs" type="number" placeholder="Setting" value={v.setting} onChange={e => { const u = [...valves]; u[idx].setting = +e.target.value; setValves(u); }} />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { const u = valves.filter((_, i) => i !== idx); setValves(u); rebuildMapConnections(pipes, pumps, u); }}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Simulation Config */}
        <TabsContent value="config">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Settings2 className="h-4 w-4" /> Configuração da Simulação</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><Label>Fórmula de Perda de Carga</Label>
                <Select value={headlossFormula} onValueChange={setHeadlossFormula}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hw">Hazen-Williams (padrão)</SelectItem>
                    <SelectItem value="dw">Darcy-Weisbach</SelectItem>
                    <SelectItem value="cm">Chezy-Manning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Unidades de Vazão</Label>
                <Select value={flowUnits} onValueChange={setFlowUnits}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LPS">LPS (L/s)</SelectItem>
                    <SelectItem value="CMH">CMH (m³/h)</SelectItem>
                    <SelectItem value="GPM">GPM (gal/min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Duração (horas)</Label><Input type="number" value={simDuration} onChange={e => setSimDuration(+e.target.value)} /></div>
              <div><Label>Timestep Hidráulico (min)</Label><Input type="number" value={simTimestep} onChange={e => setSimTimestep(+e.target.value)} /></div>
              <div><Label>Precisão</Label><Input type="number" step="0.001" value={simPrecision} onChange={e => setSimPrecision(+e.target.value)} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demand Patterns */}
        <TabsContent value="patterns">
          <Card>
            <CardHeader><CardTitle className="text-sm">Padrões de Demanda (Multiplicador Horário)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {Object.keys(allPatterns).map(p => (
                  <Button key={p} size="sm" variant={selectedPattern === p ? "default" : "outline"} onClick={() => setSelectedPattern(p)}>{p}</Button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={patternChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hora" fontSize={10} />
                  <YAxis fontSize={10} domain={[0, 2]} />
                  <RechartsTooltip />
                  <Bar dataKey="multiplicador" name="Multiplicador" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground">
                {selectedPattern === "Residencial" && "Picos pela manhã (7-9h) e noite (18-20h)"}
                {selectedPattern === "Comercial" && "Pico em horário comercial (8-17h)"}
                {selectedPattern === "Industrial" && "Consumo constante durante operação (6-18h)"}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results */}
        <TabsContent value="results">
          {results ? (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Pressão Mín", value: `${results.summary.minPressure.toFixed(1)} mca`, color: results.summary.minPressure < 10 ? "text-red-600" : "text-green-600" },
                  { label: "Pressão Máx", value: `${results.summary.maxPressure.toFixed(1)} mca`, color: "text-blue-600" },
                  { label: "Vel. Máx", value: `${results.summary.maxVelocity.toFixed(2)} m/s`, color: results.summary.maxVelocity > 3.5 ? "text-red-600" : "text-green-600" },
                  { label: "Nós com Erro", value: results.summary.nodeErrors, color: results.summary.nodeErrors > 0 ? "text-red-600" : "text-green-600" },
                  { label: "Tubos com Erro", value: results.summary.linkErrors, color: results.summary.linkErrors > 0 ? "text-yellow-600" : "text-green-600" },
                ].map((s, i) => (
                  <div key={i} className="bg-muted/50 border rounded-xl p-3 text-center">
                    <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] font-medium text-muted-foreground uppercase">{s.label}</div>
                  </div>
                ))}
              </div>

              {results.summary.nodeErrors > 0 && (
                <Card className="border-red-300 bg-red-50/50 dark:bg-red-950/10">
                  <CardContent className="pt-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <span className="text-sm text-red-700 dark:text-red-400 font-medium">
                      Pressão crítica em: {results.nodes.filter(n => n.status === "ERROR").map(n => n.id).join(", ")}
                    </span>
                  </CardContent>
                </Card>
              )}

              {/* Node results */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Resultados por Nó</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>ID</TableHead><TableHead>Tipo</TableHead><TableHead>Elevação</TableHead>
                        <TableHead>Demanda</TableHead><TableHead>Pressão (mca)</TableHead><TableHead>Head</TableHead><TableHead>Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {results.nodes.map(n => (
                          <TableRow key={n.id}>
                            <TableCell className="font-medium">{n.id}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{n.type === "junction" ? "Junção" : n.type === "reservoir" ? "Reserv." : "Tanque"}</Badge></TableCell>
                            <TableCell>{n.elevation}m</TableCell>
                            <TableCell>{n.demand} L/s</TableCell>
                            <TableCell>{n.pressure}</TableCell>
                            <TableCell>{n.head}</TableCell>
                            <TableCell>{statusBadge(n.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Link results */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Resultados por Tubo</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>ID</TableHead><TableHead>Tipo</TableHead><TableHead>De → Para</TableHead>
                        <TableHead>Vazão (L/s)</TableHead><TableHead>V (m/s)</TableHead><TableHead>hf (m)</TableHead><TableHead>Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {results.links.map(l => (
                          <TableRow key={l.id}>
                            <TableCell className="font-medium">{l.id}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{l.type === "pipe" ? "Tubo" : l.type === "pump" ? "Bomba" : "Válvula"}</Badge></TableCell>
                            <TableCell className="text-xs">{l.node1} → {l.node2}</TableCell>
                            <TableCell>{l.flow}</TableCell>
                            <TableCell>{l.velocity}</TableCell>
                            <TableCell>{l.headloss}</TableCell>
                            <TableCell>{statusBadge(l.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Droplets className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Execute a simulação para ver os resultados</p>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* Charts */}
        <TabsContent value="charts">
          {results ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Pressão por Junção</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={pressureChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis fontSize={10} />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="pressao" name="Pressão (mca)" fill="#3b82f6" />
                      <Bar dataKey="elevacao" name="Elevação (m)" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Vazão e Velocidade por Tubo</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={flowChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis fontSize={10} />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="vazao" name="Vazão (L/s)" fill="#f59e0b" />
                      <Bar dataKey="velocidade" name="Velocidade (m/s)" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Execute a simulação para ver gráficos.</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
