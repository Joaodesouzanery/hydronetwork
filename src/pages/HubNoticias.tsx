import { useEffect, useState, useMemo } from "react";
import { useSearchParams, NavLink } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Newspaper, FileText, Link2, ExternalLink, Calendar,
  MapPin, DollarSign, AlertTriangle, RefreshCw, ArrowLeft,
  Search, Shield, ArrowRightLeft,
  Download, Database, Clock, BarChart3, Building2,
  TrendingUp, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Noticia {
  titulo: string;
  link: string;
  data_publicacao: string;
  fonte: string;
  verificado: boolean;
  imagem?: string;
}

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
}

interface Empresa {
  nome: string;
  cnpj: string;
  cnpj_valido: boolean;
  setor: string;
  uf: string;
  tipo: string;
  b3?: string;
}

interface VinculoVerificado {
  empresa_a: string;
  empresa_b: string;
  tipo: string;
  risco: string;
  verificado: boolean;
  fonte: string;
  descricao: string;
}

const isRecent = (dateStr: string, hoursThreshold = 72) => {
  try {
    return (Date.now() - new Date(dateStr).getTime()) < hoursThreshold * 3600000;
  } catch { return false; }
};

const RISCO_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  alto: { bg: "bg-red-500/15", text: "text-red-400", label: "Alto" },
  medio: { bg: "bg-orange-500/15", text: "text-orange-400", label: "Médio" },
  baixo: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Baixo" },
};

const VINCULO_LABELS: Record<string, string> = {
  socio_comum: "Sócio Comum",
  parentesco: "Parentesco",
  diretor_multiplo: "Diretor Múltiplo",
};

const TABS = [
  { id: "noticias", label: "Notícias", icon: Newspaper },
  { id: "licitacoes", label: "Licitações", icon: FileText },
  { id: "vinculos", label: "Vínculos", icon: Link2 },
  { id: "indicadores", label: "Indicadores", icon: BarChart3 },
] as const;

export default function HubNoticias() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "noticias";

  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [vinculos, setVinculos] = useState<VinculoVerificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFonte, setSelectedFonte] = useState<string>("");
  const [licSearchTerm, setLicSearchTerm] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("");
  const [selectedEstado, setSelectedEstado] = useState<string>("");
  const [coletando, setColetando] = useState(false);
  const [ultimaColeta, setUltimaColeta] = useState<string | null>(null);
  const [totalNaBase, setTotalNaBase] = useState(0);
  const [dataSource, setDataSource] = useState<"placeholder" | "supabase" | "json">("placeholder");
  const [empresaSearch, setEmpresaSearch] = useState("");

  const switchTab = (newTab: string) => {
    setSearchParams({ tab: newTab });
  };

  const fetchLicitacoesSupabase = async (): Promise<Licitacao[]> => {
    const { data, error } = await supabase
      .from("hub_licitacoes")
      .select("*")
      .order("data_abertura", { ascending: false })
      .limit(500);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    return data.map((item: Record<string, unknown>, idx: number) => ({
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
    }));
  };

  const fetchUltimaColeta = async () => {
    const { data } = await supabase
      .from("hub_coleta_meta")
      .select("*")
      .eq("tipo", "licitacoes")
      .eq("status", "ok")
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setUltimaColeta(data[0].ultima_coleta);
    }

    const { count } = await supabase
      .from("hub_licitacoes")
      .select("*", { count: "exact", head: true });
    setTotalNaBase(count || 0);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [notRes, vincRes] = await Promise.all([
        fetch("/hub/noticias.json"),
        fetch("/hub/vinculos.json"),
      ]);

      if (notRes.ok) {
        const notData = await notRes.json();
        setNoticias(notData.noticias || []);
      }

      if (vincRes.ok) {
        const vincData = await vincRes.json();
        setEmpresas(vincData.empresas_monitoradas || []);
        setVinculos(vincData.vinculos_verificados || []);
      }

      try {
        const licSupabase = await fetchLicitacoesSupabase();
        if (licSupabase.length > 0) {
          setLicitacoes(licSupabase);
          setDataSource("supabase");
          await fetchUltimaColeta();
        } else {
          const licRes = await fetch("/hub/licitacoes.json");
          if (licRes.ok) {
            const licData = await licRes.json();
            setLicitacoes(licData.licitacoes || []);
            setDataSource(licData._meta?.fonte_dados === "placeholder" ? "placeholder" : "json");
          }
        }
      } catch {
        const licRes = await fetch("/hub/licitacoes.json");
        if (licRes.ok) {
          const licData = await licRes.json();
          setLicitacoes(licData.licitacoes || []);
          setDataSource("json");
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados do hub:", err);
      toast.error("Erro ao carregar dados do hub.");
    } finally {
      setLoading(false);
    }
  };

  const handleColetarLicitacoes = async (dias = 15) => {
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

      await fetchData();
    } catch (err) {
      console.error("Erro na coleta:", err);
      toast.error("Erro ao coletar licitações. Tente novamente.");
    } finally {
      setColetando(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchData();
      toast.success("Dados atualizados!");
    } catch {
      toast.error("Erro ao atualizar dados");
    } finally {
      setRefreshing(false);
    }
  };

  const fontes = useMemo(() => [...new Set(noticias.map(n => n.fonte))], [noticias]);
  const categorias = useMemo(() => [...new Set(licitacoes.map(l => l.categoria))].sort(), [licitacoes]);
  const estados = useMemo(() => [...new Set(licitacoes.map(l => l.estado))].sort(), [licitacoes]);

  const filteredNoticias = useMemo(() => noticias.filter(n => {
    const matchSearch = !searchTerm || n.titulo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchFonte = !selectedFonte || n.fonte === selectedFonte;
    return matchSearch && matchFonte;
  }), [noticias, searchTerm, selectedFonte]);

  const filteredLicitacoes = useMemo(() => licitacoes.filter(l => {
    const matchSearch = !licSearchTerm || l.titulo.toLowerCase().includes(licSearchTerm.toLowerCase()) || l.orgao.toLowerCase().includes(licSearchTerm.toLowerCase());
    const matchCategoria = !selectedCategoria || l.categoria === selectedCategoria;
    const matchEstado = !selectedEstado || l.estado === selectedEstado;
    return matchSearch && matchCategoria && matchEstado;
  }), [licitacoes, licSearchTerm, selectedCategoria, selectedEstado]);

  const filteredEmpresas = useMemo(() => empresas.filter(e => {
    if (!empresaSearch) return true;
    const q = empresaSearch.toLowerCase();
    return e.nome.toLowerCase().includes(q) || e.setor.toLowerCase().includes(q) || e.uf.toLowerCase().includes(q);
  }), [empresas, empresaSearch]);

  const totalValorLicitacoes = useMemo(
    () => licitacoes.reduce((sum, l) => sum + (l.valor_estimado || 0), 0),
    [licitacoes]
  );

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) {
      return `R$ ${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `R$ ${(value / 1_000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  // Skeleton loader
  const SkeletonCard = () => (
    <div className="border border-[#1E3A6E] p-4 animate-pulse" style={{ background: "#162044" }}>
      <div className="h-4 bg-[#1E3A6E] rounded w-3/4 mb-3" />
      <div className="h-3 bg-[#1E3A6E] rounded w-1/2 mb-2" />
      <div className="h-3 bg-[#1E3A6E] rounded w-1/3" />
    </div>
  );

  return (
    <SidebarProvider>
    <div className="min-h-screen flex w-full" style={{ background: "#0E1B3D" }}>
      <AppSidebar />

      <main className="flex-1 min-h-screen min-w-0">
        {/* Top bar */}
        <div
          className="sticky top-0 z-30 border-b border-[#1E3A6E] px-3 sm:px-6 py-3 flex items-center justify-between gap-2"
          style={{ background: "rgba(14, 27, 61, 0.95)", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-1 sm:gap-3 min-w-0">
            <SidebarTrigger className="text-[#64748B] hover:text-[#FF6B2C] md:hidden" />
            <NavLink
              to="/dashboard"
              className="p-1.5 sm:p-2 hover:bg-[#FF6B2C]/10 rounded transition-colors text-[#64748B] hover:text-[#FF6B2C] flex-shrink-0"
              title="Voltar ao Dashboard"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </NavLink>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold font-mono text-white tracking-tight truncate">
                Hub de Notícias
              </h1>
              <p className="text-[10px] sm:text-xs font-mono text-[#64748B] hidden sm:block">
                Inteligência para engenharia e saneamento
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {dataSource === "supabase" && (
              <span className="text-[10px] sm:text-xs font-mono px-2 py-1 text-[#22C55E] bg-[#22C55E]/10 hidden sm:inline-flex items-center gap-1 rounded">
                <Database className="w-3 h-3" /> Ao vivo
              </span>
            )}
            {dataSource === "placeholder" && (
              <span className="text-[10px] sm:text-xs font-mono px-2 py-1 text-[#F59E0B] bg-[#F59E0B]/10 hidden sm:inline-flex items-center gap-1 rounded">
                <AlertTriangle className="w-3 h-3" /> Dados ilustrativos
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-[#FF6B2C]/10 rounded transition-colors text-[#64748B] hover:text-[#FF6B2C] disabled:opacity-50"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="sticky top-[57px] z-20 border-b border-[#1E3A6E] px-3 sm:px-6"
          style={{ background: "rgba(14, 27, 61, 0.95)", backdropFilter: "blur(8px)" }}>
          <nav className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px">
            {TABS.map(t => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-sm font-mono font-medium border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? "border-[#FF6B2C] text-[#FF6B2C]"
                      : "border-transparent text-[#64748B] hover:text-white hover:border-[#1E3A6E]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">{t.label}</span>
                  <span className="xs:hidden">{t.label.slice(0, 3)}</span>
                  {t.id === "noticias" && noticias.length > 0 && (
                    <span className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full hidden sm:inline ${isActive ? "bg-[#FF6B2C]/20" : "bg-[#1E3A6E]"}`}>
                      {noticias.length}
                    </span>
                  )}
                  {t.id === "licitacoes" && licitacoes.length > 0 && (
                    <span className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full hidden sm:inline ${isActive ? "bg-[#FF6B2C]/20" : "bg-[#1E3A6E]"}`}>
                      {totalNaBase || licitacoes.length}
                    </span>
                  )}
                  {t.id === "vinculos" && empresas.length > 0 && (
                    <span className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full hidden sm:inline ${isActive ? "bg-[#FF6B2C]/20" : "bg-[#1E3A6E]"}`}>
                      {empresas.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Summary Stats Row */}
        {!loading && (
          <div className="px-3 sm:px-6 pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <button onClick={() => switchTab("noticias")} className="border border-[#1E3A6E] hover:border-[#FF6B2C]/30 p-3 transition-colors text-left rounded" style={{ background: "#162044" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Newspaper className="w-3.5 h-3.5 text-[#FF6B2C]" />
                  <span className="text-[10px] font-mono text-[#64748B] uppercase">Notícias</span>
                </div>
                <p className="text-xl font-bold font-mono text-white">{noticias.length}</p>
              </button>
              <button onClick={() => switchTab("licitacoes")} className="border border-[#1E3A6E] hover:border-[#3B82F6]/30 p-3 transition-colors text-left rounded" style={{ background: "#162044" }}>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span className="text-[10px] font-mono text-[#64748B] uppercase">Licitações</span>
                </div>
                <p className="text-xl font-bold font-mono text-white">{totalNaBase || licitacoes.length}</p>
              </button>
              <button onClick={() => switchTab("vinculos")} className="border border-[#1E3A6E] hover:border-[#22C55E]/30 p-3 transition-colors text-left rounded" style={{ background: "#162044" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span className="text-[10px] font-mono text-[#64748B] uppercase">Empresas</span>
                </div>
                <p className="text-xl font-bold font-mono text-white">{empresas.length}</p>
              </button>
              <button onClick={() => switchTab("indicadores")} className="border border-[#1E3A6E] hover:border-[#F59E0B]/30 p-3 transition-colors text-left rounded" style={{ background: "#162044" }}>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span className="text-[10px] font-mono text-[#64748B] uppercase">Valor Total</span>
                </div>
                <p className="text-xl font-bold font-mono text-white">{formatCurrency(totalValorLicitacoes)}</p>
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-3 sm:p-6 pt-3 sm:pt-4">
          {loading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            <>
              {/* ============ Tab: Notícias ============ */}
              {(tab === "noticias" || !tab) && (
                <div>
                  {/* Filtros */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                      <input
                        type="text"
                        placeholder="Buscar notícias..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-[#162044] border border-[#1E3A6E] rounded text-white placeholder-[#64748B] focus:border-[#FF6B2C]/50 outline-none transition-colors"
                      />
                    </div>
                    <select
                      value={selectedFonte}
                      onChange={e => setSelectedFonte(e.target.value)}
                      className="text-xs font-mono bg-[#162044] border border-[#1E3A6E] rounded text-white px-3 py-2 focus:border-[#FF6B2C]/50 outline-none"
                    >
                      <option value="">Todas as fontes</option>
                      {fontes.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    {(searchTerm || selectedFonte) && (
                      <button
                        onClick={() => { setSearchTerm(""); setSelectedFonte(""); }}
                        className="text-[10px] font-mono text-[#FF6B2C] hover:text-[#FF6B2C]/80 px-2 py-2"
                      >
                        Limpar filtros
                      </button>
                    )}
                    <span className="text-[10px] font-mono text-[#64748B] ml-auto">
                      {filteredNoticias.length} resultado{filteredNoticias.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="grid gap-3">
                    {filteredNoticias.map((noticia, idx) => (
                      <a
                        key={idx}
                        href={noticia.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border border-[#1E3A6E] rounded p-4 hover:border-[#FF6B2C]/50 transition-all duration-200 group"
                        style={{ background: "#162044" }}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          {noticia.imagem && (
                            <img
                              src={noticia.imagem}
                              alt=""
                              className="w-14 h-14 sm:w-20 sm:h-20 object-cover rounded flex-shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              <h3 className="text-sm font-mono font-semibold text-[#F8FAFC] group-hover:text-[#FF6B2C] transition-colors leading-relaxed flex-1">
                                {noticia.titulo}
                              </h3>
                              {isRecent(noticia.data_publicacao) && (
                                <span className="text-[9px] font-mono font-bold text-[#22C55E] bg-[#22C55E]/15 px-1.5 py-0.5 rounded flex-shrink-0">
                                  Nova
                                </span>
                              )}
                              <ExternalLink className="w-4 h-4 text-[#64748B] group-hover:text-[#FF6B2C] flex-shrink-0 mt-0.5 transition-colors" />
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs font-mono text-[#64748B]">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(noticia.data_publicacao)}
                              </span>
                              <span className="text-[#FF6B2C]/70 bg-[#FF6B2C]/5 px-1.5 py-0.5 rounded">
                                {noticia.fonte}
                              </span>
                              {noticia.verificado && (
                                <span className="text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <Shield className="w-2.5 h-2.5" /> Verificado
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </a>
                    ))}
                    {filteredNoticias.length === 0 && (
                      <div className="text-center py-16">
                        <Search className="w-10 h-10 text-[#1E3A6E] mx-auto mb-3" />
                        <p className="text-sm font-mono text-[#64748B]">
                          Nenhuma notícia encontrada para os filtros selecionados.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============ Tab: Licitações ============ */}
              {tab === "licitacoes" && (
                <div>
                  {/* Painel de Coleta */}
                  <div
                    className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border border-[#3B82F6]/30 rounded mb-4"
                    style={{ background: "rgba(59, 130, 246, 0.06)" }}
                  >
                    <Download className="w-4 h-4 text-[#3B82F6] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-mono font-semibold text-[#3B82F6]">
                        Coletor PNCP
                      </p>
                      {ultimaColeta && (
                        <p className="text-[10px] font-mono text-[#3B82F6]/60 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          Última coleta: {new Date(ultimaColeta).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                    {[7, 15, 30].map(dias => (
                      <button
                        key={dias}
                        onClick={() => handleColetarLicitacoes(dias)}
                        disabled={coletando}
                        className={`text-[10px] sm:text-xs font-mono px-2.5 sm:px-3 py-1.5 rounded border transition-colors disabled:opacity-50 ${
                          dias === 30
                            ? "bg-[#FF6B2C]/20 text-[#FF6B2C] hover:bg-[#FF6B2C]/30 border-[#FF6B2C]/30"
                            : "bg-[#3B82F6]/20 text-[#3B82F6] hover:bg-[#3B82F6]/30 border-[#3B82F6]/30"
                        }`}
                      >
                        {coletando ? "..." : `${dias} dias`}
                      </button>
                    ))}
                  </div>

                  {/* Filtros */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                      <input
                        type="text"
                        placeholder="Buscar por título ou órgão..."
                        value={licSearchTerm}
                        onChange={e => setLicSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-[#162044] border border-[#1E3A6E] rounded text-white placeholder-[#64748B] focus:border-[#FF6B2C]/50 outline-none transition-colors"
                      />
                    </div>
                    <select
                      value={selectedCategoria}
                      onChange={e => setSelectedCategoria(e.target.value)}
                      className="text-xs font-mono bg-[#162044] border border-[#1E3A6E] rounded text-white px-3 py-2 focus:border-[#FF6B2C]/50 outline-none"
                    >
                      <option value="">Todas categorias</option>
                      {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      value={selectedEstado}
                      onChange={e => setSelectedEstado(e.target.value)}
                      className="text-xs font-mono bg-[#162044] border border-[#1E3A6E] rounded text-white px-3 py-2 focus:border-[#FF6B2C]/50 outline-none"
                    >
                      <option value="">Todos UFs</option>
                      {estados.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    {(licSearchTerm || selectedCategoria || selectedEstado) && (
                      <button
                        onClick={() => { setLicSearchTerm(""); setSelectedCategoria(""); setSelectedEstado(""); }}
                        className="text-[10px] font-mono text-[#FF6B2C] hover:text-[#FF6B2C]/80 px-2 py-2"
                      >
                        Limpar
                      </button>
                    )}
                    <span className="text-[10px] font-mono text-[#64748B] ml-auto">
                      {filteredLicitacoes.length} resultado{filteredLicitacoes.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="grid gap-3">
                    {filteredLicitacoes.map((lic) => (
                      <a
                        key={lic.id}
                        href={lic.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border border-[#1E3A6E] rounded p-4 hover:border-[#FF6B2C]/50 transition-all duration-200 group"
                        style={{ background: "#162044" }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-mono font-semibold text-[#F8FAFC] group-hover:text-[#FF6B2C] transition-colors leading-relaxed line-clamp-2">
                              {lic.titulo}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 text-xs font-mono text-[#64748B]">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-[#3B82F6]" />
                                {lic.orgao}
                              </span>
                              <span className="text-[#94A3B8] bg-white/5 px-1.5 py-0.5 rounded">
                                {lic.estado}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(lic.data_abertura)}
                              </span>
                              <span className="flex items-center gap-1 text-[#22C55E] font-semibold">
                                <DollarSign className="w-3 h-3" />
                                {lic.valor_estimado_fmt || formatCurrencyFull(lic.valor_estimado)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[10px] font-mono text-[#FF6B2C]/70 bg-[#FF6B2C]/10 px-1.5 py-0.5 rounded">
                                {lic.modalidade}
                              </span>
                              <span className="text-[10px] font-mono text-[#3B82F6] bg-[#3B82F6]/10 px-1.5 py-0.5 rounded">
                                {lic.categoria}
                              </span>
                              {lic.verificado && (
                                <span className="text-[10px] font-mono text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <Shield className="w-2.5 h-2.5" /> Verificado
                                </span>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-[#64748B] group-hover:text-[#FF6B2C] flex-shrink-0 mt-1 transition-colors" />
                        </div>
                      </a>
                    ))}
                    {filteredLicitacoes.length === 0 && (
                      <div className="text-center py-16">
                        <FileText className="w-10 h-10 text-[#1E3A6E] mx-auto mb-3" />
                        <p className="text-sm font-mono text-[#64748B]">
                          Nenhuma licitação encontrada.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============ Tab: Vínculos ============ */}
              {tab === "vinculos" && (
                <div>
                  {/* Vínculos Verificados */}
                  {vinculos.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <ArrowRightLeft className="w-4 h-4 text-[#FF6B2C]" />
                        <h3 className="text-sm font-bold font-mono text-white">Vínculos Verificados</h3>
                        <span className="text-[10px] font-mono text-[#64748B] bg-[#1E3A6E] px-2 py-0.5 rounded">
                          {vinculos.length}
                        </span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {vinculos.map((vinculo, idx) => {
                          const risco = RISCO_COLORS[vinculo.risco] || RISCO_COLORS.baixo;
                          return (
                            <div
                              key={idx}
                              className={`border rounded p-4 transition-all duration-200 ${
                                vinculo.risco === "alto"
                                  ? "border-red-500/30 hover:border-red-500/60"
                                  : "border-[#1E3A6E] hover:border-[#FF6B2C]/50"
                              }`}
                              style={{ background: "#162044" }}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                  <span className="text-sm font-mono font-bold text-[#F8FAFC]">{vinculo.empresa_a}</span>
                                  <ArrowRightLeft className="w-3 h-3 text-[#64748B] flex-shrink-0" />
                                  <span className="text-sm font-mono font-bold text-[#F8FAFC]">{vinculo.empresa_b}</span>
                                </div>
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${risco.bg} ${risco.text}`}>
                                  Risco {risco.label}
                                </span>
                              </div>
                              <p className="text-xs font-mono text-[#94A3B8] leading-relaxed mb-2">
                                {vinculo.descricao}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono text-[#3B82F6] bg-[#3B82F6]/10 px-1.5 py-0.5 rounded">
                                  {VINCULO_LABELS[vinculo.tipo] || vinculo.tipo}
                                </span>
                                <span className="text-[10px] font-mono text-[#64748B]">
                                  Fonte: {vinculo.fonte}
                                </span>
                                {vinculo.verificado && (
                                  <span className="text-[10px] font-mono text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Shield className="w-2.5 h-2.5" /> Verificado
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Empresas Monitoradas */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Building2 className="w-4 h-4 text-[#22C55E]" />
                    <h3 className="text-sm font-bold font-mono text-white">Empresas Monitoradas</h3>
                    <span className="text-[10px] font-mono text-[#64748B] bg-[#1E3A6E] px-2 py-0.5 rounded">
                      {filteredEmpresas.length}/{empresas.length}
                    </span>
                    <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
                      <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
                      <input
                        type="text"
                        placeholder="Buscar empresa..."
                        value={empresaSearch}
                        onChange={e => setEmpresaSearch(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 text-[10px] font-mono bg-[#162044] border border-[#1E3A6E] rounded text-white placeholder-[#64748B] focus:border-[#FF6B2C]/50 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {filteredEmpresas.map((empresa, idx) => (
                      <div
                        key={idx}
                        className="border border-[#1E3A6E] rounded p-4 hover:border-[#FF6B2C]/50 transition-all duration-200"
                        style={{ background: "#162044" }}
                      >
                        <div className="flex items-start justify-between">
                          <h3 className="text-sm font-mono font-bold text-[#F8FAFC]">
                            {empresa.nome}
                          </h3>
                          {empresa.b3 && (
                            <span className="text-[10px] font-mono text-[#FF6B2C] bg-[#FF6B2C]/10 px-1.5 py-0.5 rounded">
                              {empresa.b3}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-[#64748B] mt-1">
                          CNPJ: {empresa.cnpj}
                          {empresa.cnpj_valido && (
                            <span className="ml-1 text-[#22C55E]">✓</span>
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-mono text-[#3B82F6] bg-[#3B82F6]/10 px-1.5 py-0.5 rounded">
                            {empresa.setor}
                          </span>
                          <span className="text-[10px] font-mono text-[#94A3B8] bg-white/5 px-1.5 py-0.5 rounded">
                            {empresa.uf}
                          </span>
                          <span className="text-[10px] font-mono text-[#94A3B8]">
                            {empresa.tipo}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ============ Tab: Indicadores ============ */}
              {tab === "indicadores" && (
                <div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                    <div className="border border-[#1E3A6E] rounded p-4" style={{ background: "#162044" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Newspaper className="w-4 h-4 text-[#FF6B2C]" />
                        <p className="text-xs font-mono text-[#64748B] uppercase tracking-wider">Notícias</p>
                      </div>
                      <p className="text-3xl font-bold font-mono text-[#FF6B2C]">{noticias.length}</p>
                      <p className="text-[10px] font-mono text-[#64748B] mt-1">itens coletados</p>
                    </div>
                    <div className="border border-[#1E3A6E] rounded p-4" style={{ background: "#162044" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-[#3B82F6]" />
                        <p className="text-xs font-mono text-[#64748B] uppercase tracking-wider">Licitações</p>
                      </div>
                      <p className="text-3xl font-bold font-mono text-[#3B82F6]">{totalNaBase || licitacoes.length}</p>
                      <p className="text-[10px] font-mono text-[#64748B] mt-1">
                        {dataSource === "supabase" ? "Supabase (ao vivo)" : "do PNCP"}
                      </p>
                    </div>
                    <div className="border border-[#1E3A6E] rounded p-4" style={{ background: "#162044" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-4 h-4 text-[#22C55E]" />
                        <p className="text-xs font-mono text-[#64748B] uppercase tracking-wider">Empresas</p>
                      </div>
                      <p className="text-3xl font-bold font-mono text-[#22C55E]">{empresas.length}</p>
                      <p className="text-[10px] font-mono text-[#64748B] mt-1">monitoradas</p>
                    </div>
                    <div className="border border-[#1E3A6E] rounded p-4" style={{ background: "#162044" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Link2 className="w-4 h-4 text-[#F59E0B]" />
                        <p className="text-xs font-mono text-[#64748B] uppercase tracking-wider">Vínculos</p>
                      </div>
                      <p className="text-3xl font-bold font-mono text-[#F59E0B]">{vinculos.length}</p>
                      <p className="text-[10px] font-mono text-[#64748B] mt-1">verificados</p>
                    </div>
                  </div>

                  {/* Valor Total */}
                  {licitacoes.length > 0 && (
                    <div className="border border-[#1E3A6E] rounded p-5 mb-6" style={{ background: "#162044" }}>
                      <h3 className="text-sm font-bold font-mono text-white mb-2 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-[#22C55E]" />
                        Valor Total Estimado em Licitações
                      </h3>
                      <p className="text-3xl font-bold font-mono text-[#22C55E]">
                        {formatCurrencyFull(totalValorLicitacoes)}
                      </p>
                      <p className="text-[10px] font-mono text-[#64748B] mt-1">
                        soma de {licitacoes.length} licitações monitoradas
                      </p>
                    </div>
                  )}

                  {/* Categorias breakdown */}
                  {categorias.length > 0 && (
                    <div className="border border-[#1E3A6E] rounded p-5 mb-6" style={{ background: "#162044" }}>
                      <h3 className="text-sm font-bold font-mono text-white mb-3 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
                        Licitações por Categoria
                      </h3>
                      <div className="space-y-2">
                        {categorias.map(cat => {
                          const count = licitacoes.filter(l => l.categoria === cat).length;
                          const pct = Math.round((count / licitacoes.length) * 100);
                          return (
                            <div key={cat} className="flex items-center gap-3">
                              <span className="text-xs font-mono text-[#94A3B8] w-32 truncate">{cat}</span>
                              <div className="flex-1 h-2 bg-[#0E1B3D] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#3B82F6] to-[#FF6B2C] rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-[#64748B] w-12 text-right">{count} ({pct}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Estados breakdown */}
                  {estados.length > 0 && (
                    <div className="border border-[#1E3A6E] rounded p-5" style={{ background: "#162044" }}>
                      <h3 className="text-sm font-bold font-mono text-white mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#22C55E]" />
                        Licitações por Estado
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {estados.map(uf => {
                          const count = licitacoes.filter(l => l.estado === uf).length;
                          return (
                            <div key={uf} className="border border-[#1E3A6E] rounded px-3 py-2 text-center" style={{ background: "#0E1B3D" }}>
                              <p className="text-sm font-bold font-mono text-white">{uf}</p>
                              <p className="text-[10px] font-mono text-[#64748B]">{count}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Fontes RSS */}
                  {fontes.length > 0 && (
                    <div className="border border-[#1E3A6E] rounded p-5 mt-6" style={{ background: "#162044" }}>
                      <h3 className="text-sm font-bold font-mono text-white mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#F59E0B]" />
                        Fontes de Notícias Configuradas
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {fontes.map(fonte => {
                          const count = noticias.filter(n => n.fonte === fonte).length;
                          return (
                            <span key={fonte} className="text-[10px] font-mono text-[#94A3B8] bg-[#0E1B3D] border border-[#1E3A6E] rounded px-2.5 py-1.5">
                              {fonte} <span className="text-[#FF6B2C] ml-1">{count}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
    </SidebarProvider>
  );
}
