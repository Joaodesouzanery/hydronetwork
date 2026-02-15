import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Camera, MapPin, Cloud, Calendar, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const RDODigital = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: FileText,
      title: "Registro Completo",
      description: "Preencha o Relatório Diário de Obra com todos os campos necessários para documentação completa."
    },
    {
      icon: Camera,
      title: "Fotos e Evidências",
      description: "Anexe fotos diretamente do celular com registro automático de data, hora e localização GPS."
    },
    {
      icon: Cloud,
      title: "Clima Automático",
      description: "Captura automática das condições climáticas do local da obra para registro preciso."
    },
    {
      icon: MapPin,
      title: "Geolocalização",
      description: "Registro automático de GPS para comprovar presença no local da obra."
    }
  ];

  const benefits = [
    "Eliminação de papéis e planilhas",
    "Registro automático de clima e GPS",
    "Fotos com metadados completos",
    "Histórico pesquisável de RDOs",
    "Exportação em PDF profissional",
    "Acesso offline com sincronização"
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
            <div className="w-16 h-16 rounded-2xl bg-green-600 flex items-center justify-center text-white mx-auto">
              <FileText className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white">RDO Digital</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Relatório Diário de Obra completo com fotos, GPS e clima automático
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
                <feature.icon className="w-10 h-10 text-green-500 mb-4" />
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
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Agendar Demonstração
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RDODigital;
