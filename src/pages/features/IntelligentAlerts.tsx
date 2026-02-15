import { Button } from "@/components/ui/button";
import { ArrowLeft, Bell, AlertTriangle, MessageSquare, History, Zap, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const IntelligentAlerts = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: AlertTriangle,
      title: "Detecção Automática",
      description: "Sistema monitora produção e identifica automaticamente quando há desvios das metas estabelecidas."
    },
    {
      icon: MessageSquare,
      title: "Justificativas Obrigatórias",
      description: "Para cada alerta gerado, é obrigatório registrar uma justificativa detalhada do que aconteceu."
    },
    {
      icon: History,
      title: "Histórico Completo",
      description: "Mantenha registro de todos os alertas e justificativas para análise posterior e auditoria."
    },
    {
      icon: Zap,
      title: "Notificações em Tempo Real",
      description: "Receba notificações imediatas quando alertas são criados, garantindo ação rápida."
    }
  ];

  const benefits = [
    "Identificação imediata de desvios de produção",
    "Rastreabilidade completa de problemas",
    "Justificativas documentadas para auditoria",
    "Alertas configuráveis por tipo de desvio",
    "Dashboard de alertas pendentes",
    "Histórico para análise de padrões"
  ];

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <div className="container px-4 py-12 mx-auto max-w-5xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-8 text-gray-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Home
        </Button>

        <div className="space-y-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center text-white mx-auto">
              <Bell className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white">Alertas Inteligentes</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Notificações automáticas com justificativas obrigatórias para desvios de produção
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
                <feature.icon className="w-10 h-10 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Benefits */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-8">
            <h2 className="text-2xl font-semibold text-white mb-6">Benefícios</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-300">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <Button
              size="lg"
              onClick={() => navigate('/system-test')}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Agendar Demonstração
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntelligentAlerts;
