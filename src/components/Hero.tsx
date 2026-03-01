import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Shield, FileText, BarChart3, Users, Package, ClipboardList, QrCode,
  Camera, TrendingUp, MapPin, Wrench, Building2, Bell, FolderOpen,
  Database, CheckSquare, Truck, DollarSign, Zap, Map, Archive, Mail,
  ChevronRight, Check, ArrowRight, Briefcase, UserCheck, Target, Droplets,
  Globe, Cpu, LineChart, Layers, Clock, Star, Play, ChevronDown,
  Workflow, Gauge, Ruler, Upload, Settings2, GitBranch, CloudRain,
  Beaker, Waves, FileSpreadsheet, Activity, Eye, Calculator, Calendar,
  Lock, Smartphone, Monitor, Server, ExternalLink, AlertTriangle, Lightbulb,
  Linkedin, MessageSquare, Send, ChevronLeft, Newspaper, Search, X, Sparkles
} from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ContactDialog } from "@/components/ContactDialog";
import { FAQ } from "@/components/FAQ";
import { Logo } from "@/components/shared/Logo";
import heroSaneamento from "@/assets/landing/hero-saneamento.jpg";

// Landing showcase images
import imgAlmoxarifado from "@/assets/landing/almoxarifado.png";
import imgGestaoPredial from "@/assets/landing/gestao-predial.png";
import imgManutencao from "@/assets/landing/manutencao.png";
import imgObraOrganizada from "@/assets/landing/obra-organizada.png";
import imgProgressoDados from "@/assets/landing/progresso-dados.png";
import imgProjetosMapa from "@/assets/landing/projetos-mapa.png";
import imgRastreieMaterial from "@/assets/landing/rastreie-material.png";
import imgSistemaUnico from "@/assets/landing/sistema-unico.png";

const showcaseSlides = [
  { src: imgSistemaUnico, alt: "Sistema unificado de gestão", label: "Sistema Unificado" },
  { src: imgProjetosMapa, alt: "Projetos no mapa interativo", label: "Projetos no Mapa" },
  { src: imgProgressoDados, alt: "Progresso baseado em dados", label: "Dados em Tempo Real" },
  { src: imgObraOrganizada, alt: "Obra organizada digitalmente", label: "Obra Organizada" },
  { src: imgAlmoxarifado, alt: "Controle de almoxarifado", label: "Almoxarifado Digital" },
  { src: imgGestaoPredial, alt: "Gestão predial completa", label: "Gestão Predial" },
  { src: imgManutencao, alt: "Manutenção inteligente", label: "Manutenção" },
  { src: imgRastreieMaterial, alt: "Rastreamento de materiais", label: "Rastreamento" },
];

const ShowcaseCarousel = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", slidesToScroll: 1 },
    [Autoplay({ delay: 3500, stopOnInteraction: false, stopOnMouseEnter: true })]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  return (
    <section className="py-16 bg-muted/30 border-b border-border overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-4xl font-black mb-3">
            Veja a Plataforma em <span className="text-primary">Ação</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Screenshots reais dos módulos em funcionamento. Arraste para o lado ou deixe rolar automaticamente.
          </p>
        </div>

        <div className="relative max-w-6xl mx-auto">
          {/* Carousel */}
          <div ref={emblaRef} className="overflow-hidden rounded-xl">
            <div className="flex">
              {showcaseSlides.map((slide, i) => (
                <div
                  key={i}
                  className="flex-[0_0_100%] min-w-0 sm:flex-[0_0_50%] lg:flex-[0_0_33.333%] px-2"
                >
                  <div className="relative group rounded-xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-xl transition-all duration-300">
                    <img
                      src={slide.src}
                      alt={slide.alt}
                      className="w-full aspect-video object-contain bg-muted group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <span className="text-white text-sm font-bold">{slide.label}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation arrows */}
          <button
            onClick={scrollPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:-translate-x-4 z-10 w-10 h-10 rounded-full bg-card/90 backdrop-blur border border-border shadow-lg flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={scrollNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 sm:translate-x-4 z-10 w-10 h-10 rounded-full bg-card/90 backdrop-blur border border-border shadow-lg flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
            aria-label="Próximo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-6">
          {showcaseSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                selectedIndex === i
                  ? "bg-primary w-8"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

// Animated counter hook
const useAnimatedCounter = (end: number, duration: number = 2000, startOnView: boolean = true) => {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(!startOnView);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [startOnView]);

  useEffect(() => {
    if (!started) return;
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, end, duration]);

  return { count, ref };
};

// Module categories for filter
const moduleCategories = [
  { id: "all", label: "Todos", icon: Layers },
  { id: "redes", label: "Redes", icon: GitBranch },
  { id: "simulacao", label: "Simulação", icon: Beaker },
  { id: "gestao", label: "Gestão", icon: Briefcase },
  { id: "campo", label: "Campo", icon: MapPin },
  { id: "integracao", label: "Integração", icon: Globe },
];

const Hero = () => {
  const navigate = useNavigate();
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [dialogDismissed, setDialogDismissed] = useState(false);
  const [activeModule, setActiveModule] = useState(0);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const [moduleFilter, setModuleFilter] = useState("all");
  const [moduleSearch, setModuleSearch] = useState("");
  const [expandedModule, setExpandedModule] = useState<number | null>(null);
  const [heroTextIndex, setHeroTextIndex] = useState(0);

  const heroTexts = [
    "A Engenharia de Saneamento Reimaginada.",
    "Do Projeto à Execução em uma Plataforma.",
    "30+ Módulos. Zero Fragmentação.",
    "Simulação, Orçamento e Gestão Integrados.",
  ];

  useEffect(() => {
    const timer = setTimeout(() => setShowContactDialog(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setActiveModule((p) => (p + 1) % 8), 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setHeroTextIndex((p) => (p + 1) % heroTexts.length), 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach(entry => { if (entry.isIntersecting) setVisibleSections(prev => new Set([...prev, entry.target.id])); }); },
      { threshold: 0.1 }
    );
    document.querySelectorAll("[data-animate]").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const isVisible = (id: string) => visibleSections.has(id);

  const handleDialogClose = (open: boolean) => {
    setShowContactDialog(open);
    if (!open) setDialogDismissed(true);
  };

  // ═══════════ 30+ MODULES ═══════════
  const allModules = [
    { icon: Upload, title: "Topografia Inteligente", desc: "Processamento automático de dados topográficos. Suporte a CSV, TXT, XLSX, DXF, SHP, GeoJSON e LandXML.", features: ["Importação multi-formato", "Processamento automático X, Y, Z", "Geração de trechos", "Análise de relevo"], benefits: ["Redução de tempo", "Minimização de erros", "Compatibilidade total"], color: "from-blue-500 to-blue-600", category: "redes" },
    { icon: GitBranch, title: "Rede de Esgoto", desc: "Dimensionamento de redes de esgoto por gravidade e elevatória com verificação normativa ABNT.", features: ["Dimensionamento gravidade/elevatória", "Cálculo de declividades/diâmetros", "Verificação ABNT automática", "NBR 9649"], benefits: ["Conformidade normativa", "Otimização de projetos", "Agilidade"], color: "from-purple-500 to-purple-600", category: "redes" },
    { icon: Droplets, title: "Rede de Água", desc: "Projeto de redes de distribuição de água pressurizadas com cálculo de pressão e perdas de carga.", features: ["Cálculo de pressão", "Velocidade por trecho", "Perdas de carga", "NBR 12211/12218"], benefits: ["Projetos eficientes", "Segurança operacional", "Otimização hidráulica"], color: "from-cyan-500 to-cyan-600", category: "redes" },
    { icon: CloudRain, title: "Drenagem Pluvial", desc: "Dimensionamento de galerias e estruturas de drenagem urbana pelo método racional.", features: ["Dimensionamento de galerias", "Método racional", "Tempo de concentração", "NBR 10844"], benefits: ["Prevenção de inundações", "Projetos sustentáveis", "Conformidade normativa"], color: "from-green-500 to-green-600", category: "redes" },
    { icon: FileSpreadsheet, title: "Quantitativos", desc: "Cálculo automático de volumes de escavação, reaterro, tubulação, PVs e serviços complementares.", features: ["Volumes de escavação/reaterro", "Quantificação de tubulação", "PVs e serviços", "Por trecho"], benefits: ["Orçamentos precisos", "Controle de custos", "Otimização de materiais"], color: "from-amber-500 to-amber-600", category: "gestao" },
    { icon: Calculator, title: "Orçamento e Custos", desc: "Orçamentação automatizada com composições SINAPI/SICRO e visualização no mapa interativo.", features: ["Composições SINAPI/SICRO", "Visualização no mapa", "Custo por trecho", "Faixas de cor"], benefits: ["Transparência de custos", "Controle financeiro", "Agilidade na elaboração"], color: "from-emerald-500 to-emerald-600", category: "gestao" },
    { icon: Calendar, title: "Planejamento de Obra", desc: "Cronograma executivo com Gantt interativo, Curva S automática, EVM e caminho crítico.", features: ["Gantt interativo", "Curva S automática", "EVM integrado", "Caminho crítico"], benefits: ["Gestão de prazos", "Controle de progresso", "Otimização de recursos"], color: "from-pink-500 to-pink-600", category: "gestao" },
    { icon: Beaker, title: "Simulação EPANET", desc: "Motor EPANET integrado para simulação hidráulica com exportação de arquivos .INP.", features: ["Motor EPANET nativo", "Simulação hidráulica", "Exportação .INP", "Análise pressão/vazão"], benefits: ["Análise precisa", "Identificação de problemas", "Otimização"], color: "from-sky-500 to-sky-600", category: "simulacao" },
    { icon: Zap, title: "EPANET PRO (WebAssembly)", desc: "Simulação EPANET completa via WebAssembly (epanet-js) com import/export .INP e resultados visuais.", features: ["WebAssembly nativo", "Import/export .INP", "Resultados por pressão", "Resultados por velocidade"], benefits: ["Performance máxima", "Simulação completa no browser", "Sem instalação"], color: "from-blue-600 to-indigo-600", category: "simulacao" },
    { icon: Waves, title: "Simulação SWMM", desc: "Modelagem de drenagem urbana com análise de escoamento, capacidade de galerias e cenários de chuva.", features: ["Modelagem de drenagem", "Análise de escoamento", "Capacidade de galerias", "Cenários de chuva"], benefits: ["Prevenção de inundações", "Projetos resilientes", "Análise ambiental"], color: "from-teal-500 to-teal-600", badge: "Em breve", category: "simulacao" },
    { icon: Layers, title: "OpenProject", desc: "Integração com OpenProject para gestão ágil com criação automática de Work Packages.", features: ["Integração OpenProject", "Gestão ágil", "Work Packages automáticos", "Alocação de equipes"], benefits: ["Colaboração eficiente", "Gestão simplificada", "Acompanhamento de equipe"], color: "from-orange-500 to-orange-600", category: "integracao" },
    { icon: FileText, title: "ProjectLibre", desc: "Exportação de cronograma para ProjectLibre/MS Project para planejamento avançado.", features: ["Exportação ProjectLibre", "Compatibilidade MS Project", "Gantt avançado", "Planejamento detalhado"], benefits: ["Flexibilidade", "Integração com ferramentas existentes", "Gestão robusta"], color: "from-indigo-500 to-indigo-600", category: "integracao" },
    { icon: Map, title: "Integração QGIS", desc: "Exportação para QGIS com camadas vetoriais, Shapefile, GeoJSON e GeoPackage.", features: ["Exportação QGIS", "Camadas vetoriais", "Shapefile/GeoJSON/GeoPackage", "Atributos hidráulicos"], benefits: ["Análise geoespacial", "Interoperabilidade", "Visualização detalhada"], color: "from-green-600 to-green-700", category: "integracao" },
    { icon: Shield, title: "Revisão por Pares", desc: "Workflow automatizado de verificação técnica com checklist normativo ABNT.", features: ["Workflow automatizado", "Checklist ABNT", "Análise velocidade/declividade", "Verificação de profundidade"], benefits: ["Conformidade normativa", "Redução de erros", "Garantia de qualidade"], color: "from-violet-500 to-violet-600", category: "gestao" },
    { icon: ClipboardList, title: "RDO Digital", desc: "Relatório Diário de Obra especializado para saneamento com fotos, GPS e clima.", features: ["RDO especializado", "Avanço por trecho", "Fotos + GPS + clima", "Registro de equipe"], benefits: ["Controle em tempo real", "Transparência total", "Decisão ágil"], color: "from-rose-500 to-rose-600", category: "campo" },
    { icon: Activity, title: "Perfil Longitudinal", desc: "Visualização SVG do corte vertical da rede com escalas configuráveis.", features: ["Corte vertical SVG", "Escalas configuráveis", "Exagero vertical", "Terreno + greide"], benefits: ["Análise técnica aprofundada", "Identificação de conflitos", "Otimização de traçado"], color: "from-slate-500 to-slate-600", category: "redes" },
    { icon: MapPin, title: "Mapa Interativo", desc: "Mapa Leaflet com visualização georreferenciada, codificação por cores e popup técnico.", features: ["Mapa Leaflet", "Codificação por cores", "Status por trecho", "Popup técnico"], benefits: ["Visualização intuitiva", "Análise espacial", "Comunicação eficiente"], color: "from-blue-600 to-blue-700", category: "campo" },
    { icon: Globe, title: "Exportação GIS", desc: "Exportação multi-formato: Shapefile, GeoJSON, GeoPackage, KML/KMZ, DXF e CSV.", features: ["Shapefile", "GeoJSON / GeoPackage", "KML/KMZ", "DXF / CSV"], benefits: ["Interoperabilidade total", "Compatibilidade universal", "Flexibilidade de dados"], color: "from-fuchsia-500 to-fuchsia-600", category: "integracao" },
    { icon: DollarSign, title: "BDI (TCU)", desc: "Cálculo de BDI conforme Acórdão TCU 2622/2013 com composição detalhada e simulação de cenários.", features: ["Fórmula TCU oficial", "Composição detalhada", "Simulação de cenários", "Análise de viabilidade"], benefits: ["Conformidade TCU", "Decisão fundamentada", "Controle de margem"], color: "from-yellow-500 to-yellow-600", category: "gestao" },
    { icon: Eye, title: "Mapa de Progresso RDO", desc: "Visualização georreferenciada do progresso da obra com dados do RDO.", features: ["Progresso por trecho", "Visualização no mapa", "Dados do RDO integrados", "Status em tempo real"], benefits: ["Acompanhamento visual", "Gestão de campo", "Relatórios automáticos"], color: "from-cyan-600 to-cyan-700", category: "campo" },
    { icon: TrendingUp, title: "RDO × Planejamento", desc: "Integração entre RDO e Planejamento com Curva S comparativa e alertas de atraso.", features: ["Curva S comparativa", "Planejado vs. Executado", "Alertas de atraso", "Dashboards integrados"], benefits: ["Controle total de prazo", "Ações corretivas", "Visão unificada"], color: "from-amber-600 to-orange-600", category: "gestao" },
    { icon: BarChart3, title: "Dashboard 360°", desc: "Dashboard consolidado com KPIs de produção, materiais, equipes e indicadores financeiros.", features: ["KPIs em tempo real", "Produção e materiais", "Indicadores financeiros", "Filtros dinâmicos"], benefits: ["Visão executiva", "Decisão baseada em dados", "Monitoramento contínuo"], color: "from-indigo-600 to-violet-600", category: "gestao" },
    { icon: Package, title: "Materiais & Almoxarifado", desc: "Controle completo de materiais com importação de planilhas, histórico de preços e gestão de estoque.", features: ["Importação de planilhas", "Histórico de preços", "Gestão de estoque", "Alertas de falta"], benefits: ["Controle de custos", "Zero desperdício", "Rastreabilidade"], color: "from-stone-500 to-stone-600", category: "gestao" },
    { icon: Users, title: "Gestão de Equipes", desc: "Cadastro de funcionários, alocação por frente de serviço e controle de produtividade.", features: ["Cadastro completo", "Alocação por frente", "Produtividade", "Importação Excel"], benefits: ["Gestão eficiente", "Controle de mão de obra", "Relatórios de equipe"], color: "from-blue-400 to-blue-500", category: "gestao" },
    { icon: Bell, title: "Alertas Inteligentes", desc: "Notificações automáticas por condições configuráveis: produção, materiais, manutenção.", features: ["Configuração por regras", "Notificações automáticas", "Multi-destinatário", "Histórico de alertas"], benefits: ["Ação proativa", "Zero surpresas", "Controle total"], color: "from-red-500 to-red-600", category: "campo" },
    { icon: QrCode, title: "QR Codes de Manutenção", desc: "QR Codes para ativos com formulário de abertura de chamados e rastreamento.", features: ["Geração de QR Codes", "Formulário web", "Rastreamento de chamados", "Sem app necessário"], benefits: ["Manutenção ágil", "Rastreabilidade total", "Facilidade de uso"], color: "from-gray-500 to-gray-600", category: "campo" },
    { icon: Building2, title: "Gestão Predial", desc: "Manutenção de edificações com kanban de tarefas, relatórios de consumo e dashboards.", features: ["Kanban de tarefas", "Relatórios de consumo", "Dashboard de performance", "Catálogo de ativos"], benefits: ["Organização total", "Manutenção preventiva", "Controle de custos"], color: "from-emerald-600 to-emerald-700", category: "gestao" },
    { icon: Briefcase, title: "CRM Completo", desc: "Gestão de clientes, contatos, pipeline de negócios e atividades comerciais.", features: ["Pipeline visual", "Gestão de contatos", "Atividades e calendário", "Relatórios comerciais"], benefits: ["Vendas organizadas", "Follow-up eficiente", "Visão do funil"], color: "from-pink-600 to-rose-600", category: "gestao" },
    { icon: UserCheck, title: "RH & Escalas CLT", desc: "Escalas de trabalho conformes CLT, controle de férias, faltas e custo primo.", features: ["Escalas CLT automáticas", "Controle de férias/faltas", "Custo primo", "Alertas trabalhistas"], benefits: ["Conformidade CLT", "Controle de custos", "Gestão de pessoal"], color: "from-lime-500 to-lime-600", category: "gestao" },
    { icon: Archive, title: "Backup & Exportação", desc: "Exportação completa de dados em múltiplos formatos e backup automático.", features: ["Exportação multi-formato", "Backup automático", "Agendamento", "Multi-tabela"], benefits: ["Segurança de dados", "Portabilidade", "Tranquilidade"], color: "from-gray-600 to-gray-700", category: "integracao" },
  ];

  // Filter modules based on category and search
  const filteredModules = allModules.filter((m) => {
    const matchesCategory = moduleFilter === "all" || m.category === moduleFilter;
    const matchesSearch = moduleSearch === "" ||
      m.title.toLowerCase().includes(moduleSearch.toLowerCase()) ||
      m.desc.toLowerCase().includes(moduleSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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

  const problems = [
    { icon: AlertTriangle, title: "Fragmentação de Ferramentas", desc: "Engenheiros usam 5-10 softwares diferentes (AutoCAD, EPANET, Excel, ERPs) para um único projeto, gerando retrabalho e erros." },
    { icon: Clock, title: "Processos Lentos e Manuais", desc: "Dimensionamento de redes, orçamentos SINAPI e cronogramas feitos manualmente em planilhas, consumindo semanas." },
    { icon: DollarSign, title: "Custos Elevados com Licenças", desc: "Licenças de softwares isolados custam dezenas de milhares de reais por ano, sem integração entre eles." },
    { icon: Lightbulb, title: "Falta de Rastreabilidade", desc: "RDOs em papel, fotos perdidas, histórico inexistente, dificuldade em comprovar serviços executados." },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ═══════════ NAV ═══════════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <span className="text-xs sm:text-sm font-bold text-primary hidden sm:inline">| HydroNetwork</span>
            <div className="flex items-center gap-1 ml-2 border-l border-border/50 pl-2">
              <a href="https://www.linkedin.com/company/construdatasoftware" target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-muted transition-colors" title="LinkedIn">
                <Linkedin className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
              </a>
              <a href="mailto:construdata.contato@gmail.com" className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Email">
                <Mail className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
              </a>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#problemas" className="hover:text-foreground transition-colors">Soluções</a>
            <a href="#fluxo" className="hover:text-foreground transition-colors">Como Funciona</a>
            <a href="#modulos" className="hover:text-foreground transition-colors">Módulos</a>
            <a href="#diferenciais" className="hover:text-foreground transition-colors">Diferenciais</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            <a href="/hub/index.html" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1 text-primary">
              <Newspaper className="w-3.5 h-3.5" /> Hub
            </a>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>Entrar</Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://calendly.com/joaodsouzanery/apresentacao-personalrh" target="_blank" rel="noopener noreferrer">
                Agendar Demo
              </a>
            </Button>
            <Button size="sm" onClick={() => navigate('/hydronetwork')} className="bg-primary hover:bg-primary/90">
              Acessar Plataforma
            </Button>
          </div>
        </div>
      </nav>

      {/* ═══════════════ HERO — REDESIGNED ═══════════════ */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Multi-layer background */}
        <div className="absolute inset-0">
          <img src={heroSaneamento} alt="" className="w-full h-full object-cover opacity-15" />
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,47%,3%)] via-[hsl(217,60%,8%)] to-[hsl(200,50%,6%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222,47%,3%)] via-transparent to-[hsl(222,47%,3%)/0.6]" />
        </div>

        {/* Animated grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />

        {/* Floating orbs */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 right-1/3 w-[300px] h-[300px] rounded-full bg-violet-500/3 blur-[80px] animate-pulse" style={{ animationDelay: "2s" }} />

        <div className="container mx-auto px-4 z-10 py-12 md:py-0">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left content — 7 cols */}
            <div className="lg:col-span-7 space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-bold text-primary backdrop-blur-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                </span>
                Ecossistema Definitivo para Engenharia de Saneamento
              </div>

              {/* Title */}
              <div>
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]">
                  <span className="text-white">ConstruData</span>
                  <br />
                  <span className="bg-gradient-to-r from-primary via-cyan-400 to-blue-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-[gradient-shift_6s_ease-in-out_infinite]">
                    HydroNetwork
                  </span>
                </h1>
                {/* Rotating subtitle */}
                <div className="mt-4 h-10 sm:h-12 overflow-hidden">
                  <p
                    key={heroTextIndex}
                    className="text-xl sm:text-2xl md:text-3xl text-white/70 font-bold animate-[fade-up_0.5s_ease-out]"
                  >
                    {heroTexts[heroTextIndex]}
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className="text-base sm:text-lg text-white/50 max-w-2xl leading-relaxed">
                <strong className="text-white/80">30+ módulos integrados</strong> para pré-dimensionamento de redes,
                simulação hidráulica (EPANET/SWMM), orçamento SINAPI/SICRO,
                planejamento com Gantt e RDO digital — tudo <strong className="text-white/80">100% online e gratuito</strong>.
              </p>

              {/* Animated flow steps — pill style */}
              <div className="flex flex-wrap gap-2">
                {flowSteps.map((s, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all duration-500 border backdrop-blur-sm ${
                      activeModule === i
                        ? "bg-primary/20 border-primary/40 text-primary scale-110 shadow-lg shadow-primary/25"
                        : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:bg-white/[0.06] hover:text-white/60"
                    }`}
                  >
                    <s.icon className="w-3.5 h-3.5" />
                    {s.title}
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 rounded-xl shadow-lg shadow-primary/30 bg-primary hover:bg-primary/90 group"
                  onClick={() => navigate('/hydronetwork')}
                >
                  Acessar Plataforma
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6 rounded-xl border-white/15 text-white hover:bg-white/10 backdrop-blur-sm"
                  asChild
                >
                  <a href="https://calendly.com/joaodsouzanery/apresentacao-personalrh" target="_blank" rel="noopener noreferrer">
                    <Play className="w-5 h-5 mr-2" />
                    Agendar Demonstração
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6 rounded-xl border-primary/20 text-primary hover:bg-primary/10 backdrop-blur-sm"
                  onClick={() => window.open('/hub/index.html', '_blank')}
                >
                  <Newspaper className="w-5 h-5 mr-2" />
                  Hub de Notícias
                </Button>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-5 text-sm text-white/40">
                {["Sem instalação", "100% gratuito", "30+ módulos", "Exportação GIS"].map((t, i) => (
                  <span key={i} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </div>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Right floating cards — 5 cols */}
            <div className="lg:col-span-5 hidden lg:block">
              <div className="relative">
                {/* Main glass card */}
                <div className="bg-white/[0.04] backdrop-blur-2xl rounded-3xl border border-white/[0.08] p-8 shadow-2xl">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center shadow-lg shadow-primary/20">
                      <Droplets className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Plataforma Verificada</p>
                      <p className="text-xs text-white/40">Confiada por engenheiros em todo o Brasil</p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[
                      { v: "30+", l: "Módulos", icon: Layers, c: "from-primary/20 to-primary/5" },
                      { v: "8+", l: "Formatos Export", icon: Globe, c: "from-cyan-500/20 to-cyan-500/5" },
                      { v: "3", l: "Motores de Cálculo", icon: Cpu, c: "from-violet-500/20 to-violet-500/5" },
                      { v: "6", l: "Normas ABNT", icon: Shield, c: "from-emerald-500/20 to-emerald-500/5" },
                    ].map((s, i) => (
                      <div key={i} className={`p-4 rounded-2xl bg-gradient-to-br ${s.c} border border-white/[0.06] text-center group hover:border-white/[0.12] transition-all`}>
                        <s.icon className="w-4 h-4 text-white/30 mx-auto mb-1" />
                        <div className="text-2xl font-black text-white">{s.v}</div>
                        <div className="text-[10px] text-white/40 font-medium">{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Feature list */}
                  <div className="space-y-3">
                    {[
                      { t: "EPANET via WebAssembly", c: "text-primary" },
                      { t: "SINAPI/SICRO integrado", c: "text-cyan-400" },
                      { t: "Exportação QGIS nativa", c: "text-emerald-400" },
                    ].map((f, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                          <Check className={`w-3.5 h-3.5 ${f.c}`} />
                        </div>
                        <span className="text-white/50">{f.t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating mini card — bottom left */}
                <div className="absolute -bottom-5 -left-8 bg-white/[0.06] backdrop-blur-2xl rounded-2xl border border-white/[0.08] p-4 shadow-xl animate-[float_3s_ease-in-out_infinite]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">100% Online</p>
                      <p className="text-[10px] text-white/40">Sem instalação necessária</p>
                    </div>
                  </div>
                </div>

                {/* Floating mini card — top right */}
                <div className="absolute -top-4 -right-6 bg-white/[0.06] backdrop-blur-2xl rounded-2xl border border-white/[0.08] p-4 shadow-xl animate-[float_3s_ease-in-out_infinite_0.5s]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">IA Integrada</p>
                      <p className="text-[10px] text-white/40">Automação inteligente</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2">
          <span className="text-[10px] text-white/30 uppercase tracking-widest font-medium">Explore</span>
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-[scroll-dot_1.5s_ease-in-out_infinite]" />
          </div>
        </div>
      </section>

      {/* ═══════════════ BADGES DE CONFORMIDADE ═══════════════ */}
      <section className="py-10 border-b border-border bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Em conformidade com</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
            {[
              { label: "ABNT NBR 9649", desc: "Rede de Esgoto" },
              { label: "ABNT NBR 12218", desc: "Rede de Água" },
              { label: "ABNT NBR 14486", desc: "Sistemas Enterrados" },
              { label: "SINAPI", desc: "Composições de Custo" },
              { label: "SICRO", desc: "Custos Rodoviários" },
              { label: "TCU 2622/2013", desc: "BDI Referencial" },
            ].map((badge, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card shadow-sm">
                <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">{badge.label}</p>
                  <p className="text-[10px] text-muted-foreground">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ STATS BAR ═══════════════ */}
      <section className="py-16 border-y border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { value: "30+", label: "Módulos Integrados" },
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

      {/* ═══════════════ PROBLEMA & SOLUÇÃO ═══════════════ */}
      <section id="problemas" data-animate className={`py-20 bg-background transition-all duration-700 ${isVisible("problemas") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Desafios Comuns na Engenharia de Saneamento?{" "}
              <span className="text-primary">Nós Resolvemos.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
              Complexidade de softwares, falta de integração, erros manuais, lentidão nos processos e custos elevados. 
              O HydroNetwork é a solução integrada que simplifica, acelera e otimiza todo o ciclo de vida dos projetos.
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid sm:grid-cols-2 gap-6">
            {problems.map((p, i) => (
              <div key={i} className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                    <p.icon className="w-6 h-6 text-destructive group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">{p.title}</h3>
                    <p className="text-sm text-muted-foreground">{p.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="max-w-3xl mx-auto mt-12 p-6 rounded-xl bg-primary/5 border border-primary/20 text-center">
            <h3 className="text-xl font-black text-primary mb-2">A Solução: HydroNetwork</h3>
            <p className="text-muted-foreground">
              Uma plataforma única onde os dados fluem da topografia ao RDO sem redigitação. 
              Importe uma vez, use em todos os módulos. Dimensione, orce, planeje e acompanhe — tudo no navegador.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════ FLUXO COMPLETO — 8 ETAPAS ═══════════════ */}
      <section id="fluxo" data-animate className={`py-20 bg-muted/30 transition-all duration-700 ${isVisible("fluxo") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Do Projeto à Entrega:{" "}
              <span className="text-primary">O Fluxo Completo em 8 Etapas</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              8 etapas integradas que cobrem todo o ciclo de um projeto de saneamento, garantindo eficiência e precisão do início ao fim.
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

          <div className="text-center mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" size="lg" onClick={() => document.getElementById("modulos")?.scrollIntoView({ behavior: "smooth" })}>
              Ver Todos os Módulos <ChevronDown className="ml-2 w-4 h-4" />
            </Button>
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90">
              <a href="https://calendly.com/joaodsouzanery/apresentacao-personalrh" target="_blank" rel="noopener noreferrer">
                Agendar Demonstração <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════ 30+ MÓDULOS — REDESIGNED ═══════════════ */}
      <section id="modulos" data-animate className={`py-20 bg-gradient-to-br from-[hsl(222,47%,5%)] via-[hsl(217,60%,10%)] to-[hsl(200,50%,8%)] text-white relative overflow-hidden transition-all duration-700 ${isVisible("modulos") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)",
          backgroundSize: "40px 40px"
        }} />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/3 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/3 blur-[120px]" />

        <div className="container mx-auto px-4 relative z-10">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-bold mb-4 backdrop-blur-sm">
              <Sparkles className="w-4 h-4" /> Catálogo Completo
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-3">
              Descubra o Poder dos{" "}
              <span className="bg-gradient-to-r from-primary via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                30+ Módulos
              </span>{" "}
              Integrados
            </h2>
            <p className="text-white/40 max-w-3xl mx-auto text-lg">
              Cada módulo foi projetado para resolver um problema real da engenharia de saneamento.
            </p>
          </div>

          {/* Search & Category Filters */}
          <div className="max-w-4xl mx-auto mb-10 space-y-4">
            {/* Search bar */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Buscar módulo..."
                value={moduleSearch}
                onChange={(e) => setModuleSearch(e.target.value)}
                className="w-full pl-11 pr-10 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/40 focus:bg-white/[0.06] transition-all backdrop-blur-sm"
              />
              {moduleSearch && (
                <button
                  onClick={() => setModuleSearch("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {moduleCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setModuleFilter(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all border backdrop-blur-sm ${
                    moduleFilter === cat.id
                      ? "bg-primary/20 border-primary/40 text-primary shadow-lg shadow-primary/10"
                      : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:bg-white/[0.06] hover:text-white/60 hover:border-white/[0.12]"
                  }`}
                >
                  <cat.icon className="w-3.5 h-3.5" />
                  {cat.label}
                  {cat.id === "all" && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                      moduleFilter === "all" ? "bg-primary/30 text-primary" : "bg-white/[0.06] text-white/30"
                    }`}>
                      {allModules.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Module count indicator */}
          {(moduleFilter !== "all" || moduleSearch) && (
            <div className="text-center mb-6">
              <p className="text-sm text-white/30">
                {filteredModules.length} módulo{filteredModules.length !== 1 ? "s" : ""} encontrado{filteredModules.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}

          {/* Modules Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
            {filteredModules.map((m, i) => {
              const isExpanded = expandedModule === i;
              return (
                <div
                  key={`${moduleFilter}-${i}`}
                  onClick={() => setExpandedModule(isExpanded ? null : i)}
                  className={`relative p-5 rounded-2xl border backdrop-blur-sm cursor-pointer transition-all duration-300 group ${
                    m.badge
                      ? "border-white/[0.06] bg-white/[0.02] opacity-70"
                      : isExpanded
                        ? "border-primary/30 bg-primary/[0.06] shadow-lg shadow-primary/5 scale-[1.01]"
                        : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] hover:shadow-lg"
                  }`}
                >
                  {m.badge && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/20">
                      {m.badge}
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                      <m.icon className="w-5.5 h-5.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm mb-1 text-white group-hover:text-primary transition-colors">{m.title}</h3>
                      <p className="text-xs text-white/40 leading-relaxed mb-3">{m.desc}</p>

                      {/* Features — always visible */}
                      <div className="space-y-1.5">
                        {m.features.slice(0, isExpanded ? undefined : 3).map((f, j) => (
                          <div key={j} className="flex items-center gap-2 text-[11px] text-white/35">
                            <div className="w-4 h-4 rounded-md bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            </div>
                            {f}
                          </div>
                        ))}
                      </div>

                      {/* Benefits — expanded only */}
                      {isExpanded && m.benefits && (
                        <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-1.5">
                          <p className="text-[10px] text-primary/60 font-bold uppercase tracking-wider mb-2">Benefícios</p>
                          {m.benefits.map((b, j) => (
                            <div key={j} className="flex items-center gap-2 text-[11px] text-white/35">
                              <div className="w-4 h-4 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Star className="w-2.5 h-2.5 text-primary" />
                              </div>
                              {b}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Expand hint */}
                      {!isExpanded && !m.badge && m.benefits && m.benefits.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-white/20 group-hover:text-primary/40 transition-colors">
                          <ChevronDown className="w-3 h-3" />
                          <span>Ver benefícios</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {filteredModules.length === 0 && (
            <div className="text-center py-16">
              <Search className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/30 text-lg font-bold">Nenhum módulo encontrado</p>
              <p className="text-white/20 text-sm mt-1">Tente buscar com outros termos</p>
              <button
                onClick={() => { setModuleSearch(""); setModuleFilter("all"); }}
                className="mt-4 text-primary text-sm font-bold hover:underline"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {/* Bottom CTA */}
          <div className="text-center mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate('/hydronetwork')}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 rounded-xl text-lg group"
            >
              Acessar Plataforma Completa <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-8 py-6 rounded-xl text-lg border-white/15 text-white hover:bg-white/10 backdrop-blur-sm"
              asChild
            >
              <a href="https://calendly.com/joaodsouzanery/apresentacao-personalrh" target="_blank" rel="noopener noreferrer">
                Agendar Demonstração
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════ DIFERENCIAIS COMPETITIVOS ═══════════════ */}
      <section id="diferenciais" data-animate className={`py-20 bg-muted/30 transition-all duration-700 ${isVisible("diferenciais") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black mb-3">
              Por que Engenheiros Migram para o{" "}
              <span className="text-primary">HydroNetwork</span>?
            </h2>
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
                    <td className="text-center py-3">{row.planilhas ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <span className="text-destructive">✕</span>}</td>
                    <td className="text-center py-3">{row.outros === true ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : row.outros === "partial" ? <span className="text-yellow-500">◐</span> : <span className="text-destructive">✕</span>}</td>
                    <td className="text-center py-3"><Check className="w-5 h-5 text-emerald-500 mx-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center mt-10">
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90 px-8 py-6 rounded-xl text-lg">
              <a href="https://calendly.com/joaodsouzanery/apresentacao-personalrh" target="_blank" rel="noopener noreferrer">
                Agendar Demonstração Personalizada <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════ FAQ ═══════════════ */}
      <div id="faq">
        <FAQ />
      </div>

      {/* ═══════════════ CTA FINAL ═══════════════ */}
      <section className="py-24 bg-gradient-to-br from-[hsl(222,47%,8%)] via-primary to-[hsl(217,70%,30%)] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.05)_0%,transparent_60%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-5xl font-black">
              Pronto para Transformar Seus Projetos de Saneamento?
            </h2>
            <p className="text-xl text-white/80">
              Experimente o HydroNetwork hoje mesmo. 30+ módulos integrados. Do pré-dimensionamento ao RDO. 100% online e gratuito.
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

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="py-12 bg-card border-t border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 text-sm text-muted-foreground">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Droplets className="h-5 w-5 text-primary" />
                <span className="font-bold text-foreground">HydroNetwork</span>
              </div>
              <p className="text-xs mb-4">Plataforma completa de engenharia de saneamento</p>
              <p className="text-xs">construdata.contato@gmail.com</p>
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-3">Redes</h4>
              {["Esgoto (Gravidade)", "Água (Pressão)", "Drenagem Pluvial", "Elevatória/Recalque"].map(m => <p key={m} className="text-xs mb-1">{m}</p>)}
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-3">Ferramentas</h4>
              {["EPANET / EPANET PRO", "SWMM", "QGIS", "Gantt / Curva S / EVM", "Revisão por Pares"].map(m => <p key={m} className="text-xs mb-1">{m}</p>)}
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-3">Formatos</h4>
              {["CSV / Excel", "DXF / AutoCAD", "Shapefile / GeoJSON", "GeoPackage / KML", ".INP (EPANET/SWMM)", "PDF"].map(m => <p key={m} className="text-xs mb-1">{m}</p>)}
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-3">Links</h4>
              <p className="text-xs mb-1"><a href="mailto:construdata.contato@gmail.com" className="hover:text-foreground transition-colors">Contato</a></p>
              <p className="text-xs mb-1"><a href="https://www.linkedin.com/company/construdatasoftware" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">LinkedIn</a></p>
              <p className="text-xs mb-1 mt-4 text-muted-foreground/60">Política de Privacidade</p>
              <p className="text-xs mb-1 text-muted-foreground/60">Termos de Uso</p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} ConstruData. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* WhatsApp Floating Button */}
      <a
        href="https://wa.me/5521999999999"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20BD5A] shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        title="Fale conosco pelo WhatsApp"
      >
        <MessageSquare className="h-6 w-6 text-white" />
      </a>

      <ContactDialog open={showContactDialog} onOpenChange={handleDialogClose} />
    </div>
  );
};

export default Hero;
