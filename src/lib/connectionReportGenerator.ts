import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConnectionReport {
  id: string;
  team_name: string;
  report_date: string;
  address: string;
  address_complement: string | null;
  client_name: string;
  water_meter_number: string;
  os_number: string;
  service_type: string;
  service_category?: string | null;
  connection_type?: string | null;
  observations: string | null;
  materials_used: any[] | null;
  photos_urls: string[];
  logo_url: string | null;
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

export async function generateConnectionReportPDF(report: ConnectionReport) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // Header with Logo
  if (report.logo_url) {
    try {
      const logo = await loadImage(report.logo_url);
      const logoSize = 25;
      doc.addImage(logo, "PNG", margin, yPos, logoSize, logoSize);
    } catch (error) {
      console.error("Error loading logo:", error);
    }
  }

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO DE LIGAÇÃO", pageWidth / 2, yPos + 8, { align: "center" });
  yPos += 25;

  // Draw border around content area
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPos, pageWidth - 2 * margin, pageHeight - yPos - 30);

  // Content padding
  const contentMargin = margin + 5;
  yPos += 5;

  // Report Information with styled sections
  doc.setFontSize(11);
  doc.setTextColor(0);

  const addSectionTitle = (title: string) => {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin;
    }
    doc.setFillColor(240, 240, 240);
    doc.rect(contentMargin, yPos - 4, pageWidth - 2 * margin - 10, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, contentMargin + 2, yPos + 1);
    yPos += 10;
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
      doc.text(value, contentMargin + 35, yPos);
      yPos += 7;
    } else {
      yPos += 6;
      const valueLines = doc.splitTextToSize(value, pageWidth - 2 * margin - 20);
      valueLines.forEach((line: string) => {
        doc.text(line, contentMargin + 4, yPos);
        yPos += 5;
      });
      yPos += 2;
    }
  };

  // Team and Date Section
  addSectionTitle("INFORMAÇÕES DA EQUIPE");
  addField("Equipe", report.team_name, true);
  addField(
    "Data",
    format(new Date(report.report_date), "dd/MM/yyyy", { locale: ptBR }),
    true
  );
  yPos += 3;

  // Client Information
  addSectionTitle("DADOS DO CLIENTE");
  addField("Cliente", report.client_name, true);
  addField(
    "Endereço",
    `${report.address}${report.address_complement ? `, ${report.address_complement}` : ""}`,
    false
  );
  yPos += 3;

  // Service Information
  addSectionTitle("INFORMAÇÕES DO SERVIÇO");
  addField("Hidrômetro", report.water_meter_number, true);
  addField("Número da OS", report.os_number, true);
  addField("Tipo de Serviço", report.service_type, true);
  yPos += 3;

  // Materials Used
  if (report.materials_used && report.materials_used.length > 0) {
    addSectionTitle("MATERIAIS UTILIZADOS");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    report.materials_used.forEach((material: string) => {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margin + 10;
      }
      doc.text(`• ${material}`, contentMargin + 2, yPos);
      yPos += 5;
    });
    yPos += 3;
  }

  // Observations
  if (report.observations) {
    addSectionTitle("OBSERVAÇÕES");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    const obsLines = doc.splitTextToSize(report.observations, pageWidth - 2 * margin - 20);
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

  // Photos Section
  if (report.photos_urls && report.photos_urls.length > 0) {
    // Check if we need a new page for photos
    if (yPos > pageHeight - 100) {
      doc.addPage();
      yPos = margin + 10;
    }

    addSectionTitle("FOTOS");
    yPos += 5;

    const photosPerRow = 4;
    const photoSpacing = 3;
    const availableWidth = pageWidth - 2 * margin - 10;
    const imgWidth = (availableWidth - (photosPerRow - 1) * photoSpacing) / photosPerRow;
    const imgHeight = imgWidth * 0.75;
    
    let xPos = contentMargin + 2;
    let photosInRow = 0;

    for (let i = 0; i < report.photos_urls.length; i++) {
      try {
        // Check if we need a new page
        if (yPos + imgHeight > pageHeight - margin - 20) {
          doc.addPage();
          yPos = margin + 10;
          xPos = contentMargin + 2;
          photosInRow = 0;
        }

        const img = await loadImage(report.photos_urls[i]);
        
        // Draw border around photo
        doc.setDrawColor(200);
        doc.rect(xPos, yPos, imgWidth, imgHeight);
        
        // Add photo
        doc.addImage(img, "JPEG", xPos + 1, yPos + 1, imgWidth - 2, imgHeight - 2);

        photosInRow++;
        
        if (photosInRow === photosPerRow) {
          // Move to next row
          yPos += imgHeight + photoSpacing;
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
      `Página ${i} de ${pageCount}`,
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
  const fileName = `relatorio-ligacao-${report.os_number}-${format(
    new Date(report.report_date),
    "yyyy-MM-dd"
  )}.pdf`;
  doc.save(fileName);
}

// Interface para serviços consolidados
interface ConsolidatedService {
  service_type: string;
  service_category: string | null;
  connection_type: string | null;
  quantity: number;
  teams: Set<string>;
  os_numbers: string[];
  clients: string[];
  addresses: string[];
}

// Interface para filtros de exportação
interface ExportFilters {
  includeTeamSummary?: boolean;
  includeServiceSummary?: boolean;
  includeDetailedList?: boolean;
  includeMaterials?: boolean;
  includeObservations?: boolean;
  includePhotos?: boolean;
  filterByTeam?: string;
  filterByServiceType?: string;
}

// Gera relatório consolidado com todos os relatórios do dia - COM SOMA DE SERVIÇOS IGUAIS
export async function generateConsolidatedReportPDF(
  reports: ConnectionReport[], 
  date: string, 
  filters: ExportFilters = {}
) {
  // Valores padrão para os filtros
  const {
    includeTeamSummary = true,
    includeServiceSummary = true,
    includeDetailedList = true,
    includeMaterials = true,
    includeObservations = true,
    includePhotos = false,
  } = filters;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO CONSOLIDADO DE LIGAÇÕES", pageWidth / 2, yPos, { align: "center" });
  yPos += 8;
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Data: ${format(new Date(date), "dd/MM/yyyy", { locale: ptBR })}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 5;
  doc.text(`Total de serviços: ${reports.length}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Consolidar serviços iguais
  const consolidatedMap = new Map<string, ConsolidatedService>();
  
  reports.forEach(r => {
    // Criar chave única baseada no tipo de serviço, categoria e tipo de conexão
    const key = `${r.service_type}|${r.service_category || ''}|${r.connection_type || ''}`;
    
    if (consolidatedMap.has(key)) {
      const existing = consolidatedMap.get(key)!;
      existing.quantity += 1;
      existing.teams.add(r.team_name);
      existing.os_numbers.push(r.os_number);
      existing.clients.push(r.client_name);
      existing.addresses.push(r.address + (r.address_complement ? `, ${r.address_complement}` : ''));
    } else {
      consolidatedMap.set(key, {
        service_type: r.service_type,
        service_category: r.service_category || null,
        connection_type: r.connection_type || null,
        quantity: 1,
        teams: new Set([r.team_name]),
        os_numbers: [r.os_number],
        clients: [r.client_name],
        addresses: [r.address + (r.address_complement ? `, ${r.address_complement}` : '')]
      });
    }
  });

  const consolidatedServices = Array.from(consolidatedMap.values());

  // Resumo por equipe
  if (includeTeamSummary) {
    const byTeam: Record<string, number> = {};
    reports.forEach(r => {
      byTeam[r.team_name] = (byTeam[r.team_name] || 0) + 1;
    });

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMO POR EQUIPE:", margin, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    Object.entries(byTeam).forEach(([team, count]) => {
      doc.text(`• ${team}: ${count} serviço(s)`, margin + 5, yPos);
      yPos += 5;
    });
    yPos += 8;
  }

  // RESUMO CONSOLIDADO POR TIPO DE SERVIÇO (COM SOMA)
  if (includeServiceSummary) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setFillColor(230, 230, 250);
    doc.rect(margin, yPos - 4, pageWidth - 2 * margin, 8, "F");
    doc.text("SERVIÇOS CONSOLIDADOS (SOMADOS):", margin + 2, yPos + 1);
    yPos += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    // Tabela de serviços consolidados
    consolidatedServices.forEach(service => {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margin;
      }

      const serviceDesc = [
        service.service_type,
        service.service_category ? `(${service.service_category})` : '',
        service.connection_type ? `- ${service.connection_type}` : ''
      ].filter(Boolean).join(' ');

      doc.setFont("helvetica", "bold");
      doc.text(`• ${serviceDesc}`, margin + 5, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(`Quantidade: ${service.quantity}`, pageWidth - margin - 40, yPos);
      yPos += 5;

      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Equipes: ${Array.from(service.teams).join(', ')}`, margin + 10, yPos);
      yPos += 4;
      doc.text(`OS: ${service.os_numbers.join(', ')}`, margin + 10, yPos);
      doc.setTextColor(0);
      doc.setFontSize(10);
      yPos += 7;
    });

    yPos += 5;

    // Linha divisória
    doc.setDrawColor(200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;
  }

  // Lista detalhada de todos os serviços
  if (includeDetailedList) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("DETALHAMENTO INDIVIDUAL DOS SERVIÇOS:", margin, yPos);
    yPos += 8;

    for (let i = 0; i < reports.length; i++) {
      const report = reports[i];
      
      // Calcula altura necessária para este item
      let itemHeight = 42;
      if (includeMaterials && report.materials_used && report.materials_used.length > 0) {
        itemHeight += 10 + (report.materials_used.length * 4);
      }
      
      // Verifica se precisa nova página
      if (yPos > pageHeight - itemHeight - 20) {
        doc.addPage();
        yPos = margin;
      }

      // Box do serviço
      doc.setDrawColor(200);
      doc.setFillColor(248, 248, 248);
      doc.roundedRect(margin, yPos - 3, pageWidth - 2 * margin, 42, 2, 2, "FD");

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}. OS: ${report.os_number}`, margin + 3, yPos + 3);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      
      const col1X = margin + 3;
      const col2X = pageWidth / 2;
      let lineY = yPos + 10;

      doc.text(`Equipe: ${report.team_name}`, col1X, lineY);
      doc.text(`Tipo: ${report.service_type}`, col2X, lineY);
      lineY += 5;

      doc.text(`Cliente: ${report.client_name}`, col1X, lineY);
      doc.text(`Hidrômetro: ${report.water_meter_number}`, col2X, lineY);
      lineY += 5;

      const address = report.address + (report.address_complement ? `, ${report.address_complement}` : '');
      const addressLines = doc.splitTextToSize(`Endereço: ${address}`, pageWidth - 2 * margin - 10);
      addressLines.slice(0, 2).forEach((line: string) => {
        doc.text(line, col1X, lineY);
        lineY += 5;
      });

      if (includeObservations && report.observations) {
        const obsText = `Obs: ${report.observations.substring(0, 80)}${report.observations.length > 80 ? '...' : ''}`;
        doc.text(obsText, col1X, lineY);
      }

      yPos += 47;

      // Materiais utilizados
      if (includeMaterials && report.materials_used && report.materials_used.length > 0) {
        doc.setFontSize(8);
        doc.text("Materiais:", margin + 5, yPos);
        yPos += 4;
        report.materials_used.forEach((mat: string) => {
          doc.text(`  • ${mat}`, margin + 8, yPos);
          yPos += 4;
        });
        yPos += 3;
      }
    }
  }

  // Fotos (se incluído)
  if (includePhotos) {
    const reportsWithPhotos = reports.filter(r => r.photos_urls && r.photos_urls.length > 0);
    
    if (reportsWithPhotos.length > 0) {
      doc.addPage();
      yPos = margin;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("REGISTRO FOTOGRÁFICO:", margin, yPos);
      yPos += 10;

      for (const report of reportsWithPhotos) {
        if (yPos > pageHeight - 80) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`OS: ${report.os_number} - ${report.team_name}`, margin, yPos);
        yPos += 5;

        const photosPerRow = 4;
        const photoSpacing = 3;
        const availableWidth = pageWidth - 2 * margin;
        const imgWidth = (availableWidth - (photosPerRow - 1) * photoSpacing) / photosPerRow;
        const imgHeight = imgWidth * 0.75;
        
        let xPos = margin;
        let photosInRow = 0;

        for (const photoUrl of report.photos_urls.slice(0, 4)) {
          try {
            const img = await loadImage(photoUrl);
            doc.addImage(img, "JPEG", xPos, yPos, imgWidth, imgHeight);
            
            photosInRow++;
            if (photosInRow === photosPerRow) {
              yPos += imgHeight + photoSpacing;
              xPos = margin;
              photosInRow = 0;
            } else {
              xPos += imgWidth + photoSpacing;
            }
          } catch (error) {
            console.error("Error loading image:", error);
          }
        }

        if (photosInRow > 0) {
          yPos += imgHeight + 10;
        } else {
          yPos += 5;
        }
      }
    }
  }

  // Footer em todas as páginas com assinatura
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} - Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
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
  const fileName = `relatorio-consolidado-${format(new Date(date), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
