import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RDOReport {
  id: string;
  report_date: string;
  project: { name: string };
  construction_site: { name: string; address: string | null };
  service_front: { name: string };
  temperature: number | null;
  humidity: number | null;
  wind_speed: number | null;
  will_rain: boolean | null;
  weather_description: string | null;
  terrain_condition: string | null;
  gps_location: string | null;
  general_observations: string | null;
  visits: string | null;
  occurrences_summary: string | null;
  executed_services: Array<{
    quantity: number;
    unit: string;
    equipment_used: any;
    services_catalog: { name: string };
    employees: { name: string } | null;
  }>;
  photos: Array<{
    photo_url: string;
    uploaded_at: string;
  }>;
}

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

export async function generateRDOReportPDF(report: RDOReport, consolidateServices: boolean = false) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // Consolidate services if requested
  let processedServices = report.executed_services || [];
  if (consolidateServices && processedServices.length > 0) {
    const serviceMap = new Map<string, any>();
    
    processedServices.forEach((service) => {
      const serviceName = service.services_catalog?.name || 'N/A';
      const key = `${serviceName}_${service.unit}`;
      
      if (serviceMap.has(key)) {
        const existing = serviceMap.get(key);
        existing.quantity = (parseFloat(existing.quantity) || 0) + (parseFloat(String(service.quantity)) || 0);
        // Concatenate equipment
        if (service.equipment_used) {
          const existingEquip = existing.equipment_used?.equipment || '';
          const newEquip = typeof service.equipment_used === 'object' 
            ? service.equipment_used.equipment 
            : service.equipment_used;
          if (newEquip && !existingEquip.includes(newEquip)) {
            existing.equipment_used = { equipment: existingEquip ? `${existingEquip}, ${newEquip}` : newEquip };
          }
        }
      } else {
        serviceMap.set(key, { ...service, quantity: parseFloat(String(service.quantity)) || 0 });
      }
    });
    
    processedServices = Array.from(serviceMap.values());
  }

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO DIÁRIO DE OBRA (RDO)", pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Draw border around content area
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPos, pageWidth - 2 * margin, pageHeight - yPos - 30);

  // Content padding
  const contentMargin = margin + 5;
  yPos += 5;

  // Helper functions
  const addSectionTitle = (title: string) => {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin;
    }
    doc.setFillColor(59, 130, 246);
    doc.rect(contentMargin, yPos - 4, pageWidth - 2 * margin - 10, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title, contentMargin + 2, yPos + 1);
    doc.setTextColor(0, 0, 0);
    yPos += 12;
  };

  const addField = (label: string, value: string, inline: boolean = false) => {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin + 10;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`${label}:`, contentMargin + 2, yPos);
    doc.setFont("helvetica", "normal");
    
    if (inline) {
      doc.text(value, contentMargin + 45, yPos);
      yPos += 7;
    } else {
      yPos += 6;
      const valueLines = doc.splitTextToSize(value, pageWidth - 2 * margin - 20);
      valueLines.forEach((line: string) => {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = margin + 10;
        }
        doc.text(line, contentMargin + 4, yPos);
        yPos += 5;
      });
      yPos += 2;
    }
  };

  // Basic Information
  addSectionTitle("INFORMAÇÕES BÁSICAS");
  addField("Data", format(new Date(report.report_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR }), true);
  addField("Projeto", report.project.name, true);
  addField("Local da Obra", report.construction_site.name, true);
  if (report.construction_site.address) {
    addField("Endereço", report.construction_site.address, false);
  }
  addField("Frente de Serviço", report.service_front.name, true);
  yPos += 3;

  // Weather Information
  if (report.temperature || report.humidity || report.weather_description) {
    addSectionTitle("CONDIÇÕES CLIMÁTICAS");
    if (report.temperature) addField("Temperatura", `${report.temperature}°C`, true);
    if (report.humidity) addField("Umidade", `${report.humidity}%`, true);
    if (report.wind_speed) addField("Velocidade do Vento", `${report.wind_speed} km/h`, true);
    if (report.will_rain !== null) addField("Previsão de Chuva", report.will_rain ? "Sim" : "Não", true);
    if (report.weather_description) addField("Descrição", report.weather_description, false);
    yPos += 3;
  }

  // Site Conditions
  if (report.terrain_condition) {
    addSectionTitle("CONDIÇÕES DO TERRENO");
    addField("Condição", report.terrain_condition, false);
    yPos += 3;
  }

  // GPS Location
  if (report.gps_location) {
    addSectionTitle("LOCALIZAÇÃO GPS");
    addField("Coordenadas", report.gps_location, true);
    yPos += 3;
  }

  // Executed Services
  if (processedServices && processedServices.length > 0) {
    addSectionTitle(consolidateServices ? "SERVIÇOS EXECUTADOS (CONSOLIDADOS)" : "SERVIÇOS EXECUTADOS");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    processedServices.forEach((service, index) => {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margin + 10;
      }
      
      const serviceName = service.services_catalog?.name || 'Serviço não especificado';
      const serviceLine = `${index + 1}. ${serviceName} - ${service.quantity} ${service.unit}`;
      doc.text(serviceLine, contentMargin + 2, yPos);
      yPos += 5;
      
      if (service.employees) {
        doc.setFont("helvetica", "italic");
        doc.text(`   Responsável: ${service.employees.name}`, contentMargin + 2, yPos);
        doc.setFont("helvetica", "normal");
        yPos += 5;
      }
      
      if (service.equipment_used) {
        const equipment = typeof service.equipment_used === 'object' 
          ? service.equipment_used.equipment 
          : service.equipment_used;
        if (equipment) {
          doc.setFont("helvetica", "italic");
          doc.text(`   Equipamento: ${equipment}`, contentMargin + 2, yPos);
          doc.setFont("helvetica", "normal");
          yPos += 5;
        }
      }
      
      yPos += 2;
    });
    yPos += 3;
  }

  // General Observations
  if (report.general_observations) {
    addSectionTitle("OBSERVAÇÕES GERAIS");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    const obsLines = doc.splitTextToSize(report.general_observations, pageWidth - 2 * margin - 20);
    obsLines.forEach((line: string) => {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margin + 10;
      }
      doc.text(line, contentMargin + 2, yPos);
      yPos += 5;
    });
    yPos += 3;
  }

  // Visits
  if (report.visits) {
    addSectionTitle("VISITAS");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    const visitLines = doc.splitTextToSize(report.visits, pageWidth - 2 * margin - 20);
    visitLines.forEach((line: string) => {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margin + 10;
      }
      doc.text(line, contentMargin + 2, yPos);
      yPos += 5;
    });
    yPos += 3;
  }

  // Occurrences
  if (report.occurrences_summary) {
    addSectionTitle("OCORRÊNCIAS");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    const occLines = doc.splitTextToSize(report.occurrences_summary, pageWidth - 2 * margin - 20);
    occLines.forEach((line: string) => {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margin + 10;
      }
      doc.text(line, contentMargin + 2, yPos);
      yPos += 5;
    });
    yPos += 3;
  }

  // Photos Section
  if (report.photos && report.photos.length > 0) {
    // Check if we need a new page for photos
    if (yPos > pageHeight - 100) {
      doc.addPage();
      yPos = margin + 10;
    }

    addSectionTitle("FOTOS DE VALIDAÇÃO");
    yPos += 5;

    const photosPerRow = 2;
    const photoSpacing = 5;
    const availableWidth = pageWidth - 2 * margin - 10;
    const imgWidth = (availableWidth - (photosPerRow - 1) * photoSpacing) / photosPerRow;
    const imgHeight = imgWidth * 0.75;
    
    let xPos = contentMargin + 2;
    let photosInRow = 0;

    for (let i = 0; i < report.photos.length; i++) {
      try {
        // Check if we need a new page
        if (yPos + imgHeight > pageHeight - margin - 20) {
          doc.addPage();
          yPos = margin + 10;
          xPos = contentMargin + 2;
          photosInRow = 0;
        }

        const img = await loadImage(report.photos[i].photo_url);
        
        // Draw border around photo
        doc.setDrawColor(200);
        doc.rect(xPos, yPos, imgWidth, imgHeight);
        
        // Add photo
        doc.addImage(img, "JPEG", xPos + 1, yPos + 1, imgWidth - 2, imgHeight - 2);

        // Add timestamp below photo
        doc.setFontSize(7);
        doc.setTextColor(100);
        const timestamp = format(new Date(report.photos[i].uploaded_at), "dd/MM/yyyy HH:mm", { locale: ptBR });
        doc.text(timestamp, xPos + imgWidth / 2, yPos + imgHeight + 4, { align: "center" });
        doc.setTextColor(0);

        photosInRow++;
        
        if (photosInRow === photosPerRow) {
          // Move to next row
          yPos += imgHeight + photoSpacing + 8;
          xPos = contentMargin + 2;
          photosInRow = 0;
        } else {
          // Move to next column
          xPos += imgWidth + photoSpacing;
        }
      } catch (error) {
        console.error("Error loading image:", error);
      }
    }

    // Move past the last row if it wasn't completed
    if (photosInRow > 0) {
      yPos += imgHeight + 10;
    }
  }

  // Footer on all pages with signature
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `RDO - ${report.project.name} | Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 15,
      { align: "center" }
    );
    // ConstruData signature
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120);
    doc.text(
      "Gerado automaticamente e sem dor de cabeça pelo ConstruData.",
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
    doc.setFont("helvetica", "normal");
  }

  // Save
  const fileName = `RDO-${report.project.name.replace(/[^a-zA-Z0-9]/g, '_')}-${format(
    new Date(report.report_date + 'T12:00:00'),
    "yyyy-MM-dd"
  )}.pdf`;
  doc.save(fileName);
}
