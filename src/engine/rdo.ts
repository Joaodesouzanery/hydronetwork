/**
 * RDO (Relatório Diário de Obra) engine for sanitation networks.
 */

export type ServiceUnit = "m" | "m2" | "m3" | "un" | "vb" | "kg" | "h";
export type RDOStatus = "rascunho" | "enviado" | "aprovado" | "rejeitado";
export type SystemType = "agua" | "esgoto" | "drenagem";

export interface ExecutedService {
  id: string;
  serviceName: string;
  quantity: number;
  unit: ServiceUnit;
  equipment?: string;
  employeeName?: string;
}

export interface SegmentProgress {
  id: string;
  segmentName: string;
  system: SystemType;
  plannedTotal: number;
  executedBefore: number;
  executedToday: number;
  startNode?: string;
  endNode?: string;
  coordinates?: { start: [number, number]; end: [number, number] };
}

export interface RDO {
  id: string;
  projectId: string;
  date: string;
  projectName: string;
  obraName?: string;
  status: RDOStatus;
  services: ExecutedService[];
  segments: SegmentProgress[];
  notes?: string;
  occurrences?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "rdoData";

export function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function saveRDOs(rdos: RDO[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rdos));
}

export function loadRDOs(): RDO[] {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function deleteRDO(rdos: RDO[], id: string): RDO[] {
  const updated = rdos.filter((r) => r.id !== id);
  saveRDOs(updated);
  return updated;
}

export interface DashboardMetrics {
  totalPlanned: number;
  totalExecuted: number;
  remaining: number;
  progressPercent: number;
  aguaProgress: { planned: number; executed: number; percent: number };
  esgotoProgress: { planned: number; executed: number; percent: number };
  drenagemProgress: { planned: number; executed: number; percent: number };
}

export function calculateDashboardMetrics(rdos: RDO[]): DashboardMetrics {
  const allSegments = rdos.flatMap((rdo) => rdo.segments);

  const totalPlanned = allSegments.reduce((sum, s) => sum + s.plannedTotal, 0);
  const totalExecuted = allSegments.reduce(
    (sum, s) => sum + s.executedBefore + s.executedToday,
    0
  );

  const calcBySystem = (system: SystemType) => {
    const segs = allSegments.filter((s) => s.system === system);
    const planned = segs.reduce((sum, s) => sum + s.plannedTotal, 0);
    const executed = segs.reduce(
      (sum, s) => sum + s.executedBefore + s.executedToday,
      0
    );
    return {
      planned,
      executed,
      percent: planned > 0 ? (executed / planned) * 100 : 0,
    };
  };

  return {
    totalPlanned,
    totalExecuted,
    remaining: totalPlanned - totalExecuted,
    progressPercent: totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0,
    aguaProgress: calcBySystem("agua"),
    esgotoProgress: calcBySystem("esgoto"),
    drenagemProgress: calcBySystem("drenagem"),
  };
}

export function validateRDO(rdo: Partial<RDO>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!rdo.date) errors.push("Data é obrigatória");

  const hasServices = rdo.services && rdo.services.length > 0;
  const hasSegments = rdo.segments && rdo.segments.length > 0;
  if (!hasServices && !hasSegments) {
    errors.push("RDO deve ter pelo menos um serviço ou avanço de trecho");
  }

  if (rdo.services) {
    for (const service of rdo.services) {
      if (!service.serviceName?.trim())
        errors.push("Nome do serviço é obrigatório");
      if (service.quantity <= 0)
        errors.push("Quantidade deve ser maior que zero");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function getStatusColor(status: RDOStatus): string {
  switch (status) {
    case "rascunho": return "#f59e0b";
    case "enviado": return "#3b82f6";
    case "aprovado": return "#22c55e";
    case "rejeitado": return "#ef4444";
  }
}

export function getSegmentColor(segment: SegmentProgress): string {
  const totalExecuted = segment.executedBefore + segment.executedToday;
  const percent =
    segment.plannedTotal > 0 ? (totalExecuted / segment.plannedTotal) * 100 : 0;

  if (percent >= 100) return "#22c55e";
  if (percent > 0) return "#f59e0b";
  return "#ef4444";
}

export const DEFAULT_SERVICES = [
  { code: "ESC001", name: "Escavação de vala", unit: "m3" as ServiceUnit },
  { code: "REA001", name: "Reaterro compactado", unit: "m3" as ServiceUnit },
  { code: "TUB001", name: "Assentamento de tubulação PVC", unit: "m" as ServiceUnit },
  { code: "TUB002", name: "Assentamento de tubulação PEAD", unit: "m" as ServiceUnit },
  { code: "PV001", name: "Execução de poço de visita", unit: "un" as ServiceUnit },
  { code: "LIG001", name: "Ligação domiciliar de água", unit: "un" as ServiceUnit },
  { code: "LIG002", name: "Ligação domiciliar de esgoto", unit: "un" as ServiceUnit },
  { code: "PAV001", name: "Recomposição de pavimento", unit: "m2" as ServiceUnit },
  { code: "TEST001", name: "Teste hidrostático", unit: "m" as ServiceUnit },
];

export function exportRDOsToCSV(rdos: RDO[]): string {
  const headers = ["ID", "Data", "Projeto", "Status", "Serviços", "Trechos"];
  const rows = rdos.map((rdo) => [
    rdo.id,
    rdo.date,
    rdo.projectName || "",
    rdo.status,
    rdo.services.length,
    rdo.segments.length,
  ]);
  return [headers.join(";"), ...rows.map((row) => row.join(";"))].join("\n");
}
