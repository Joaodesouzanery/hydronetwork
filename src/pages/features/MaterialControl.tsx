import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, BarChart3, AlertCircle, FileText, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MaterialControlFeature = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: BarChart3,
      title: "Análise Comparativa",
      description: "Compare quantidades solicitadas versus consumo real de materiais em cada frente de serviço."
    },
    {
      icon: TrendingUp,
      title: "Dashboard Interativo",
      description: "Visualize dados através de gráficos que mostram desvios entre planejado e executado."
    },
    {
      icon: AlertCircle,
      title: "Identificação de Desperdícios",
      description: "Detecte rapidamente frentes com consumo acima do esperado e investigue as causas."
    },
    {
      icon: FileText,
      title: "Relatórios Detalhados",
      description: "Gere relatórios de consumo por material, período e frente de serviço para melhor gestão."
    }
  ];

  const benefits = [
    "Redução de desperdícios de materiais",
    "Controle preciso por frente de serviço",
    "Comparativo planejado vs realizado",
    "Alertas de consumo excessivo",
    "Histórico completo de uso",
    "Exportação de relatórios em PDF"
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
            <div className="w-16 h-16 rounded-2xl bg-orange-600 flex items-center justify-center text-white mx-auto">
              <TrendingUp className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white">Controle de Material</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Compare requisições vs consumo real por frente de serviço
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
                <feature.icon className="w-10 h-10 text-orange-500 mb-4" />
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
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Agendar Demonstração
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaterialControlFeature;
