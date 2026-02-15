import { Button } from "@/components/ui/button";
import { ArrowLeft, FolderOpen, MapPin, BarChart3, History, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProjectManagement = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: FolderOpen,
      title: "Cadastro de Projetos",
      description: "Registre obras com informações completas: nome, localização, datas e responsáveis."
    },
    {
      icon: MapPin,
      title: "Acompanhamento em Tempo Real",
      description: "Visualize o status de cada projeto com indicadores de progresso atualizados."
    },
    {
      icon: BarChart3,
      title: "Gestão de Status",
      description: "Controle o ciclo de vida: em planejamento, em andamento, pausado ou concluído."
    },
    {
      icon: History,
      title: "Histórico Completo",
      description: "Acesse todo o histórico de atividades, RDOs e ocorrências de cada projeto."
    }
  ];

  const benefits = [
    "Visão unificada de todos os projetos",
    "Dashboard de status em tempo real",
    "Filtros por localização e período",
    "Relatórios consolidados",
    "Gestão de equipes por projeto",
    "Controle de prazos e entregas"
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
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto">
              <FolderOpen className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white">Gestão de Projetos</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Gerencie múltiplos projetos com visibilidade completa e controle centralizado
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
                <feature.icon className="w-10 h-10 text-blue-500 mb-4" />
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
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Agendar Demonstração
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectManagement;
