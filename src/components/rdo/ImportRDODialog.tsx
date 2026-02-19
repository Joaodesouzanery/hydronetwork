import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, FileJson, FileSpreadsheet, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Progress } from "@/components/ui/progress";

interface ImportRDODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

interface ParsedRDO {
  date: string;
  location: string;
  front: string;
  observations?: string;
  services: { name: string; quantity: number; unit: string }[];
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "done";

export const ImportRDODialog = ({ open, onOpenChange, projectId, onSuccess }: ImportRDODialogProps) => {
  const [step, setStep] = useState<ImportStep>("upload");
  const [rawData, setRawData] = useState<any[]>([]);
  const [parsedRDOs, setParsedRDOs] = useState<ParsedRDO[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileFormat, setFileFormat] = useState("");
  const [progress, setProgress] = useState(0);
  const [importResults, setImportResults] = useState({ success: 0, errors: 0 });
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    date: "", location: "", front: "", observations: "", serviceName: "", quantity: "", unit: ""
  });
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setRawData([]);
    setParsedRDOs([]);
    setFileName("");
    setFileFormat("");
    setProgress(0);
    setImportResults({ success: 0, errors: 0 });
    setColumnMapping({ date: "", location: "", front: "", observations: "", serviceName: "", quantity: "", unit: "" });
    setDetectedColumns([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";

    try {
      if (ext === "json" || ext === "geojson") {
        setFileFormat(ext === "geojson" ? "GeoJSON" : "JSON");
        const text = await file.text();
        const json = JSON.parse(text);
        handleJsonData(json);
      } else if (ext === "csv") {
        setFileFormat("CSV");
        const text = await file.text();
        handleCsvData(text);
      } else if (ext === "pdf") {
        setFileFormat("PDF");
        toast.info("Extraindo texto do PDF...");
        const { extractPdfText } = await import("@/lib/pdfTextExtractor");
        const text = await extractPdfText(file);
        handlePdfData(text);
      } else {
        toast.error("Formato não suportado. Use JSON, GeoJSON, CSV ou PDF.");
      }
    } catch (err: any) {
      console.error("Erro ao ler arquivo:", err);
      toast.error("Erro ao ler arquivo: " + (err.message || "Formato inválido"));
    }
  };

  const handleJsonData = (json: any) => {
    // Handle GeoJSON FeatureCollection
    let items: any[] = [];
    if (json.type === "FeatureCollection" && Array.isArray(json.features)) {
      items = json.features.map((f: any) => ({ ...f.properties, _geometry: f.geometry }));
    } else if (Array.isArray(json)) {
      items = json;
    } else if (json.rdos && Array.isArray(json.rdos)) {
      items = json.rdos;
    } else if (json.data && Array.isArray(json.data)) {
      items = json.data;
    } else {
      // Single object
      items = [json];
    }

    if (items.length === 0) {
      toast.error("Nenhum dado encontrado no arquivo");
      return;
    }

    setRawData(items);
    const cols = Object.keys(items[0]).filter(k => !k.startsWith("_"));
    setDetectedColumns(cols);

    // Auto-map common field names
    const autoMap = { ...columnMapping };
    const dateAliases = ["date", "data", "report_date", "dt", "dia"];
    const locationAliases = ["location", "local", "localizacao", "obra", "construction_site", "endereco"];
    const frontAliases = ["front", "frente", "service_front", "frente_servico"];
    const obsAliases = ["observations", "observacoes", "obs", "notas", "notes", "general_observations"];
    const serviceAliases = ["service", "servico", "service_name", "nome_servico", "descricao"];
    const qtyAliases = ["quantity", "quantidade", "qtd", "qty"];
    const unitAliases = ["unit", "unidade", "un", "und"];

    const tryMap = (aliases: string[], key: string) => {
      const found = cols.find(c => aliases.includes(c.toLowerCase()));
      if (found) autoMap[key] = found;
    };

    tryMap(dateAliases, "date");
    tryMap(locationAliases, "location");
    tryMap(frontAliases, "front");
    tryMap(obsAliases, "observations");
    tryMap(serviceAliases, "serviceName");
    tryMap(qtyAliases, "quantity");
    tryMap(unitAliases, "unit");

    setColumnMapping(autoMap);

    // If we have enough auto-mapped fields, try direct parsing
    if (autoMap.date) {
      tryDirectParse(items, autoMap);
    } else {
      setStep("mapping");
    }
  };

  const handleCsvData = (text: string) => {
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      toast.error("CSV deve ter pelo menos 2 linhas (cabeçalho + dados)");
      return;
    }

    // Detect delimiter
    let delimiter = ",";
    if (lines[0].includes("\t")) delimiter = "\t";
    else if (lines[0].includes(";")) delimiter = ";";

    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ""));
    const items = lines.slice(1).map(line => {
      const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ""; });
      return obj;
    });

    setRawData(items);
    setDetectedColumns(headers);

    // Auto-map
    const autoMap = { ...columnMapping };
    const dateAliases = ["date", "data", "report_date", "dt", "dia"];
    const locationAliases = ["location", "local", "localizacao", "obra", "construction_site", "endereco", "local da obra"];
    const frontAliases = ["front", "frente", "service_front", "frente_servico", "frente de serviço"];
    const obsAliases = ["observations", "observacoes", "obs", "notas", "notes"];
    const serviceAliases = ["service", "servico", "service_name", "nome_servico", "serviço", "descrição", "descricao"];
    const qtyAliases = ["quantity", "quantidade", "qtd", "qty"];
    const unitAliases = ["unit", "unidade", "un", "und"];

    const tryMap = (aliases: string[], key: string) => {
      const found = headers.find(c => aliases.includes(c.toLowerCase()));
      if (found) autoMap[key] = found;
    };

    tryMap(dateAliases, "date");
    tryMap(locationAliases, "location");
    tryMap(frontAliases, "front");
    tryMap(obsAliases, "observations");
    tryMap(serviceAliases, "serviceName");
    tryMap(qtyAliases, "quantity");
    tryMap(unitAliases, "unit");

    setColumnMapping(autoMap);
    setStep("mapping");
  };

  const handlePdfData = (text: string) => {
    // Try to extract structured data from PDF text
    const lines = text.split("\n").filter(l => l.trim());
    
    // Heuristic: look for date patterns and service lines
    const rdos: ParsedRDO[] = [];
    let currentRDO: Partial<ParsedRDO> | null = null;
    const dateRegex = /(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/;

    for (const line of lines) {
      const dateMatch = line.match(dateRegex);
      
      // If we find a line with a date and it seems like a header/title line
      if (dateMatch && (line.toLowerCase().includes("rdo") || line.toLowerCase().includes("relatório") || line.toLowerCase().includes("diário"))) {
        if (currentRDO && currentRDO.date) {
          rdos.push({
            date: currentRDO.date,
            location: currentRDO.location || "Importado do PDF",
            front: currentRDO.front || "Frente Importada",
            observations: currentRDO.observations,
            services: currentRDO.services || []
          });
        }
        currentRDO = {
          date: normalizeDate(dateMatch[1]),
          services: [],
          location: "",
          front: ""
        };
        continue;
      }

      // If we have a current RDO, try to extract data
      if (currentRDO) {
        if (line.toLowerCase().includes("local") || line.toLowerCase().includes("obra")) {
          const parts = line.split(/[:\t]/).map(p => p.trim());
          if (parts.length > 1) currentRDO.location = parts.slice(1).join(" ");
        }
        if (line.toLowerCase().includes("frente")) {
          const parts = line.split(/[:\t]/).map(p => p.trim());
          if (parts.length > 1) currentRDO.front = parts.slice(1).join(" ");
        }

        // Try to parse service lines (look for numbers that could be quantities)
        const numMatch = line.match(/(\d+[\.,]?\d*)\s*(m|m2|m3|un|vb|kg|h|m²|m³)/i);
        if (numMatch) {
          const serviceName = line.replace(numMatch[0], "").trim().replace(/[:\-\t]+$/, "").trim();
          if (serviceName) {
            currentRDO.services?.push({
              name: serviceName.substring(0, 100),
              quantity: parseFloat(numMatch[1].replace(",", ".")),
              unit: numMatch[2].replace("²", "2").replace("³", "3")
            });
          }
        }
      } else {
        // No current RDO yet, check if line has a date (standalone)
        if (dateMatch) {
          currentRDO = {
            date: normalizeDate(dateMatch[1]),
            services: [],
            location: "Importado do PDF",
            front: "Frente Importada"
          };
        }
      }
    }

    // Push last RDO
    if (currentRDO && currentRDO.date) {
      rdos.push({
        date: currentRDO.date,
        location: currentRDO.location || "Importado do PDF",
        front: currentRDO.front || "Frente Importada",
        observations: currentRDO.observations,
        services: currentRDO.services || []
      });
    }

    if (rdos.length === 0) {
      // Fallback: create one RDO per date found in entire text
      const allDates = new Set<string>();
      for (const line of lines) {
        const m = line.match(dateRegex);
        if (m) allDates.add(normalizeDate(m[1]));
      }
      
      if (allDates.size > 0) {
        allDates.forEach(d => {
          rdos.push({ date: d, location: "Importado do PDF", front: "Frente Importada", services: [] });
        });
      } else {
        // Last resort: single RDO with today's date
        rdos.push({
          date: new Date().toISOString().split("T")[0],
          location: "Importado do PDF",
          front: "Frente Importada",
          observations: text.substring(0, 500),
          services: []
        });
      }
    }

    setParsedRDOs(rdos);
    setStep("preview");
    toast.success(`${rdos.length} RDO(s) extraído(s) do PDF`);
  };

  const normalizeDate = (dateStr: string): string => {
    // Convert dd/mm/yyyy or dd-mm-yyyy to yyyy-mm-dd
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      let [d, m, y] = parts;
      if (y.length === 2) y = "20" + y;
      if (parseInt(d) > 12) {
        // Likely dd/mm/yyyy
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    }
    // Try native parse
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
    return dateStr;
  };

  const tryDirectParse = (items: any[], mapping: Record<string, string>) => {
    const rdos: ParsedRDO[] = [];

    // Group by date+location to consolidate services
    const grouped = new Map<string, ParsedRDO>();

    for (const item of items) {
      const dateRaw = String(item[mapping.date] || "");
      const date = normalizeDate(dateRaw);
      const location = String(item[mapping.location] || "Importado");
      const front = String(item[mapping.front] || "Frente Importada");
      const obs = mapping.observations ? String(item[mapping.observations] || "") : "";

      const key = `${date}|${location}|${front}`;
      if (!grouped.has(key)) {
        grouped.set(key, { date, location, front, observations: obs, services: [] });
      }

      if (mapping.serviceName && item[mapping.serviceName]) {
        grouped.get(key)!.services.push({
          name: String(item[mapping.serviceName]),
          quantity: parseFloat(String(item[mapping.quantity] || "0").replace(",", ".")) || 0,
          unit: String(item[mapping.unit] || "un")
        });
      }

      // Check if item has nested services array
      if (item.services && Array.isArray(item.services)) {
        for (const svc of item.services) {
          grouped.get(key)!.services.push({
            name: String(svc.name || svc.serviceName || svc.servico || svc.descricao || "Serviço importado"),
            quantity: parseFloat(String(svc.quantity || svc.quantidade || svc.qtd || "0").replace(",", ".")) || 0,
            unit: String(svc.unit || svc.unidade || "un")
          });
        }
      }
    }

    grouped.forEach(v => rdos.push(v));

    setParsedRDOs(rdos);
    setStep("preview");
  };

  const handleApplyMapping = () => {
    if (!columnMapping.date) {
      toast.error("O campo 'Data' é obrigatório para importação");
      return;
    }
    tryDirectParse(rawData, columnMapping);
  };

  const handleImport = async () => {
    if (parsedRDOs.length === 0) {
      toast.error("Nenhum RDO para importar");
      return;
    }

    setStep("importing");
    setProgress(0);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }

    let success = 0;
    let errors = 0;

    for (let i = 0; i < parsedRDOs.length; i++) {
      const rdo = parsedRDOs[i];
      try {
        // 1. Find or create construction_site
        let siteId: string;
        const { data: existingSite } = await supabase
          .from("construction_sites")
          .select("id")
          .eq("project_id", projectId)
          .ilike("name", rdo.location)
          .limit(1)
          .single();

        if (existingSite) {
          siteId = existingSite.id;
        } else {
          const { data: newSite, error: siteErr } = await supabase
            .from("construction_sites")
            .insert({ name: rdo.location || "Importado", project_id: projectId, created_by_user_id: user.id })
            .select("id")
            .single();
          if (siteErr) throw siteErr;
          siteId = newSite.id;
        }

        // 2. Find or create service_front
        let frontId: string;
        const { data: existingFront } = await supabase
          .from("service_fronts")
          .select("id")
          .eq("project_id", projectId)
          .ilike("name", rdo.front)
          .limit(1)
          .single();

        if (existingFront) {
          frontId = existingFront.id;
        } else {
          const { data: newFront, error: frontErr } = await supabase
            .from("service_fronts")
            .insert({ name: rdo.front || "Importado", project_id: projectId, created_by_user_id: user.id })
            .select("id")
            .single();
          if (frontErr) throw frontErr;
          frontId = newFront.id;
        }

        // 3. Create daily_report
        const { data: report, error: reportErr } = await supabase
          .from("daily_reports")
          .insert({
            report_date: rdo.date,
            project_id: projectId,
            construction_site_id: siteId,
            service_front_id: frontId,
            executed_by_user_id: user.id,
            general_observations: rdo.observations || null
          })
          .select("id")
          .single();
        if (reportErr) throw reportErr;

        // 4. Create executed_services
        if (rdo.services.length > 0) {
          for (const svc of rdo.services) {
            // Find or create service in catalog
            let serviceId: string;
            const { data: existingSvc } = await supabase
              .from("services_catalog")
              .select("id")
              .ilike("name", svc.name)
              .limit(1)
              .single();

            if (existingSvc) {
              serviceId = existingSvc.id;
            } else {
              const { data: newSvc, error: svcErr } = await supabase
                .from("services_catalog")
                .insert({ name: svc.name, unit: svc.unit, created_by_user_id: user.id })
                .select("id")
                .single();
              if (svcErr) throw svcErr;
              serviceId = newSvc.id;
            }

            await supabase
              .from("executed_services")
              .insert({
                daily_report_id: report.id,
                service_id: serviceId,
                quantity: svc.quantity,
                unit: svc.unit,
                created_by_user_id: user.id
              });
          }
        }

        success++;
      } catch (err: any) {
        console.error(`Erro ao importar RDO ${i + 1}:`, err);
        errors++;
      }

      setProgress(Math.round(((i + 1) / parsedRDOs.length) * 100));
    }

    setImportResults({ success, errors });
    setStep("done");

    if (success > 0) {
      toast.success(`${success} RDO(s) importado(s) com sucesso!`);
      onSuccess();
    }
    if (errors > 0) {
      toast.error(`${errors} RDO(s) com erro na importação`);
    }
  };

  const renderUpload = () => (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium mb-2">Arraste ou clique para selecionar</p>
        <p className="text-sm text-muted-foreground">
          Formatos aceitos: JSON, GeoJSON, CSV, PDF
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.geojson,.csv,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 flex items-center gap-2 text-sm">
          <FileJson className="w-5 h-5 text-blue-500" />
          <div>
            <div className="font-medium">JSON / GeoJSON</div>
            <div className="text-xs text-muted-foreground">Array de objetos com dados do RDO</div>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-2 text-sm">
          <FileSpreadsheet className="w-5 h-5 text-green-500" />
          <div>
            <div className="font-medium">CSV</div>
            <div className="text-xs text-muted-foreground">Planilha com colunas mapeáveis</div>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-2 text-sm col-span-2">
          <FileText className="w-5 h-5 text-red-500" />
          <div>
            <div className="font-medium">PDF</div>
            <div className="text-xs text-muted-foreground">Extração automática de datas, serviços e quantidades</div>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderMapping = () => (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-2">
        <strong>{fileName}</strong> — {rawData.length} registros encontrados ({fileFormat})
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { key: "date", label: "Data *", required: true },
          { key: "location", label: "Local / Obra" },
          { key: "front", label: "Frente de Serviço" },
          { key: "observations", label: "Observações" },
          { key: "serviceName", label: "Nome do Serviço" },
          { key: "quantity", label: "Quantidade" },
          { key: "unit", label: "Unidade" },
        ].map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Select
              value={columnMapping[key] || "__none__"}
              onValueChange={v => setColumnMapping(prev => ({ ...prev, [key]: v === "__none__" ? "" : v }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Ignorar —</SelectItem>
                {detectedColumns.map(col => (
                  <SelectItem key={col} value={col}>{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {detectedColumns.length > 0 && (
        <div className="text-xs text-muted-foreground bg-muted rounded p-2">
          <strong>Colunas detectadas:</strong> {detectedColumns.join(", ")}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => setStep("upload")}>Voltar</Button>
        <Button onClick={handleApplyMapping}>Continuar</Button>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="space-y-4">
      <div className="text-sm font-medium">
        {parsedRDOs.length} RDO(s) prontos para importação
      </div>

      <div className="max-h-60 overflow-y-auto space-y-2">
        {parsedRDOs.map((rdo, i) => (
          <Card key={i} className="p-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-sm">{rdo.date}</div>
                <div className="text-xs text-muted-foreground">{rdo.location} — {rdo.front}</div>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                {rdo.services.length} serviço(s)
              </span>
            </div>
            {rdo.services.length > 0 && (
              <div className="mt-2 space-y-1">
                {rdo.services.slice(0, 3).map((s, j) => (
                  <div key={j} className="text-xs text-muted-foreground pl-2 border-l-2 border-primary/30">
                    {s.name}: {s.quantity} {s.unit}
                  </div>
                ))}
                {rdo.services.length > 3 && (
                  <div className="text-xs text-muted-foreground pl-2">
                    +{rdo.services.length - 3} mais...
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => setStep(rawData.length > 0 ? "mapping" : "upload")}>
          Voltar
        </Button>
        <Button onClick={handleImport}>
          <Upload className="w-4 h-4 mr-2" />
          Importar {parsedRDOs.length} RDO(s)
        </Button>
      </div>
    </div>
  );

  const renderImporting = () => (
    <div className="space-y-4 py-4 text-center">
      <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
      <p className="font-medium">Importando RDOs...</p>
      <Progress value={progress} className="w-full" />
      <p className="text-sm text-muted-foreground">{progress}% concluído</p>
    </div>
  );

  const renderDone = () => (
    <div className="space-y-4 py-4 text-center">
      {importResults.errors === 0 ? (
        <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
      ) : (
        <AlertCircle className="w-12 h-12 mx-auto text-yellow-500" />
      )}
      <p className="font-medium text-lg">Importação Concluída</p>
      <div className="text-sm space-y-1">
        <p className="text-green-600">{importResults.success} RDO(s) importado(s) com sucesso</p>
        {importResults.errors > 0 && (
          <p className="text-red-500">{importResults.errors} RDO(s) com erro</p>
        )}
      </div>
      <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar RDOs</DialogTitle>
          <DialogDescription>
            Importe RDOs de outras plataformas em diversos formatos
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && renderUpload()}
        {step === "mapping" && renderMapping()}
        {step === "preview" && renderPreview()}
        {step === "importing" && renderImporting()}
        {step === "done" && renderDone()}
      </DialogContent>
    </Dialog>
  );
};
