import { useState, useMemo } from "react";
import { Calculator, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FileUploadZone } from "./FileUploadZone";
import {
  parseFile, validateTopoData, validateCostData, calculateTrechos,
  DIAMETRO_OPTIONS, MATERIAL_OPTIONS, DIAMETRO_PADRAO, MATERIAL_PADRAO,
  DEFAULT_COSTS, saveProject,
  type TopoPoint, type CostEntry, type ProjectData, type ProjectConfig,
} from "./planningUtils";

interface NewProjectFormProps {
  onComplete: (project: ProjectData) => void;
  onCancel: () => void;
}

export function NewProjectForm({ onComplete, onCancel }: NewProjectFormProps) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [diametro, setDiametro] = useState(DIAMETRO_PADRAO);
  const [material, setMaterial] = useState(MATERIAL_PADRAO);
  const [declivMin, setDeclivMin] = useState(0.5);
  const [incluirCoord, setIncluirCoord] = useState(false);

  const [topoFile, setTopoFile] = useState<File | null>(null);
  const [topoData, setTopoData] = useState<Record<string, unknown>[]>([]);
  const [topoPoints, setTopoPoints] = useState<TopoPoint[]>([]);
  const [topoErrors, setTopoErrors] = useState<string[]>([]);

  const [costFile, setCostFile] = useState<File | null>(null);
  const [costData, setCostData] = useState<Record<string, unknown>[]>([]);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [costErrors, setCostErrors] = useState<string[]>([]);
  const [usingDefault, setUsingDefault] = useState(false);

  const [processing, setProcessing] = useState(false);

  const handleTopoFile = async (file: File | null) => {
    if (!file) {
      setTopoFile(null); setTopoData([]); setTopoPoints([]); setTopoErrors([]);
      return;
    }
    if (file.size > 10 * 1024 * 1024) { setTopoErrors(["Arquivo excede 10MB"]); return; }
    try {
      const data = await parseFile(file);
      const result = validateTopoData(data);
      setTopoFile(file);
      setTopoData(data);
      setTopoPoints(result.points);
      setTopoErrors(result.errors);
    } catch (e: any) {
      setTopoErrors([e.message || "Erro ao processar arquivo"]);
    }
  };

  const handleCostFile = async (file: File | null) => {
    if (!file) {
      setCostFile(null); setCostData([]); setCosts([]); setCostErrors([]); setUsingDefault(false);
      return;
    }
    if (file.size > 10 * 1024 * 1024) { setCostErrors(["Arquivo excede 10MB"]); return; }
    try {
      const data = await parseFile(file);
      const result = validateCostData(data);
      setCostFile(file);
      setCostData(data);
      setCosts(result.costs);
      setCostErrors(result.errors);
      setUsingDefault(false);
    } catch (e: any) {
      setCostErrors([e.message || "Erro ao processar arquivo"]);
    }
  };

  const handleUseSINAPI = () => {
    setCosts(DEFAULT_COSTS);
    setCostData(DEFAULT_COSTS as any);
    setCostFile(new File([""], "base_sinapi_padrao.csv"));
    setCostErrors([]);
    setUsingDefault(true);
    toast.success("Base de custos SINAPI padrão carregada");
  };

  const canProcess = useMemo(() =>
    nome.trim() && topoPoints.length >= 2 && topoErrors.length === 0 && costs.length > 0 && costErrors.length === 0,
    [nome, topoPoints, topoErrors, costs, costErrors]
  );

  const handleProcess = () => {
    if (!canProcess) return;
    setProcessing(true);

    setTimeout(() => {
      try {
        const config: ProjectConfig = {
          nome, descricao, responsavel,
          data: new Date().toISOString(),
          diametro, material,
          declividade_minima: declivMin / 100,
          incluir_coordenadas: incluirCoord,
        };

        const trechos = calculateTrechos(topoPoints, costs, {
          diametro, material, declividade_minima: declivMin / 100,
        });

        const project: ProjectData = {
          config,
          pontos: topoPoints,
          custos: costs,
          trechos,
          createdAt: new Date().toISOString(),
        };

        saveProject(project);
        toast.success(`Rede processada: ${trechos.length} trechos calculados`);
        onComplete(project);
      } catch (e: any) {
        toast.error(e.message || "Erro ao processar");
      } finally {
        setProcessing(false);
      }
    }, 500);
  };

  const handleClear = () => {
    setNome(""); setDescricao(""); setResponsavel("");
    setDiametro(DIAMETRO_PADRAO); setMaterial(MATERIAL_PADRAO); setDeclivMin(0.5);
    setTopoFile(null); setTopoData([]); setTopoPoints([]); setTopoErrors([]);
    setCostFile(null); setCostData([]); setCosts([]); setCostErrors([]); setUsingDefault(false);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Info do Projeto */}
      <Card>
        <CardHeader><CardTitle className="text-base">Informações do Projeto</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Nome do Projeto *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Rede Coletora Bairro Norte" />
          </div>
          <div>
            <Label>Responsável Técnico</Label>
            <Input value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome do responsável" />
          </div>
          <div>
            <Label>Data</Label>
            <Input value={new Date().toLocaleDateString('pt-BR')} disabled />
          </div>
          <div className="md:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição do projeto..." rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Topografia */}
      <Card>
        <CardHeader><CardTitle className="text-base">Upload de Topografia</CardTitle></CardHeader>
        <CardContent>
          <FileUploadZone
            label="Arquivo de Topografia"
            accept=".csv,.xlsx,.xls"
            file={topoFile}
            onFileChange={handleTopoFile}
            preview={topoData}
            errors={topoErrors}
            validCount={topoPoints.length}
          />
        </CardContent>
      </Card>

      {/* Base de Custos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Base de Custos</CardTitle>
            <Button variant="outline" size="sm" onClick={handleUseSINAPI} disabled={usingDefault}>
              Usar Base Padrão SINAPI
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <FileUploadZone
            label="Arquivo de Base de Custos"
            accept=".csv,.xlsx,.xls"
            file={costFile}
            onFileChange={handleCostFile}
            preview={costData}
            errors={costErrors}
            validCount={costs.length}
          />
        </CardContent>
      </Card>

      {/* Configurações de Engenharia */}
      <Card>
        <CardHeader><CardTitle className="text-base">Configurações de Engenharia</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label>Diâmetro Padrão (mm)</Label>
            <Select value={String(diametro)} onValueChange={v => setDiametro(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIAMETRO_OPTIONS.map(d => <SelectItem key={d} value={String(d)}>{d} mm</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Material</Label>
            <Select value={material} onValueChange={setMaterial}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MATERIAL_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Declividade Mínima (%)</Label>
            <Input type="number" step="0.1" min="0" value={declivMin} onChange={e => setDeclivMin(Number(e.target.value))} />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-2">
              <Checkbox id="coord" checked={incluirCoord} onCheckedChange={(v) => setIncluirCoord(!!v)} />
              <Label htmlFor="coord" className="text-sm cursor-pointer">Incluir coordenadas no relatório</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex gap-3 flex-wrap">
        <Button size="lg" disabled={!canProcess || processing} onClick={handleProcess}>
          {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
          Processar Rede
        </Button>
        <Button variant="outline" size="lg" onClick={handleClear}>
          <Trash2 className="h-4 w-4 mr-2" /> Limpar Tudo
        </Button>
        <Button variant="ghost" size="lg" onClick={onCancel}>Voltar</Button>
      </div>
    </div>
  );
}
