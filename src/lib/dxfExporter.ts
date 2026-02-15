/**
 * DXF Export utility for topography data.
 * Generates a minimal DXF file with points and line segments.
 */

import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";

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
3
0
LAYER
2
PONTOS
70
0
62
3
6
CONTINUOUS
0
LAYER
2
TRECHOS_GRAVIDADE
70
0
62
3
6
CONTINUOUS
0
LAYER
2
TRECHOS_ELEVATORIA
70
0
62
1
6
CONTINUOUS
0
ENDTAB
0
ENDSEC
`;
}

function dxfEntitiesStart(): string {
  return `0
SECTION
2
ENTITIES
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

function dxfLine(t: Trecho): string {
  const layer = t.tipoRede === "Esgoto por Gravidade" ? "TRECHOS_GRAVIDADE" : "TRECHOS_ELEVATORIA";
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
`;
}

function dxfEnd(): string {
  return `0
ENDSEC
0
EOF
`;
}

export function exportToDXF(pontos: PontoTopografico[], trechos: Trecho[]): string {
  let dxf = dxfHeader();
  dxf += dxfEntitiesStart();
  
  for (const p of pontos) {
    dxf += dxfPoint(p);
  }
  
  for (const t of trechos) {
    dxf += dxfLine(t);
  }
  
  dxf += dxfEnd();
  return dxf;
}

export function downloadDXF(pontos: PontoTopografico[], trechos: Trecho[], filename = "rede_hidronetwork.dxf"): void {
  const content = exportToDXF(pontos, trechos);
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
