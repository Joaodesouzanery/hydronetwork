/**
 * Layer Mapping Dialog for DXF/SHP import
 * Shows detected layers and lets users:
 * 1. Toggle import on/off per layer (checkbox)
 * 2. Assign a schema type (Nó, Trecho, Elevação, Ponto, Atributo Extra)
 * 3. Map source fields to X, Y, Z per layer
 * 4. View sample values
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Layers } from "lucide-react";

export interface DetectedLayer {
  name: string;
  entityCount: number;
  geometryType: string; // "POINT" | "LINE" | "POLYLINE" | "TEXT" | "BLOCK" | "MIXED"
  hasElevation: boolean;
  sampleEntities?: number;
  /** Fields/attributes found inside this layer */
  fields?: { name: string; sampleValues: string[] }[];
}

export type LayerSchemaType =
  | "no"        // Nó
  | "trecho"    // Trecho / Segmento
  | "elevacao"  // Elevação / Curva de nível
  | "ponto"     // Ponto genérico
  | "atributo"  // Atributo extra
  | "ignorar";

export type LayerCategory =
  | "ponto_topografico"
  | "linha_rede"
  | "poco_visita"
  | "caixa"
  | "curva_nivel"
  | "texto_rotulo"
  | "tubulacao"
  | "reservatorio"
  | "estacao_elevatoria"
  | "ignorar";

export interface LayerMapping {
  layerName: string;
  category: LayerCategory;
  schemaType: LayerSchemaType;
  fieldX?: string;
  fieldY?: string;
  fieldZ?: string;
  enabled: boolean;
}

const SCHEMA_OPTIONS: { value: LayerSchemaType; label: string; description: string }[] = [
  { value: "no", label: "Nó", description: "Ponto de junção da rede" },
  { value: "trecho", label: "Trecho", description: "Segmento / Linha da rede" },
  { value: "elevacao", label: "Elevação", description: "Curva de nível / Dados altimétricos" },
  { value: "ponto", label: "Ponto", description: "Ponto topográfico genérico" },
  { value: "atributo", label: "Atributo Extra", description: "Dados complementares" },
  { value: "ignorar", label: "Ignorar", description: "Não importar" },
];

const CATEGORY_OPTIONS: { value: LayerCategory; label: string; color: string }[] = [
  { value: "ponto_topografico", label: "Ponto Topográfico", color: "bg-blue-500" },
  { value: "linha_rede", label: "Linha/Rede", color: "bg-green-500" },
  { value: "poco_visita", label: "Poço de Visita (PV)", color: "bg-purple-500" },
  { value: "caixa", label: "Caixa (CI/CR/CP)", color: "bg-orange-500" },
  { value: "curva_nivel", label: "Curva de Nível", color: "bg-teal-500" },
  { value: "texto_rotulo", label: "Texto/Rótulo", color: "bg-gray-500" },
  { value: "tubulacao", label: "Tubulação", color: "bg-cyan-500" },
  { value: "reservatorio", label: "Reservatório", color: "bg-amber-500" },
  { value: "estacao_elevatoria", label: "Estação Elevatória", color: "bg-red-500" },
  { value: "ignorar", label: "Ignorar", color: "bg-gray-300" },
];

function autoDetectCategory(layer: DetectedLayer): LayerCategory {
  const name = layer.name.toLowerCase();
  if (name.includes("pv") || name.includes("poco") || name.includes("manhole")) return "poco_visita";
  if (name.includes("tubo") || name.includes("pipe") || name.includes("rede") || name.includes("dn")) return "tubulacao";
  if (name.includes("caixa") || name.includes("ci") || name.includes("cr")) return "caixa";
  if (name.includes("curva") || name.includes("contour") || name.includes("nivel")) return "curva_nivel";
  if (name.includes("text") || name.includes("rotulo") || name.includes("label") || name.includes("anot")) return "texto_rotulo";
  if (name.includes("reserv") || name.includes("tank")) return "reservatorio";
  if (name.includes("ee") || name.includes("eleva") || name.includes("pump")) return "estacao_elevatoria";
  if (layer.geometryType === "POINT") return "ponto_topografico";
  if (layer.geometryType === "LINE" || layer.geometryType === "POLYLINE") return "linha_rede";
  if (layer.geometryType === "TEXT") return "texto_rotulo";
  return "ignorar";
}

function autoDetectSchema(layer: DetectedLayer): LayerSchemaType {
  const name = layer.name.toLowerCase();
  if (layer.geometryType === "LINE" || layer.geometryType === "POLYLINE" || name.includes("trecho") || name.includes("tubo") || name.includes("pipe") || name.includes("rede")) return "trecho";
  if (name.includes("curva") || name.includes("contour") || name.includes("nivel")) return "elevacao";
  if (name.includes("pv") || name.includes("poco") || name.includes("no") || name.includes("junction") || name.includes("manhole")) return "no";
  if (layer.geometryType === "POINT") return "ponto";
  if (layer.geometryType === "TEXT" || layer.geometryType === "BLOCK") return "atributo";
  return "ponto";
}

function autoDetectField(fields: { name: string; sampleValues: string[] }[], target: "x" | "y" | "z"): string | undefined {
  const normalized = fields.map(f => ({ ...f, norm: f.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") }));
  if (target === "x") return normalized.find(f => /^(x|este|easting|lon|longitude|e)$/i.test(f.norm))?.name;
  if (target === "y") return normalized.find(f => /^(y|norte|northing|lat|latitude|n)$/i.test(f.norm))?.name;
  if (target === "z") return normalized.find(f => /^(z|cota|elevation|elev|alt|altura)$/i.test(f.norm))?.name;
  return undefined;
}

interface LayerMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layers: DetectedLayer[];
  fileType: "DXF" | "SHP" | "DWG" | "IFC";
  fileName: string;
  onConfirm: (mappings: LayerMapping[]) => void;
}

export const LayerMappingDialog = ({
  open, onOpenChange, layers, fileType, fileName, onConfirm
}: LayerMappingDialogProps) => {
  const [mappings, setMappings] = useState<Record<string, {
    category: LayerCategory;
    schemaType: LayerSchemaType;
    enabled: boolean;
    fieldX?: string;
    fieldY?: string;
    fieldZ?: string;
  }>>(() => {
    const initial: Record<string, any> = {};
    layers.forEach(l => {
      const fields = l.fields || [];
      initial[l.name] = {
        category: autoDetectCategory(l),
        schemaType: autoDetectSchema(l),
        enabled: autoDetectCategory(l) !== "ignorar",
        fieldX: autoDetectField(fields, "x"),
        fieldY: autoDetectField(fields, "y"),
        fieldZ: autoDetectField(fields, "z"),
      };
    });
    return initial;
  });

  const updateMapping = (layerName: string, updates: Partial<typeof mappings[string]>) => {
    setMappings(prev => ({ ...prev, [layerName]: { ...prev[layerName], ...updates } }));
  };

  const handleConfirm = () => {
    const result: LayerMapping[] = Object.entries(mappings)
      .filter(([_, m]) => m.enabled)
      .map(([name, m]) => ({
        layerName: name,
        category: m.category,
        schemaType: m.schemaType,
        fieldX: m.fieldX,
        fieldY: m.fieldY,
        fieldZ: m.fieldZ,
        enabled: m.enabled,
      }));
    onConfirm(result);
    onOpenChange(false);
  };

  const totalEntities = layers.reduce((s, l) => s + l.entityCount, 0);
  const enabledLayers = Object.values(mappings).filter(m => m.enabled).length;

  const [expandedLayer, setExpandedLayer] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Mapeamento de Camadas — {fileType}
          </DialogTitle>
          <DialogDescription>
            Arquivo: <strong>{fileName}</strong> — {layers.length} camadas, {totalEntities} entidades.
            Selecione o tipo de cada camada e mapeie os campos X, Y, Z.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-2 text-xs text-muted-foreground">
          <Badge variant="outline">{enabledLayers} camadas ativas</Badge>
          <Badge variant="outline">{layers.length - enabledLayers} ignoradas</Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">Ativo</TableHead>
              <TableHead>Camada</TableHead>
              <TableHead>Geometria</TableHead>
              <TableHead className="w-16">Entidades</TableHead>
              <TableHead className="w-36">Tipo (Schema)</TableHead>
              <TableHead className="w-44">Categoria</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {layers.map(layer => {
              const m = mappings[layer.name];
              if (!m) return null;
              const fields = layer.fields || [];
              const isExpanded = expandedLayer === layer.name;

              return (
                <>
                  <TableRow key={layer.name} className={!m.enabled ? "opacity-40" : ""}>
                    <TableCell>
                      <Checkbox checked={m.enabled} onCheckedChange={(checked) => updateMapping(layer.name, { enabled: !!checked })} />
                    </TableCell>
                    <TableCell>
                      <button className="font-medium text-sm text-left hover:underline" onClick={() => setExpandedLayer(isExpanded ? null : layer.name)}>
                        {layer.name}
                        {fields.length > 0 && <span className="text-xs text-muted-foreground ml-1">({fields.length} campos)</span>}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{layer.geometryType}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{layer.entityCount}</TableCell>
                    <TableCell>
                      <Select value={m.schemaType} onValueChange={v => updateMapping(layer.name, { schemaType: v as LayerSchemaType })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SCHEMA_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <span className="font-medium">{opt.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={m.category} onValueChange={v => updateMapping(layer.name, { category: v as LayerCategory })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORY_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <span className="flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                                {opt.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                  {/* Expanded row: field mapping for X, Y, Z + sample values */}
                  {isExpanded && m.enabled && (
                    <TableRow key={`${layer.name}-fields`} className="bg-muted/30">
                      <TableCell colSpan={6}>
                        <div className="p-3 space-y-3">
                          <p className="text-xs font-medium text-muted-foreground">Mapeamento de Campos — {layer.name}</p>
                          <div className="grid grid-cols-3 gap-3">
                            {/* X field */}
                            <div>
                              <label className="text-xs font-medium mb-1 block">Campo X (Este/Longitude)</label>
                              <Select value={m.fieldX || "__none"} onValueChange={v => updateMapping(layer.name, { fieldX: v === "__none" ? undefined : v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">— Nenhum —</SelectItem>
                                  {fields.map(f => (
                                    <SelectItem key={f.name} value={f.name}>
                                      {f.name} <span className="text-muted-foreground ml-1">({f.sampleValues.slice(0, 2).join(", ")})</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {/* Y field */}
                            <div>
                              <label className="text-xs font-medium mb-1 block">Campo Y (Norte/Latitude)</label>
                              <Select value={m.fieldY || "__none"} onValueChange={v => updateMapping(layer.name, { fieldY: v === "__none" ? undefined : v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">— Nenhum —</SelectItem>
                                  {fields.map(f => (
                                    <SelectItem key={f.name} value={f.name}>
                                      {f.name} <span className="text-muted-foreground ml-1">({f.sampleValues.slice(0, 2).join(", ")})</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {/* Z field */}
                            <div>
                              <label className="text-xs font-medium mb-1 block">Campo Z (Cota/Elevação)</label>
                              <Select value={m.fieldZ || "__none"} onValueChange={v => updateMapping(layer.name, { fieldZ: v === "__none" ? undefined : v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">— Nenhum —</SelectItem>
                                  {fields.map(f => (
                                    <SelectItem key={f.name} value={f.name}>
                                      {f.name} <span className="text-muted-foreground ml-1">({f.sampleValues.slice(0, 2).join(", ")})</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {/* All fields with samples */}
                          {fields.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Todos os campos detectados:</p>
                              <div className="grid grid-cols-2 gap-1 text-xs max-h-32 overflow-auto">
                                {fields.map(f => (
                                  <div key={f.name} className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1">
                                    <span className="font-mono font-medium">{f.name}</span>
                                    <span className="text-muted-foreground truncate">{f.sampleValues.slice(0, 3).join(", ")}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>

        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
          <p><strong>Dica:</strong> Clique no nome da camada para expandir e mapear campos X, Y e Z. Camadas sem elevação serão importadas com cota = 0.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Upload className="h-4 w-4 mr-1" /> Importar {enabledLayers} Camadas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
