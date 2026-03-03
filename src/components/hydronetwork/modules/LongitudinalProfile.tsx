/**
 * LongitudinalProfile — Recharts-based longitudinal profile for sewer collectors.
 * Shows: terrain line, pipe crown/invert, water level, PV depths, annotations.
 * Replaces QEsg's matplotlib profile with an interactive web chart.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Activity, Info } from "lucide-react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { SewerEdgeAttributes, SewerNodeAttributes } from "./AttributeTableEditor";
import type { SewerSegmentResult } from "@/engine/qesgEngine";

// ══════════════════════════════════════
// Types
// ══════════════════════════════════════

export interface ProfileDataPoint {
  distancia: number;       // Cumulative distance (m)
  cotaTerreno: number;     // Terrain elevation
  cotaColetor: number;     // Collector invert elevation
  cotaCoroa: number;       // Pipe crown elevation
  laminaDagua: number;     // Water level elevation
  nodeId: string;          // PV / node identifier
  diametro: number;        // Pipe diameter (mm)
  declividade: number;     // Slope
  profundidade: number;    // PV depth
}

export interface LongitudinalProfileProps {
  // Sewer profile data
  sewerNodes: SewerNodeAttributes[];
  sewerEdges: SewerEdgeAttributes[];
  results?: SewerSegmentResult[];
  // Water pressure profile (alternate mode)
  mode?: "sewer" | "water";
  pressureData?: { nodeId: string; distancia: number; cota: number; pressao: number; linhaP: number }[];
}

// ══════════════════════════════════════
// Helpers
// ══════════════════════════════════════

function buildProfileData(
  nodes: SewerNodeAttributes[],
  edges: SewerEdgeAttributes[],
  results?: SewerSegmentResult[]
): { collectors: Map<string, ProfileDataPoint[]>; allPoints: ProfileDataPoint[] } {
  const collectors = new Map<string, ProfileDataPoint[]>();

  if (edges.length === 0) return { collectors, allPoints: [] };

  // Group edges by dcId prefix (e.g., "C001", "C002" → collector groups)
  // For simplicity, build a single sequential profile from edges
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const resultMap = new Map(results?.map(r => [r.id, r]) || []);

  // Build graph: find collector paths (chains of connected edges)
  const adjacency = new Map<string, SewerEdgeAttributes[]>();
  const inDegree = new Map<string, number>();
  const allNodeIds = new Set<string>();

  for (const e of edges) {
    allNodeIds.add(e.idInicio);
    allNodeIds.add(e.idFim);
    const list = adjacency.get(e.idInicio) || [];
    list.push(e);
    adjacency.set(e.idInicio, list);
    inDegree.set(e.idFim, (inDegree.get(e.idFim) || 0) + 1);
    if (!inDegree.has(e.idInicio)) inDegree.set(e.idInicio, 0);
  }

  // Find head nodes (in-degree 0)
  const headNodes: string[] = [];
  for (const [nodeId, deg] of inDegree) {
    if (deg === 0 && adjacency.has(nodeId)) headNodes.push(nodeId);
  }
  if (headNodes.length === 0 && edges.length > 0) {
    headNodes.push(edges[0].idInicio);
  }

  // Trace each collector path
  let collectorIdx = 0;
  const visited = new Set<string>();

  for (const head of headNodes) {
    let current = head;
    let cumDist = 0;
    const points: ProfileDataPoint[] = [];
    collectorIdx++;
    const collName = `Coletor ${collectorIdx}`;

    // Add starting node
    const startNode = nodeMap.get(current);
    if (startNode) {
      points.push({
        distancia: 0,
        cotaTerreno: startNode.cotaTerreno,
        cotaColetor: startNode.cotaFundo,
        cotaCoroa: startNode.cotaFundo,
        laminaDagua: startNode.cotaFundo,
        nodeId: startNode.id,
        diametro: 0,
        declividade: 0,
        profundidade: startNode.profundidade,
      });
    }

    while (adjacency.has(current)) {
      const nextEdges = adjacency.get(current) || [];
      const edge = nextEdges.find(e => !visited.has(e.key));
      if (!edge) break;
      visited.add(edge.key);

      cumDist += edge.comprimento;
      const endNode = nodeMap.get(edge.idFim);
      const result = resultMap.get(edge.key) || resultMap.get(`${edge.idInicio}-${edge.idFim}`);
      const diamM = (result?.diametroMm || edge.diametro) / 1000;
      const yd = result?.laminaDagua || 0;

      points.push({
        distancia: Math.round(cumDist * 10) / 10,
        cotaTerreno: endNode?.cotaTerreno ?? edge.cotaTerrenoJ,
        cotaColetor: endNode?.cotaFundo ?? edge.cotaColetorJ,
        cotaCoroa: (endNode?.cotaFundo ?? edge.cotaColetorJ) + diamM,
        laminaDagua: (endNode?.cotaFundo ?? edge.cotaColetorJ) + yd * diamM,
        nodeId: edge.idFim,
        diametro: result?.diametroMm || edge.diametro,
        declividade: edge.declividade,
        profundidade: endNode?.profundidade ?? (edge.cotaTerrenoJ - edge.cotaColetorJ),
      });

      current = edge.idFim;
    }

    if (points.length > 1) {
      collectors.set(collName, points);
    }
  }

  const allPoints = Array.from(collectors.values()).flat();
  return { collectors, allPoints };
}

// ══════════════════════════════════════
// Component
// ══════════════════════════════════════

export function LongitudinalProfile({
  sewerNodes,
  sewerEdges,
  results,
  mode = "sewer",
  pressureData,
}: LongitudinalProfileProps) {
  const { collectors, allPoints } = useMemo(
    () => buildProfileData(sewerNodes, sewerEdges, results),
    [sewerNodes, sewerEdges, results]
  );

  const collectorNames = useMemo(() => Array.from(collectors.keys()), [collectors]);
  const [selectedCollector, setSelectedCollector] = useState<string>(collectorNames[0] || "");

  const activeData = selectedCollector
    ? collectors.get(selectedCollector) || []
    : allPoints;

  // ── Water pressure profile mode ──
  if (mode === "water" && pressureData && pressureData.length > 0) {
    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Perfil Piezométrico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={pressureData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="distancia" label={{ value: "Distância (m)", position: "insideBottom", offset: -5 }} />
              <YAxis label={{ value: "Cota (m)", angle: -90, position: "insideLeft" }} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${value.toFixed(2)} m`,
                  name === "cota" ? "Terreno" : name === "linhaP" ? "Linha Piezométrica" : name,
                ]}
              />
              <Legend />
              <Line type="monotone" dataKey="cota" stroke="#8B5CF6" name="Terreno" dot={true} strokeWidth={2} />
              <Line type="monotone" dataKey="linhaP" stroke="#3B82F6" name="Linha Piezométrica" strokeDasharray="5 5" strokeWidth={2} />
              <Area type="monotone" dataKey="pressao" fill="#3B82F680" stroke="none" name="Pressão (mca)" />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-2 flex-wrap">
            {pressureData.map(p => (
              <Badge key={p.nodeId} variant="outline" className="text-xs">
                {p.nodeId}: {p.pressao.toFixed(1)} mca
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Empty state ──
  if (allPoints.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            Execute o dimensionamento primeiro para visualizar o perfil longitudinal.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate Y axis domain with some padding (safe for large arrays)
  let minY = Infinity, maxY = -Infinity;
  for (const p of activeData) {
    const low = Math.min(p.cotaColetor, p.cotaTerreno);
    if (low < minY) minY = low;
    if (p.cotaTerreno > maxY) maxY = p.cotaTerreno;
  }
  if (!isFinite(minY)) minY = 0;
  if (!isFinite(maxY)) maxY = 1;
  const yPadding = (maxY - minY) * 0.1 || 1;

  return (
    <div className="space-y-4">
      {/* Collector selector */}
      {collectorNames.length > 1 && (
        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium">Coletor:</span>
          <Select value={selectedCollector} onValueChange={setSelectedCollector}>
            <SelectTrigger className="w-[200px] h-8 text-sm">
              <SelectValue placeholder="Selecionar coletor" />
            </SelectTrigger>
            <SelectContent>
              {collectorNames.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs">
            {activeData.length} pontos
          </Badge>
        </div>
      )}

      {/* Profile chart */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Perfil Longitudinal {selectedCollector ? `— ${selectedCollector}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={activeData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="distancia"
                label={{ value: "Distância (m)", position: "insideBottom", offset: -5 }}
              />
              <YAxis
                domain={[Math.floor(minY - yPadding), Math.ceil(maxY + yPadding)]}
                label={{ value: "Cota (m)", angle: -90, position: "insideLeft" }}
              />
              <Tooltip content={<ProfileTooltip />} />
              <Legend />

              {/* Terrain line */}
              <Area
                type="monotone"
                dataKey="cotaTerreno"
                stroke="#8B7355"
                fill="#D2B48C40"
                strokeWidth={2}
                name="Terreno"
                dot={true}
              />

              {/* Collector invert */}
              <Line
                type="monotone"
                dataKey="cotaColetor"
                stroke="#EF4444"
                strokeWidth={2}
                name="Coletor (geratriz inferior)"
                dot={{ fill: "#EF4444", r: 3 }}
              />

              {/* Pipe crown */}
              <Line
                type="monotone"
                dataKey="cotaCoroa"
                stroke="#F97316"
                strokeWidth={1}
                strokeDasharray="4 2"
                name="Geratriz superior"
                dot={false}
              />

              {/* Water level */}
              <Line
                type="monotone"
                dataKey="laminaDagua"
                stroke="#3B82F6"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                name="Lâmina d'água"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Annotation table */}
      <Card>
        <CardHeader className="py-2">
          <CardTitle className="text-xs flex items-center gap-1">
            <Info className="h-3 w-3" /> Dados do Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[200px] overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-1 text-left">Nó</th>
                  <th className="px-2 py-1 text-right">Dist (m)</th>
                  <th className="px-2 py-1 text-right">CT (m)</th>
                  <th className="px-2 py-1 text-right">CF (m)</th>
                  <th className="px-2 py-1 text-right">Prof (m)</th>
                  <th className="px-2 py-1 text-right">DN (mm)</th>
                  <th className="px-2 py-1 text-right">Decl (%)</th>
                </tr>
              </thead>
              <tbody>
                {activeData.map((p, i) => (
                  <tr key={`${p.nodeId}-${i}`} className="border-b hover:bg-muted/50">
                    <td className="px-2 py-1 font-mono">{p.nodeId}</td>
                    <td className="px-2 py-1 text-right">{p.distancia.toFixed(1)}</td>
                    <td className="px-2 py-1 text-right">{p.cotaTerreno.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right">{p.cotaColetor.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right">{p.profundidade.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right">{p.diametro || "—"}</td>
                    <td className="px-2 py-1 text-right">{p.declividade ? (p.declividade * 100).toFixed(3) + "%" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Custom tooltip ──

function ProfileTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as ProfileDataPoint | undefined;
  if (!data) return null;

  return (
    <div className="bg-background border p-2 shadow-lg text-xs space-y-1">
      <p className="font-medium">{data.nodeId} — {data.distancia.toFixed(1)} m</p>
      <p>Terreno: <span className="font-mono">{data.cotaTerreno.toFixed(2)} m</span></p>
      <p>Coletor: <span className="font-mono">{data.cotaColetor.toFixed(2)} m</span></p>
      <p>Coroa: <span className="font-mono">{data.cotaCoroa.toFixed(2)} m</span></p>
      <p>Lâmina: <span className="font-mono">{data.laminaDagua.toFixed(2)} m</span></p>
      <p>Prof: <span className="font-mono">{data.profundidade.toFixed(2)} m</span></p>
      {data.diametro > 0 && <p>DN: <span className="font-mono">{data.diametro} mm</span></p>}
    </div>
  );
}
