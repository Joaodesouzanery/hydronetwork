import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, CheckCircle, TrendingUp, TrendingDown, AlertTriangle, Truck, BarChart } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MateriaisAlmoxarifado = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Package className="w-6 h-6" />,
      title: "Estoque Atualizado",
      description: "Controle em tempo real de todos os materiais disponíveis em cada obra, com alertas de estoque mínimo."
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Pedidos de Material",
      description: "Crie e aprove pedidos de materiais diretamente pelo sistema. Fluxo de aprovação configurável."
    },
    {
      icon: <TrendingDown className="w-6 h-6" />,
      title: "Entradas e Saídas",
      description: "Registre movimentações de materiais com rastreabilidade completa. Saiba quem, quando e para onde foi cada item."
    },
    {
      icon: <BarChart className="w-6 h-6" />,
      title: "Consumo Detalhado",
      description: "Acompanhe o consumo de materiais por obra, equipe, frente de serviço e tarefa específica."
    },
    {
      icon: <AlertTriangle className="w-6 h-6" />,
      title: "Alertas de Estoque",
      description: "Receba notificações automáticas quando materiais atingirem o estoque mínimo definido."
    },
    {
      icon: <Truck className="w-6 h-6" />,
      title: "Gestão de Fornecedores",
      description: "Cadastre fornecedores, compare cotações e acompanhe entregas previstas e realizadas."
    }
  ];

  const benefits = [
    "Elimine desperdício de materiais com controle preciso",
    "Nunca mais pare a obra por falta de material",
    "Reduza custos com compras planejadas",
    "Rastreie cada item desde a compra até o uso",
    "Relatórios de consumo para orçamentos futuros"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
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
            <div className="w-20 h-20 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 mx-auto">
              <Package className="w-10 h-10" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">Materiais & Almoxarifado</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Controle total de estoque, movimentações e consumo de materiais. Elimine desperdícios e nunca mais pare a obra por falta de material.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="p-6 rounded-xl border bg-card hover:shadow-lg transition-all duration-300 hover:border-orange-500/30"
              >
                <div className="w-12 h-12 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Benefits Section */}
          <div className="bg-card rounded-xl border p-8 md:p-12">
            <h2 className="text-2xl font-bold mb-8 text-center">Por que controlar o almoxarifado?</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Process */}
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-center">Fluxo de Trabalho</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { step: "1", title: "Cadastre Materiais", desc: "Defina itens, unidades e estoque mínimo" },
                { step: "2", title: "Registre Movimentações", desc: "Entradas por NF, saídas por requisição" },
                { step: "3", title: "Monitore Consumo", desc: "Veja relatórios por obra e período" },
                { step: "4", title: "Receba Alertas", desc: "Seja notificado sobre estoque baixo" }
              ].map((item, index) => (
                <div key={index} className="text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center text-xl font-bold mx-auto">
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
              className="text-lg px-8 bg-orange-500 hover:bg-orange-600"
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

export default MateriaisAlmoxarifado;
