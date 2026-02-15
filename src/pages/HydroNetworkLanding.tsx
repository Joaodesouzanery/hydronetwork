import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  Droplets, MapPin, BarChart3, Calendar, ClipboardList, FileSpreadsheet,
  Upload, Settings2, Users, Zap, ArrowRight, CheckCircle2, ChevronDown,
  Globe, Calculator, Layers, GitBranch, Shield, Eye
} from "lucide-react";

const CostMapSVG = () => (
  <svg viewBox="0 0 800 450" className="w-full rounded-xl border border-white/10 shadow-2xl" style={{ background: "#1e293b" }}>
    {/* Street grid */}
    <rect x="100" y="50" width="600" height="350" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="1" />
    <line x1="100" y1="200" x2="700" y2="200" stroke="#334155" strokeWidth="1" strokeDasharray="5,5" />
    <line x1="400" y1="50" x2="400" y2="400" stroke="#334155" strokeWidth="1" strokeDasharray="5,5" />

    {/* Trechos - colored by cost */}
    {/* Low cost - Green */}
    <line x1="180" y1="120" x2="320" y2="120" stroke="#10b981" strokeWidth="6" strokeLinecap="round" />
    <text x="230" y="110" fill="#10b981" fontSize="11" fontWeight="bold">R$ 12.450</text>

    <line x1="320" y1="120" x2="320" y2="250" stroke="#10b981" strokeWidth="6" strokeLinecap="round" />
    <text x="330" y="190" fill="#10b981" fontSize="11" fontWeight="bold">R$ 18.200</text>

    {/* Medium cost - Yellow */}
    <line x1="320" y1="250" x2="500" y2="250" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
    <text x="380" y="240" fill="#f59e0b" fontSize="11" fontWeight="bold">R$ 45.890</text>

    <line x1="500" y1="120" x2="500" y2="250" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
    <text x="510" y="190" fill="#f59e0b" fontSize="11" fontWeight="bold">R$ 32.100</text>

    <line x1="320" y1="120" x2="500" y2="120" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
    <text x="390" y="110" fill="#f59e0b" fontSize="11" fontWeight="bold">R$ 28.750</text>

    {/* High cost - Red */}
    <line x1="500" y1="250" x2="650" y2="350" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
    <text x="560" y="310" fill="#ef4444" fontSize="11" fontWeight="bold">R$ 87.340</text>
    <text x="580" y="325" fill="#ef4444" fontSize="9">Prof: 4.2m</text>

    <line x1="180" y1="120" x2="180" y2="320" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
    <text x="130" y="220" fill="#ef4444" fontSize="11" fontWeight="bold">R$ 67.120</text>

    {/* PVs */}
    {[
      [180, 120], [320, 120], [500, 120],
      [320, 250], [500, 250], [650, 350],
      [180, 320],
    ].map(([cx, cy], i) => (
      <g key={i}>
        <circle cx={cx} cy={cy} r="10" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
        <text x={cx} y={cy + 4} fill="white" fontSize="8" textAnchor="middle" fontWeight="bold">PV{i + 1}</text>
      </g>
    ))}

    {/* Legend */}
    <rect x="550" y="60" width="140" height="90" rx="6" fill="#0f172a" stroke="#334155" strokeWidth="1" />
    <text x="570" y="80" fill="#94a3b8" fontSize="10" fontWeight="bold">CUSTO POR TRECHO</text>
    <circle cx="570" cy="95" r="5" fill="#10b981" /><text x="582" y="99" fill="#94a3b8" fontSize="9">&lt; R$ 20k</text>
    <circle cx="570" cy="115" r="5" fill="#f59e0b" /><text x="582" y="119" fill="#94a3b8" fontSize="9">R$ 20k - 50k</text>
    <circle cx="570" cy="135" r="5" fill="#ef4444" /><text x="582" y="139" fill="#94a3b8" fontSize="9">&gt; R$ 50k</text>

    {/* Total cost box */}
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
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setVisibleSections(prev => new Set([...prev, entry.target.id]));
          }
        });
      },
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
    { icon: Layers, label: "Integração SWMM", color: "#22c55e", desc: "Drenagem urbana" },
    { icon: Users, label: "Revisão por Pares", color: "#3b82f6", desc: "Workflow de aprovação" },
    { icon: BarChart3, label: "Integração ProjectLibre", color: "#ec4899", desc: "Gantt avançado" },
  ];

  const workflow = [
    { icon: Upload, label: "Importe", desc: "CAD, CSV, SHP" },
    { icon: Settings2, label: "Configure", desc: "Parâmetros" },
    { icon: Calculator, label: "Calcule", desc: "Orçamento" },
    { icon: Calendar, label: "Planeje", desc: "Cronograma" },
    { icon: ClipboardList, label: "Execute", desc: "RDO Digital" },
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
            <a href="#mapa" className="hover:text-white transition-colors" style={{ color: "#94a3b8" }}>Mapa Interativo</a>
            <a href="#modulos" className="hover:text-white transition-colors" style={{ color: "#94a3b8" }}>Módulos</a>
            <a href="#solucoes" className="hover:text-white transition-colors" style={{ color: "#94a3b8" }}>Soluções</a>
          </nav>
          <Button
            onClick={() => navigate("/hydronetwork")}
            className="font-semibold text-sm"
            style={{ background: "#c9a227", color: "#1a1f2e" }}
          >
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
            PLATAFORMA COMPLETA DE ENGENHARIA
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>
            CONSTRUDATA
            <br />
            <span style={{ color: "#c9a227", fontSize: "0.7em" }}>HYDRONETWORK</span>
          </h1>
          <p className="text-lg md:text-xl max-w-3xl mx-auto" style={{ color: "#94a3b8" }}>
            A única plataforma que integra mapas interativos, dimensionamento hidráulico, orçamentação SINAPI/SICRO,
            acompanhamento de obra por trechos, Gantt interativo e RDO digital em um único ambiente.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={() => navigate("/hydronetwork")} className="font-bold text-lg px-8" style={{ background: "#c9a227", color: "#1a1f2e" }}>
              Acessar Agora <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => document.getElementById("modulos")?.scrollIntoView({ behavior: "smooth" })}
              className="font-bold text-lg px-8" style={{ borderColor: "#c9a227", color: "#c9a227" }}>
              Ver Módulos
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              "✓ Importação DXF/DWG/Shapefile",
              "✓ Mapa interativo com Leaflet",
              "✓ Curva S automática",
              "✓ 100% gratuito",
            ].map((f, i) => (
              <div key={i} className="rounded-lg p-3 text-sm font-medium" style={{ background: "#ffffff08", border: "1px solid #ffffff10" }}>
                {f}
              </div>
            ))}
          </div>

          {/* Mock card */}
          <div className="mt-8 max-w-md mx-auto rounded-xl p-6" style={{ background: "#0f172a", border: "1px solid #334155" }}>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5" style={{ color: "#3b82f6" }} />
              <span className="text-sm font-semibold">Rede de Saneamento</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { v: "23", l: "Trechos" },
                { v: "15", l: "PVs" },
                { v: "87%", l: "Concluído" },
              ].map((s, i) => (
                <div key={i} className="rounded-lg p-3 text-center" style={{ background: "#1e293b" }}>
                  <div className="text-xl font-bold" style={{ color: "#c9a227" }}>{s.v}</div>
                  <div className="text-[10px]" style={{ color: "#64748b" }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <a href="#custos" className="inline-block mt-8 animate-bounce">
            <ChevronDown className="h-8 w-8" style={{ color: "#c9a227" }} />
          </a>
        </div>
      </section>

      {/* Cost Map Section */}
      <section id="custos" data-animate className={`py-24 px-4 transition-all duration-700 ${isVisible("custos") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <Badge style={{ background: "#3b82f633", color: "#60a5fa", border: "1px solid #3b82f655" }}>Controle Financeiro Total</Badge>
            <h2 className="text-4xl md:text-5xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Previsão de Custos por Trecho no Mapa
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: "#94a3b8" }}>
              Saiba exatamente quanto cada metro de rede vai custar antes de iniciar. Visualize os custos diretamente no mapa interativo.
            </p>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-1 hover:scale-105 transition-transform" style={{ background: "#0f172a", border: "2px solid #c9a227" }}>
              <CardContent className="pt-6 space-y-3">
                <span className="text-2xl">📅</span>
                <h3 className="text-lg font-bold" style={{ color: "#c9a227" }}>Cronograma dos Custos</h3>
                <p className="text-sm" style={{ color: "#94a3b8" }}>Gera automaticamente o cronograma físico-financeiro.</p>
                <div className="flex flex-wrap gap-1">
                  {["Curva S Financeira", "Gantt por Trecho", "Caminho Crítico", "Fluxo de Caixa"].map(t => (
                    <Badge key={t} variant="outline" className="text-xs" style={{ borderColor: "#c9a22755", color: "#e8c547" }}>{t}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="hover:scale-105 transition-transform" style={{ background: "#0f172a", border: "1px solid #334155" }}>
              <CardContent className="pt-6 space-y-3">
                <span className="text-2xl">🧮</span>
                <h3 className="text-lg font-bold text-white">Composição Automática</h3>
                <p className="text-sm" style={{ color: "#94a3b8" }}>Cada trecho é orçado com composições SINAPI/SICRO:</p>
                <div className="flex flex-wrap gap-1">
                  {["Escavação", "Escoramento", "Brita", "Tubulação", "Reaterro", "Compactação", "PV", "Ligações"].map(t => (
                    <Badge key={t} variant="outline" className="text-xs" style={{ borderColor: "#3b82f655", color: "#60a5fa" }}>{t}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="hover:scale-105 transition-transform" style={{ background: "#0f172a", border: "1px solid #334155" }}>
              <CardContent className="pt-6 space-y-3">
                <span className="text-2xl">📈</span>
                <h3 className="text-lg font-bold text-white">Previsões Inteligentes</h3>
                <p className="text-sm" style={{ color: "#94a3b8" }}>Com base no avanço registrado no RDO:</p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { v: "R$ 45.200", l: "Gasto até hoje" },
                    { v: "R$ 188.650", l: "Previsão restante" },
                    { v: "+2.3%", l: "Variação" },
                  ].map((s, i) => (
                    <div key={i} className="rounded-lg p-2 text-center" style={{ background: "#1e293b" }}>
                      <div className="text-sm font-bold text-white">{s.v}</div>
                      <div className="text-[9px]" style={{ color: "#64748b" }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Problems & Solutions */}
      <section id="solucoes" data-animate className={`py-24 px-4 transition-all duration-700 ${isVisible("solucoes") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        style={{ background: "#0f172a" }}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <Badge style={{ background: "#ef444433", color: "#f87171", border: "1px solid #ef444455" }}>Problemas que Resolvemos</Badge>
            <h2 className="text-4xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Sua Equipe Ainda Sofre com Isso?
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { prob: "📋 Planilhas Desconectadas", sol: "🔗 Tudo Integrado" },
              { prob: "🗺️ Acompanhamento Cego", sol: "📍 Mapa de Progresso" },
              { prob: "💸 Orçamentos Demorados", sol: "⚡ Orçamento Automático" },
              { prob: "📊 Cronograma Manual", sol: "📅 Gantt Inteligente" },
            ].map((ps, i) => (
              <div key={i} className="space-y-3">
                <div className="rounded-lg p-4 text-center" style={{ background: "#1e293b", border: "1px solid #ef444433" }}>
                  <p className="text-sm font-semibold" style={{ color: "#f87171" }}>{ps.prob}</p>
                </div>
                <div className="text-center"><ArrowRight className="h-5 w-5 mx-auto rotate-90" style={{ color: "#c9a227" }} /></div>
                <div className="rounded-lg p-4 text-center" style={{ background: "#1e293b", border: "1px solid #22c55e33" }}>
                  <p className="text-sm font-semibold" style={{ color: "#22c55e" }}>{ps.sol}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Map Section */}
      <section id="mapa" data-animate className={`py-24 px-4 transition-all duration-700 ${isVisible("mapa") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <Badge style={{ background: "#06b6d433", color: "#22d3ee", border: "1px solid #06b6d455" }}>Diferencial Exclusivo</Badge>
            <h2 className="text-4xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Mapa Interativo com Avanço por Trechos
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="rounded-xl overflow-hidden" style={{ background: "#0f172a", border: "1px solid #334155" }}>
              <CostMapSVG />
            </div>
            <div className="space-y-4">
              {[
                { icon: Globe, label: "Mapa com Leaflet", desc: "Visualização georreferenciada interativa" },
                { icon: MapPin, label: "Status por Trecho", desc: "Cinza → Amarelo → Verde → Concluído" },
                { icon: BarChart3, label: "Avanço Físico Visual", desc: "Progresso por trecho no mapa" },
                { icon: Eye, label: "Registro Fotográfico", desc: "Fotos geolocalizadas por trecho" },
                { icon: FileSpreadsheet, label: "Exportação GIS", desc: "SHP, GeoJSON, KML" },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg p-4 hover:scale-105 transition-transform" style={{ background: "#0f172a", border: "1px solid #334155" }}>
                  <f.icon className="h-8 w-8 flex-shrink-0" style={{ color: "#3d6cb9" }} />
                  <div>
                    <h3 className="font-bold text-white">{f.label}</h3>
                    <p className="text-sm" style={{ color: "#94a3b8" }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modulos" data-animate className={`py-24 px-4 transition-all duration-700 ${isVisible("modulos") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        style={{ background: "#0f172a" }}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>Módulos</h2>
            <p style={{ color: "#94a3b8" }}>Tudo que você precisa em uma única plataforma</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {modules.map((m, i) => (
              <Card key={i} className="hover:scale-105 transition-transform border-0" style={{ background: "#1e293b", border: "1px solid #334155" }}>
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

      {/* Workflow */}
      <section data-animate id="workflow" className={`py-24 px-4 transition-all duration-700 ${isVisible("workflow") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="max-w-6xl mx-auto space-y-12">
          <h2 className="text-4xl font-bold text-center" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Do CAD ao RDO em 5 Passos
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {workflow.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="rounded-xl p-6 text-center space-y-2 hover:scale-110 transition-transform" style={{ background: "#0f172a", border: "1px solid #334155", minWidth: 130 }}>
                  <step.icon className="h-8 w-8 mx-auto" style={{ color: "#c9a227" }} />
                  <h3 className="text-sm font-bold text-white">{step.label}</h3>
                  <p className="text-xs" style={{ color: "#64748b" }}>{step.desc}</p>
                </div>
                {i < workflow.length - 1 && <ArrowRight className="h-6 w-6 hidden md:block" style={{ color: "#c9a227" }} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section data-animate id="stats" className={`py-20 px-4 transition-all duration-700 ${isVisible("stats") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        style={{ background: "linear-gradient(135deg, #2c4a7c, #1a1f2e)" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 text-center">
          {[
            { v: "87%", l: "Mais Rápido" },
            { v: "35%", l: "Economia" },
            { v: "99%", l: "Precisão" },
            { v: "11", l: "Módulos" },
            { v: "100%", l: "Gratuito" },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-4xl md:text-5xl font-bold" style={{ color: "#c9a227", fontFamily: "Montserrat, sans-serif" }}>{s.v}</div>
              <div className="text-sm mt-1" style={{ color: "#94a3b8" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center" style={{ background: "#0f172a" }}>
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-4xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>
            Pronto para Transformar seus Projetos?
          </h2>
          <p style={{ color: "#94a3b8" }}>
            Acesse agora a plataforma completa. Sem cadastro, sem cartão de crédito, sem compromisso.
          </p>
          <Button size="lg" onClick={() => navigate("/hydronetwork")} className="font-bold text-lg px-10" style={{ background: "#c9a227", color: "#1a1f2e" }}>
            Acessar Plataforma Agora <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
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
            {["Topografia", "Orçamento", "Planejamento", "RDO Digital"].map(m => <p key={m} className="text-xs mb-1">{m}</p>)}
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">Ferramentas</h4>
            {["Mapa Interativo", "Curva S", "Gantt", "EVM"].map(m => <p key={m} className="text-xs mb-1">{m}</p>)}
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">Custos</h4>
            {["Por Trecho", "SINAPI", "SICRO", "Cenários"].map(m => <p key={m} className="text-xs mb-1">{m}</p>)}
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">Formatos</h4>
            {["CSV/Excel", "DXF/DWG", "SHP/GeoJSON", "PDF/IFC"].map(m => <p key={m} className="text-xs mb-1">{m}</p>)}
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 text-center text-xs" style={{ borderTop: "1px solid #1e293b", color: "#475569" }}>
          © 2024 ConstruData HydroNetwork. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
};

export default HydroNetworkLanding;
