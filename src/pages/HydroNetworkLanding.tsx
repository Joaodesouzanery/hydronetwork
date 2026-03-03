import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  Droplets, MapPin, BarChart3, Calendar, ClipboardList, FileSpreadsheet,
  Upload, Settings2, Users, Zap, ArrowRight, ChevronDown,
  Globe, Calculator, Layers, GitBranch, Shield, Eye, Map, DollarSign,
  Palette, AlertTriangle, Building2, Ruler, Newspaper
} from "lucide-react";
import { LogoText } from "@/components/shared/Logo";

const CostMapSVG = () => (
  <svg viewBox="0 0 800 450" className="w-full border-2" style={{ background: "#0E1B3D", borderColor: "#1E3A6E" }}>
    <rect x="100" y="50" width="600" height="350" rx="8" fill="#0E1B3D" stroke="#1E3A6E" strokeWidth="1" />
    <line x1="100" y1="200" x2="700" y2="200" stroke="#1E3A6E" strokeWidth="1" strokeDasharray="5,5" />
    <line x1="400" y1="50" x2="400" y2="400" stroke="#1E3A6E" strokeWidth="1" strokeDasharray="5,5" />
    <line x1="180" y1="120" x2="320" y2="120" stroke="#FF6B2C" strokeWidth="6" strokeLinecap="round" />
    <text x="230" y="110" fill="#FF6B2C" fontSize="11" fontWeight="bold">R$ 12.450</text>
    <line x1="320" y1="120" x2="320" y2="250" stroke="#FF6B2C" strokeWidth="6" strokeLinecap="round" />
    <text x="330" y="190" fill="#FF6B2C" fontSize="11" fontWeight="bold">R$ 18.200</text>
    <line x1="320" y1="250" x2="500" y2="250" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
    <text x="380" y="240" fill="#F59E0B" fontSize="11" fontWeight="bold">R$ 45.890</text>
    <line x1="500" y1="120" x2="500" y2="250" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
    <text x="510" y="190" fill="#F59E0B" fontSize="11" fontWeight="bold">R$ 32.100</text>
    <line x1="320" y1="120" x2="500" y2="120" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
    <text x="390" y="110" fill="#F59E0B" fontSize="11" fontWeight="bold">R$ 28.750</text>
    <line x1="500" y1="250" x2="650" y2="350" stroke="#EF4444" strokeWidth="6" strokeLinecap="round" />
    <text x="560" y="310" fill="#EF4444" fontSize="11" fontWeight="bold">R$ 87.340</text>
    <line x1="180" y1="120" x2="180" y2="320" stroke="#EF4444" strokeWidth="6" strokeLinecap="round" />
    <text x="130" y="220" fill="#EF4444" fontSize="11" fontWeight="bold">R$ 67.120</text>
    {[[180,120],[320,120],[500,120],[320,250],[500,250],[650,350],[180,320]].map(([cx,cy],i) => (
      <g key={i}><circle cx={cx} cy={cy} r="10" fill="#10367D" stroke="#fff" strokeWidth="2" /><text x={cx} y={cy+4} fill="white" fontSize="8" textAnchor="middle" fontWeight="bold">PV{i+1}</text></g>
    ))}
    <rect x="550" y="60" width="140" height="90" rx="6" fill="#0A2456" stroke="#1E3A6E" strokeWidth="1" />
    <text x="570" y="80" fill="#94A3B8" fontSize="10" fontWeight="bold">CUSTO POR TRECHO</text>
    <circle cx={570} cy={95} r="5" fill="#FF6B2C" /><text x="582" y="99" fill="#94A3B8" fontSize="9">&lt; R$ 20k</text>
    <circle cx={570} cy={115} r="5" fill="#F59E0B" /><text x="582" y="119" fill="#94A3B8" fontSize="9">R$ 20k - 50k</text>
    <circle cx={570} cy={135} r="5" fill="#EF4444" /><text x="582" y="139" fill="#94A3B8" fontSize="9">&gt; R$ 50k</text>
    <rect x="140" y="370" width="300" height="50" rx="6" fill="#FF6B2C" fillOpacity="0.12" stroke="#FF6B2C" strokeWidth="1.5" />
    <text x="160" y="392" fill="#FF6B2C" fontSize="14" fontWeight="bold">CUSTO TOTAL PREVISTO: R$ 291.850</text>
    <text x="160" y="410" fill="#94A3B8" fontSize="10">7 trechos · 1.247m de rede</text>
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
    <div className="min-h-screen" style={{ background: "#F5F5F5", color: "#0E1B3D", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50-lg border-b" style={{ background: "rgba(245,245,245,0.95)", borderColor: "#D4D4D4" }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="ConstruData" className="h-8 w-8" />
            <span className="text-lg font-bold font-mono" style={{ color: "#10367D" }}>
              <LogoText className="text-lg" textColor="text-[#10367D]" /> <span style={{ color: "#FF6B2C" }}>HydroNetwork</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#custos" className="hover:text-[#10367D] transition-colors" style={{ color: "#64748B" }}>Custos</a>
            <a href="#screenshots" className="hover:text-[#10367D] transition-colors" style={{ color: "#64748B" }}>Plataforma</a>
            <a href="#modulos" className="hover:text-[#10367D] transition-colors" style={{ color: "#64748B" }}>Módulos</a>
            <a href="#normas" className="hover:text-[#10367D] transition-colors" style={{ color: "#64748B" }}>Normas</a>
            <a href="/hub/index.html" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF6B2C] transition-colors flex items-center gap-1" style={{ color: "#FF6B2C" }}>
              <Newspaper className="h-3.5 w-3.5" /> Hub
            </a>
          </nav>
          <Button onClick={() => navigate("/hydronetwork")} className="font-semibold text-sm" style={{ background: "#FF6B2C", color: "#FFFFFF" }}>
            ACESSAR PLATAFORMA
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-16" style={{ background: "linear-gradient(135deg, #0A2456 0%, #10367D 50%, #1A4A9E 100%)" }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 25% 50%, #1A4A9E 0%, transparent 50%), radial-gradient(circle at 75% 50%, #FF6B2C 0%, transparent 50%)" }} />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 text-center space-y-8">
          <Badge className="text-sm px-4 py-1" style={{ background: "rgba(255,107,44,0.15)", color: "#FF6B2C", border: "1px solid rgba(255,107,44,0.3)" }}>
            PLATAFORMA COMPLETA DE ENGENHARIA DE SANEAMENTO
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold font-mono text-white">
            CONSTRUDATA
            <br />
            <span style={{ color: "#FF6B2C", fontSize: "0.7em" }}>HYDRONETWORK</span>
          </h1>
          <p className="text-lg md:text-xl max-w-4xl mx-auto" style={{ color: "#94A3B8" }}>
            Do levantamento topográfico ao Relatório Diário de Obra — em uma única plataforma.
            Importe seus dados (CSV, DXF, SHP), dimensione redes de esgoto, água e drenagem,
            gere orçamento SINAPI automaticamente, planeje com Gantt e acompanhe a execução com RDO digital.
            Tudo no navegador, sem instalar nada.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={() => navigate("/hydronetwork")} className="font-bold text-lg px-8" style={{ background: "#FF6B2C", color: "#FFFFFF" }}>
              Acesso Gratuito — Plano DEMO <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => document.getElementById("modulos")?.scrollIntoView({ behavior: "smooth" })}
              className="font-bold text-lg px-8" style={{ borderColor: "#FF6B2C", color: "#FF6B2C" }}>
              Ver Módulos
            </Button>
            <Button size="lg" variant="outline" onClick={() => window.open('/hub/index.html', '_blank')}
              className="font-bold text-lg px-8" style={{ borderColor: "#1A4A9E", color: "#FF6B2C" }}>
              <Newspaper className="mr-2 h-5 w-5" /> Hub de Notícias
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
              <div key={i} className="rounded-none p-4 text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="text-3xl font-bold" style={{ color: "#FF6B2C" }}>{f.v}</div>
                <div className="text-xs mt-1" style={{ color: "#94A3B8" }}>{f.l}</div>
              </div>
            ))}
          </div>

          <a href="#screenshots" className="inline-block mt-8 animate-bounce">
            <ChevronDown className="h-8 w-8" style={{ color: "#FF6B2C" }} />
          </a>
        </div>
      </section>

      {/* Screenshots Section */}
      <section id="screenshots" data-animate className={`py-24 px-4 transition-all duration-700 ${isVisible("screenshots") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ background: "#F5F5F5" }}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold font-mono" style={{ color: "#10367D" }}>Veja a plataforma em ação</h2>
            <p style={{ color: "#64748B" }}>Ferramentas profissionais direto no navegador</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: Map, title: "Mapa interativo com rede dimensionada", desc: "Visualize nós, trechos e resultados hidráulicos georreferenciados com Leaflet" },
              { icon: BarChart3, title: "Gantt e Curva S automáticos", desc: "Planejamento de obra integrado com cronograma físico-financeiro" },
              { icon: DollarSign, title: "Orçamento SINAPI por trecho", desc: "Composições de custo automáticas para cada segmento da rede" },
              { icon: Zap, title: "Simulação EPANET com resultados", desc: "Análise hidráulica de pressão, vazão e velocidade via WASM" },
            ].map((card, i) => (
              <Card key={i} className="border-0 overflow-hidden hover:scale-[1.02] transition-transform" style={{ background: "#FFFFFF", border: "1px solid #EBEBEB" }}>
                <div className="aspect-video flex items-center justify-center" style={{ background: "#F5F5F5" }}>
                  <div className="text-center p-6">
                    <card.icon className="h-12 w-12 mx-auto mb-3" style={{ color: "#10367D" }} />
                    <p className="text-sm font-medium" style={{ color: "#10367D" }}>{card.title}</p>
                  </div>
                </div>
                <CardContent className="pt-4">
                  <h3 className="font-bold mb-1" style={{ color: "#10367D" }}>{card.title}</h3>
                  <p className="text-xs" style={{ color: "#64748B" }}>{card.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center">
            <Button size="lg" onClick={() => navigate("/hydronetwork")} className="font-bold" style={{ background: "#FF6B2C", color: "#FFFFFF" }}>
              Acessar Plataforma <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Cost Map Section */}
      <section id="custos" data-animate className={`py-24 px-4 transition-all duration-700 ${isVisible("custos") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ background: "#0A2456" }}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <Badge style={{ background: "rgba(255,107,44,0.15)", color: "#FF6B2C", border: "1px solid rgba(255,107,44,0.3)" }}>Controle Financeiro Total</Badge>
            <h2 className="text-4xl md:text-5xl font-bold font-mono text-white">Previsão de Custos por Trecho no Mapa</h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: "#94A3B8" }}>Saiba exatamente quanto cada metro de rede vai custar antes de iniciar.</p>
          </div>
          <CostMapSVG />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: MapPin, title: "Custo por Trecho", desc: "Cada segmento mostra seu custo individual baseado em extensão, diâmetro, profundidade e tipo de solo." },
              { icon: Palette, title: "Cores por Faixa de Custo", desc: "Identifique visualmente trechos caros (vermelho), médios (amarelo) e econômicos (verde)." },
              { icon: AlertTriangle, title: "Alertas de Custo Alto", desc: "Trechos com escavação profunda (>3m) ou interferências são destacados automaticamente." },
              { icon: BarChart3, title: "Análise de Cenários", desc: "Simule alterações de traçado e veja instantaneamente como o custo total muda." },
            ].map((f, i) => (
              <Card key={i} className="border-0 hover:scale-105 transition-transform" style={{ background: "#0E1B3D", border: "1px solid #1E3A6E" }}>
                <CardContent className="pt-6 space-y-3">
                  <f.icon className="h-8 w-8" style={{ color: "#FF6B2C" }} />
                  <h3 className="text-lg font-bold text-white">{f.title}</h3>
                  <p className="text-sm" style={{ color: "#94A3B8" }}>{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow / Fluxo Completo */}
      <section data-animate id="workflow" className={`py-24 px-4 transition-all duration-700 ${isVisible("workflow") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        style={{ background: "#F5F5F5" }}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold font-mono" style={{ color: "#10367D" }}>Fluxo Completo em 8 Etapas</h2>
            <p style={{ color: "#64748B" }}>Do projeto à entrega, tudo integrado</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {workflow.map((step, i) => (
              <div key={i} className="rounded-none p-6 text-center space-y-2 hover:scale-105 transition-transform" style={{ background: "#FFFFFF", border: "1px solid #EBEBEB" }}>
                <div className="text-2xl font-bold" style={{ color: "#FF6B2C" }}>{step.step}</div>
                <h3 className="text-sm font-bold" style={{ color: "#10367D" }}>{step.label}</h3>
                <p className="text-xs" style={{ color: "#64748B" }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Normas Técnicas */}
      <section id="normas" data-animate className={`py-24 px-4 transition-all duration-700 ${isVisible("normas") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ background: "#0A2456" }}>
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold font-mono text-white">Conforme Normas Brasileiras</h2>
            <p style={{ color: "#94A3B8" }}>Cálculos validados conforme as principais normas de saneamento</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {normas.map((n, i) => (
              <div key={i} className="rounded-none px-4 py-2 text-center" style={{ background: "rgba(255,107,44,0.1)", border: "1px solid rgba(255,107,44,0.25)" }}>
                <span className="font-bold text-sm" style={{ color: "#FF6B2C" }}>{n.code}</span>
                <span className="text-xs ml-2" style={{ color: "#94A3B8" }}>— {n.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modulos" data-animate className={`py-24 px-4 transition-all duration-700 ${isVisible("modulos") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        style={{ background: "#F5F5F5" }}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold font-mono" style={{ color: "#10367D" }}>17 Módulos Integrados</h2>
            <p style={{ color: "#64748B" }}>Tudo que você precisa em uma única plataforma</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {modules.map((m, i) => (
              <Card key={i} className={`hover:scale-105 transition-transform border-0 relative ${m.badge ? "opacity-70" : ""}`} style={{ background: "#FFFFFF", border: "1px solid #EBEBEB" }}>
                {m.badge && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: "rgba(245,158,11,0.1)", color: "#F59E0B" }}>{m.badge}</div>
                )}
                <CardContent className="pt-6 text-center space-y-2">
                  <m.icon className="h-8 w-8 mx-auto" style={{ color: m.color }} />
                  <h3 className="text-sm font-bold" style={{ color: "#10367D" }}>{m.label}</h3>
                  <p className="text-xs" style={{ color: "#64748B" }}>{m.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section data-animate id="social" className={`py-24 px-4 transition-all duration-700 ${isVisible("social") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ background: "#0A2456" }}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold font-mono text-white">Projetado por engenheiros, para engenheiros</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Building2, title: "Projeto Exemplo", desc: "Rede coletora de 3,2 km com 45 trechos — dimensionamento, orçamento e cronograma gerados automaticamente" },
              { icon: Ruler, title: "Validação Normativa", desc: "Verificação automática de velocidade, declividade, profundidade e pressão conforme ABNT" },
              { icon: Zap, title: "Workflow Integrado", desc: "Dados fluem da topografia ao RDO sem redigitação — importe uma vez, use em todos os módulos" },
            ].map((card, i) => (
              <Card key={i} className="border-0 hover:scale-105 transition-transform" style={{ background: "#0E1B3D", border: "1px solid #1E3A6E" }}>
                <CardContent className="pt-6 space-y-3 text-center">
                  <card.icon className="h-10 w-10 mx-auto" style={{ color: "#FF6B2C" }} />
                  <h3 className="text-lg font-bold text-white">{card.title}</h3>
                  <p className="text-sm" style={{ color: "#94A3B8" }}>{card.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Divider + ConstruData Obras */}
      <section data-animate id="construdata" className={`py-16 px-4 transition-all duration-700 ${isVisible("construdata") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        style={{ background: "#F5F5F5" }}>
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <p className="text-sm" style={{ color: "#64748B" }}>Conheça também nossa plataforma de gestão de obras</p>
          <h2 className="text-2xl font-bold font-mono" style={{ color: "#10367D" }}>CONSTRUDATA Obras</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {["Produção", "Equipes", "Materiais", "RDO"].map((m, i) => (
              <div key={i} className="rounded-none p-4 text-center text-sm" style={{ background: "#FFFFFF", border: "1px solid #EBEBEB" }}>
                <span className="font-medium" style={{ color: "#10367D" }}>{m}</span>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")} style={{ borderColor: "#10367D", color: "#10367D" }}>
            Ver CONSTRUDATA Obras <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 px-4 text-center" style={{ background: "linear-gradient(135deg, #0A2456 0%, #10367D 100%)" }}>
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-4xl font-bold font-mono text-white">
            Importe seus dados e veja os resultados em segundos
          </h2>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={() => navigate("/hydronetwork")} className="font-bold text-lg px-8" style={{ background: "#FF6B2C", color: "#FFFFFF" }}>
              Acessar Plataforma Gratuitamente <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/hydronetwork")} style={{ borderColor: "#FF6B2C", color: "#FF6B2C" }}>
              Carregar Projeto Exemplo
            </Button>
          </div>
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            Sem cadastro obrigatório • Sem cartão de crédito • Plano DEMO gratuito
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4" style={{ background: "#0A2456", borderTop: "1px solid #1E3A6E" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 text-sm" style={{ color: "#94A3B8" }}>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/favicon.svg" alt="ConstruData" className="h-6 w-6" />
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
        <div className="max-w-6xl mx-auto mt-8 pt-8 text-center text-xs" style={{ borderTop: "1px solid #1E3A6E", color: "#64748B" }}>
          © 2025 CONSTRUDATA HydroNetwork. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
};

export default HydroNetworkLanding;
