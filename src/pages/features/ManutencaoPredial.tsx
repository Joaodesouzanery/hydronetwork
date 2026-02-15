import { Button } from "@/components/ui/button";
import { ArrowLeft, Wrench, CheckCircle, QrCode, ClipboardList, History, Bell, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ManutencaoPredial = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <ClipboardList className="w-6 h-6" />,
      title: "Catálogo de Ativos",
      description: "Cadastre todos os equipamentos, instalações e sistemas do prédio. Mantenha histórico completo de cada ativo."
    },
    {
      icon: <QrCode className="w-6 h-6" />,
      title: "QR Codes",
      description: "Gere QR Codes únicos para cada ativo. Qualquer pessoa pode escanear e abrir uma solicitação de manutenção."
    },
    {
      icon: <Settings className="w-6 h-6" />,
      title: "Solicitações de Manutenção",
      description: "Moradores ou funcionários escaneiam o QR Code e descrevem o problema. A equipe técnica recebe instantaneamente."
    },
    {
      icon: <History className="w-6 h-6" />,
      title: "Histórico Completo",
      description: "Todo o histórico de manutenções fica registrado. Saiba quando foi a última intervenção em cada ativo."
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: "Relatórios e Alertas",
      description: "Manutenções preventivas agendadas, alertas de vencimento e relatórios de desempenho da equipe."
    },
    {
      icon: <Wrench className="w-6 h-6" />,
      title: "Gestão de OS",
      description: "Crie, atribua e acompanhe ordens de serviço. Controle status, prioridade e tempo de resolução."
    }
  ];

  const benefits = [
    "Centralize todas as solicitações em um único lugar",
    "Reduza o tempo de resposta com notificações instantâneas",
    "Mantenha histórico para auditorias e garantias",
    "Planeje manutenções preventivas com antecedência",
    "Demonstre profissionalismo aos moradores/clientes"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-purple-500/5">
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
            <div className="w-20 h-20 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 mx-auto">
              <Wrench className="w-10 h-10" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">Manutenção Predial</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Gerencie ativos, solicitações de manutenção e equipe técnica com QR Codes inteligentes e histórico completo.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="p-6 rounded-xl border bg-card hover:shadow-lg transition-all duration-300 hover:border-purple-500/30"
              >
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* QR Code Demo */}
          <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/20 p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-2xl font-bold mb-4">Como funciona o QR Code?</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p><strong className="text-foreground">1. Gere o QR Code:</strong> Cada ativo (elevador, portão, bomba) recebe um código único.</p>
                  <p><strong className="text-foreground">2. Cole no local:</strong> Imprima e fixe o QR Code próximo ao equipamento.</p>
                  <p><strong className="text-foreground">3. Escaneie quando precisar:</strong> Qualquer pessoa escaneia e descreve o problema.</p>
                  <p><strong className="text-foreground">4. Equipe recebe:</strong> A manutenção recebe a solicitação com foto e localização exata.</p>
                </div>
              </div>
              <div className="flex justify-center">
                <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center shadow-lg">
                  <QrCode className="w-32 h-32 text-purple-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Benefits Section */}
          <div className="bg-card rounded-xl border p-8 md:p-12">
            <h2 className="text-2xl font-bold mb-8 text-center">Benefícios da Manutenção Digital</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center space-y-4">
            <Button
              size="lg"
              onClick={() => navigate('/auth')}
              className="text-lg px-8 bg-purple-500 hover:bg-purple-600"
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

export default ManutencaoPredial;
