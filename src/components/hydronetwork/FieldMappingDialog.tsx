/**
 * Field Mapping Dialog for file imports (DXF, SHP, CSV, etc.)
 * Lets users map source file columns/fields to platform attributes
 * (X, Y, Z/Cota, Elevation, ID, etc.)
 */
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, AlertTriangle, Check } from "lucide-react";

export interface SourceField {
  name: string;
  sampleValues: string[];
  type: "number" | "text" | "unknown";
}

export type PlatformField = "id" | "x" | "y" | "z_cota" | "elevation" | "diameter" | "material" | "type" | "name" | "ignore";

export interface FieldMapping {
  sourceField: string;
  targetField: PlatformField;
}

const PLATFORM_FIELDS: { value: PlatformField; label: string; description: string; required: boolean }[] = [
  { value: "id", label: "ID / Nome do Ponto", description: "Identificador único do ponto", required: false },
  { value: "x", label: "X / Este (Easting)", description: "Coordenada X ou Este (UTM) ou Longitude", required: true },
  { value: "y", label: "Y / Norte (Northing)", description: "Coordenada Y ou Norte (UTM) ou Latitude", required: true },
  { value: "z_cota", label: "Z / Cota / Elevação", description: "Cota altimétrica ou coordenada Z", required: false },
  { value: "elevation", label: "Elevação do Terreno", description: "Elevação separada do Z (se diferente)", required: false },
  { value: "diameter", label: "Diâmetro (mm)", description: "Diâmetro nominal da tubulação", required: false },
  { value: "material", label: "Material", description: "Material do tubo (PVC, PEAD, etc.)", required: false },
  { value: "type", label: "Tipo de Elemento", description: "PV, CI, TL, Nó, etc.", required: false },
  { value: "name", label: "Descrição / Rótulo", description: "Descrição textual do elemento", required: false },
  { value: "ignore", label: "⊘ Ignorar", description: "Não importar este campo", required: false },
];

function autoDetectMapping(field: SourceField): PlatformField {
  const name = field.name.toLowerCase().trim();
  if (name === "id" || name === "ponto" || name === "point_id" || name === "fid") return "id";
  if (name === "x" || name === "este" || name === "easting" || name === "e" || name === "lon" || name === "longitude") return "x";
  if (name === "y" || name === "norte" || name === "northing" || name === "n" || name === "lat" || name === "latitude") return "y";
  if (name === "z" || name === "cota" || name === "elevation" || name === "elev" || name === "alt" || name === "altura" || name === "z_cota") return "z_cota";
  if (name === "dn" || name === "diametro" || name === "diameter" || name === "diam") return "diameter";
  if (name === "material" || name === "mat" || name === "tipo_mat") return "material";
  if (name === "tipo" || name === "type" || name === "class" || name === "categoria") return "type";
  if (name === "nome" || name === "name" || name === "desc" || name === "descricao" || name === "label") return "name";
  return "ignore";
}

interface FieldMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceFields: SourceField[];
  fileName: string;
  rowCount: number;
  onConfirm: (mappings: FieldMapping[]) => void;
}

export const FieldMappingDialog = ({
  open, onOpenChange, sourceFields, fileName, rowCount, onConfirm,
}: FieldMappingDialogProps) => {
  const [mappings, setMappings] = useState<Record<string, PlatformField>>(() => {
    const initial: Record<string, PlatformField> = {};
    sourceFields.forEach(f => { initial[f.name] = autoDetectMapping(f); });
    return initial;
  });

  const hasX = useMemo(() => Object.values(mappings).includes("x"), [mappings]);
  const hasY = useMemo(() => Object.values(mappings).includes("y"), [mappings]);
  const isValid = hasX && hasY;
  const mappedCount = Object.values(mappings).filter(v => v !== "ignore").length;

  const handleConfirm = () => {
    const result: FieldMapping[] = Object.entries(mappings)
      .filter(([_, target]) => target !== "ignore")
      .map(([source, target]) => ({ sourceField: source, targetField: target }));
    onConfirm(result);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Mapeamento de Campos — Importação
          </DialogTitle>
          <DialogDescription>
            Arquivo: <strong>{fileName}</strong> — {rowCount} registros detectados.
            Atribua cada coluna do arquivo ao campo correspondente na plataforma.
          </DialogDescription>
        </DialogHeader>

        {/* Validation */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant={hasX ? "default" : "destructive"} className={hasX ? "bg-green-600" : ""}>
            {hasX ? <Check className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
            X/Este {hasX ? "✓" : "não mapeado"}
          </Badge>
          <Badge variant={hasY ? "default" : "destructive"} className={hasY ? "bg-green-600" : ""}>
            {hasY ? <Check className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
            Y/Norte {hasY ? "✓" : "não mapeado"}
          </Badge>
          <Badge variant="outline">{mappedCount} campos mapeados</Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campo no Arquivo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Amostras</TableHead>
              <TableHead className="w-52">Mapear Para</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sourceFields.map(field => (
              <TableRow key={field.name} className={mappings[field.name] === "ignore" ? "opacity-50" : ""}>
                <TableCell className="font-medium text-sm font-mono">{field.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{field.type}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                  {field.sampleValues.slice(0, 3).join(", ")}
                </TableCell>
                <TableCell>
                  <Select
                    value={mappings[field.name] || "ignore"}
                    onValueChange={v => setMappings({ ...mappings, [field.name]: v as PlatformField })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORM_FIELDS.map(pf => (
                        <SelectItem key={pf.value} value={pf.value}>
                          <div>
                            <span className="font-medium">{pf.label}</span>
                            {pf.required && <span className="text-destructive ml-1">*</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Card className="bg-muted/50">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">
              <strong>Dica:</strong> Campos X e Y são obrigatórios. Se o arquivo não tem elevação (Z/Cota), os pontos serão importados com cota = 0.
              Você pode usar coordenadas UTM (Este/Norte) ou geográficas (Latitude/Longitude) — a plataforma detecta automaticamente.
            </p>
          </CardContent>
        </Card>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!isValid} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Upload className="h-4 w-4 mr-1" /> Importar {mappedCount} Campos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
