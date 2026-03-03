/**
 * Point Classification Panel
 * System for classifying survey points as PV, TL, TIL, CI, etc.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings2, Plus, Trash2, Palette, Tag } from "lucide-react";
import { PontoTopografico } from "@/engine/reader";

export interface PointType {
  id: string;
  code: string;
  label: string;
  color: string;
  shape: "circle" | "square" | "triangle" | "diamond";
  description: string;
  defaultDepthMin?: number;
  defaultDepthMax?: number;
}

const DEFAULT_POINT_TYPES: PointType[] = [
  { id: "pv", code: "PV", label: "Poço de Visita", color: "#3b82f6", shape: "circle", description: "Poço de visita / Manhole", defaultDepthMin: 1.0, defaultDepthMax: 6.0 },
  { id: "tl", code: "TL", label: "Terminal de Limpeza", color: "#22c55e", shape: "square", description: "Terminal de limpeza para manutenção" },
  { id: "til", code: "TIL", label: "Terminal de Inspeção e Limpeza", color: "#14b8a6", shape: "square", description: "Terminal de inspeção e limpeza" },
  { id: "ci", code: "CI", label: "Caixa de Inspeção", color: "#f59e0b", shape: "diamond", description: "Caixa de inspeção residencial" },
  { id: "cr", code: "CR", label: "Caixa de Reunião", color: "#8b5cf6", shape: "diamond", description: "Caixa de reunião de ramais" },
  { id: "cp", code: "CP", label: "Caixa de Passagem", color: "#ec4899", shape: "diamond", description: "Caixa de passagem" },
  { id: "ee", code: "EE", label: "Estação Elevatória", color: "#ef4444", shape: "triangle", description: "Estação elevatória / Pumping station" },
  { id: "ete", code: "ETE", label: "Estação de Tratamento", color: "#6366f1", shape: "triangle", description: "Estação de tratamento de esgoto" },
  { id: "eta", code: "ETA", label: "Est. Tratamento Água", color: "#06b6d4", shape: "triangle", description: "Estação de tratamento de água" },
  { id: "no", code: "NÓ", label: "Nó Simples", color: "#6b7280", shape: "circle", description: "Junção simples sem estrutura" },
];

interface PointClassificationPanelProps {
  pontos: PontoTopografico[];
  onPontosChange?: (pontos: PontoTopografico[]) => void;
  classifications: Record<string, string>; // pointId -> typeId
  onClassificationsChange: (classifications: Record<string, string>) => void;
}

export const PointClassificationPanel = ({
  pontos, onPontosChange, classifications, onClassificationsChange
}: PointClassificationPanelProps) => {
  const [pointTypes, setPointTypes] = useState<PointType[]>(() => {
    try { return JSON.parse(localStorage.getItem("point_types") || "null") || DEFAULT_POINT_TYPES; } catch { return DEFAULT_POINT_TYPES; }
  });
  const [showConfig, setShowConfig] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#6b7280");
  const [newShape, setNewShape] = useState<"circle" | "square" | "triangle" | "diamond">("circle");
  const [filterType, setFilterType] = useState("all");

  const saveTypes = (types: PointType[]) => {
    setPointTypes(types);
    localStorage.setItem("point_types", JSON.stringify(types));
  };

  const addType = () => {
    if (!newCode || !newLabel) { toast.error("Preencha código e nome"); return; }
    if (pointTypes.some(t => t.code === newCode)) { toast.error("Código já existe"); return; }
    const newType: PointType = { id: newCode.toLowerCase(), code: newCode, label: newLabel, color: newColor, shape: newShape, description: newLabel };
    saveTypes([...pointTypes, newType]);
    setNewCode(""); setNewLabel(""); setNewColor("#6b7280");
    toast.success(`Tipo ${newCode} adicionado`);
  };

  const removeType = (id: string) => {
    if (DEFAULT_POINT_TYPES.some(t => t.id === id)) { toast.error("Tipos padrão não podem ser removidos"); return; }
    saveTypes(pointTypes.filter(t => t.id !== id));
  };

  const classifyPoint = (pointId: string, typeId: string) => {
    const updated = { ...classifications, [pointId]: typeId };
    onClassificationsChange(updated);
  };

  const classifyAll = (typeId: string) => {
    const updated = { ...classifications };
    pontos.forEach(p => { if (!updated[p.id]) updated[p.id] = typeId; });
    onClassificationsChange(updated);
    toast.success(`Todos os pontos não classificados → ${pointTypes.find(t => t.id === typeId)?.code || typeId}`);
  };

  const getTypeForPoint = (pointId: string): PointType | undefined => {
    const typeId = classifications[pointId];
    return typeId ? pointTypes.find(t => t.id === typeId) : undefined;
  };

  const stats = pointTypes.map(type => ({
    ...type,
    count: Object.values(classifications).filter(t => t === type.id).length,
  }));

  const unclassifiedCount = pontos.length - Object.keys(classifications).filter(k => pontos.some(p => p.id === k)).length;

  const filteredPontos = filterType === "all" ? pontos :
    filterType === "unclassified" ? pontos.filter(p => !classifications[p.id]) :
    pontos.filter(p => classifications[p.id] === filterType);

  const ShapeIcon = ({ shape, color, size = 12 }: { shape: string; color: string; size?: number }) => {
    if (shape === "square") return <div style={{ width: size, height: size, backgroundColor: color, borderRadius: 2 }} />;
    if (shape === "triangle") return <div style={{ width: 0, height: 0, borderLeft: `${size/2}px solid transparent`, borderRight: `${size/2}px solid transparent`, borderBottom: `${size}px solid ${color}` }} />;
    if (shape === "diamond") return <div style={{ width: size, height: size, backgroundColor: color, transform: "rotate(45deg)", borderRadius: 2 }} />;
    return <div style={{ width: size, height: size, backgroundColor: color, borderRadius: "50%" }} />;
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2"><Tag className="h-4 w-4" /> Classificação de Pontos</span>
            <Button size="sm" variant="outline" onClick={() => setShowConfig(true)}><Settings2 className="h-3 w-3 mr-1" /> Configurar Tipos</Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            {stats.filter(s => s.count > 0).map(s => (
              <Badge key={s.id} variant="outline" className="flex items-center gap-1 cursor-pointer" onClick={() => setFilterType(s.id)}>
                <ShapeIcon shape={s.shape} color={s.color} size={8} />
                {s.code}: {s.count}
              </Badge>
            ))}
            {unclassifiedCount > 0 && (
              <Badge variant="outline" className="text-muted-foreground cursor-pointer" onClick={() => setFilterType("unclassified")}>
                Sem tipo: {unclassifiedCount}
              </Badge>
            )}
            <Badge variant="outline" className="cursor-pointer" onClick={() => setFilterType("all")}>
              Total: {pontos.length}
            </Badge>
          </div>

          {/* Quick classify all */}
          {unclassifiedCount > 0 && (
            <div className="flex items-center gap-2 mb-3 bg-muted/50 p-2">
              <span className="text-xs text-muted-foreground">Classificar todos sem tipo como:</span>
              <Select onValueChange={classifyAll}>
                <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {pointTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-1">
                        <ShapeIcon shape={t.shape} color={t.color} size={8} />
                        {t.code} — {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Points table */}
          {filteredPontos.length > 0 && (
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Cota (m)</TableHead>
                  <TableHead>Tipo Atual</TableHead>
                  <TableHead className="w-48">Classificar</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredPontos.slice(0, 100).map(p => {
                    const type = getTypeForPoint(p.id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-xs">{p.id}</TableCell>
                        <TableCell className="text-xs">{p.cota.toFixed(3)}</TableCell>
                        <TableCell>
                          {type ? (
                            <Badge variant="outline" className="text-xs flex items-center gap-1 w-fit">
                              <ShapeIcon shape={type.shape} color={type.color} size={8} />
                              {type.code}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select value={classifications[p.id] || ""} onValueChange={v => classifyPoint(p.id, v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                            <SelectContent>
                              {pointTypes.map(t => (
                                <SelectItem key={t.id} value={t.id}>
                                  <span className="flex items-center gap-1">
                                    <ShapeIcon shape={t.shape} color={t.color} size={8} />
                                    {t.code} — {t.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filteredPontos.length > 100 && (
                <p className="text-xs text-muted-foreground text-center mt-2">Mostrando 100 de {filteredPontos.length} pontos</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Config dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Configurar Tipos de Pontos</DialogTitle>
            <DialogDescription>Defina os tipos de pontos disponíveis com códigos, cores e formas</DialogDescription>
          </DialogHeader>

          <div className="max-h-[300px] overflow-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Forma</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {pointTypes.map(t => (
                  <TableRow key={t.id}>
                    <TableCell><ShapeIcon shape={t.shape} color={t.color} /></TableCell>
                    <TableCell className="font-mono text-xs font-bold">{t.code}</TableCell>
                    <TableCell className="text-xs">{t.label}</TableCell>
                    <TableCell><div className="w-5 h-5 rounded" style={{ backgroundColor: t.color }} /></TableCell>
                    <TableCell>
                      {!DEFAULT_POINT_TYPES.some(d => d.id === t.id) && (
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeType(t.id)}><Trash2 className="h-3 w-3" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold">Adicionar novo tipo:</p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Código</Label>
                <Input className="h-8 text-xs" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} placeholder="EX" maxLength={5} />
              </div>
              <div className="flex-1">
                <Label className="text-xs">Nome</Label>
                <Input className="h-8 text-xs" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nome do tipo" />
              </div>
              <div>
                <Label className="text-xs">Cor</Label>
                <Input type="color" className="h-8 w-12 p-0 border-0" value={newColor} onChange={e => setNewColor(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Forma</Label>
                <Select value={newShape} onValueChange={v => setNewShape(v as any)}>
                  <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="circle">Círculo</SelectItem>
                    <SelectItem value="square">Quadrado</SelectItem>
                    <SelectItem value="triangle">Triângulo</SelectItem>
                    <SelectItem value="diamond">Losango</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={addType}><Plus className="h-3 w-3" /></Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { saveTypes(DEFAULT_POINT_TYPES); toast.success("Tipos restaurados para padrão"); }}>Restaurar Padrão</Button>
            <Button onClick={() => setShowConfig(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
