/**
 * Layer Mapping Dialog for DXF/SHP import
 * Shows detected layers and lets users assign categories
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Layers } from "lucide-react";

export interface DetectedLayer {
  name: string;
  entityCount: number;
  geometryType: string; // "POINT" | "LINE" | "POLYLINE" | "TEXT" | "BLOCK" | "MIXED"
  hasElevation: boolean;
  sampleEntities?: number;
}

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
}

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
  const [mappings, setMappings] = useState<Record<string, LayerCategory>>(() => {
    const initial: Record<string, LayerCategory> = {};
    layers.forEach(l => { initial[l.name] = autoDetectCategory(l); });
    return initial;
  });

  const handleConfirm = () => {
    const result: LayerMapping[] = Object.entries(mappings)
      .filter(([_, cat]) => cat !== "ignorar")
      .map(([name, category]) => ({ layerName: name, category }));
    onConfirm(result);
    onOpenChange(false);
  };

  const totalEntities = layers.reduce((s, l) => s + l.entityCount, 0);
  const importedLayers = Object.values(mappings).filter(c => c !== "ignorar").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Mapeamento de Camadas — {fileType}
          </DialogTitle>
          <DialogDescription>
            Arquivo: <strong>{fileName}</strong> — {layers.length} camadas, {totalEntities} entidades detectadas.
            Atribua cada camada a uma categoria da plataforma.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-2 text-xs text-muted-foreground">
          <Badge variant="outline">{importedLayers} camadas para importar</Badge>
          <Badge variant="outline">{layers.length - importedLayers} ignoradas</Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Camada</TableHead>
              <TableHead>Geometria</TableHead>
              <TableHead className="w-20">Entidades</TableHead>
              <TableHead>Elevação</TableHead>
              <TableHead className="w-48">Categoria</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {layers.map(layer => (
              <TableRow key={layer.name} className={mappings[layer.name] === "ignorar" ? "opacity-50" : ""}>
                <TableCell className="font-medium text-sm">{layer.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{layer.geometryType}</Badge>
                </TableCell>
                <TableCell className="text-sm">{layer.entityCount}</TableCell>
                <TableCell>
                  {layer.hasElevation ? (
                    <Badge className="bg-green-500 text-white text-xs">Sim</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Não</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={mappings[layer.name] || "ignorar"}
                    onValueChange={v => setMappings({ ...mappings, [layer.name]: v as LayerCategory })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
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
            ))}
          </TableBody>
        </Table>

        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
          <p><strong>Dica:</strong> Camadas sem elevação (Z=0) serão importadas com cota = 0. Você pode editar as cotas depois no mapa.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Upload className="h-4 w-4 mr-1" /> Importar {importedLayers} Camadas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
