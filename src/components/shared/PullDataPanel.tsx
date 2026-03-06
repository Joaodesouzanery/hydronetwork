import { useState, useCallback, useMemo } from "react";
import {
  Download, ChevronDown, ChevronUp, Check, Loader2, Search,
  Droplets, ClipboardList, Building2, FileText, BarChart3,
  DollarSign, Calendar, Map, Shield, Bell, Layers, Activity,
  Package, Users, Wrench, FileSpreadsheet, Newspaper,
  CheckSquare, Warehouse, HardHat, TrendingUp, Gauge,
  Hammer, MessageSquare, UserCheck, Home, Palette,
  Upload, Waves, CloudRain, Calculator, Beaker, Edit3,
  Image, Plus, History, AlertCircle, Clock, ClipboardCheck,
  FileCheck2, GraduationCap, HelpCircle, Archive, Settings,
  Smile, HeadphonesIcon, Database
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
  section: string;
  table?: string;
  fetchFn?: () => Promise<any[]>;
}

const MODULE_SOURCES: ModuleSource[] = [
  // ── Menu Principal ──
  { key: "projetos", label: "Projetos", description: "Obras e projetos cadastrados", icon: Building2, section: "Menu Principal", table: "obras" },
  { key: "dashboard_custom", label: "Dashboard Personalizado", description: "Dashboards criados pelo usuário", icon: Palette, section: "Menu Principal", table: "custom_dashboards" },

  // ── Monitoramento ──
  { key: "alertas", label: "Alertas", description: "Alertas e notificações ativas", icon: Bell, section: "Monitoramento", table: "alertas_config" },
  { key: "atrasos", label: "Atrasos de Projeto", description: "Análise de atrasos e desvios", icon: Clock, section: "Monitoramento", table: "project_delays" },
  { key: "lps_lean", label: "LPS / Lean", description: "Restrições e planejamento Lean", icon: ClipboardCheck, section: "Monitoramento", table: "lean_constraints" },
  { key: "aprovacao", label: "Controle de Aprovação", description: "Fluxo de aprovação de documentos", icon: FileCheck2, section: "Monitoramento", table: "pending_actions" },
  { key: "economia", label: "Economia Comprovada", description: "Economia gerada pela plataforma", icon: DollarSign, section: "Monitoramento", table: "economy_records" },
  { key: "aprovacoes_projetos", label: "Aprovações de Projetos", description: "Status de aprovação de projetos", icon: Shield, section: "Monitoramento", table: "project_approvals" },
  { key: "projetos_basicos", label: "Projetos Básicos", description: "Pré-projetos e projetos básicos", icon: ClipboardCheck, section: "Monitoramento", table: "basic_projects" },

  // ── HydroNetwork ──
  { key: "topografia", label: "Topografia", description: "Pontos topográficos e coordenadas", icon: Upload, section: "HydroNetwork", table: "topographic_points" },
  { key: "esgoto", label: "Esgoto", description: "Rede de esgotamento sanitário", icon: Waves, section: "HydroNetwork", table: "sewer_networks" },
  { key: "agua", label: "Água", description: "Rede de abastecimento de água", icon: Droplets, section: "HydroNetwork", table: "water_networks" },
  { key: "drenagem", label: "Drenagem", description: "Rede de drenagem pluvial", icon: CloudRain, section: "HydroNetwork", table: "drainage_networks" },
  { key: "quantitativos", label: "Quantitativos", description: "Quantitativos calculados da rede", icon: FileSpreadsheet, section: "HydroNetwork", table: "quantity_rows" },
  { key: "edicao_trecho", label: "Edição por Trechos", description: "Dados editados de trechos", icon: Edit3, section: "HydroNetwork", table: "trecho_edits" },
  { key: "orcamento", label: "Orçamento", description: "Orçamento detalhado por serviço", icon: Calculator, section: "HydroNetwork", table: "budgets" },
  { key: "bdi", label: "BDI", description: "Bonificação e despesas indiretas", icon: DollarSign, section: "HydroNetwork", table: "bdi_configs" },
  { key: "planejamento", label: "Planejamento", description: "Cronograma e planejamento de obras", icon: Calendar, section: "HydroNetwork", table: "planning_schedules" },
  { key: "epanet", label: "EPANET", description: "Simulação hidráulica de água", icon: Beaker, section: "HydroNetwork", table: "epanet_results" },
  { key: "swmm", label: "SWMM", description: "Simulação hidrológica de drenagem", icon: Waves, section: "HydroNetwork", table: "swmm_results" },
  { key: "openproject", label: "OpenProject", description: "Integração com OpenProject", icon: Layers, section: "HydroNetwork", table: "openproject_tasks" },
  { key: "qgis", label: "QGIS", description: "Dados geoespaciais e camadas GIS", icon: Map, section: "HydroNetwork", table: "gis_layers" },
  { key: "revisao_pares", label: "Revisão por Pares", description: "Revisões técnicas e pareceres", icon: Shield, section: "HydroNetwork", table: "peer_reviews" },
  { key: "perfil_longitudinal", label: "Perfil Longitudinal", description: "Perfis de rede calculados", icon: Activity, section: "HydroNetwork", table: "longitudinal_profiles" },

  // ── Diário de Obra ──
  { key: "rdo_hydro", label: "RDO Hydro", description: "Diários de obra Hydro", icon: ClipboardList, section: "Diário de Obra", table: "rdos" },
  { key: "rdo_planejamento", label: "RDO x Planejamento", description: "Comparativo RDO vs planejado", icon: BarChart3, section: "Diário de Obra", table: "rdos" },
  { key: "rdo_historico", label: "Histórico RDO Hydro", description: "Histórico completo de RDOs", icon: History, section: "Diário de Obra", table: "rdos" },
  { key: "fotos_validacao", label: "Fotos de Validação", description: "Fotos de progresso e validação", icon: Image, section: "Diário de Obra", table: "rdo_photos" },
  { key: "rdo_novo", label: "Novo RDO", description: "Registros diários de obra", icon: Plus, section: "Diário de Obra", table: "rdos" },
  { key: "producao", label: "Controle de Produção", description: "Metas e medições de produção", icon: ClipboardList, section: "Diário de Obra", table: "producao_metas" },
  { key: "ligacoes", label: "Relatório de Ligações", description: "Ligações prediais executadas", icon: FileText, section: "Diário de Obra", table: "connection_reports" },
  { key: "ocorrencias", label: "Ocorrências", description: "Registros de ocorrências em campo", icon: AlertCircle, section: "Diário de Obra", table: "ocorrencias" },

  // ── Módulos de Dados (páginas extras) ──
  { key: "materiais", label: "Materiais / Almoxarifado", description: "Estoque e movimentação de materiais", icon: Package, section: "Materiais e Insumos", table: "materiais" },
  { key: "inventario", label: "Inventário", description: "Controle de estoque e movimentações", icon: Warehouse, section: "Materiais e Insumos", table: "inventory_items" },
  { key: "consumo", label: "Controle de Consumo", description: "Consumo de água e energia nas obras", icon: TrendingUp, section: "Materiais e Insumos", table: "consumption_records" },
  { key: "funcionarios", label: "Funcionários / Equipes", description: "Dados de funcionários e equipes", icon: Users, section: "Equipes e RH", table: "funcionarios" },
  { key: "mao_de_obra", label: "Apontamento de Mão de Obra", description: "Horas e alocação de equipes", icon: HardHat, section: "Equipes e RH", table: "labor_tracking" },
  { key: "crm", label: "CRM - Clientes", description: "Contatos, contas e pipeline comercial", icon: Users, section: "Comercial", table: "crm_contacts" },
  { key: "checklists", label: "Checklists de Verificação", description: "Checklists e verificações de qualidade", icon: CheckSquare, section: "Qualidade", table: "checklists" },
  { key: "manutencao", label: "Manutenção Predial", description: "Solicitações e tarefas de manutenção", icon: Wrench, section: "Operacional", table: "maintenance_requests" },
  { key: "predial", label: "Laudos Prediais", description: "Relatórios de vistoria e laudos", icon: FileText, section: "Operacional", table: "facility_reports" },
  { key: "pesquisa", label: "Pesquisa de Satisfação", description: "Feedback e NPS de usuários", icon: MessageSquare, section: "Qualidade", table: "satisfaction_surveys" },
  { key: "sentimento", label: "Análise de Sentimento", description: "Análise de sentimento dos registros", icon: Smile, section: "Sistema", table: "sentiment_records" },

  // ── Hub de Notícias ──
  {
    key: "licitacoes", label: "Licitações (Hub)", description: "Licitações do PNCP coletadas pelo Hub", icon: FileText, section: "Hub",
    fetchFn: async () => {
      const res = await fetch("/hub/licitacoes.json");
      const data = await res.json();
      return data.licitacoes || [];
    },
  },
  {
    key: "noticias", label: "Notícias do Setor (Hub)", description: "Notícias de engenharia e saneamento", icon: Newspaper, section: "Hub",
    fetchFn: async () => {
      const res = await fetch("/hub/noticias.json");
      const data = await res.json();
      return data.noticias || [];
    },
  },
  {
    key: "vinculos", label: "Dossiês / Vínculos (Hub)", description: "Empresas monitoradas e vínculos", icon: Layers, section: "Hub",
    fetchFn: async () => {
      const res = await fetch("/hub/vinculos.json");
      const data = await res.json();
      return [...(data.empresas_monitoradas || []), ...(data.vinculos_verificados || [])];
    },
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
  const [searchTerm, setSearchTerm] = useState("");

  const availableSources = useMemo(() =>
    MODULE_SOURCES.filter(m => m.key !== currentModule && !excludeModules.includes(m.key)),
    [currentModule, excludeModules]
  );

  const filteredSources = useMemo(() => {
    if (!searchTerm.trim()) return availableSources;
    const term = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return availableSources.filter(m =>
      m.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term) ||
      m.description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term) ||
      m.section.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term)
    );
  }, [availableSources, searchTerm]);

  // Group by section
  const groupedSources = useMemo(() => {
    const groups: Record<string, ModuleSource[]> = {};
    for (const src of filteredSources) {
      if (!groups[src.section]) groups[src.section] = [];
      groups[src.section].push(src);
    }
    return groups;
  }, [filteredSources]);

  const toggleSelect = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selected.size === filteredSources.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredSources.map(m => m.key)));
    }
  }, [selected.size, filteredSources]);

  const selectSection = useCallback((section: string) => {
    const sectionKeys = (groupedSources[section] || []).map(m => m.key);
    const allSelected = sectionKeys.every(k => selected.has(k));
    setSelected(prev => {
      const next = new Set(prev);
      sectionKeys.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  }, [groupedSources, selected]);

  const handlePullData = async () => {
    if (selected.size === 0) {
      toast.error("Selecione pelo menos um modulo");
      return;
    }

    setLoading(true);
    const results: PulledData[] = [];
    const selectedSources = MODULE_SOURCES.filter(m => selected.has(m.key));

    // Parallel fetching
    const promises = selectedSources.map(async (source) => {
      try {
        let data: any[] = [];
        if (source.fetchFn) {
          data = await source.fetchFn();
        } else if (source.table) {
          const { data: rows, error } = await supabase
            .from(source.table)
            .select("*")
            .order("created_at", { ascending: false })
            .limit(200);
          if (error) throw error;
          data = rows || [];
        }
        return { moduleKey: source.key, moduleName: source.label, data, pulledAt: new Date().toISOString() } as PulledData;
      } catch (err: any) {
        console.error(`Erro ao puxar dados de ${source.label}:`, err);
        toast.error(`Erro: ${source.label} - ${err.message || "falha"}`);
        return null;
      }
    });

    const settled = await Promise.allSettled(promises);
    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }

    setPulledData(results);
    onDataPulled?.(results);

    const totalItems = results.reduce((sum, r) => sum + r.data.length, 0);
    toast.success(`Importados: ${results.length} modulo(s), ${totalItems} registro(s)`);
    setLoading(false);
  };

  const totalPulledItems = pulledData.reduce((s, p) => s + p.data.length, 0);

  return (
    <div className="mb-4">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2.5 px-4 py-2.5 text-xs font-mono bg-gradient-to-r from-[#0F1A38] to-[#162044] border border-[#1E3A6E]/60 text-white hover:border-[#FF6B2C]/60 hover:shadow-lg hover:shadow-[#FF6B2C]/5 transition-all duration-200 w-full sm:w-auto rounded-lg"
      >
        <div className="w-6 h-6 rounded-md bg-[#FF6B2C]/15 flex items-center justify-center group-hover:bg-[#FF6B2C]/25 transition-colors">
          <Database className="w-3.5 h-3.5 text-[#FF6B2C]" />
        </div>
        <span className="font-semibold tracking-wide">Puxar Dados de Outros Modulos</span>
        {pulledData.length > 0 && (
          <span className="text-[10px] bg-[#22C55E]/15 text-[#22C55E] px-2 py-0.5 rounded-full font-bold">
            {pulledData.length} modulo(s) | {totalPulledItems} itens
          </span>
        )}
        <div className="ml-auto pl-3">
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-[#64748B] group-hover:text-white transition-colors" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#64748B] group-hover:text-white transition-colors" />
          )}
        </div>
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="mt-2 border border-[#1E3A6E]/60 rounded-lg overflow-hidden" style={{ background: "linear-gradient(180deg, #0E1B3D 0%, #0A1530 100%)" }}>
          {/* Panel Header */}
          <div className="px-4 pt-4 pb-3 border-b border-[#1E3A6E]/40">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono text-[#94A3B8] font-medium">
                  Selecione os modulos ({availableSources.length} disponiveis)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-[10px] font-mono font-bold text-[#FF6B2C] hover:text-[#FF6B2C]/80 px-2 py-1 rounded hover:bg-[#FF6B2C]/10 transition-colors"
                >
                  {selected.size === filteredSources.length ? "Desmarcar Todos" : "Selecionar Todos"}
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]" />
              <input
                type="text"
                placeholder="Buscar modulo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-[#162044] border border-[#1E3A6E]/50 text-white placeholder-[#475569] rounded-md focus:outline-none focus:border-[#FF6B2C]/50 transition-colors"
              />
            </div>
          </div>

          {/* Modules Grid grouped by section */}
          <div className="px-4 py-3 max-h-[500px] overflow-y-auto scrollbar-thin">
            {Object.entries(groupedSources).map(([section, sources]) => (
              <div key={section} className="mb-4 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-mono font-bold text-[#FF6B2C]/80 uppercase tracking-[1.5px]">
                    {section}
                  </h4>
                  <button
                    onClick={() => selectSection(section)}
                    className="text-[9px] font-mono text-[#64748B] hover:text-[#FF6B2C] transition-colors"
                  >
                    {sources.every(s => selected.has(s.key)) ? "desmarcar" : "selecionar"} secao
                  </button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {sources.map((source) => {
                    const Icon = source.icon;
                    const isSelected = selected.has(source.key);
                    const pulled = pulledData.find(p => p.moduleKey === source.key);

                    return (
                      <button
                        key={source.key}
                        onClick={() => toggleSelect(source.key)}
                        className={`group/card flex items-center gap-2.5 p-2.5 border text-left transition-all duration-150 rounded-md ${
                          isSelected
                            ? "border-[#FF6B2C]/50 bg-[#FF6B2C]/8 shadow-sm shadow-[#FF6B2C]/10"
                            : "border-[#1E3A6E]/40 hover:border-[#1E3A6E]/70 hover:bg-[#162044]/80"
                        }`}
                        style={{ background: isSelected ? undefined : "rgba(22, 32, 68, 0.4)" }}
                      >
                        {/* Checkbox */}
                        <div className="flex-shrink-0">
                          {isSelected ? (
                            <div className="w-4 h-4 rounded bg-[#FF6B2C] flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded border border-[#1E3A6E]/60 group-hover/card:border-[#475569]" />
                          )}
                        </div>

                        {/* Icon */}
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected ? "bg-[#FF6B2C]/20" : "bg-[#1E3A6E]/30 group-hover/card:bg-[#1E3A6E]/50"
                        }`}>
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-[#FF6B2C]" : "text-[#64748B] group-hover/card:text-[#94A3B8]"}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <span className={`text-[11px] font-mono font-semibold truncate block ${
                            isSelected ? "text-white" : "text-[#CBD5E1] group-hover/card:text-white"
                          }`}>
                            {source.label}
                          </span>
                          <p className="text-[9px] font-mono text-[#475569] leading-tight truncate">
                            {source.description}
                          </p>
                          {pulled && (
                            <span className="text-[9px] font-mono text-[#22C55E] font-bold">
                              {pulled.data.length} importados
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredSources.length === 0 && (
              <div className="text-center py-8">
                <Search className="w-5 h-5 text-[#475569] mx-auto mb-2" />
                <p className="text-xs font-mono text-[#475569]">Nenhum modulo encontrado</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#1E3A6E]/40 bg-[#0A1530]/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-[#64748B]">
                  <span className="text-white font-bold">{selected.size}</span> de {availableSources.length} selecionado(s)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSelected(new Set()); setIsOpen(false); setSearchTerm(""); }}
                  className="px-4 py-2 text-xs font-mono text-[#64748B] hover:text-white rounded-md hover:bg-[#1E3A6E]/30 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePullData}
                  disabled={loading || selected.size === 0}
                  className="px-5 py-2 text-xs font-mono font-bold bg-gradient-to-r from-[#FF6B2C] to-[#E85D1C] text-white rounded-md hover:from-[#FF7B3C] hover:to-[#FF6B2C] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-md shadow-[#FF6B2C]/20 disabled:shadow-none"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      Puxar Dados
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Summary of pulled data */}
          {pulledData.length > 0 && (
            <div className="px-4 py-3 border-t border-[#1E3A6E]/30 bg-[#0A1530]/50">
              <p className="text-[10px] font-mono text-[#94A3B8] mb-2 uppercase tracking-[1.5px] font-bold">
                Dados importados nesta sessão
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pulledData.map((p) => (
                  <span
                    key={p.moduleKey}
                    className="text-[10px] font-mono bg-[#22C55E]/10 text-[#22C55E] px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-[#22C55E]/20"
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
