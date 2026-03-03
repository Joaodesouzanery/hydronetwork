import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LogoText } from "@/components/shared/Logo";
import {
  Home, Upload, Droplets, CloudRain, FileSpreadsheet, Calculator,
  Calendar, Beaker, Waves, Layers, FileText, Map, Shield, ClipboardList,
  Activity, DollarSign, Building2, Bell, Settings, BookOpen,
  HeadphonesIcon, Search, ChevronRight, Mail, Linkedin, MessageCircle,
  BarChart3, Package, Image, AlertCircle, Archive, Eye, Palette,
  Clock, ClipboardCheck, FileCheck2, GraduationCap, Zap
} from "lucide-react";

interface ModuleTutorial {
  key: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  description: string;
  steps: { title: string; description: string }[];
  route?: string;
}

const moduleTutorials: ModuleTutorial[] = [
  {
    key: "dashboard",
    title: "Dashboard",
    icon: Home,
    category: "Menu Principal",
    description: "Visão geral dos seus projetos com KPIs, produção e atividades recentes.",
    route: "/dashboard",
    steps: [
      { title: "Visão Geral", description: "O Dashboard exibe um resumo de todos os seus projetos, incluindo estatísticas de produção, alertas recentes e atividades." },
      { title: "Abas de Dashboard", description: "Alterne entre Dashboard Geral (visão completa), Produção (metas e execução) e Por Projeto (detalhes individuais)." },
      { title: "Cards de Ação Rápida", description: "Use os cards para acessar rapidamente Projetos, Novo RDO, Histórico, Fotos, Produção e Dashboard 360°." },
      { title: "Atividades Recentes", description: "Na parte inferior, veja as últimas ações registradas no sistema como RDOs criados, materiais solicitados e alertas." },
    ],
  },
  {
    key: "projects",
    title: "Projetos",
    icon: Building2,
    category: "Menu Principal",
    description: "Criação e gerenciamento completo de projetos de obra.",
    route: "/projects",
    steps: [
      { title: "Criar Projeto", description: "Clique em 'Novo Projeto' para cadastrar uma nova obra com nome, endereço e detalhes." },
      { title: "Frentes de Serviço", description: "Dentro de cada projeto, crie frentes de serviço para organizar o trabalho em áreas específicas." },
      { title: "Catálogo de Serviços", description: "Cadastre os serviços executados em cada frente com unidades de medida e metas." },
      { title: "Acompanhamento", description: "Visualize o status de cada projeto com progresso, equipe e dados financeiros." },
    ],
  },
  {
    key: "topografia",
    title: "Topografia",
    icon: Upload,
    category: "HydroNetwork",
    description: "Importação e visualização de dados topográficos em múltiplos formatos.",
    route: "/hydronetwork/topografia",
    steps: [
      { title: "Importar Dados", description: "Importe arquivos CSV, DXF, SHP, GeoJSON ou LandXML com pontos topográficos." },
      { title: "Mapeamento de Campos", description: "Configure o mapeamento entre as colunas do arquivo e os campos do sistema (X, Y, Z, nome)." },
      { title: "Visualização no Mapa", description: "Veja os pontos importados no mapa interativo com coordenadas e cotas." },
      { title: "Classificação de Pontos", description: "Classifique pontos como PV, nó de rede, cruzamento etc. para uso nos módulos de rede." },
    ],
  },
  {
    key: "esgoto",
    title: "Rede de Esgoto",
    icon: Waves,
    category: "HydroNetwork",
    description: "Dimensionamento automático de redes de esgoto conforme NBR 9649.",
    route: "/hydronetwork/esgoto",
    steps: [
      { title: "Configurar Parâmetros", description: "Defina parâmetros hidráulicos: coeficiente de Manning, vazão mínima, declividades e profundidades." },
      { title: "Criar Trechos", description: "Conecte os pontos topográficos para formar a rede, definindo montante e jusante de cada trecho." },
      { title: "Dimensionar", description: "O sistema calcula automaticamente diâmetros, declividades, velocidades e tensão trativa conforme NBR 9649." },
      { title: "Validação Normativa", description: "Verifique alertas de violação de norma para velocidade, lâmina d'água e profundidade de coletor." },
    ],
  },
  {
    key: "agua",
    title: "Rede de Água",
    icon: Droplets,
    category: "HydroNetwork",
    description: "Dimensionamento de redes de distribuição de água conforme NBR 12218.",
    route: "/hydronetwork/agua",
    steps: [
      { title: "Parâmetros de Projeto", description: "Configure vazão per capita, coeficientes K1 e K2, e pressões mínimas/máximas." },
      { title: "Traçado da Rede", description: "Defina os trechos da rede de distribuição conectando os pontos topográficos." },
      { title: "Cálculo Hidráulico", description: "O sistema calcula perdas de carga, pressões nodais e velocidades automaticamente." },
      { title: "Simulação EPANET", description: "Exporte a rede para simulação EPANET integrada com análise de pressão." },
    ],
  },
  {
    key: "drenagem",
    title: "Drenagem Pluvial",
    icon: CloudRain,
    category: "HydroNetwork",
    description: "Dimensionamento de galerias pluviais conforme NBR 10844.",
    route: "/hydronetwork/drenagem",
    steps: [
      { title: "Dados de Chuva", description: "Configure a curva IDF e o período de retorno para cálculo das vazões de projeto." },
      { title: "Bacias de Contribuição", description: "Defina as áreas de contribuição com coeficientes de escoamento para cada trecho." },
      { title: "Dimensionamento", description: "O sistema calcula seções de galerias, sarjetas e bocas de lobo automaticamente." },
      { title: "Resultados", description: "Visualize planilha completa com velocidades, lâminas e capacidades de cada elemento." },
    ],
  },
  {
    key: "orcamento",
    title: "Orçamento SINAPI",
    icon: Calculator,
    category: "HydroNetwork",
    description: "Geração automática de orçamento com composições SINAPI/SICRO por trecho.",
    route: "/hydronetwork/orcamento",
    steps: [
      { title: "Quantitativos Automáticos", description: "O sistema gera automaticamente os quantitativos a partir do dimensionamento da rede." },
      { title: "Composições SINAPI", description: "Vincule composições SINAPI/SICRO a cada tipo de serviço (escavação, tubulação, reaterro)." },
      { title: "BDI", description: "Configure o BDI conforme Acórdão TCU 2622/2013 com transparência nos percentuais." },
      { title: "Exportação", description: "Exporte o orçamento completo em PDF ou planilha Excel para licitações." },
    ],
  },
  {
    key: "epanet",
    title: "EPANET",
    icon: Beaker,
    category: "HydroNetwork",
    description: "Simulação hidráulica integrada com importação/exportação .INP.",
    route: "/hydronetwork/epanet",
    steps: [
      { title: "Importar Rede", description: "Importe arquivos .INP do EPANET ou use a rede dimensionada no ConstruData." },
      { title: "Configurar Simulação", description: "Defina padrões de demanda, reservatórios e bombas para a simulação." },
      { title: "Executar", description: "Rode a simulação hidráulica em WebAssembly diretamente no navegador." },
      { title: "Analisar Resultados", description: "Visualize pressões, velocidades e vazões em mapas e gráficos interativos." },
    ],
  },
  {
    key: "epanet-pro",
    title: "EPANET PRO",
    icon: Zap,
    category: "HydroNetwork",
    description: "Versão avançada com simulação via WebAssembly (epanet-js).",
    route: "/hydronetwork/epanet-pro",
    steps: [
      { title: "Motor WebAssembly", description: "Simulação de alto desempenho usando epanet-js compilado para WebAssembly." },
      { title: "Análise Avançada", description: "Execute simulações de período estendido com múltiplos cenários." },
      { title: "Visualização 3D", description: "Visualize resultados em mapa com códigos de cores para pressão e velocidade." },
      { title: "Relatórios", description: "Gere relatórios técnicos completos com gráficos e tabelas de resultados." },
    ],
  },
  {
    key: "planejamento",
    title: "Planejamento",
    icon: Calendar,
    category: "HydroNetwork",
    description: "Gantt com caminho crítico, Curva S automática e EVM.",
    route: "/hydronetwork/planejamento",
    steps: [
      { title: "Gráfico Gantt", description: "Crie o cronograma da obra com tarefas, dependências e marcos." },
      { title: "Caminho Crítico", description: "Identifique automaticamente o caminho crítico do projeto para priorização." },
      { title: "Curva S", description: "Acompanhe a evolução planejada vs. realizada com a Curva S automática." },
      { title: "EVM (Earned Value)", description: "Analise o desempenho do projeto com indicadores CPI, SPI, EAC e VAC." },
    ],
  },
  {
    key: "rdo",
    title: "RDO Digital",
    icon: ClipboardList,
    category: "Diário de Obra",
    description: "Registro diário de obra com fotos, GPS e dados climáticos.",
    route: "/rdo-new",
    steps: [
      { title: "Selecionar Projeto", description: "Escolha o projeto e a frente de serviço para o relatório do dia." },
      { title: "Registrar Produção", description: "Informe quantidade executada de cada serviço com equipe responsável." },
      { title: "Condições Climáticas", description: "Registre as condições do tempo e seu impacto na produção." },
      { title: "Fotos e GPS", description: "Anexe fotos geolocalizadas que comprovem a execução dos serviços." },
      { title: "Exportar PDF", description: "Gere o RDO em PDF formatado para assinatura e arquivo." },
    ],
  },
  {
    key: "producao",
    title: "Controle de Produção",
    icon: BarChart3,
    category: "Diário de Obra",
    description: "Metas, acompanhamento e análise de produção por frente.",
    route: "/production-control",
    steps: [
      { title: "Definir Metas", description: "Cadastre metas de produção por serviço e frente para acompanhar o progresso." },
      { title: "Dashboard de Produção", description: "Visualize gráficos de produção realizada vs. planejada em tempo real." },
      { title: "Identificar Desvios", description: "O sistema alerta quando a produção está abaixo da meta definida." },
      { title: "Relatórios", description: "Exporte relatórios consolidados em PDF ou Excel para reuniões." },
    ],
  },
  {
    key: "alertas",
    title: "Alertas Inteligentes",
    icon: Bell,
    category: "Monitoramento",
    description: "Sistema de alertas configuráveis para produção, estoque e atrasos.",
    route: "/alerts",
    steps: [
      { title: "Criar Alertas", description: "Defina condições que devem disparar alertas (produção baixa, estoque mínimo, prazo)." },
      { title: "Notificações", description: "Configure notificações por email para cada tipo de alerta." },
      { title: "Histórico", description: "Consulte o histórico de alertas disparados para identificar padrões." },
      { title: "Justificativas", description: "Adicione justificativas e ações tomadas para cada alerta registrado." },
    ],
  },
  {
    key: "materiais",
    title: "Materiais e Almoxarifado",
    icon: Package,
    category: "Gestão",
    description: "Controle de estoque, pedidos e consumo de materiais.",
    route: "/inventory",
    steps: [
      { title: "Cadastrar Materiais", description: "Registre materiais com código, nome, unidade e quantidade mínima de estoque." },
      { title: "Entradas e Saídas", description: "Registre movimentações de estoque com rastreabilidade completa." },
      { title: "Pedidos", description: "Crie pedidos de material com fluxo de aprovação integrado." },
      { title: "Alertas de Estoque", description: "Receba alertas automáticos quando o estoque atingir o nível mínimo." },
    ],
  },
  {
    key: "mapa",
    title: "Mapa Interativo",
    icon: Eye,
    category: "HydroNetwork",
    description: "Mapa georreferenciado com Leaflet para visualização da rede.",
    route: "/hydronetwork/mapa",
    steps: [
      { title: "Visualização", description: "Veja todos os pontos e trechos da rede em um mapa interativo georreferenciado." },
      { title: "Camadas", description: "Ative/desative camadas de esgoto, água, drenagem e topografia." },
      { title: "Informações", description: "Clique em qualquer elemento para ver detalhes técnicos e custos associados." },
      { title: "Exportar", description: "Exporte o mapa em formatos SHP, GeoJSON, KML ou DXF." },
    ],
  },
  {
    key: "perfil",
    title: "Perfil Longitudinal",
    icon: Activity,
    category: "HydroNetwork",
    description: "Visualização de corte vertical SVG da rede dimensionada.",
    route: "/hydronetwork/perfil",
    steps: [
      { title: "Seleção de Trecho", description: "Selecione o trecho da rede para visualizar o perfil longitudinal." },
      { title: "Escala e Zoom", description: "Ajuste a escala vertical e horizontal para melhor visualização." },
      { title: "Elementos", description: "Visualize tubulações, PVs, cotas de terreno e de coletor no perfil." },
      { title: "Exportar PNG", description: "Exporte o perfil longitudinal como imagem PNG para relatórios." },
    ],
  },
  {
    key: "qgis",
    title: "Exportação QGIS",
    icon: Map,
    category: "HydroNetwork",
    description: "Exportação completa em formatos GIS (SHP, GeoJSON, KML, DXF).",
    route: "/hydronetwork/qgis",
    steps: [
      { title: "Selecionar Formato", description: "Escolha o formato de exportação: Shapefile, GeoJSON, KML ou DXF." },
      { title: "Configurar Atributos", description: "Selecione quais atributos técnicos incluir na exportação." },
      { title: "Sistema de Coordenadas", description: "Defina o CRS (sistema de referência de coordenadas) para a exportação." },
      { title: "Baixar", description: "Faça o download do arquivo gerado para uso no QGIS ou ArcGIS." },
    ],
  },
  {
    key: "revisao",
    title: "Revisão por Pares",
    icon: Shield,
    category: "HydroNetwork",
    description: "Checklist normativo ABNT para revisão e validação de projetos.",
    route: "/hydronetwork/revisao",
    steps: [
      { title: "Checklist Normativo", description: "Execute o checklist baseado nas normas ABNT aplicáveis ao projeto." },
      { title: "Itens de Verificação", description: "Marque cada item como conforme, não conforme ou não aplicável." },
      { title: "Comentários", description: "Adicione comentários e recomendações para cada item verificado." },
      { title: "Relatório de Revisão", description: "Gere o relatório de revisão por pares para documentação." },
    ],
  },
];

const Tutorials = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModule, setSelectedModule] = useState<ModuleTutorial | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("Todos");

  const categories = ["Todos", ...new Set(moduleTutorials.map((m) => m.category))];

  const filteredModules = moduleTutorials.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === "Todos" || m.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col">
          <header className="border-b border-border bg-background/90 sticky top-0 z-10">
            <div className="container mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <SidebarTrigger />
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-[#FF6B2C]" />
                  <h1 className="text-base sm:text-lg font-bold font-mono">Tutoriais</h1>
                </div>
              </div>
            </div>
          </header>

          <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 flex-1">
            {selectedModule ? (
              /* Module Detail View */
              <div className="max-w-3xl mx-auto">
                <Button
                  variant="ghost"
                  className="mb-4 font-mono text-sm gap-1"
                  onClick={() => setSelectedModule(null)}
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  Voltar aos Tutoriais
                </Button>

                <Card className="mb-6">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#FF6B2C]/10 flex items-center justify-center">
                        <selectedModule.icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#FF6B2C]" />
                      </div>
                      <div>
                        <CardTitle className="text-lg sm:text-xl font-mono">{selectedModule.title}</CardTitle>
                        <CardDescription className="text-xs sm:text-sm font-mono">
                          {selectedModule.category}
                        </CardDescription>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground font-mono mt-2">
                      {selectedModule.description}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedModule.steps.map((step, index) => (
                      <div key={index} className="flex gap-3 sm:gap-4">
                        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-[#FF6B2C] text-white flex items-center justify-center font-mono font-bold text-xs sm:text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold font-mono text-sm sm:text-base mb-1">{step.title}</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground font-mono leading-relaxed">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {selectedModule.route && (
                  <Button
                    className="w-full rounded-none bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 font-mono text-white mb-6"
                    onClick={() => navigate(selectedModule.route!)}
                  >
                    Ir para {selectedModule.title}
                    <ChevronRight className="ml-1 w-4 h-4" />
                  </Button>
                )}

                {/* Support section */}
                <Card className="border-[#FF6B2C]/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-mono">Precisa de Ajuda?</CardTitle>
                    <CardDescription className="text-xs font-mono">
                      Entre em contato com nosso suporte
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <a
                        href="mailto:construdata.contato@gmail.com"
                        className="flex items-center gap-2 p-3 border border-border hover:border-[#FF6B2C] hover:bg-[#FF6B2C]/5 transition-colors"
                      >
                        <Mail className="w-4 h-4 text-[#FF6B2C]" />
                        <div>
                          <p className="text-xs font-mono font-bold">Email</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground font-mono truncate">construdata.contato@gmail.com</p>
                        </div>
                      </a>
                      <a
                        href="https://www.linkedin.com/company/construdatasoftware"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 border border-border hover:border-[#FF6B2C] hover:bg-[#FF6B2C]/5 transition-colors"
                      >
                        <Linkedin className="w-4 h-4 text-[#FF6B2C]" />
                        <div>
                          <p className="text-xs font-mono font-bold">LinkedIn</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">ConstruData Software</p>
                        </div>
                      </a>
                      <a
                        href="https://wa.me/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 border border-border hover:border-[#FF6B2C] hover:bg-[#FF6B2C]/5 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4 text-[#FF6B2C]" />
                        <div>
                          <p className="text-xs font-mono font-bold">WhatsApp</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">Fale conosco</p>
                        </div>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* Modules Grid View */
              <>
                <div className="mb-6 sm:mb-8">
                  <h2 className="text-xl sm:text-2xl font-bold font-mono mb-2">Central de Tutoriais</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground font-mono">
                    Aprenda a usar cada módulo do ConstruData passo a passo
                  </p>
                </div>

                {/* Search + Category Filter */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar tutorial..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 font-mono text-sm"
                    />
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
                    {categories.map((cat) => (
                      <Button
                        key={cat}
                        variant={activeCategory === cat ? "default" : "outline"}
                        size="sm"
                        className={`font-mono text-xs whitespace-nowrap rounded-none ${
                          activeCategory === cat
                            ? "bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 text-white"
                            : "border-border"
                        }`}
                        onClick={() => setActiveCategory(cat)}
                      >
                        {cat}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Tutorial Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-8">
                  {filteredModules.map((module) => (
                    <Card
                      key={module.key}
                      className="cursor-pointer hover:border-[#FF6B2C]/30 hover:bg-[#FF6B2C]/[0.02] transition-all group"
                      onClick={() => setSelectedModule(module)}
                    >
                      <CardHeader className="pb-2 p-4 sm:p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#FF6B2C]/10 flex items-center justify-center group-hover:bg-[#FF6B2C]/20 transition-colors">
                            <module.icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF6B2C]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm sm:text-base font-mono">{module.title}</CardTitle>
                            <p className="text-[10px] sm:text-xs text-[#FF6B2C]/60 font-mono">{module.category}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-[#FF6B2C] transition-colors flex-shrink-0" />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 px-4 pb-4 sm:px-6 sm:pb-6">
                        <p className="text-xs text-muted-foreground font-mono line-clamp-2">
                          {module.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono mt-2">
                          {module.steps.length} passos
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredModules.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground font-mono">Nenhum tutorial encontrado</p>
                  </div>
                )}

                {/* Support Section */}
                <Card className="border-[#FF6B2C]/20 mt-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-mono">Precisa de Mais Ajuda?</CardTitle>
                    <CardDescription className="text-xs sm:text-sm font-mono">
                      Nosso time está pronto para ajudar você
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <a
                        href="mailto:construdata.contato@gmail.com"
                        className="flex items-center gap-3 p-4 border border-border hover:border-[#FF6B2C] hover:bg-[#FF6B2C]/5 transition-colors"
                      >
                        <Mail className="w-5 h-5 text-[#FF6B2C] flex-shrink-0" />
                        <div>
                          <p className="text-sm font-mono font-bold">Email</p>
                          <p className="text-xs text-muted-foreground font-mono">construdata.contato@gmail.com</p>
                        </div>
                      </a>
                      <a
                        href="https://www.linkedin.com/company/construdatasoftware"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 border border-border hover:border-[#FF6B2C] hover:bg-[#FF6B2C]/5 transition-colors"
                      >
                        <Linkedin className="w-5 h-5 text-[#FF6B2C] flex-shrink-0" />
                        <div>
                          <p className="text-sm font-mono font-bold">LinkedIn</p>
                          <p className="text-xs text-muted-foreground font-mono">ConstruData Software</p>
                        </div>
                      </a>
                      <a
                        href="https://wa.me/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 border border-border hover:border-[#FF6B2C] hover:bg-[#FF6B2C]/5 transition-colors"
                      >
                        <MessageCircle className="w-5 h-5 text-[#FF6B2C] flex-shrink-0" />
                        <div>
                          <p className="text-sm font-mono font-bold">WhatsApp</p>
                          <p className="text-xs text-muted-foreground font-mono">Fale conosco</p>
                        </div>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Tutorials;
