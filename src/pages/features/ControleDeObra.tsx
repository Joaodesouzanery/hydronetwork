import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, CheckCircle, FileText, BarChart3, Bell, Calendar, MapPin, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ControleDeObra = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Building2 className="w-6 h-6" />,
      title: "Dashboard de Obras",
      description: "Visão geral de todos os projetos em andamento com indicadores de progresso, custos e prazos em tempo real."
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: "Alertas Automáticos",
      description: "Receba notificações quando metas não forem atingidas, materiais estiverem em falta ou prazos se aproximarem."
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "RDO Completo com Fotos",
      description: "Relatórios Diários de Obra digitais com upload de fotos, validação GPS e condições climáticas automáticas."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Controle de Produção",
      description: "Acompanhe a produtividade de cada frente de serviço, compare metas vs realizado e identifique gargalos."
    },
    {
      icon: <Calendar className="w-6 h-6" />,
      title: "Histórico e Relatórios",
      description: "Acesse todo o histórico da obra, gere relatórios personalizados e exporte em PDF para clientes e stakeholders."
    },
    {
      icon: <MapPin className="w-6 h-6" />,
      title: "Geolocalização",
      description: "Validação automática de localização para garantir que registros foram feitos no local correto da obra."
    }
  ];

  const benefits = [
    "Reduza atrasos com visibilidade total do progresso",
    "Tome decisões baseadas em dados reais, não em achismo",
    "Centralize toda a comunicação e documentação",
    "Gere relatórios profissionais em segundos",
    "Mantenha histórico completo para auditorias"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container px-4 py-12 mx-auto max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Home
        </Button>

        <div className="space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
              <Building2 className="w-10 h-10" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">Controle de Obra</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Tenha visibilidade total de todas as suas obras em um único lugar. Dashboard, alertas, RDO e relatórios integrados para uma gestão profissional.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="p-6 rounded-xl border bg-card hover:shadow-lg transition-all duration-300 hover:border-primary/30"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Benefits Section */}
          <div className="bg-card rounded-xl border p-8 md:p-12">
            <h2 className="text-2xl font-bold mb-8 text-center">Benefícios para sua Gestão</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-center">Como Funciona</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { step: "1", title: "Cadastre Obras", desc: "Adicione seus projetos com informações básicas" },
                { step: "2", title: "Configure Alertas", desc: "Defina metas e condições para notificações" },
                { step: "3", title: "Registre Diariamente", desc: "Equipe registra produção pelo celular" },
                { step: "4", title: "Acompanhe em Tempo Real", desc: "Veja tudo no dashboard centralizado" }
              ].map((item, index) => (
                <div key={index} className="text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto">
                    {item.step}
                  </div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center space-y-4">
            <Button
              size="lg"
              onClick={() => navigate('/auth')}
              className="text-lg px-8"
            >
              Começar Agora
            </Button>
            <p className="text-sm text-muted-foreground">
              Teste grátis por 7 dias, sem compromisso
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControleDeObra;
