import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "O que é o ConstruData?",
    answer: "O ConstruData é um sistema completo de gestão de obras e manutenção predial. Ele centraliza todas as operações em uma única plataforma: controle de produção, RDO digital, gestão de materiais, equipes, QR Codes para manutenção, alertas automáticos e muito mais."
  },
  {
    question: "Preciso instalar algum software?",
    answer: "Não! O ConstruData é 100% online e funciona diretamente no navegador. Acesse de qualquer dispositivo — computador, tablet ou celular — sem precisar instalar nada. Seus dados ficam salvos na nuvem com segurança."
  },
  {
    question: "Como funciona a gestão de equipes no campo?",
    answer: "As equipes de campo podem registrar produção, materiais utilizados e ocorrências diretamente pelo celular. Os registros incluem fotos, localização GPS e horário automático. Tudo aparece em tempo real no dashboard do gestor."
  },
  {
    question: "O sistema funciona offline?",
    answer: "O sistema requer conexão com a internet para sincronizar dados em tempo real. No entanto, a interface é otimizada para funcionar bem mesmo com conexões lentas."
  },
  {
    question: "Como funciona o QR Code para manutenção?",
    answer: "Você pode gerar QR Codes para cada ativo ou local do seu empreendimento. Quando alguém precisa reportar um problema, basta escanear o QR Code e preencher um formulário simples. O chamado chega automaticamente para a equipe responsável."
  },
  {
    question: "Posso importar dados de planilhas?",
    answer: "Sim! O ConstruData permite importar funcionários, materiais e outros dados a partir de planilhas Excel. Isso facilita a migração e acelera a configuração inicial."
  },
  {
    question: "Quantos usuários posso ter?",
    answer: "Usuários ilimitados! Você pode cadastrar quantos funcionários, gestores e equipes precisar, sem custos adicionais por usuário."
  },
  {
    question: "Os dados são seguros?",
    answer: "Sim! Utilizamos criptografia de ponta a ponta, backups automáticos diários e conformidade total com a LGPD. Seus dados e dos seus clientes estão sempre protegidos."
  },
  {
    question: "Como funciona a implementação?",
    answer: "A implementação é feita em etapas e acompanhada pela nossa equipe. Configuramos seu ambiente, importamos seus dados e treinamos sua equipe. Em até 7 dias você já está operando com resultados reais."
  },
  {
    question: "Posso testar antes de contratar?",
    answer: "Sim! Oferecemos demonstração gratuita e período de teste. Agende uma reunião para conhecer o sistema na prática e ver como ele resolve os problemas específicos da sua operação."
  },
  {
    question: "É possível gerar relatórios automáticos?",
    answer: "Sim! O sistema gera RDOs completos, relatórios de produção, consumo de materiais, histórico de manutenção e muito mais. Todos podem ser exportados em PDF para enviar ao cliente."
  },
  {
    question: "O sistema envia alertas automáticos?",
    answer: "Sim! Você configura alertas para produção abaixo da meta, materiais em falta, chamados de manutenção pendentes e outros eventos importantes. Os alertas chegam por e-mail e aparecem no dashboard."
  }
];

export function FAQ() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Tire suas dúvidas sobre o ConstruData
          </p>
          
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
