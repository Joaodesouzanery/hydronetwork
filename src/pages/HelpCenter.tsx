import { useState, useMemo } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from "@/components/ui/accordion";
import {
  Mail, Linkedin, ExternalLink, Search, BookOpen, HelpCircle, Lightbulb,
  Upload, GitBranch, Droplets, CloudRain, FileSpreadsheet, Calculator,
  Calendar, Beaker, Zap, Waves, Layers, FileText, Map, Shield,
  ClipboardList, Activity, MapPin, Globe, Eye, TrendingUp, BarChart3,
  Package, Users, Bell, QrCode, Building2, Briefcase, UserCheck, Archive,
  Copy, Check, ChevronRight, DollarSign
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ═══════════ TUTORIAL DATA ═══════════
const tutorials = [
  {
    icon: Upload, title: "Topografia Inteligente", level: "básico", category: "Redes",
    overview: "Processamento automático de dados topográficos com suporte a CSV, TXT, XLSX, DXF, SHP, GeoJSON e LandXML.",
    steps: [
      { title: "Importar dados", description: "Acesse o módulo Topografia e clique em 'Importar Arquivo'. Selecione seu arquivo (CSV, DXF, SHP, etc.). O sistema detecta automaticamente as colunas X, Y, Z." },
      { title: "Processar pontos", description: "Após importar, clique em 'Processar Pontos'. O sistema gera automaticamente os trechos com base nas coordenadas e elevações." },
      { title: "Analisar relevo", description: "Use a aba 'Análise de Relevo' para ver declividades, perfis de terreno e identificar pontos críticos para o traçado da rede." },
      { title: "Visualizar no mapa", description: "Os pontos importados aparecem no Mapa Interativo. Clique em qualquer ponto para ver seus dados topográficos." },
    ],
    features: ["Importação multi-formato (CSV, TXT, XLSX, DXF, SHP, GeoJSON, LandXML)", "Processamento automático de coordenadas X, Y, Z", "Geração instantânea de trechos", "Análise de relevo com declividades e perfis"],
    benefits: ["Redução de tempo de horas para minutos", "Minimização de erros de digitação", "Decisões de projeto mais acertadas", "Compatibilidade total de formatos"],
    tips: ["Dica: Use arquivos CSV com separador ';' para melhor compatibilidade", "Dica: O sistema aceita coordenadas em UTM ou geográficas"],
    color: "from-blue-500 to-blue-600"
  },
  {
    icon: GitBranch, title: "Rede de Esgoto", level: "intermediário", category: "Redes",
    overview: "Dimensionamento de redes de esgoto por gravidade e elevatória com verificação normativa ABNT automática.",
    steps: [
      { title: "Carregar topografia", description: "Certifique-se de que os dados topográficos já foram importados. O módulo de esgoto utiliza as cotas de terreno para calcular declividades." },
      { title: "Definir parâmetros", description: "Configure a população, vazão per capita, coeficientes de retorno e infiltração na aba de parâmetros do projeto." },
      { title: "Dimensionar rede", description: "Clique em 'Dimensionar' para calcular automaticamente diâmetros, declividades e profundidades conforme NBR 9649." },
      { title: "Verificar resultados", description: "A aba 'Resultados' mostra todos os parâmetros por trecho. Itens fora da norma são destacados em vermelho." },
    ],
    features: ["Dimensionamento por gravidade com NBR 9649", "Cálculo de estações elevatórias", "Verificação automática ABNT", "Tensão trativa e velocidade por trecho"],
    benefits: ["Projetos em conformidade normativa", "Dimensionamento otimizado", "Agilidade no cálculo"],
    tips: ["Dica: Use o Peer Review para uma verificação adicional do projeto", "Dica: Exporte os resultados para DXF para uso no AutoCAD"],
    color: "from-purple-500 to-purple-600"
  },
  {
    icon: Droplets, title: "Rede de Água", level: "intermediário", category: "Redes",
    overview: "Projeto de redes de distribuição de água pressurizadas com cálculo de pressão, velocidade e perdas de carga.",
    steps: [
      { title: "Definir traçado", description: "Use o Mapa Interativo para definir o traçado da rede ou importe de dados topográficos." },
      { title: "Configurar demandas", description: "Informe as vazões de demanda em cada nó consumidor e as pressões mínimas requeridas." },
      { title: "Selecionar materiais", description: "Escolha os materiais das tubulações (PVC, PEAD, ferro fundido) e os diâmetros disponíveis." },
      { title: "Simular no EPANET", description: "Use o módulo EPANET PRO para simular o comportamento hidráulico completo da rede." },
    ],
    features: ["Cálculo de pressão por Hazen-Williams", "Análise de perdas de carga", "Verificação de velocidades limites", "Integração com EPANET PRO"],
    benefits: ["Projetos seguros e eficientes", "Otimização hidráulica", "Conformidade normativa NBR 12211/12218"],
    tips: ["Dica: Combine com o EPANET PRO para simulação hidráulica completa"],
    color: "from-cyan-500 to-cyan-600"
  },
  {
    icon: CloudRain, title: "Drenagem Pluvial", level: "intermediário", category: "Redes",
    overview: "Dimensionamento de galerias e estruturas de drenagem urbana pelo método racional.",
    steps: [
      { title: "Definir bacia", description: "Delimite a bacia de contribuição e informe as áreas, coeficientes de escoamento e tempos de concentração." },
      { title: "Configurar chuva", description: "Selecione a equação IDF da sua região ou informe manualmente a intensidade pluviométrica." },
      { title: "Dimensionar galerias", description: "O sistema calcula as vazões por trecho e dimensiona as galerias conforme as normas locais." },
      { title: "Simular cenários", description: "Teste diferentes tempos de recorrência (5, 10, 25, 50 anos) para avaliar a resiliência do sistema." },
    ],
    features: ["Método racional para cálculo de vazões", "Dimensionamento automático de galerias", "Múltiplos cenários de chuva", "Conformidade com NBR 10844"],
    benefits: ["Prevenção de inundações", "Projetos sustentáveis", "Otimização de custos"],
    tips: ["Dica: Use o módulo SWMM para análise mais detalhada de drenagem"],
    color: "from-green-500 to-green-600"
  },
  {
    icon: Beaker, title: "Simulação EPANET", level: "básico", category: "Simulação",
    overview: "Motor EPANET integrado para simulação hidráulica com exportação de arquivos .INP.",
    steps: [
      { title: "Preparar rede", description: "Certifique-se de que a rede de água está dimensionada com nós, trechos e demandas definidas." },
      { title: "Configurar cenário", description: "Defina as condições de contorno: reservatórios, bombas, válvulas e padrões de consumo." },
      { title: "Executar simulação", description: "Clique em 'Simular' para rodar o motor EPANET. Os resultados aparecem em segundos." },
      { title: "Analisar resultados", description: "Visualize pressões nos nós e velocidades nos trechos. Use o mapa de cores para identificar problemas." },
    ],
    features: ["Motor EPANET nativo via WebAssembly", "Import/export de arquivos .INP", "Visualização de pressão e velocidade", "Simulação em tempo real no navegador"],
    benefits: ["Análise precisa sem instalar software", "Performance máxima via WebAssembly", "Compatibilidade com EPANET standalone"],
    tips: ["Dica: Exporte o arquivo .INP para usar em outras ferramentas EPANET", "Dica: O EPANET PRO oferece recursos avançados de visualização"],
    color: "from-sky-500 to-sky-600"
  },
  {
    icon: Calculator, title: "Orçamento SINAPI/SICRO", level: "básico", category: "Orçamento",
    overview: "Orçamentação automatizada com composições SINAPI/SICRO e visualização de custos no mapa interativo.",
    steps: [
      { title: "Gerar quantitativos", description: "Execute o módulo de Quantitativos primeiro para ter os volumes e metragens de cada trecho." },
      { title: "Selecionar composições", description: "O sistema sugere composições SINAPI/SICRO para cada serviço. Você pode ajustar conforme necessário." },
      { title: "Calcular BDI", description: "Use o módulo BDI (TCU) para calcular as Bonificações e Despesas Indiretas do orçamento." },
      { title: "Visualizar no mapa", description: "Os custos por trecho são exibidos no Mapa Interativo com codificação por cores (verde = barato, vermelho = caro)." },
    ],
    features: ["Composições SINAPI/SICRO automatizadas", "Custo por trecho no mapa", "BDI conforme TCU", "Relatórios personalizáveis"],
    benefits: ["Orçamentos precisos e rápidos", "Conformidade com tabelas oficiais", "Transparência de custos"],
    tips: ["Dica: Atualize as tabelas SINAPI/SICRO regularmente para preços corretos"],
    color: "from-emerald-500 to-emerald-600"
  },
  {
    icon: Calendar, title: "Planejamento de Obra", level: "avançado", category: "Gestão",
    overview: "Cronograma com Gantt interativo, Curva S automática, EVM e caminho crítico.",
    steps: [
      { title: "Criar atividades", description: "Defina as atividades do cronograma com durações, dependências e recursos necessários." },
      { title: "Configurar Gantt", description: "Use o Gantt interativo para visualizar e ajustar o cronograma. Arraste e solte para reorganizar." },
      { title: "Acompanhar Curva S", description: "A Curva S mostra o avanço planejado vs. executado. Use para identificar desvios." },
      { title: "Monitorar EVM", description: "O EVM fornece IDC e IDP para avaliar o desempenho de custo e prazo do projeto." },
    ],
    features: ["Gantt interativo drag-and-drop", "Curva S automática", "EVM com IDC e IDP", "Caminho crítico identificado"],
    benefits: ["Controle total de prazos", "Detecção precoce de desvios", "Otimização de recursos"],
    tips: ["Dica: Integre com o RDO para atualização automática do avanço físico"],
    color: "from-pink-500 to-pink-600"
  },
  {
    icon: ClipboardList, title: "RDO Digital", level: "básico", category: "Execução",
    overview: "Relatório Diário de Obra especializado para saneamento com fotos, GPS e clima.",
    steps: [
      { title: "Selecionar projeto", description: "Escolha o projeto e a frente de serviço para o RDO do dia." },
      { title: "Registrar produção", description: "Informe a quantidade executada de cada serviço, com a equipe responsável e observações." },
      { title: "Adicionar fotos", description: "Anexe fotos georreferenciadas do avanço do dia. O GPS é capturado automaticamente." },
      { title: "Registrar clima", description: "O sistema busca dados climáticos automaticamente. Adicione observações sobre condições do terreno." },
      { title: "Exportar PDF", description: "Gere o RDO em PDF completo para enviar ao cliente ou arquivar." },
    ],
    features: ["RDO por trecho da rede", "Fotos com GPS automático", "Clima automático", "Exportação PDF"],
    benefits: ["Controle em tempo real", "Documentação completa", "Eliminação de papel"],
    tips: ["Dica: Use o Mapa de Progresso RDO para visualizar o avanço no mapa"],
    color: "from-rose-500 to-rose-600"
  },
];

// ═══════════ FAQ DATA ═══════════
const faqItems = [
  { q: "Preciso instalar alguma coisa?", a: "Não! O HydroNetwork é 100% online. Basta acessar pelo navegador (Chrome, Firefox, Edge) em qualquer dispositivo.", category: "Geral" },
  { q: "Funciona para esgoto, água E drenagem?", a: "Sim! O HydroNetwork possui módulos dedicados para Rede de Esgoto, Rede de Água e Drenagem Pluvial, cada um com dimensionamento e verificação normativa específicos.", category: "Funcionalidade" },
  { q: "Posso exportar para o QGIS e AutoCAD?", a: "Sim! Exportamos em Shapefile, GeoJSON, GeoPackage, KML/KMZ e DXF (AutoCAD). Todos com atributos hidráulicos completos.", category: "Exportação" },
  { q: "Quanto custa?", a: "O HydroNetwork é 100% gratuito no Plano DEMO. Todos os módulos estão disponíveis sem custo.", category: "Geral" },
  { q: "E se eu já tenho dados em planilha?", a: "Perfeito! Importamos CSV, TXT, XLSX, DXF, SHP, GeoJSON e LandXML. Seus dados existentes são aproveitados integralmente.", category: "Importação" },
  { q: "Como funciona o suporte?", a: "Oferecemos suporte via email (construdata.contato@gmail.com) e LinkedIn. Além disso, a Central de Ajuda possui tutoriais detalhados para cada módulo.", category: "Suporte" },
  { q: "Meus dados estão seguros?", a: "Sim! Utilizamos criptografia de ponta e backup contínuo. Seus projetos são protegidos com as mais altas práticas de segurança.", category: "Segurança" },
  { q: "Posso colaborar com minha equipe?", a: "Sim! O sistema suporta múltiplos usuários com controle de acesso por projeto. Cada membro pode ter permissões específicas.", category: "Funcionalidade" },
  { q: "O EPANET roda no navegador mesmo?", a: "Sim! Utilizamos WebAssembly (epanet-js) para rodar o motor EPANET diretamente no navegador, com performance nativa e sem instalação.", category: "Funcionalidade" },
  { q: "Como importar dados topográficos?", a: "Acesse o módulo Topografia, clique em 'Importar', e selecione seu arquivo. Aceitamos CSV, DXF, SHP, GeoJSON, LandXML e mais. O sistema detecta colunas automaticamente.", category: "Importação" },
  { q: "Posso usar o sistema no celular?", a: "Sim! O HydroNetwork é responsivo e funciona em desktop, tablet e celular. Ideal para uso em campo com o RDO Digital.", category: "Geral" },
  { q: "Como exportar um relatório em PDF?", a: "Em cada módulo que gera relatórios, procure o botão 'Exportar PDF'. O RDO, orçamentos e relatórios de produção podem ser exportados individualmente.", category: "Exportação" },
];

const categories = ["Todos", "Geral", "Funcionalidade", "Importação", "Exportação", "Suporte", "Segurança"];
const levels = ["Todos", "básico", "intermediário", "avançado"];
const moduleCategories = ["Todos", "Redes", "Simulação", "Orçamento", "Gestão", "Execução"];

const HelpCenter = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [faqCategory, setFaqCategory] = useState("Todos");
  const [tutorialLevel, setTutorialLevel] = useState("Todos");
  const [tutorialCategory, setTutorialCategory] = useState("Todos");
  const [activeTab, setActiveTab] = useState<"tutorials" | "faq">("tutorials");

  const filteredTutorials = useMemo(() => {
    return tutorials.filter(t => {
      const matchSearch = !searchQuery || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.overview.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.steps.some(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchLevel = tutorialLevel === "Todos" || t.level === tutorialLevel;
      const matchCategory = tutorialCategory === "Todos" || t.category === tutorialCategory;
      return matchSearch && matchLevel && matchCategory;
    });
  }, [searchQuery, tutorialLevel, tutorialCategory]);

  const filteredFAQ = useMemo(() => {
    return faqItems.filter(f => {
      const matchSearch = !searchQuery ||
        f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.a.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = faqCategory === "Todos" || f.category === faqCategory;
      return matchSearch && matchCategory;
    });
  }, [searchQuery, faqCategory]);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("construdata.contato@gmail.com");
    toast({ title: "Email copiado!", description: "construdata.contato@gmail.com" });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1">
          <div className="flex items-center gap-2 border-b px-4 py-3 bg-background/95 backdrop-blur sticky top-0 z-10">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold font-mono">Central de Ajuda</h1>
          </div>

          <main className="flex-1 p-6">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar tutoriais, FAQ, módulos..."
                  className="pl-10 h-12 text-base"
                />
              </div>

              {/* Support buttons */}
              <div className="grid sm:grid-cols-2 gap-4">
                <Card className="border-primary/20">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-none bg-primary/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Email de Suporte</p>
                      <p className="text-xs text-muted-foreground">construdata.contato@gmail.com</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="ghost" onClick={handleCopyEmail}><Copy className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" asChild><a href="mailto:construdata.contato@gmail.com"><Mail className="w-3.5 h-3.5" /></a></Button>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-primary/20">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-none bg-primary/10 flex items-center justify-center">
                      <Linkedin className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">LinkedIn</p>
                      <p className="text-xs text-muted-foreground">construdatasoftware</p>
                    </div>
                    <Button size="sm" asChild>
                      <a href="https://www.linkedin.com/company/construdatasoftware" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-2">
                <Button
                  variant={activeTab === "tutorials" ? "default" : "outline"}
                  onClick={() => setActiveTab("tutorials")}
                  size="sm"
                >
                  <BookOpen className="w-4 h-4 mr-1.5" /> Tutoriais & Guias
                </Button>
                <Button
                  variant={activeTab === "faq" ? "default" : "outline"}
                  onClick={() => setActiveTab("faq")}
                  size="sm"
                >
                  <HelpCircle className="w-4 h-4 mr-1.5" /> FAQ
                </Button>
              </div>

              {/* ═══════════ TUTORIALS TAB ═══════════ */}
              {activeTab === "tutorials" && (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="flex flex-wrap gap-2">
                    <div className="flex gap-1 items-center">
                      <span className="text-xs font-medium text-muted-foreground mr-1">Nível:</span>
                      {levels.map(l => (
                        <Button key={l} size="sm" variant={tutorialLevel === l ? "default" : "ghost"} className="h-7 text-xs" onClick={() => setTutorialLevel(l)}>
                          {l === "Todos" ? l : l.charAt(0).toUpperCase() + l.slice(1)}
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-1 items-center">
                      <span className="text-xs font-medium text-muted-foreground mr-1">Categoria:</span>
                      {moduleCategories.map(c => (
                        <Button key={c} size="sm" variant={tutorialCategory === c ? "default" : "ghost"} className="h-7 text-xs" onClick={() => setTutorialCategory(c)}>
                          {c}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {filteredTutorials.length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum tutorial encontrado para os filtros selecionados.</CardContent></Card>
                  ) : (
                    <Accordion type="single" collapsible className="space-y-2">
                      {filteredTutorials.map((t, i) => (
                        <AccordionItem key={i} value={`tutorial-${i}`} className="border rounded-none px-4">
                          <AccordionTrigger className="hover:no-underline py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-none bg-gradient-to-br ${t.color} flex items-center justify-center flex-shrink-0`}>
                                <t.icon className="w-4.5 h-4.5 text-white" />
                              </div>
                              <div className="text-left">
                                <span className="font-bold text-sm block">{t.title}</span>
                                <span className="text-xs text-muted-foreground">{t.overview.slice(0, 80)}...</span>
                              </div>
                              <div className="flex gap-1.5 ml-auto mr-4">
                                <Badge variant="outline" className="text-[10px]">{t.level}</Badge>
                                <Badge variant="secondary" className="text-[10px]">{t.category}</Badge>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-6">
                            <div className="pl-12 space-y-5">
                              <p className="text-sm text-muted-foreground">{t.overview}</p>

                              {/* Step by step */}
                              <div>
                                <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                                  <BookOpen className="w-4 h-4 text-primary" /> Guia Passo a Passo
                                </h4>
                                <div className="space-y-3">
                                  {t.steps.map((s, j) => (
                                    <div key={j} className="flex gap-3">
                                      <div className="w-7 h-7 bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                        {j + 1}
                                      </div>
                                      <div>
                                        <p className="font-semibold text-sm">{s.title}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Features */}
                              <div>
                                <h4 className="font-bold text-sm mb-2">Funcionalidades</h4>
                                <ul className="space-y-1">
                                  {t.features.map((f, j) => (
                                    <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                                      <ChevronRight className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" /> {f}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Benefits */}
                              <div>
                                <h4 className="font-bold text-sm mb-2">Benefícios</h4>
                                <div className="flex flex-wrap gap-2">
                                  {t.benefits.map((b, j) => (
                                    <span key={j} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-xs font-medium text-primary">
                                      <Check className="w-3 h-3" /> {b}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Tips */}
                              {t.tips && t.tips.length > 0 && (
                                <div className="p-3 rounded-none bg-amber-500/10 border border-amber-500/20">
                                  <h4 className="font-bold text-sm mb-1 flex items-center gap-1.5 text-amber-600">
                                    <Lightbulb className="w-4 h-4" /> Dicas
                                  </h4>
                                  {t.tips.map((tip, j) => (
                                    <p key={j} className="text-xs text-muted-foreground">{tip}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </div>
              )}

              {/* ═══════════ FAQ TAB ═══════════ */}
              {activeTab === "faq" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-1">
                    {categories.map(c => (
                      <Button key={c} size="sm" variant={faqCategory === c ? "default" : "ghost"} className="h-7 text-xs" onClick={() => setFaqCategory(c)}>
                        {c}
                      </Button>
                    ))}
                  </div>

                  {filteredFAQ.length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma pergunta encontrada.</CardContent></Card>
                  ) : (
                    <Accordion type="single" collapsible className="space-y-2">
                      {filteredFAQ.map((f, i) => (
                        <AccordionItem key={i} value={`faq-${i}`} className="border rounded-none px-4">
                          <AccordionTrigger className="hover:no-underline text-left text-sm font-medium">
                            {f.q}
                          </AccordionTrigger>
                          <AccordionContent>
                            <p className="text-sm text-muted-foreground">{f.a}</p>
                            <Badge variant="outline" className="mt-2 text-[10px]">{f.category}</Badge>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default HelpCenter;
