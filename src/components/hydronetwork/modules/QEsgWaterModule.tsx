/**
 * QEsg/QWater Module — Frontend for sewer and water network dimensioning
 * via FastAPI backend (Manning/Hazen-Williams/Colebrook-White algorithms).
 *
 * Based on Sketua/QEsg and Sketua/QWater QGIS plugins.
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Calculator, Droplets, Waves, Settings, CheckCircle, XCircle,
  RefreshCw, Download, AlertTriangle, Zap, Server
} from "lucide-react";
import { PontoTopografico } from "@/engine/reader";
import { Trecho } from "@/engine/domain";

interface QEsgWaterModuleProps {
  pontos: PontoTopografico[];
  trechos: Trecho[];
  onTrechosChange?: (t: Trecho[]) => void;
}

// Types matching backend schemas
interface SewerResult {
  id: string;
  diametro_mm: number;
  declividade_min: number;
  velocidade_ms: number;
  lamina_dagua: number;
  tensao_trativa: number;
  atende_norma: boolean;
  observacoes: string[];
}

interface WaterResult {
  id: string;
  diametro_mm: number;
  velocidade_ms: number;
  perda_carga_m: number;
  perda_carga_unitaria: number;
  pressao_jusante: number | null;
  atende_norma: boolean;
  observacoes: string[];
}

const DEFAULT_API_URL = "http://localhost:8000";

export const QEsgWaterModule = ({ pontos, trechos, onTrechosChange }: QEsgWaterModuleProps) => {
  const [activeTab, setActiveTab] = useState<"qesg" | "qwater">("qesg");
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  // QEsg parameters
  const [sewerResults, setSewerResults] = useState<SewerResult[]>([]);
  const [manning, setManning] = useState(0.013);
  const [laminaMax, setLaminaMax] = useState(0.75);
  const [velMinEsg, setVelMinEsg] = useState(0.6);
  const [velMaxEsg, setVelMaxEsg] = useState(5.0);
  const [tensaoMin, setTensaoMin] = useState(1.0);
  const [diamMinEsg, setDiamMinEsg] = useState(100);

  // QWater parameters
  const [waterResults, setWaterResults] = useState<WaterResult[]>([]);
  const [formula, setFormula] = useState<"hazen-williams" | "colebrook">("hazen-williams");
  const [coefHW, setCoefHW] = useState(140);
  const [velMinAgua, setVelMinAgua] = useState(0.6);
  const [velMaxAgua, setVelMaxAgua] = useState(3.5);
  const [pressaoMin, setPressaoMin] = useState(10.0);
  const [pressaoMax, setPressaoMax] = useState(50.0);
  const [diamMinAgua, setDiamMinAgua] = useState(50);

  // Filter trechos by type
  const sewerTrechos = useMemo(() =>
    trechos.filter(t => t.tipoRede === "esgoto" || t.tipoRede === "outro"),
    [trechos]
  );
  const waterTrechos = useMemo(() =>
    trechos.filter(t => t.tipoRede === "agua" || t.tipoRede === "outro"),
    [trechos]
  );

  // Test connection
  const testConnection = async () => {
    try {
      const res = await fetch(`${apiUrl}/health`);
      if (res.ok) {
        setConnected(true);
        toast.success("Conectado ao backend HydroNetwork API");
      } else {
        setConnected(false);
        toast.error("Backend respondeu com erro");
      }
    } catch {
      setConnected(false);
      toast.error("Não foi possível conectar ao backend. Verifique se o servidor está rodando.");
    }
  };

  // Dimension sewer network
  const dimensionSewer = async () => {
    if (sewerTrechos.length === 0) {
      toast.error("Nenhum trecho de esgoto encontrado. Importe uma rede primeiro.");
      return;
    }

    setLoading(true);
    try {
      const body = {
        trechos: sewerTrechos.map(t => {
          const ptInicio = pontos.find(p => p.id === t.idInicio);
          const ptFim = pontos.find(p => p.id === t.idFim);
          return {
            id: `${t.idInicio}-${t.idFim}`,
            comprimento: t.comprimento,
            cota_montante: ptInicio?.cota ?? 0,
            cota_jusante: ptFim?.cota ?? 0,
            vazao_lps: 1.5, // Default per-capita flow
            tipo_tubo: t.material || "PVC",
          };
        }),
        coeficiente_manning: manning,
        lamina_maxima: laminaMax,
        velocidade_minima: velMinEsg,
        velocidade_maxima: velMaxEsg,
        tensao_trativa_minima: tensaoMin,
        diametro_minimo_mm: diamMinEsg,
      };

      const res = await fetch(`${apiUrl}/api/qesg/dimension`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setSewerResults(data.resultados);

      const atende = data.resumo.atendem_norma;
      const total = data.resumo.total_trechos;
      toast.success(`Dimensionamento concluído: ${atende}/${total} trechos atendem NBR 9649`);
    } catch (err: any) {
      toast.error(`Erro no dimensionamento: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Dimension water network
  const dimensionWater = async () => {
    if (waterTrechos.length === 0) {
      toast.error("Nenhum trecho de água encontrado. Importe uma rede primeiro.");
      return;
    }

    setLoading(true);
    try {
      const body = {
        trechos: waterTrechos.map(t => {
          const ptInicio = pontos.find(p => p.id === t.idInicio);
          const ptFim = pontos.find(p => p.id === t.idFim);
          return {
            id: `${t.idInicio}-${t.idFim}`,
            comprimento: t.comprimento,
            cota_montante: ptInicio?.cota ?? 0,
            cota_jusante: ptFim?.cota ?? 0,
            vazao_lps: 0.5, // Default
            material: t.material || "PVC",
          };
        }),
        formula,
        coeficiente_hw: coefHW,
        velocidade_minima: velMinAgua,
        velocidade_maxima: velMaxAgua,
        pressao_minima: pressaoMin,
        pressao_maxima: pressaoMax,
        diametro_minimo_mm: diamMinAgua,
      };

      const res = await fetch(`${apiUrl}/api/qwater/dimension`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setWaterResults(data.resultados);

      const atende = data.resumo.atendem_norma;
      const total = data.resumo.total_trechos;
      toast.success(`Dimensionamento concluído: ${atende}/${total} trechos atendem NBR 12218`);
    } catch (err: any) {
      toast.error(`Erro no dimensionamento: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Apply calculated diameters back to trechos
  const applySewerDiameters = () => {
    if (sewerResults.length === 0 || !onTrechosChange) return;
    const resultMap = new Map(sewerResults.map(r => [r.id, r.diametro_mm]));
    const updated = trechos.map(t => {
      const key = `${t.idInicio}-${t.idFim}`;
      const newDiam = resultMap.get(key);
      return newDiam ? { ...t, diametroMm: newDiam } : t;
    });
    onTrechosChange(updated);
    toast.success("Diâmetros de esgoto aplicados aos trechos");
  };

  const applyWaterDiameters = () => {
    if (waterResults.length === 0 || !onTrechosChange) return;
    const resultMap = new Map(waterResults.map(r => [r.id, r.diametro_mm]));
    const updated = trechos.map(t => {
      const key = `${t.idInicio}-${t.idFim}`;
      const newDiam = resultMap.get(key);
      return newDiam ? { ...t, diametroMm: newDiam } : t;
    });
    onTrechosChange(updated);
    toast.success("Diâmetros de água aplicados aos trechos");
  };

  return (
    <div className="space-y-4">
      {/* Connection Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-5 w-5" />
            QEsg / QWater — Dimensionamento Hidráulico
          </CardTitle>
          <CardDescription>
            Dimensionamento de redes de esgoto (Manning/NBR 9649) e água (Hazen-Williams/NBR 12218)
            via backend FastAPI. Baseado nos plugins QEsg e QWater do QGIS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Label className="whitespace-nowrap">API URL:</Label>
            <Input
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              placeholder="http://localhost:8000"
              className="max-w-sm"
            />
            <Button onClick={testConnection} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" /> Testar
            </Button>
            {connected === true && <Badge className="bg-green-500">Conectado</Badge>}
            {connected === false && <Badge variant="destructive">Desconectado</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Inicie o backend: <code>cd backend && pip install -r requirements.txt && uvicorn main:app --reload</code>
          </p>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="qesg" className="flex items-center gap-1">
            <Waves className="h-4 w-4" /> QEsg — Esgoto
          </TabsTrigger>
          <TabsTrigger value="qwater" className="flex items-center gap-1">
            <Droplets className="h-4 w-4" /> QWater — Água
          </TabsTrigger>
        </TabsList>

        {/* QEsg Tab */}
        <TabsContent value="qesg">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Waves className="h-5 w-5 text-amber-600" />
                Dimensionamento de Rede de Esgoto (NBR 9649)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Parameters */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <div>
                  <Label className="text-xs">Manning (n)</Label>
                  <Input type="number" step="0.001" value={manning} onChange={e => setManning(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">y/D máx</Label>
                  <Input type="number" step="0.05" value={laminaMax} onChange={e => setLaminaMax(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">V mín (m/s)</Label>
                  <Input type="number" step="0.1" value={velMinEsg} onChange={e => setVelMinEsg(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">V máx (m/s)</Label>
                  <Input type="number" step="0.1" value={velMaxEsg} onChange={e => setVelMaxEsg(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Tensão mín (Pa)</Label>
                  <Input type="number" step="0.1" value={tensaoMin} onChange={e => setTensaoMin(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">DN mín (mm)</Label>
                  <Input type="number" step="50" value={diamMinEsg} onChange={e => setDiamMinEsg(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={dimensionSewer} disabled={loading || sewerTrechos.length === 0}>
                  <Calculator className="h-4 w-4 mr-1" />
                  {loading ? "Calculando..." : `Dimensionar (${sewerTrechos.length} trechos)`}
                </Button>
                {sewerResults.length > 0 && (
                  <Button variant="outline" onClick={applySewerDiameters}>
                    <Zap className="h-4 w-4 mr-1" /> Aplicar Diâmetros
                  </Button>
                )}
              </div>

              {/* Results */}
              {sewerResults.length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trecho</TableHead>
                        <TableHead>DN (mm)</TableHead>
                        <TableHead>V (m/s)</TableHead>
                        <TableHead>y/D</TableHead>
                        <TableHead>Tensão (Pa)</TableHead>
                        <TableHead>Decliv. (m/m)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sewerResults.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.id}</TableCell>
                          <TableCell>{r.diametro_mm}</TableCell>
                          <TableCell>{r.velocidade_ms.toFixed(2)}</TableCell>
                          <TableCell>{r.lamina_dagua.toFixed(3)}</TableCell>
                          <TableCell>{r.tensao_trativa.toFixed(2)}</TableCell>
                          <TableCell>{r.declividade_min.toFixed(4)}</TableCell>
                          <TableCell>
                            {r.atende_norma ? (
                              <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> OK</Badge>
                            ) : (
                              <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Não atende</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* QWater Tab */}
        <TabsContent value="qwater">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Droplets className="h-5 w-5 text-blue-600" />
                Dimensionamento de Rede de Água (NBR 12218)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Parameters */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <div>
                  <Label className="text-xs">Fórmula</Label>
                  <Select value={formula} onValueChange={v => setFormula(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hazen-williams">Hazen-Williams</SelectItem>
                      <SelectItem value="colebrook">Colebrook-White</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">C (H-W)</Label>
                  <Input type="number" step="5" value={coefHW} onChange={e => setCoefHW(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">V mín (m/s)</Label>
                  <Input type="number" step="0.1" value={velMinAgua} onChange={e => setVelMinAgua(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">V máx (m/s)</Label>
                  <Input type="number" step="0.1" value={velMaxAgua} onChange={e => setVelMaxAgua(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">P mín (mca)</Label>
                  <Input type="number" step="1" value={pressaoMin} onChange={e => setPressaoMin(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">DN mín (mm)</Label>
                  <Input type="number" step="25" value={diamMinAgua} onChange={e => setDiamMinAgua(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={dimensionWater} disabled={loading || waterTrechos.length === 0}>
                  <Calculator className="h-4 w-4 mr-1" />
                  {loading ? "Calculando..." : `Dimensionar (${waterTrechos.length} trechos)`}
                </Button>
                {waterResults.length > 0 && (
                  <Button variant="outline" onClick={applyWaterDiameters}>
                    <Zap className="h-4 w-4 mr-1" /> Aplicar Diâmetros
                  </Button>
                )}
              </div>

              {/* Results */}
              {waterResults.length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trecho</TableHead>
                        <TableHead>DN (mm)</TableHead>
                        <TableHead>V (m/s)</TableHead>
                        <TableHead>hf (m)</TableHead>
                        <TableHead>J (m/m)</TableHead>
                        <TableHead>P jus (mca)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waterResults.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.id}</TableCell>
                          <TableCell>{r.diametro_mm}</TableCell>
                          <TableCell>{r.velocidade_ms.toFixed(2)}</TableCell>
                          <TableCell>{r.perda_carga_m.toFixed(3)}</TableCell>
                          <TableCell>{r.perda_carga_unitaria.toFixed(5)}</TableCell>
                          <TableCell>{r.pressao_jusante?.toFixed(1) ?? "—"}</TableCell>
                          <TableCell>
                            {r.atende_norma ? (
                              <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> OK</Badge>
                            ) : (
                              <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Não atende</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
