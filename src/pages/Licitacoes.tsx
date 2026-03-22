import { useEffect, useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import {
  FileText, Search, ExternalLink, Calendar, MapPin, DollarSign,
  RefreshCw, ArrowLeft, Download, Database, Clock, Globe, Filter,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Licitacao {
  id: string;
  titulo: string;
  orgao: string;
  estado: string;
  categoria: string;
  data_abertura: string;
  valor_estimado: number;
  valor_estimado_fmt: string;
  link: string;
  modalidade: string;
  numero_controle: string;
  verificado: boolean;
  fonte?: string;
}

const UF_OPTIONS = [
  "Todos", "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
  "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ",
  "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

const CATEGORIAS = [
  "Todas", "Saneamento", "Infraestrutura", "Construção Civil", "Engenharia",
  "Eng. Estrutural", "Eng. Elétrica", "Eng. Ambiental", "Recursos Hídricos", "Drenagem",
];

const MODALIDADES = [
  { id: 0, nome: "Todas" },
  { id: 4, nome: "Concorrência Eletrônica" },
  { id: 5, nome: "Concorrência Presencial" },
  { id: 6, nome: "Pregão Eletrônico" },
  { id: 7, nome: "Pregão Presencial" },
  { id: 8, nome: "Dispensa de Licitação" },
  { id: 9, nome: "Inexigibilidade" },
  { id: 12, nome: "Credenciamento" },
];

const FAIXAS_VALOR = [
  { label: "Todos", min: 0, max: Infinity },
  { label: "Até R$ 100 mil", min: 0, max: 100000 },
  { label: "R$ 100 mil – R$ 1 mi", min: 100000, max: 1000000 },
  { label: "R$ 1 mi – R$ 10 mi", min: 1000000, max: 10000000 },
  { label: "R$ 10 mi – R$ 100 mi", min: 10000000, max: 100000000 },
  { label: "Acima de R$ 100 mi", min: 100000000, max: Infinity },
];

const QUICK_TERMS = [
  "saneamento", "ETA tratamento água", "ETE esgoto", "adutora",
  "rede de esgoto", "drenagem", "barragem", "reservatório",
  "pavimentação", "ponte", "UBS saúde",
];

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return dateStr; }
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

type SortKey = "valor_desc" | "valor_asc" | "data_desc" | "data_asc";

export default function Licitacoes() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"local" | "pncp">("local");

  // Base Local state
  const [localLicitacoes, setLocalLicitacoes] = useState<Licitacao[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [totalNaBase, setTotalNaBase] = useState(0);
  const [ultimaColeta, setUltimaColeta] = useState<string | null>(null);
  const [coletando, setColetando] = useState(false);
  const [fonteLocal, setFonteLocal] = useState<"supabase" | "placeholder">("placeholder");

  // PNCP Tempo Real state
  const [pncpLicitacoes, setPncpLicitacoes] = useState<Licitacao[]>([]);
  const [pncpLoading, setPncpLoading] = useState(false);
  const [pncpTermo, setPncpTermo] = useState("saneamento");
  const [pncpUf, setPncpUf] = useState("Todos");
  const [pncpDias, setPncpDias] = useState(30);
  const [pncpSearched, setPncpSearched] = useState(false);

  // Filters (shared)
  const [searchFilter, setSearchFilter] = useState("");
  const [catFilter, setCatFilter] = useState("Todas");
  const [ufFilter, setUfFilter] = useState("Todos");
  const [faixaFilter, setFaixaFilter] = useState(0);
  const [modFilter, setModFilter] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("data_desc");
  const [showFilters, setShowFilters] = useState(false);

  // ─── Base Local: load from Supabase or JSON fallback ───
  const fetchLocalData = useCallback(async () => {
    setLocalLoading(true);
    try {
      // Try Supabase first
      const { data, error } = await supabase
        .from("hub_licitacoes")
        .select("*")
        .order("data_abertura", { ascending: false })
        .limit(1000);

      if (!error && data && data.length > 0) {
        setLocalLicitacoes(data.map((item: Record<string, unknown>, idx: number) => ({
          id: String(item.id || idx + 1),
          titulo: String(item.titulo || ""),
          orgao: String(item.orgao || ""),
          estado: String(item.estado || "BR"),
          categoria: String(item.categoria || "Engenharia"),
          data_abertura: String(item.data_abertura || ""),
          valor_estimado: Number(item.valor_estimado) || 0,
          valor_estimado_fmt: String(item.valor_estimado_fmt || ""),
          link: String(item.link || ""),
          modalidade: String(item.modalidade || ""),
          numero_controle: String(item.numero_controle || ""),
          verificado: Boolean(item.verificado),
          fonte: "Supabase",
        })));
        setFonteLocal("supabase");
        setTotalNaBase(data.length);

        // Fetch last collection metadata
        const { data: metaData } = await supabase
          .from("hub_coleta_meta")
          .select("*")
          .eq("tipo", "licitacoes")
          .eq("status", "ok")
          .order("created_at", { ascending: false })
          .limit(1);

        if (metaData && metaData.length > 0) {
          setUltimaColeta(metaData[0].ultima_coleta);
        }
        return;
      }
    } catch { /* fallback below */ }

    // Fallback: static JSON
    try {
      const res = await fetch("/hub/licitacoes.json");
      if (res.ok) {
        const json = await res.json();
        setLocalLicitacoes(json.licitacoes || []);
        setFonteLocal("placeholder");
        setTotalNaBase(json.licitacoes?.length || 0);
      }
    } catch {
      toast.error("Erro ao carregar licitações locais.");
    } finally {
      setLocalLoading(false);
    }
  }, []);

  useEffect(() => { fetchLocalData(); }, [fetchLocalData]);

  // ─── Collector: invoke Edge Function ───
  const handleColetar = async (dias: number) => {
    setColetando(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        toast.error("Você precisa estar logado para coletar licitações.");
        return;
      }

      toast.info(`Coletando licitações dos últimos ${dias} dias do PNCP...`);

      const { data, error } = await supabase.functions.invoke(
        "hub-coletar-licitacoes",
        { body: { dias } }
      );

      if (error) throw error;

      toast.success(
        `Coleta concluída! ${data.total_unicos} licitações processadas (${data.total_na_base} total na base)`
      );

      await fetchLocalData();
    } catch (err) {
      console.error("Erro na coleta:", err);
      toast.error("Erro ao coletar licitações. Tente novamente.");
    } finally {
      setColetando(false);
    }
  };

  // ─── PNCP Tempo Real: search via Edge Function proxy ───
  const handleBuscarPNCP = async () => {
    if (!pncpTermo.trim()) {
      toast.error("Informe um termo de busca.");
      return;
    }

    setPncpLoading(true);
    setPncpSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("hub-buscar-pncp", {
        body: {
          termo: pncpTermo.trim(),
          uf: pncpUf === "Todos" ? null : pncpUf,
          dias: pncpDias,
        },
      });

      if (error) throw error;

      setPncpLicitacoes(data.licitacoes || []);

      if (data.licitacoes?.length > 0) {
        toast.success(`${data.total} licitações encontradas no PNCP`);
      } else {
        toast.info("Nenhuma licitação encontrada para esse termo. Tente palavras-chave diferentes.");
      }
    } catch (err) {
      console.error("Erro ao buscar PNCP:", err);
      toast.error("Erro ao buscar no PNCP. Verifique se está logado e tente novamente.");
    } finally {
      setPncpLoading(false);
    }
  };

  // ─── Filtering + sorting ───
  const currentList = activeTab === "local" ? localLicitacoes : pncpLicitacoes;
  const faixa = FAIXAS_VALOR[faixaFilter];

  const filtered = currentList.filter((l) => {
    if (searchFilter && !`${l.titulo} ${l.orgao}`.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    if (catFilter !== "Todas" && l.categoria !== catFilter) return false;
    if (ufFilter !== "Todos" && l.estado !== ufFilter) return false;
    if (faixa && l.valor_estimado < faixa.min) return false;
    if (faixa && l.valor_estimado > faixa.max) return false;
    if (modFilter > 0) {
      const modNome = MODALIDADES.find((m) => m.id === modFilter)?.nome;
      if (modNome && l.modalidade !== modNome) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case "valor_desc": return (b.valor_estimado || 0) - (a.valor_estimado || 0);
      case "valor_asc": return (a.valor_estimado || 0) - (b.valor_estimado || 0);
      case "data_asc": return (a.data_abertura || "").localeCompare(b.data_abertura || "");
      default: return (b.data_abertura || "").localeCompare(a.data_abertura || "");
    }
  });

  const totalValor = filtered.reduce((s, l) => s + (l.valor_estimado || 0), 0);

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 min-h-screen bg-background">
        {/* Top bar */}
        <div className="sticky top-0 z-30 border-b px-3 sm:px-6 py-3 flex items-center justify-between gap-2 bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <SidebarTrigger />
            <NavLink to="/dashboard" className="p-2 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </NavLink>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold font-mono tracking-tight truncate">
                Buscador de Licitações
              </h1>
              <p className="text-[10px] sm:text-xs font-mono text-muted-foreground hidden sm:block">
                Licitações de engenharia e saneamento do Portal Nacional de Contratações Públicas (PNCP)
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-6">
          {/* Tab Switcher */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab("local")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-mono font-semibold border transition-all ${
                activeTab === "local"
                  ? "bg-white/10 text-white border-white/20"
                  : "text-[#64748B] border-[#1E3A6E] hover:border-white/20"
              }`}
            >
              <Database className="w-4 h-4" />
              Base Local
              {totalNaBase > 0 && (
                <span className="text-[10px] bg-[#3B82F6]/20 text-[#3B82F6] px-1.5 py-0.5 ml-1">
                  {totalNaBase}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("pncp")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-mono font-semibold border transition-all ${
                activeTab === "pncp"
                  ? "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30"
                  : "text-[#64748B] border-[#1E3A6E] hover:border-[#22C55E]/30"
              }`}
            >
              <Globe className="w-4 h-4" />
              PNCP Tempo Real
            </button>
          </div>

          {/* ═══════ TAB: BASE LOCAL ═══════ */}
          {activeTab === "local" && (
            <div>
              {/* Collection Panel */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border border-[#3B82F6]/30 mb-4"
                style={{ background: "rgba(59, 130, 246, 0.06)" }}>
                <Download className="w-4 h-4 text-[#3B82F6] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-mono font-semibold text-[#3B82F6]">
                    Coletor PNCP → Supabase
                  </p>
                  <p className="text-[10px] font-mono text-[#3B82F6]/60 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {ultimaColeta
                      ? `Última coleta: ${new Date(ultimaColeta).toLocaleString("pt-BR")}`
                      : "Nenhuma coleta realizada ainda"}
                    {fonteLocal === "placeholder" && " • Dados ilustrativos (JSON)"}
                    {fonteLocal === "supabase" && ` • ${totalNaBase} licitações na base`}
                  </p>
                </div>
                {[7, 15, 30].map((d) => (
                  <button key={d} onClick={() => handleColetar(d)} disabled={coletando}
                    className={`text-[10px] sm:text-xs font-mono px-2 sm:px-3 py-1.5 border transition-colors disabled:opacity-50 ${
                      d === 30
                        ? "bg-[#FF6B2C]/20 text-[#FF6B2C] hover:bg-[#FF6B2C]/30 border-[#FF6B2C]/30"
                        : "bg-[#3B82F6]/20 text-[#3B82F6] hover:bg-[#3B82F6]/30 border-[#3B82F6]/30"
                    }`}>
                    {coletando ? "Coletando..." : `${d} dias`}
                  </button>
                ))}
              </div>

              {fonteLocal === "placeholder" && (
                <div className="flex items-center gap-2 px-3 py-2 border border-[#F59E0B]/30 mb-4 text-[#F59E0B]"
                  style={{ background: "rgba(245, 158, 11, 0.08)" }}>
                  <span className="text-xs font-mono">
                    ⚠ Dados ilustrativos — Clique em <strong>7, 15 ou 30 dias</strong> acima para coletar licitações reais do PNCP.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ═══════ TAB: PNCP TEMPO REAL ═══════ */}
          {activeTab === "pncp" && (
            <div>
              <div className="border border-[#22C55E]/30 px-4 py-4 mb-4" style={{ background: "rgba(34, 197, 94, 0.05)" }}>
                <p className="text-xs font-mono text-[#22C55E] mb-3 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  Busca em tempo real no Portal Nacional de Contratações Públicas
                </p>

                <div className="flex flex-wrap gap-2 mb-3">
                  <div className="relative flex-1 min-w-[250px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                    <input
                      type="text"
                      placeholder="Ex.: saneamento, ETE esgoto, pavimentação..."
                      value={pncpTermo}
                      onChange={(e) => setPncpTermo(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleBuscarPNCP()}
                      className="w-full pl-9 pr-3 py-2.5 text-sm font-mono bg-[#162044] border border-[#1E3A6E] text-white placeholder-[#64748B] focus:border-[#22C55E]/50 outline-none"
                    />
                  </div>
                  <select value={pncpUf} onChange={(e) => setPncpUf(e.target.value)}
                    className="text-xs font-mono bg-[#162044] border border-[#1E3A6E] text-white px-3 py-2 focus:border-[#22C55E]/50 outline-none w-20">
                    {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                  <select value={pncpDias} onChange={(e) => setPncpDias(Number(e.target.value))}
                    className="text-xs font-mono bg-[#162044] border border-[#1E3A6E] text-white px-3 py-2 focus:border-[#22C55E]/50 outline-none">
                    <option value={7}>7 dias</option>
                    <option value={15}>15 dias</option>
                    <option value={30}>30 dias</option>
                    <option value={60}>60 dias</option>
                    <option value={90}>90 dias</option>
                  </select>
                  <button onClick={handleBuscarPNCP} disabled={pncpLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-mono font-semibold bg-[#22C55E] text-[#0E1B3D] hover:bg-[#16A34A] transition-colors disabled:opacity-50">
                    {pncpLoading ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Buscando...</>
                    ) : (
                      <><Search className="w-4 h-4" /> Buscar PNCP</>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-mono text-[#64748B]">Busca rápida:</span>
                  {QUICK_TERMS.map((t) => (
                    <button key={t} onClick={() => { setPncpTermo(t); }}
                      className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
                        pncpTermo === t
                          ? "bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/30"
                          : "text-[#64748B] border-[#1E3A6E] hover:text-white hover:border-white/20"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════ SHARED: Filters + Results ═══════ */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input type="text" placeholder="Filtrar resultados por título ou órgão..."
                value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-[#162044] border border-[#1E3A6E] text-white placeholder-[#64748B] focus:border-[#FF6B2C]/50 outline-none" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 text-xs font-mono px-3 py-2 border transition-colors ${
                showFilters ? "text-[#FF6B2C] border-[#FF6B2C]/30" : "text-[#64748B] border-[#1E3A6E] hover:border-[#FF6B2C]/30"
              }`}>
              <Filter className="w-3.5 h-3.5" /> Filtros <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="text-xs font-mono bg-[#162044] border border-[#1E3A6E] text-white px-2 py-2 outline-none">
              <option value="data_desc">Mais recentes</option>
              <option value="data_asc">Mais antigos</option>
              <option value="valor_desc">Maior valor</option>
              <option value="valor_asc">Menor valor</option>
            </select>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-3 border border-[#1E3A6E]" style={{ background: "hsl(var(--card))" }}>
              <div>
                <label className="text-[10px] font-mono text-[#64748B] uppercase tracking-wider block mb-1">Estado</label>
                <select value={ufFilter} onChange={(e) => setUfFilter(e.target.value)}
                  className="text-xs font-mono bg-[#0E1B3D] border border-[#1E3A6E] text-white px-2 py-1.5 outline-none">
                  {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#64748B] uppercase tracking-wider block mb-1">Categoria</label>
                <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
                  className="text-xs font-mono bg-[#0E1B3D] border border-[#1E3A6E] text-white px-2 py-1.5 outline-none">
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#64748B] uppercase tracking-wider block mb-1">Modalidade</label>
                <select value={modFilter} onChange={(e) => setModFilter(Number(e.target.value))}
                  className="text-xs font-mono bg-[#0E1B3D] border border-[#1E3A6E] text-white px-2 py-1.5 outline-none">
                  {MODALIDADES.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#64748B] uppercase tracking-wider block mb-1">Faixa de Valor</label>
                <select value={faixaFilter} onChange={(e) => setFaixaFilter(Number(e.target.value))}
                  className="text-xs font-mono bg-[#0E1B3D] border border-[#1E3A6E] text-white px-2 py-1.5 outline-none">
                  {FAIXAS_VALOR.map((f, i) => <option key={i} value={i}>{f.label}</option>)}
                </select>
              </div>
              {(catFilter !== "Todas" || ufFilter !== "Todos" || faixaFilter > 0 || modFilter > 0) && (
                <button onClick={() => { setCatFilter("Todas"); setUfFilter("Todos"); setFaixaFilter(0); setModFilter(0); }}
                  className="text-[10px] font-mono text-[#FF6B2C] hover:text-[#FF6B2C]/80 px-2 py-2 mt-3">
                  Limpar filtros
                </button>
              )}
            </div>
          )}

          {/* Summary bar */}
          <div className="flex items-center gap-3 mb-4 text-xs font-mono text-[#64748B]">
            <span className="text-white font-semibold">{sorted.length} licitações</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Total: <span className="text-[#22C55E] font-semibold">{formatCurrency(totalValor)}</span>
            </span>
            {activeTab === "pncp" && pncpSearched && (
              <>
                <span>•</span>
                <span className="text-[#22C55E]">Fonte: PNCP (tempo real)</span>
              </>
            )}
            {activeTab === "local" && fonteLocal === "supabase" && (
              <>
                <span>•</span>
                <span className="text-[#3B82F6]">Fonte: Supabase</span>
              </>
            )}
          </div>

          {/* Results */}
          {(activeTab === "local" && localLoading) || (activeTab === "pncp" && pncpLoading) ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="w-6 h-6 text-[#FF6B2C] animate-spin" />
            </div>
          ) : sorted.length > 0 ? (
            <div className="grid gap-3">
              {sorted.map((lic) => (
                <a key={lic.id} href={lic.link} target="_blank" rel="noopener noreferrer"
                  className="block border border-[#1E3A6E] p-4 hover:border-[#FF6B2C]/50 transition-all duration-200 group"
                  style={{ background: "hsl(var(--card))" }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-[#3B82F6]/15 text-[#3B82F6] uppercase tracking-wider">
                          {lic.modalidade}
                        </span>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-[#FF6B2C]/15 text-[#FF6B2C] uppercase tracking-wider">
                          {lic.categoria}
                        </span>
                      </div>
                      <h3 className="text-sm font-mono font-semibold text-[#F8FAFC] group-hover:text-[#FF6B2C] transition-colors leading-relaxed">
                        {lic.titulo}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-mono text-[#64748B]">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {lic.orgao} — {lic.estado}
                        </span>
                        {lic.data_abertura && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(lic.data_abertura)}
                          </span>
                        )}
                        {lic.verificado && (
                          <span className="text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5">Verificado</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-sm font-mono font-bold text-[#22C55E]">
                        {lic.valor_estimado_fmt || formatCurrency(lic.valor_estimado)}
                      </span>
                      <ExternalLink className="w-4 h-4 text-[#64748B] group-hover:text-[#FF6B2C] transition-colors" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              {activeTab === "pncp" && !pncpSearched ? (
                <>
                  <Globe className="w-10 h-10 text-[#22C55E]/30 mb-3" />
                  <p className="text-sm font-mono font-semibold text-white">Busque licitações em tempo real</p>
                  <p className="text-xs font-mono text-[#64748B] mt-1 max-w-md">
                    Digite um termo acima e clique em "Buscar PNCP" para consultar o portal oficial.
                  </p>
                  <p className="text-[10px] font-mono text-[#64748B] mt-2">
                    Fonte: pncp.gov.br — Portal Nacional de Contratações Públicas
                  </p>
                </>
              ) : (
                <>
                  <FileText className="w-10 h-10 text-[#64748B]/30 mb-3" />
                  <p className="text-sm font-mono text-[#64748B]">
                    Nenhuma licitação encontrada para os filtros selecionados.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </SidebarProvider>
  );
}
