import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, FileJson, FileSpreadsheet, FileText, Loader2, CheckCircle2, AlertCircle, Archive } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Progress } from "@/components/ui/progress";
import JSZip from "jszip";

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
  sourceFile?: string;
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
  const [fileInputKey, setFileInputKey] = useState(0);

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
    setFileInputKey(k => k + 1);
  };

  // ─── Improved PDF text → RDOs parser ───
  const extractRDOsFromPdfText = (text: string, sourceFile?: string): ParsedRDO[] => {
    const lines = text.split("\n").filter(l => l.trim());
    const rdos: ParsedRDO[] = [];

    // Broader date regex: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd
    const dateRegex = /(\d{2}[\/\.\-]\d{2}[\/\.\-]\d{2,4}|\d{4}[\/\.\-]\d{2}[\/\.\-]\d{2})/;
    // Service line: has a number + unit pattern
    const serviceRegex = /(\d+[\.,]?\d*)\s*(m[²³23]?|un|vb|kg|h|l|t|pç|cx|gl|km|cm|mm|ml|ton)/i;
    // RDO header keywords
    const rdoHeaderKeywords = ["rdo", "relatório", "relatorio", "diário", "diario", "daily", "report"];

    let currentRDO: Partial<ParsedRDO> | null = null;

    const flushRDO = () => {
      if (currentRDO?.date) {
        rdos.push({
          date: currentRDO.date,
          location: currentRDO.location || "Importado do PDF",
          front: currentRDO.front || "Frente Importada",
          observations: currentRDO.observations,
          services: currentRDO.services || [],
          sourceFile,
        });
      }
    };

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      const dateMatch = line.match(dateRegex);

      // Detect RDO boundary: line with date + header keyword, OR page separator
      const isHeader = dateMatch && rdoHeaderKeywords.some(k => lowerLine.includes(k));
      const isPageBreak = lowerLine.includes("página") || lowerLine.includes("page ") || /^-{5,}$/.test(line.trim());
      const isNewDateLine = dateMatch && !currentRDO;

      if (isHeader || (dateMatch && isPageBreak)) {
        flushRDO();
        currentRDO = {
          date: normalizeDate(dateMatch![1]),
          services: [],
          location: "",
          front: "",
        };
        continue;
      }

      if (currentRDO) {
        // Extract location
        if (!currentRDO.location && (lowerLine.includes("local") || lowerLine.includes("obra") || lowerLine.includes("endereço") || lowerLine.includes("endereco"))) {
          const parts = line.split(/[:\t]/).map(p => p.trim());
          if (parts.length > 1) currentRDO.location = parts.slice(1).join(" ").substring(0, 200);
        }
        // Extract front
        if (!currentRDO.front && (lowerLine.includes("frente") || lowerLine.includes("front"))) {
          const parts = line.split(/[:\t]/).map(p => p.trim());
          if (parts.length > 1) currentRDO.front = parts.slice(1).join(" ").substring(0, 200);
        }
        // Extract observations
        if (lowerLine.includes("observa") || lowerLine.includes("obs:") || lowerLine.includes("notas")) {
          const parts = line.split(/[:\t]/).map(p => p.trim());
          if (parts.length > 1) {
            currentRDO.observations = (currentRDO.observations || "") + parts.slice(1).join(" ") + " ";
          }
        }
        // Extract services
        const svcMatch = line.match(serviceRegex);
        if (svcMatch) {
          const serviceName = line.replace(svcMatch[0], "").replace(/[:\-\t,;]+$/, "").trim();
          if (serviceName && serviceName.length > 2) {
            currentRDO.services?.push({
              name: serviceName.substring(0, 150),
              quantity: parseFloat(svcMatch[1].replace(",", ".")),
              unit: svcMatch[2].replace("²", "2").replace("³", "3"),
            });
          }
        }
      } else if (isNewDateLine) {
        // Start a new RDO from any line with a date when we have no current
        currentRDO = {
          date: normalizeDate(dateMatch![1]),
          services: [],
          location: "",
          front: "",
        };
      }
    }

    flushRDO();

    // Fallback: if no RDOs found, try collecting all unique dates
    if (rdos.length === 0) {
      const allDates = new Set<string>();
      for (const line of lines) {
        const m = line.match(dateRegex);
        if (m) allDates.add(normalizeDate(m[1]));
      }
      if (allDates.size > 0) {
        allDates.forEach(d => {
          rdos.push({ date: d, location: "Importado do PDF", front: "Frente Importada", services: [], sourceFile });
        });
      } else {
        // Absolute fallback: single RDO with the full text as observations
        rdos.push({
          date: new Date().toISOString().split("T")[0],
          location: "Importado do PDF",
          front: "Frente Importada",
          observations: text.substring(0, 1000),
          services: [],
          sourceFile,
        });
      }
    }

    return rdos;
  };

  // ─── Handle single PDF file ───
  const processSinglePdf = async (file: File): Promise<ParsedRDO[]> => {
    const { extractPdfText } = await import("@/lib/pdfTextExtractor");
    const text = await extractPdfText(file);
    return extractRDOsFromPdfText(text, file.name);
  };

  // ─── Handle ZIP ───
  const processZipFile = async (file: File): Promise<ParsedRDO[]> => {
    const zip = await JSZip.loadAsync(file);
    const allRDOs: ParsedRDO[] = [];
    const pdfFiles = Object.entries(zip.files).filter(
      ([name, entry]) => !entry.dir && name.toLowerCase().endsWith(".pdf")
    );
    const jsonFiles = Object.entries(zip.files).filter(
      ([name, entry]) => !entry.dir && (name.toLowerCase().endsWith(".json") || name.toLowerCase().endsWith(".geojson"))
    );
    const csvFiles = Object.entries(zip.files).filter(
      ([name, entry]) => !entry.dir && name.toLowerCase().endsWith(".csv")
    );

    // Process PDFs
    for (const [name, entry] of pdfFiles) {
      try {
        const blob = await entry.async("blob");
        const pdfFile = new File([blob], name, { type: "application/pdf" });
        const rdos = await processSinglePdf(pdfFile);
        allRDOs.push(...rdos);
      } catch (err) {
        console.error(`Erro ao processar PDF ${name} do ZIP:`, err);
      }
    }

    // Process JSON/GeoJSON
    for (const [name, entry] of jsonFiles) {
      try {
        const text = await entry.async("string");
        const json = JSON.parse(text);
        const items = extractJsonItems(json);
        if (items.length > 0) {
          const rdos = quickParseItems(items, name);
          allRDOs.push(...rdos);
        }
      } catch (err) {
        console.error(`Erro ao processar JSON ${name} do ZIP:`, err);
      }
    }

    // Process CSVs
    for (const [name, entry] of csvFiles) {
      try {
        const text = await entry.async("string");
        const items = parseCsvText(text);
        if (items.length > 0) {
          const rdos = quickParseItems(items, name);
          allRDOs.push(...rdos);
        }
      } catch (err) {
        console.error(`Erro ao processar CSV ${name} do ZIP:`, err);
      }
    }

    return allRDOs;
  };

  const extractJsonItems = (json: any): any[] => {
    if (json.type === "FeatureCollection" && Array.isArray(json.features)) {
      return json.features.map((f: any) => ({ ...f.properties, _geometry: f.geometry }));
    } else if (Array.isArray(json)) return json;
    else if (json.rdos && Array.isArray(json.rdos)) return json.rdos;
    else if (json.data && Array.isArray(json.data)) return json.data;
    return [json];
  };

  const parseCsvText = (text: string): any[] => {
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) return [];
    let delimiter = ",";
    if (lines[0].includes("\t")) delimiter = "\t";
    else if (lines[0].includes(";")) delimiter = ";";
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ""));
    return lines.slice(1).map(line => {
      const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ""; });
      return obj;
    });
  };

  // Quick parse items from JSON/CSV inside ZIP – auto-map and parse
  const quickParseItems = (items: any[], sourceFile: string): ParsedRDO[] => {
    const cols = Object.keys(items[0] || {}).filter(k => !k.startsWith("_"));
    const dateAliases = ["date", "data", "report_date", "dt", "dia"];
    const locationAliases = ["location", "local", "localizacao", "obra", "construction_site", "endereco"];
    const frontAliases = ["front", "frente", "service_front", "frente_servico"];
    const serviceAliases = ["service", "servico", "service_name", "nome_servico", "descricao"];
    const qtyAliases = ["quantity", "quantidade", "qtd", "qty"];
    const unitAliases = ["unit", "unidade", "un", "und"];

    const find = (aliases: string[]) => cols.find(c => aliases.includes(c.toLowerCase())) || "";
    const mapping = {
      date: find(dateAliases),
      location: find(locationAliases),
      front: find(frontAliases),
      serviceName: find(serviceAliases),
      quantity: find(qtyAliases),
      unit: find(unitAliases),
    };

    const grouped = new Map<string, ParsedRDO>();
    for (const item of items) {
      const dateRaw = String(item[mapping.date] || "");
      const date = mapping.date ? normalizeDate(dateRaw) : new Date().toISOString().split("T")[0];
      const location = String(item[mapping.location] || "Importado");
      const front = String(item[mapping.front] || "Frente Importada");
      const key = `${date}|${location}|${front}`;
      if (!grouped.has(key)) {
        grouped.set(key, { date, location, front, services: [], sourceFile });
      }
      if (mapping.serviceName && item[mapping.serviceName]) {
        grouped.get(key)!.services.push({
          name: String(item[mapping.serviceName]),
          quantity: parseFloat(String(item[mapping.quantity] || "0").replace(",", ".")) || 0,
          unit: String(item[mapping.unit] || "un"),
        });
      }
      if (item.services && Array.isArray(item.services)) {
        for (const svc of item.services) {
          grouped.get(key)!.services.push({
            name: String(svc.name || svc.serviceName || svc.servico || svc.descricao || "Serviço importado"),
            quantity: parseFloat(String(svc.quantity || svc.quantidade || "0").replace(",", ".")) || 0,
            unit: String(svc.unit || svc.unidade || "un"),
          });
        }
      }
    }
    return Array.from(grouped.values());
  };

  // ─── File handler (supports multiple files) ───
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allFiles = Array.from(files);
    const totalRDOs: ParsedRDO[] = [];
    const names: string[] = [];

    toast.info(`Processando ${allFiles.length} arquivo(s)...`);

    for (const file of allFiles) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      names.push(file.name);

      try {
        if (ext === "zip") {
          const rdos = await processZipFile(file);
          totalRDOs.push(...rdos);
        } else if (ext === "pdf") {
          const rdos = await processSinglePdf(file);
          totalRDOs.push(...rdos);
        } else if (ext === "json" || ext === "geojson") {
          const text = await file.text();
          const json = JSON.parse(text);
          const items = extractJsonItems(json);
          if (items.length > 0) {
            const cols = Object.keys(items[0]).filter(k => !k.startsWith("_"));
            setRawData(items);
            setDetectedColumns(cols);
            setFileFormat(ext === "geojson" ? "GeoJSON" : "JSON");

            // Auto-map
            const autoMap = autoMapColumns(cols);
            setColumnMapping(autoMap);

            if (autoMap.date) {
              const rdos = quickParseItems(items, file.name);
              totalRDOs.push(...rdos);
            } else {
              // Need manual mapping – stop here for this file
              setFileName(file.name);
              setStep("mapping");
              return;
            }
          }
        } else if (ext === "csv") {
          const text = await file.text();
          const items = parseCsvText(text);
          if (items.length > 0) {
            const cols = Object.keys(items[0]);
            setRawData(items);
            setDetectedColumns(cols);
            setFileFormat("CSV");

            const autoMap = autoMapColumns(cols);
            setColumnMapping(autoMap);

            if (autoMap.date) {
              const rdos = quickParseItems(items, file.name);
              totalRDOs.push(...rdos);
            } else {
              setFileName(file.name);
              setStep("mapping");
              return;
            }
          }
        } else {
          toast.warning(`Formato não suportado: ${file.name}`);
        }
      } catch (err: any) {
        console.error(`Erro ao processar ${file.name}:`, err);
        toast.error(`Erro em ${file.name}: ${err.message || "Formato inválido"}`);
      }
    }

    if (totalRDOs.length > 0) {
      setFileName(names.join(", "));
      setFileFormat(allFiles.length > 1 ? "Múltiplos" : names[0]?.split(".").pop()?.toUpperCase() || "");
      setParsedRDOs(totalRDOs);
      setStep("preview");
      toast.success(`${totalRDOs.length} RDO(s) identificado(s)`);
    } else if (step === "upload") {
      toast.error("Nenhum RDO identificado nos arquivos");
    }
  };

  const autoMapColumns = (cols: string[]): Record<string, string> => {
    const mapping: Record<string, string> = { date: "", location: "", front: "", observations: "", serviceName: "", quantity: "", unit: "" };
    const dateAliases = ["date", "data", "report_date", "dt", "dia"];
    const locationAliases = ["location", "local", "localizacao", "obra", "construction_site", "endereco", "local da obra"];
    const frontAliases = ["front", "frente", "service_front", "frente_servico", "frente de serviço"];
    const obsAliases = ["observations", "observacoes", "obs", "notas", "notes"];
    const serviceAliases = ["service", "servico", "service_name", "nome_servico", "serviço", "descrição", "descricao"];
    const qtyAliases = ["quantity", "quantidade", "qtd", "qty"];
    const unitAliases = ["unit", "unidade", "un", "und"];

    const tryMap = (aliases: string[], key: string) => {
      const found = cols.find(c => aliases.includes(c.toLowerCase()));
      if (found) mapping[key] = found;
    };
    tryMap(dateAliases, "date");
    tryMap(locationAliases, "location");
    tryMap(frontAliases, "front");
    tryMap(obsAliases, "observations");
    tryMap(serviceAliases, "serviceName");
    tryMap(qtyAliases, "quantity");
    tryMap(unitAliases, "unit");
    return mapping;
  };

  const normalizeDate = (dateStr: string): string => {
    const parts = dateStr.split(/[\/\.\-]/);
    if (parts.length === 3) {
      let [a, b, c] = parts;
      // yyyy-mm-dd
      if (a.length === 4) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
      // dd/mm/yyyy
      if (c.length === 2) c = "20" + c;
      if (parseInt(a) > 12) return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
      return `${c}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
    return dateStr;
  };

  const handleApplyMapping = () => {
    if (!columnMapping.date) {
      toast.error("O campo 'Data' é obrigatório para importação");
      return;
    }
    const rdos = quickParseItems(rawData, fileName);
    // Override with user mapping
    const grouped = new Map<string, ParsedRDO>();
    for (const item of rawData) {
      const date = normalizeDate(String(item[columnMapping.date] || ""));
      const location = columnMapping.location ? String(item[columnMapping.location] || "Importado") : "Importado";
      const front = columnMapping.front ? String(item[columnMapping.front] || "Frente Importada") : "Frente Importada";
      const obs = columnMapping.observations ? String(item[columnMapping.observations] || "") : "";
      const key = `${date}|${location}|${front}`;
      if (!grouped.has(key)) grouped.set(key, { date, location, front, observations: obs, services: [], sourceFile: fileName });
      if (columnMapping.serviceName && item[columnMapping.serviceName]) {
        grouped.get(key)!.services.push({
          name: String(item[columnMapping.serviceName]),
          quantity: parseFloat(String(item[columnMapping.quantity] || "0").replace(",", ".")) || 0,
          unit: String(item[columnMapping.unit] || "un"),
        });
      }
    }
    setParsedRDOs(Array.from(grouped.values()));
    setStep("preview");
  };

  // ─── Import to DB ───
  const handleImport = async () => {
    if (parsedRDOs.length === 0) { toast.error("Nenhum RDO para importar"); return; }
    setStep("importing");
    setProgress(0);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Usuário não autenticado"); return; }

    let success = 0, errors = 0;

    for (let i = 0; i < parsedRDOs.length; i++) {
      const rdo = parsedRDOs[i];
      try {
        // Find or create construction_site
        let siteId: string;
        const { data: existingSite } = await supabase.from("construction_sites").select("id").eq("project_id", projectId).ilike("name", rdo.location).limit(1).single();
        if (existingSite) { siteId = existingSite.id; }
        else {
          const { data: newSite, error } = await supabase.from("construction_sites").insert({ name: rdo.location || "Importado", project_id: projectId, created_by_user_id: user.id }).select("id").single();
          if (error) throw error;
          siteId = newSite.id;
        }

        // Find or create service_front
        let frontId: string;
        const { data: existingFront } = await supabase.from("service_fronts").select("id").eq("project_id", projectId).ilike("name", rdo.front).limit(1).single();
        if (existingFront) { frontId = existingFront.id; }
        else {
          const { data: newFront, error } = await supabase.from("service_fronts").insert({ name: rdo.front || "Importado", project_id: projectId, created_by_user_id: user.id }).select("id").single();
          if (error) throw error;
          frontId = newFront.id;
        }

        // Create daily_report
        const { data: report, error: reportErr } = await supabase.from("daily_reports").insert({
          report_date: rdo.date,
          project_id: projectId,
          construction_site_id: siteId,
          service_front_id: frontId,
          executed_by_user_id: user.id,
          general_observations: rdo.observations || null,
        }).select("id").single();
        if (reportErr) throw reportErr;

        // Create executed_services
        for (const svc of rdo.services) {
          let serviceId: string;
          const { data: existingSvc } = await supabase.from("services_catalog").select("id").ilike("name", svc.name).limit(1).single();
          if (existingSvc) { serviceId = existingSvc.id; }
          else {
            const { data: newSvc, error } = await supabase.from("services_catalog").insert({ name: svc.name, unit: svc.unit, created_by_user_id: user.id }).select("id").single();
            if (error) throw error;
            serviceId = newSvc.id;
          }
          await supabase.from("executed_services").insert({ daily_report_id: report.id, service_id: serviceId, quantity: svc.quantity, unit: svc.unit, created_by_user_id: user.id });
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
    if (success > 0) { toast.success(`${success} RDO(s) importado(s) com sucesso!`); onSuccess(); }
    if (errors > 0) { toast.error(`${errors} RDO(s) com erro na importação`); }
  };

  // ─── Render steps ───
  const renderUpload = () => (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium mb-2">Arraste ou clique para selecionar</p>
        <p className="text-sm text-muted-foreground">
          Formatos: JSON, GeoJSON, CSV, PDF, ZIP (com PDFs)
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Você pode selecionar múltiplos arquivos de uma vez
        </p>
        <input
          key={fileInputKey}
          ref={fileInputRef}
          type="file"
          accept=".json,.geojson,.csv,.pdf,.zip"
          multiple
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
        <Card className="p-3 flex items-center gap-2 text-sm">
          <FileText className="w-5 h-5 text-red-500" />
          <div>
            <div className="font-medium">PDF</div>
            <div className="text-xs text-muted-foreground">Um ou vários PDFs de RDO</div>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-2 text-sm">
          <Archive className="w-5 h-5 text-orange-500" />
          <div>
            <div className="font-medium">ZIP</div>
            <div className="text-xs text-muted-foreground">Arquivo compactado com PDFs, JSONs ou CSVs</div>
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
          { key: "date", label: "Data *" },
          { key: "location", label: "Local / Obra" },
          { key: "front", label: "Frente de Serviço" },
          { key: "observations", label: "Observações" },
          { key: "serviceName", label: "Nome do Serviço" },
          { key: "quantity", label: "Quantidade" },
          { key: "unit", label: "Unidade" },
        ].map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Select value={columnMapping[key] || "__none__"} onValueChange={v => setColumnMapping(prev => ({ ...prev, [key]: v === "__none__" ? "" : v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Ignorar —</SelectItem>
                {detectedColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}
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
      <div className="text-sm font-medium">{parsedRDOs.length} RDO(s) prontos para importação</div>
      <div className="max-h-60 overflow-y-auto space-y-2">
        {parsedRDOs.map((rdo, i) => (
          <Card key={i} className="p-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-sm">{rdo.date}</div>
                <div className="text-xs text-muted-foreground">{rdo.location} — {rdo.front}</div>
                {rdo.sourceFile && <div className="text-xs text-muted-foreground/60">📄 {rdo.sourceFile}</div>}
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
                {rdo.services.length > 3 && <div className="text-xs text-muted-foreground pl-2">+{rdo.services.length - 3} mais...</div>}
              </div>
            )}
          </Card>
        ))}
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => setStep(rawData.length > 0 ? "mapping" : "upload")}>Voltar</Button>
        <Button onClick={handleImport}>
          <Upload className="w-4 h-4 mr-2" />Importar {parsedRDOs.length} RDO(s)
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
      {importResults.errors === 0 ? <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" /> : <AlertCircle className="w-12 h-12 mx-auto text-yellow-500" />}
      <p className="font-medium text-lg">Importação Concluída</p>
      <div className="text-sm space-y-1">
        <p className="text-green-600">{importResults.success} RDO(s) importado(s) com sucesso</p>
        {importResults.errors > 0 && <p className="text-red-500">{importResults.errors} RDO(s) com erro</p>}
      </div>
      <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar RDOs</DialogTitle>
          <DialogDescription>Importe RDOs de outras plataformas — PDF, ZIP, JSON, CSV</DialogDescription>
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
