import { useState, useEffect } from "react";
import {
  Download, ChevronDown, ChevronUp, Check, X, Loader2,
  Droplets, ClipboardList, Building2, FileText, BarChart3,
  DollarSign, Calendar, Map, Shield, Bell, Layers, Activity,
  Package, Users, Wrench, FileSpreadsheet, Newspaper,
  CheckSquare, Warehouse, HardHat, TrendingUp, Gauge,
  QrCode, Hammer, MessageSquare, UserCheck, LayoutDashboard
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export interface PulledData {
  moduleKey: string;
  moduleName: string;
  data: any[];
  pulledAt: string;
}

interface ModuleSource {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  table?: string;
  fetchFn?: () => Promise<any[]>;
}

const MODULE_SOURCES: ModuleSource[] = [
  {
    key: "obras",
    label: "Projetos / Obras",
    description: "Dados de obras e projetos cadastrados",
    icon: Building2,
    table: "obras",
  },
  {
    key: "rdo",
    label: "Diario de Obra (RDO)",
    description: "Registros diarios de obra",
    icon: ClipboardList,
    table: "rdos",
  },
  {
    key: "producao",
    label: "Controle de Producao",
    description: "Metas e medicoes de producao",
    icon: BarChart3,
    table: "producao_metas",
  },
  {
    key: "materiais",
    label: "Materiais / Almoxarifado",
    description: "Estoque e movimentacao de materiais",
    icon: Package,
    table: "materiais",
  },
  {
    key: "funcionarios",
    label: "Funcionarios / Equipes",
    description: "Dados de funcionarios e equipes",
    icon: Users,
    table: "funcionarios",
  },
  {
    key: "orcamento",
    label: "Orcamentos",
    description: "Orcamentos e precos unitarios",
    icon: DollarSign,
    table: "budgets",
  },
  {
    key: "alertas",
    label: "Alertas Configurados",
    description: "Alertas e notificacoes ativas",
    icon: Bell,
    table: "alertas_config",
  },
  {
    key: "ocorrencias",
    label: "Ocorrencias",
    description: "Registros de ocorrencias em campo",
    icon: Shield,
    table: "ocorrencias",
  },
  {
    key: "ligacoes",
    label: "Relatorio de Ligacoes",
    description: "Dados de ligacoes prediais",
    icon: Activity,
    table: "connection_reports",
  },
  {
    key: "licitacoes",
    label: "Licitacoes (Hub)",
    description: "Licitacoes do PNCP coletadas pelo Hub",
    icon: FileText,
    fetchFn: async () => {
      const res = await fetch("/hub/licitacoes.json");
      const data = await res.json();
      return data.licitacoes || [];
    },
  },
  {
    key: "noticias",
    label: "Noticias do Setor (Hub)",
    description: "Noticias de engenharia e saneamento",
    icon: Newspaper,
    fetchFn: async () => {
      const res = await fetch("/hub/noticias.json");
      const data = await res.json();
      return data.noticias || [];
    },
  },
  {
    key: "vinculos",
    label: "Dossies / Vinculos (Hub)",
    description: "Empresas monitoradas e vinculos",
    icon: Layers,
    fetchFn: async () => {
      const res = await fetch("/hub/vinculos.json");
      const data = await res.json();
      return [
        ...(data.empresas_monitoradas || []),
        ...(data.vinculos_verificados || []),
      ];
    },
  },
  {
    key: "checklists",
    label: "Checklists de Verificacao",
    description: "Checklists e verificacoes de qualidade",
    icon: CheckSquare,
    table: "checklists",
  },
  {
    key: "inventario",
    label: "Inventario / Almoxarifado",
    description: "Controle de estoque e movimentacoes",
    icon: Warehouse,
    table: "inventory_items",
  },
  {
    key: "manutencao",
    label: "Manutencao Predial",
    description: "Solicitacoes e tarefas de manutencao",
    icon: Wrench,
    table: "maintenance_requests",
  },
  {
    key: "lean",
    label: "Lean / Restricoes",
    description: "Restricoes e planejamento lean",
    icon: Gauge,
    table: "lean_constraints",
  },
  {
    key: "crm",
    label: "CRM - Clientes",
    description: "Contatos, contas e pipeline comercial",
    icon: Users,
    table: "crm_contacts",
  },
  {
    key: "consumo",
    label: "Controle de Consumo",
    description: "Consumo de agua e energia nas obras",
    icon: TrendingUp,
    table: "consumption_records",
  },
  {
    key: "aprovacoes",
    label: "Aprovacoes Pendentes",
    description: "Solicitacoes e fluxo de aprovacao",
    icon: UserCheck,
    table: "pending_actions",
  },
  {
    key: "mao_de_obra",
    label: "Apontamento de Mao de Obra",
    description: "Horas e alocacao de equipes",
    icon: HardHat,
    table: "labor_tracking",
  },
  {
    key: "predial",
    label: "Laudos Prediais",
    description: "Relatorios de vistoria e laudos",
    icon: FileText,
    table: "facility_reports",
  },
  {
    key: "pesquisa",
    label: "Pesquisa de Satisfacao",
    description: "Feedback e NPS de usuarios",
    icon: MessageSquare,
    table: "satisfaction_surveys",
  },
];

interface PullDataPanelProps {
  currentModule: string;
  onDataPulled?: (pulled: PulledData[]) => void;
  excludeModules?: string[];
}

export function PullDataPanel({ currentModule, onDataPulled, excludeModules = [] }: PullDataPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [pulledData, setPulledData] = useState<PulledData[]>([]);

  const availableSources = MODULE_SOURCES.filter(
    (m) => m.key !== currentModule && !excludeModules.includes(m.key)
  );

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === availableSources.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(availableSources.map((m) => m.key)));
    }
  };

  const handlePullData = async () => {
    if (selected.size === 0) {
      toast.error("Selecione pelo menos um modulo");
      return;
    }

    setLoading(true);
    const results: PulledData[] = [];

    for (const key of selected) {
      const source = MODULE_SOURCES.find((m) => m.key === key);
      if (!source) continue;

      try {
        let data: any[] = [];

        if (source.fetchFn) {
          data = await source.fetchFn();
        } else if (source.table) {
          const { data: rows, error } = await supabase
            .from(source.table)
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);

          if (error) throw error;
          data = rows || [];
        }

        results.push({
          moduleKey: source.key,
          moduleName: source.label,
          data,
          pulledAt: new Date().toISOString(),
        });
      } catch (err: any) {
        console.error(`Erro ao puxar dados de ${source.label}:`, err);
        toast.error(`Erro ao puxar ${source.label}: ${err.message || "falha"}`);
      }
    }

    setPulledData(results);
    onDataPulled?.(results);

    const totalItems = results.reduce((sum, r) => sum + r.data.length, 0);
    toast.success(
      `Dados importados: ${results.length} modulo(s), ${totalItems} registro(s)`
    );

    setLoading(false);
  };

  return (
    <div className="mb-4">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-xs font-mono bg-[#162044] border border-[#1E3A6E] text-white hover:border-[#FF6B2C]/50 transition-all w-full sm:w-auto"
      >
        <Download className="w-3.5 h-3.5 text-[#FF6B2C]" />
        <span>Puxar Dados de Outros Modulos</span>
        {pulledData.length > 0 && (
          <span className="text-[10px] bg-[#22C55E]/15 text-[#22C55E] px-1.5 py-0.5">
            {pulledData.length} importado(s)
          </span>
        )}
        {isOpen ? (
          <ChevronUp className="w-3 h-3 ml-auto text-[#64748B]" />
        ) : (
          <ChevronDown className="w-3 h-3 ml-auto text-[#64748B]" />
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="mt-2 border border-[#1E3A6E] p-4"
          style={{ background: "#0E1B3D" }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-mono text-[#94A3B8]">
              Selecione os modulos de onde deseja importar dados:
            </p>
            <button
              onClick={selectAll}
              className="text-[10px] font-mono text-[#FF6B2C] hover:text-[#FF6B2C]/80"
            >
              {selected.size === availableSources.length
                ? "Desmarcar Todos"
                : "Selecionar Todos"}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {availableSources.map((source) => {
              const Icon = source.icon;
              const isSelected = selected.has(source.key);
              const pulled = pulledData.find((p) => p.moduleKey === source.key);

              return (
                <button
                  key={source.key}
                  onClick={() => toggleSelect(source.key)}
                  className={`flex items-start gap-2.5 p-3 border text-left transition-all ${
                    isSelected
                      ? "border-[#FF6B2C]/60 bg-[#FF6B2C]/5"
                      : "border-[#1E3A6E] hover:border-[#1E3A6E]/80"
                  }`}
                  style={{ background: isSelected ? undefined : "#162044" }}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {isSelected ? (
                      <div className="w-4 h-4 bg-[#FF6B2C] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 border border-[#1E3A6E]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-[#FF6B2C] flex-shrink-0" />
                      <span className="text-xs font-mono font-semibold text-white truncate">
                        {source.label}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-[#64748B] mt-0.5 leading-relaxed">
                      {source.description}
                    </p>
                    {pulled && (
                      <p className="text-[10px] font-mono text-[#22C55E] mt-1">
                        {pulled.data.length} registro(s) importados
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#1E3A6E]">
            <span className="text-[10px] font-mono text-[#64748B]">
              {selected.size} modulo(s) selecionado(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelected(new Set());
                  setIsOpen(false);
                }}
                className="px-3 py-1.5 text-xs font-mono text-[#64748B] hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePullData}
                disabled={loading || selected.size === 0}
                className="px-4 py-1.5 text-xs font-mono font-semibold bg-[#FF6B2C] text-white hover:bg-[#FF6B2C]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3" />
                    Puxar Dados
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Summary of pulled data */}
          {pulledData.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#1E3A6E]">
              <p className="text-[10px] font-mono text-[#94A3B8] mb-2 uppercase tracking-wider">
                Dados importados nesta sessao:
              </p>
              <div className="flex flex-wrap gap-2">
                {pulledData.map((p) => (
                  <span
                    key={p.moduleKey}
                    className="text-[10px] font-mono bg-[#22C55E]/10 text-[#22C55E] px-2 py-1 flex items-center gap-1"
                  >
                    <Check className="w-2.5 h-2.5" />
                    {p.moduleName}: {p.data.length} itens
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
