import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Download, 
  FileText, 
  Camera, 
  AlertTriangle, 
  ClipboardCheck, 
  Package, 
  Warehouse, 
  Wrench, 
  Phone, 
  Users,
  CheckCircle,
  Loader2
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface ExportProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  timeline: any[];
}

const exportSections = [
  { id: 'rdo', label: 'RDOs (Relatórios Diários)', icon: FileText },
  { id: 'photo', label: 'Fotos e Vídeos', icon: Camera },
  { id: 'occurrence', label: 'Ocorrências', icon: AlertTriangle },
  { id: 'checklist', label: 'Checklists', icon: ClipboardCheck },
  { id: 'maintenance', label: 'Manutenções', icon: Wrench },
  { id: 'material_request', label: 'Pedidos de Material', icon: Package },
  { id: 'inventory', label: 'Registros de Estoque', icon: Warehouse },
  { id: 'connection_report', label: 'Relatórios de Ligação', icon: Phone },
  { id: 'labor', label: 'Apontamentos de Horas', icon: Users },
];

export function ExportProjectDialog({ 
  open, 
  onOpenChange, 
  projectId, 
  projectName, 
  timeline 
}: ExportProjectDialogProps) {
  const { toast } = useToast();
  const [periodType, setPeriodType] = useState<'all' | 'custom'>('all');
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSections, setSelectedSections] = useState<string[]>(
    exportSections.map(s => s.id)
  );
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  const toggleSection = (sectionId: string) => {
    setSelectedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(s => s !== sectionId)
        : [...prev, sectionId]
    );
  };

  const selectAllSections = () => {
    setSelectedSections(exportSections.map(s => s.id));
  };

  const deselectAllSections = () => {
    setSelectedSections([]);
  };

  const generatePDF = async () => {
    setExporting(true);
    setProgress(0);
    setCompleted(false);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let currentY = margin;

      const normalizedProjectName = (projectName || "Projeto").toString().trim() || "Projeto";

      // Filter timeline based on selected sections and date range
      let filteredData = timeline.filter(item => {
        if (!selectedSections.includes(item.type)) return false;
        // Ensure item.date is a valid Date object
        if (!(item.date instanceof Date) || isNaN(item.date.getTime())) return false;
        return true;
      });
      
      if (periodType === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredData = filteredData.filter(item => item.date >= start && item.date <= end);
      }

      setProgress(10);

      // === COVER PAGE ===
      doc.setFillColor(30, 58, 138); // Dark blue
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      // Logo placeholder
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pageWidth / 2 - 30, 40, 60, 60, 5, 5, 'F');
      doc.setFontSize(24);
      doc.setTextColor(30, 58, 138);
      doc.text("CD", pageWidth / 2, 78, { align: 'center' });

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.text("DOCUMENTAÇÃO DA OBRA", pageWidth / 2, 130, { align: 'center' });
      
      doc.setFontSize(20);
       doc.text(normalizedProjectName, pageWidth / 2, 150, { align: 'center' });

      // Period
      doc.setFontSize(12);
      let periodText = 'Todo o período';
      if (periodType === 'custom' && startDate && endDate) {
        try {
          periodText = `${format(new Date(startDate), 'dd/MM/yyyy')} a ${format(new Date(endDate), 'dd/MM/yyyy')}`;
        } catch {
          periodText = 'Período personalizado';
        }
      }
      doc.text(`Período: ${periodText}`, pageWidth / 2, 175, { align: 'center' });
      
      // Export date
      doc.text(
        `Exportado em: ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}`,
        pageWidth / 2, 190, { align: 'center' }
      );

      // Footer
      doc.setFontSize(10);
      doc.text("Gerado automaticamente pelo ConstruData", pageWidth / 2, pageHeight - 30, { align: 'center' });

      setProgress(20);

      // === TABLE OF CONTENTS ===
      doc.addPage();
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(20);
      doc.text("SUMÁRIO", margin, 30);
      
      currentY = 50;
      doc.setFontSize(12);
      
      let pageNumber = 3;
      const tocEntries: { label: string; page: number }[] = [];

      selectedSections.forEach((sectionId, index) => {
        const section = exportSections.find(s => s.id === sectionId);
        if (section) {
          const count = filteredData.filter(item => item.type === sectionId).length;
          if (count > 0) {
            tocEntries.push({ label: `${section.label} (${count} registros)`, page: pageNumber });
            doc.text(`${section.label}`, margin, currentY);
            doc.text(`${count} registros`, pageWidth - margin - 40, currentY);
            doc.text(`Pág. ${pageNumber}`, pageWidth - margin, currentY, { align: 'right' });
            currentY += 10;
            pageNumber++;
          }
        }
      });

      setProgress(30);

      // === CONTENT SECTIONS ===
      let progressIncrement = 60 / selectedSections.length;
      
      for (const sectionId of selectedSections) {
        const section = exportSections.find(s => s.id === sectionId);
        const sectionData = filteredData.filter(item => item.type === sectionId);
        
        if (!section || sectionData.length === 0) continue;

        doc.addPage();
        
        // Section header
        doc.setFillColor(30, 58, 138);
        doc.rect(0, 0, pageWidth, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.text(section.label.toUpperCase(), margin, 28);
        doc.setFontSize(10);
        doc.text(`${sectionData.length} registros`, pageWidth - margin, 28, { align: 'right' });

        // Table with records - safely format dates
        const tableData = sectionData.map(item => {
          let dateStr = '-';
          try {
            if (item.date instanceof Date && !isNaN(item.date.getTime())) {
              dateStr = format(item.date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
            }
          } catch {
            dateStr = '-';
          }
          return [
            dateStr,
            item.title || '-',
            item.description?.substring(0, 50) + (item.description?.length > 50 ? '...' : '') || '-',
            item.location || '-',
            item.hasPhoto ? '✓ Foto' : '-'
          ];
        });

        (doc as any).autoTable({
          startY: 50,
          head: [['Data/Hora', 'Título', 'Descrição', 'Local', 'Evidência']],
          body: tableData,
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [30, 58, 138], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          margin: { left: margin, right: margin },
          didDrawPage: () => {
            // Footer on each page
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            doc.text(
              `${normalizedProjectName} | ${format(new Date(), 'dd/MM/yyyy HH:mm')} | ConstruData`,
              pageWidth / 2, pageHeight - 10,
              { align: 'center' }
            );
          }
        });

        setProgress(prev => Math.min(prev + progressIncrement, 90));
      }

      setProgress(95);

      // Save PDF
      const fileName = `${normalizedProjectName.replace(/[^a-z0-9]/gi, '_')}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
      doc.save(fileName);

      setProgress(100);
      setCompleted(true);

      toast({
        title: "Exportação concluída!",
        description: `O arquivo ${fileName} foi gerado com sucesso.`,
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleClose = () => {
    if (!exporting) {
      setCompleted(false);
      setProgress(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Obra
          </DialogTitle>
          <DialogDescription>
            Exporte toda a documentação da obra em um PDF profissional.
          </DialogDescription>
        </DialogHeader>

        {completed ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-green-700 mb-2">
              Exportação concluída com sucesso!
            </h3>
            <p className="text-muted-foreground mb-4">
              O arquivo PDF foi gerado e baixado automaticamente.
            </p>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        ) : exporting ? (
          <div className="py-8">
            <div className="flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="text-center text-muted-foreground mb-4">
              Gerando PDF da obra...
            </p>
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground mt-2">
              {progress}% concluído
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Period Selection */}
            <div className="space-y-3">
              <Label className="font-medium">Período</Label>
              <RadioGroup value={periodType} onValueChange={(v) => setPeriodType(v as 'all' | 'custom')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="cursor-pointer">Todo o período</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom" className="cursor-pointer">Intervalo de datas</Label>
                </div>
              </RadioGroup>
              
              {periodType === 'custom' && (
                <div className="grid grid-cols-2 gap-4 pl-6">
                  <div className="space-y-1">
                    <Label className="text-sm">Data Inicial</Label>
                    <Input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Data Final</Label>
                    <Input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sections Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium">O que exportar</Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAllSections}>
                    Selecionar todos
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deselectAllSections}>
                    Limpar
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {exportSections.map((section) => {
                  const Icon = section.icon;
                  const count = timeline.filter(item => item.type === section.id).length;
                  return (
                    <div key={section.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={section.id}
                        checked={selectedSections.includes(section.id)}
                        onCheckedChange={() => toggleSection(section.id)}
                      />
                      <Label 
                        htmlFor={section.id} 
                        className="flex items-center gap-2 cursor-pointer flex-1"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {section.label}
                        <span className="text-xs text-muted-foreground ml-auto">
                          ({count})
                        </span>
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Export Button */}
            <Button 
              onClick={generatePDF} 
              className="w-full gap-2"
              disabled={selectedSections.length === 0}
            >
              <Download className="h-4 w-4" />
              Gerar PDF Consolidado
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              O PDF será gerado com capa, sumário e seções organizadas cronologicamente.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
