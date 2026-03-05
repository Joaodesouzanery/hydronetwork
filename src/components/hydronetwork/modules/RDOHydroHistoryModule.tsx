/**
 * RDO Hydro History Module
 * Displays a filterable, sortable history view of all RDO Hydro records
 * with export capabilities (PDF and Excel) and detail panel.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  History, Download, FileText, Search, Filter, Calendar,
  CheckCircle2, XCircle, Clock
} from "lucide-react";
import { RDO, RDOStatus, getStatusColor } from "@/engine/rdo";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

const fmt = (n: number, d = 1) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

const statusLabel: Record<RDOStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

function totalMeters(rdo: RDO): number {
  return rdo.segments.reduce(
    (sum, s) => sum + s.executedBefore + s.executedToday,
    0,
  );
}

function truncate(text: string | undefined, maxLen: number): string {
  if (!text) return "-";
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

export const RDOHydroHistoryModule = ({ rdos }: { rdos: RDO[] }) => {
  // Filter state
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");

  // Detail panel
  const [selectedRdoId, setSelectedRdoId] = useState<string | null>(null);

  // Filtered and sorted RDOs
  const filtered = useMemo(() => {
    let result = [...rdos];

    // Date range filter
    if (dateFrom) {
      result = result.filter((r) => r.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((r) => r.date <= dateTo);
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    // Search text (project name, notes, occurrences)
    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (r) =>
          (r.projectName && r.projectName.toLowerCase().includes(lower)) ||
          (r.obraName && r.obraName.toLowerCase().includes(lower)) ||
          (r.notes && r.notes.toLowerCase().includes(lower)) ||
          (r.occurrences && r.occurrences.toLowerCase().includes(lower)),
      );
    }

    // Sort by date descending
    result.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

    return result;
  }, [rdos, dateFrom, dateTo, statusFilter, searchText]);

  // Summary counts
  const summary = useMemo(() => {
    return {
      total: filtered.length,
      aprovados: filtered.filter((r) => r.status === "aprovado").length,
      rejeitados: filtered.filter((r) => r.status === "rejeitado").length,
      pendentes: filtered.filter(
        (r) => r.status === "rascunho" || r.status === "enviado",
      ).length,
    };
  }, [filtered]);

  // Selected RDO for detail
  const selectedRdo = useMemo(
    () => (selectedRdoId ? rdos.find((r) => r.id === selectedRdoId) || null : null),
    [selectedRdoId, rdos],
  );

  // ── Export PDF ──
  const exportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(16);
      doc.text("Historico de RDO Hydro", 14, 18);
      doc.setFontSize(10);
      doc.text(
        `Periodo: ${dateFrom || "inicio"} a ${dateTo || "hoje"} | Total: ${filtered.length} RDOs`,
        14,
        26,
      );

      const tableData = filtered.map((rdo) => [
        rdo.date,
        rdo.projectName || "-",
        statusLabel[rdo.status],
        String(rdo.services.length),
        String(rdo.segments.length),
        fmt(totalMeters(rdo), 2),
        truncate(rdo.notes, 40),
      ]);

      (doc as any).autoTable({
        startY: 32,
        head: [
          ["Data", "Projeto", "Status", "Servicos", "Trechos", "Metros (m)", "Observacoes"],
        ],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 64, 175] },
      });

      doc.save("historico_rdo_hydro.pdf");
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      toast.error("Erro ao exportar PDF");
      console.error(err);
    }
  };

  // ── Export Excel ──
  const exportExcel = () => {
    try {
      const rows = filtered.map((rdo) => ({
        Data: rdo.date,
        Projeto: rdo.projectName || "",
        Obra: rdo.obraName || "",
        Status: statusLabel[rdo.status],
        Servicos: rdo.services.length,
        Trechos: rdo.segments.length,
        "Metros Executados": Number(totalMeters(rdo).toFixed(2)),
        Observacoes: rdo.notes || "",
        Ocorrencias: rdo.occurrences || "",
        "Criado em": rdo.createdAt || "",
        "Atualizado em": rdo.updatedAt || "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historico RDO");

      // Services detail sheet
      const serviceRows = filtered.flatMap((rdo) =>
        rdo.services.map((s) => ({
          "RDO Data": rdo.date,
          Projeto: rdo.projectName || "",
          Servico: s.serviceName,
          Quantidade: s.quantity,
          Unidade: s.unit,
          Equipamento: s.equipment || "",
          Funcionario: s.employeeName || "",
        })),
      );
      if (serviceRows.length > 0) {
        const wsServices = XLSX.utils.json_to_sheet(serviceRows);
        XLSX.utils.book_append_sheet(wb, wsServices, "Servicos");
      }

      // Segments detail sheet
      const segmentRows = filtered.flatMap((rdo) =>
        rdo.segments.map((seg) => ({
          "RDO Data": rdo.date,
          Projeto: rdo.projectName || "",
          Trecho: seg.segmentName,
          Sistema: seg.system,
          "Planejado (m)": seg.plannedTotal,
          "Exec. Anterior (m)": seg.executedBefore,
          "Exec. Hoje (m)": seg.executedToday,
          "Total Exec. (m)": seg.executedBefore + seg.executedToday,
          "% Concluido":
            seg.plannedTotal > 0
              ? Number(
                  (
                    ((seg.executedBefore + seg.executedToday) / seg.plannedTotal) *
                    100
                  ).toFixed(1),
                )
              : 0,
        })),
      );
      if (segmentRows.length > 0) {
        const wsSegments = XLSX.utils.json_to_sheet(segmentRows);
        XLSX.utils.book_append_sheet(wb, wsSegments, "Trechos");
      }

      XLSX.writeFile(wb, "historico_rdo_hydro.xlsx");
      toast.success("Excel exportado com sucesso!");
    } catch (err) {
      toast.error("Erro ao exportar Excel");
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle className="text-xl">
                  Historico de RDO Hydro
                </CardTitle>
                <CardDescription>
                  Visualize, filtre e exporte todo o historico de RDOs
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportPDF}>
                <FileText className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={exportExcel}>
                <Download className="h-4 w-4 mr-1" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
                placeholder="Data inicial"
              />
              <span className="text-muted-foreground text-sm">a</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
                placeholder="Data final"
              />
            </div>

            <div className="flex items-center gap-1">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="enviado">Enviado</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar por projeto, notas..."
                className="flex-1"
              />
            </div>

            {(dateFrom || dateTo || statusFilter !== "all" || searchText) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setStatusFilter("all");
                  setSearchText("");
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Total RDOs</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Aprovados</p>
                <p className="text-2xl font-bold text-green-600">
                  {summary.aprovados}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-xs text-muted-foreground">Rejeitados</p>
                <p className="text-2xl font-bold text-red-600">
                  {summary.rejeitados}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-amber-600">
                  {summary.pendentes}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">Nenhum RDO encontrado</p>
              <p className="text-sm">
                {rdos.length === 0
                  ? "Nenhum RDO foi criado ainda."
                  : "Ajuste os filtros para ver resultados."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Data</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead className="w-[110px]">Status</TableHead>
                    <TableHead className="text-center w-[80px]">
                      Servicos
                    </TableHead>
                    <TableHead className="text-center w-[80px]">
                      Trechos
                    </TableHead>
                    <TableHead className="text-right w-[120px]">
                      Metros (m)
                    </TableHead>
                    <TableHead>Observacoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((rdo) => (
                    <TableRow
                      key={rdo.id}
                      className="cursor-pointer hover:bg-muted/60"
                      onClick={() =>
                        setSelectedRdoId(
                          selectedRdoId === rdo.id ? null : rdo.id,
                        )
                      }
                    >
                      <TableCell className="font-mono text-sm">
                        {rdo.date}
                      </TableCell>
                      <TableCell className="font-medium">
                        {rdo.projectName || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          style={{
                            backgroundColor: getStatusColor(rdo.status),
                            color: "#fff",
                          }}
                        >
                          {statusLabel[rdo.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {rdo.services.length}
                      </TableCell>
                      <TableCell className="text-center">
                        {rdo.segments.length}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmt(totalMeters(rdo), 2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {truncate(rdo.notes, 50)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Panel */}
      {selectedRdo && (
        <Card className="border-blue-300">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  Detalhes do RDO - {selectedRdo.date}
                </CardTitle>
                <CardDescription>
                  {selectedRdo.projectName}
                  {selectedRdo.obraName
                    ? ` | ${selectedRdo.obraName}`
                    : ""}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  style={{
                    backgroundColor: getStatusColor(selectedRdo.status),
                    color: "#fff",
                  }}
                >
                  {statusLabel[selectedRdo.status]}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedRdoId(null)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Meta info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">ID:</span>{" "}
                <span className="font-mono text-xs">{selectedRdo.id.slice(0, 8)}...</span>
              </div>
              <div>
                <span className="text-muted-foreground">Criado:</span>{" "}
                {selectedRdo.createdAt || "-"}
              </div>
              <div>
                <span className="text-muted-foreground">Atualizado:</span>{" "}
                {selectedRdo.updatedAt || "-"}
              </div>
              <div>
                <span className="text-muted-foreground">Total metros:</span>{" "}
                <span className="font-bold">{fmt(totalMeters(selectedRdo), 2)} m</span>
              </div>
            </div>

            {/* Services */}
            {selectedRdo.services.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">
                  Servicos Executados ({selectedRdo.services.length})
                </h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Servico</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead>Unid.</TableHead>
                        <TableHead>Equipamento</TableHead>
                        <TableHead>Funcionario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRdo.services.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.serviceName}</TableCell>
                          <TableCell className="text-right font-mono">
                            {fmt(s.quantity, 2)}
                          </TableCell>
                          <TableCell>{s.unit}</TableCell>
                          <TableCell>{s.equipment || "-"}</TableCell>
                          <TableCell>{s.employeeName || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Segments */}
            {selectedRdo.segments.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">
                  Trechos / Segmentos ({selectedRdo.segments.length})
                </h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trecho</TableHead>
                        <TableHead>Sistema</TableHead>
                        <TableHead className="text-right">
                          Planejado (m)
                        </TableHead>
                        <TableHead className="text-right">
                          Exec. Anterior (m)
                        </TableHead>
                        <TableHead className="text-right">
                          Exec. Hoje (m)
                        </TableHead>
                        <TableHead className="text-right">
                          Total (m)
                        </TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRdo.segments.map((seg) => {
                        const executed = seg.executedBefore + seg.executedToday;
                        const pct =
                          seg.plannedTotal > 0
                            ? (executed / seg.plannedTotal) * 100
                            : 0;
                        return (
                          <TableRow key={seg.id}>
                            <TableCell className="font-medium">
                              {seg.segmentName}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{seg.system}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {fmt(seg.plannedTotal, 2)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {fmt(seg.executedBefore, 2)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {fmt(seg.executedToday, 2)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {fmt(executed, 2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={pct >= 100 ? "default" : "secondary"}
                                className={
                                  pct >= 100
                                    ? "bg-green-600"
                                    : pct > 0
                                      ? "bg-amber-500"
                                      : "bg-gray-400"
                                }
                              >
                                {fmt(pct, 1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Notes and occurrences */}
            {(selectedRdo.notes || selectedRdo.occurrences) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedRdo.notes && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Observacoes</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/40 rounded p-3">
                      {selectedRdo.notes}
                    </p>
                  </div>
                )}
                {selectedRdo.occurrences && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Ocorrencias</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/40 rounded p-3">
                      {selectedRdo.occurrences}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
