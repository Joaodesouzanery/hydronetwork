import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Copy, Linkedin, ChevronDown, ChevronRight, Check, ExternalLink,
  Upload, GitBranch, Droplets, CloudRain, FileSpreadsheet, Calculator, Calendar,
  Beaker, Zap, Waves, Layers, FileText, Map, Shield, ClipboardList, Activity,
  MapPin, Globe, Eye, TrendingUp, BarChart3, Package, Users, Bell, QrCode,
  Building2, Briefcase, UserCheck, Archive
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const modules = [
  {
    icon: Upload,
    title: "Topografia Inteligente",
    overview: "O módulo de Topografia Inteligente do HydroNetwork revoluciona a forma como engenheiros de saneamento lidam com dados topográficos. Ele automatiza o processamento de diversas fontes de dados, transformando informações brutas em modelos de terreno precisos e prontos para o projeto.",
    features: [
      "Importação Multi-formato: Suporte a CSV, TXT, XLSX, DXF, SHP, GeoJSON e LandXML.",
      "Processamento Automático de Dados: Identifica e processa coordenadas (X, Y) e elevação (Z) automaticamente.",
      "Geração Instantânea de Trechos: Gera trechos da rede com base nos dados topográficos importados.",
      "Análise de Relevo Avançada: Declividades, curvas de nível, perfis longitudinais e transversais."
    ],
    benefits: ["Redução drástica de tempo", "Minimização de erros humanos", "Decisões mais acertadas", "Compatibilidade total de formatos"],
    color: "from-blue-500 to-blue-600"
  },
  {
    icon: GitBranch,
    title: "Rede de Esgoto",
    overview: "Ferramentas completas para dimensionamento e projeto de sistemas de coleta de esgoto, por gravidade e recalque, com verificação normativa ABNT automática.",
    features: [
      "Dimensionamento por Gravidade: Cálculo automático de declividades, diâmetros e profundidades.",
      "Dimensionamento de Redes Elevatórias: Projeto de bombas e estações elevatórias.",
      "Verificação Normativa ABNT: Comparação automática com requisitos normativos.",
      "Cálculo Automático de Parâmetros: Vazões, velocidades, tensões trativas e perdas de carga."
    ],
    benefits: ["Conformidade normativa garantida", "Otimização de projetos", "Agilidade no dimensionamento", "Redução de erros de cálculo"],
    color: "from-purple-500 to-purple-600"
  },
  {
    icon: Droplets,
    title: "Rede de Água",
    overview: "Dedicado ao projeto e dimensionamento de sistemas de distribuição de água pressurizada com cálculo preciso de pressão, velocidade e perdas de carga.",
    features: [
      "Cálculo de Pressão e Vazão: Análise em diversos pontos da rede.",
      "Dimensionamento de Tubulações: Seleção otimizada de diâmetros.",
      "Análise de Perdas de Carga: Hazen-Williams e Darcy-Weisbach.",
      "Verificação de Velocidade: Limites normativos para evitar golpe de aríete e sedimentação."
    ],
    benefits: ["Projetos eficientes e seguros", "Otimização hidráulica", "Agilidade no projeto", "Confiabilidade dos resultados"],
    color: "from-cyan-500 to-cyan-600"
  },
  {
    icon: CloudRain,
    title: "Drenagem Pluvial",
    overview: "Ferramentas robustas para dimensionamento de galerias e estruturas de drenagem urbana com cálculo de vazões pelo método racional.",
    features: [
      "Dimensionamento de Galerias e Estruturas: Bocas de lobo, poços de visita e galerias.",
      "Cálculo de Vazões pelo Método Racional: Intensidade pluviométrica, área e coeficiente de escoamento.",
      "Determinação do Tempo de Concentração: Parâmetro fundamental para dimensionamento.",
      "Análise de Cenários de Chuva: Diferentes tempos de recorrência."
    ],
    benefits: ["Prevenção eficaz de inundações", "Projetos sustentáveis", "Conformidade com normas", "Otimização de custos"],
    color: "from-green-500 to-green-600"
  },
  {
    icon: FileSpreadsheet,
    title: "Quantitativos",
    overview: "Automatiza o cálculo de volumes e quantidades de materiais e serviços necessários para execução de projetos de saneamento, detalhando por trecho.",
    features: [
      "Cálculo de Volumes de Escavação e Reaterro: Considerando dimensões das valas e perfil do terreno.",
      "Quantificação de Tubulação: Metragem exata por diâmetro e material.",
      "Quantificação de PVs e Estruturas: Inventário completo de poços de visita e caixas.",
      "Serviços Complementares: Assentamento, reaterro compactado, escoramento."
    ],
    benefits: ["Orçamentos precisos", "Controle de custos eficaz", "Agilidade na elaboração", "Transparência e rastreabilidade"],
    color: "from-amber-500 to-amber-600"
  },
  {
    icon: Calculator,
    title: "Orçamento e Custos",
    overview: "Integra orçamentação com bases SINAPI/SICRO e visualização de custo por trecho no mapa interativo com faixas de cor.",
    features: [
      "Orçamentação Automatizada SINAPI/SICRO: Composições de preços oficiais.",
      "Custo por Trecho no Mapa Interativo: Codificação por cores indica trechos mais caros.",
      "Análise Detalhada de Composições: Insumos, mão de obra, equipamentos e custos indiretos.",
      "Relatórios Personalizáveis: Diferentes níveis de detalhe para apresentação."
    ],
    benefits: ["Transparência e controle financeiro", "Agilidade na elaboração", "Conformidade e credibilidade", "Otimização de custos"],
    color: "from-emerald-500 to-emerald-600"
  },
  {
    icon: Calendar,
    title: "Planejamento de Obra",
    overview: "Ferramentas avançadas com Gantt interativo, Curva S automática, análise de EVM (Earned Value Management) e caminho crítico.",
    features: [
      "Gantt Interativo: Arrastar e soltar tarefas, definir dependências, alocar recursos.",
      "Curva S Automática: Acumulado de custos/avanço físico ao longo do tempo.",
      "EVM (Earned Value Management): IDC e IDP para tomada de decisão.",
      "Caminho Crítico: Identificação das tarefas que impactam a data de conclusão."
    ],
    benefits: ["Gestão eficiente de prazos", "Controle de progresso e custos", "Otimização de recursos", "Tomada de decisão estratégica"],
    color: "from-pink-500 to-pink-600"
  },
  {
    icon: Beaker,
    title: "Simulação EPANET",
    overview: "Integração direta com o motor EPANET para análises de redes pressurizadas com exportação de arquivos .INP.",
    features: [
      "Integração Direta com EPANET: Dados do projeto conectados sem conversões manuais.",
      "Simulação Hidráulica Avançada: Regime permanente e estendido.",
      "Análise de Pressão e Vazão: Resultados detalhados em nós e trechos.",
      "Exportação de Arquivos .INP: Compatível com EPANET standalone."
    ],
    benefits: ["Análise precisa de redes pressurizadas", "Identificação de problemas antes da execução", "Otimização de desempenho", "Interoperabilidade"],
    color: "from-sky-500 to-sky-600"
  },
  {
    icon: Zap,
    title: "EPANET PRO (WebAssembly)",
    overview: "Simulação EPANET completa via WebAssembly (epanet-js) no navegador com import/export .INP e resultados visuais.",
    features: [
      "WebAssembly Nativo: Motor EPANET rodando diretamente no navegador.",
      "Import/Export .INP: Carregue e exporte arquivos EPANET nativos.",
      "Resultados por Pressão: Visualização de pressão em cada nó.",
      "Resultados por Velocidade: Análise de velocidade em cada trecho."
    ],
    benefits: ["Performance máxima", "Simulação completa no browser", "Sem instalação necessária", "Resultados em tempo real"],
    color: "from-blue-600 to-indigo-600"
  },
  {
    icon: Waves,
    title: "Simulação SWMM",
    overview: "Integração com SWMM para modelagem de drenagem urbana com análise de escoamento e cenários de chuva.",
    features: [
      "Integração com SWMM: Modelagem hidrológica e hidráulica de drenagem urbana.",
      "Modelagem de Drenagem Urbana: Bacias, galerias, condutos e reservatórios.",
      "Análise de Escoamento e Capacidade: Avaliação de sobrecarga e extravasamento.",
      "Simulação de Cenários de Chuva: Diferentes intensidades e durações."
    ],
    benefits: ["Prevenção eficaz de inundações", "Projetos resilientes", "Análise de impacto ambiental", "Otimização de soluções"],
    color: "from-teal-500 to-teal-600"
  },
  {
    icon: Layers,
    title: "OpenProject",
    overview: "Integração inteligente com OpenProject para gestão ágil com criação automática de Work Packages por trecho e equipe.",
    features: [
      "Integração Direta com OpenProject: Sincronização de dados.",
      "Criação Automática de Work Packages: Por trecho ou etapa do projeto.",
      "Gestão de Equipes e Atribuições: Prazos, prioridades e progresso.",
      "Acompanhamento de Progresso: Sincronização de status."
    ],
    benefits: ["Colaboração eficiente", "Gestão de tarefas simplificada", "Acompanhamento em tempo real", "Metodologias ágeis"],
    color: "from-orange-500 to-orange-600"
  },
  {
    icon: FileText,
    title: "ProjectLibre",
    overview: "Exportação de cronogramas para ProjectLibre, compatível com Microsoft Project para planejamento avançado.",
    features: [
      "Exportação para ProjectLibre: Mantém estrutura de tarefas e dependências.",
      "Compatibilidade MS Project: Exportação indireta para MS Project.",
      "Planejamento Avançado: Recursos, nivelamento e custos detalhados.",
      "Flexibilidade de Ferramentas: Escolha sua ferramenta preferida."
    ],
    benefits: ["Flexibilidade de ferramentas", "Integração com softwares existentes", "Gestão robusta", "Colaboração aprimorada"],
    color: "from-indigo-500 to-indigo-600"
  },
  {
    icon: Map,
    title: "Integração QGIS",
    overview: "Exportação de dados para QGIS com camadas vetoriais e atributos hidráulicos completos em Shapefile, GeoJSON e GeoPackage.",
    features: [
      "Exportação para QGIS: Camadas vetoriais com geometria precisa.",
      "Atributos Hidráulicos Completos: Diâmetros, declividades, vazões, pressões, custos.",
      "Múltiplos Formatos: Shapefile, GeoJSON, GeoPackage.",
      "Visualização e Análise Geoespacial: Mapas temáticos e cruzamento de dados."
    ],
    benefits: ["Análise geoespacial avançada", "Interoperabilidade total", "Visualização detalhada", "Tomada de decisão baseada em localização"],
    color: "from-green-600 to-green-700"
  },
  {
    icon: Shield,
    title: "Revisão por Pares",
    overview: "Workflow automatizado de verificação técnica com checklist normativo ABNT e análises automáticas de velocidade, declividade e profundidade.",
    features: [
      "Workflow Automatizado: Etapas de aprovação e feedback estruturado.",
      "Checklist Normativo ABNT: Verificação automática de parâmetros.",
      "Análise de Velocidade: Alertas de erosão ou sedimentação.",
      "Análise de Declividade e Profundidade: Verificação de viabilidade construtiva."
    ],
    benefits: ["Conformidade normativa", "Redução de erros e falhas", "Garantia de qualidade", "Colaboração e transparência"],
    color: "from-violet-500 to-violet-600"
  },
  {
    icon: ClipboardList,
    title: "RDO Digital",
    overview: "Relatório Diário de Obra especializado para saneamento com registro de avanço por trecho, fotos, GPS, clima e equipe.",
    features: [
      "RDO Especializado para Saneamento: Campos adaptados para atividades de saneamento.",
      "Registro de Avanço por Trecho: Percentuais de conclusão por segmento.",
      "Inclusão de Fotos e GPS: Documentação visual georreferenciada.",
      "Informações de Clima e Equipe: Dados climáticos e registro de pessoal."
    ],
    benefits: ["Controle de obra em tempo real", "Transparência e prestação de contas", "Tomada de decisão ágil", "Redução de burocracia"],
    color: "from-rose-500 to-rose-600"
  },
  {
    icon: Activity,
    title: "Perfil Longitudinal",
    overview: "Visualização detalhada do corte vertical da rede com escalas configuráveis e exagero vertical para análise técnica.",
    features: [
      "Visualização do Corte Vertical: Terreno, greide, tubulações e PVs em corte.",
      "Escalas Configuráveis: Horizontal e vertical ajustáveis.",
      "Exagero Vertical: Realça declividades e variações de profundidade.",
      "Identificação de Interferências: Detecta conflitos com infraestruturas subterrâneas."
    ],
    benefits: ["Análise técnica aprofundada", "Identificação de conflitos", "Otimização de traçado", "Comunicação eficaz"],
    color: "from-slate-500 to-slate-600"
  },
  {
    icon: MapPin,
    title: "Mapa Interativo",
    overview: "Mapa Leaflet com visualização georreferenciada, codificação por cores, status por trecho, camadas configuráveis e popup técnico.",
    features: [
      "Mapa Leaflet: Todos os elementos posicionados com precisão geográfica.",
      "Codificação por Cores: Por diâmetro, material, status, custo.",
      "Camadas Configuráveis: Ligar/desligar diferentes tipos de informação.",
      "Popup Técnico Detalhado: Dados hidráulicos, custos e status ao clicar."
    ],
    benefits: ["Visualização intuitiva do projeto", "Análise espacial avançada", "Comunicação eficiente", "Acompanhamento integrado"],
    color: "from-blue-600 to-blue-700"
  },
  {
    icon: Globe,
    title: "Exportação GIS",
    overview: "Exportação multi-formato: Shapefile, GeoJSON, GeoPackage, KML/KMZ, DXF e CSV com suporte a SIRGAS 2000 e WGS84.",
    features: [
      "Exportação Multi-formato: Shapefile, GeoJSON, GeoPackage, KML/KMZ, DXF, CSV.",
      "Suporte a Múltiplos CRS: SIRGAS 2000 e WGS84.",
      "Preservação de Atributos: Todos os dados técnicos são mantidos.",
      "Interoperabilidade: Compatível com QGIS, ArcGIS, AutoCAD, Google Earth."
    ],
    benefits: ["Interoperabilidade total", "Compatibilidade universal", "Flexibilidade de dados", "Padronização e qualidade"],
    color: "from-fuchsia-500 to-fuchsia-600"
  },
  {
    icon: Eye,
    title: "Mapa de Progresso RDO",
    overview: "Visualização georreferenciada do progresso da obra com dados integrados do RDO Digital.",
    features: [
      "Progresso por Trecho: Visualização do avanço físico no mapa.",
      "Dados do RDO Integrados: Informações atualizadas automaticamente.",
      "Status em Tempo Real: Acompanhamento do andamento da obra.",
      "Relatórios Automáticos: Geração de relatórios de progresso."
    ],
    benefits: ["Acompanhamento visual", "Gestão de campo eficiente", "Relatórios automáticos", "Decisões baseadas em dados"],
    color: "from-cyan-600 to-cyan-700"
  },
  {
    icon: TrendingUp,
    title: "RDO × Planejamento",
    overview: "Integração entre RDO e Planejamento com Curva S comparativa, planejado vs. executado e alertas de atraso.",
    features: [
      "Curva S Comparativa: Planejado vs. Executado visual.",
      "Alertas de Atraso: Notificações automáticas de desvios.",
      "Dashboards Integrados: Visão unificada de RDO e planejamento.",
      "Ações Corretivas: Ferramentas para correção de rumo."
    ],
    benefits: ["Controle total de prazo", "Ações corretivas rápidas", "Visão unificada", "Gestão proativa"],
    color: "from-amber-600 to-orange-600"
  },
  {
    icon: BarChart3,
    title: "Dashboard 360°",
    overview: "Dashboard consolidado com KPIs de produção, materiais, equipes e indicadores financeiros em tempo real.",
    features: [
      "KPIs em Tempo Real: Indicadores atualizados automaticamente.",
      "Produção e Materiais: Controle integrado.",
      "Indicadores Financeiros: Custos, orçamento e desvios.",
      "Filtros Dinâmicos: Personalização da visualização."
    ],
    benefits: ["Visão executiva", "Decisão baseada em dados", "Monitoramento contínuo", "Gestão integrada"],
    color: "from-indigo-600 to-violet-600"
  },
  {
    icon: Package,
    title: "Materiais & Almoxarifado",
    overview: "Controle completo de materiais com importação de planilhas, histórico de preços, gestão de estoque e alertas de falta.",
    features: [
      "Importação de Planilhas: Excel, CSV e outros formatos.",
      "Histórico de Preços: Acompanhamento de variação ao longo do tempo.",
      "Gestão de Estoque: Entrada, saída e saldo por obra.",
      "Alertas de Falta: Notificações automáticas de estoque baixo."
    ],
    benefits: ["Controle de custos", "Zero desperdício", "Rastreabilidade total", "Gestão eficiente"],
    color: "from-stone-500 to-stone-600"
  },
  {
    icon: Users,
    title: "Gestão de Equipes",
    overview: "Cadastro de funcionários, alocação por frente de serviço e controle de produtividade com importação Excel.",
    features: [
      "Cadastro Completo: Dados de funcionários e empresas terceirizadas.",
      "Alocação por Frente: Distribuição de equipes por frente de serviço.",
      "Controle de Produtividade: Métricas de desempenho por equipe.",
      "Importação Excel: Cadastro em massa via planilha."
    ],
    benefits: ["Gestão eficiente de pessoal", "Controle de mão de obra", "Relatórios detalhados", "Alocação otimizada"],
    color: "from-blue-400 to-blue-500"
  },
  {
    icon: Bell,
    title: "Alertas Inteligentes",
    overview: "Notificações automáticas por condições configuráveis: produção baixa, estoque em falta, manutenção e clima adverso.",
    features: [
      "Configuração por Regras: Defina condições personalizadas.",
      "Notificações Automáticas: Alertas em tempo real.",
      "Multi-destinatário: Envio para múltiplos responsáveis.",
      "Histórico de Alertas: Registro completo de notificações."
    ],
    benefits: ["Ação proativa", "Zero surpresas", "Controle total", "Prevenção de problemas"],
    color: "from-red-500 to-red-600"
  },
  {
    icon: QrCode,
    title: "QR Codes de Manutenção",
    overview: "QR Codes para ativos com formulário web de abertura de chamados e rastreamento completo.",
    features: [
      "Geração de QR Codes: Para cada ativo ou local.",
      "Formulário Web: Abertura de chamados por escaneamento.",
      "Rastreamento de Chamados: Acompanhamento de status.",
      "Sem App Necessário: Funciona direto no navegador."
    ],
    benefits: ["Manutenção ágil", "Rastreabilidade total", "Facilidade de uso", "Sem instalação"],
    color: "from-gray-500 to-gray-600"
  },
  {
    icon: Building2,
    title: "Gestão Predial",
    overview: "Manutenção de edificações com kanban de tarefas, relatórios de consumo, dashboards de performance e catálogo de ativos.",
    features: [
      "Kanban de Tarefas: Gestão visual de manutenção.",
      "Relatórios de Consumo: Água, energia e recursos.",
      "Dashboard de Performance: KPIs de manutenção.",
      "Catálogo de Ativos: Inventário completo de equipamentos."
    ],
    benefits: ["Organização total", "Manutenção preventiva", "Controle de custos", "Gestão eficiente"],
    color: "from-emerald-600 to-emerald-700"
  },
  {
    icon: Briefcase,
    title: "CRM Completo",
    overview: "Gestão de clientes, contatos, pipeline de negócios e atividades comerciais com calendário e relatórios.",
    features: [
      "Pipeline Visual: Funil de vendas com etapas configuráveis.",
      "Gestão de Contatos: Cadastro completo com histórico.",
      "Atividades e Calendário: Tarefas, reuniões e follow-ups.",
      "Relatórios Comerciais: Análise de conversão e receita."
    ],
    benefits: ["Vendas organizadas", "Follow-up eficiente", "Visão completa do funil", "Decisões comerciais"],
    color: "from-pink-600 to-rose-600"
  },
  {
    icon: UserCheck,
    title: "RH & Escalas CLT",
    overview: "Escalas de trabalho conformes CLT, controle de férias, faltas e custo primo com alertas trabalhistas.",
    features: [
      "Escalas CLT Automáticas: Conformidade com legislação trabalhista.",
      "Controle de Férias/Faltas: Gestão completa de ausências.",
      "Custo Primo: Dashboard de custos de pessoal.",
      "Alertas Trabalhistas: Notificações de irregularidades."
    ],
    benefits: ["Conformidade CLT", "Controle de custos de pessoal", "Gestão eficiente", "Prevenção de passivos"],
    color: "from-lime-500 to-lime-600"
  },
  {
    icon: Archive,
    title: "Backup & Exportação",
    overview: "Exportação completa de dados em múltiplos formatos e backup automático com agendamento.",
    features: [
      "Exportação Multi-formato: Excel, CSV, JSON e mais.",
      "Backup Automático: Programação de backups periódicos.",
      "Agendamento: Defina frequência e horário.",
      "Multi-tabela: Exporte todas as tabelas de uma vez."
    ],
    benefits: ["Segurança de dados", "Portabilidade total", "Tranquilidade", "Recuperação rápida"],
    color: "from-gray-600 to-gray-700"
  }
];

const Support = () => {
  const { toast } = useToast();
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("construdata.contato@gmail.com");
    toast({
      title: "Email copiado!",
      description: "O endereço de email foi copiado para a área de transferência.",
    });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1">
          <div className="flex items-center gap-2 border-b px-4 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold font-mono">Suporte & Documentação</h1>
          </div>

          <main className="flex-1 p-6">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Contact Section */}
              <div className="grid sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Mail className="h-5 w-5 text-primary" />
                      Email de Suporte
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold mb-3">construdata.contato@gmail.com</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCopyEmail} variant="outline">
                        <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
                      </Button>
                      <Button size="sm" asChild>
                        <a href="mailto:construdata.contato@gmail.com">
                          <Mail className="h-3.5 w-3.5 mr-1.5" /> Enviar Email
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Linkedin className="h-5 w-5 text-primary" />
                      LinkedIn
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">Acompanhe novidades e entre em contato pelo LinkedIn.</p>
                    <Button size="sm" asChild>
                      <a href="https://www.linkedin.com/company/construdatasoftware" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Acessar LinkedIn
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Modules Documentation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-primary" />
                    Documentação Detalhada dos Módulos
                  </CardTitle>
                  <CardDescription>
                    Explicação completa de cada módulo e funcionalidade do HydroNetwork. Clique para expandir.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {modules.map((mod, i) => (
                      <AccordionItem key={i} value={`module-${i}`}>
                        <AccordionTrigger className="text-left hover:no-underline">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-none bg-gradient-to-br ${mod.color} flex items-center justify-center flex-shrink-0`}>
                              <mod.icon className="w-4.5 h-4.5 text-white" />
                            </div>
                            <span className="font-bold text-sm">{mod.title}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pl-12 space-y-4">
                            <div>
                              <h4 className="font-semibold text-sm mb-1">Visão Geral</h4>
                              <p className="text-sm text-muted-foreground">{mod.overview}</p>
                            </div>

                            <div>
                              <h4 className="font-semibold text-sm mb-2">Funcionalidades Principais</h4>
                              <ul className="space-y-1.5">
                                {mod.features.map((f, j) => (
                                  <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <ChevronRight className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                                    {f}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div>
                              <h4 className="font-semibold text-sm mb-2">Benefícios</h4>
                              <div className="flex flex-wrap gap-2">
                                {mod.benefits.map((b, j) => (
                                  <span key={j} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-xs font-medium text-primary">
                                    <Check className="w-3 h-3" /> {b}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Support;
