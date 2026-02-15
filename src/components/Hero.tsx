import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Shield, FileText, BarChart3, Users, Package, ClipboardList, QrCode,
  Camera, TrendingUp, MapPin, Wrench, Building2, Bell, FolderOpen,
  Database, CheckSquare, Truck, DollarSign, Zap, Map, Archive, Mail,
  ChevronRight, Check, ArrowRight, Briefcase, UserCheck, Target, Droplets,
  Globe, Cpu, LineChart, Layers, Clock, Star, Play, ChevronDown,
  Workflow, Gauge, PieChart, BarChart, Ruler
} from "lucide-react";
import { ContactDialog } from "@/components/ContactDialog";
import { FAQ } from "@/components/FAQ";
import { Logo } from "@/components/shared/Logo";
import heroBg from "@/assets/landing/hero-bg.jpg";

const Hero = () => {
  const navigate = useNavigate();
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [dialogDismissed, setDialogDismissed] = useState(false);
  const [activeEcosystem, setActiveEcosystem] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setShowContactDialog(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveEcosystem((prev) => (prev + 1) % 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDialogClose = (open: boolean) => {
    setShowContactDialog(open);
    if (!open) setDialogDismissed(true);
  };

  const ecosystemPillars = [
    { icon: Building2, label: "Gestão ERP", color: "from-blue-500 to-blue-700" },
    { icon: Wrench, label: "Gestão de Obras", color: "from-orange-500 to-orange-700" },
    { icon: Globe, label: "Inteligência GIS", color: "from-green-500 to-green-700" },
    { icon: Droplets, label: "Hidráulica", color: "from-cyan-500 to-cyan-700" },
    { icon: LineChart, label: "Análise de Dados", color: "from-purple-500 to-purple-700" },
  ];

  const construDataModules = [
    { icon: FolderOpen, title: "Gestão de Projetos", desc: "Múltiplos projetos com cronogramas" },
    { icon: FileText, title: "RDO Digital", desc: "Fotos, GPS e clima integrados" },
    { icon: TrendingUp, title: "Controle de Produção", desc: "Metas e comparativos em tempo real" },
    { icon: Users, title: "Gestão de Equipes", desc: "Funcionários e alocação" },
    { icon: Package, title: "Materiais & Estoque", desc: "Entrada, saída e saldo por obra" },
    { icon: ClipboardList, title: "Pedidos de Material", desc: "Solicitações e aprovações" },
    { icon: DollarSign, title: "Orçamentos", desc: "BDI, mão de obra e materiais" },
    { icon: BarChart3, title: "Dashboard 360°", desc: "Visão completa das operações" },
    { icon: Bell, title: "Alertas Inteligentes", desc: "Notificações automáticas" },
    { icon: QrCode, title: "QR Codes", desc: "Rastreie ativos e locais" },
    { icon: Wrench, title: "Manutenção Predial", desc: "Solicitações e histórico" },
    { icon: Camera, title: "Registro Multimídia", desc: "Fotos e vídeos organizados" },
    { icon: Briefcase, title: "CRM Completo", desc: "Clientes e pipeline de vendas" },
    { icon: UserCheck, title: "RH & Escalas CLT", desc: "Prime Cost automatizado" },
    { icon: MapPin, title: "Ocorrências", desc: "Registro e acompanhamento" },
    { icon: CheckSquare, title: "Checklists", desc: "Verificação e conformidade" },
  ];

  const hydroModules = [
    { icon: Map, title: "Topografia Inteligente", desc: "Processamento automático de dados" },
    { icon: Ruler, title: "Pré-Dimensionamento", desc: "Cálculo de redes de saneamento" },
    { icon: Cpu, title: "Motores de Cálculo", desc: "EPANET e SWMM integrados" },
    { icon: Globe, title: "Ecossistema GIS", desc: "QGIS e mapas georreferenciados" },
    { icon: Workflow, title: "Peer Review", desc: "Revisão técnica automatizada" },
    { icon: Database, title: "Exportação DXF", desc: "Compatível com AutoCAD" },
  ];

  const comparativeTable = [
    { feature: "Gestão 360° de Obras", planilhas: false, outros: "partial", hydro: true },
    { feature: "RDO Digital com GPS e Fotos", planilhas: false, outros: true, hydro: true },
    { feature: "CRM e Pipeline de Vendas", planilhas: false, outros: false, hydro: true },
    { feature: "RH com Escalas CLT", planilhas: false, outros: false, hydro: true },
    { feature: "Motor Hidráulico (EPANET)", planilhas: false, outros: false, hydro: true },
    { feature: "Inteligência GIS Integrada", planilhas: false, outros: false, hydro: true },
    { feature: "Orçamento Automatizado", planilhas: false, outros: "partial", hydro: true },
    { feature: "Usuários Ilimitados", planilhas: true, outros: false, hydro: true },
  ];

  const savingsData = [
    { porte: "Obra Pequena", investimento: "R$ 500k - 2M", economia: "R$ 15k - 50k", percent: "3-5%" },
    { porte: "Obra Média", investimento: "R$ 2M - 10M", economia: "R$ 50k - 200k", percent: "5-8%" },
    { porte: "Obra Grande", investimento: "R$ 10M+", economia: "R$ 200k+", percent: "8-12%" },
  ];

  const costReductions = [
    { category: "Custos Diretos", items: ["Elimina retrabalho", "Elimina desperdício de materiais", "Elimina horas extras desnecessárias", "Elimina multas por atraso"] },
    { category: "Custos Indiretos", items: ["Menos tempo total de obra", "Gestão administrativa otimizada", "Segurança jurídica com documentação", "Aprovação GIS acelerada"] },
  ];

  const flowSteps = [
    { num: "01", title: "Topografia", desc: "Upload e processamento automático de dados topográficos", icon: Map },
    { num: "02", title: "Orçamento", desc: "Cálculo automatizado de custos por trecho", icon: DollarSign },
    { num: "03", title: "Planejamento", desc: "Cronograma executivo com Gantt interativo", icon: Gauge },
    { num: "04", title: "Simulação", desc: "Motores EPANET e SWMM integrados", icon: Cpu },
    { num: "05", title: "Peer Review", desc: "Verificação técnica automatizada", icon: CheckSquare },
    { num: "06", title: "RDO Digital", desc: "Execução registrada em campo com evidências", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Logo size="md" />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/hydronetwork')} className="hidden sm:flex text-blue-500 hover:text-blue-600 hover:bg-blue-500/10">
              <Droplets className="w-4 h-4 mr-1.5" /> HydroNetwork
            </Button>
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
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
        </div>

        <div className="container mx-auto px-4 z-10 py-12 md:py-0">
          <div className="max-w-3xl space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 border border-primary/25 text-sm font-medium text-primary">
              <Zap className="w-4 h-4" />
              Ecossistema Unificado da Engenharia
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]">
              Integramos{" "}
              <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Obras e Engenharia
              </span>{" "}
              em uma única plataforma.
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              O melhor de <strong className="text-foreground">Sienge, Procore, QGIS e EPANET</strong> em um só lugar. 
              Gestão completa do ciclo de vida do seu projeto — do pré-dimensionamento à entrega.
            </p>

            {/* Ecosystem Pills */}
            <div className="flex flex-wrap gap-2">
              {ecosystemPillars.map((p, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-500 ${
                    activeEcosystem === i
                      ? `bg-gradient-to-r ${p.color} text-white shadow-lg scale-105`
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <p.icon className="w-4 h-4" />
                  {p.label}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                size="lg"
                className="text-lg px-8 py-6 rounded-xl shadow-lg shadow-primary/30 bg-primary hover:bg-primary/90"
                onClick={() => navigate('/auth?tab=signup')}
              >
                Teste Grátis — 30 Dias
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6 rounded-xl backdrop-blur-sm"
                onClick={() => navigate('/auth')}
              >
                <Play className="w-5 h-5 mr-2" />
                Ver Demonstração
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Sem cartão de crédito • Usuários ilimitados • Suporte incluso
            </p>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden md:block">
          <ChevronDown className="w-6 h-6 text-muted-foreground" />
        </div>
      </section>

      {/* ═══════════════ STATS ═══════════════ */}
      <section className="py-16 border-y border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "26+", label: "Módulos Integrados" },
              { value: "2em1", label: "Obras + Hidráulica" },
              { value: "∞", label: "Usuários Ilimitados" },
              { value: "100%", label: "Online e Seguro" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-black text-primary">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CONTROLE EM TEMPO REAL ═══════════════ */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black mb-4">
                Controle Total em <span className="text-primary">Tempo Real</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Visibilidade de custos, prazos e conformidade normativa
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {[
                { icon: DollarSign, q: "Onde está cada centavo?", color: "text-emerald-500 bg-emerald-500/10" },
                { icon: Users, q: "Quem fez o quê e quando?", color: "text-blue-500 bg-blue-500/10" },
                { icon: Clock, q: "Estamos no prazo?", color: "text-orange-500 bg-orange-500/10" },
                { icon: Shield, q: "Atende às normas?", color: "text-purple-500 bg-purple-500/10" },
                { icon: Bell, q: "Vai estourar o orçamento?", color: "text-red-500 bg-red-500/10" },
                { icon: FileText, q: "Tudo documentado?", color: "text-cyan-500 bg-cyan-500/10" },
              ].map((item, i) => (
                <div key={i} className="p-5 rounded-xl border border-border bg-card hover:shadow-lg transition-all hover:-translate-y-1">
                  <div className={`w-12 h-12 rounded-lg ${item.color} flex items-center justify-center mb-4`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-sm md:text-base">{item.q}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ CONSTRUDATA OBRAS ═══════════════ */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 text-sm font-bold mb-4">
              <Building2 className="w-4 h-4" /> ConstruData Obras
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              Operação e Equipes — <span className="text-primary">Gestão 360°</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Projetos, RDO, produção, materiais, CRM, RH e mais — tudo centralizado
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {construDataModules.map((m, i) => (
              <div key={i} className="p-4 rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/30 transition-all group cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <m.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-sm mb-1">{m.title}</h3>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ HYDRONETWORK ═══════════════ */}
      <section className="py-20 bg-gradient-to-br from-blue-950 via-blue-900 to-cyan-900 text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-400/15 text-cyan-300 border border-cyan-400/25 text-sm font-bold mb-4">
              <Droplets className="w-4 h-4" /> HydroNetwork
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              Engenharia Avançada — Precisão Técnica
            </h2>
            <p className="text-blue-200/80 max-w-2xl mx-auto">
              Pré-dimensionamento de redes, simulação hidráulica e inteligência geoespacial
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {hydroModules.map((m, i) => (
              <div key={i} className="p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all">
                <m.icon className="w-8 h-8 text-cyan-400 mb-3" />
                <h3 className="font-bold text-sm mb-1">{m.title}</h3>
                <p className="text-xs text-blue-200/70">{m.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Button
              size="lg"
              onClick={() => navigate('/hydronetwork')}
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-6 rounded-xl text-lg"
            >
              Explorar HydroNetwork <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════ FLUXO INTEGRADO ═══════════════ */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              Fluxo Integrado — <span className="text-primary">Do Projeto à Execução</span>
            </h2>
            <p className="text-muted-foreground">Todo o ciclo conectado em uma única plataforma</p>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-4">
            {flowSteps.map((step, i) => (
              <div key={i} className="relative p-5 rounded-xl border border-border bg-card hover:shadow-lg transition-all group">
                <div className="text-3xl font-black text-primary/20 absolute top-3 right-4">{step.num}</div>
                <step.icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-bold mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
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
            <p className="text-muted-foreground">Por que empresas migram para o ConstruData & HydroNetwork</p>
          </div>

          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-3 font-bold">Característica</th>
                  <th className="text-center py-4 px-3 font-bold text-muted-foreground">Planilhas</th>
                  <th className="text-center py-4 px-3 font-bold text-muted-foreground">Outros Softwares</th>
                  <th className="text-center py-4 px-3 font-bold text-primary">ConstruData</th>
                </tr>
              </thead>
              <tbody>
                {comparativeTable.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-3 px-3 font-medium">{row.feature}</td>
                    <td className="text-center py-3 px-3">
                      {row.planilhas ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <span className="text-red-400">✕</span>}
                    </td>
                    <td className="text-center py-3 px-3">
                      {row.outros === true ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : 
                       row.outros === "partial" ? <span className="text-yellow-500">◐</span> : 
                       <span className="text-red-400">✕</span>}
                    </td>
                    <td className="text-center py-3 px-3">
                      <Check className="w-5 h-5 text-green-500 mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══════════════ REDUÇÃO DE CUSTOS ═══════════════ */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              Redução Estratégica de <span className="text-emerald-500">Custos</span>
            </h2>
          </div>

          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6 mb-12">
            {costReductions.map((cat, i) => (
              <div key={i} className="p-6 rounded-xl border border-border bg-card">
                <h3 className="text-lg font-black mb-4 text-primary">{cat.category}</h3>
                <ul className="space-y-3">
                  {cat.items.map((item, j) => (
                    <li key={j} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Savings Table */}
          <div className="max-w-3xl mx-auto">
            <h3 className="text-xl font-black text-center mb-6">Economia Estimada por Porte de Obra</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-primary/30">
                    <th className="text-left py-3 px-4 font-bold">Porte</th>
                    <th className="text-center py-3 px-4 font-bold">Investimento Típico</th>
                    <th className="text-center py-3 px-4 font-bold text-emerald-600">Economia Estimada</th>
                    <th className="text-center py-3 px-4 font-bold text-emerald-600">% Ganho</th>
                  </tr>
                </thead>
                <tbody>
                  {savingsData.map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-3 px-4 font-medium">{row.porte}</td>
                      <td className="text-center py-3 px-4 text-muted-foreground">{row.investimento}</td>
                      <td className="text-center py-3 px-4 font-bold text-emerald-600">{row.economia}</td>
                      <td className="text-center py-3 px-4 font-bold text-emerald-600">{row.percent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-4">
              Em média, a plataforma paga a si mesma já na primeira obra.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════ O PODER DA UNIFICAÇÃO ═══════════════ */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              O Poder da <span className="text-primary">Unificação</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-12">
              Substituímos a fragmentação de ferramentas por um ecossistema único que integra as melhores funcionalidades do mercado.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {ecosystemPillars.map((p, i) => (
                <div key={i} className={`p-5 rounded-xl bg-gradient-to-br ${p.color} text-white`}>
                  <p.icon className="w-8 h-8 mx-auto mb-2" />
                  <p className="font-bold text-sm">{p.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 p-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5">
              <h3 className="font-black text-lg mb-2">🎯 Personalização Sob Demanda</h3>
              <p className="text-sm text-muted-foreground">
                Cada módulo pode ser adaptado à sua realidade. Nosso time configura dashboards, alertas e fluxos 
                de acordo com o seu processo operacional.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ SEGURANÇA ═══════════════ */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 mb-4">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-bold">Segurança de Dados</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black">Seus Dados Protegidos</h2>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: "🔐", title: "Criptografia", desc: "Proteção de ponta a ponta" },
                { icon: "🛡️", title: "LGPD", desc: "Conformidade total" },
                { icon: "☁️", title: "Backup 24/7", desc: "Dados sempre salvos" },
                { icon: "🔒", title: "Permissões", desc: "Controle por função" },
              ].map((item, i) => (
                <div key={i} className="p-5 rounded-xl border border-border bg-card text-center hover:shadow-md transition-shadow">
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h3 className="font-bold text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ JORNADA ═══════════════ */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-12">
              Jornada de <span className="text-primary">Sucesso</span>
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { num: "1", title: "Demonstração Gratuita", desc: "Apresentação personalizada das funcionalidades para sua realidade", color: "from-blue-500 to-blue-600" },
                { num: "2", title: "Projeto Piloto", desc: "Uso em uma obra real acompanhado por nossos especialistas", color: "from-primary to-primary/80" },
                { num: "3", title: "Implantação Total", desc: "Rollout completo com treinamento da equipe e suporte contínuo", color: "from-emerald-500 to-emerald-600" },
              ].map((step, i) => (
                <div key={i} className="relative p-6 rounded-xl border border-border bg-card hover:shadow-lg transition-all">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} text-white flex items-center justify-center text-xl font-black mb-4`}>
                    {step.num}
                  </div>
                  <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
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
              Dúvidas Frequentes — <span className="text-primary">Resolvidas</span>
            </h2>
            <div className="space-y-4">
              {[
                { q: '"Minha equipe não vai usar."', a: "Interface simples e direta. Registro por foto e QR Code. Treinamento incluso para toda equipe." },
                { q: '"Já tentei outros softwares."', a: "Onboarding guiado e suporte dedicado. Em 7 dias você vê resultado real — ou cancelamos sem custo." },
                { q: '"É muito caro para minha empresa."', a: "Usuários ilimitados. O custo do desperdício que você evita paga o sistema na primeira obra." },
                { q: '"Funciona para saneamento?"', a: "Sim! O HydroNetwork é o único módulo integrado com motores EPANET e SWMM para redes hidráulicas." },
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

      {/* ═══════════════ FINAL CTA ═══════════════ */}
      <section className="py-24 bg-gradient-to-br from-blue-950 via-primary to-blue-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.05)_0%,transparent_60%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-5xl font-black">
              Chega de operar no escuro.
            </h2>
            <p className="text-xl text-white/80">
              ConstruData & HydroNetwork — obras, equipes, materiais, CRM, RH e engenharia hidráulica em um só lugar.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="text-lg px-8 py-6 rounded-xl bg-white text-primary hover:bg-white/90 shadow-lg"
                onClick={() => navigate('/auth?tab=signup')}
              >
                Começar Teste Grátis <ArrowRight className="ml-2 w-5 h-5" />
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
              Demonstração gratuita • Implantação em 7 dias • Sem compromisso
            </p>
          </div>
        </div>
      </section>

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
