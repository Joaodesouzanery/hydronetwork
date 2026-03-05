import { useEffect, useState } from "react";
import { useSearchParams, NavLink } from "react-router-dom";
import Sidebar from "@/components/ui/sidebar-with-submenu";
import {
  Newspaper, FileText, Link2, ExternalLink, Calendar,
  MapPin, DollarSign, AlertTriangle, RefreshCw, ArrowLeft,
  Construction, Search, Filter, Shield, ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { PullDataPanel } from "@/components/shared/PullDataPanel";

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

interface MetaInfo {
  fonte_dados: string;
  gerado_em: string;
  total: number;
}

const isRecent = (dateStr: string, hoursThreshold = 48) => {
  try {
    return (Date.now() - new Date(dateStr).getTime()) < hoursThreshold * 3600000;
  } catch { return false; }
};

const RISCO_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  alto: { bg: "bg-red-500/15", text: "text-red-400", label: "Alto" },
  medio: { bg: "bg-orange-500/15", text: "text-orange-400", label: "Medio" },
  baixo: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Baixo" },
};

const VINCULO_LABELS: Record<string, string> = {
  socio_comum: "Socio Comum",
  parentesco: "Parentesco",
  diretor_multiplo: "Diretor Multiplo",
};

export default function HubNoticias() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "noticias";

  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [vinculos, setVinculos] = useState<VinculoVerificado[]>([]);
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFonte, setSelectedFonte] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [notRes, licRes, vincRes] = await Promise.all([
        fetch("/hub/noticias.json"),
        fetch("/hub/licitacoes.json"),
        fetch("/hub/vinculos.json"),
      ]);
      const notData = await notRes.json();
      const licData = await licRes.json();
      const vincData = await vincRes.json();

      setNoticias(notData.noticias || []);
      setLicitacoes(licData.licitacoes || []);
      setEmpresas(vincData.empresas_monitoradas || []);
      setVinculos(vincData.vinculos_verificados || []);
      if (notData._meta) setMeta(notData._meta);
    } catch (err) {
      console.error("Erro ao carregar dados do hub:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchData();
      toast.success("Dados do Hub atualizados!");
    } catch {
      toast.error("Erro ao atualizar dados");
    } finally {
      setRefreshing(false);
    }
  };

  const fontes = [...new Set(noticias.map(n => n.fonte))];

  const filteredNoticias = noticias.filter(n => {
    const matchSearch = !searchTerm || n.titulo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchFonte = !selectedFonte || n.fonte === selectedFonte;
    return matchSearch && matchFonte;
  });

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
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="min-h-screen" style={{ background: "#0E1B3D" }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area - offset for sidebar */}
      <main className="sm:ml-72 min-h-screen">
        {/* Top bar */}
        <div className="sticky top-0 z-30 border-b border-[#1E3A6E] px-3 sm:px-6 py-3 flex items-center justify-between gap-2"
          style={{ background: "rgba(14, 27, 61, 0.95)", backdropFilter: "blur(8px)" }}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <NavLink
              to="/dashboard"
              className="p-2 hover:bg-[#FF6B2C]/10 rounded transition-colors text-[#64748B] hover:text-[#FF6B2C] flex-shrink-0"
              title="Voltar ao Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </NavLink>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold font-mono text-white tracking-tight truncate">
                Hub de Noticias
              </h1>
              <p className="text-[10px] sm:text-xs font-mono text-[#64748B] hidden sm:block">
                Inteligencia para engenharia e saneamento
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {meta && (
              <span className={`text-[10px] sm:text-xs font-mono px-1.5 sm:px-2 py-1 hidden sm:inline-flex items-center ${
                meta.fonte_dados === "placeholder"
                  ? "text-[#F59E0B] bg-[#F59E0B]/10"
                  : "text-[#22C55E] bg-[#22C55E]/10"
              }`}>
                {meta.fonte_dados === "placeholder" ? (
                  <>
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Dados ilustrativos
                  </>
                ) : (
                  <>Atualizado: {formatDate(meta.gerado_em)}</>
                )}
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

        {/* Development Banner */}
        <div className="mx-3 sm:mx-6 mt-4">
          <div
            className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border border-[#F59E0B]/30"
            style={{ background: "rgba(245, 158, 11, 0.08)" }}
          >
            <Construction className="w-4 h-4 sm:w-5 sm:h-5 text-[#F59E0B] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-mono font-semibold text-[#F59E0B]">
                Modulo em Desenvolvimento
              </p>
              <p className="text-[10px] sm:text-xs font-mono text-[#F59E0B]/70 mt-0.5 leading-relaxed">
                Este hub esta sendo construido. Dados e funcionalidades podem mudar a qualquer momento.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6">
          <PullDataPanel currentModule="hub_noticias" />
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 text-[#FF6B2C] animate-spin mx-auto mb-3" />
                <p className="text-sm font-mono text-[#64748B]">Carregando dados...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Tab: Notícias */}
              {(tab === "noticias" || !tab) && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Newspaper className="w-5 h-5 text-[#FF6B2C]" />
                    <h2 className="text-xl font-bold font-mono text-white">Noticias do Setor</h2>
                    <span className="text-xs font-mono text-[#64748B] bg-[#1E3A6E] px-2 py-0.5">
                      {filteredNoticias.length}/{noticias.length} itens
                    </span>
                  </div>

                  {/* Filtros e busca */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                      <input
                        type="text"
                        placeholder="Buscar noticias..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-[#162044] border border-[#1E3A6E] text-white placeholder-[#64748B] focus:border-[#FF6B2C]/50 outline-none"
                      />
                    </div>
                    <select
                      value={selectedFonte}
                      onChange={e => setSelectedFonte(e.target.value)}
                      className="text-xs font-mono bg-[#162044] border border-[#1E3A6E] text-white px-3 py-2 focus:border-[#FF6B2C]/50 outline-none"
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
                  </div>

                  <div className="grid gap-3">
                    {filteredNoticias.map((noticia, idx) => (
                      <a
                        key={idx}
                        href={noticia.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border border-[#1E3A6E] p-4 hover:border-[#FF6B2C]/50 transition-all duration-200 group"
                        style={{ background: "#162044" }}
                      >
                        <div className="flex items-start gap-4">
                          {noticia.imagem && (
                            <img
                              src={noticia.imagem}
                              alt=""
                              className="w-20 h-20 object-cover rounded flex-shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              <h3 className="text-sm font-mono font-semibold text-[#F8FAFC] group-hover:text-[#FF6B2C] transition-colors leading-relaxed flex-1">
                                {noticia.titulo}
                              </h3>
                              {isRecent(noticia.data_publicacao) && (
                                <span className="text-[9px] font-mono font-bold text-[#22C55E] bg-[#22C55E]/15 px-1.5 py-0.5 flex-shrink-0">
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
                              <span className="text-[#FF6B2C]/60">
                                {noticia.fonte}
                              </span>
                              {noticia.verificado && (
                                <span className="text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5">
                                  Verificado
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </a>
                    ))}
                    {filteredNoticias.length === 0 && (
                      <div className="text-center py-12 text-sm font-mono text-[#64748B]">
                        Nenhuma noticia encontrada para os filtros selecionados.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Licitações */}
              {tab === "licitacoes" && (
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <FileText className="w-5 h-5 text-[#FF6B2C]" />
                    <h2 className="text-xl font-bold font-mono text-white">Licitações</h2>
                    <span className="text-xs font-mono text-[#64748B] bg-[#1E3A6E] px-2 py-0.5">
                      {licitacoes.length} itens
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {licitacoes.map((lic) => (
                      <a
                        key={lic.id}
                        href={lic.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border border-[#1E3A6E] p-4 hover:border-[#FF6B2C]/50 transition-all duration-200 group"
                        style={{ background: "#162044" }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-mono font-semibold text-[#F8FAFC] group-hover:text-[#FF6B2C] transition-colors leading-relaxed">
                              {lic.titulo}
                            </h3>
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-mono text-[#64748B]">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {lic.orgao} — {lic.estado}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(lic.data_abertura)}
                              </span>
                              <span className="flex items-center gap-1 text-[#22C55E]">
                                <DollarSign className="w-3 h-3" />
                                {lic.valor_estimado_fmt || formatCurrency(lic.valor_estimado)}
                              </span>
                              <span className="text-[#FF6B2C]/60">
                                {lic.modalidade}
                              </span>
                              <span className="text-[#3B82F6] bg-[#3B82F6]/10 px-1.5 py-0.5">
                                {lic.categoria}
                              </span>
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-[#64748B] group-hover:text-[#FF6B2C] flex-shrink-0 mt-1 transition-colors" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab: Vínculos */}
              {tab === "vinculos" && (
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <Link2 className="w-5 h-5 text-[#FF6B2C]" />
                    <h2 className="text-xl font-bold font-mono text-white">Grafo de Vinculos</h2>
                    <span className="text-xs font-mono text-[#64748B] bg-[#1E3A6E] px-2 py-0.5">
                      {empresas.length} empresas
                    </span>
                    <span className="text-xs font-mono text-[#64748B] bg-[#1E3A6E] px-2 py-0.5">
                      {vinculos.length} vinculos verificados
                    </span>
                  </div>

                  {/* Vínculos Verificados */}
                  {vinculos.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <ArrowRightLeft className="w-4 h-4 text-[#FF6B2C]" />
                        <h3 className="text-sm font-bold font-mono text-white">Vinculos Verificados</h3>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {vinculos.map((vinculo, idx) => {
                          const risco = RISCO_COLORS[vinculo.risco] || RISCO_COLORS.baixo;
                          return (
                            <div
                              key={idx}
                              className={`border p-4 transition-all duration-200 ${
                                vinculo.risco === "alto"
                                  ? "border-red-500/30 hover:border-red-500/60"
                                  : "border-[#1E3A6E] hover:border-[#FF6B2C]/50"
                              }`}
                              style={{ background: "#162044" }}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-mono font-bold text-[#F8FAFC] truncate">{vinculo.empresa_a}</span>
                                  <ArrowRightLeft className="w-3 h-3 text-[#64748B] flex-shrink-0" />
                                  <span className="text-sm font-mono font-bold text-[#F8FAFC] truncate">{vinculo.empresa_b}</span>
                                </div>
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 flex-shrink-0 ${risco.bg} ${risco.text}`}>
                                  Risco {risco.label}
                                </span>
                              </div>
                              <p className="text-xs font-mono text-[#94A3B8] leading-relaxed mb-2">
                                {vinculo.descricao}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono text-[#3B82F6] bg-[#3B82F6]/10 px-1.5 py-0.5">
                                  {VINCULO_LABELS[vinculo.tipo] || vinculo.tipo}
                                </span>
                                <span className="text-[10px] font-mono text-[#64748B]">
                                  Fonte: {vinculo.fonte}
                                </span>
                                {vinculo.verificado && (
                                  <span className="text-[10px] font-mono text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 flex items-center gap-1">
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
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-bold font-mono text-white">Empresas Monitoradas</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {empresas.map((empresa, idx) => (
                      <div
                        key={idx}
                        className="border border-[#1E3A6E] p-4 hover:border-[#FF6B2C]/50 transition-all duration-200"
                        style={{ background: "#162044" }}
                      >
                        <div className="flex items-start justify-between">
                          <h3 className="text-sm font-mono font-bold text-[#F8FAFC]">
                            {empresa.nome}
                          </h3>
                          {empresa.b3 && (
                            <span className="text-[10px] font-mono text-[#FF6B2C] bg-[#FF6B2C]/10 px-1.5 py-0.5">
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
                          <span className="text-[10px] font-mono text-[#3B82F6] bg-[#3B82F6]/10 px-1.5 py-0.5">
                            {empresa.setor}
                          </span>
                          <span className="text-[10px] font-mono text-[#94A3B8] bg-white/5 px-1.5 py-0.5">
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

              {/* Tab: Artigos (empty state) */}
              {tab === "artigos" && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Newspaper className="w-12 h-12 text-[#FF6B2C]/30 mb-4" />
                  <h3 className="text-lg font-bold font-mono text-white mb-2">
                    Artigos em breve
                  </h3>
                  <p className="text-sm font-mono text-[#64748B] max-w-md">
                    Os artigos técnicos serão coletados automaticamente.
                    Execute <code className="text-[#FF6B2C] bg-[#FF6B2C]/10 px-1">npm run hub:coletar</code> para buscar dados.
                  </p>
                </div>
              )}

              {/* Tab: Indicadores */}
              {tab === "indicadores" && (
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <DollarSign className="w-5 h-5 text-[#FF6B2C]" />
                    <h2 className="text-xl font-bold font-mono text-white">Indicadores</h2>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="border border-[#1E3A6E] p-4" style={{ background: "#162044" }}>
                      <p className="text-xs font-mono text-[#64748B] uppercase tracking-wider">Notícias</p>
                      <p className="text-3xl font-bold font-mono text-[#FF6B2C] mt-1">{noticias.length}</p>
                      <p className="text-[10px] font-mono text-[#64748B] mt-1">itens coletados</p>
                    </div>
                    <div className="border border-[#1E3A6E] p-4" style={{ background: "#162044" }}>
                      <p className="text-xs font-mono text-[#64748B] uppercase tracking-wider">Licitações</p>
                      <p className="text-3xl font-bold font-mono text-[#3B82F6] mt-1">{licitacoes.length}</p>
                      <p className="text-[10px] font-mono text-[#64748B] mt-1">do PNCP</p>
                    </div>
                    <div className="border border-[#1E3A6E] p-4" style={{ background: "#162044" }}>
                      <p className="text-xs font-mono text-[#64748B] uppercase tracking-wider">Empresas</p>
                      <p className="text-3xl font-bold font-mono text-[#22C55E] mt-1">{empresas.length}</p>
                      <p className="text-[10px] font-mono text-[#64748B] mt-1">monitoradas</p>
                    </div>
                    <div className="border border-[#1E3A6E] p-4" style={{ background: "#162044" }}>
                      <p className="text-xs font-mono text-[#64748B] uppercase tracking-wider">Fontes RSS</p>
                      <p className="text-3xl font-bold font-mono text-[#F59E0B] mt-1">11</p>
                      <p className="text-[10px] font-mono text-[#64748B] mt-1">configuradas</p>
                    </div>
                  </div>
                  {licitacoes.length > 0 && (
                    <div className="mt-6 border border-[#1E3A6E] p-4" style={{ background: "#162044" }}>
                      <h3 className="text-sm font-bold font-mono text-white mb-3">
                        Valor Total Estimado em Licitações
                      </h3>
                      <p className="text-2xl font-bold font-mono text-[#22C55E]">
                        {formatCurrency(licitacoes.reduce((sum, l) => sum + (l.valor_estimado || 0), 0))}
                      </p>
                      <p className="text-[10px] font-mono text-[#64748B] mt-1">
                        soma de {licitacoes.length} licitações monitoradas
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
