/**
 * Import Wizard — 5-step import wizard with mandatory preview
 * Step 1: File Type Detection + Import Mode + Numeric Format
 * Step 2: CRS Selection (mandatory, UTM zone, unit confirmation)
 * Step 3: Model Type + Entity Type Mapping (for geometric formats)
 * Step 4: Attribute Mapping (tabular) / Summary (geometric)
 * Step 5: Analysis & Confirmation — shows real parsed counts, warnings, confirmation
 */
import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  Upload, FileText, AlertTriangle, Check, ChevronRight, ChevronLeft,
  Globe, Layers, Settings2, Save, FolderOpen, Search, Eye
} from "lucide-react";
import {
  CRSDefinition, CRS_CATALOG,
  LayerDiscipline, SpatialNode, SpatialEdge, NodeType,
} from "@/engine/spatialCore";
import {
  NumericFormat, ImportMode, EntityTypeMapping, EntityImportRole,
  parseLocalizedNumber, validateUTMCoordinates, detectDxfEntityTypes,
  parseDXFToInternal, parseGeoJSONToInternal, parseINPToInternal,
  parseSWMMToInternal, parseTabularToInternal,
  InpParsed, FieldMapping,
} from "@/engine/importEngine";

// ════════════════════════════════════════
// TYPES
// ════════════════════════════════════════

export interface DetectedFileInfo {
  format: "DXF" | "DWG" | "SHP" | "GeoJSON" | "CSV" | "TXT" | "XLSX" | "IFC" | "GPKG" | "INP" | "SWMM" | "Unknown";
  hasGeometry: boolean;
  geometryTypes: string[];
  hasZ: boolean;
  detectedCRS: CRSDefinition | null;
  detectedUnit: "m" | "deg" | "unknown";
  fieldCount: number;
  recordCount: number;
  layers?: string[];
  fileContent?: string;
}

export type ModelType = "rede" | "topografia" | "bim" | "generico" | "desenho";

export type TargetField =
  | "id" | "x" | "y" | "z" | "cota_terreno" | "cota_fundo"
  | "no_inicio" | "no_fim" | "diametro" | "material" | "comprimento"
  | "tipo" | "nome" | "demanda" | "vazao" | "velocidade"
  | "rugosidade" | "declividade" | "profundidade"
  | "layer" | "observacao" | "status"
  | "ignore";

export interface AttributeMapping {
  sourceField: string;
  targetField: TargetField;
}

export interface MappingTemplate {
  name: string;
  format: string;
  modelType: ModelType;
  mappings: AttributeMapping[];
}

export interface ImportResult {
  nodes: Array<Omit<SpatialNode, "layerId">>;
  edges: Array<Omit<SpatialEdge, "layerId" | "properties"> & { properties?: Record<string, any> }>;
  crs: CRSDefinition;
  modelType: ModelType;
  discipline: LayerDiscipline;
  layerName: string;
  sourceFile: string;
  validationIssues: string[];
  numericFormat: NumericFormat;
  importMode: ImportMode;
  entityMappings?: EntityTypeMapping[];
}

export interface SourceField {
  name: string;
  sampleValues: string[];
  type: "number" | "text" | "unknown";
}

// ════════════════════════════════════════
// TARGET FIELDS
// ════════════════════════════════════════

const TARGET_FIELDS: { value: TargetField; label: string; group: string }[] = [
  { value: "id", label: "ID / Identificador", group: "Identificação" },
  { value: "nome", label: "Nome / Rótulo", group: "Identificação" },
  { value: "tipo", label: "Tipo de Elemento", group: "Identificação" },
  { value: "status", label: "Status", group: "Identificação" },
  { value: "x", label: "X / Este / Longitude", group: "Coordenadas" },
  { value: "y", label: "Y / Norte / Latitude", group: "Coordenadas" },
  { value: "z", label: "Z / Elevação", group: "Coordenadas" },
  { value: "cota_terreno", label: "Cota Terreno", group: "Coordenadas" },
  { value: "cota_fundo", label: "Cota Fundo (Tubo)", group: "Coordenadas" },
  { value: "profundidade", label: "Profundidade (m)", group: "Coordenadas" },
  { value: "no_inicio", label: "Nó Início (ID)", group: "Topologia" },
  { value: "no_fim", label: "Nó Fim (ID)", group: "Topologia" },
  { value: "comprimento", label: "Comprimento (m)", group: "Topologia" },
  { value: "declividade", label: "Declividade (%)", group: "Topologia" },
  { value: "diametro", label: "Diâmetro (mm)", group: "Hidráulica" },
  { value: "material", label: "Material", group: "Hidráulica" },
  { value: "rugosidade", label: "Rugosidade (Manning n)", group: "Hidráulica" },
  { value: "demanda", label: "Demanda (L/s)", group: "Hidráulica" },
  { value: "vazao", label: "Vazão (L/s)", group: "Hidráulica" },
  { value: "velocidade", label: "Velocidade (m/s)", group: "Hidráulica" },
  { value: "layer", label: "Camada / Layer", group: "Outros" },
  { value: "observacao", label: "Observação", group: "Outros" },
  { value: "ignore", label: "⊘ Ignorar", group: "Outros" },
];

// ════════════════════════════════════════
// AUTO-DETECT MAPPING
// ════════════════════════════════════════

function normalizeField(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s]+/g, " ").trim();
}

function autoDetectTarget(field: SourceField): TargetField {
  const n = normalizeField(field.name);
  if (n === "id" || n === "fid" || n === "ponto" || n === "point id") return "id";
  if (n === "x" || n === "este" || n === "easting" || n === "lon" || n === "longitude" || n === "e" || n === "_geom_x") return "x";
  if (n === "y" || n === "norte" || n === "northing" || n === "lat" || n === "latitude" || n === "n" || n === "_geom_y") return "y";
  if (n === "z" || n === "cota" || n === "elevation" || n === "elev" || n === "alt" || n === "altura" || n === "_geom_z" || n === "z cota") return "z";
  if (n === "cota terreno" || n === "ct") return "cota_terreno";
  if (n === "cota fundo" || n === "cf" || n === "cota tubo") return "cota_fundo";
  if (n === "profundidade" || n === "depth" || n === "prof") return "profundidade";
  if (n === "de" || n === "from" || n === "no inicio" || n === "from id" || n === "inicio" || n === "node1") return "no_inicio";
  if (n === "para" || n === "to" || n === "no fim" || n === "to id" || n === "fim" || n === "node2") return "no_fim";
  if (n === "dn" || n === "diametro" || n === "diameter" || n === "diam") return "diametro";
  if (n === "material" || n === "mat") return "material";
  if (n === "comprimento" || n === "length" || n === "comp" || n === "extensao" || n === "_line_length_approx") return "comprimento";
  if (n === "declividade" || n === "slope" || n === "decliv" || n === "i") return "declividade";
  if (n === "rugosidade" || n === "roughness" || n === "manning") return "rugosidade";
  if (n === "demanda" || n === "demand") return "demanda";
  if (n === "vazao" || n === "flow" || n === "q") return "vazao";
  if (n === "velocidade" || n === "velocity" || n === "v") return "velocidade";
  if (n === "tipo" || n === "type" || n === "class" || n === "categoria") return "tipo";
  if (n === "nome" || n === "name" || n === "desc" || n === "descricao" || n === "label") return "nome";
  if (n === "layer" || n === "camada") return "layer";
  if (n === "observacao" || n === "obs" || n === "notas") return "observacao";
  if (n === "status") return "status";
  if (n.includes("diametr")) return "diametro";
  if (n.includes("comprim") || n.includes("length")) return "comprimento";
  if (n.includes("decliv") || n.includes("slope")) return "declividade";
  if (n.includes("elev") || n.includes("cota") || n.includes("alt")) return "z";
  return "ignore";
}

// ════════════════════════════════════════
// TEMPLATE STORAGE
// ════════════════════════════════════════

const TEMPLATES_KEY = "import_mapping_templates";

function loadTemplates(): MappingTemplate[] {
  try {
    const data = localStorage.getItem(TEMPLATES_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function saveTemplate(template: MappingTemplate) {
  const templates = loadTemplates();
  const existing = templates.findIndex(t => t.name === template.name);
  if (existing >= 0) templates[existing] = template;
  else templates.push(template);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

// ════════════════════════════════════════
// GEOMETRIC FORMAT DETECTION
// ════════════════════════════════════════

const GEOMETRIC_FORMATS = new Set(["DXF", "DWG", "SHP", "GeoJSON", "IFC"]);

function isGeometricFormat(format: string): boolean {
  return GEOMETRIC_FORMATS.has(format);
}

const TOTAL_STEPS = 5;

// ════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceFields: SourceField[];
  fileInfo: DetectedFileInfo;
  fileName: string;
  rows: Record<string, any>[];
  onImport: (result: ImportResult) => void;
}

export const ImportWizard = ({
  open, onOpenChange, sourceFields, fileInfo, fileName, rows, onImport
}: ImportWizardProps) => {
  const [step, setStep] = useState(1);
  const [selectedCRS, setSelectedCRS] = useState<string>(fileInfo.detectedCRS?.code || "EPSG:31983");
  const [modelType, setModelType] = useState<ModelType>(
    fileInfo.geometryTypes.some(g => g.includes("Line")) ? "rede" : "topografia"
  );
  const [mappings, setMappings] = useState<Record<string, TargetField>>(() => {
    const initial: Record<string, TargetField> = {};
    sourceFields.forEach(f => { initial[f.name] = autoDetectTarget(f); });
    return initial;
  });
  const [templateName, setTemplateName] = useState("");
  const [numericFormat, setNumericFormat] = useState<NumericFormat>("auto");
  const [importMode, setImportMode] = useState<ImportMode>(
    isGeometricFormat(fileInfo.format) ? "geometric" : "tabular"
  );

  // Entity type mappings for DXF/geometric files
  const [entityMappings, setEntityMappings] = useState<EntityTypeMapping[]>(() => {
    if (fileInfo.format === "DXF" && fileInfo.fileContent) {
      try { return detectDxfEntityTypes(fileInfo.fileContent); } catch { return []; }
    }
    // For IFC files, detect entity types from content
    if (fileInfo.format === "IFC" && fileInfo.fileContent) {
      return detectIFCEntityTypes(fileInfo.fileContent);
    }
    return [];
  });

  // Step 5: pre-parsed analysis results
  const [analysisResult, setAnalysisResult] = useState<InpParsed | null>(null);
  const [analysisRan, setAnalysisRan] = useState(false);
  const [analysisIssues, setAnalysisIssues] = useState<string[]>([]);

  const isGeometric = isGeometricFormat(fileInfo.format);
  const crs = CRS_CATALOG.find(c => c.code === selectedCRS) || CRS_CATALOG[5];

  const hasX = useMemo(() => Object.values(mappings).includes("x"), [mappings]);
  const hasY = useMemo(() => Object.values(mappings).includes("y"), [mappings]);
  const hasNodeStart = useMemo(() => Object.values(mappings).includes("no_inicio"), [mappings]);
  const hasNodeEnd = useMemo(() => Object.values(mappings).includes("no_fim"), [mappings]);
  const mappedCount = Object.values(mappings).filter(v => v !== "ignore").length;

  const step4Valid = importMode === "geometric" ? true : (hasX && hasY);

  const canProceed = useMemo(() => {
    if (step === 1) return true;
    if (step === 2) return !!selectedCRS;
    if (step === 3) return !!modelType;
    if (step === 4) return step4Valid;
    if (step === 5) return analysisRan; // must have run analysis
    return false;
  }, [step, selectedCRS, modelType, step4Valid, analysisRan]);

  // ── Run analysis when entering step 5 ──
  const runAnalysis = useCallback(() => {
    const issues: string[] = [];
    let parsed: InpParsed = { nodes: [], edges: [] };

    try {
      if (importMode === "geometric") {
        // Parse based on format
        if (fileInfo.format === "DXF" && fileInfo.fileContent) {
          parsed = parseDXFToInternal(fileInfo.fileContent, entityMappings, numericFormat);
        } else if (fileInfo.format === "GeoJSON" && fileInfo.fileContent) {
          parsed = parseGeoJSONToInternal(fileInfo.fileContent, numericFormat);
        } else if (fileInfo.format === "INP" && fileInfo.fileContent) {
          parsed = parseINPToInternal(fileInfo.fileContent);
        } else if (fileInfo.format === "SWMM" && fileInfo.fileContent) {
          parsed = parseSWMMToInternal(fileInfo.fileContent);
        } else if (fileInfo.format === "IFC" && fileInfo.fileContent) {
          // IFC geometric parsing - extract lines as edges, points as nodes
          parsed = parseIFCGeometric(fileInfo.fileContent, entityMappings);
        }
      } else {
        // Tabular mode
        const getField = (target: TargetField) => {
          const entry = Object.entries(mappings).find(([_, t]) => t === target);
          return entry?.[0];
        };
        const fieldMapping: FieldMapping = {
          id: getField("id"),
          x: getField("x"),
          y: getField("y"),
          z: getField("z") || getField("cota_terreno"),
          cotaFundo: getField("cota_fundo"),
          profundidade: getField("profundidade"),
          noInicio: getField("no_inicio"),
          noFim: getField("no_fim"),
          diametro: getField("diametro"),
          material: getField("material"),
          comprimento: getField("comprimento"),
          declividade: getField("declividade"),
          rugosidade: getField("rugosidade"),
          demanda: getField("demanda"),
          tipo: getField("tipo"),
          nome: getField("nome"),
          layer: getField("layer"),
        };
        parsed = parseTabularToInternal(rows, fieldMapping, numericFormat);
      }

      // UTM validation on first few nodes
      if (crs.unit === "m" && crs.utmZone && parsed.nodes.length > 0) {
        const sample = parsed.nodes.slice(0, 5);
        for (const n of sample) {
          const check = validateUTMCoordinates(n.x, n.y);
          if (!check.valid && check.warning) {
            issues.push(check.warning);
            break; // one warning is enough
          }
        }
      }

      // Check for zero results
      if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
        issues.push("Nenhuma geometria convertível detectada no arquivo.");
      }
    } catch (err: any) {
      issues.push(`Erro ao analisar: ${err.message || String(err)}`);
    }

    setAnalysisResult(parsed);
    setAnalysisIssues(issues);
    setAnalysisRan(true);
  }, [importMode, fileInfo, entityMappings, numericFormat, mappings, rows, crs]);

  const handleStepChange = useCallback((newStep: number) => {
    if (newStep === 5 && !analysisRan) {
      runAnalysis();
    }
    setStep(newStep);
  }, [analysisRan, runAnalysis]);

  const handleApplyTemplate = useCallback((template: MappingTemplate) => {
    const newMappings: Record<string, TargetField> = {};
    sourceFields.forEach(f => { newMappings[f.name] = "ignore"; });
    template.mappings.forEach(m => {
      if (newMappings.hasOwnProperty(m.sourceField)) {
        newMappings[m.sourceField] = m.targetField;
      }
    });
    setMappings(newMappings);
    toast.success(`Template "${template.name}" aplicado`);
  }, [sourceFields]);

  const handleSaveTemplate = useCallback(() => {
    if (!templateName.trim()) { toast.error("Dê um nome ao template"); return; }
    const template: MappingTemplate = {
      name: templateName.trim(),
      format: fileInfo.format,
      modelType,
      mappings: Object.entries(mappings)
        .filter(([_, t]) => t !== "ignore")
        .map(([s, t]) => ({ sourceField: s, targetField: t })),
    };
    saveTemplate(template);
    toast.success(`Template "${templateName}" salvo`);
    setTemplateName("");
  }, [templateName, mappings, fileInfo.format, modelType]);

  const handleEntityRoleChange = useCallback((entityType: string, role: EntityImportRole) => {
    setEntityMappings(prev => prev.map(m =>
      m.entityType === entityType ? { ...m, role } : m
    ));
    // Reset analysis when entity roles change
    setAnalysisRan(false);
    setAnalysisResult(null);
  }, []);

  // ── Final import (only from step 5, with pre-parsed data) ──
  const handleConfirmImport = useCallback(() => {
    if (!analysisResult) {
      toast.error("Execute a análise primeiro");
      return;
    }

    const discipline: LayerDiscipline = modelType === "topografia" ? "topografia"
      : modelType === "bim" ? "bim"
      : modelType === "generico" ? "generico"
      : modelType === "desenho" ? "desenho"
      : "esgoto";

    const result: ImportResult = {
      nodes: analysisResult.nodes.map(n => ({
        id: n.id, x: n.x, y: n.y, z: n.z,
        tipo: n.tipo,
        demanda: n.demanda,
        label: n.properties?.label,
        cotaFundo: n.properties?.cotaFundo,
        profundidade: n.properties?.profundidade,
        properties: n.properties || {},
      })),
      edges: analysisResult.edges.map(e => ({
        id: e.id,
        startNodeId: e.startNodeId,
        endNodeId: e.endNodeId,
        dn: e.dn,
        comprimento: 0,
        declividade: 0,
        material: e.material,
        tipoRede: e.tipoRede,
        roughness: e.roughness,
        vertices: e.vertices,
        properties: e.properties || {},
      })),
      crs,
      modelType,
      discipline,
      layerName: fileName.replace(/\.[^.]+$/, ""),
      sourceFile: fileName,
      validationIssues: analysisIssues,
      numericFormat,
      importMode,
      entityMappings: entityMappings.length > 0 ? entityMappings : undefined,
    };

    onImport(result);
    onOpenChange(false);
    toast.success(`Importação concluída: ${analysisResult.nodes.length} nós, ${analysisResult.edges.length} trechos`);
  }, [analysisResult, crs, modelType, fileName, onImport, onOpenChange, numericFormat, importMode, entityMappings, analysisIssues]);

  const templates = useMemo(() => loadTemplates(), []);

  // ── RENDER STEPS ──

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <InfoCard label="Formato" value={fileInfo.format} icon="📄" />
        <InfoCard label="Registros" value={String(fileInfo.recordCount)} icon="📊" />
        <InfoCard label="Campos" value={String(fileInfo.fieldCount)} icon="🏷️" />
        <InfoCard label="Geometria" value={fileInfo.geometryTypes.join(", ") || "Nenhuma"} icon="📐" />
        <InfoCard label="Tem Z" value={fileInfo.hasZ ? "Sim ✓" : "Não"} icon="📏" />
        <InfoCard label="CRS Detectado" value={fileInfo.detectedCRS?.name || "Não detectado"} icon="🌐" />
      </div>

      {fileInfo.layers && fileInfo.layers.length > 0 && (
        <div>
          <Label className="text-xs font-medium mb-1 block">Camadas Detectadas ({fileInfo.layers.length})</Label>
          <div className="flex flex-wrap gap-1">
            {fileInfo.layers.map(l => <Badge key={l} variant="outline" className="text-xs">{l}</Badge>)}
          </div>
        </div>
      )}

      {/* Import Mode */}
      {isGeometric && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <Label className="font-medium mb-2 block">Modo de Importação</Label>
            <RadioGroup value={importMode} onValueChange={v => { setImportMode(v as ImportMode); setAnalysisRan(false); }} className="space-y-2">
              <div className="flex items-start gap-2">
                <RadioGroupItem value="geometric" id="mode-geo" className="mt-0.5" />
                <div>
                  <Label htmlFor="mode-geo" className="font-medium text-sm cursor-pointer">📐 Geométrico (CAD/GIS)</Label>
                  <p className="text-xs text-muted-foreground">Linhas → Trechos, Pontos → Nós. Conectividade por coordenada. <strong>Sem necessidade de Nó Início/Fim.</strong></p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="tabular" id="mode-tab" className="mt-0.5" />
                <div>
                  <Label htmlFor="mode-tab" className="font-medium text-sm cursor-pointer">📋 Tabular</Label>
                  <p className="text-xs text-muted-foreground">Usa campos Nó Início / Nó Fim. Para dados estruturados em tabela.</p>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Numeric Format */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <Label className="font-medium mb-2 block">Formato Numérico</Label>
          <RadioGroup value={numericFormat} onValueChange={v => { setNumericFormat(v as NumericFormat); setAnalysisRan(false); }} className="space-y-1">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="auto" id="nf-auto" />
              <Label htmlFor="nf-auto" className="text-sm cursor-pointer">🔍 Detectar automaticamente</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="br" id="nf-br" />
              <Label htmlFor="nf-br" className="text-sm cursor-pointer">🇧🇷 Brasileiro (1.234.567,89)</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="us" id="nf-us" />
              <Label htmlFor="nf-us" className="text-sm cursor-pointer">🇺🇸 Americano (1,234,567.89)</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="font-medium">Sistema de Referência (CRS) *</Label>
          <p className="text-xs text-muted-foreground mb-2">Obrigatório. Nada entra sem CRS definido.</p>
          <Select value={selectedCRS} onValueChange={v => { setSelectedCRS(v); setAnalysisRan(false); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CRS_CATALOG.map(c => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Unidade</Label>
            <Badge variant="outline" className="ml-2">{crs.unit === "m" ? "Metros" : "Graus"}</Badge>
          </div>
          {crs.utmZone && (
            <div>
              <Label className="text-xs">Fuso UTM</Label>
              <Badge variant="outline" className="ml-2">Zona {crs.utmZone}{crs.hemisphere}</Badge>
            </div>
          )}
          {fileInfo.detectedCRS && fileInfo.detectedCRS.code !== selectedCRS && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2">
              <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                CRS detectado ({fileInfo.detectedCRS.name}) difere do selecionado. A transformação será aplicada automaticamente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div>
        <Label className="font-medium">O que este arquivo representa?</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          {([
            { value: "rede" as ModelType, label: "🔗 Rede (Água/Esgoto/Drenagem/Recalque)", desc: "Dados com topologia: nós e trechos conectados" },
            { value: "topografia" as ModelType, label: "📍 Topografia", desc: "Pontos topográficos com coordenadas e cota" },
            { value: "bim" as ModelType, label: "🏗️ BIM (IFC)", desc: "Modelo BIM com elementos construtivos" },
            { value: "generico" as ModelType, label: "🗺️ Genérico GIS", desc: "Dados geoespaciais genéricos" },
            { value: "desenho" as ModelType, label: "✏️ Desenho (Apenas Visual)", desc: "Camada de desenho que NÃO entra na simulação (EPANET/SWMM)" },
          ]).map(opt => (
            <Card
              key={opt.value}
              className={`cursor-pointer transition-all ${modelType === opt.value ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"}`}
              onClick={() => { setModelType(opt.value); setAnalysisRan(false); }}
            >
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${modelType === opt.value ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                    {modelType === opt.value && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Entity type mapping for geometric formats */}
      {importMode === "geometric" && entityMappings.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <Label className="font-medium mb-2 block">Mapeamento de Entidades</Label>
            <p className="text-xs text-muted-foreground mb-3">Defina como cada tipo de entidade deve ser importado.</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entidade</TableHead>
                  <TableHead className="text-center">Quantidade</TableHead>
                  <TableHead>Importar como</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entityMappings.map(m => (
                  <TableRow key={m.entityType}>
                    <TableCell className="font-mono text-sm font-medium">{m.entityType}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{m.count}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={m.role}
                        onValueChange={v => handleEntityRoleChange(m.entityType, v as EntityImportRole)}
                      >
                        <SelectTrigger className="h-8 text-xs w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="edge">📏 Trecho (Edge)</SelectItem>
                          <SelectItem value="node">📍 Nó (Node)</SelectItem>
                          <SelectItem value="ignore">⊘ Ignorar</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderStep4 = () => {
    // In geometric mode, show simplified info
    if (importMode === "geometric") {
      const edgeTypes = entityMappings.filter(m => m.role === "edge");
      const nodeTypes = entityMappings.filter(m => m.role === "node");
      return (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              📐 Modo Geométrico Ativo
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              A importação será feita diretamente a partir da geometria do arquivo.
              Nós serão criados automaticamente nos endpoints de cada linha/polilinha.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600">Trechos</Badge>
                <span className="text-xs">
                  {edgeTypes.length > 0
                    ? edgeTypes.map(e => `${e.entityType} (${e.count})`).join(", ")
                    : "Linhas e polilinhas detectadas automaticamente"
                  }
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-600">Nós</Badge>
                <span className="text-xs">
                  {nodeTypes.length > 0
                    ? nodeTypes.map(n => `${n.entityType} (${n.count})`).join(", ")
                    : "Criados automaticamente nos endpoints + entidades POINT/INSERT"
                  }
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Formato Numérico</Badge>
                <span className="text-xs">
                  {numericFormat === "auto" ? "Detecção automática" : numericFormat === "br" ? "Brasileiro (1.234,56)" : "Americano (1,234.56)"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">CRS</Badge>
                <span className="text-xs">{crs.name}</span>
              </div>
            </div>
          </div>

          {sourceFields.length > 0 && (
            <div>
              <Label className="text-xs font-medium mb-1 block">Mapeamento de Atributos Adicionais (opcional)</Label>
              <div className="max-h-[30vh] overflow-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campo</TableHead>
                      <TableHead>Amostras</TableHead>
                      <TableHead className="w-48">Mapear Para</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sourceFields.map(field => (
                      <TableRow key={field.name} className={mappings[field.name] === "ignore" ? "opacity-40" : ""}>
                        <TableCell className="font-mono text-xs">{field.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                          {field.sampleValues.slice(0, 3).join(", ")}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mappings[field.name] || "ignore"}
                            onValueChange={v => setMappings(prev => ({ ...prev, [field.name]: v as TargetField }))}
                          >
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {TARGET_FIELDS.map(pf => (
                                <SelectItem key={pf.value} value={pf.value}>{pf.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Tabular mode - full mapping
    const grouped = TARGET_FIELDS.reduce((acc, f) => {
      if (!acc[f.group]) acc[f.group] = [];
      acc[f.group].push(f);
      return acc;
    }, {} as Record<string, typeof TARGET_FIELDS>);

    return (
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          <Badge variant={hasX ? "default" : "destructive"} className={hasX ? "bg-green-600" : ""}>
            {hasX ? <Check className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
            X {hasX ? "✓" : "obrigatório"}
          </Badge>
          <Badge variant={hasY ? "default" : "destructive"} className={hasY ? "bg-green-600" : ""}>
            {hasY ? <Check className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
            Y {hasY ? "✓" : "obrigatório"}
          </Badge>
          {modelType === "rede" && (
            <>
              <Badge variant={hasNodeStart ? "default" : "outline"} className={hasNodeStart ? "bg-blue-600" : ""}>
                Nó Início {hasNodeStart ? "✓" : "(opcional)"}
              </Badge>
              <Badge variant={hasNodeEnd ? "default" : "outline"} className={hasNodeEnd ? "bg-blue-600" : ""}>
                Nó Fim {hasNodeEnd ? "✓" : "(opcional)"}
              </Badge>
            </>
          )}
          <Badge variant="outline">{mappedCount} campos mapeados</Badge>
          <Badge variant="outline">
            {numericFormat === "auto" ? "🔍 Auto" : numericFormat === "br" ? "🇧🇷 BR" : "🇺🇸 US"}
          </Badge>
        </div>

        {/* Template controls */}
        <div className="flex gap-2 items-center flex-wrap">
          {templates.length > 0 && (
            <Select onValueChange={v => {
              const t = templates.find(t => t.name === v);
              if (t) handleApplyTemplate(t);
            }}>
              <SelectTrigger className="h-8 w-48 text-xs">
                <FolderOpen className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Carregar template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.name} value={t.name}>{t.name} ({t.format})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-1 items-center">
            <Input
              className="h-8 w-40 text-xs"
              placeholder="Nome do template"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
            />
            <Button size="sm" variant="outline" className="h-8" onClick={handleSaveTemplate}>
              <Save className="h-3 w-3 mr-1" /> Salvar
            </Button>
          </div>
        </div>

        {/* Mapping table */}
        <div className="max-h-[40vh] overflow-auto border rounded">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo no Arquivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Amostras</TableHead>
                <TableHead className="w-56">Mapear Para</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sourceFields.map(field => (
                <TableRow key={field.name} className={mappings[field.name] === "ignore" ? "opacity-40" : ""}>
                  <TableCell className="font-mono text-xs font-medium">{field.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{field.type}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                    {field.sampleValues.slice(0, 3).join(", ")}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mappings[field.name] || "ignore"}
                      onValueChange={v => setMappings(prev => ({ ...prev, [field.name]: v as TargetField }))}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(grouped).map(([group, fields]) => (
                          <div key={group}>
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{group}</div>
                            {fields.map(pf => (
                              <SelectItem key={pf.value} value={pf.value}>{pf.label}</SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  // ── Step 5 computed values (must be at component top level) ──
  const analysisNodeCount = analysisResult?.nodes.length ?? 0;
  const analysisEdgeCount = analysisResult?.edges.length ?? 0;
  const analysisHasData = analysisNodeCount > 0 || analysisEdgeCount > 0;
  const analysisIsZero = analysisRan && !analysisHasData;

  const entityBreakdown = useMemo(() => {
    if (!analysisResult) return null;
    const nodeSources = new Map<string, number>();
    const edgeSources = new Map<string, number>();
    for (const n of analysisResult.nodes) {
      const src = n.properties?._source || n.properties?.entityType || "Desconhecido";
      nodeSources.set(src, (nodeSources.get(src) || 0) + 1);
    }
    for (const e of analysisResult.edges) {
      const src = e.properties?._source || e.properties?.entityType || "Desconhecido";
      edgeSources.set(src, (edgeSources.get(src) || 0) + 1);
    }
    return { nodeSources: Array.from(nodeSources.entries()), edgeSources: Array.from(edgeSources.entries()) };
  }, [analysisResult]);

  const analysisBbox = useMemo(() => {
    if (!analysisResult || analysisResult.nodes.length === 0) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of analysisResult.nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }, [analysisResult]);

  // ── Step 5: Analysis & Confirmation ──
  const renderStep5 = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base">Análise do Arquivo</h3>
          <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={runAnalysis}>
            <Search className="h-3 w-3 mr-1" /> Re-analisar
          </Button>
        </div>

        {/* File info recap */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{analysisNodeCount}</div>
                <div className="text-xs text-muted-foreground">Nós detectados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{analysisEdgeCount}</div>
                <div className="text-xs text-muted-foreground">Trechos detectados</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium">{crs.name}</div>
                <div className="text-xs text-muted-foreground">CRS</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium">
                  {numericFormat === "auto" ? "Auto" : numericFormat === "br" ? "Brasileiro" : "Americano"}
                </div>
                <div className="text-xs text-muted-foreground">Formato Numérico</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Zero result warning */}
        {analysisIsZero && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-400 dark:border-amber-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-semibold text-amber-800 dark:text-amber-300">⚠ Nenhuma geometria convertível detectada</h4>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  O arquivo foi lido mas nenhum nó ou trecho pôde ser gerado. Verifique:
                </p>
                <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
                  <li>O <strong>mapeamento de entidades</strong> (Step 3) — marque os tipos corretos como Trecho ou Nó</li>
                  <li>O <strong>formato numérico</strong> — coordenadas podem estar sendo interpretadas incorretamente</li>
                  <li>O <strong>CRS</strong> — se as coordenadas estão em sistema diferente do esperado</li>
                  <li>O <strong>modo de importação</strong> — tente alternar entre Geométrico e Tabular</li>
                </ul>
                <div className="flex gap-2 pt-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => { setStep(3); setAnalysisRan(false); }}>
                    Ajustar Entidades
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setStep(1); setAnalysisRan(false); }}>
                    Ajustar Formato/Modo
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setStep(2); setAnalysisRan(false); }}>
                    Ajustar CRS
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setModelType("desenho");
                    setAnalysisRan(false);
                    runAnalysis();
                  }}>
                    Forçar como Desenho
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* UTM / coordinate warnings */}
        {analysisIssues.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">⚠ Avisos:</p>
            <ul className="space-y-1">
              {analysisIssues.map((issue, i) => (
                <li key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Entity breakdown */}
        {analysisHasData && entityBreakdown && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <Label className="font-medium mb-2 block">Detalhamento por Origem</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entityBreakdown.nodeSources.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">📍 Nós</p>
                    {entityBreakdown.nodeSources.map(([src, count]) => (
                      <div key={src} className="flex items-center justify-between text-xs py-0.5">
                        <span className="font-mono">{src}</span>
                        <Badge variant="outline" className="text-xs">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                {entityBreakdown.edgeSources.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">📏 Trechos</p>
                    {entityBreakdown.edgeSources.map(([src, count]) => (
                      <div key={src} className="flex items-center justify-between text-xs py-0.5">
                        <span className="font-mono">{src}</span>
                        <Badge variant="outline" className="text-xs">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bounding box info */}
        {analysisBbox && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <Label className="font-medium mb-2 block">Bounding Box</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">X min:</span>{" "}
                  <span className="font-mono">{analysisBbox.minX.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">X max:</span>{" "}
                  <span className="font-mono">{analysisBbox.maxX.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Y min:</span>{" "}
                  <span className="font-mono">{analysisBbox.minY.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Y max:</span>{" "}
                  <span className="font-mono">{analysisBbox.maxY.toFixed(2)}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Extensão: {analysisBbox.width.toFixed(2)} × {analysisBbox.height.toFixed(2)} {crs.unit}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Configuration summary */}
        {analysisHasData && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <Label className="font-medium mb-2 block">Resumo da Configuração</Label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Arquivo:</span>
                  <span className="font-medium truncate">{fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Formato:</span>
                  <Badge variant="outline" className="text-xs">{fileInfo.format}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Modo:</span>
                  <Badge variant="outline" className="text-xs">{importMode === "geometric" ? "Geométrico" : "Tabular"}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Tipo:</span>
                  <Badge variant="outline" className="text-xs">
                    {modelType === "rede" ? "Rede" : modelType === "topografia" ? "Topografia" : modelType === "bim" ? "BIM" : modelType === "desenho" ? "Desenho" : "Genérico"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const stepTitles = [
    { num: 1, title: "Arquivo & Modo", icon: <FileText className="h-4 w-4" /> },
    { num: 2, title: "Sistema de Referência", icon: <Globe className="h-4 w-4" /> },
    { num: 3, title: "Tipo de Modelo", icon: <Layers className="h-4 w-4" /> },
    { num: 4, title: importMode === "geometric" ? "Resumo" : "Mapeamento", icon: <Settings2 className="h-4 w-4" /> },
    { num: 5, title: "Análise & Confirmação", icon: <Eye className="h-4 w-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importação — {fileName}
          </DialogTitle>
          <DialogDescription>
            Wizard de importação em {TOTAL_STEPS} etapas
            {importMode === "geometric" && <Badge variant="outline" className="ml-2">Modo Geométrico</Badge>}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          {stepTitles.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all
                  ${step === s.num ? "bg-primary text-primary-foreground" : step > s.num ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}
                onClick={() => { if (s.num < step) { setStep(s.num); } }}
              >
                {step > s.num ? <Check className="h-3 w-3" /> : s.icon}
                <span className="hidden sm:inline">{s.title}</span>
                <span className="sm:hidden">{s.num}</span>
              </div>
              {i < stepTitles.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-0.5" />}
            </div>
          ))}
        </div>

        <Progress value={(step / TOTAL_STEPS) * 100} className="h-1" />

        <div className="min-h-[200px]">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
          </div>
          {step < TOTAL_STEPS ? (
            <Button onClick={() => handleStepChange(step + 1)} disabled={!canProceed}>
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleConfirmImport}
              disabled={!analysisRan || (!analysisResult?.nodes.length && !analysisResult?.edges.length)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Check className="h-4 w-4 mr-1" /> Confirmar Importação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── IFC helpers (basic text-based detection) ──

function detectIFCEntityTypes(content: string): EntityTypeMapping[] {
  const counts = new Map<string, number>();
  const regex = /^#\d+=\s*(IFC\w+)\s*\(/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const type = match[1].toUpperCase();
    // Only count geometry-relevant types
    if (type.includes("PIPE") || type.includes("FLOW") || type.includes("DUCT") ||
        type.includes("WALL") || type.includes("SLAB") || type.includes("BEAM") ||
        type.includes("COLUMN") || type.includes("POINT") || type.includes("FITTING")) {
      counts.set(type, (counts.get(type) || 0) + 1);
    }
  }

  const lineTypes = new Set(["IFCPIPESEGMENT", "IFCDUCTSEGMENT", "IFCFLOWSEGMENT"]);
  const nodeTypes = new Set(["IFCFLOWTERMINAL", "IFCFLOWFITTING", "IFCPIPEFITTING"]);

  return Array.from(counts.entries()).map(([entityType, count]) => ({
    entityType,
    role: lineTypes.has(entityType) ? "edge" as EntityImportRole
      : nodeTypes.has(entityType) ? "node" as EntityImportRole
      : "ignore" as EntityImportRole,
    count,
  }));
}

function parseIFCGeometric(content: string, entityMappings?: EntityTypeMapping[]): InpParsed {
  // Basic IFC text parser for coordinate extraction
  // This is a simplified parser - full IFC would need a proper library
  const nodes: InpParsed["nodes"] = [];
  const edges: InpParsed["edges"] = [];

  const roleMap = new Map<string, EntityImportRole>();
  if (entityMappings) {
    entityMappings.forEach(m => roleMap.set(m.entityType.toUpperCase(), m.role));
  }

  // Extract IFCCARTESIANPOINT coordinates
  const pointMap = new Map<string, { x: number; y: number; z: number }>();
  const pointRegex = /#(\d+)=\s*IFCCARTESIANPOINT\s*\(\(([^)]+)\)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pointRegex.exec(content)) !== null) {
    const id = match[1];
    const coords = match[2].split(",").map(c => parseFloat(c.trim()));
    if (coords.length >= 2) {
      pointMap.set(`#${id}`, { x: coords[0], y: coords[1], z: coords[2] || 0 });
    }
  }

  // For each entity with a role, try to extract placement
  let nodeCounter = 0;
  let edgeCounter = 0;

  const entityRegex = /#(\d+)=\s*(IFC\w+)\s*\(([^;]*)\);/gi;
  while ((match = entityRegex.exec(content)) !== null) {
    const entityType = match[2].toUpperCase();
    const role = roleMap.get(entityType);
    if (!role || role === "ignore") continue;

    // Try to find associated placement point
    const body = match[3];
    const refMatches = body.match(/#\d+/g);
    let foundCoord: { x: number; y: number; z: number } | null = null;
    if (refMatches) {
      for (const ref of refMatches) {
        if (pointMap.has(ref)) {
          foundCoord = pointMap.get(ref)!;
          break;
        }
      }
    }

    if (role === "node" && foundCoord) {
      nodes.push({
        id: `IFC_N${++nodeCounter}`,
        x: foundCoord.x, y: foundCoord.y, z: foundCoord.z,
        tipo: "junction",
        properties: { entityType, _source: "IFC" },
      });
    }
    // Edges from IFC are harder without full geometry parsing
    // We'd need start+end points - skip for now, user can adjust
  }

  return { nodes, edges };
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <div className="text-lg mb-0.5">{icon}</div>
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
