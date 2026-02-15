import jsPDF from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export async function generateFacilityReport(
  data: any,
  options: { projectName: string; period: "daily" | "monthly"; date: Date }
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(20);
  doc.text("Relatório de Gestão Predial", pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(12);
  doc.text(options.projectName, pageWidth / 2, 30, { align: "center" });
  
  const periodText = options.period === "daily" 
    ? format(options.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : format(options.date, "MMMM 'de' yyyy", { locale: ptBR });
  
  doc.setFontSize(10);
  doc.text(periodText, pageWidth / 2, 37, { align: "center" });
  
  let yPos = 50;

  // Tasks Summary
  doc.setFontSize(14);
  doc.text("Resumo de Ordens de Serviço", 14, yPos);
  yPos += 10;

  const taskStats = [
    ["Status", "Quantidade"],
    ["Concluídas", data.tasks.filter((t: any) => t.status === "concluída").length.toString()],
    ["Em Processo", data.tasks.filter((t: any) => t.status === "em_processo").length.toString()],
    ["Pendentes", data.tasks.filter((t: any) => t.status === "pendente").length.toString()],
    ["Em Verificação", data.tasks.filter((t: any) => t.status === "em_verificacao").length.toString()],
  ];

  (doc as any).autoTable({
    startY: yPos,
    head: [taskStats[0]],
    body: taskStats.slice(1),
    theme: "grid",
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Material Requests
  if (data.materialRequests.length > 0) {
    doc.setFontSize(14);
    doc.text("Pedidos de Material", 14, yPos);
    yPos += 10;

    const requestsData = data.materialRequests.slice(0, 10).map((req: any) => [
      req.material_name,
      `${req.quantity} ${req.unit}`,
      req.requestor_name,
      req.status,
    ]);

    (doc as any).autoTable({
      startY: yPos,
      head: [["Material", "Quantidade", "Solicitante", "Status"]],
      body: requestsData,
      theme: "grid",
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Check if new page is needed
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  // Consumption
  if (data.consumption.length > 0) {
    doc.setFontSize(14);
    doc.text("Consumo de Recursos", 14, yPos);
    yPos += 10;

    const calculateConsumption = (meterType: string) => {
      const filtered = data.consumption.filter((r: any) => r.meter_type === meterType);
      if (filtered.length < 2) return 0;
      const sorted = filtered.sort((a: any, b: any) => {
        const dateCompare = a.reading_date.localeCompare(b.reading_date);
        if (dateCompare !== 0) return dateCompare;
        return a.reading_time.localeCompare(b.reading_time);
      });
      return sorted[sorted.length - 1].meter_value - sorted[0].meter_value;
    };

    const consumptionData = [
      ["Recurso", "Consumo"],
      ["Água", `${calculateConsumption("water").toFixed(2)} m³`],
      ["Energia", `${calculateConsumption("energy").toFixed(2)} kWh`],
      ["Gás", `${calculateConsumption("gas").toFixed(2)} m³`],
    ];

    (doc as any).autoTable({
      startY: yPos,
      head: [consumptionData[0]],
      body: consumptionData.slice(1),
      theme: "grid",
    });
  }

  // Footer with signature
  const pageCount = doc.getNumberOfPages();
  const pageHeightVal = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeightVal - 15,
      { align: "center" }
    );
    // ConstruData signature
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120);
    doc.text(
      "Gerado automaticamente e sem dor de cabeça pelo ConstruData.",
      pageWidth / 2,
      pageHeightVal - 8,
      { align: "center" }
    );
    doc.setFont("helvetica", "normal");
  }

  // Save
  const fileName = `relatorio-gestao-predial-${format(options.date, "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
