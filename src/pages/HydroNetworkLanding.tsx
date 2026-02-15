import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  Droplets, MapPin, BarChart3, Calendar, ClipboardList, FileSpreadsheet,
  Upload, Settings2, Users, Zap, ArrowRight, ChevronDown,
  Globe, Calculator, Layers, GitBranch, Shield, Eye, Map, DollarSign
} from "lucide-react";

const CostMapSVG = () => (
  <svg viewBox="0 0 800 450" className="w-full rounded-xl border border-white/10 shadow-2xl" style={{ background: "#1e293b" }}>
    <rect x="100" y="50" width="600" height="350" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="1" />
    <line x1="100" y1="200" x2="700" y2="200" stroke="#334155" strokeWidth="1" strokeDasharray="5,5" />
    <line x1="400" y1="50" x2="400" y2="400" stroke="#334155" strokeWidth="1" strokeDasharray="5,5" />
    <line x1="180" y1="120" x2="320" y2="120" stroke="#10b981" strokeWidth="6" strokeLinecap="round" />
    <text x="230" y="110" fill="#10b981" fontSize="11" fontWeight="bold">R$ 12.450</text>
    <line x1="320" y1="120" x2="320" y2="250" stroke="#10b981" strokeWidth="6" strokeLinecap="round" />
    <text x="330" y="190" fill="#10b981" fontSize="11" fontWeight="bold">R$ 18.200</text>
    <line x1="320" y1="250" x2="500" y2="250" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
    <text x="380" y="240" fill="#f59e0b" fontSize="11" fontWeight="bold">R$ 45.890</text>
    <line x1="500" y1="120" x2="500" y2="250" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
    <text x="510" y="190" fill="#f59e0b" fontSize="11" fontWeight="bold">R$ 32.100</text>
    <line x1="320" y1="120" x2="500" y2="120" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
    <text x="390" y="110" fill="#f59e0b" fontSize="11" fontWeight="bold">R$ 28.750</text>
    <line x1="500" y1="250" x2="650" y2="350" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
    <text x="560" y="310" fill="#ef4444" fontSize="11" fontWeight="bold">R$ 87.340</text>
    <line x1="180" y1="120" x2="180" y2="320" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
    <text x="130" y="220" fill="#ef4444" fontSize="11" fontWeight="bold">R$ 67.120</text>
    {[[180,120],[320,120],[500,120],[320,250],[500,250],[650,350],[180,320]].map(([cx,cy],i) => (
      <g key={i}><circle cx={cx} cy={cy} r="10" fill="#3b82f6" stroke="#fff" strokeWidth="2" /><text x={cx} y={cy+4} fill="white" fontSize="8" textAnchor="middle" fontWeight="bold">PV{i+1}</text></g>
    ))}
    <rect x="550" y="60" width="140" height="90" rx="6" fill="#0f172a" stroke="#334155" strokeWidth="1" />
    <text x="570" y="80" fill="#94a3b8" fontSize="10" fontWeight="bold">CUSTO POR TRECHO</text>
    <circle cx={570} cy={95} r="5" fill="#10b981" /><text x="582" y="99" fill="#94a3b8" fontSize="9">&lt; R$ 20k</text>
    <circle cx={570} cy={115} r="5" fill="#f59e0b" /><text x="582" y="119" fill="#94a3b8" fontSize="9">R$ 20k - 50k</text>
    <circle cx={570} cy={135} r="5" fill="#ef4444" /><text x="582" y="139" fill="#94a3b8" fontSize="9">&gt; R$ 50k</text>
    <rect x="140" y="370" width="300" height="50" rx="6" fill="#c9a227" fillOpacity="0.15" stroke="#c9a227" strokeWidth="1.5" />
    <text x="160" y="392" fill="#e8c547" fontSize="14" fontWeight="bold">CUSTO TOTAL PREVISTO: R$ 291.850</text>
    <text x="160" y="410" fill="#94a3b8" fontSize="10">7 trechos · 1.247m de rede</text>
  </svg>
);

const HydroNetworkLanding = () => {
  const navigate = useNavigate();
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach(entry => { if (entry.isIntersecting) setVisibleSections(prev => new Set([...prev, entry.target.id])); }); },
      { threshold: 0.1 }
    );
    document.querySelectorAll("[data-animate]").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const isVisible = (id: string) => visibleSections.has(id);

  const modules = [
    { icon: Upload, label: "Importação Inteligente", color: "#3b82f6", desc: "CSV, DXF, SHP, GeoJSON" },
    { icon: GitBranch, label: "Rede de Esgoto", color: "#8b5cf6", desc: "Gravidade e elevatória" },
    { icon: Droplets, label: "Rede de Água", color: "#06b6d4", desc: "Pressão e distribuição" },
    { icon: Globe, label: "Drenagem Pluvial", color: "#22c55e", desc: "Galerias e estruturas" },
    { icon: Calculator, label: "Quantitativos e Orçamento", color: "#f59e0b", desc: "SINAPI/SICRO automático" },
    { icon: Calendar, label: "Planejamento de Obra", color: "#ec4899", desc: "Gantt e Curva S" },
    { icon: ClipboardList, label: "RDO Digital", color: "#8b5cf6", desc: "Relatório Diário de Obra" },
    { icon: Settings2, label: "Integração EPANET", color: "#06b6d4", desc: "Simulação hidráulica" },
    { icon: Zap, label: "EPANET PRO", color: "#3b82f6", desc: "Simulação WASM avançada" },
    { icon: Layers, label: "Simulação SWMM", color: "#22c55e", desc: "Drenagem urbana", badge: "Em breve" },
    { icon: Users, label: "Revisão por Pares", color: "#3b82f6", desc: "Workflow de aprovação" },
    { icon: BarChart3, label: "Integração ProjectLibre", color: "#ec4899", desc: "Gantt avançado" },
    { icon: Map, label: "Integração QGIS", color: "#22c55e", desc: "SIG georreferenciado" },
    { icon: MapPin, label: "Topografia", color: "#f59e0b", desc: "Importação de pontos" },
    { icon: Shield, label: "Open Project", color: "#8b5cf6", desc: "Gantt colaborativo" },
    { icon: DollarSign, label: "Orçamento SINAPI", color: "#c9a227", desc: "Composições automáticas" },
    { icon: Eye, label: "Mapa de Progresso", color: "#06b6d4", desc: "RDO georreferenciado" },
  ];

  const workflow = [
    { step: "01", label: "Importe Topografia", desc: "CSV, DXF, SHP" },
    { step: "02", label: "Dimensione a Rede", desc: "Esgoto, Água, Drenagem" },
    { step: "03", label: "Gere Orçamento", desc: "SINAPI/SICRO" },
    { step: "04", label: "Simule", desc: "EPANET (pressão)" },
    { step: "05", label: "Planeje", desc: "Gantt + Curva S" },
    { step: "06", label: "Exporte GIS", desc: "SHP, GeoJSON, KML" },
    { step: "07", label: "Acompanhe no Campo", desc: "RDO Digital" },
    { step: "08", label: "Relatórios", desc: "PDF e Dashboards" },
  ];

  const normas = [
    { code: "NBR 9649", desc: "Redes de Esgoto" },
    { code: "NBR 12211", desc: "Projeto de Água" },
    { code: "NBR 12218", desc: "Distribuição de Água" },
    { code: "NBR 10844", desc: "Drenagem" },
    { code: "SINAPI 2025", desc: "Composições de Custo" },
    { code: "SICRO", desc: "Infraestrutura Rodoviária" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#1a1f2e", color: "#e2e8f0", fontFamily: "'Noto Sans', sans-serif" }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg border-b" style={{ background: "rgba(26, 31, 46, 0.9)", borderColor: "#2c4a7c33" }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="h-7 w-7" style={{ color: "#c9a227" }} />
            <span className="text-lg font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>
              CONSTRUDATA | <span style={{ color: "#c9a227" }}>HYDRONETWORK</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#custos" className="hover:text-white transition-colors" style={{ color: "#94a3b8" }}>Custos</a>
            <a href="#screenshots" className="hover:text-white transition-colors" style={{ color: "#94a3b8" }}>Plataforma</a>
            <a href="#modulos" className="hover:text-white transition-colors" style={{ color: "#94a3b8" }}>Módulos</a>
            <a href="#normas" className="hover:text-white transition-colors" style={{ color: "#94a3b8" }}>Normas</a>
          </nav>
          <Button onClick={() => navigate("/hydronetwork")} className="font-semibold text-sm" style={{ background: "#c9a227", color: "#1a1f2e" }}>
            ACESSAR PLATAFORMA
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-16" style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #2c4a7c 100%)" }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 25% 50%, #3d6cb9 0%, transparent 50%), radial-gradient(circle at 75% 50%, #c9a227 0%, transparent 50%)" }} />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 text-center space-y-8">
          <Badge className="text-sm px-4 py-1" style={{ background: "#c9a22733", color: "#e8c547", border: "1px solid #c9a22755" }}>
            PLATAFORMA COMPLETA DE ENGENHARIA DE SANEAMENTO
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>
            CONSTRUDATA
            <br />
            <span style={{ color: "#c9a227", fontSize: "0.7em" }}>HYDRONETWORK</span>
          </h1>
          <p className="text-lg md:text-xl max-w-4xl mx-auto" style={{ color: "#94a3b8" }}>
            Do levantamento topográfico ao Relatório Diário de Obra — em uma única plataforma.
            Importe seus dados (CSV, DXF, SHP), dimensione redes de esgoto, água e drenagem,
            gere orçamento SINAPI automaticamente, planeje com Gantt e acompanhe a execução com RDO digital.
            Tudo no navegador, sem instalar nada.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={() => navigate("/hydronetwork")} className="font-bold text-lg px-8" style={{ background: "#c9a227", color: "#1a1f2e" }}>
              Acesso Gratuito — Plano DEMO <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => document.getElementById("modulos")?.scrollIntoView({ behavior: "smooth" })}
              className="font-bold text-lg px-8" style={{ borderColor: "#c9a227", color: "#c9a227" }}>
              Ver Módulos
            </Button>
          </div>

          {/* Verified metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { v: "17", l: "Módulos Integrados" },
              { v: "8", l: "Formatos de Exportação" },
              { v: "3", l: "Motores de Cálculo" },
              { v: "100%", l: "Online" },
            ].map((f, i) => (
              <div key={i} className="rounded-lg p-4 text-center" style={{ background: "#ffffff08", border: "1px solid #ffffff10" }}>
                <div className="text-3xl font-bold" style={{ color: "#c9a227", fontFamily: "Montserrat, sans-serif" }}>{f.v}</div>
                <div className="text-xs mt-1" style={{ color: "#94a3b8" }}>{f.l}</div>
              </div>
            ))}
          </div>

          <a href="#screenshots" className="inline-block mt-8 animate-bounce">
            <ChevronDown className="h-8 w-8" style={{ color: "#c9a227" }} />
          </a>
        </div>
      </section>

      {/* Screenshots Section */}
      <section id="screenshots" data-animate className={`py-24 px-4 transition-all duration-700 ${isVisible("screenshots") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>Veja a plataforma em ação</h2>
            <p style={{ color: "#94a3b8" }}>Ferramentas profissionais direto no navegador</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: Map, title: "Mapa interativo com rede dimensionada", desc: "Visualize nós, trechos e resultados hidráulicos georreferenciados com Leaflet" },
              { icon: BarChart3, title: "Gantt e Curva S automáticos", desc: "Planejamento de obra integrado com cronograma físico-financeiro" },
              { icon: DollarSign, title: "Orçamento SINAPI por trecho", desc: "Composições de custo automáticas para cada segmento da rede" },
              { icon: Zap, title: "Simulação EPANET com resultados", desc: "Análise hidráulica de pressão, vazão e velocidade via WASM" },
            ].map((card, i) => (
              <Card key={i} className="border-0 overflow-hidden hover:scale-[1.02] transition-transform" style={{ background: "#0f172a", border: "1px solid #334155" }}>
                <div className="aspect-video flex items-center justify-center" style={{ background: "#f1f5f9" }}>
                  <div className="text-center p-6">
                    <card.icon className="h-12 w-12 mx-auto mb-3" style={{ color: "#3b82f6" }} />
                    <p className="text-sm font-medium" style={{ color: "#334155" }}>{card.title}</p>
                  </div>
                </div>
                <CardContent className="pt-4">
                  <h3 className="font-bold text-white mb-1">{card.title}</h3>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>{card.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center">
            <Button size="lg" onClick={() => navigate("/hydronetwork")} className="font-bold" style={{ background: "#c9a227", color: "#1a1f2e" }}>
              Acessar Plataforma <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Cost Map Section */}
      <section id="custos" data-animate className={`py-24 px-4 transition-all duration-700 ${isVisible("custos") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <Badge style={{ background: "#3b82f633", color: "#60a5fa", border: "1px solid #3b82f655" }}>Controle Financeiro Total</Badge>
            <h2 className="text-4xl md:text-5xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>Previsão de Custos por Trecho no Mapa</h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: "#94a3b8" }}>Saiba exatamente quanto cada metro de rede vai custar antes de iniciar.</p>
          </div>
          <CostMapSVG />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: "📍", title: "Custo por Trecho", desc: "Cada segmento mostra seu custo individual baseado em extensão, diâmetro, profundidade e tipo de solo." },
              { icon: "🎨", title: "Cores por Faixa de Custo", desc: "Identifique visualmente trechos caros (vermelho), médios (amarelo) e econômicos (verde)." },
              { icon: "⚠️", title: "Alertas de Custo Alto", desc: "Trechos com escavação profunda (>3m) ou interferências são destacados automaticamente." },
              { icon: "📊", title: "Análise de Cenários", desc: "Simule alterações de traçado e veja instantaneamente como o custo total muda." },
            ].map((f, i) => (
              <Card key={i} className="border-0 hover:scale-105 transition-transform" style={{ background: "#0f172a", border: "1px solid #334155" }}>
                <CardContent className="pt-6 space-y-3">
                  <span className="text-3xl">{f.icon}</span>
                  <h3 className="text-lg font-bold text-white">{f.title}</h3>
                  <p className="text-sm" style={{ color: "#94a3b8" }}>{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow / Fluxo Completo */}
      <section data-animate id="workflow" className={`py-24 px-4 transition-all duration-700 ${isVisible("workflow") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        style={{ background: "#0f172a" }}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>Fluxo Completo em 8 Etapas</h2>
            <p style={{ color: "#94a3b8" }}>Do projeto à entrega, tudo integrado</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {workflow.map((step, i) => (
              <div key={i} className="rounded-xl p-6 text-center space-y-2 hover:scale-105 transition-transform" style={{ background: "#1e293b", border: "1px solid #334155" }}>
                <div className="text-2xl font-bold" style={{ color: "#c9a227", fontFamily: "Montserrat, sans-serif" }}>{step.step}</div>
                <h3 className="text-sm font-bold text-white">{step.label}</h3>
                <p className="text-xs" style={{ color: "#64748b" }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Normas Técnicas */}
      <section id="normas" data-animate className={`py-24 px-4 transition-all duration-700 ${isVisible("normas") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>Conforme Normas Brasileiras</h2>
            <p style={{ color: "#94a3b8" }}>Cálculos validados conforme as principais normas de saneamento</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {normas.map((n, i) => (
              <div key={i} className="rounded-lg px-4 py-2 text-center" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8 }}>
                <span className="font-bold text-sm" style={{ color: "#1e40af" }}>{n.code}</span>
                <span className="text-xs ml-2" style={{ color: "#3b82f6" }}>— {n.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modulos" data-animate className={`py-24 px-4 transition-all duration-700 ${isVisible("modulos") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        style={{ background: "#0f172a" }}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>17 Módulos Integrados</h2>
            <p style={{ color: "#94a3b8" }}>Tudo que você precisa em uma única plataforma</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {modules.map((m, i) => (
              <Card key={i} className={`hover:scale-105 transition-transform border-0 relative ${m.badge ? "opacity-70" : ""}`} style={{ background: "#1e293b", border: "1px solid #334155" }}>
                {m.badge && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: "#fef3c7", color: "#92400e" }}>{m.badge}</div>
                )}
                <CardContent className="pt-6 text-center space-y-2">
                  <m.icon className="h-8 w-8 mx-auto" style={{ color: m.color }} />
                  <h3 className="text-sm font-bold text-white">{m.label}</h3>
                  <p className="text-xs" style={{ color: "#64748b" }}>{m.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section data-animate id="social" className={`py-24 px-4 transition-all duration-700 ${isVisible("social") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>Projetado por engenheiros, para engenheiros</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { emoji: "🏗️", title: "Projeto Exemplo", desc: "Rede coletora de 3,2 km com 45 trechos — dimensionamento, orçamento e cronograma gerados automaticamente" },
              { emoji: "📐", title: "Validação Normativa", desc: "Verificação automática de velocidade, declividade, profundidade e pressão conforme ABNT" },
              { emoji: "⚡", title: "Workflow Integrado", desc: "Dados fluem da topografia ao RDO sem redigitação — importe uma vez, use em todos os módulos" },
            ].map((card, i) => (
              <Card key={i} className="border-0 hover:scale-105 transition-transform" style={{ background: "#0f172a", border: "1px solid #334155" }}>
                <CardContent className="pt-6 space-y-3 text-center">
                  <span className="text-4xl">{card.emoji}</span>
                  <h3 className="text-lg font-bold text-white">{card.title}</h3>
                  <p className="text-sm" style={{ color: "#94a3b8" }}>{card.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Divider + ConstruData Obras */}
      <div className="max-w-6xl mx-auto px-4"><hr style={{ borderColor: "#1e293b", margin: "80px 0" }} /></div>
      <section data-animate id="construdata" className={`py-16 px-4 transition-all duration-700 ${isVisible("construdata") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        style={{ background: "#f8fafc05" }}>
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <p className="text-sm" style={{ color: "#6b7280" }}>Conheça também nossa plataforma de gestão de obras</p>
          <h2 className="text-2xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>ConstruData Obras</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {["Produção", "Equipes", "Materiais", "RDO"].map((m, i) => (
              <div key={i} className="rounded-lg p-4 text-center text-sm" style={{ background: "#1e293b", border: "1px solid #334155" }}>
                <span className="text-white font-medium">{m}</span>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")} style={{ borderColor: "#334155", color: "#94a3b8" }}>
            Ver ConstruData Obras <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 px-4 text-center" style={{ background: "#0f172a" }}>
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-4xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Importe seus dados e veja os resultados em segundos
          </h2>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={() => navigate("/hydronetwork")} className="font-bold text-lg px-8" style={{ background: "#c9a227", color: "#1a1f2e" }}>
              Acessar Plataforma Gratuitamente <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/hydronetwork")} style={{ borderColor: "#c9a227", color: "#c9a227" }}>
              Carregar Projeto Exemplo
            </Button>
          </div>
          <p className="text-sm" style={{ color: "#64748b" }}>
            Sem cadastro obrigatório • Sem cartão de crédito • Plano DEMO gratuito
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4" style={{ background: "#0a0f1a", borderTop: "1px solid #1e293b" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 text-sm" style={{ color: "#64748b" }}>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Droplets className="h-5 w-5" style={{ color: "#c9a227" }} />
              <span className="font-bold text-white text-sm">HYDRONETWORK</span>
            </div>
            <p className="text-xs">Plataforma de engenharia de saneamento</p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">Módulos</h4>
            {["Topografia", "Esgoto", "Água", "Drenagem"].map(m => <p key={m} className="text-xs mb-1">{m}</p>)}
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">Ferramentas</h4>
            {["EPANET PRO", "QGIS", "Gantt", "Curva S"].map(m => <p key={m} className="text-xs mb-1">{m}</p>)}
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">Formatos</h4>
            {["CSV/Excel", "DXF/SHP", "GeoJSON/KML", "PDF/GeoPackage"].map(m => <p key={m} className="text-xs mb-1">{m}</p>)}
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">Normas</h4>
            {["NBR 9649", "NBR 12218", "SINAPI", "SICRO"].map(m => <p key={m} className="text-xs mb-1">{m}</p>)}
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 text-center text-xs" style={{ borderTop: "1px solid #1e293b", color: "#475569" }}>
          © 2025 ConstruData HydroNetwork. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
};

export default HydroNetworkLanding;
