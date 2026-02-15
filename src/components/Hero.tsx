import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  Shield, FileText, BarChart3, Users, Package, ClipboardList, QrCode, AlertTriangle, 
  Camera, Settings, TrendingUp, MapPin, Wrench, Building2, Calendar, Bell, FolderOpen,
  Database, FileBarChart, CheckSquare, Truck, DollarSign, Clock, Zap, Map, Archive, Mail,
  ChevronRight, Check, Star, ArrowRight, Briefcase, UserCheck, Target, Droplets
} from "lucide-react";
import { ContactDialog } from "@/components/ContactDialog";
import { FAQ } from "@/components/FAQ";
import { Logo } from "@/components/shared/Logo";

const Hero = () => {
  const navigate = useNavigate();
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [dialogDismissed, setDialogDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContactDialog(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleDialogClose = (open: boolean) => {
    setShowContactDialog(open);
    if (!open) {
      setDialogDismissed(true);
    }
  };

  // Funcionalidades completas do sistema incluindo CRM e RH
  const allFeatures = [
    { icon: FolderOpen, title: "Gestão de Projetos", description: "Múltiplos projetos com cronogramas e orçamentos", color: "from-blue-500 to-blue-600", route: "/features/project-management" },
    { icon: FileText, title: "RDO Digital", description: "Relatório Diário de Obra com fotos, GPS e clima", color: "from-green-500 to-green-600", route: "/features/rdo-digital" },
    { icon: TrendingUp, title: "Controle de Produção", description: "Metas, acompanhamento e comparativos", color: "from-purple-500 to-purple-600", route: "/features/production-control" },
    { icon: Users, title: "Gestão de Equipes", description: "Funcionários, empresas e alocação", color: "from-indigo-500 to-indigo-600", route: "/features/team-management" },
    { icon: Package, title: "Catálogo de Materiais", description: "Materiais com preços e histórico", color: "from-orange-500 to-orange-600", route: "/features/materiais-almoxarifado" },
    { icon: Archive, title: "Controle de Estoque", description: "Entrada, saída e saldo por obra", color: "from-amber-500 to-amber-600", route: "/features/materiais-almoxarifado" },
    { icon: ClipboardList, title: "Pedidos de Material", description: "Solicitações e aprovações", color: "from-teal-500 to-teal-600", route: "/features/material-requests" },
    { icon: DollarSign, title: "Orçamentos", description: "Orçamentos com BDI e mão de obra", color: "from-emerald-500 to-emerald-600", route: "/features/controle-de-obra" },
    { icon: BarChart3, title: "Dashboard 360", description: "Visão completa das operações", color: "from-cyan-500 to-cyan-600", route: "/features/controle-de-obra" },
    { icon: Bell, title: "Alertas Inteligentes", description: "Notificações automáticas", color: "from-red-500 to-red-600", route: "/features/intelligent-alerts" },
    { icon: QrCode, title: "QR Codes", description: "Rastreie ativos e locais", color: "from-violet-500 to-violet-600", route: "/features/qrcode-maintenance" },
    { icon: Wrench, title: "Manutenção Predial", description: "Solicitações e histórico", color: "from-rose-500 to-rose-600", route: "/features/manutencao-predial" },
    { icon: Building2, title: "Catálogo de Ativos", description: "Inventário de equipamentos", color: "from-sky-500 to-sky-600", route: "/features/manutencao-predial" },
    { icon: Camera, title: "Registro Multimídia", description: "Fotos e vídeos organizados", color: "from-pink-500 to-pink-600", route: "/features/multimedia-registry" },
    { icon: CheckSquare, title: "Checklists", description: "Listas de verificação", color: "from-lime-500 to-lime-600", route: "/features/execucao-equipes" },
    { icon: MapPin, title: "Ocorrências", description: "Registro de problemas", color: "from-yellow-500 to-yellow-600", route: "/features/controle-de-obra" },
    { icon: FileBarChart, title: "Relatórios de Ligação", description: "Documentação de campo", color: "from-fuchsia-500 to-fuchsia-600", route: "/features/connection-reports" },
    { icon: Clock, title: "Apontamento de Horas", description: "Controle de jornada", color: "from-slate-500 to-slate-600", route: "/features/execucao-equipes" },
    { icon: Zap, title: "Consumo", description: "Água, energia e recursos", color: "from-amber-600 to-amber-700", route: "/features/manutencao-predial" },
    { icon: Map, title: "Mapa Interativo", description: "Visualize obras no mapa", color: "from-green-600 to-green-700", route: "/features/controle-de-obra" },
    { icon: Truck, title: "Controle de Material", description: "Uso por frente de serviço", color: "from-orange-600 to-orange-700", route: "/features/material-control" },
    { icon: Calendar, title: "Histórico RDO", description: "Consulta e exportação", color: "from-blue-600 to-blue-700", route: "/features/rdo-digital" },
    // NOVOS - CRM e RH
    { icon: Briefcase, title: "CRM ConstruData", description: "Gestão de clientes e oportunidades", color: "from-indigo-600 to-purple-600", route: "/crm" },
    { icon: UserCheck, title: "RH ConstruData", description: "Escala CLT e Prime Cost", color: "from-teal-600 to-cyan-600", route: "/rh-construdata" },
    { icon: Target, title: "Pipeline de Vendas", description: "Acompanhe negociações", color: "from-pink-600 to-rose-600", route: "/crm" },
    { icon: DollarSign, title: "Precificação Privada", description: "Análise de custos por PDF", color: "from-emerald-600 to-green-600", route: "/prices" },
  ];

  const stats = [
    { value: "26+", label: "Módulos Integrados" },
    { value: "100%", label: "Online e Seguro" },
    { value: "∞", label: "Usuários Ilimitados" },
    { value: "24/7", label: "Backup Automático" },
  ];

  const testimonials = [
    { name: "Construtora Alpha", role: "Gerente de Obras", text: "Reduziu nosso tempo de gestão em 60%." },
    { name: "Incorporadora Beta", role: "Diretor de Operações", text: "Finalmente temos visibilidade total." },
    { name: "Engenharia Gamma", role: "Coordenador", text: "Eliminou planilhas e WhatsApp da operação." },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation - Mobile optimized */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border safe-area-inset">
        <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex justify-between items-center">
          <Logo size="md" className="sm:scale-110" />
          <div className="flex gap-1.5 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => navigate('/hydronetwork')}
              className="text-sm sm:text-base px-3 sm:px-4 h-9 sm:h-10 border-blue-500/50 text-blue-600 hover:bg-blue-500/10"
            >
              <Droplets className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">HydroNetwork</span>
              <span className="sm:hidden">Hydro</span>
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/auth')}
              className="text-sm sm:text-base px-3 sm:px-4 h-9 sm:h-10"
            >
              Entrar
            </Button>
            <Button 
              onClick={() => navigate('/auth?tab=signup')} 
              className="bg-gradient-to-r from-primary to-primary/80 text-sm sm:text-base px-3 sm:px-4 h-9 sm:h-10"
            >
              <span className="hidden sm:inline">30 Dias Grátis</span>
              <span className="sm:hidden">Testar</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION - Mobile first */}
      <section className="relative min-h-[85vh] sm:min-h-[90vh] flex items-center justify-center pt-16 sm:pt-20 pb-8 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
        
        {/* Floating Elements - Hidden on small mobile */}
        <div className="hidden sm:block absolute top-1/4 left-10 w-48 md:w-72 h-48 md:h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="hidden sm:block absolute bottom-1/4 right-10 w-64 md:w-96 h-64 md:h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="container mx-auto px-4 sm:px-6 z-10">
          <div className="max-w-5xl mx-auto text-center space-y-5 sm:space-y-6 md:space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 border border-primary/20 text-xs sm:text-sm font-medium text-primary">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>26 módulos integrados</span>
            </div>

            {/* Main Headline - Responsive text sizes */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.1] sm:leading-tight px-2">
              O <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Sistema Operacional</span>
              <br />
              <span className="text-foreground">da Sua Construção e Obra</span>
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed px-2">
              Centralize <span className="text-primary font-semibold">obras, equipes, materiais, CRM e RH</span> em um único lugar — com RDO completo, QR Codes e alertas automáticos.
            </p>

            {/* Value Props - Mobile scroll on very small screens */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 max-w-3xl mx-auto px-2">
              {[
                "Controle de obras",
                "CRM integrado",
                "RH automático",
                "Estoque e materiais"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 sm:gap-2 justify-center text-xs sm:text-sm md:text-base bg-muted/50 rounded-lg py-2 px-2 sm:px-3">
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
                  <span className="truncate">{item}</span>
                </div>
              ))}
            </div>

            {/* CTAs - Stack on mobile */}
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 justify-center pt-2 sm:pt-4 px-4">
              <Button 
                size="lg" 
                className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all bg-gradient-to-r from-primary to-primary/90 w-full sm:w-auto touch-target"
                onClick={() => navigate('/auth?tab=signup')}
              >
                Teste Grátis por 30 Dias
                <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-xl w-full sm:w-auto touch-target"
                onClick={() => navigate('/auth?tab=signup')}
              >
                Ver Demonstração
              </Button>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground">
              Sem cartão de crédito • Acesso completo a 26 módulos
            </p>
          </div>
        </div>
      </section>

      {/* STATS SECTION */}
      <section className="py-12 border-y border-border bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Sua obra atrasa por falta de <span className="text-destructive">VISIBILIDADE</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Sem controle real, tudo vira improviso e adivinhação
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                "Planilhas desatualizadas e dados espalhados",
                "Comunicação perdida no WhatsApp",
                "Equipe sem direção clara",
                "RDO incompleto ou inexistente",
                "Desperdício de materiais não rastreado",
                "Chamados de manutenção que somem",
                "Sem evidências fotográficas",
                "Decisões baseadas em achismo"
              ].map((problem, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/10">
                  <span className="text-destructive text-lg">✕</span>
                  <span className="text-sm md:text-base">{problem}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTION SECTION */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              O <span className="text-primary">ConstruData</span> centraliza tudo
            </h2>
            <p className="text-lg text-muted-foreground mb-12">
              Cada obra, funcionário, material, cliente e tarefa em um painel único — com dados reais e evidências
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                "Todos os dados centralizados em tempo real",
                "CRM completo para gestão de clientes",
                "RH com escalas CLT automatizadas",
                "Controle preciso de materiais e estoque",
                "QR Codes para rastreamento de ativos",
                "RDO digital com fotos, GPS e clima",
                "Alertas automáticos de desvios",
                "Relatórios profissionais em PDF"
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-lg bg-green-500/5 border border-green-500/10">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm md:text-base">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ALL FEATURES SECTION */}
      <section className="py-12 sm:py-16 md:py-20 bg-background">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              <span className="text-primary">26 Módulos</span> Completos
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground px-4">
              Gestão de obras, manutenção, CRM e RH
            </p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
            {allFeatures.map((feature, index) => (
              <FeatureCard key={index} {...feature} onClick={() => navigate(feature.route)} />
            ))}
          </div>
        </div>
      </section>

      {/* 4 PILLARS SECTION */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            4 Pilares do Sistema
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <PillarCard
              title="Controle de Obra"
              icon={<Building2 className="w-6 h-6" />}
              color="from-blue-500 to-blue-600"
              items={["Dashboard de obras", "RDO completo com fotos", "Controle de produção", "Projetos e alertas"]}
              route="/features/controle-de-obra"
            />
            <PillarCard
              title="Materiais & Estoque"
              icon={<Package className="w-6 h-6" />}
              color="from-orange-500 to-orange-600"
              items={["Estoque atualizado", "Pedidos de material", "Entradas e saídas", "Consumo por obra"]}
              route="/features/materiais-almoxarifado"
            />
            <PillarCard
              title="CRM & Vendas"
              icon={<Briefcase className="w-6 h-6" />}
              color="from-purple-500 to-purple-600"
              items={["Gestão de contatos", "Pipeline de vendas", "Atividades e agenda", "Relatórios comerciais"]}
              route="/crm"
            />
            <PillarCard
              title="RH & Equipes"
              icon={<UserCheck className="w-6 h-6" />}
              color="from-teal-500 to-teal-600"
              items={["Escalas CLT automáticas", "Dashboard Prime Cost", "Gestão de funcionários", "Controle de faltas"]}
              route="/rh-construdata"
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Como Funciona
            </h2>
            
            <div className="space-y-6">
              {[
                { num: "1", title: "Cadastre obras e equipes", desc: "Configure projetos, funcionários e materiais em minutos. Importe dados de planilhas." },
                { num: "2", title: "Registre em tempo real", desc: "Equipes registram produção, materiais e ocorrências direto do celular com fotos e GPS." },
                { num: "3", title: "Acompanhe no dashboard", desc: "Gestores veem tudo centralizado: custos, produtividade, alertas e indicadores." },
                { num: "4", title: "Exporte relatórios", desc: "RDOs, relatórios de consumo, histórico de manutenção — tudo pronto para o cliente." },
              ].map((step, i) => (
                <div key={i} className="flex gap-4 md:gap-6 items-start p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-shadow">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center text-xl font-bold">
                    {step.num}
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-bold mb-1">{step.title}</h3>
                    <p className="text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* OBJECTION HANDLING */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Objeções Comuns — Resolvidas
            </h2>
            
            <div className="space-y-4">
              {[
                { q: '"Minha equipe não vai usar."', a: "Interface simples e direta. Registro por foto e QR Code. Treinamento incluso." },
                { q: '"Já tentei outros softwares."', a: "Onboarding guiado e suporte dedicado. Em 7 dias você vê resultado real." },
                { q: '"Isso deve dar trabalho."', a: "Implementação por etapas e acompanhada. Importamos seus dados de planilhas." },
                { q: '"É muito caro para minha empresa."', a: "Usuários ilimitados. O custo do desperdício que você evita paga o sistema." },
              ].map((obj, i) => (
                <div key={i} className="p-6 rounded-xl border border-border bg-card">
                  <h3 className="font-bold text-lg mb-2">{obj.q}</h3>
                  <p className="text-muted-foreground">{obj.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY SECTION */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-600 border border-green-500/20 mb-4">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-semibold">100% Seguro</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Seus Dados Protegidos
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                { icon: "🔐", title: "Criptografia Bancária", desc: "Todos os dados protegidos com tecnologia de ponta" },
                { icon: "🛡️", title: "Conformidade LGPD", desc: "Sistema adequado à Lei Geral de Proteção de Dados" },
                { icon: "☁️", title: "Backup Automático", desc: "Seus dados salvos automaticamente todos os dias" },
                { icon: "🔒", title: "Controle de Acesso", desc: "Defina permissões por usuário e função" },
              ].map((item, i) => (
                <div key={i} className="p-6 rounded-xl border border-border bg-card hover:shadow-md transition-shadow">
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h3 className="font-bold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHAT'S INCLUDED */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              O Que Está Incluso
            </h2>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                "Usuários ilimitados",
                "Armazenamento de fotos",
                "Acesso web e mobile",
                "Suporte técnico",
                "Atualizações automáticas",
                "Backup diário",
                "Treinamento incluso",
                "Importação de dados",
                "Exportação em PDF",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 bg-gradient-to-br from-primary via-primary/95 to-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-5xl font-bold">
              Chega de operar no escuro.
            </h2>
            <p className="text-xl text-primary-foreground/80">
              Controle sua obra com profissionalismo — obras, equipes, materiais, CRM e RH em um só lugar.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="secondary"
                className="text-lg px-8 py-6 rounded-xl shadow-lg"
                onClick={() => navigate('/system-test')}
              >
                Começar Teste Grátis
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-6 rounded-xl bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => navigate('/auth')}
              >
                Ver Demonstração
              </Button>
            </div>
            <p className="text-primary-foreground/60 text-sm">
              Demonstração gratuita • Implementação em 7 dias • Sem compromisso
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FAQ />

      {/* Floating Contact Button */}
      {dialogDismissed && !showContactDialog && (
        <Button
          onClick={() => setShowContactDialog(true)}
          className="fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-primary to-primary/80"
          size="icon"
        >
          <Mail className="h-6 w-6" />
        </Button>
      )}

      {/* Contact Dialog */}
      <ContactDialog open={showContactDialog} onOpenChange={handleDialogClose} />
    </div>
  );
};

// Feature Card Component - Mobile optimized
const FeatureCard = ({ icon: Icon, title, description, color, onClick }: { 
  icon: React.ElementType; 
  title: string; 
  description: string; 
  color: string;
  onClick?: () => void;
}) => (
  <div 
    className="p-3 sm:p-4 rounded-lg sm:rounded-xl border border-border bg-card hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer group active:scale-[0.98] touch-feedback"
    onClick={onClick}
  >
    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-md sm:rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform`}>
      <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
    </div>
    <h3 className="font-semibold text-xs sm:text-sm mb-0.5 sm:mb-1 line-clamp-1">{title}</h3>
    <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 leading-tight">{description}</p>
  </div>
);

// Pillar Card Component - Mobile optimized
const PillarCard = ({ title, icon, color, items, route }: { 
  title: string; 
  icon: React.ReactNode;
  color: string;
  items: string[];
  route: string;
}) => {
  const navigate = useNavigate();
  
  return (
    <div className="p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl border border-border bg-card hover:shadow-lg transition-all group active:scale-[0.99]">
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">{title}</h3>
      <ul className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Button 
        variant="outline" 
        className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors h-9 sm:h-10 text-sm"
        onClick={() => navigate(route)}
      >
        Saiba Mais
        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1" />
      </Button>
    </div>
  );
};

export default Hero;
