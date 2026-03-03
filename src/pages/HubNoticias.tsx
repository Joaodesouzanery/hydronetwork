import { useEffect, useState } from "react";
import { useSearchParams, NavLink } from "react-router-dom";
import HubSidebar from "@/components/ui/sidebar-with-submenu";
import {
  Newspaper, FileText, Link2, ExternalLink, Calendar,
  MapPin, DollarSign, AlertTriangle, RefreshCw, ArrowLeft,
} from "lucide-react";

interface Noticia {
  titulo: string;
  link: string;
  data_publicacao: string;
  fonte: string;
  verificado: boolean;
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

interface MetaInfo {
  fonte_dados: string;
  gerado_em: string;
  total: number;
}

export default function HubNoticias() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "noticias";

  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        if (notData._meta) setMeta(notData._meta);
      } catch (err) {
        console.error("Erro ao carregar dados do hub:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
      <HubSidebar />

      {/* Main content area - offset for sidebar */}
      <main className="sm:ml-72 min-h-screen">
        {/* Top bar */}
        <div className="sticky top-0 z-30 border-b border-[#1E3A6E] px-6 py-3 flex items-center justify-between"
          style={{ background: "rgba(14, 27, 61, 0.95)", backdropFilter: "blur(8px)" }}>
          <div className="flex items-center gap-3">
            <NavLink
              to="/dashboard"
              className="p-2 hover:bg-[#FF6B2C]/10 rounded transition-colors text-[#64748B] hover:text-[#FF6B2C]"
              title="Voltar ao Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </NavLink>
            <div>
              <h1 className="text-lg font-bold font-mono text-white tracking-tight">
                Hub de Notícias
              </h1>
              <p className="text-xs font-mono text-[#64748B]">
                Inteligência para engenharia e saneamento
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {meta && (
              <span className={`text-xs font-mono px-2 py-1 ${
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
              className="p-2 hover:bg-[#FF6B2C]/10 rounded transition-colors text-[#64748B] hover:text-[#FF6B2C]"
              title="Atualizar dados (npm run hub:coletar)"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
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
                  <div className="flex items-center gap-2 mb-6">
                    <Newspaper className="w-5 h-5 text-[#FF6B2C]" />
                    <h2 className="text-xl font-bold font-mono text-white">Notícias do Setor</h2>
                    <span className="text-xs font-mono text-[#64748B] bg-[#1E3A6E] px-2 py-0.5">
                      {noticias.length} itens
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {noticias.map((noticia, idx) => (
                      <a
                        key={idx}
                        href={noticia.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border border-[#1E3A6E] p-4 hover:border-[#FF6B2C]/50 transition-all duration-200 group"
                        style={{ background: "#162044" }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-mono font-semibold text-[#F8FAFC] group-hover:text-[#FF6B2C] transition-colors leading-relaxed">
                              {noticia.titulo}
                            </h3>
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
                          <ExternalLink className="w-4 h-4 text-[#64748B] group-hover:text-[#FF6B2C] flex-shrink-0 mt-1 transition-colors" />
                        </div>
                      </a>
                    ))}
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
                    <h2 className="text-xl font-bold font-mono text-white">Grafo de Vínculos</h2>
                    <span className="text-xs font-mono text-[#64748B] bg-[#1E3A6E] px-2 py-0.5">
                      {empresas.length} empresas
                    </span>
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
