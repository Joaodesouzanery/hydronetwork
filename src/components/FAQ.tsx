import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Preciso instalar alguma coisa?",
    answer: "Não! O HydroNetwork é 100% online. Funciona diretamente no navegador — sem instalação, sem plugins, sem licenças. Acesse de qualquer dispositivo com internet."
  },
  {
    question: "Funciona para esgoto, água E drenagem?",
    answer: "Sim! Temos módulos dedicados para cada tipo de rede: esgoto por gravidade (NBR 9649), distribuição de água pressurizada (NBR 12211/12218) e drenagem pluvial (NBR 10844), com motores de cálculo específicos."
  },
  {
    question: "Posso exportar para o QGIS e AutoCAD?",
    answer: "Sim! Exportamos para Shapefile, GeoJSON, GeoPackage, DXF, KML/KMZ e mais. Totalmente compatível com QGIS, AutoCAD, Google Earth e outros softwares GIS."
  },
  {
    question: "Quanto custa?",
    answer: "O HydroNetwork possui um plano DEMO gratuito para começar sem compromisso. Sem cartão de crédito, sem cadastro obrigatório. Acesse agora e comece a projetar."
  },
  {
    question: "E se eu já tenho dados em planilha?",
    answer: "Perfeito! Importamos CSV, TXT, XLSX e XLS com mapeamento de campos inteligente. Até dados sem cabeçalho (X, Y, Z) são processados automaticamente. Também suportamos DXF, SHP e GeoJSON."
  },
  {
    question: "Como funciona o suporte?",
    answer: "Oferecemos suporte por email (construdata.contato@gmail.com) e demonstrações personalizadas via Calendly. Nossa equipe de engenheiros está pronta para ajudar na implementação."
  },
  {
    question: "Meus dados estão seguros?",
    answer: "Sim! Utilizamos criptografia de ponta a ponta, backups automáticos e infraestrutura em nuvem com alta disponibilidade. Seus projetos e dados estão sempre protegidos."
  },
  {
    question: "Posso colaborar com minha equipe?",
    answer: "Sim! Múltiplos usuários podem acessar o mesmo projeto. Equipes de campo registram produção e ocorrências pelo celular, enquanto gestores acompanham tudo pelo dashboard."
  },
  {
    question: "Há limites de uso no plano gratuito?",
    answer: "O plano DEMO oferece acesso a todos os módulos para que você conheça a plataforma. Para projetos profissionais com capacidade ilimitada, oferecemos o plano PRO."
  },
  {
    question: "O sistema gera relatórios automáticos?",
    answer: "Sim! Gera RDOs completos, relatórios de produção, orçamentos SINAPI, quantitativos, perfis longitudinais e muito mais. Todos exportáveis em PDF, Excel e outros formatos."
  },
  {
    question: "Como funciona a simulação EPANET?",
    answer: "O HydroNetwork integra o motor EPANET via WebAssembly diretamente no navegador. Você importa ou cria sua rede, executa a simulação e visualiza resultados de pressão e vazão — sem instalar o EPANET."
  },
  {
    question: "Posso importar arquivos DXF do AutoCAD?",
    answer: "Sim! Importamos arquivos DXF com entidades POINT, LINE e POLYLINE. Os dados são automaticamente convertidos em pontos topográficos com coordenadas X, Y e Z para uso em todos os módulos."
  },
];

export function FAQ() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Dúvidas Respondidas: Tudo o que Você Precisa Saber
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Tire suas dúvidas sobre o HydroNetwork e a plataforma ConstruData
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
