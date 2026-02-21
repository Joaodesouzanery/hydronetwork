/**
 * CoordinateTransformDialog — Post-import coordinate correction tool.
 * Supports:
 * 1. Reprojection (change CRS)
 * 2. Manual offset (drag all points by deltaX/deltaY)
 * 3. Quick correction (click wrong → click correct → apply to all)
 * 4. Two-point correction (more precise)
 */
import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  RefreshCw, Move, Target, ArrowRight, Check, AlertTriangle, Crosshair, MousePointerClick,
} from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";
import {
  ImportCRSConfig, DatumType, CoordinateSystemType,
  BRAZIL_UTM_ZONES, DATUMS,
  transformCoordinate, calculateOffset, applyOffset,
  calculateTwoPointOffset, getCRSLabel,
} from "@/engine/coordinateTransform";

interface CoordinateTransformDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onTransform: (pontos: PontoTopografico[], trechos: Trecho[]) => void;
}

export const CoordinateTransformDialog: React.FC<CoordinateTransformDialogProps> = ({
  open,
  onOpenChange,
  pontos,
  trechos,
  onTransform,
}) => {
  const [activeTab, setActiveTab] = useState("reproject");

  // ── Reprojection state ──
  const [sourceCRS, setSourceCRS] = useState<ImportCRSConfig>({ type: "utm", datum: "SIRGAS2000", utmZone: 23, hemisphere: "S" });
  const [targetCRS, setTargetCRS] = useState<ImportCRSConfig>({ type: "utm", datum: "SIRGAS2000", utmZone: 22, hemisphere: "S" });

  // ── Offset state ──
  const [deltaX, setDeltaX] = useState(0);
  const [deltaY, setDeltaY] = useState(0);

  // ── Quick correction state ──
  const [wrongX, setWrongX] = useState(0);
  const [wrongY, setWrongY] = useState(0);
  const [correctX, setCorrectX] = useState(0);
  const [correctY, setCorrectY] = useState(0);

  // ── Two-point state ──
  const [wrong1X, setWrong1X] = useState(0);
  const [wrong1Y, setWrong1Y] = useState(0);
  const [correct1X, setCorrect1X] = useState(0);
  const [correct1Y, setCorrect1Y] = useState(0);
  const [wrong2X, setWrong2X] = useState(0);
  const [wrong2Y, setWrong2Y] = useState(0);
  const [correct2X, setCorrect2X] = useState(0);
  const [correct2Y, setCorrect2Y] = useState(0);

  // Preview computation
  const [previewDelta, setPreviewDelta] = useState<{ dx: number; dy: number } | null>(null);

  // ── Apply Reprojection ──
  const handleReproject = useCallback(() => {
    const newPontos = pontos.map(p => {
      const result = transformCoordinate(p.x, p.y, p.cota, sourceCRS, targetCRS);
      return { ...p, x: result.x, y: result.y, cota: result.z };
    });
    const newTrechos = trechos.map(t => {
      const startResult = transformCoordinate(t.pontoInicio.x, t.pontoInicio.y, t.pontoInicio.cota, sourceCRS, targetCRS);
      const endResult = transformCoordinate(t.pontoFim.x, t.pontoFim.y, t.pontoFim.cota, sourceCRS, targetCRS);
      return {
        ...t,
        pontoInicio: { ...t.pontoInicio, x: startResult.x, y: startResult.y, cota: startResult.z },
        pontoFim: { ...t.pontoFim, x: endResult.x, y: endResult.y, cota: endResult.z },
      };
    });
    onTransform(newPontos, newTrechos);
    onOpenChange(false);
  }, [pontos, trechos, sourceCRS, targetCRS, onTransform, onOpenChange]);

  // ── Apply Manual Offset ──
  const handleApplyOffset = useCallback(() => {
    const newPontos = pontos.map(p => ({
      ...p,
      x: p.x + deltaX,
      y: p.y + deltaY,
    }));
    const newTrechos = trechos.map(t => ({
      ...t,
      pontoInicio: { ...t.pontoInicio, x: t.pontoInicio.x + deltaX, y: t.pontoInicio.y + deltaY },
      pontoFim: { ...t.pontoFim, x: t.pontoFim.x + deltaX, y: t.pontoFim.y + deltaY },
    }));
    onTransform(newPontos, newTrechos);
    onOpenChange(false);
  }, [pontos, trechos, deltaX, deltaY, onTransform, onOpenChange]);

  // ── Apply Quick Correction ──
  const handleQuickCorrection = useCallback(() => {
    const offset = calculateOffset(
      { x: wrongX, y: wrongY },
      { x: correctX, y: correctY }
    );
    const newPontos = pontos.map(p => ({
      ...p,
      x: p.x + offset.deltaX,
      y: p.y + offset.deltaY,
    }));
    const newTrechos = trechos.map(t => ({
      ...t,
      pontoInicio: { ...t.pontoInicio, x: t.pontoInicio.x + offset.deltaX, y: t.pontoInicio.y + offset.deltaY },
      pontoFim: { ...t.pontoFim, x: t.pontoFim.x + offset.deltaX, y: t.pontoFim.y + offset.deltaY },
    }));
    onTransform(newPontos, newTrechos);
    onOpenChange(false);
  }, [pontos, trechos, wrongX, wrongY, correctX, correctY, onTransform, onOpenChange]);

  // ── Apply Two-Point Correction ──
  const handleTwoPointCorrection = useCallback(() => {
    const offset = calculateTwoPointOffset(
      { x: wrong1X, y: wrong1Y },
      { x: correct1X, y: correct1Y },
      { x: wrong2X, y: wrong2Y },
      { x: correct2X, y: correct2Y }
    );
    const newPontos = pontos.map(p => ({
      ...p,
      x: p.x + offset.deltaX,
      y: p.y + offset.deltaY,
    }));
    const newTrechos = trechos.map(t => ({
      ...t,
      pontoInicio: { ...t.pontoInicio, x: t.pontoInicio.x + offset.deltaX, y: t.pontoInicio.y + offset.deltaY },
      pontoFim: { ...t.pontoFim, x: t.pontoFim.x + offset.deltaX, y: t.pontoFim.y + offset.deltaY },
    }));
    onTransform(newPontos, newTrechos);
    onOpenChange(false);
  }, [pontos, trechos, wrong1X, wrong1Y, correct1X, correct1Y, wrong2X, wrong2Y, correct2X, correct2Y, onTransform, onOpenChange]);

  // Use first point as reference for quick correction
  const useFirstPointAsWrong = () => {
    if (pontos.length > 0) {
      setWrongX(pontos[0].x);
      setWrongY(pontos[0].y);
    }
  };

  const CRSConfigWidget = ({
    config,
    onChange,
    label,
  }: {
    config: ImportCRSConfig;
    onChange: (c: ImportCRSConfig) => void;
    label: string;
  }) => (
    <div className="space-y-2 border border-border rounded-lg p-3">
      <Label className="text-xs font-semibold">{label}</Label>
      <RadioGroup
        value={config.type}
        onValueChange={(v) => onChange({ ...config, type: v as CoordinateSystemType })}
        className="flex gap-3"
      >
        <div className="flex items-center gap-1">
          <RadioGroupItem value="geographic" id={`${label}-geo`} />
          <Label htmlFor={`${label}-geo`} className="text-xs cursor-pointer">Geográfico</Label>
        </div>
        <div className="flex items-center gap-1">
          <RadioGroupItem value="utm" id={`${label}-utm`} />
          <Label htmlFor={`${label}-utm`} className="text-xs cursor-pointer">UTM</Label>
        </div>
      </RadioGroup>

      <Select value={config.datum} onValueChange={(v) => onChange({ ...config, datum: v as DatumType })}>
        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="SIRGAS2000">SIRGAS 2000</SelectItem>
          <SelectItem value="WGS84">WGS 84</SelectItem>
          <SelectItem value="SAD69">SAD 69</SelectItem>
        </SelectContent>
      </Select>

      {config.type === "utm" && (
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={String(config.utmZone || 23)}
            onValueChange={(v) => onChange({ ...config, utmZone: parseInt(v) })}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BRAZIL_UTM_ZONES.map(z => (
                <SelectItem key={z.zone} value={String(z.zone)}>{z.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={config.hemisphere || "S"}
            onValueChange={(v) => onChange({ ...config, hemisphere: v as "N" | "S" })}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="S">Sul</SelectItem>
              <SelectItem value="N">Norte</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-5 w-5" />
            Transformar Coordenadas
          </DialogTitle>
          <DialogDescription className="text-xs">
            Corrija o CRS ou ajuste a posição de {pontos.length} pontos e {trechos.length} trechos.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 h-8">
            <TabsTrigger value="reproject" className="text-xs px-1">Reprojetar</TabsTrigger>
            <TabsTrigger value="offset" className="text-xs px-1">Offset</TabsTrigger>
            <TabsTrigger value="quick" className="text-xs px-1">Rápido</TabsTrigger>
            <TabsTrigger value="twopoint" className="text-xs px-1">2 Pontos</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Reprojection ── */}
          <TabsContent value="reproject" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Converta todos os pontos de um CRS para outro automaticamente.
            </p>

            <CRSConfigWidget
              config={sourceCRS}
              onChange={setSourceCRS}
              label="CRS Atual (origem)"
            />

            <div className="flex justify-center">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>

            <CRSConfigWidget
              config={targetCRS}
              onChange={setTargetCRS}
              label="CRS Correto (destino)"
            />

            <Button className="w-full" size="sm" onClick={handleReproject}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reprojetar Tudo ({pontos.length} pontos)
            </Button>
          </TabsContent>

          {/* ── Tab 2: Manual Offset ── */}
          <TabsContent value="offset" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Aplique um deslocamento fixo (deltaX, deltaY) em todos os pontos.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Delta X (metros)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={deltaX}
                  onChange={(e) => setDeltaX(parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Delta Y (metros)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={deltaY}
                  onChange={(e) => setDeltaY(parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {(deltaX !== 0 || deltaY !== 0) && (
              <Alert className="py-2">
                <AlertDescription className="text-xs">
                  Deslocamento: X{deltaX >= 0 ? "+" : ""}{deltaX.toFixed(2)}m, Y{deltaY >= 0 ? "+" : ""}{deltaY.toFixed(2)}m
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full"
              size="sm"
              onClick={handleApplyOffset}
              disabled={deltaX === 0 && deltaY === 0}
            >
              <Move className="h-4 w-4 mr-2" />
              Aplicar Offset ({pontos.length} pontos)
            </Button>
          </TabsContent>

          {/* ── Tab 3: Quick Correction ── */}
          <TabsContent value="quick" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Marque onde um ponto está (errado) e onde deveria estar (correto).
              O sistema calcula o deslocamento e aplica a todos.
            </p>

            <div className="space-y-2 border border-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-red-500">Posição Errada</Label>
                {pontos.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={useFirstPointAsWrong}
                  >
                    <Crosshair className="h-3 w-3 mr-1" />
                    Usar 1° ponto
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">X</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={wrongX}
                    onChange={(e) => setWrongX(parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Y</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={wrongY}
                    onChange={(e) => setWrongY(parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 border border-border rounded-lg p-3">
              <Label className="text-xs font-semibold text-green-500">Posição Correta</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">X</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={correctX}
                    onChange={(e) => setCorrectX(parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Y</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={correctY}
                    onChange={(e) => setCorrectY(parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>

            {(wrongX !== 0 || wrongY !== 0) && (correctX !== 0 || correctY !== 0) && (
              <Alert className="py-2">
                <AlertDescription className="text-xs">
                  Deslocamento calculado: dX={((correctX - wrongX)).toFixed(2)}m, dY={((correctY - wrongY)).toFixed(2)}m
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full"
              size="sm"
              onClick={handleQuickCorrection}
              disabled={(wrongX === 0 && wrongY === 0) || (correctX === 0 && correctY === 0)}
            >
              <Target className="h-4 w-4 mr-2" />
              Corrigir Deslocamento ({pontos.length} pontos)
            </Button>
          </TabsContent>

          {/* ── Tab 4: Two-Point Correction ── */}
          <TabsContent value="twopoint" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Use 2 pontos de referência para uma correção mais precisa.
            </p>

            <div className="space-y-2 border border-border rounded-lg p-3">
              <Label className="text-xs font-semibold">Ponto A</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-red-500">Errado X</Label>
                  <Input type="number" step="0.01" value={wrong1X} onChange={(e) => setWrong1X(parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-red-500">Errado Y</Label>
                  <Input type="number" step="0.01" value={wrong1Y} onChange={(e) => setWrong1Y(parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-green-500">Correto X</Label>
                  <Input type="number" step="0.01" value={correct1X} onChange={(e) => setCorrect1X(parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-green-500">Correto Y</Label>
                  <Input type="number" step="0.01" value={correct1Y} onChange={(e) => setCorrect1Y(parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                </div>
              </div>
            </div>

            <div className="space-y-2 border border-border rounded-lg p-3">
              <Label className="text-xs font-semibold">Ponto B</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-red-500">Errado X</Label>
                  <Input type="number" step="0.01" value={wrong2X} onChange={(e) => setWrong2X(parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-red-500">Errado Y</Label>
                  <Input type="number" step="0.01" value={wrong2Y} onChange={(e) => setWrong2Y(parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-green-500">Correto X</Label>
                  <Input type="number" step="0.01" value={correct2X} onChange={(e) => setCorrect2X(parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-green-500">Correto Y</Label>
                  <Input type="number" step="0.01" value={correct2Y} onChange={(e) => setCorrect2Y(parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                </div>
              </div>
            </div>

            <Button
              className="w-full"
              size="sm"
              onClick={handleTwoPointCorrection}
            >
              <MousePointerClick className="h-4 w-4 mr-2" />
              Corrigir por 2 Pontos ({pontos.length} pontos)
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CoordinateTransformDialog;
