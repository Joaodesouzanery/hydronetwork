/**
 * DXF Export utility for RDO Hydro progress data.
 * Exports segments colored by status and annotated with progress info.
 */

import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import { RDO } from "@/engine/rdo";

interface SegmentStatus {
  trecho: Trecho;
  status: "Concluído" | "Em Execução" | "Não Iniciado";
  percent: number;
  executed: number;
  planned: number;
}

function getSegmentStatuses(trechos: Trecho[], rdos: RDO[]): SegmentStatus[] {
  return trechos.map(t => {
    const allSegs = rdos.flatMap(r => r.segments);
    const matching = allSegs.filter(s =>
      s.segmentName === `${t.idInicio}-${t.idFim}` || s.segmentName === t.idInicio
    );
    const totalExecuted = matching.reduce((sum, s) => sum + s.executedBefore + s.executedToday, 0);
    const planned = matching[0]?.plannedTotal || t.comprimento;
    const pct = planned > 0 ? (totalExecuted / planned) * 100 : 0;

    let status: SegmentStatus["status"] = "Não Iniciado";
    if (pct >= 100) status = "Concluído";
    else if (pct > 0) status = "Em Execução";

    return { trecho: t, status, percent: Math.min(pct, 100), executed: totalExecuted, planned };
  });
}

function dxfHeader(): string {
  return `0
SECTION
2
HEADER
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
70
5
0
LAYER
2
RDO_CONCLUIDO
70
0
62
3
6
CONTINUOUS
0
LAYER
2
RDO_EM_EXECUCAO
70
0
62
2
6
CONTINUOUS
0
LAYER
2
RDO_NAO_INICIADO
70
0
62
1
6
CONTINUOUS
0
LAYER
2
PONTOS
70
0
62
5
6
CONTINUOUS
0
LAYER
2
ANOTACOES
70
0
62
7
6
CONTINUOUS
0
ENDTAB
0
ENDSEC
`;
}

function dxfPoint(p: PontoTopografico): string {
  return `0
POINT
8
PONTOS
10
${p.x.toFixed(4)}
20
${p.y.toFixed(4)}
30
${p.cota.toFixed(4)}
0
TEXT
8
PONTOS
10
${(p.x + 1).toFixed(4)}
20
${(p.y + 1).toFixed(4)}
30
${p.cota.toFixed(4)}
40
1.5
1
${p.id}
`;
}

function dxfSegment(seg: SegmentStatus): string {
  const t = seg.trecho;
  const layer = seg.status === "Concluído" ? "RDO_CONCLUIDO"
    : seg.status === "Em Execução" ? "RDO_EM_EXECUCAO"
    : "RDO_NAO_INICIADO";

  const midX = (t.xInicio + t.xFim) / 2;
  const midY = (t.yInicio + t.yFim) / 2;
  const midZ = (t.cotaInicio + t.cotaFim) / 2;

  return `0
LINE
8
${layer}
10
${t.xInicio.toFixed(4)}
20
${t.yInicio.toFixed(4)}
30
${t.cotaInicio.toFixed(4)}
11
${t.xFim.toFixed(4)}
21
${t.yFim.toFixed(4)}
31
${t.cotaFim.toFixed(4)}
0
TEXT
8
ANOTACOES
10
${midX.toFixed(4)}
20
${(midY + 2).toFixed(4)}
30
${midZ.toFixed(4)}
40
1.2
1
${seg.percent.toFixed(0)}% (${seg.executed.toFixed(1)}/${seg.planned.toFixed(1)}m)
`;
}

export function exportRDOToDXF(pontos: PontoTopografico[], trechos: Trecho[], rdos: RDO[]): string {
  const statuses = getSegmentStatuses(trechos, rdos);

  let dxf = dxfHeader();
  dxf += `0\nSECTION\n2\nENTITIES\n`;

  for (const p of pontos) {
    dxf += dxfPoint(p);
  }

  for (const seg of statuses) {
    dxf += dxfSegment(seg);
  }

  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
}

export function downloadRDODXF(pontos: PontoTopografico[], trechos: Trecho[], rdos: RDO[], filename = "rdo_progresso.dxf"): void {
  const content = exportRDOToDXF(pontos, trechos, rdos);
  const blob = new Blob([content], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
