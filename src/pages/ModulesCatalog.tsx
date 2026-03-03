import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/Logo";
import {
  FolderOpen, FileText, TrendingUp, Users, Package, ClipboardList, DollarSign,
  BarChart3, Bell, QrCode, Wrench, Camera, Briefcase, UserCheck, MapPin,
  CheckSquare, Truck, Archive, Map, Clock, Zap, Building2, ArrowLeft,
  ChevronRight, Target, ArrowRight, Droplets
} from "lucide-react";

const modules = [
  {
    category: "Controle de Obra",
    color: "from-blue-500 to-blue-600",
    items: [
      { icon: FolderOpen, title: "Gestão de Projetos", desc: "Múltiplos projetos com cronogramas, orçamentos e equipes centralizados.", route: "/projects" },
      { icon: FileText, title: "RDO Digital", desc: "Relatório Diário de Obra completo com fotos, GPS, clima e validação automática.", route: "/rdo-new" },
      { icon: TrendingUp, title: "Controle de Produção", desc: "Metas planejado x realizado, taxa de conclusão e gráficos comparativos.", route: "/production-control" },
      { icon: BarChart3, title: "Dashboard 360°", desc: "Visão completa de todas as operações: custos, produtividade, alertas e KPIs.", route: "/dashboard" },
      { icon: MapPin, title: "Ocorrências", desc: "Registro, acompanhamento e resolução de problemas em obra.", route: "/occurrences" },
      { icon: Map, title: "Mapa Interativo", desc: "Visualize obras no mapa com geolocalização e status.", route: "/interactive-map" },
    ],
  },
  {
    category: "Materiais & Estoque",
    color: "from-orange-500 to-orange-600",
    items: [
      { icon: Package, title: "Catálogo de Materiais", desc: "Materiais com preços, histórico e palavras-chave para busca inteligente.", route: "/materials" },
      { icon: Archive, title: "Controle de Estoque", desc: "Entrada, saída e saldo por obra. Alertas de estoque baixo automáticos.", route: "/inventory" },
      { icon: ClipboardList, title: "Pedidos de Material", desc: "Solicitações com fluxo de aprovação: Pendente → Aprovado → Entregue.", route: "/material-requests" },
      { icon: Truck, title: "Controle de Consumo", desc: "Uso de materiais por frente de serviço com análise por período.", route: "/material-control" },
      { icon: DollarSign, title: "Orçamentos", desc: "Orçamentos completos com BDI, mão de obra e materiais integrados.", route: "/budgets" },
    ],
  },
  {
    category: "CRM & Vendas",
    color: "from-purple-500 to-purple-600",
    items: [
      { icon: Briefcase, title: "CRM Completo", desc: "Gestão de contas, contatos, atividades e histórico de interações.", route: "/crm" },
      { icon: Target, title: "Pipeline de Vendas", desc: "Funil de vendas com etapas configuráveis, probabilidade e valor estimado.", route: "/crm" },
      { icon: DollarSign, title: "Precificação Privada", desc: "Análise de custos via PDF com extração inteligente de preços.", route: "/prices" },
    ],
  },
  {
    category: "RH & Equipes",
    color: "from-teal-500 to-teal-600",
    items: [
      { icon: Users, title: "Gestão de Equipes", desc: "Funcionários, empresas terceirizadas e alocação por projeto.", route: "/employees" },
      { icon: UserCheck, title: "RH ConstruData", desc: "Escalas CLT automatizadas, dashboard Prime Cost e gestão de faltas.", route: "/rh-construdata" },
      { icon: Clock, title: "Apontamento de Horas", desc: "Controle de jornada com cálculo automático de horas extras e noturnas.", route: "/labor-tracking" },
    ],
  },
  {
    category: "Manutenção & Ativos",
    color: "from-rose-500 to-rose-600",
    items: [
      { icon: Wrench, title: "Manutenção Predial", desc: "Solicitações de manutenção com fluxo de atendimento e histórico.", route: "/maintenance-tasks" },
      { icon: QrCode, title: "QR Codes", desc: "Gere QR Codes para ativos e locais. Escaneie para reportar problemas.", route: "/maintenance-qrcodes" },
      { icon: Building2, title: "Catálogo de Ativos", desc: "Inventário de equipamentos com localização, responsável e notas técnicas.", route: "/assets-catalog" },
      { icon: Zap, title: "Consumo", desc: "Controle de água, energia e recursos com leituras e gráficos.", route: "/consumption-control" },
    ],
  },
  {
    category: "Documentação & Campo",
    color: "from-indigo-500 to-indigo-600",
    items: [
      { icon: Camera, title: "Registro Multimídia", desc: "Fotos e vídeos organizados por obra, data e frente de serviço.", route: "/rdo-photos" },
      { icon: CheckSquare, title: "Checklists", desc: "Listas de verificação por projeto com responsáveis e status.", route: "/checklists" },
      { icon: Bell, title: "Alertas Inteligentes", desc: "Notificações automáticas de desvios: produção baixa, estoque, clima adverso.", route: "/alerts" },
      { icon: FileText, title: "Relatórios de Ligação", desc: "Documentação de campo para ligações de água e esgoto com fotos.", route: "/connection-reports" },
    ],
  },
];

const ModulesCatalog = () => {
  const navigate = useNavigate();
  const totalModules = modules.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <span className="text-xs sm:text-sm font-bold text-secondary hidden sm:inline">| Obras</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <Button size="sm" onClick={() => navigate('/auth?tab=signup')} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              Começar Grátis
            </Button>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-28 pb-16 bg-background">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/15 border border-secondary/25 text-sm font-bold text-secondary mb-6">
            <Building2 className="w-4 h-4" />
            Plataforma Separada
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-mono mb-4">
            CONSTRUDATA — <span className="text-secondary">Obras</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            {totalModules} módulos de gestão operacional para obras civis. 
            Plataforma independente do HydroNetwork.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/auth?tab=signup')} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              Teste Grátis — 30 Dias <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              <Droplets className="w-4 h-4 mr-2" /> Ver HydroNetwork
            </Button>
          </div>
        </div>
      </section>

      {/* Modules by Category */}
      <section className="py-12">
        <div className="container mx-auto px-4 space-y-16">
          {modules.map((cat, ci) => (
            <div key={ci}>
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-1.5 h-8 bg-gradient-to-b ${cat.color}`} />
                <h2 className="text-2xl font-black font-mono">{cat.category}</h2>
                <span className="text-sm text-muted-foreground">({cat.items.length} módulos)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cat.items.map((m, i) => (
                  <div
                    key={i}
                    onClick={() => navigate(m.route)}
                    className="p-5 border border-border bg-card hover:border-foreground/20 hover:border-secondary/30 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-11 h-11 rounded-none bg-gradient-to-br ${cat.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                        <m.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
                          {m.title}
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-secondary text-secondary-foreground">
        <div className="container mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-black font-mono">
            {totalModules} módulos. Uma plataforma. Sem limite de usuários.
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-secondary hover:bg-white/90 text-lg px-8 py-6" onClick={() => navigate('/auth?tab=signup')}>
              Começar Teste Grátis <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-lg px-8 py-6 bg-transparent" asChild>
              <a href="https://calendly.com/joaodsouzanery/apresentacao-personalrh" target="_blank" rel="noopener noreferrer">
                Agendar Demonstração
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} CONSTRUDATA. Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default ModulesCatalog;
