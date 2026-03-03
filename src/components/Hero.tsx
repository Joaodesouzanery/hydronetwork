"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowRight, Menu, Zap, BarChart3,
  Upload, GitBranch, Droplets, CloudRain, Calculator,
  Calendar, Beaker, Waves, Layers, FileText, Map, Shield,
  ClipboardList, Activity, Globe, DollarSign, Eye,
  Settings2, Users, FileSpreadsheet, Ruler, Package,
  Monitor, ChevronDown, Newspaper, Check, X as XIcon
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { motion, useAnimation, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FAQ } from "@/components/FAQ";

/* ═══════════════════════════════════════════════════
   ConstruData Landing Page — Myna Hero Design System
   Accent: #FF6B2C  |  Font: mono  |  Style: minimal
   ═══════════════════════════════════════════════════ */

const navigationItems = [
  { title: "MÓDULOS", href: "#modulos" },
  { title: "COMO FUNCIONA", href: "#fluxo" },
  { title: "DIFERENCIAIS", href: "#diferenciais" },
  { title: "FAQ", href: "#faq" },
];

const labels = [
  { icon: Monitor, label: "Sem Instalação" },
  { icon: Layers, label: "30+ Módulos Integrados" },
  { icon: Globe, label: "100% Online" },
];

const features = [
  {
    icon: Ruler,
    label: "Dimensionamento Automático",
    description:
      "Redes de esgoto, água e drenagem conforme NBR 9649, NBR 12218 e NBR 10844. Sem planilhas, sem retrabalho.",
  },
  {
    icon: DollarSign,
    label: "Orçamento Inteligente",
    description:
      "Quantitativos automáticos com composições SINAPI/SICRO vinculadas por trecho. BDI conforme Acórdão TCU 2622/2013.",
  },
  {
    icon: Calendar,
    label: "Planejamento Integrado",
    description:
      "Gantt com caminho crítico, Curva S automática e EVM — tudo conectado ao RDO digital e ao mapa da obra.",
  },
];

const modules = [
  { icon: Upload, title: "Topografia", desc: "CSV, DXF, SHP, GeoJSON, LandXML" },
  { icon: GitBranch, title: "Rede de Esgoto", desc: "Gravidade e elevatória — NBR 9649" },
  { icon: Droplets, title: "Rede de Água", desc: "Pressão e distribuição — NBR 12218" },
  { icon: CloudRain, title: "Drenagem Pluvial", desc: "Galerias e estruturas — NBR 10844" },
  { icon: FileSpreadsheet, title: "Quantitativos", desc: "Escavação, tubulação, PVs" },
  { icon: Calculator, title: "Orçamento SINAPI", desc: "Composições automáticas por trecho" },
  { icon: DollarSign, title: "BDI (TCU)", desc: "Acórdão 2622/2013" },
  { icon: Calendar, title: "Planejamento", desc: "Gantt, Curva S, EVM" },
  { icon: Beaker, title: "EPANET", desc: "Simulação hidráulica .INP" },
  { icon: Zap, title: "EPANET PRO", desc: "WebAssembly (epanet-js)" },
  { icon: Waves, title: "SWMM", desc: "Drenagem urbana", badge: "Em breve" },
  { icon: Layers, title: "OpenProject", desc: "Gestão ágil de obras" },
  { icon: FileText, title: "ProjectLibre", desc: "Gantt avançado" },
  { icon: Map, title: "QGIS", desc: "Exportação GIS completa" },
  { icon: Shield, title: "Revisão por Pares", desc: "Checklist normativo ABNT" },
  { icon: ClipboardList, title: "RDO Digital", desc: "Fotos, GPS, clima" },
  { icon: Activity, title: "Perfil Longitudinal", desc: "Corte vertical SVG" },
  { icon: Eye, title: "Mapa Interativo", desc: "Leaflet georreferenciado" },
  { icon: Globe, title: "Exportação GIS", desc: "SHP, GeoJSON, KML, DXF" },
  { icon: Settings2, title: "Elevatória", desc: "Orçamento de recalque" },
  { icon: BarChart3, title: "Dashboard 360°", desc: "KPIs consolidados" },
  { icon: Package, title: "Materiais", desc: "Almoxarifado inteligente" },
  { icon: Users, title: "Gestão de Equipes", desc: "Alocação e produtividade" },
  { icon: Newspaper, title: "Hub de Notícias", desc: "Licitações e normas" },
];

const flowSteps = [
  { num: "01", title: "Importe Topografia", desc: "CSV, DXF, SHP" },
  { num: "02", title: "Dimensione a Rede", desc: "Esgoto, Água, Drenagem" },
  { num: "03", title: "Gere Orçamento", desc: "SINAPI/SICRO automático" },
  { num: "04", title: "Simule", desc: "EPANET (pressão)" },
  { num: "05", title: "Planeje", desc: "Gantt + Curva S" },
  { num: "06", title: "Revise", desc: "Peer Review ABNT" },
  { num: "07", title: "Acompanhe", desc: "RDO Digital no campo" },
  { num: "08", title: "Exporte", desc: "GIS, PDF, DXF" },
];

const differentials = [
  { title: "Sem Fragmentação", desc: "Substitui 5-8 ferramentas que engenheiros usam hoje: AutoCAD, EPANET, Excel, ERPs isolados." },
  { title: "Normas Brasileiras", desc: "Cálculos validados conforme NBR 9649, NBR 12218, NBR 10844, SINAPI e SICRO." },
  { title: "100% no Navegador", desc: "Sem instalação, sem licenças caras, sem configuração. Acesse de qualquer dispositivo." },
  { title: "Dados Integrados", desc: "Importe uma vez, use em todos os módulos. Zero redigitação entre etapas." },
];

const comparativeRows = [
  { feature: "Dimensionamento automático de redes", planilhas: false, outros: false, hydro: true },
  { feature: "Simulação EPANET integrada", planilhas: false, outros: "partial" as const, hydro: true },
  { feature: "Orçamento SINAPI/SICRO por trecho", planilhas: false, outros: false, hydro: true },
  { feature: "Mapa interativo com custos", planilhas: false, outros: false, hydro: true },
  { feature: "Gantt + Curva S + EVM", planilhas: false, outros: "partial" as const, hydro: true },
  { feature: "Exportação QGIS / Shapefile / DXF", planilhas: false, outros: "partial" as const, hydro: true },
  { feature: "RDO Digital por trecho", planilhas: false, outros: false, hydro: true },
  { feature: "100% Online — sem instalação", planilhas: true, outros: "partial" as const, hydro: true },
];

function CellIcon({ val }: { val: boolean | string }) {
  if (val === true) return <Check className="h-4 w-4 text-green-500 mx-auto" />;
  if (val === "partial") return <span className="text-xs font-mono text-yellow-500 mx-auto">~</span>;
  return <XIcon className="h-4 w-4 text-red-400 mx-auto" />;
}

const Hero = () => {
  const navigate = useNavigate();
  const controls = useAnimation();
  const featuresRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(featuresRef, { once: true, amount: 0.1 });

  useEffect(() => {
    if (isInView) controls.start("visible");
  }, [controls, isInView]);

  const titleWords = ["PARE", "DE", "REFAZER", "DADOS", "ENTRE", "SOFTWARES."];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ═══════════ HEADER ═══════════ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <a href="#" className="flex items-center gap-2">
              <img src="/favicon.svg" alt="ConstruData" className="h-8 w-8" />
              <span className="font-mono text-xl font-bold text-foreground">ConstruData</span>
            </a>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center space-x-8">
              {navigationItems.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  className="text-sm font-mono text-foreground hover:text-[#FF6B2C] transition-colors"
                >
                  {item.title}
                </a>
              ))}
            </nav>

            {/* CTA Buttons */}
            <div className="flex items-center space-x-3">
              <Button
                variant="default"
                className="rounded-none hidden md:inline-flex bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 font-mono text-white"
                asChild
              >
                <a
                  href="https://calendly.com/joaodsouzanery/apresentacao-personalrh"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  AGENDAR DEMO
                </a>
              </Button>
              <Button
                variant="outline"
                className="rounded-none hidden md:inline-flex font-mono border-foreground/20"
                onClick={() => navigate("/hydronetwork")}
              >
                ACESSAR PLATAFORMA
                <ArrowRight className="ml-1 w-4 h-4" />
              </Button>

              {/* Mobile menu */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <nav className="flex flex-col gap-6 mt-6">
                    {navigationItems.map((item) => (
                      <a
                        key={item.title}
                        href={item.href}
                        className="text-sm font-mono text-foreground hover:text-[#FF6B2C] transition-colors"
                      >
                        {item.title}
                      </a>
                    ))}
                    <Button
                      className="cursor-pointer rounded-none bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 font-mono text-white"
                      asChild
                    >
                      <a
                        href="https://calendly.com/joaodsouzanery/apresentacao-personalrh"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        AGENDAR DEMO
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      className="cursor-pointer rounded-none font-mono"
                      onClick={() => navigate("/hydronetwork")}
                    >
                      ACESSAR PLATAFORMA <ArrowRight className="ml-1 w-4 h-4" />
                    </Button>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* ═══════════ HERO ═══════════ */}
        <section className="container mx-auto px-4 py-24 pt-32">
          <div className="flex flex-col items-center text-center">
            {/* Animated headline */}
            <motion.h1
              initial={{ filter: "blur(10px)", opacity: 0, y: 50 }}
              animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="relative font-mono text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl mx-auto leading-tight"
            >
              {titleWords.map((text, index) => (
                <motion.span
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.15, duration: 0.6 }}
                  className="inline-block mx-2 md:mx-4"
                >
                  {text}
                </motion.span>
              ))}
            </motion.h1>

            {/* Sub-headline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.6 }}
              className="mx-auto mt-8 max-w-2xl text-lg md:text-xl text-foreground font-mono"
            >
              Do levantamento topográfico ao Relatório Diário de Obra — 30+ módulos
              integrados que substituem as 5-8 ferramentas que você usa hoje.
            </motion.p>

            {/* Labels / badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8, duration: 0.6 }}
              className="mt-12 flex flex-wrap justify-center gap-6"
            >
              {labels.map((feature, index) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 1.8 + index * 0.15,
                    duration: 0.6,
                    type: "spring",
                    stiffness: 100,
                    damping: 10,
                  }}
                  className="flex items-center gap-2 px-6"
                >
                  <feature.icon className="h-5 w-5 text-[#FF6B2C]" />
                  <span className="text-sm font-mono">{feature.label}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 2.4,
                duration: 0.6,
                type: "spring",
                stiffness: 100,
                damping: 10,
              }}
              className="flex flex-wrap gap-4 mt-12 justify-center"
            >
              <Button
                size="lg"
                className="cursor-pointer rounded-none bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 font-mono text-white"
                asChild
              >
                <a
                  href="https://calendly.com/joaodsouzanery/apresentacao-personalrh"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  AGENDAR DEMO
                  <ArrowRight className="ml-1 w-4 h-4" />
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="cursor-pointer rounded-none font-mono border-foreground/20"
                onClick={() => navigate("/hydronetwork")}
              >
                ACESSAR PLATAFORMA
                <ArrowRight className="ml-1 w-4 h-4" />
              </Button>
            </motion.div>

            {/* Scroll indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3.0, duration: 0.6 }}
              className="mt-16"
            >
              <button onClick={() => scrollTo("features")} className="animate-bounce">
                <ChevronDown className="h-6 w-6 text-muted-foreground" />
              </button>
            </motion.div>
          </div>
        </section>

        {/* ═══════════ FEATURES ═══════════ */}
        <section id="features" ref={featuresRef}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, type: "spring", stiffness: 100, damping: 10 }}
            className="text-center text-3xl md:text-4xl font-mono font-bold mb-6 px-4"
          >
            Por que engenheiros migram para o HydroNetwork?
          </motion.h2>

          <div className="grid md:grid-cols-3 max-w-6xl mx-auto px-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  delay: index * 0.2,
                  duration: 0.6,
                  type: "spring",
                  stiffness: 100,
                  damping: 10,
                }}
                className="flex flex-col items-center text-center p-8 bg-background border"
              >
                <div className="mb-6 bg-[#FF6B2C]/10 p-4">
                  <feature.icon className="h-8 w-8 text-[#FF6B2C]" />
                </div>
                <h3 className="mb-4 text-xl font-mono font-bold">{feature.label}</h3>
                <p className="text-muted-foreground font-mono text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══════════ COMO FUNCIONA ═══════════ */}
        <section id="fluxo" className="container mx-auto px-4 py-24">
          <h2 className="text-center text-3xl md:text-4xl font-mono font-bold mb-4">
            Fluxo Completo em 8 Etapas
          </h2>
          <p className="text-center text-muted-foreground font-mono mb-12">
            Do projeto à entrega, tudo integrado
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px max-w-5xl mx-auto bg-border">
            {flowSteps.map((step) => (
              <div
                key={step.num}
                className="bg-background p-6 text-center space-y-2 hover:bg-[#FF6B2C]/5 transition-colors"
              >
                <div className="text-2xl font-bold font-mono text-[#FF6B2C]">{step.num}</div>
                <h3 className="text-sm font-bold font-mono">{step.title}</h3>
                <p className="text-xs text-muted-foreground font-mono">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ MÓDULOS ═══════════ */}
        <section id="modulos" className="py-24 border-t border-border">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-3xl md:text-4xl font-mono font-bold mb-4">
              30+ Módulos Integrados
            </h2>
            <p className="text-center text-muted-foreground font-mono mb-12">
              Tudo que você precisa em uma única plataforma
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px max-w-6xl mx-auto bg-border">
              {modules.map((m) => (
                <div
                  key={m.title}
                  className="bg-background p-5 text-center space-y-2 hover:bg-[#FF6B2C]/5 transition-colors relative"
                >
                  {m.badge && (
                    <span className="absolute top-2 right-2 text-[10px] font-mono font-bold text-yellow-600 bg-yellow-100 px-1.5 py-0.5">
                      {m.badge}
                    </span>
                  )}
                  <m.icon className="h-6 w-6 mx-auto text-[#FF6B2C]" />
                  <h3 className="text-xs font-bold font-mono">{m.title}</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ DIFERENCIAIS ═══════════ */}
        <section id="diferenciais" className="py-24 border-t border-border">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-3xl md:text-4xl font-mono font-bold mb-12">
              Diferenciais
            </h2>
            <div className="grid md:grid-cols-2 gap-px max-w-4xl mx-auto bg-border">
              {differentials.map((d) => (
                <div key={d.title} className="bg-background p-8 space-y-3">
                  <h3 className="text-lg font-bold font-mono">{d.title}</h3>
                  <p className="text-sm text-muted-foreground font-mono leading-relaxed">{d.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ COMPARATIVO ═══════════ */}
        <section className="py-24 border-t border-border">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-3xl md:text-4xl font-mono font-bold mb-4">
              HydroNetwork vs. Alternativas
            </h2>
            <p className="text-center text-muted-foreground font-mono mb-12">
              Comparação objetiva de funcionalidades
            </p>
            <div className="max-w-4xl mx-auto overflow-x-auto">
              <table className="w-full font-mono text-sm border border-border">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 font-bold">Funcionalidade</th>
                    <th className="text-center p-3 font-bold w-24">Planilhas</th>
                    <th className="text-center p-3 font-bold w-24">Outros</th>
                    <th className="text-center p-3 font-bold w-24 text-[#FF6B2C]">Hydro</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativeRows.map((row, i) => (
                    <tr key={i} className="border-b border-border hover:bg-[#FF6B2C]/5 transition-colors">
                      <td className="p-3 text-xs">{row.feature}</td>
                      <td className="p-3 text-center"><CellIcon val={row.planilhas} /></td>
                      <td className="p-3 text-center"><CellIcon val={row.outros} /></td>
                      <td className="p-3 text-center"><CellIcon val={row.hydro} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ═══════════ FAQ ═══════════ */}
        <section id="faq" className="py-24 border-t border-border">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-center text-3xl md:text-4xl font-mono font-bold mb-12">
              Perguntas Frequentes
            </h2>
            <FAQ />
          </div>
        </section>

        {/* ═══════════ CTA FINAL ═══════════ */}
        <section className="py-24 border-t border-border">
          <div className="container mx-auto px-4 text-center space-y-8 max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-mono font-bold">
              Pronto para simplificar seus projetos?
            </h2>
            <p className="text-muted-foreground font-mono">
              Importe seus dados e veja resultados em segundos. Sem cadastro obrigatório, sem cartão de crédito.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                size="lg"
                className="cursor-pointer rounded-none bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 font-mono text-white"
                asChild
              >
                <a
                  href="https://calendly.com/joaodsouzanery/apresentacao-personalrh"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  AGENDAR DEMO
                  <ArrowRight className="ml-1 w-4 h-4" />
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="cursor-pointer rounded-none font-mono border-foreground/20"
                onClick={() => navigate("/hydronetwork")}
              >
                ACESSAR PLATAFORMA
                <ArrowRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 text-sm font-mono">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/favicon.svg" alt="ConstruData" className="h-6 w-6" />
                <span className="font-bold text-sm">CONSTRUDATA</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Plataforma completa de engenharia de saneamento e gestão de obras.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-3">Redes</h4>
              {["Topografia", "Esgoto", "Água", "Drenagem"].map((m) => (
                <p key={m} className="text-xs text-muted-foreground mb-1">{m}</p>
              ))}
            </div>
            <div>
              <h4 className="font-bold mb-3">Ferramentas</h4>
              {["EPANET PRO", "QGIS", "Gantt / Curva S", "RDO Digital"].map((m) => (
                <p key={m} className="text-xs text-muted-foreground mb-1">{m}</p>
              ))}
            </div>
            <div>
              <h4 className="font-bold mb-3">Formatos</h4>
              {["CSV / Excel", "DXF / SHP", "GeoJSON / KML", "PDF"].map((m) => (
                <p key={m} className="text-xs text-muted-foreground mb-1">{m}</p>
              ))}
            </div>
            <div>
              <h4 className="font-bold mb-3">Normas</h4>
              {["NBR 9649", "NBR 12218", "SINAPI", "SICRO"].map((m) => (
                <p key={m} className="text-xs text-muted-foreground mb-1">{m}</p>
              ))}
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center">
            <p className="text-xs text-muted-foreground font-mono">
              © 2025 ConstruData. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Hero;
