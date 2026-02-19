/**
 * Import Wizard — 4-step QGIS-like import wizard
 * Step 1: File Type Detection + Import Mode + Numeric Format
 * Step 2: CRS Selection (mandatory, UTM zone, unit confirmation)
 * Step 3: Model Type + Entity Type Mapping (for geometric formats)
 * Step 4: Attribute Mapping (full freedom, template saving)
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
  Globe, Layers, Settings2, Save, FolderOpen
} from "lucide-react";
import {
  CRSDefinition, CRS_CATALOG,
  LayerDiscipline, SpatialNode, SpatialEdge, NodeType,
} from "@/engine/spatialCore";
import {
  NumericFormat, ImportMode, EntityTypeMapping, EntityImportRole,
  parseLocalizedNumber, validateUTMCoordinates, detectDxfEntityTypes,
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
  fileContent?: string; // raw file content for entity detection
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
    return [];
  });

  const isGeometric = isGeometricFormat(fileInfo.format);
  const crs = CRS_CATALOG.find(c => c.code === selectedCRS) || CRS_CATALOG[5];

  const hasX = useMemo(() => Object.values(mappings).includes("x"), [mappings]);
  const hasY = useMemo(() => Object.values(mappings).includes("y"), [mappings]);
  const hasNodeStart = useMemo(() => Object.values(mappings).includes("no_inicio"), [mappings]);
  const hasNodeEnd = useMemo(() => Object.values(mappings).includes("no_fim"), [mappings]);
  const mappedCount = Object.values(mappings).filter(v => v !== "ignore").length;

  // In geometric mode, X/Y are not required from field mapping (they come from geometry)
  const step4Valid = importMode === "geometric" ? true : (hasX && hasY);

  const canProceed = useMemo(() => {
    if (step === 1) return true;
    if (step === 2) return !!selectedCRS;
    if (step === 3) return !!modelType;
    if (step === 4) return step4Valid;
    return false;
  }, [step, selectedCRS, modelType, step4Valid]);

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
  }, []);

  const handleImport = useCallback(() => {
    const discipline: LayerDiscipline = modelType === "topografia" ? "topografia"
      : modelType === "bim" ? "bim"
      : modelType === "generico" ? "generico"
      : modelType === "desenho" ? "desenho"
      : "esgoto";

    // For geometric mode, the ImportEngine handles node/edge creation from geometry
    if (importMode === "geometric") {
      const result: ImportResult = {
        nodes: [],
        edges: [],
        crs,
        modelType,
        discipline,
        layerName: fileName.replace(/\.[^.]+$/, ""),
        sourceFile: fileName,
        validationIssues: [],
        numericFormat,
        importMode: "geometric",
        entityMappings: entityMappings.length > 0 ? entityMappings : undefined,
      };
      onImport(result);
      onOpenChange(false);
      toast.success("Importação geométrica iniciada");
      return;
    }

    // Tabular mode - parse from rows with locale-aware numbers
    const getField = (target: TargetField) => {
      const entry = Object.entries(mappings).find(([_, t]) => t === target);
      return entry?.[0];
    };

    const xField = getField("x");
    const yField = getField("y");
    const zField = getField("z") || getField("cota_terreno");
    const idField = getField("id");
    const tipoField = getField("tipo");
    const nomeField = getField("nome");
    const fromField = getField("no_inicio");
    const toField = getField("no_fim");
    const dnField = getField("diametro");
    const matField = getField("material");
    const compField = getField("comprimento");
    const slopeField = getField("declividade");
    const roughField = getField("rugosidade");
    const demandField = getField("demanda");
    const cotaFundoField = getField("cota_fundo");
    const profField = getField("profundidade");

    if (!xField || !yField) { toast.error("Campos X e Y são obrigatórios no modo tabular"); return; }

    const pn = (val: any) => parseLocalizedNumber(val, numericFormat);

    const nodes: Array<Omit<SpatialNode, "layerId">> = [];
    const edges: Array<Omit<SpatialEdge, "layerId" | "properties"> & { properties?: Record<string, any> }> = [];
    const issues: string[] = [];

    const isEdgeImport = modelType === "rede" && fromField && toField;

    if (isEdgeImport) {
      const nodeMap = new Map<string, { x: number; y: number; z: number }>();

      rows.forEach((row, i) => {
        const fromId = String(row[fromField!] || "").trim();
        const toId = String(row[toField!] || "").trim();
        if (!fromId || !toId) { issues.push(`Linha ${i + 1}: sem nó início/fim`); return; }

        const x = pn(row[xField]) ?? 0;
        const y = pn(row[yField]) ?? 0;
        const z = zField ? pn(row[zField]) ?? 0 : 0;

        if (!nodeMap.has(fromId)) nodeMap.set(fromId, { x, y, z });

        // UTM validation
        if (crs.unit === "m" && crs.utmZone) {
          const utmCheck = validateUTMCoordinates(x, y);
          if (!utmCheck.valid && i < 3) {
            issues.push(`Linha ${i + 1}: ${utmCheck.warning}`);
          }
        }

        edges.push({
          id: `E${String(i + 1).padStart(4, "0")}`,
          startNodeId: fromId,
          endNodeId: toId,
          dn: dnField ? pn(row[dnField]) ?? 200 : 200,
          comprimento: compField ? pn(row[compField]) ?? 0 : 0,
          declividade: slopeField ? (pn(row[slopeField]) ?? 0) / 100 : 0,
          material: matField ? String(row[matField] || "PVC") : "PVC",
          tipoRede: "Esgoto por Gravidade",
          roughness: roughField ? pn(row[roughField]) ?? undefined : undefined,
          properties: {},
        });
      });

      nodeMap.forEach((coords, id) => {
        nodes.push({ id, x: coords.x, y: coords.y, z: coords.z, tipo: "junction", properties: {} });
      });
    } else {
      rows.forEach((row, i) => {
        const x = pn(row[xField]);
        const y = pn(row[yField]);
        if (x === null || y === null) { issues.push(`Linha ${i + 1}: coordenadas inválidas`); return; }
        const z = zField ? pn(row[zField]) ?? 0 : 0;
        const id = idField ? String(row[idField] || `P${String(i + 1).padStart(3, "0")}`) : `P${String(i + 1).padStart(3, "0")}`;

        // UTM validation (first 3 rows)
        if (crs.unit === "m" && crs.utmZone && i < 3) {
          const utmCheck = validateUTMCoordinates(x, y);
          if (!utmCheck.valid) issues.push(`Linha ${i + 1}: ${utmCheck.warning}`);
        }

        let tipo: NodeType = "generic";
        if (tipoField) {
          const t = String(row[tipoField] || "").toLowerCase();
          if (t.includes("pv") || t.includes("poco")) tipo = "pv";
          else if (t.includes("ci")) tipo = "ci";
          else if (t.includes("tl")) tipo = "tl";
          else if (t.includes("reserv")) tipo = "reservoir";
          else if (t.includes("bomba") || t.includes("pump")) tipo = "pump";
        }

        nodes.push({
          id, x, y, z: isNaN(z) ? 0 : z,
          tipo,
          label: nomeField ? String(row[nomeField] || "") : undefined,
          demanda: demandField ? pn(row[demandField]) ?? undefined : undefined,
          cotaFundo: cotaFundoField ? pn(row[cotaFundoField]) ?? undefined : undefined,
          profundidade: profField ? pn(row[profField]) ?? undefined : undefined,
          properties: {},
        });
      });
    }

    if (nodes.length === 0 && edges.length === 0) {
      toast.error("Nenhum dado válido após mapeamento");
      return;
    }

    const result: ImportResult = {
      nodes,
      edges,
      crs,
      modelType,
      discipline,
      layerName: fileName.replace(/\.[^.]+$/, ""),
      sourceFile: fileName,
      validationIssues: issues,
      numericFormat,
      importMode: "tabular",
    };

    onImport(result);
    onOpenChange(false);
    toast.success(`Importação concluída: ${nodes.length} nós, ${edges.length} trechos`);
  }, [mappings, rows, crs, modelType, fileName, onImport, onOpenChange, numericFormat, importMode, entityMappings]);

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
            <RadioGroup value={importMode} onValueChange={v => setImportMode(v as ImportMode)} className="space-y-2">
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
          <RadioGroup value={numericFormat} onValueChange={v => setNumericFormat(v as NumericFormat)} className="space-y-1">
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
          <Select value={selectedCRS} onValueChange={setSelectedCRS}>
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
              onClick={() => setModelType(opt.value)}
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

          {/* Optional: attribute mapping for additional fields (if sourceFields available) */}
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

  const stepTitles = [
    { num: 1, title: "Arquivo & Modo", icon: <FileText className="h-4 w-4" /> },
    { num: 2, title: "Sistema de Referência", icon: <Globe className="h-4 w-4" /> },
    { num: 3, title: "Tipo de Modelo", icon: <Layers className="h-4 w-4" /> },
    { num: 4, title: importMode === "geometric" ? "Resumo" : "Mapeamento de Atributos", icon: <Settings2 className="h-4 w-4" /> },
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
            Wizard de importação em {stepTitles.length} etapas
            {importMode === "geometric" && <Badge variant="outline" className="ml-2">Modo Geométrico</Badge>}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-2">
          {stepTitles.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all
                  ${step === s.num ? "bg-primary text-primary-foreground" : step > s.num ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}
                onClick={() => { if (s.num < step) setStep(s.num); }}
              >
                {step > s.num ? <Check className="h-3 w-3" /> : s.icon}
                <span className="hidden sm:inline">{s.title}</span>
                <span className="sm:hidden">{s.num}</span>
              </div>
              {i < stepTitles.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        <Progress value={(step / 4) * 100} className="h-1" />

        <div className="min-h-[200px]">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
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
            <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed}>
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={!step4Valid} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Upload className="h-4 w-4 mr-1" /> Importar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function InfoCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <div className="text-lg mb-0.5">{icon}</div>
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
