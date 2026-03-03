/**
 * Unified Export Dialog: RDO + Connection Reports in a single session/export.
 */
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Download, FileStack, ClipboardList, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

interface UnifiedExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UnifiedExportDialog = ({ open, onOpenChange }: UnifiedExportDialogProps) => {
  const [rdos, setRdos] = useState<any[]>([]);
  const [connectionReports, setConnectionReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [includeRDOs, setIncludeRDOs] = useState(true);
  const [includeConnReports, setIncludeConnReports] = useState(true);
  const [exportFormat, setExportFormat] = useState<"pdf" | "xlsx" | "csv">("pdf");

  const loadData = async () => {
    setLoading(true);
    try {
      const [rdoRes, crRes] = await Promise.all([
        supabase.from("rdos").select("*, obras(nome)").order("data", { ascending: false }).limit(200),
        supabase.from("connection_reports").select("*").order("report_date", { ascending: false }).limit(200),
      ]);
      setRdos(rdoRes.data || []);
      setConnectionReports(crRes.data || []);
      setLoaded(true);
    } catch (err: any) {
      toast.error("Erro ao carregar dados: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredRDOs = useMemo(() => {
    if (!dateFilter) return rdos;
    return rdos.filter(r => r.data === dateFilter);
  }, [rdos, dateFilter]);

  const filteredReports = useMemo(() => {
    if (!dateFilter) return connectionReports;
    return connectionReports.filter(r => r.report_date === dateFilter);
  }, [connectionReports, dateFilter]);

  const allDates = useMemo(() => {
    const dates = new Set<string>();
    rdos.forEach(r => dates.add(r.data));
    connectionReports.forEach(r => dates.add(r.report_date));
    return Array.from(dates).sort().reverse();
  }, [rdos, connectionReports]);

  const handleExport = () => {
    const rdoData = includeRDOs ? filteredRDOs : [];
    const crData = includeConnReports ? filteredReports : [];

    if (rdoData.length === 0 && crData.length === 0) {
      toast.error("Nenhum dado para exportar.");
      return;
    }

    if (exportFormat === "pdf") exportPDF(rdoData, crData);
    else if (exportFormat === "xlsx") exportExcel(rdoData, crData);
    else exportCSV(rdoData, crData);
  };

  const exportPDF = (rdoData: any[], crData: any[]) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Relatório Unificado", 14, 20);
    doc.setFontSize(10);
    doc.text(`Data: ${dateFilter || "Todas"} | Gerado: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);

    let y = 35;

    if (rdoData.length > 0) {
      doc.setFontSize(14);
      doc.text(`RDOs (${rdoData.length})`, 14, y);
      y += 5;
      (doc as any).autoTable({
        startY: y,
        head: [["Data", "Obra", "Condição", "Temperatura", "Observações"]],
        body: rdoData.map(r => [
          r.data, r.obras?.nome || "-", r.condicao_terreno || "-",
          r.clima_temperatura ? `${r.clima_temperatura}°C` : "-",
          (r.observacoes_gerais || "-").substring(0, 60),
        ]),
        styles: { fontSize: 8 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (crData.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.text(`Relatórios de Ligações (${crData.length})`, 14, y);
      y += 5;
      (doc as any).autoTable({
        startY: y,
        head: [["Data", "Equipe", "Cliente", "Endereço", "OS", "Serviço"]],
        body: crData.map(r => [
          r.report_date, r.team_name, r.client_name, r.address.substring(0, 40),
          r.os_number, r.service_type,
        ]),
        styles: { fontSize: 8 },
      });
    }

    doc.save(`relatorio-unificado${dateFilter ? `-${dateFilter}` : ""}.pdf`);
    toast.success("PDF unificado exportado!");
  };

  const exportExcel = (rdoData: any[], crData: any[]) => {
    const wb = XLSX.utils.book_new();
    if (rdoData.length > 0) {
      const sheet = XLSX.utils.json_to_sheet(rdoData.map(r => ({
        Data: r.data, Obra: r.obras?.nome || "", Condição: r.condicao_terreno || "",
        Temperatura: r.clima_temperatura, Umidade: r.clima_umidade,
        Observações: r.observacoes_gerais || "",
      })));
      XLSX.utils.book_append_sheet(wb, sheet, "RDOs");
    }
    if (crData.length > 0) {
      const sheet = XLSX.utils.json_to_sheet(crData.map(r => ({
        Data: r.report_date, Equipe: r.team_name, Cliente: r.client_name,
        Endereço: r.address, OS: r.os_number, Serviço: r.service_type,
        Hidrômetro: r.water_meter_number, Observações: r.observations || "",
      })));
      XLSX.utils.book_append_sheet(wb, sheet, "Ligações");
    }
    XLSX.writeFile(wb, `relatorio-unificado${dateFilter ? `-${dateFilter}` : ""}.xlsx`);
    toast.success("Excel unificado exportado!");
  };

  const exportCSV = (rdoData: any[], crData: any[]) => {
    let csv = "TIPO;DATA;REFERENCIA;DETALHE\n";
    rdoData.forEach(r => {
      csv += `RDO;${r.data};${r.obras?.nome || ""};${(r.observacoes_gerais || "").replace(/[;\n]/g, " ")}\n`;
    });
    crData.forEach(r => {
      csv += `LIGACAO;${r.report_date};${r.client_name};${r.address.replace(/[;\n]/g, " ")}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "relatorio-unificado.csv"; a.click();
    toast.success("CSV unificado exportado!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5" /> Exportação Unificada: RDO + Ligações
          </DialogTitle>
          <DialogDescription>
            Exporte RDOs e Relatórios de Ligações em um único documento.
          </DialogDescription>
        </DialogHeader>

        {!loaded ? (
          <div className="text-center py-6">
            <Button onClick={loadData} disabled={loading}>
              {loading ? "Carregando..." : "Carregar Dados"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-4">
              <Card className="flex-1"><CardContent className="pt-3 text-center">
                <ClipboardList className="h-5 w-5 mx-auto text-blue-600" />
                <div className="font-bold text-lg">{rdos.length}</div>
                <div className="text-xs text-muted-foreground">RDOs</div>
              </CardContent></Card>
              <Card className="flex-1"><CardContent className="pt-3 text-center">
                <FileText className="h-5 w-5 mx-auto text-green-600" />
                <div className="font-bold text-lg">{connectionReports.length}</div>
                <div className="text-xs text-muted-foreground">Ligações</div>
              </CardContent></Card>
            </div>

            <div>
              <Label>Filtrar por Data</Label>
              <Select value={dateFilter || "all"} onValueChange={v => setDateFilter(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Todas as datas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as datas</SelectItem>
                  {allDates.map(d => <SelectItem key={d} value={d}>{new Date(d + "T12:00:00").toLocaleDateString("pt-BR")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Incluir no Relatório</Label>
              <div className="space-y-2 border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={includeRDOs} onCheckedChange={(c) => setIncludeRDOs(!!c)} id="inc-rdo" />
                  <Label htmlFor="inc-rdo" className="font-normal cursor-pointer">
                    RDOs ({filteredRDOs.length} disponíveis)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={includeConnReports} onCheckedChange={(c) => setIncludeConnReports(!!c)} id="inc-cr" />
                  <Label htmlFor="inc-cr" className="font-normal cursor-pointer">
                    Relatórios de Ligações ({filteredReports.length} disponíveis)
                  </Label>
                </div>
              </div>
            </div>

            <div>
              <Label>Formato</Label>
              <Select value={exportFormat} onValueChange={v => setExportFormat(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleExport} disabled={!loaded}>
            <Download className="h-4 w-4 mr-1" /> Exportar Unificado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
