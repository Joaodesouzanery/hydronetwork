/**
 * CAESBPreProjectModule — CAESB Pre-Project Kanban Workflow
 *
 * Provides a Kanban board for managing CAESB pre-project requests through
 * four workflow stages: Pedido Inicial -> Formulario -> Demanda Gerada -> Aprovado
 *
 * Features:
 * - Kanban board with 4 columns and color-coded cards
 * - Pre-project card creation with detailed form
 * - Click-to-move cards between stages
 * - Technical data form for the Formulario stage
 * - Automatic demand number generation (CAESB-2026-XXXX)
 * - Printable demand summary export
 * - Statistics bar with counts per column
 * - Fully responsive layout (mobile-first)
 *
 * References: CAESB NTS 181-183, NBR 12211, NBR 12218
 */

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  ArrowRight,
  ChevronRight,
  Droplets,
  Waves,
  CloudRain,
  MapPin,
  User,
  Calendar,
  FileText,
  Printer,
  ClipboardList,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Eye,
  X,
  Hash,
  Ruler,
  Users,
  Gauge,
  CircleDot,
  StickyNote,
  Download,
  KanbanSquare,
} from "lucide-react";

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════

type KanbanStage = "pedido_inicial" | "formulario" | "demanda_gerada" | "aprovado";
type NetworkType = "agua" | "esgoto" | "drenagem";
type Priority = "alta" | "media" | "baixa";

interface TechnicalData {
  population: string;
  flowRate: string;
  pipeDiameter: string;
  pipeLength: string;
  pipeMaterial: string;
  velocity: string;
  pressureMin: string;
  pressureMax: string;
  coverDepth: string;
  slope: string;
  demandPerCapita: string;
  soilType: string;
}

interface DocumentCheckItem {
  id: string;
  label: string;
  checked: boolean;
  required: boolean;
}

interface PreProjectCard {
  id: string;
  projectName: string;
  client: string;
  location: string;
  networkType: NetworkType;
  description: string;
  priority: Priority;
  estimatedExtension: string;
  responsible: string;
  stage: KanbanStage;
  createdAt: string;
  updatedAt: string;
  demandNumber: string | null;
  technicalData: TechnicalData;
  documents: DocumentCheckItem[];
  observations: string;
}

// ══════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════

const STAGE_CONFIG: Record<
  KanbanStage,
  { label: string; color: string; bgColor: string; borderColor: string; badgeClass: string }
> = {
  pedido_inicial: {
    label: "Pedido Inicial",
    color: "text-blue-700",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-300 dark:border-blue-700",
    badgeClass: "bg-blue-600 text-white",
  },
  formulario: {
    label: "Formulario",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
    borderColor: "border-yellow-300 dark:border-yellow-700",
    badgeClass: "bg-yellow-500 text-black",
  },
  demanda_gerada: {
    label: "Demanda Gerada",
    color: "text-orange-700",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-300 dark:border-orange-700",
    badgeClass: "bg-orange-500 text-white",
  },
  aprovado: {
    label: "Aprovado",
    color: "text-green-700",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-300 dark:border-green-700",
    badgeClass: "bg-green-600 text-white",
  },
};

const STAGE_ORDER: KanbanStage[] = ["pedido_inicial", "formulario", "demanda_gerada", "aprovado"];

const NETWORK_TYPE_CONFIG: Record<NetworkType, { label: string; icon: React.ReactNode; badgeClass: string }> = {
  agua: { label: "Agua", icon: <Droplets className="w-3 h-3" />, badgeClass: "bg-blue-500 text-white" },
  esgoto: { label: "Esgoto", icon: <Waves className="w-3 h-3" />, badgeClass: "bg-amber-700 text-white" },
  drenagem: { label: "Drenagem", icon: <CloudRain className="w-3 h-3" />, badgeClass: "bg-cyan-600 text-white" },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; badgeClass: string }> = {
  alta: { label: "Alta", badgeClass: "bg-red-600 text-white" },
  media: { label: "Media", badgeClass: "bg-yellow-500 text-black" },
  baixa: { label: "Baixa", badgeClass: "bg-gray-400 text-white" },
};

const REGIOES_ADMINISTRATIVAS = [
  "Plano Piloto (RA I)",
  "Gama (RA II)",
  "Taguatinga (RA III)",
  "Brazlandia (RA IV)",
  "Sobradinho (RA V)",
  "Planaltina (RA VI)",
  "Paranoa (RA VII)",
  "Nucleo Bandeirante (RA VIII)",
  "Ceilandia (RA IX)",
  "Guara (RA X)",
  "Cruzeiro (RA XI)",
  "Samambaia (RA XII)",
  "Santa Maria (RA XIII)",
  "Sao Sebastiao (RA XIV)",
  "Recanto das Emas (RA XV)",
  "Lago Sul (RA XVI)",
  "Riacho Fundo (RA XVII)",
  "Lago Norte (RA XVIII)",
  "Candangolandia (RA XIX)",
  "Aguas Claras (RA XX)",
  "Riacho Fundo II (RA XXI)",
  "Sudoeste/Octogonal (RA XXII)",
  "Varjao (RA XXIII)",
  "Park Way (RA XXIV)",
  "SCIA/Estrutural (RA XXV)",
  "Sobradinho II (RA XXVI)",
  "Jardim Botanico (RA XXVII)",
  "Itapoa (RA XXVIII)",
  "SIA (RA XXIX)",
  "Vicente Pires (RA XXX)",
  "Fercal (RA XXXI)",
  "Sol Nascente/Por do Sol (RA XXXII)",
  "Arniqueira (RA XXXIII)",
];

function createDefaultDocuments(): DocumentCheckItem[] {
  return [
    { id: "doc-01", label: "Requerimento formal CAESB", checked: false, required: true },
    { id: "doc-02", label: "Planta de situacao/localizacao", checked: false, required: true },
    { id: "doc-03", label: "Planta topografica com curvas de nivel", checked: false, required: true },
    { id: "doc-04", label: "Memorial descritivo do projeto", checked: false, required: true },
    { id: "doc-05", label: "ART/RRT do responsavel tecnico", checked: false, required: true },
    { id: "doc-06", label: "Estudo populacional e de demanda", checked: false, required: true },
    { id: "doc-07", label: "Planta da rede existente (CAESB)", checked: false, required: false },
    { id: "doc-08", label: "Projeto geometrico do loteamento", checked: false, required: false },
    { id: "doc-09", label: "Licenca ambiental (se aplicavel)", checked: false, required: false },
    { id: "doc-10", label: "Estudo de impacto de vizinhanca", checked: false, required: false },
    { id: "doc-11", label: "Planilha de dimensionamento hidraulico", checked: false, required: true },
    { id: "doc-12", label: "Perfil longitudinal das redes", checked: false, required: true },
    { id: "doc-13", label: "Detalhes construtivos padrao CAESB", checked: false, required: true },
    { id: "doc-14", label: "Planilha orcamentaria (SINAPI/SICRO)", checked: false, required: false },
    { id: "doc-15", label: "Cronograma fisico-financeiro", checked: false, required: false },
  ];
}

function createDefaultTechnicalData(): TechnicalData {
  return {
    population: "",
    flowRate: "",
    pipeDiameter: "",
    pipeLength: "",
    pipeMaterial: "PVC",
    velocity: "",
    pressureMin: "",
    pressureMax: "",
    coverDepth: "",
    slope: "",
    demandPerCapita: "",
    soilType: "",
  };
}

let demandCounter = 0;

function generateDemandNumber(): string {
  demandCounter += 1;
  return `CAESB-2026-${String(demandCounter).padStart(4, "0")}`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ══════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════

function NetworkTypeBadge({ type }: { type: NetworkType }) {
  const config = NETWORK_TYPE_CONFIG[type];
  return (
    <Badge className={`${config.badgeClass} text-xs gap-1`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const config = PRIORITY_CONFIG[priority];
  return <Badge className={`${config.badgeClass} text-xs`}>{config.label}</Badge>;
}

function StageBadge({ stage }: { stage: KanbanStage }) {
  const config = STAGE_CONFIG[stage];
  return <Badge className={`${config.badgeClass} text-xs`}>{config.label}</Badge>;
}

// ══════════════════════════════════════════════════════════
// Statistics Bar
// ══════════════════════════════════════════════════════════

function StatisticsBar({ cards }: { cards: PreProjectCard[] }) {
  const counts = useMemo(() => {
    const result: Record<KanbanStage, number> = {
      pedido_inicial: 0,
      formulario: 0,
      demanda_gerada: 0,
      aprovado: 0,
    };
    cards.forEach((c) => {
      result[c.stage]++;
    });
    return result;
  }, [cards]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {STAGE_ORDER.map((stage) => {
        const config = STAGE_CONFIG[stage];
        return (
          <Card key={stage} className={`${config.bgColor} ${config.borderColor} border`}>
            <CardContent className="p-3 text-center">
              <div className={`text-2xl font-bold ${config.color}`}>{counts[stage]}</div>
              <div className="text-xs text-muted-foreground font-medium truncate">{config.label}</div>
            </CardContent>
          </Card>
        );
      })}
      <Card className="border bg-muted/50">
        <CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-[#10367D]">{cards.length}</div>
          <div className="text-xs text-muted-foreground font-medium">Total</div>
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Kanban Card Component
// ══════════════════════════════════════════════════════════

function KanbanCard({
  card,
  onMoveNext,
  onOpenDetail,
}: {
  card: PreProjectCard;
  onMoveNext: (id: string) => void;
  onOpenDetail: (id: string) => void;
}) {
  const stageIndex = STAGE_ORDER.indexOf(card.stage);
  const canMoveNext = stageIndex < STAGE_ORDER.length - 1;
  const nextStage = canMoveNext ? STAGE_CONFIG[STAGE_ORDER[stageIndex + 1]] : null;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
      style={{
        borderLeftColor:
          card.stage === "pedido_inicial"
            ? "#2563eb"
            : card.stage === "formulario"
              ? "#eab308"
              : card.stage === "demanda_gerada"
                ? "#f97316"
                : "#16a34a",
      }}
      onClick={() => onOpenDetail(card.id)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-tight line-clamp-2">{card.projectName}</h4>
          <PriorityBadge priority={card.priority} />
        </div>

        <div className="flex flex-wrap gap-1">
          <NetworkTypeBadge type={card.networkType} />
          {card.demandNumber && (
            <Badge variant="outline" className="text-xs gap-1">
              <Hash className="w-3 h-3" />
              {card.demandNumber}
            </Badge>
          )}
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{card.responsible || "Nao atribuido"}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{card.location}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span>{formatDate(card.createdAt)}</span>
          </div>
          {card.estimatedExtension && (
            <div className="flex items-center gap-1">
              <Ruler className="w-3 h-3 flex-shrink-0" />
              <span>{card.estimatedExtension} m</span>
            </div>
          )}
        </div>

        {canMoveNext && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs h-7 mt-1"
            onClick={(e) => {
              e.stopPropagation();
              onMoveNext(card.id);
            }}
          >
            <ArrowRight className="w-3 h-3 mr-1" />
            Mover para {nextStage?.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
// Kanban Column Component
// ══════════════════════════════════════════════════════════

function KanbanColumn({
  stage,
  cards,
  onMoveNext,
  onOpenDetail,
}: {
  stage: KanbanStage;
  cards: PreProjectCard[];
  onMoveNext: (id: string) => void;
  onOpenDetail: (id: string) => void;
}) {
  const config = STAGE_CONFIG[stage];
  const columnCards = cards.filter((c) => c.stage === stage);

  return (
    <div className={`flex flex-col rounded-lg border ${config.borderColor} ${config.bgColor} min-w-[280px] w-full`}>
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-bold ${config.color}`}>{config.label}</h3>
          <Badge variant="secondary" className="text-xs h-5 min-w-[20px] justify-center">
            {columnCards.length}
          </Badge>
        </div>
      </div>
      <ScrollArea className="flex-1 max-h-[calc(100vh-380px)] min-h-[200px]">
        <div className="p-2 space-y-2">
          {columnCards.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">Nenhum item nesta etapa</div>
          )}
          {columnCards.map((card) => (
            <KanbanCard key={card.id} card={card} onMoveNext={onMoveNext} onOpenDetail={onOpenDetail} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Create Card Dialog
// ══════════════════════════════════════════════════════════

function CreateCardDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (card: Omit<PreProjectCard, "id" | "createdAt" | "updatedAt" | "demandNumber" | "technicalData" | "documents" | "observations" | "stage">) => void;
}) {
  const [projectName, setProjectName] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [networkType, setNetworkType] = useState<NetworkType>("agua");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("media");
  const [estimatedExtension, setEstimatedExtension] = useState("");
  const [responsible, setResponsible] = useState("");

  const resetForm = () => {
    setProjectName("");
    setClient("");
    setLocation("");
    setNetworkType("agua");
    setDescription("");
    setPriority("media");
    setEstimatedExtension("");
    setResponsible("");
  };

  const handleSubmit = () => {
    if (!projectName.trim()) {
      toast.error("Informe o nome do projeto.");
      return;
    }
    if (!client.trim()) {
      toast.error("Informe o cliente.");
      return;
    }
    if (!location) {
      toast.error("Selecione a regiao administrativa.");
      return;
    }
    onSubmit({
      projectName: projectName.trim(),
      client: client.trim(),
      location,
      networkType,
      description: description.trim(),
      priority,
      estimatedExtension: estimatedExtension.trim(),
      responsible: responsible.trim(),
    });
    resetForm();
    onOpenChange(false);
    toast.success("Pre-projeto criado com sucesso!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#FF6B2C]" />
            Novo Pre-Projeto CAESB
          </DialogTitle>
          <DialogDescription>
            Preencha os dados iniciais para criar uma nova solicitacao de pre-projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="create-name">Nome do Projeto *</Label>
            <Input
              id="create-name"
              placeholder="Ex: Rede de agua Setor Hab. Sol Nascente"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-client">Cliente *</Label>
            <Input
              id="create-client"
              placeholder="Ex: Construtora XYZ Ltda"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-responsible">Responsavel Tecnico</Label>
            <Input
              id="create-responsible"
              placeholder="Ex: Eng. Joao Silva - CREA 12345/DF"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Regiao Administrativa (DF) *</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a RA..." />
              </SelectTrigger>
              <SelectContent>
                {REGIOES_ADMINISTRATIVAS.map((ra) => (
                  <SelectItem key={ra} value={ra}>
                    {ra}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Rede *</Label>
              <Select value={networkType} onValueChange={(v) => setNetworkType(v as NetworkType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agua">
                    <span className="flex items-center gap-2">
                      <Droplets className="w-4 h-4" /> Agua
                    </span>
                  </SelectItem>
                  <SelectItem value="esgoto">
                    <span className="flex items-center gap-2">
                      <Waves className="w-4 h-4" /> Esgoto
                    </span>
                  </SelectItem>
                  <SelectItem value="drenagem">
                    <span className="flex items-center gap-2">
                      <CloudRain className="w-4 h-4" /> Drenagem
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade *</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-extension">Extensao Estimada (m)</Label>
            <Input
              id="create-extension"
              type="number"
              placeholder="Ex: 2500"
              value={estimatedExtension}
              onChange={(e) => setEstimatedExtension(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-desc">Descricao</Label>
            <Textarea
              id="create-desc"
              placeholder="Descreva brevemente o escopo do pre-projeto..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="bg-[#10367D] hover:bg-[#10367D]/90 text-white">
            <Plus className="w-4 h-4 mr-1" />
            Criar Pre-Projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════
// Technical Form Dialog (Formulario stage)
// ══════════════════════════════════════════════════════════

function TechnicalFormDialog({
  card,
  open,
  onOpenChange,
  onSave,
}: {
  card: PreProjectCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (cardId: string, technicalData: TechnicalData, documents: DocumentCheckItem[], observations: string) => void;
}) {
  const [techData, setTechData] = useState<TechnicalData>({ ...card.technicalData });
  const [docs, setDocs] = useState<DocumentCheckItem[]>(card.documents.map((d) => ({ ...d })));
  const [obs, setObs] = useState(card.observations);

  const updateTech = (field: keyof TechnicalData, value: string) => {
    setTechData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleDoc = (docId: string) => {
    setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, checked: !d.checked } : d)));
  };

  const docsProgress = useMemo(() => {
    const required = docs.filter((d) => d.required);
    const checkedRequired = required.filter((d) => d.checked);
    return required.length > 0 ? Math.round((checkedRequired.length / required.length) * 100) : 0;
  }, [docs]);

  const handleSave = () => {
    onSave(card.id, techData, docs, obs);
    onOpenChange(false);
    toast.success("Dados tecnicos salvos com sucesso!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#FF6B2C]" />
            Formulario Tecnico — {card.projectName}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados tecnicos do projeto, documentos e observacoes.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="technical" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="technical">Dados Tecnicos</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="notes">Observacoes</TabsTrigger>
          </TabsList>

          <TabsContent value="technical" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-xs">
                  <Users className="w-3 h-3" /> Populacao Atendida (hab)
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 5000"
                  value={techData.population}
                  onChange={(e) => updateTech("population", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-xs">
                  <Gauge className="w-3 h-3" /> Vazao (L/s)
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 15.5"
                  value={techData.flowRate}
                  onChange={(e) => updateTech("flowRate", e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-xs">
                  <CircleDot className="w-3 h-3" /> Diametro da Tubulacao (mm)
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 200"
                  value={techData.pipeDiameter}
                  onChange={(e) => updateTech("pipeDiameter", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-xs">
                  <Ruler className="w-3 h-3" /> Extensao da Rede (m)
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 2500"
                  value={techData.pipeLength}
                  onChange={(e) => updateTech("pipeLength", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Material da Tubulacao</Label>
                <Select value={techData.pipeMaterial} onValueChange={(v) => updateTech("pipeMaterial", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PVC">PVC</SelectItem>
                    <SelectItem value="PEAD">PEAD</SelectItem>
                    <SelectItem value="FoFo">Ferro Fundido</SelectItem>
                    <SelectItem value="Aco">Aco</SelectItem>
                    <SelectItem value="Concreto">Concreto</SelectItem>
                    <SelectItem value="PRFV">PRFV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Velocidade (m/s)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 1.2"
                  value={techData.velocity}
                  onChange={(e) => updateTech("velocity", e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Pressao Minima (mca)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 10"
                  value={techData.pressureMin}
                  onChange={(e) => updateTech("pressureMin", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Pressao Maxima (mca)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 50"
                  value={techData.pressureMax}
                  onChange={(e) => updateTech("pressureMax", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Profundidade de Cobrimento (m)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 0.80"
                  value={techData.coverDepth}
                  onChange={(e) => updateTech("coverDepth", e.target.value)}
                  step="0.05"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Declividade (m/m)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 0.005"
                  value={techData.slope}
                  onChange={(e) => updateTech("slope", e.target.value)}
                  step="0.001"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Demanda Per Capita (L/hab.dia)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 200"
                  value={techData.demandPerCapita}
                  onChange={(e) => updateTech("demandPerCapita", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Tipo de Solo</Label>
                <Select value={techData.soilType} onValueChange={(v) => updateTech("soilType", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Latossolo Vermelho">Latossolo Vermelho</SelectItem>
                    <SelectItem value="Latossolo Vermelho-Amarelo">Latossolo Vermelho-Amarelo</SelectItem>
                    <SelectItem value="Cambissolo">Cambissolo</SelectItem>
                    <SelectItem value="Neossolo">Neossolo</SelectItem>
                    <SelectItem value="Gleissolo">Gleissolo</SelectItem>
                    <SelectItem value="Rochoso">Rochoso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Checklist de Documentos</Label>
              <Badge variant={docsProgress === 100 ? "default" : "secondary"} className={docsProgress === 100 ? "bg-green-600 text-white" : ""}>
                {docsProgress}% obrigatorios
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all bg-[#FF6B2C]"
                style={{ width: `${docsProgress}%` }}
              />
            </div>
            <div className="space-y-2">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-2 rounded border hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={doc.checked}
                    onCheckedChange={() => toggleDoc(doc.id)}
                    id={`doc-check-${doc.id}`}
                  />
                  <label
                    htmlFor={`doc-check-${doc.id}`}
                    className={`text-sm flex-1 cursor-pointer ${doc.checked ? "line-through text-muted-foreground" : ""}`}
                  >
                    {doc.label}
                  </label>
                  {doc.required ? (
                    <Badge className="bg-red-600 text-white text-[10px]">Obrigatorio</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Opcional
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <StickyNote className="w-4 h-4" /> Observacoes e Notas
              </Label>
              <Textarea
                placeholder="Adicione observacoes relevantes sobre o pre-projeto, condicionantes, pendencias..."
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={8}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="bg-[#10367D] hover:bg-[#10367D]/90 text-white">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Salvar Dados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════
// Demand Summary Dialog
// ══════════════════════════════════════════════════════════

function DemandSummaryDialog({
  card,
  open,
  onOpenChange,
}: {
  card: PreProjectCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!card) return null;

  const td = card.technicalData;
  const checkedDocs = card.documents.filter((d) => d.checked);
  const uncheckedRequired = card.documents.filter((d) => d.required && !d.checked);

  const handlePrint = () => {
    const lines: string[] = [
      "================================================================",
      "        CAESB - RESUMO DE DEMANDA DE PRE-PROJETO",
      "================================================================",
      "",
      `Numero da Demanda: ${card.demandNumber || "N/A"}`,
      `Data de Geracao: ${formatDateTime(card.updatedAt)}`,
      `Status: ${STAGE_CONFIG[card.stage].label}`,
      "",
      "--- DADOS GERAIS ---",
      `Projeto: ${card.projectName}`,
      `Cliente: ${card.client}`,
      `Responsavel: ${card.responsible || "Nao atribuido"}`,
      `Regiao Administrativa: ${card.location}`,
      `Tipo de Rede: ${NETWORK_TYPE_CONFIG[card.networkType].label}`,
      `Prioridade: ${PRIORITY_CONFIG[card.priority].label}`,
      `Extensao Estimada: ${card.estimatedExtension || "N/I"} m`,
      `Descricao: ${card.description || "N/I"}`,
      "",
      "--- DADOS TECNICOS ---",
      `Populacao: ${td.population || "N/I"} hab`,
      `Vazao: ${td.flowRate || "N/I"} L/s`,
      `Diametro: ${td.pipeDiameter || "N/I"} mm`,
      `Extensao Rede: ${td.pipeLength || "N/I"} m`,
      `Material: ${td.pipeMaterial || "N/I"}`,
      `Velocidade: ${td.velocity || "N/I"} m/s`,
      `Pressao Min: ${td.pressureMin || "N/I"} mca`,
      `Pressao Max: ${td.pressureMax || "N/I"} mca`,
      `Cobrimento: ${td.coverDepth || "N/I"} m`,
      `Declividade: ${td.slope || "N/I"} m/m`,
      `Demanda Per Capita: ${td.demandPerCapita || "N/I"} L/hab.dia`,
      `Tipo de Solo: ${td.soilType || "N/I"}`,
      "",
      "--- DOCUMENTOS APRESENTADOS ---",
      ...checkedDocs.map((d) => `  [X] ${d.label}${d.required ? " (Obrigatorio)" : ""}`),
      "",
    ];

    if (uncheckedRequired.length > 0) {
      lines.push("--- DOCUMENTOS OBRIGATORIOS PENDENTES ---");
      uncheckedRequired.forEach((d) => lines.push(`  [ ] ${d.label}`));
      lines.push("");
    }

    if (card.observations) {
      lines.push("--- OBSERVACOES ---", card.observations, "");
    }

    lines.push(
      "================================================================",
      `Documento gerado em: ${new Date().toLocaleString("pt-BR")}`,
      "CAESB - Companhia de Saneamento Ambiental do DF",
      "================================================================"
    );

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demanda-${card.demandNumber || card.id}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Resumo da demanda exportado com sucesso!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#FF6B2C]" />
            Resumo da Demanda
          </DialogTitle>
          <DialogDescription>
            {card.demandNumber
              ? `Demanda ${card.demandNumber} - Gerada em ${formatDateTime(card.updatedAt)}`
              : "Resumo do pre-projeto"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {card.demandNumber && (
            <Card className="border-[#FF6B2C] border-2 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-muted-foreground uppercase font-semibold mb-1">Numero da Demanda</div>
                <div className="text-2xl font-bold text-[#FF6B2C]">{card.demandNumber}</div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Dados Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div>
                  <span className="text-muted-foreground">Projeto:</span>{" "}
                  <span className="font-medium">{card.projectName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cliente:</span>{" "}
                  <span className="font-medium">{card.client}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Responsavel:</span>{" "}
                  <span className="font-medium">{card.responsible || "N/I"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Regiao:</span>{" "}
                  <span className="font-medium">{card.location}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Tipo:</span>
                  <NetworkTypeBadge type={card.networkType} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Prioridade:</span>
                  <PriorityBadge priority={card.priority} />
                </div>
                <div>
                  <span className="text-muted-foreground">Extensao:</span>{" "}
                  <span className="font-medium">{card.estimatedExtension || "N/I"} m</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Criado em:</span>{" "}
                  <span className="font-medium">{formatDate(card.createdAt)}</span>
                </div>
              </div>
              {card.description && (
                <div className="pt-2 border-t mt-2">
                  <span className="text-muted-foreground">Descricao:</span>{" "}
                  <span>{card.description}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Dados Tecnicos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {[
                  { label: "Populacao", value: td.population, unit: "hab" },
                  { label: "Vazao", value: td.flowRate, unit: "L/s" },
                  { label: "Diametro", value: td.pipeDiameter, unit: "mm" },
                  { label: "Extensao", value: td.pipeLength, unit: "m" },
                  { label: "Material", value: td.pipeMaterial, unit: "" },
                  { label: "Velocidade", value: td.velocity, unit: "m/s" },
                  { label: "Pressao Min", value: td.pressureMin, unit: "mca" },
                  { label: "Pressao Max", value: td.pressureMax, unit: "mca" },
                  { label: "Cobrimento", value: td.coverDepth, unit: "m" },
                  { label: "Declividade", value: td.slope, unit: "m/m" },
                  { label: "Demanda P/C", value: td.demandPerCapita, unit: "L/hab.dia" },
                  { label: "Solo", value: td.soilType, unit: "" },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="p-2 bg-muted/50 rounded">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="font-medium font-mono">
                      {value || "N/I"} {value && unit}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Documentos</span>
                <Badge variant="secondary" className="text-xs">
                  {checkedDocs.length}/{card.documents.length} entregues
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {card.documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 text-xs">
                  {doc.checked ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  )}
                  <span className={doc.checked ? "text-muted-foreground" : ""}>{doc.label}</span>
                  {doc.required && !doc.checked && (
                    <Badge className="bg-red-600 text-white text-[9px] ml-auto">Pendente</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {card.observations && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Observacoes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{card.observations}</p>
              </CardContent>
            </Card>
          )}

          {uncheckedRequired.length > 0 && (
            <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  {uncheckedRequired.length} documento(s) obrigatorio(s) pendente(s)
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handlePrint} className="bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 text-white">
            <Download className="w-4 h-4 mr-1" />
            Exportar Resumo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════
// Card Detail Dialog (generic view/actions for any stage)
// ══════════════════════════════════════════════════════════

function CardDetailDialog({
  card,
  open,
  onOpenChange,
  onOpenTechnicalForm,
  onOpenDemandSummary,
  onMoveNext,
  onMovePrev,
}: {
  card: PreProjectCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTechnicalForm: (id: string) => void;
  onOpenDemandSummary: (id: string) => void;
  onMoveNext: (id: string) => void;
  onMovePrev: (id: string) => void;
}) {
  if (!card) return null;

  const stageIndex = STAGE_ORDER.indexOf(card.stage);
  const canMoveNext = stageIndex < STAGE_ORDER.length - 1;
  const canMovePrev = stageIndex > 0;
  const nextStage = canMoveNext ? STAGE_CONFIG[STAGE_ORDER[stageIndex + 1]] : null;
  const prevStage = canMovePrev ? STAGE_CONFIG[STAGE_ORDER[stageIndex - 1]] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#10367D]" />
            {card.projectName}
          </DialogTitle>
          <DialogDescription>
            Criado em {formatDateTime(card.createdAt)} | Atualizado em {formatDateTime(card.updatedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StageBadge stage={card.stage} />
            <NetworkTypeBadge type={card.networkType} />
            <PriorityBadge priority={card.priority} />
            {card.demandNumber && (
              <Badge variant="outline" className="gap-1">
                <Hash className="w-3 h-3" />
                {card.demandNumber}
              </Badge>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-[100px]">Cliente:</span>
              <span className="font-medium">{card.client}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-[100px]">Responsavel:</span>
              <span className="font-medium">{card.responsible || "Nao atribuido"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-[100px]">Regiao:</span>
              <span className="font-medium">{card.location}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground min-w-[100px]">Extensao:</span>
              <span className="font-medium">{card.estimatedExtension || "N/I"} m</span>
            </div>
            {card.description && (
              <div className="flex gap-2">
                <span className="text-muted-foreground min-w-[100px]">Descricao:</span>
                <span>{card.description}</span>
              </div>
            )}
          </div>

          {card.stage === "formulario" && (
            <Button
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
              onClick={() => {
                onOpenChange(false);
                onOpenTechnicalForm(card.id);
              }}
            >
              <FileText className="w-4 h-4 mr-1" />
              Abrir Formulario Tecnico
            </Button>
          )}

          {(card.stage === "demanda_gerada" || card.stage === "aprovado") && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                onOpenDemandSummary(card.id);
              }}
            >
              <ClipboardList className="w-4 h-4 mr-1" />
              Ver Resumo da Demanda
            </Button>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {canMovePrev && (
            <Button
              variant="outline"
              onClick={() => {
                onMovePrev(card.id);
                onOpenChange(false);
              }}
            >
              <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
              Voltar para {prevStage?.label}
            </Button>
          )}
          {canMoveNext && (
            <Button
              className="bg-[#10367D] hover:bg-[#10367D]/90 text-white"
              onClick={() => {
                onMoveNext(card.id);
                onOpenChange(false);
              }}
            >
              <ArrowRight className="w-4 h-4 mr-1" />
              Mover para {nextStage?.label}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════

export const CAESBPreProjectModule = () => {
  // ── State ──
  const [cards, setCards] = useState<PreProjectCard[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [technicalFormCard, setTechnicalFormCard] = useState<PreProjectCard | null>(null);
  const [demandSummaryCard, setDemandSummaryCard] = useState<PreProjectCard | null>(null);
  const [detailCard, setDetailCard] = useState<PreProjectCard | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  // ── Create card ──
  const handleCreateCard = useCallback(
    (data: Omit<PreProjectCard, "id" | "createdAt" | "updatedAt" | "demandNumber" | "technicalData" | "documents" | "observations" | "stage">) => {
      const now = new Date().toISOString();
      const newCard: PreProjectCard = {
        id: `PP-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        stage: "pedido_inicial",
        createdAt: now,
        updatedAt: now,
        demandNumber: null,
        technicalData: createDefaultTechnicalData(),
        documents: createDefaultDocuments(),
        observations: "",
      };
      setCards((prev) => [...prev, newCard]);
    },
    []
  );

  // ── Move to next stage ──
  const handleMoveNext = useCallback(
    (id: string) => {
      setCards((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const currentIndex = STAGE_ORDER.indexOf(c.stage);
          if (currentIndex >= STAGE_ORDER.length - 1) return c;

          const nextStage = STAGE_ORDER[currentIndex + 1];
          const now = new Date().toISOString();

          let demandNumber = c.demandNumber;
          if (nextStage === "demanda_gerada" && !c.demandNumber) {
            demandNumber = generateDemandNumber();
            toast.success(`Demanda gerada: ${demandNumber}`);
          }

          if (nextStage === "aprovado") {
            toast.success(`Projeto "${c.projectName}" aprovado!`);
          }

          return {
            ...c,
            stage: nextStage,
            updatedAt: now,
            demandNumber,
          };
        })
      );
    },
    []
  );

  // ── Move to previous stage ──
  const handleMovePrev = useCallback((id: string) => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const currentIndex = STAGE_ORDER.indexOf(c.stage);
        if (currentIndex <= 0) return c;

        const prevStage = STAGE_ORDER[currentIndex - 1];
        const now = new Date().toISOString();

        return {
          ...c,
          stage: prevStage,
          updatedAt: now,
        };
      })
    );
    toast.info("Cartao movido para a etapa anterior.");
  }, []);

  // ── Open detail ──
  const handleOpenDetail = useCallback(
    (id: string) => {
      const card = cards.find((c) => c.id === id);
      if (!card) return;

      if (card.stage === "formulario") {
        setTechnicalFormCard({ ...card });
      } else {
        setDetailCard({ ...card });
      }
    },
    [cards]
  );

  // ── Open technical form ──
  const handleOpenTechnicalForm = useCallback(
    (id: string) => {
      const card = cards.find((c) => c.id === id);
      if (card) setTechnicalFormCard({ ...card });
    },
    [cards]
  );

  // ── Open demand summary ──
  const handleOpenDemandSummary = useCallback(
    (id: string) => {
      const card = cards.find((c) => c.id === id);
      if (card) setDemandSummaryCard({ ...card });
    },
    [cards]
  );

  // ── Save technical data ──
  const handleSaveTechnicalData = useCallback(
    (cardId: string, technicalData: TechnicalData, documents: DocumentCheckItem[], observations: string) => {
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, technicalData, documents, observations, updatedAt: new Date().toISOString() }
            : c
        )
      );
    },
    []
  );

  // ── Sorted cards for list view ──
  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => {
      const stageDiff = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
      if (stageDiff !== 0) return stageDiff;
      const priorityOrder: Record<Priority, number> = { alta: 0, media: 1, baixa: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [cards]);

  // ══════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-l-4 border-l-[#FF6B2C] bg-gradient-to-r from-orange-50/50 to-transparent dark:from-orange-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <KanbanSquare className="w-5 h-5 text-[#FF6B2C]" />
            Pre-Projeto CAESB — Kanban de Demandas
          </CardTitle>
          <CardDescription>
            Gestao de solicitacoes de pre-projeto para a CAESB. Acompanhe o fluxo desde o pedido inicial ate a aprovacao.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Novo Pre-Projeto
            </Button>
            <div className="flex gap-1 ml-auto">
              <Button
                variant={viewMode === "kanban" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className={viewMode === "kanban" ? "bg-[#10367D] text-white" : ""}
              >
                <KanbanSquare className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Kanban</span>
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "bg-[#10367D] text-white" : ""}
              >
                <ClipboardList className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Lista</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Bar */}
      <StatisticsBar cards={cards} />

      {/* Kanban Board */}
      {viewMode === "kanban" && (
        <div className="overflow-x-auto pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-w-[320px]">
            {STAGE_ORDER.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                cards={cards}
                onMoveNext={handleMoveNext}
                onOpenDetail={handleOpenDetail}
              />
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Todos os Pre-Projetos ({cards.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedCards.length === 0 ? (
              <div className="text-center py-12">
                <KanbanSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold mb-2">Nenhum pre-projeto cadastrado</h3>
                <p className="text-muted-foreground mb-4">
                  Clique em "Novo Pre-Projeto" para criar a primeira solicitacao.
                </p>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Novo Pre-Projeto
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedCards.map((card) => {
                  const stageIndex = STAGE_ORDER.indexOf(card.stage);
                  const canMoveNext = stageIndex < STAGE_ORDER.length - 1;
                  const nextStage = canMoveNext ? STAGE_CONFIG[STAGE_ORDER[stageIndex + 1]] : null;

                  return (
                    <div
                      key={card.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetail(card.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{card.projectName}</span>
                          {card.demandNumber && (
                            <Badge variant="outline" className="text-[10px] gap-0.5">
                              <Hash className="w-2.5 h-2.5" />
                              {card.demandNumber}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {card.client}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {card.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {formatDate(card.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StageBadge stage={card.stage} />
                        <NetworkTypeBadge type={card.networkType} />
                        <PriorityBadge priority={card.priority} />
                        {canMoveNext && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveNext(card.id);
                            }}
                          >
                            <ArrowRight className="w-3 h-3 mr-1" />
                            {nextStage?.label}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state for Kanban */}
      {viewMode === "kanban" && cards.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <KanbanSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold mb-2">Quadro Kanban vazio</h3>
            <p className="text-muted-foreground mb-4">
              Crie um novo pre-projeto para iniciar o fluxo de trabalho CAESB.
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Novo Pre-Projeto
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Workflow Guide */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-[#10367D] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-[#10367D] mb-2">Fluxo de Trabalho</h4>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Badge className="bg-blue-600 text-white text-[10px]">1</Badge>
                  <span>Pedido Inicial</span>
                </div>
                <ChevronRight className="w-3 h-3 hidden sm:block" />
                <div className="flex items-center gap-1">
                  <Badge className="bg-yellow-500 text-black text-[10px]">2</Badge>
                  <span>Formulario Tecnico</span>
                </div>
                <ChevronRight className="w-3 h-3 hidden sm:block" />
                <div className="flex items-center gap-1">
                  <Badge className="bg-orange-500 text-white text-[10px]">3</Badge>
                  <span>Demanda Gerada</span>
                </div>
                <ChevronRight className="w-3 h-3 hidden sm:block" />
                <div className="flex items-center gap-1">
                  <Badge className="bg-green-600 text-white text-[10px]">4</Badge>
                  <span>Aprovado</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Ao mover um cartao de "Formulario" para "Demanda Gerada", um numero de demanda (CAESB-2026-XXXX) sera
                gerado automaticamente. Clique em um cartao na etapa "Formulario" para preencher os dados tecnicos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateCardDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSubmit={handleCreateCard} />

      {technicalFormCard && (
        <TechnicalFormDialog
          card={technicalFormCard}
          open={!!technicalFormCard}
          onOpenChange={(open) => {
            if (!open) setTechnicalFormCard(null);
          }}
          onSave={handleSaveTechnicalData}
        />
      )}

      <DemandSummaryDialog
        card={demandSummaryCard}
        open={!!demandSummaryCard}
        onOpenChange={(open) => {
          if (!open) setDemandSummaryCard(null);
        }}
      />

      <CardDetailDialog
        card={detailCard}
        open={!!detailCard}
        onOpenChange={(open) => {
          if (!open) setDetailCard(null);
        }}
        onOpenTechnicalForm={handleOpenTechnicalForm}
        onOpenDemandSummary={handleOpenDemandSummary}
        onMoveNext={(id) => {
          handleMoveNext(id);
          const updated = cards.find((c) => c.id === id);
          if (updated) setDetailCard(null);
        }}
        onMovePrev={(id) => {
          handleMovePrev(id);
          setDetailCard(null);
        }}
      />
    </div>
  );
};

export default CAESBPreProjectModule;
