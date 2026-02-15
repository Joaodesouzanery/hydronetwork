import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, CheckCircle, ClipboardCheck, Camera, Clock, UserCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ExecucaoEquipes = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Users className="w-6 h-6" />,
      title: "Gestão de Funcionários",
      description: "Cadastro completo de funcionários próprios e terceirizados, com controle de documentação e certificações."
    },
    {
      icon: <ClipboardCheck className="w-6 h-6" />,
      title: "Checklists Operacionais",
      description: "Crie checklists personalizados para cada tipo de serviço. Garanta que nenhum passo seja esquecido."
    },
    {
      icon: <Camera className="w-6 h-6" />,
      title: "Registros com Evidências",
      description: "Cada registro pode incluir fotos, vídeos e localização GPS. Comprovação irrefutável do trabalho realizado."
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: "Controle de Ponto",
      description: "Acompanhe entrada e saída de funcionários por obra. Calcule automaticamente horas trabalhadas e custos."
    },
    {
      icon: <UserCheck className="w-6 h-6" />,
      title: "Atribuição de Tarefas",
      description: "Distribua tarefas para funcionários ou equipes. Acompanhe status e conclusão em tempo real."
    }
  ];

  const benefits = [
    "Saiba exatamente quem está trabalhando em cada obra",
    "Elimine retrabalho com checklists padronizados",
    "Tenha evidências fotográficas de todo o trabalho",
    "Calcule custos de mão de obra automaticamente",
    "Aumente a produtividade com tarefas bem definidas"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-blue-500/5">
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
            <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 mx-auto">
              <Users className="w-10 h-10" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">Execução & Equipes</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Gerencie funcionários, atribua tarefas e registre a execução de serviços com evidências completas e rastreabilidade.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="p-6 rounded-xl border bg-card hover:shadow-lg transition-all duration-300 hover:border-blue-500/30"
              >
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Benefits Section */}
          <div className="bg-card rounded-xl border p-8 md:p-12">
            <h2 className="text-2xl font-bold mb-8 text-center">Benefícios para sua Equipe</h2>
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
              className="text-lg px-8 bg-blue-500 hover:bg-blue-600"
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

export default ExecucaoEquipes;
