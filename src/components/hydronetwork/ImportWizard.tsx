/**
 * Import Wizard — 5-step import wizard with mandatory preview
 * Step 1: File Type Detection + Import Mode + Numeric Format
 * Step 2: CRS Selection (mandatory, UTM zone, unit confirmation)
 * Step 3: Model Type + Entity Type Mapping (for geometric formats)
 * Step 4: Attribute Mapping (tabular) / Summary (geometric)
 * Step 5: Analysis & Confirmation — shows raw counts, converted counts, warnings
 */
import { useState, useMemo, useCallback, useEffect } from "react";
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
  Globe, Layers, Settings2, Save, FolderOpen, Search, Eye, Info
} from "lucide-react";
import {
  CRSDefinition, CRS_CATALOG,
  LayerDiscipline, SpatialNode, SpatialEdge, NodeType,
} from "@/engine/spatialCore";
import {
  NumericFormat, ImportMode, EntityTypeMapping, EntityImportRole,
  parseLocalizedNumber, validateUTMCoordinates, detectDxfEntityTypes,
  detectGeoJSONEntityTypes, detectINPEntityTypes,
  parseDXFToInternal, parseGeoJSONToInternal, parseINPToInternal,
  parseSWMMToInternal, parseTabularToInternal,
  analyzeFileRaw, RawFileAnalysis, ImportFileFormat,
  InpParsed, FieldMapping, detectFileFormat,
  FormatParadigm, getFormatParadigm, isGeometryExplicitFormat,
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

/** Paradigm-aware labels for the wizard */
const PARADIGM_LABELS: Record<FormatParadigm, { name: string; desc: string; icon: string }> = {
  bim: { name: "BIM (Modelo 3D)", desc: "Modelo BIM estruturado — geometria extraída de objetos 3D. Sem campos X/Y.", icon: "🏗️" },
  gis: { name: "GIS (Geometria Explícita)", desc: "Geometria já definida no arquivo. Sem necessidade de campos X/Y.", icon: "🌐" },
  cad: { name: "CAD (Desenho Vetorial)", desc: "Entidades vetoriais (LINE, POLYLINE). Nós criados nos endpoints. Sem Nó Início/Fim.", icon: "📐" },
  network: { name: "Rede Hidráulica Nativa", desc: "Modelo com JUNCTIONS, PIPES, COORDINATES. Auto-contido.", icon: "🔗" },
  tabular: { name: "Tabular (Planilha)", desc: "Dados em tabela com colunas X, Y, Z. Requer mapeamento de campos.", icon: "📋" },
};

const TOTAL_STEPS = 4;

// Info card helper
const InfoCard = ({ label, value, icon }: { label: string; value: string; icon: string }) => (
  <div className="bg-muted/50 rounded-lg p-3 text-center">
    <div className="text-lg mb-1">{icon}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-sm font-medium truncate">{value}</div>
  </div>
);

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
    isGeometricFormat(fileInfo.format) || fileInfo.format === "INP" || fileInfo.format === "SWMM" ? "geometric" : "tabular"
  );

  // ── FORMAT PARADIGM ──
  const paradigm = useMemo<FormatParadigm>(
    () => getFormatParadigm(fileInfo.format as ImportFileFormat),
    [fileInfo.format]
  );
  const paradigmLabel = PARADIGM_LABELS[paradigm];

  // ── RAW FILE ANALYSIS (runs immediately, no dependency on mappings) ──
  const rawAnalysis = useMemo<RawFileAnalysis | null>(() => {
    if (!fileInfo.fileContent) return null;
    try {
      return analyzeFileRaw(fileInfo.fileContent, fileInfo.format as ImportFileFormat);
    } catch { return null; }
  }, [fileInfo.fileContent, fileInfo.format]);

  // Entity type mappings — detect from ALL supported formats
  const [entityMappings, setEntityMappings] = useState<EntityTypeMapping[]>(() => {
    if (!fileInfo.fileContent) return [];
    try {
      if (fileInfo.format === "DXF") return detectDxfEntityTypes(fileInfo.fileContent);
      if (fileInfo.format === "GeoJSON") return detectGeoJSONEntityTypes(fileInfo.fileContent);
      if (fileInfo.format === "IFC") return detectIFCEntityTypes(fileInfo.fileContent);
      if (fileInfo.format === "INP" || fileInfo.format === "SWMM") return detectINPEntityTypes(fileInfo.fileContent);
    } catch { /* ignore */ }
    return [];
  });

  // Step 5: pre-parsed analysis results
  const [analysisResult, setAnalysisResult] = useState<InpParsed | null>(null);
  const [true, setAnalysisRan] = useState(true);
  const [analysisIssues, setAnalysisIssues] = useState<string[]>([]);

  const isGeometric = paradigm !== "tabular" || importMode === "geometric";
  const crs = CRS_CATALOG.find(c => c.code === selectedCRS) || CRS_CATALOG[5];

  const hasX = useMemo(() => Object.values(mappings).includes("x"), [mappings]);
  const hasY = useMemo(() => Object.values(mappings).includes("y"), [mappings]);
  const hasNodeStart = useMemo(() => Object.values(mappings).includes("no_inicio"), [mappings]);
  const hasNodeEnd = useMemo(() => Object.values(mappings).includes("no_fim"), [mappings]);
  const mappedCount = Object.values(mappings).filter(v => v !== "ignore").length;

  // Step 4 validation: geometric formats NEVER require X/Y; tabular requires X/Y
  const step4Valid = isGeometric ? true : (hasX && hasY);

  const canProceed = useMemo(() => {
    if (step === 1) return true;
    if (step === 2) return !!selectedCRS;
    if (step === 3) return !!modelType;
    if (step === 4) return step4Valid;
    if (step === 5) return true;
    return false;
  }, [step, selectedCRS, modelType, step4Valid, true]);

  // ── Run analysis when entering step 5 ──
  const runAnalysis = useCallback(() => {
    const issues: string[] = [];
    let parsed: InpParsed = { nodes: [], edges: [] };

    try {
      if (importMode === "geometric") {
        if (fileInfo.format === "DXF" && fileInfo.fileContent) {
          parsed = parseDXFToInternal(fileInfo.fileContent, entityMappings, numericFormat);
        } else if (fileInfo.format === "GeoJSON" && fileInfo.fileContent) {
          parsed = parseGeoJSONToInternal(fileInfo.fileContent, numericFormat);
        } else if (fileInfo.format === "INP" && fileInfo.fileContent) {
          parsed = parseINPToInternal(fileInfo.fileContent);
        } else if (fileInfo.format === "SWMM" && fileInfo.fileContent) {
          parsed = parseSWMMToInternal(fileInfo.fileContent);
        } else if (fileInfo.format === "IFC" && fileInfo.fileContent) {
          parsed = parseIFCGeometric(fileInfo.fileContent, entityMappings);
        }
      } else {
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

      // UTM validation
      if (crs.unit === "m" && crs.utmZone && parsed.nodes.length > 0) {
        const sample = parsed.nodes.slice(0, 5);
        for (const n of sample) {
          const check = validateUTMCoordinates(n.x, n.y);
          if (!check.valid && check.warning) {
            issues.push(check.warning);
            break;
          }
        }
      }

      // Check for zero results and explain WHY
      if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
        if (rawAnalysis && rawAnalysis.totalGeometries > 0) {
          // Raw file has geometry but conversion yielded nothing
          const ignored = entityMappings.filter(m => m.role === "ignore" || m.role === "drawing");
          const edgeMapped = entityMappings.filter(m => m.role === "edge");
          const nodeMapped = entityMappings.filter(m => m.role === "node");

          if (ignored.length > 0 && edgeMapped.length === 0 && nodeMapped.length === 0) {
            issues.push(`Todas as ${rawAnalysis.totalGeometries} geometrias do arquivo foram marcadas como "Ignorar" ou "Desenho" no mapeamento de entidades. Volte ao Passo 3 e marque pelo menos um tipo como Trecho ou Nó.`);
          } else if (edgeMapped.length === 0 && nodeMapped.length === 0) {
            issues.push(`Nenhum tipo de entidade foi mapeado como Trecho ou Nó. O arquivo contém ${rawAnalysis.totalGeometries} geometrias brutas. Verifique o mapeamento no Passo 3.`);
          } else {
            issues.push(`O arquivo contém ${rawAnalysis.totalGeometries} geometrias brutas, mas a conversão resultou em 0 elementos. Possíveis causas: formato numérico incorreto, entidades sem coordenadas válidas, ou filtro de entidades muito restritivo.`);
          }
        } else {
          issues.push("Nenhuma geometria detectada no arquivo. Verifique se o formato está correto.");
        }
      }
    } catch (err: any) {
      issues.push(`Erro ao analisar: ${err.message || String(err)}`);
    }

    setAnalysisResult(parsed);
    setAnalysisIssues(issues);
    setAnalysisRan(true);
  }, [importMode, fileInfo, entityMappings, numericFormat, mappings, rows, crs, rawAnalysis]);

  const handleStepChange = useCallback((newStep: number) => {
    if (newStep === 5 && false) {
      runAnalysis();
    }
    setStep(newStep);
  }, [true, runAnalysis]);

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
    setAnalysisRan(false);
    setAnalysisResult(null);
  }, []);
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

  // ══════════════════════════════════════
  // RENDER STEPS
  // ══════════════════════════════════════

  const renderStep1 = () => (
    <div className="space-y-4">
      {/* FORMAT PARADIGM — always shown first */}
      <Card className="border-primary/30">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{paradigmLabel.icon}</span>
            <Label className="font-semibold text-sm">{paradigmLabel.name}</Label>
            <Badge variant="outline" className="text-xs ml-auto">{fileInfo.format}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{paradigmLabel.desc}</p>
          {paradigm !== "tabular" && (
            <p className="text-xs font-medium text-primary mt-1">
              ✓ Geometria lida diretamente do arquivo — sem necessidade de mapeamento X/Y
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <InfoCard label="Formato" value={fileInfo.format} icon="📄" />
        <InfoCard label="Registros" value={String(fileInfo.recordCount)} icon="📊" />
        <InfoCard label="Campos" value={String(fileInfo.fieldCount)} icon="🏷️" />
        <InfoCard label="Geometria" value={fileInfo.geometryTypes.join(", ") || "Nenhuma"} icon="📐" />
        <InfoCard label="Tem Z" value={fileInfo.hasZ ? "Sim ✓" : "Não"} icon="📏" />
        <InfoCard label="CRS Detectado" value={fileInfo.detectedCRS?.name || "Não detectado"} icon="🌐" />
      </div>

      {/* RAW FILE ANALYSIS — always shown */}
      {rawAnalysis && rawAnalysis.totalGeometries > 0 && (
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-4 w-4 text-green-600" />
              <Label className="font-medium text-green-700 dark:text-green-400">
                Leitura Bruta do Arquivo — {rawAnalysis.totalGeometries} geometrias detectadas
              </Label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {rawAnalysis.entityCounts.map(e => (
                <div key={e.type} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      e.geometricClass === "line" ? "bg-blue-500" :
                      e.geometricClass === "point" ? "bg-green-500" :
                      e.geometricClass === "polygon" ? "bg-purple-500" :
                      "bg-gray-400"
                    }`} />
                    <span className="font-mono font-medium">{e.type}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{e.count}</Badge>
                </div>
              ))}
            </div>
            {rawAnalysis.bbox && (
              <div className="text-xs text-muted-foreground mt-2">
                📐 BBox: X[{rawAnalysis.bbox.minX.toFixed(1)} .. {rawAnalysis.bbox.maxX.toFixed(1)}] Y[{rawAnalysis.bbox.minY.toFixed(1)} .. {rawAnalysis.bbox.maxY.toFixed(1)}]
              </div>
            )}
            {rawAnalysis.layers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {rawAnalysis.layers.slice(0, 20).map(l => <Badge key={l} variant="outline" className="text-xs">{l}</Badge>)}
                {rawAnalysis.layers.length > 20 && <Badge variant="outline" className="text-xs">+{rawAnalysis.layers.length - 20} mais</Badge>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {fileInfo.layers && fileInfo.layers.length > 0 && !rawAnalysis?.layers.length && (
        <div>
          <Label className="text-xs font-medium mb-1 block">Camadas Detectadas ({fileInfo.layers.length})</Label>
          <div className="flex flex-wrap gap-1">
            {fileInfo.layers.map(l => <Badge key={l} variant="outline" className="text-xs">{l}</Badge>)}
          </div>
        </div>
      )}

      {/* Import Mode — ONLY for tabular formats or when user explicitly wants tabular override */}
      {paradigm === "tabular" && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <Label className="font-medium mb-2 block">Modo de Importação</Label>
            <RadioGroup value={importMode} onValueChange={v => { setImportMode(v as ImportMode); setAnalysisRan(false); }} className="space-y-2">
              <div className="flex items-start gap-2">
                <RadioGroupItem value="tabular" id="mode-tab" className="mt-0.5" />
                <div>
                  <Label htmlFor="mode-tab" className="font-medium text-sm cursor-pointer">📋 Tabular (Padrão)</Label>
                  <p className="text-xs text-muted-foreground">Usa campos X/Y e opcionalmente Nó Início / Nó Fim.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="geometric" id="mode-geo" className="mt-0.5" />
                <div>
                  <Label htmlFor="mode-geo" className="font-medium text-sm cursor-pointer">📐 Geométrico</Label>
                  <p className="text-xs text-muted-foreground">Se o arquivo contiver geometria embutida.</p>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* For geometric formats, just show a confirmation that mode is locked */}
      {paradigm !== "tabular" && (
        <div className="bg-muted/30 rounded-lg p-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="h-4 w-4 text-primary" />
          <span>Modo <strong>Geométrico</strong> ativo — o arquivo <strong>{fileInfo.format}</strong> contém geometria explícita. Não é necessário mapear campos X/Y.</span>
        </div>
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
                CRS detectado ({fileInfo.detectedCRS.name}) difere do selecionado.
              </p>
            </div>
          )}
          {/* Show raw coord samples for CRS validation */}
          {rawAnalysis && rawAnalysis.coordSamples.length > 0 && (
            <div>
              <Label className="text-xs">Amostras de Coordenadas</Label>
              <div className="text-xs font-mono space-y-0.5 mt-1 bg-muted/50 rounded p-2 max-h-20 overflow-auto">
                {rawAnalysis.coordSamples.slice(0, 5).map((c, i) => (
                  <div key={i}>X={c.x.toFixed(3)} Y={c.y.toFixed(3)}{c.z !== undefined ? ` Z=${c.z.toFixed(3)}` : ""}</div>
                ))}
              </div>
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
            { value: "desenho" as ModelType, label: "✏️ Desenho (Apenas Visual)", desc: "Camada de desenho que NÃO entra na simulação" },
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

      {/* Entity type mapping — shown for ALL formats with detected entities */}
      {entityMappings.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <Label className="font-medium mb-2 block">Mapeamento de Entidades</Label>
            <p className="text-xs text-muted-foreground mb-3">Defina como cada tipo de entidade deve ser importado.</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entidade</TableHead>
                  <TableHead className="text-center">Quantidade</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Importar como</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entityMappings.map(m => {
                  const rawEntry = rawAnalysis?.entityCounts.find(e => e.type === m.entityType);
                  return (
                    <TableRow key={m.entityType}>
                      <TableCell className="font-mono text-sm font-medium">{m.entityType}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{m.count}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-xs ${
                          rawEntry?.geometricClass === "line" ? "text-blue-600" :
                          rawEntry?.geometricClass === "point" ? "text-green-600" :
                          rawEntry?.geometricClass === "polygon" ? "text-purple-600" :
                          "text-muted-foreground"
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            rawEntry?.geometricClass === "line" ? "bg-blue-500" :
                            rawEntry?.geometricClass === "point" ? "bg-green-500" :
                            rawEntry?.geometricClass === "polygon" ? "bg-purple-500" :
                            "bg-gray-400"
                          }`} />
                          {rawEntry?.geometricClass || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={m.role}
                          onValueChange={v => handleEntityRoleChange(m.entityType, v as EntityImportRole)}
                        >
                          <SelectTrigger className="h-8 text-xs w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="edge">📏 Trecho (Edge)</SelectItem>
                            <SelectItem value="node">📍 Nó (Node)</SelectItem>
                            <SelectItem value="drawing">✏️ Desenho (Visual)</SelectItem>
                            <SelectItem value="ignore">⊘ Ignorar</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderStep4 = () => {
    if (isGeometric) {
      const edgeTypes = entityMappings.filter(m => m.role === "edge");
      const nodeTypes = entityMappings.filter(m => m.role === "node");
      const drawingTypes = entityMappings.filter(m => m.role === "drawing");
      const ignoredTypes = entityMappings.filter(m => m.role === "ignore");
      return (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              {paradigmLabel.icon} {paradigmLabel.name} — Resumo
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              {paradigm === "bim" && "Geometria extraída de objetos BIM 3D. Placement chains resolvidos para posições absolutas."}
              {paradigm === "gis" && "Geometria lida diretamente dos campos geometry de cada Feature. Sem campos X/Y."}
              {paradigm === "cad" && "Entidades vetoriais convertidas: linhas → trechos, pontos → nós. Nós criados automaticamente nos endpoints."}
              {paradigm === "network" && "Modelo hidráulico nativo. JUNCTIONS → Nós, PIPES/CONDUITS → Trechos. COORDINATES já incluídas."}
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600">Trechos</Badge>
                <span className="text-xs">
                  {edgeTypes.length > 0
                    ? edgeTypes.map(e => `${e.entityType} (${e.count})`).join(", ")
                    : "Nenhum tipo mapeado como trecho"
                  }
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-600">Nós</Badge>
                <span className="text-xs">
                  {nodeTypes.length > 0
                    ? nodeTypes.map(n => `${n.entityType} (${n.count})`).join(", ")
                    : "Criados automaticamente nos endpoints"
                  }
                </span>
              </div>
              {drawingTypes.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Desenho</Badge>
                  <span className="text-xs">{drawingTypes.map(d => `${d.entityType} (${d.count})`).join(", ")}</span>
                </div>
              )}
              {ignoredTypes.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Ignorados</Badge>
                  <span className="text-xs text-muted-foreground">{ignoredTypes.map(i => `${i.entityType} (${i.count})`).join(", ")}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Badge variant="outline">Formato</Badge>
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

          {/* Warning if nothing is mapped as edge or node */}
          {edgeTypes.length === 0 && nodeTypes.length === 0 && entityMappings.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-400 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Nenhuma entidade mapeada como Trecho ou Nó</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">Volte ao Passo 3 e marque pelo menos um tipo de entidade para importação.</p>
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => setStep(3)}>
                  Voltar ao Mapeamento
                </Button>
              </div>
            </div>
          )}

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

    // Tabular mode
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
                <TableHead>Campo Origem</TableHead>
                <TableHead>Amostras</TableHead>
                <TableHead className="w-52">Mapear para</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sourceFields.map(field => (
                <TableRow key={field.name} className={mappings[field.name] === "ignore" ? "opacity-40" : ""}>
                  <TableCell className="font-mono text-xs font-medium">{field.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                    {field.sampleValues.slice(0, 3).join(", ")}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mappings[field.name] || "ignore"}
                      onValueChange={v => {
                        setMappings(prev => ({ ...prev, [field.name]: v as TargetField }));
                        setAnalysisRan(false);
                      }}
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

  // ── Step 5 computed values ──
  const analysisNodeCount = analysisResult?.nodes.length ?? 0;
  const analysisEdgeCount = analysisResult?.edges.length ?? 0;
  const analysisHasData = analysisNodeCount > 0 || analysisEdgeCount > 0;
  const analysisIsZero = true && !analysisHasData;

  const entityBreakdown = useMemo(() => {
    if (!analysisResult) return null;
    const nodeSources = new Map<string, number>();
    const edgeSources = new Map<string, number>();
    for (const n of analysisResult.nodes) {
      const src = n.properties?.entityType || n.properties?._source || "Desconhecido";
      nodeSources.set(src, (nodeSources.get(src) || 0) + 1);
    }
    for (const e of analysisResult.edges) {
      const src = e.properties?.entityType || e.properties?._source || "Desconhecido";
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

  const renderStep5 = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base">Análise & Confirmação</h3>
          <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => { setAnalysisRan(false); runAnalysis(); }}>
            <Search className="h-3 w-3 mr-1" /> Re-analisar
          </Button>
        </div>

        {/* Raw vs Converted comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Raw counts */}
          {rawAnalysis && (
            <Card className="border-muted">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs font-medium text-muted-foreground">LEITURA BRUTA</Label>
                </div>
                <div className="text-2xl font-bold">{rawAnalysis.totalGeometries}</div>
                <div className="text-xs text-muted-foreground">geometrias no arquivo</div>
                <div className="mt-2 space-y-0.5">
                  {rawAnalysis.entityCounts.map(e => (
                    <div key={e.type} className="flex justify-between text-xs">
                      <span className="font-mono">{e.type}</span>
                      <span>{e.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {/* Converted counts */}
          <Card className={analysisIsZero ? "border-amber-400" : "border-green-300 dark:border-green-800"}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Check className={`h-4 w-4 ${analysisIsZero ? "text-amber-500" : "text-green-600"}`} />
                <Label className="text-xs font-medium text-muted-foreground">APÓS CONVERSÃO</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={`text-2xl font-bold ${analysisNodeCount > 0 ? "text-green-600" : "text-amber-500"}`}>{analysisNodeCount}</div>
                  <div className="text-xs text-muted-foreground">nós</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${analysisEdgeCount > 0 ? "text-blue-600" : "text-amber-500"}`}>{analysisEdgeCount}</div>
                  <div className="text-xs text-muted-foreground">trechos</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Zero result warning with detailed explanation */}
        {analysisIsZero && modelType === "rede" && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-400 dark:border-amber-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-semibold text-amber-800 dark:text-amber-300">⚠ Nenhuma geometria convertível</h4>
                {analysisIssues.map((issue, i) => (
                  <p key={i} className="text-sm text-amber-700 dark:text-amber-400">{issue}</p>
                ))}
                <div className="flex gap-2 pt-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => { setStep(3); setAnalysisRan(false); }}>
                    Ajustar Entidades (Passo 3)
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setStep(1); setAnalysisRan(false); }}>
                    Ajustar Formato/Modo (Passo 1)
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setStep(2); setAnalysisRan(false); }}>
                    Ajustar CRS (Passo 2)
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setModelType("desenho");
                    setAnalysisRan(false);
                    setTimeout(runAnalysis, 50);
                  }}>
                    Forçar como Desenho
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Non-zero warnings */}
        {analysisIssues.length > 0 && !analysisIsZero && (
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
              <Label className="font-medium mb-2 block">Detalhamento por Tipo</Label>
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

        {/* Bounding box */}
        {(analysisBbox || rawAnalysis?.bbox) && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <Label className="font-medium mb-2 block">Bounding Box</Label>
              {(() => {
                const bbox = analysisBbox || rawAnalysis?.bbox;
                if (!bbox) return null;
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div><span className="text-muted-foreground">X min:</span> <span className="font-mono">{bbox.minX.toFixed(2)}</span></div>
                      <div><span className="text-muted-foreground">X max:</span> <span className="font-mono">{bbox.maxX.toFixed(2)}</span></div>
                      <div><span className="text-muted-foreground">Y min:</span> <span className="font-mono">{bbox.minY.toFixed(2)}</span></div>
                      <div><span className="text-muted-foreground">Y max:</span> <span className="font-mono">{bbox.maxY.toFixed(2)}</span></div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Extensão: {(bbox.maxX - bbox.minX).toFixed(2)} × {(bbox.maxY - bbox.minY).toFixed(2)} {crs.unit}
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Config summary */}
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
            <Badge variant="outline" className="ml-2">{paradigmLabel.icon} {paradigmLabel.name}</Badge>
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
          {step < 4 ? (
            <Button onClick={() => handleStepChange(step + 1)} disabled={!canProceed}>
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleConfirmImport}
              disabled={false}
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

// ── IFC helpers ──

function detectIFCEntityTypes(content: string): EntityTypeMapping[] {
  const counts = new Map<string, number>();
  const regex = /^#\d+=\s*(IFC\w+)\s*\(/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const type = match[1].toUpperCase();
    if (type.includes("PIPE") || type.includes("FLOW") || type.includes("DUCT") ||
        type.includes("WALL") || type.includes("SLAB") || type.includes("BEAM") ||
        type.includes("COLUMN") || type.includes("POINT") || type.includes("FITTING") ||
        type.includes("MEMBER") || type.includes("PLATE") || type.includes("OPENING")) {
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

/**
 * IFC GEOMETRIC PARSER — Extracts geometry from BIM objects.
 *
 * IFC is NOT a table. IFC is NOT X/Y fields.
 * It is a 3D BIM model with:
 * - Object hierarchy (IfcPipeSegment, IfcFlowTerminal, etc.)
 * - Placement chains (IfcLocalPlacement → IfcAxis2Placement3D → IfcCartesianPoint)
 * - Geometric representations (IfcPolyline, IfcTrimmedCurve, etc.)
 *
 * This parser:
 * 1. Builds a map of ALL IfcCartesianPoints
 * 2. Resolves IfcLocalPlacement chains to get absolute positions
 * 3. For pipe/duct segments: extracts axis curve endpoints → edges + auto-nodes
 * 4. For terminals/fittings: extracts placement position → nodes
 */
function parseIFCGeometric(content: string, entityMappings?: EntityTypeMapping[]): InpParsed {
  const nodes: InpParsed["nodes"] = [];
  const edges: InpParsed["edges"] = [];

  const roleMap = new Map<string, EntityImportRole>();
  if (entityMappings) {
    entityMappings.forEach(m => roleMap.set(m.entityType.toUpperCase(), m.role));
  }

  // Step 1: Parse ALL CartesianPoints → id → {x, y, z}
  const pointMap = new Map<string, { x: number; y: number; z: number }>();
  const pointRegex = /#(\d+)\s*=\s*IFCCARTESIANPOINT\s*\(\(([^)]+)\)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pointRegex.exec(content)) !== null) {
    const coords = match[2].split(",").map(c => parseFloat(c.trim()));
    if (coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      pointMap.set(`#${match[1]}`, { x: coords[0], y: coords[1], z: coords[2] || 0 });
    }
  }

  // Step 2: Parse IfcAxis2Placement3D → location point ref
  const placementPointMap = new Map<string, string>(); // placement id → point ref
  const axisRegex = /#(\d+)\s*=\s*IFCAXIS2PLACEMENT3D\s*\((#\d+)/gi;
  while ((match = axisRegex.exec(content)) !== null) {
    placementPointMap.set(`#${match[1]}`, match[2]);
  }

  // Step 3: Parse IfcLocalPlacement → relative placement ref
  const localPlacementMap = new Map<string, { relativeTo?: string; axisPlacement: string }>();
  const lpRegex = /#(\d+)\s*=\s*IFCLOCALPLACEMENT\s*\(([^,]*),\s*(#\d+)\)/gi;
  while ((match = lpRegex.exec(content)) !== null) {
    const relativeTo = match[2].trim() === "$" ? undefined : match[2].trim();
    localPlacementMap.set(`#${match[1]}`, { relativeTo, axisPlacement: match[3] });
  }

  // Step 4: Parse IfcPolyline → list of point refs (for axis curves)
  const polylineMap = new Map<string, string[]>();
  const polyRegex = /#(\d+)\s*=\s*IFCPOLYLINE\s*\(\(([^)]+)\)\)/gi;
  while ((match = polyRegex.exec(content)) !== null) {
    const refs = match[2].match(/#\d+/g) || [];
    if (refs.length >= 2) polylineMap.set(`#${match[1]}`, refs);
  }

  // Resolve placement to absolute coords (simplified — ignores rotation)
  function resolvePlacementCoords(placementRef: string): { x: number; y: number; z: number } | null {
    const lp = localPlacementMap.get(placementRef);
    if (!lp) return null;
    const axisPointRef = placementPointMap.get(lp.axisPlacement);
    if (!axisPointRef) return null;
    const pt = pointMap.get(axisPointRef);
    if (!pt) return null;

    // Add parent offset (simplified chain resolution)
    if (lp.relativeTo) {
      const parentCoords = resolvePlacementCoords(lp.relativeTo);
      if (parentCoords) {
        return { x: pt.x + parentCoords.x, y: pt.y + parentCoords.y, z: pt.z + parentCoords.z };
      }
    }
    return { ...pt };
  }

  let nodeCounter = 0;
  let edgeCounter = 0;
  const nodeIndex = new Map<string, string>();
  const snapDecimals = 3; // mm precision for BIM

  function getOrCreateNode(x: number, y: number, z: number, entType?: string): string {
    const key = `${x.toFixed(snapDecimals)},${y.toFixed(snapDecimals)}`;
    if (nodeIndex.has(key)) return nodeIndex.get(key)!;
    const id = `IFC_N${++nodeCounter}`;
    nodeIndex.set(key, id);
    nodes.push({ id, x, y, z, tipo: "junction", properties: { _source: "IFC", entityType: entType } });
    return id;
  }

  // Step 5: Parse all IFC entities and extract geometry based on role
  const entityRegex2 = /#(\d+)\s*=\s*(IFC\w+)\s*\(([^;]*)\);/gi;
  while ((match = entityRegex2.exec(content)) !== null) {
    const entId = `#${match[1]}`;
    const entType = match[2].toUpperCase();
    const entArgs = match[3];
    const role = roleMap.get(entType);
    if (!role || role === "ignore" || role === "drawing") continue;

    // Find placement ref in entity arguments
    const refMatches = entArgs.match(/#\d+/g) || [];

    if (role === "edge") {
      // Try to find polyline representation for axis curve
      let foundEdge = false;
      for (const ref of refMatches) {
        const polyPoints = polylineMap.get(ref);
        if (polyPoints && polyPoints.length >= 2) {
          const startPt = pointMap.get(polyPoints[0]);
          const endPt = pointMap.get(polyPoints[polyPoints.length - 1]);
          if (startPt && endPt) {
            const startId = getOrCreateNode(startPt.x, startPt.y, startPt.z, entType);
            const endId = getOrCreateNode(endPt.x, endPt.y, endPt.z, entType);
            const vertices: [number, number, number][] = polyPoints
              .map(pr => pointMap.get(pr))
              .filter(Boolean)
              .map(p => [p!.x, p!.y, p!.z] as [number, number, number]);
            edges.push({
              id: `IFC_E${++edgeCounter}`,
              startNodeId: startId, endNodeId: endId,
              dn: 200, material: "PVC", tipoRede: "Genérico",
              vertices,
              properties: { _source: "IFC", entityType: entType, ifcId: entId },
            });
            foundEdge = true;
            break;
          }
        }
      }
      // Fallback: try placement as single point (degenerate edge → node)
      if (!foundEdge) {
        for (const ref of refMatches) {
          if (localPlacementMap.has(ref)) {
            const coords = resolvePlacementCoords(ref);
            if (coords) { getOrCreateNode(coords.x, coords.y, coords.z, entType); break; }
          }
          const pt = pointMap.get(ref);
          if (pt) { getOrCreateNode(pt.x, pt.y, pt.z, entType); break; }
        }
      }
    } else if (role === "node") {
      // Resolve placement chain for absolute position
      let placed = false;
      for (const ref of refMatches) {
        if (localPlacementMap.has(ref)) {
          const coords = resolvePlacementCoords(ref);
          if (coords) { getOrCreateNode(coords.x, coords.y, coords.z, entType); placed = true; break; }
        }
      }
      if (!placed) {
        for (const ref of refMatches) {
          const pt = pointMap.get(ref);
          if (pt) { getOrCreateNode(pt.x, pt.y, pt.z, entType); break; }
        }
      }
    }
  }

  return { nodes, edges };
}
