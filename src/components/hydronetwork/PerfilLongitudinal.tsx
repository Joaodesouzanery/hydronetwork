/**
 * Perfil Longitudinal — SVG-based longitudinal profile visualization
 * Shows terrain line, pipe invert line, manholes (PVs), and segment info.
 */
import { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, ZoomIn, ZoomOut, Maximize, Activity, Info } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";

interface PerfilLongitudinalProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
}

interface ProfileNode {
  id: string;
  cumulativeDist: number;
  cotaTerreno: number;
  cotaTubo: number; // pipe invert = terrain - depth
  profundidade: number; // depth
}

interface ProfileSegment {
  from: string;
  to: string;
  length: number;
  slope: number;
  diameter: number;
  material: string;
}

export const PerfilLongitudinal = ({ pontos, trechos }: PerfilLongitudinalProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [exageroVertical, setExageroVertical] = useState(10);
  const [profundidadePadrao, setProfundidadePadrao] = useState(1.5);
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>("auto");

  // Build the profile path from trechos
  const { profileNodes, profileSegments } = useMemo(() => {
    if (trechos.length === 0 || pontos.length === 0) return { profileNodes: [], profileSegments: [] };

    // Build adjacency
    const adj = new Map<string, { trecho: Trecho; next: string }[]>();
    trechos.forEach(t => {
      if (!adj.has(t.idInicio)) adj.set(t.idInicio, []);
      adj.get(t.idInicio)!.push({ trecho: t, next: t.idFim });
    });

    // Find start nodes (nodes that aren't a destination of any trecho)
    const destinations = new Set(trechos.map(t => t.idFim));
    const startCandidates = [...new Set(trechos.map(t => t.idInicio))].filter(id => !destinations.has(id));
    const startId = startCandidates[0] || trechos[0].idInicio;

    // Walk the path
    const visited = new Set<string>();
    const pathNodes: ProfileNode[] = [];
    const pathSegments: ProfileSegment[] = [];
    let cumDist = 0;
    let currentId = startId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const ponto = pontos.find(p => p.id === currentId);
      const cotaTerreno = ponto?.cota ?? 0;
      const cotaTubo = cotaTerreno - profundidadePadrao;

      pathNodes.push({
        id: currentId,
        cumulativeDist: cumDist,
        cotaTerreno,
        cotaTubo,
        profundidade: profundidadePadrao,
      });

      const nexts = adj.get(currentId);
      if (!nexts || nexts.length === 0) break;

      const chosen = nexts[0];
      pathSegments.push({
        from: currentId,
        to: chosen.next,
        length: chosen.trecho.comprimento,
        slope: chosen.trecho.declividade,
        diameter: chosen.trecho.diametroMm,
        material: chosen.trecho.material,
      });

      cumDist += chosen.trecho.comprimento;
      currentId = chosen.next;
    }

    // Add last node
    if (currentId && !visited.has(currentId)) {
      const ponto = pontos.find(p => p.id === currentId);
      const cotaTerreno = ponto?.cota ?? 0;
      pathNodes.push({
        id: currentId,
        cumulativeDist: cumDist,
        cotaTerreno,
        cotaTubo: cotaTerreno - profundidadePadrao,
        profundidade: profundidadePadrao,
      });
    }

    return { profileNodes: pathNodes, profileSegments: pathSegments };
  }, [trechos, pontos, profundidadePadrao, selectedPath]);

  // SVG dimensions and scale
  const svgWidth = 900;
  const svgHeight = 400;
  const margin = { top: 40, right: 40, bottom: 100, left: 70 };
  const plotW = svgWidth - margin.left - margin.right;
  const plotH = svgHeight - margin.top - margin.bottom;

  const { scaleX, scaleY, minElev, maxElev, maxDist } = useMemo(() => {
    if (profileNodes.length === 0) return { scaleX: () => 0, scaleY: () => 0, minElev: 0, maxElev: 0, maxDist: 0 };

    const allElevs = profileNodes.flatMap(n => [n.cotaTerreno, n.cotaTubo]);
    const minE = Math.min(...allElevs) - 2;
    const maxE = Math.max(...allElevs) + 2;
    const maxD = Math.max(...profileNodes.map(n => n.cumulativeDist), 1);

    // Apply vertical exaggeration
    const elevRange = (maxE - minE) / exageroVertical || 1;

    return {
      scaleX: (d: number) => margin.left + (d / maxD) * plotW,
      scaleY: (e: number) => margin.top + plotH - ((e - minE) / (maxE - minE)) * plotH,
      minElev: minE,
      maxElev: maxE,
      maxDist: maxD,
    };
  }, [profileNodes, exageroVertical, plotW, plotH, margin]);

  const terrainPath = useMemo(() => {
    if (profileNodes.length < 2) return "";
    return profileNodes.map((n, i) => `${i === 0 ? "M" : "L"}${scaleX(n.cumulativeDist).toFixed(1)},${scaleY(n.cotaTerreno).toFixed(1)}`).join(" ");
  }, [profileNodes, scaleX, scaleY]);

  const pipePath = useMemo(() => {
    if (profileNodes.length < 2) return "";
    return profileNodes.map((n, i) => `${i === 0 ? "M" : "L"}${scaleX(n.cumulativeDist).toFixed(1)},${scaleY(n.cotaTubo).toFixed(1)}`).join(" ");
  }, [profileNodes, scaleX, scaleY]);

  // Fill area between terrain and pipe
  const fillPath = useMemo(() => {
    if (profileNodes.length < 2) return "";
    const top = profileNodes.map((n, i) => `${i === 0 ? "M" : "L"}${scaleX(n.cumulativeDist).toFixed(1)},${scaleY(n.cotaTerreno).toFixed(1)}`).join(" ");
    const bottom = [...profileNodes].reverse().map((n) => `L${scaleX(n.cumulativeDist).toFixed(1)},${scaleY(n.cotaTubo).toFixed(1)}`).join(" ");
    return `${top} ${bottom} Z`;
  }, [profileNodes, scaleX, scaleY]);

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const range = maxElev - minElev;
    const step = range > 20 ? 5 : range > 10 ? 2 : 1;
    const ticks: number[] = [];
    for (let v = Math.ceil(minElev / step) * step; v <= maxElev; v += step) ticks.push(v);
    return ticks;
  }, [minElev, maxElev]);

  // X-axis ticks
  const xTicks = useMemo(() => {
    const step = maxDist > 1000 ? 200 : maxDist > 500 ? 100 : maxDist > 200 ? 50 : 20;
    const ticks: number[] = [];
    for (let v = 0; v <= maxDist; v += step) ticks.push(v);
    return ticks;
  }, [maxDist]);

  const exportPNG = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = svgWidth * 2;
    canvas.height = svgHeight * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "perfil_longitudinal.png";
      a.click();
      toast.success("Perfil exportado como PNG");
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }, []);

  const fmt = (n: number, d = 2) => n.toFixed(d);

  if (pontos.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Perfil Longitudinal</CardTitle></CardHeader>
        <CardContent><p className="text-center text-muted-foreground py-8">Carregue dados na aba Topografia primeiro.</p></CardContent>
      </Card>
    );
  }

  if (profileNodes.length < 2) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Perfil Longitudinal</CardTitle></CardHeader>
        <CardContent><p className="text-center text-muted-foreground py-8">Crie trechos (segmentos) na Topografia para gerar o perfil. Mínimo 2 pontos conectados.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Perfil Longitudinal
            <Badge variant="secondary" className="ml-auto">{profileNodes.length} PVs · {profileSegments.length} trechos</Badge>
          </CardTitle>
          <CardDescription>Corte vertical da rede — terreno, greide do coletor e poços de visita</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Controls */}
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <Label className="text-xs">Exagero Vertical</Label>
              <Input type="number" className="h-8 w-24" value={exageroVertical} onChange={e => setExageroVertical(Math.max(1, +e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Profundidade Padrão (m)</Label>
              <Input type="number" step="0.1" className="h-8 w-24" value={profundidadePadrao} onChange={e => setProfundidadePadrao(Math.max(0.5, +e.target.value))} />
            </div>
            <Button size="sm" variant="outline" onClick={exportPNG}>
              <Download className="h-3 w-3 mr-1" /> Exportar PNG
            </Button>
          </div>

          {/* SVG Profile */}
          <div className="overflow-x-auto border border-border rounded-lg bg-white dark:bg-card">
            <svg ref={svgRef} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full" style={{ minWidth: 700, minHeight: 350 }}>
              {/* Grid lines */}
              {yTicks.map(v => (
                <g key={`y-${v}`}>
                  <line x1={margin.left} y1={scaleY(v)} x2={svgWidth - margin.right} y2={scaleY(v)} stroke="#e2e8f0" strokeWidth={0.5} />
                  <text x={margin.left - 8} y={scaleY(v) + 4} textAnchor="end" fontSize={10} fill="#64748b">{fmt(v, 1)}</text>
                </g>
              ))}
              {xTicks.map(v => (
                <g key={`x-${v}`}>
                  <line x1={scaleX(v)} y1={margin.top} x2={scaleX(v)} y2={svgHeight - margin.bottom} stroke="#e2e8f0" strokeWidth={0.5} />
                  <text x={scaleX(v)} y={svgHeight - margin.bottom + 14} textAnchor="middle" fontSize={10} fill="#64748b">{fmt(v, 0)}</text>
                </g>
              ))}

              {/* Axis labels */}
              <text x={margin.left - 50} y={svgHeight / 2} textAnchor="middle" fontSize={11} fill="#475569" transform={`rotate(-90, ${margin.left - 50}, ${svgHeight / 2})`}>Cota (m)</text>
              <text x={svgWidth / 2} y={svgHeight - margin.bottom + 30} textAnchor="middle" fontSize={11} fill="#475569">Distância acumulada (m)</text>

              {/* Fill between terrain and pipe */}
              <path d={fillPath} fill="#f1f5f9" opacity={0.6} />

              {/* Terrain line */}
              <path d={terrainPath} fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinejoin="round" />

              {/* Pipe invert line */}
              <path d={pipePath} fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" strokeLinejoin="round" />

              {/* Manholes (PVs) - vertical lines */}
              {profileNodes.map((n, i) => {
                const x = scaleX(n.cumulativeDist);
                const yTerr = scaleY(n.cotaTerreno);
                const yTubo = scaleY(n.cotaTubo);
                return (
                  <g key={n.id}>
                    {/* Vertical line */}
                    <line x1={x} y1={yTerr} x2={x} y2={yTubo} stroke="#1e293b" strokeWidth={1.5} />
                    {/* Top cap */}
                    <rect x={x - 6} y={yTerr - 2} width={12} height={4} fill="#1e293b" rx={1} />
                    {/* Bottom mark */}
                    <circle cx={x} cy={yTubo} r={3} fill="#3b82f6" stroke="#1e293b" strokeWidth={1} />

                    {/* Labels */}
                    <text x={x} y={yTerr - 10} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#1e293b">{n.id}</text>
                    <text x={x + 8} y={yTerr + 3} textAnchor="start" fontSize={8} fill="#16a34a">{fmt(n.cotaTerreno, 2)}</text>
                    <text x={x + 8} y={yTubo + 3} textAnchor="start" fontSize={8} fill="#2563eb">{fmt(n.cotaTubo, 2)}</text>
                    <text x={x} y={yTubo + 14} textAnchor="middle" fontSize={8} fill="#ef4444">h={fmt(n.profundidade, 1)}m</text>
                  </g>
                );
              })}

              {/* Segment info (DN, slope, length) */}
              {profileSegments.map((seg, i) => {
                const fromNode = profileNodes.find(n => n.id === seg.from);
                const toNode = profileNodes.find(n => n.id === seg.to);
                if (!fromNode || !toNode) return null;
                const midX = (scaleX(fromNode.cumulativeDist) + scaleX(toNode.cumulativeDist)) / 2;
                const midY = (scaleY(fromNode.cotaTubo) + scaleY(toNode.cotaTubo)) / 2;
                const isHovered = hoveredSegment === i;

                return (
                  <g key={i}
                    onMouseEnter={() => setHoveredSegment(i)}
                    onMouseLeave={() => setHoveredSegment(null)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Invisible wider hit area */}
                    <line
                      x1={scaleX(fromNode.cumulativeDist)} y1={scaleY(fromNode.cotaTubo)}
                      x2={scaleX(toNode.cumulativeDist)} y2={scaleY(toNode.cotaTubo)}
                      stroke="transparent" strokeWidth={12}
                    />
                    {isHovered && (
                      <rect x={midX - 60} y={midY - 30} width={120} height={40} rx={4} fill="#1e293b" opacity={0.9} />
                    )}
                    {/* Always show basic info */}
                    <text x={midX} y={svgHeight - margin.bottom + 50} textAnchor="middle" fontSize={8} fill="#475569">
                      DN{seg.diameter}
                    </text>
                    <text x={midX} y={svgHeight - margin.bottom + 62} textAnchor="middle" fontSize={8} fill="#475569">
                      {(seg.slope * 100).toFixed(2)}%
                    </text>
                    <text x={midX} y={svgHeight - margin.bottom + 74} textAnchor="middle" fontSize={8} fill="#475569">
                      {fmt(seg.length, 1)}m
                    </text>
                    <text x={midX} y={svgHeight - margin.bottom + 86} textAnchor="middle" fontSize={7} fill="#94a3b8">
                      {seg.material}
                    </text>

                    {/* Tooltip on hover */}
                    {isHovered && (
                      <>
                        <text x={midX} y={midY - 16} textAnchor="middle" fontSize={9} fill="#fff" fontWeight="bold">
                          DN{seg.diameter} · {seg.material}
                        </text>
                        <text x={midX} y={midY - 4} textAnchor="middle" fontSize={9} fill="#fff">
                          L={fmt(seg.length, 1)}m · i={( seg.slope * 100).toFixed(2)}%
                        </text>
                      </>
                    )}
                  </g>
                );
              })}

              {/* Legend */}
              <g transform={`translate(${margin.left + 10}, ${margin.top + 10})`}>
                <rect width={160} height={50} fill="white" stroke="#e2e8f0" rx={4} opacity={0.9} />
                <line x1={10} y1={15} x2={30} y2={15} stroke="#22c55e" strokeWidth={2.5} />
                <text x={35} y={18} fontSize={10} fill="#475569">Terreno</text>
                <line x1={10} y1={30} x2={30} y2={30} stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" />
                <text x={35} y={33} fontSize={10} fill="#475569">Greide do Coletor</text>
                <line x1={10} y1={43} x2={30} y2={43} stroke="#1e293b" strokeWidth={1.5} />
                <text x={35} y={46} fontSize={10} fill="#475569">Poço de Visita</text>
              </g>

              {/* Title */}
              <text x={svgWidth / 2} y={20} textAnchor="middle" fontSize={14} fontWeight="bold" fill="#1e293b">
                Perfil Longitudinal — Exagero {exageroVertical}x
              </text>
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" /> Dados do Perfil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PV</TableHead>
                  <TableHead>Estaca (m)</TableHead>
                  <TableHead>Cota Terreno</TableHead>
                  <TableHead>Cota Tubo</TableHead>
                  <TableHead>Profundidade</TableHead>
                  <TableHead>DN</TableHead>
                  <TableHead>Declividade</TableHead>
                  <TableHead>Comprimento</TableHead>
                  <TableHead>Material</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profileNodes.map((n, i) => {
                  const seg = profileSegments[i]; // segment starting from this node
                  return (
                    <TableRow key={n.id} className={hoveredSegment === i ? "bg-muted" : ""}>
                      <TableCell className="font-medium">{n.id}</TableCell>
                      <TableCell>{fmt(n.cumulativeDist, 1)}</TableCell>
                      <TableCell className="text-green-700">{fmt(n.cotaTerreno, 3)}</TableCell>
                      <TableCell className="text-blue-700">{fmt(n.cotaTubo, 3)}</TableCell>
                      <TableCell className="text-red-600">{fmt(n.profundidade, 2)}m</TableCell>
                      <TableCell>{seg ? `DN${seg.diameter}` : "—"}</TableCell>
                      <TableCell className={seg && seg.slope < 0 ? "text-destructive font-medium" : ""}>
                        {seg ? `${(seg.slope * 100).toFixed(2)}%` : "—"}
                      </TableCell>
                      <TableCell>{seg ? `${fmt(seg.length, 1)}m` : "—"}</TableCell>
                      <TableCell>{seg ? <Badge variant="outline" className="text-[10px]">{seg.material}</Badge> : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
