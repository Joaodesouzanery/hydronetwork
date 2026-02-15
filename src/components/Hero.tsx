import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Shield, FileText, BarChart3, Users, Package, ClipboardList, QrCode,
  Camera, TrendingUp, MapPin, Wrench, Building2, Bell, FolderOpen,
  Database, CheckSquare, Truck, DollarSign, Zap, Map, Archive, Mail,
  ChevronRight, Check, ArrowRight, Briefcase, UserCheck, Target, Droplets,
  Globe, Cpu, LineChart, Layers, Clock, Star, Play, ChevronDown,
  Workflow, Gauge, Ruler, Upload, Settings2, GitBranch, CloudRain,
  Beaker, Waves, FileSpreadsheet, Activity, Eye, Calculator, Calendar
} from "lucide-react";
import { ContactDialog } from "@/components/ContactDialog";
import { FAQ } from "@/components/FAQ";
import { Logo } from "@/components/shared/Logo";
import heroBg from "@/assets/landing/hero-bg.jpg";

const Hero = () => {
  const navigate = useNavigate();
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [dialogDismissed, setDialogDismissed] = useState(false);
  const [activeModule, setActiveModule] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setShowContactDialog(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setActiveModule((p) => (p + 1) % 6), 2500);
    return () => clearInterval(interval);
  }, []);

  const handleDialogClose = (open: boolean) => {
    setShowContactDialog(open);
    if (!open) setDialogDismissed(true);
  };

  // ═══════════ ALL 17 HydroNetwork Modules ═══════════
  const hydroModules = [
    { icon: Upload, title: "Topografia Inteligente", desc: "Processamento automático de dados topográficos. Suporte a CSV, TXT, XLSX, DXF, SHP, GeoJSON e LandXML. Geração instantânea de trechos com análise de relevo.", route: "/hydronetwork/topografia", color: "from-blue-500 to-blue-600" },
    { icon: GitBranch, title: "Rede de Esgoto", desc: "Dimensionamento de redes de esgoto por gravidade e elevatória. Cálculo automático de declividades, diâmetros e verificação normativa ABNT.", route: "/hydronetwork/esgoto", color: "from-purple-500 to-purple-600" },
    { icon: Droplets, title: "Rede de Água", desc: "Projeto de redes de distribuição de água pressurizadas. Cálculo de pressão, velocidade e perdas de carga por trecho.", route: "/hydronetwork/agua", color: "from-cyan-500 to-cyan-600" },
    { icon: CloudRain, title: "Drenagem Pluvial", desc: "Dimensionamento de galerias e estruturas de drenagem urbana. Cálculo de vazões pelo método racional e tempo de concentração.", route: "/hydronetwork/drenagem", color: "from-green-500 to-green-600" },
    { icon: FileSpreadsheet, title: "Quantitativos", desc: "Cálculo automático de volumes de escavação, reaterro, tubulação, PVs e serviços complementares por trecho.", route: "/hydronetwork/quantitativos", color: "from-amber-500 to-amber-600" },
    { icon: Calculator, title: "Orçamento e Custos", desc: "Orçamentação automatizada com composições SINAPI/SICRO. Custo por trecho visualizado no mapa interativo com faixas de cor.", route: "/hydronetwork/orcamento", color: "from-emerald-500 to-emerald-600" },
    { icon: Calendar, title: "Planejamento de Obra", desc: "Cronograma executivo com Gantt interativo, Curva S automática, EVM (Earned Value Management) e caminho crítico.", route: "/hydronetwork/planejamento", color: "from-pink-500 to-pink-600" },
    { icon: Beaker, title: "Simulação EPANET", desc: "Integração direta com motor EPANET para simulação hidráulica. Exportação de arquivos .INP prontos para análise de pressão e vazão.", route: "/hydronetwork/epanet", color: "from-sky-500 to-sky-600" },
    { icon: Waves, title: "Simulação SWMM", desc: "Integração com SWMM para modelagem de drenagem urbana. Análise de escoamento, capacidade de galerias e cenários de chuva.", route: "/hydronetwork/swmm", color: "from-teal-500 to-teal-600" },
    { icon: Layers, title: "OpenProject", desc: "Integração com OpenProject para gestão ágil. Criação automática de Work Packages por trecho e equipe.", route: "/hydronetwork/openproject", color: "from-orange-500 to-orange-600" },
    { icon: FileText, title: "ProjectLibre", desc: "Exportação de cronograma para ProjectLibre (Gantt). Compatível com Microsoft Project para planejamento avançado.", route: "/hydronetwork/projectlibre", color: "from-indigo-500 to-indigo-600" },
    { icon: Map, title: "Integração QGIS", desc: "Exportação para QGIS com camadas vetoriais. Shapefile, GeoJSON e GeoPackage com atributos hidráulicos completos.", route: "/hydronetwork/qgis", color: "from-green-600 to-green-700" },
    { icon: Shield, title: "Revisão por Pares", desc: "Workflow automatizado de verificação técnica. Checklist normativo ABNT, análise de velocidade, declividade e profundidade.", route: "/hydronetwork/revisao", color: "from-violet-500 to-violet-600" },
    { icon: ClipboardList, title: "RDO Digital", desc: "Relatório Diário de Obra especializado para saneamento. Registro de avanço por trecho com fotos, GPS, clima e equipe.", route: "/hydronetwork/rdo", color: "from-rose-500 to-rose-600" },
    { icon: Activity, title: "Perfil Longitudinal", desc: "Visualização do corte vertical da rede. Escalas horizontal/vertical configuráveis e exagero vertical para análise técnica.", route: "/hydronetwork/perfil", color: "from-slate-500 to-slate-600" },
    { icon: MapPin, title: "Mapa Interativo", desc: "Mapa Leaflet com visualização georreferenciada. Codificação por cores, status por trecho, camadas configuráveis e popup técnico.", route: "/hydronetwork/mapa", color: "from-blue-600 to-blue-700" },
    { icon: Globe, title: "Exportação GIS", desc: "Exportação multi-formato: Shapefile, GeoJSON, GeoPackage, KML/KMZ, DXF (AutoCAD) e CSV. Suporte a múltiplos CRS (SIRGAS 2000, WGS84).", route: "/hydronetwork/exportacao", color: "from-fuchsia-500 to-fuchsia-600" },
  ];

  const corePillars = [
    { icon: Upload, label: "Topografia", color: "text-blue-400" },
    { icon: Calculator, label: "Orçamento", color: "text-amber-400" },
    { icon: Calendar, label: "Planejamento", color: "text-pink-400" },
    { icon: Beaker, label: "Simulação", color: "text-cyan-400" },
    { icon: Shield, label: "Revisão", color: "text-violet-400" },
    { icon: ClipboardList, label: "RDO", color: "text-rose-400" },
  ];

  const comparativeTable = [
    { feature: "Pré-dimensionamento automático de redes", planilhas: false, outros: false, hydro: true },
    { feature: "Simulação EPANET integrada", planilhas: false, outros: "partial", hydro: true },
    { feature: "Simulação SWMM integrada", planilhas: false, outros: false, hydro: true },
    { feature: "Orçamento SINAPI/SICRO por trecho", planilhas: false, outros: false, hydro: true },
    { feature: "Mapa interativo com custos", planilhas: false, outros: false, hydro: true },
    { feature: "Gantt + Curva S + EVM", planilhas: false, outros: "partial", hydro: true },
    { feature: "Exportação QGIS / Shapefile / DXF", planilhas: false, outros: "partial", hydro: true },
    { feature: "RDO Digital por trecho", planilhas: false, outros: false, hydro: true },
    { feature: "Revisão técnica automatizada", planilhas: false, outros: false, hydro: true },
    { feature: "100% Online — sem instalação", planilhas: true, outros: "partial", hydro: true },
  ];

  const flowSteps = [
    { num: "01", title: "Topografia", desc: "Upload de dados CAD, CSV, SHP ou DXF", icon: Upload },
    { num: "02", title: "Dimensionamento", desc: "Cálculo automático de redes (esgoto, água, drenagem)", icon: GitBranch },
    { num: "03", title: "Orçamento", desc: "Composições SINAPI/SICRO por trecho", icon: DollarSign },
    { num: "04", title: "Simulação", desc: "EPANET (pressão) e SWMM (drenagem)", icon: Beaker },
    { num: "05", title: "Planejamento", desc: "Gantt, Curva S e caminho crítico", icon: Calendar },
    { num: "06", title: "Revisão", desc: "Peer Review com checklist normativo", icon: Shield },
    { num: "07", title: "Execução", desc: "RDO Digital com avanço por trecho", icon: ClipboardList },
    { num: "08", title: "Exportação", desc: "GIS, DXF, PDF e relatórios", icon: Globe },
  ];

  const formatsSupported = [
    { category: "Entrada", items: ["CSV / TXT", "XLSX / XLS", "DXF / DWG", "Shapefile (.SHP)", "GeoJSON", "LandXML"] },
    { category: "Saída", items: ["Shapefile", "GeoJSON", "GeoPackage", "KML / KMZ", "DXF (AutoCAD)", "CSV / Excel", "PDF", ".INP (EPANET)", ".inp (SWMM)"] },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ═══════════ NAV ═══════════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <span className="text-xs sm:text-sm font-bold text-primary hidden sm:inline">| HydroNetwork</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>Entrar</Button>
            <Button size="sm" onClick={() => navigate('/auth?tab=signup')} className="bg-primary hover:bg-primary/90">
              Começar Grátis
            </Button>
          </div>
        </div>
      </nav>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
        </div>

        <div className="container mx-auto px-4 z-10 py-12 md:py-0">
          <div className="max-w-3xl space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/15 border border-cyan-500/25 text-sm font-bold text-cyan-500">
              <Droplets className="w-4 h-4" />
              Plataforma Completa de Engenharia de Saneamento
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-primary bg-clip-text text-transparent">
                HydroNetwork
              </span>
              <br />
              <span className="text-foreground text-3xl sm:text-4xl md:text-5xl">
                Do CAD ao RDO em uma única plataforma.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              <strong className="text-foreground">17 módulos integrados</strong> para pré-dimensionamento de redes, 
              simulação hidráulica (EPANET/SWMM), orçamentação SINAPI/SICRO, 
              planejamento com Gantt e RDO digital — tudo 100% online.
            </p>

            {/* Animated core pillars */}
            <div className="flex flex-wrap gap-3">
              {corePillars.map((p, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-500 border ${
                    activeModule === i
                      ? "bg-primary/15 border-primary/40 text-primary scale-105 shadow-lg shadow-primary/10"
                      : "bg-muted/40 border-border text-muted-foreground"
                  }`}
                >
                  <p.icon className={`w-4 h-4 ${activeModule === i ? "text-primary" : p.color}`} />
                  {p.label}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                size="lg"
                className="text-lg px-8 py-6 rounded-xl shadow-lg shadow-primary/30 bg-primary hover:bg-primary/90"
                onClick={() => navigate('/hydronetwork')}
              >
                Acessar Plataforma
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6 rounded-xl"
                onClick={() => navigate('/auth?tab=signup')}
              >
                <Play className="w-5 h-5 mr-2" />
                Teste Grátis — 30 Dias
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {["Sem instalação", "100% gratuito", "17 módulos", "Exportação GIS"].map((t, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-500" /> {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden md:block">
          <ChevronDown className="w-6 h-6 text-muted-foreground" />
        </div>
      </section>

      {/* ═══════════════ STATS ═══════════════ */}
      <section className="py-16 border-y border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { value: "17", label: "Módulos Integrados" },
              { value: "87%", label: "Mais Rápido" },
              { value: "35%", label: "Economia Média" },
              { value: "99%", label: "Precisão Técnica" },
              { value: "100%", label: "Online" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-black text-primary">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FLUXO COMPLETO ═══════════════ */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Fluxo Completo — <span className="text-primary">Do Projeto à Entrega</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              8 etapas integradas que cobrem todo o ciclo de um projeto de saneamento
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            {flowSteps.map((step, i) => (
              <div key={i} className="relative p-5 rounded-xl border border-border bg-card hover:shadow-lg hover:border-primary/30 transition-all group">
                <div className="text-4xl font-black text-primary/15 absolute top-3 right-4 group-hover:text-primary/25 transition-colors">{step.num}</div>
                <step.icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-bold mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ TODOS OS 17 MÓDULOS ═══════════════ */}
      <section className="py-20 bg-gradient-to-br from-blue-950 via-blue-900 to-cyan-900 text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-400/15 text-cyan-300 border border-cyan-400/25 text-sm font-bold mb-4">
              <Droplets className="w-4 h-4" /> Catálogo Completo
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-3">
              17 Módulos Integrados
            </h2>
            <p className="text-blue-200/70 max-w-3xl mx-auto text-lg">
              Cada módulo foi projetado para resolver um problema real da engenharia de saneamento
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {hydroModules.map((m, i) => (
              <div
                key={i}
                onClick={() => navigate(m.route)}
                className="p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-cyan-400/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${m.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                    <m.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm mb-1 text-white">{m.title}</h3>
                    <p className="text-xs text-blue-200/60 leading-relaxed">{m.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Button
              size="lg"
              onClick={() => navigate('/hydronetwork')}
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-6 rounded-xl text-lg"
            >
              Acessar Plataforma Completa <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════ FORMATOS SUPORTADOS ═══════════════ */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              Formatos <span className="text-primary">Suportados</span>
            </h2>
            <p className="text-muted-foreground">Compatível com os principais softwares de engenharia</p>
          </div>

          <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-6">
            {formatsSupported.map((cat, i) => (
              <div key={i} className="p-6 rounded-xl border border-border bg-card">
                <h3 className="font-black text-lg mb-4 text-primary">{cat.category === "Entrada" ? "📥 Formatos de Entrada" : "📤 Formatos de Saída"}</h3>
                <div className="flex flex-wrap gap-2">
                  {cat.items.map((item, j) => (
                    <span key={j} className="px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ COMPARATIVO ═══════════════ */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              Diferenciais <span className="text-primary">Competitivos</span>
            </h2>
            <p className="text-muted-foreground">Por que engenheiros migram para o HydroNetwork</p>
          </div>

          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-primary/30">
                  <th className="text-left py-4 px-3 font-bold">Funcionalidade</th>
                  <th className="text-center py-4 px-3 text-muted-foreground">Planilhas</th>
                  <th className="text-center py-4 px-3 text-muted-foreground">Outros Softwares</th>
                  <th className="text-center py-4 px-3 font-bold text-primary">HydroNetwork</th>
                </tr>
              </thead>
              <tbody>
                {comparativeTable.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-3 px-3 font-medium">{row.feature}</td>
                    <td className="text-center py-3">{row.planilhas ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <span className="text-red-400">✕</span>}</td>
                    <td className="text-center py-3">{row.outros === true ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : row.outros === "partial" ? <span className="text-yellow-500">◐</span> : <span className="text-red-400">✕</span>}</td>
                    <td className="text-center py-3"><Check className="w-5 h-5 text-emerald-500 mx-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══════════════ CONSTRUDATA OBRAS (outra plataforma) ═══════════════ */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="p-8 rounded-2xl border-2 border-dashed border-secondary/40 bg-secondary/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black">ConstruData — Obras</h2>
                  <p className="text-sm text-muted-foreground">Plataforma separada de gestão de obras</p>
                </div>
              </div>

              <p className="text-muted-foreground mb-6">
                Além do HydroNetwork, oferecemos o <strong className="text-foreground">ConstruData Obras</strong> — uma plataforma independente com{" "}
                <strong className="text-foreground">26 módulos</strong> focados em gestão operacional de obras civis:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-6">
                {[
                  "Gestão de Projetos", "RDO Digital", "Controle de Produção", "Gestão de Equipes",
                  "Materiais & Estoque", "Pedidos de Material", "Orçamentos com BDI", "Dashboard 360°",
                  "Alertas Inteligentes", "QR Codes", "Manutenção Predial", "CRM Completo",
                  "RH & Escalas CLT", "Checklists", "Ocorrências", "Relatórios de Ligação",
                ].map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-card border border-border">
                    <Check className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
                    <span>{m}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="border-secondary/50 text-secondary hover:bg-secondary/10"
                onClick={() => navigate('/modules')}
              >
                Ver Catálogo de Módulos ConstruData <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ SEGURANÇA ═══════════════ */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black">
                Tecnologia e <span className="text-primary">Segurança</span>
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: "🌐", title: "100% Web", desc: "React + TypeScript + Supabase" },
                { icon: "🗺️", title: "Mapas Leaflet", desc: "Precisão GIS para engenharia" },
                { icon: "🔐", title: "Dados Seguros", desc: "Criptografia e backup 24/7" },
                { icon: "📱", title: "Responsivo", desc: "Desktop, tablet e celular" },
              ].map((item, i) => (
                <div key={i} className="p-5 rounded-xl border border-border bg-card text-center">
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h3 className="font-bold text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ OBJEÇÕES ═══════════════ */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-12">
              Dúvidas <span className="text-primary">Respondidas</span>
            </h2>
            <div className="space-y-4">
              {[
                { q: '"Preciso instalar alguma coisa?"', a: "Não! O HydroNetwork é 100% online. Funciona no navegador — sem instalação, sem plugins, sem licenças." },
                { q: '"Funciona para esgoto, água E drenagem?"', a: "Sim! Temos módulos dedicados para cada tipo de rede, com motores de cálculo específicos (EPANET para água, SWMM para drenagem)." },
                { q: '"Posso exportar para o QGIS e AutoCAD?"', a: "Sim! Exportamos para Shapefile, GeoJSON, GeoPackage, DXF, KML e mais. Totalmente compatível com QGIS, AutoCAD e Google Earth." },
                { q: '"Quanto custa?"', a: "O HydroNetwork é gratuito para uso. Acesse agora sem cartão de crédito e comece a projetar." },
                { q: '"E se eu já tenho dados em planilha?"', a: "Perfeito! Importamos CSV, TXT, XLSX e XLS. Até dados sem cabeçalho (X, Y, Z) são processados automaticamente." },
              ].map((obj, i) => (
                <div key={i} className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
                  <h3 className="font-bold text-lg mb-2">{obj.q}</h3>
                  <p className="text-muted-foreground text-sm">{obj.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FAQ />

      {/* ═══════════════ CTA FINAL ═══════════════ */}
      <section className="py-24 bg-gradient-to-br from-blue-950 via-primary to-blue-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.05)_0%,transparent_60%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-5xl font-black">
              Pronto para transformar seus projetos de saneamento?
            </h2>
            <p className="text-xl text-white/80">
              17 módulos integrados. Do pré-dimensionamento ao RDO. 100% online e gratuito.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="text-lg px-8 py-6 rounded-xl bg-white text-primary hover:bg-white/90 shadow-lg"
                onClick={() => navigate('/hydronetwork')}
              >
                Acessar Plataforma <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6 rounded-xl bg-transparent border-white/30 text-white hover:bg-white/10"
                asChild
              >
                <a href="https://calendly.com/joaodsouzanery/apresentacao-personalrh" target="_blank" rel="noopener noreferrer">
                  Agendar Demonstração
                </a>
              </Button>
            </div>
            <p className="text-white/50 text-sm">
              Sem cadastro obrigatório • Sem cartão de crédito • Suporte incluso
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-card border-t border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm text-muted-foreground">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Droplets className="h-5 w-5 text-primary" />
                <span className="font-bold text-foreground">HydroNetwork</span>
              </div>
              <p className="text-xs">Plataforma completa de engenharia de saneamento</p>
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-3">Redes</h4>
              {["Esgoto (Gravidade)", "Água (Pressão)", "Drenagem Pluvial", "Elevatória/Recalque"].map(m => <p key={m} className="text-xs mb-1">{m}</p>)}
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-3">Ferramentas</h4>
              {["EPANET", "SWMM", "QGIS", "Gantt / Curva S", "Revisão por Pares"].map(m => <p key={m} className="text-xs mb-1">{m}</p>)}
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-3">Formatos</h4>
              {["CSV / Excel", "DXF / AutoCAD", "Shapefile / GeoJSON", ".INP (EPANET/SWMM)"].map(m => <p key={m} className="text-xs mb-1">{m}</p>)}
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} ConstruData HydroNetwork. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* Floating Contact */}
      {dialogDismissed && !showContactDialog && (
        <Button
          onClick={() => setShowContactDialog(true)}
          className="fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all bg-primary"
          size="icon"
        >
          <Mail className="h-6 w-6" />
        </Button>
      )}

      <ContactDialog open={showContactDialog} onOpenChange={handleDialogClose} />
    </div>
  );
};

export default Hero;
