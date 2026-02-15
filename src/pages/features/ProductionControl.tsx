import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, BarChart3, TrendingUp, FileBarChart, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProductionControl = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Target,
      title: "Definição de Metas",
      description: "Estabeleça metas diárias por frente de serviço e acompanhe o progresso em tempo real."
    },
    {
      icon: BarChart3,
      title: "Acompanhamento em Tempo Real",
      description: "Visualize a produção atualizada conforme os serviços são executados no campo."
    },
    {
      icon: TrendingUp,
      title: "Comparativo de Performance",
      description: "Compare o desempenho entre diferentes frentes de serviço e períodos."
    },
    {
      icon: FileBarChart,
      title: "Relatórios Consolidados",
      description: "Gere relatórios detalhados por período, serviço e equipe para análise gerencial."
    }
  ];

  const benefits = [
    "Visibilidade completa da produção",
    "Metas configuráveis por serviço",
    "Alertas automáticos de desvios",
    "Gráficos comparativos interativos",
    "Exportação de relatórios PDF",
    "Dashboard personalizado"
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
            <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center text-white mx-auto">
              <Target className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white">Controle de Produção</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Defina metas, acompanhe em tempo real e compare resultados por frente de serviço
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
                <feature.icon className="w-10 h-10 text-purple-500 mb-4" />
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
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Agendar Demonstração
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionControl;
