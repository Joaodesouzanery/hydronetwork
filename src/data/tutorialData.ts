export interface TutorialStep {
  title: string;
  description: string;
}

export interface PageTutorial {
  title: string;
  steps: TutorialStep[];
}

export const tutorials: Record<string, PageTutorial> = {
  dashboard: {
    title: "Tutorial: Dashboard",
    steps: [
      { title: "Visão Geral", description: "O Dashboard exibe um resumo de todos os seus projetos, incluindo estatísticas de produção, alertas recentes e atividades." },
      { title: "Navegação Rápida", description: "Use os cards para acessar rapidamente as funcionalidades mais utilizadas como RDO, Materiais e Funcionários." },
      { title: "Notificações", description: "Fique atento aos alertas de produção baixa, estoque mínimo e outras notificações importantes." },
      { title: "Pesquisas de Satisfação", description: "Quando uma pesquisa estiver disponível, você verá uma notificação no topo da página. Clique para responder." },
    ]
  },
  projects: {
    title: "Tutorial: Projetos",
    steps: [
      { title: "Criar Projeto", description: "Clique em 'Novo Projeto' para cadastrar uma nova obra. Preencha nome, endereço e detalhes da obra." },
      { title: "Gerenciar Projetos", description: "Visualize todos os seus projetos ativos. Clique em um projeto para ver detalhes e gerenciar." },
      { title: "Frentes de Serviço", description: "Dentro de cada projeto, cadastre as frentes de serviço para organizar o trabalho em áreas específicas." },
      { title: "Importar Dados", description: "Use o botão 'Importar Dados' para carregar informações de projetos via planilha Excel." },
    ]
  },
  alerts: {
    title: "Tutorial: Alertas",
    steps: [
      { title: "Configurar Alertas", description: "Crie alertas personalizados para monitorar produção, estoque baixo, atrasos e outras métricas importantes." },
      { title: "Destinatários", description: "Configure quem deve receber cada alerta por e-mail quando a condição for atingida." },
      { title: "Histórico", description: "Consulte o histórico de alertas disparados para acompanhar padrões e tomar decisões." },
      { title: "Justificativas", description: "Quando um alerta for disparado, você pode adicionar justificativas para documentar as ações tomadas." },
    ]
  },
  "rdo-new": {
    title: "Tutorial: Novo RDO",
    steps: [
      { title: "Selecionar Projeto e Frente", description: "Escolha o projeto e a frente de serviço para registrar o diário de obra do dia." },
      { title: "Registrar Produção", description: "Informe a quantidade executada de cada serviço, com a equipe responsável." },
      { title: "Condições Climáticas", description: "Registre as condições do tempo que podem ter afetado a produção." },
      { title: "Observações", description: "Adicione observações relevantes sobre o dia de trabalho." },
      { title: "Fotos de Validação", description: "Anexe fotos para comprovar o trabalho realizado no dia." },
      { title: "Exportar PDF", description: "Após salvar, você pode exportar o RDO em PDF para compartilhar." },
    ]
  },
  "rdo-history": {
    title: "Tutorial: Histórico RDO",
    steps: [
      { title: "Filtrar por Data", description: "Use os filtros para encontrar RDOs de períodos específicos." },
      { title: "Visualizar Detalhes", description: "Clique em um RDO para ver todos os detalhes registrados." },
      { title: "Exportar Relatório", description: "Exporte os dados em PDF ou Excel para compartilhar com a equipe." },
      { title: "Comparar Períodos", description: "Use os gráficos para comparar a produção entre diferentes períodos." },
    ]
  },
  "production-control": {
    title: "Tutorial: Controle de Produção",
    steps: [
      { title: "Definir Metas", description: "Cadastre metas de produção por serviço e frente para acompanhar o progresso." },
      { title: "Acompanhar Execução", description: "Visualize gráficos de produção realizada vs. planejada." },
      { title: "Identificar Desvios", description: "O sistema alerta quando a produção está abaixo da meta definida." },
      { title: "Relatórios Automáticos", description: "Configure envio automático de relatórios por e-mail." },
      { title: "Exportar Dados", description: "Exporte relatórios consolidados em PDF ou Excel." },
    ]
  },
  inventory: {
    title: "Tutorial: Almoxarifado",
    steps: [
      { title: "Cadastrar Materiais", description: "Adicione materiais ao estoque com código, nome, unidade e quantidade inicial." },
      { title: "Movimentações", description: "Registre entradas e saídas de materiais com motivo e referência." },
      { title: "Estoque Mínimo", description: "Configure alertas de estoque baixo para evitar falta de materiais." },
      { title: "Inventário", description: "Realize inventários periódicos para conferir e ajustar o estoque." },
      { title: "Filtros Avançados", description: "Use os filtros por categoria, projeto, status e localização para encontrar materiais rapidamente." },
      { title: "Exportar Relatórios", description: "Exporte o inventário completo em PDF ou Excel." },
    ]
  },
  "material-requests": {
    title: "Tutorial: Pedidos de Material",
    steps: [
      { title: "Criar Pedido", description: "Solicite materiais informando item, quantidade, urgência e local de uso." },
      { title: "Fluxo de Aprovação", description: "Pedidos passam por aprovação antes de serem processados." },
      { title: "Acompanhar Status", description: "Visualize o status de cada pedido: pendente, aprovado ou entregue." },
      { title: "Vincular Funcionário", description: "Associe o pedido a um funcionário responsável pela solicitação." },
      { title: "Exportar Lista", description: "Gere PDF com a lista de pedidos para impressão." },
    ]
  },
  "material-control": {
    title: "Tutorial: Controle de Material",
    steps: [
      { title: "Registrar Consumo", description: "Informe os materiais consumidos em cada frente de serviço." },
      { title: "Comparar Orçado x Realizado", description: "O dashboard compara o consumo real com o orçamento previsto." },
      { title: "Identificar Desperdícios", description: "Analise discrepâncias para identificar possíveis desperdícios." },
      { title: "Histórico de Consumo", description: "Consulte o histórico detalhado de consumo por material e frente." },
    ]
  },
  employees: {
    title: "Tutorial: Funcionários",
    steps: [
      { title: "Cadastrar Funcionário", description: "Adicione membros da equipe com nome, cargo, contato e documentos." },
      { title: "Importar Lista", description: "Use a importação em massa para cadastrar múltiplos funcionários de uma vez via planilha Excel." },
      { title: "Vincular a Projetos", description: "Associe funcionários a projetos específicos para controle de acesso." },
      { title: "Gerenciar Status", description: "Marque funcionários como ativos ou inativos conforme necessário." },
      { title: "Filtrar e Buscar", description: "Use os filtros por status e busca por nome para encontrar funcionários." },
    ]
  },
  "labor-tracking": {
    title: "Tutorial: Apontamento de Mão de Obra",
    steps: [
      { title: "Registrar Horas", description: "Informe as horas trabalhadas por cada funcionário em cada projeto." },
      { title: "Categorias", description: "Classifique o tipo de trabalho realizado (pedreiro, servente, operador, etc.)." },
      { title: "Custo por Hora", description: "Configure o custo/hora por categoria para cálculo automático do custo total." },
      { title: "Horário de Entrada e Saída", description: "Registre os horários de entrada e saída para cálculo preciso das horas." },
      { title: "Relatórios de Custo", description: "Visualize o custo total de mão de obra por projeto e período." },
    ]
  },
  "maintenance-tasks": {
    title: "Tutorial: Tarefas de Manutenção",
    steps: [
      { title: "Criar Tarefa", description: "Cadastre tarefas de manutenção preventiva ou corretiva para seus ativos." },
      { title: "Atribuir Responsável", description: "Defina quem é responsável por executar cada tarefa." },
      { title: "Acompanhar Status", description: "Use o kanban para visualizar e atualizar o progresso das tarefas." },
      { title: "Definir Prioridade", description: "Classifique tarefas por prioridade (baixa, média, alta, urgente)." },
      { title: "Vincular a Ativos", description: "Associe tarefas a ativos específicos do catálogo." },
    ]
  },
  "maintenance-requests": {
    title: "Tutorial: Solicitações de Manutenção",
    steps: [
      { title: "Receber Solicitações", description: "Usuários externos podem enviar solicitações via QR Code sem precisar de conta." },
      { title: "Analisar e Priorizar", description: "Avalie cada solicitação e defina a prioridade de atendimento." },
      { title: "Converter em Tarefa", description: "Transforme solicitações aprovadas em tarefas para execução." },
      { title: "Visualizar Fotos", description: "Confira as fotos anexadas pelo solicitante para entender o problema." },
      { title: "Atualizar Status", description: "Mantenha o status atualizado: pendente, em andamento ou resolvida." },
    ]
  },
  budgets: {
    title: "Tutorial: Orçamentos",
    steps: [
      { title: "Criar Orçamento", description: "Inicie um novo orçamento informando cliente, projeto e data de validade." },
      { title: "Adicionar Itens", description: "Inclua materiais e serviços com quantidades e preços unitários." },
      { title: "BDI", description: "Configure o BDI (Bonificações e Despesas Indiretas) para cálculo automático." },
      { title: "Importar Planilha", description: "Importe itens de uma planilha Excel para agilizar o cadastro." },
      { title: "Exportar", description: "Gere o orçamento em PDF ou Excel para enviar ao cliente." },
    ]
  },
  "budget-pricing": {
    title: "Tutorial: Precificação Privada",
    steps: [
      { title: "Importar Planilha", description: "Envie uma planilha Excel ou PDF com itens para precificar." },
      { title: "Buscar Preços", description: "O sistema busca automaticamente os preços na base de materiais cadastrados." },
      { title: "Aprovar Similares", description: "Quando o sistema encontrar materiais similares, escolha usar o existente ou cadastrar novo." },
      { title: "Revisar e Ajustar", description: "Confira os preços encontrados e ajuste se necessário." },
      { title: "Salvar no Orçamento", description: "Adicione os itens precificados a um orçamento existente." },
    ]
  },
  prices: {
    title: "Tutorial: Preços",
    steps: [
      { title: "Importe a tabela de preços", description: "Clique em 'Identificar novos materiais' e envie o PDF/Excel com sua lista de preços." },
      { title: "Confirme materiais similares", description: "Se o sistema encontrar itens parecidos na sua base, escolha entre usar o existente ou cadastrar um novo." },
      { title: "Preencha/valide os preços", description: "O preço é obrigatório para novos materiais. Ajuste os valores na tabela antes de salvar." },
      { title: "Salve e acompanhe o histórico", description: "Após importar, gerencie preços na tabela e acompanhe variações no gráfico de histórico." },
    ]
  },
  "assets-catalog": {
    title: "Tutorial: Catálogo de Ativos",
    steps: [
      { title: "Cadastrar Ativo", description: "Registre equipamentos, máquinas e instalações com dados técnicos completos." },
      { title: "Localização Detalhada", description: "Informe torre, andar, setor e coordenadas GPS para facilitar a localização." },
      { title: "Responsável Principal", description: "Defina o responsável principal pela manutenção do ativo." },
      { title: "Notas Técnicas", description: "Adicione observações técnicas importantes sobre o equipamento." },
      { title: "Histórico de Manutenção", description: "Visualize todas as manutenções realizadas em cada ativo." },
    ]
  },
  "consumption-control": {
    title: "Tutorial: Controle de Consumo",
    steps: [
      { title: "Registrar Leituras", description: "Informe as leituras de energia, água e gás periodicamente (8h, 14h, 18h ou 20h)." },
      { title: "Analisar Tendências", description: "Visualize gráficos de consumo para identificar padrões e anomalias." },
      { title: "Comparar Períodos", description: "Compare o consumo entre diferentes períodos para identificar variações." },
      { title: "Exportar Relatórios", description: "Gere relatórios em PDF com todas as leituras do período." },
    ]
  },
  "maintenance-qr-codes": {
    title: "Tutorial: QR Code Manutenção",
    steps: [
      { title: "Gerar QR Code", description: "Crie QR Codes para ativos ou locais que precisam de manutenção." },
      { title: "Imprimir e Fixar", description: "Imprima o QR Code e fixe no local ou equipamento correspondente." },
      { title: "Receber Solicitações", description: "Qualquer pessoa pode escanear e enviar uma solicitação de manutenção sem precisar de conta." },
      { title: "Gerenciar QR Codes", description: "Ative ou desative QR Codes conforme necessário." },
    ]
  },
  "connection-reports": {
    title: "Tutorial: Relatório de Ligações",
    steps: [
      { title: "Registrar Ligação", description: "Adicione registros de ligações de água, energia ou esgoto." },
      { title: "Dados da Ligação", description: "Informe medidor, endereço, coordenadas GPS e dados do cliente." },
      { title: "Adicionar Fotos", description: "Anexe fotos do serviço realizado para documentação." },
      { title: "Exportar Consolidado", description: "Gere relatórios consolidados em PDF para apresentar à concessionária." },
    ]
  },
  occurrences: {
    title: "Tutorial: Ocorrências",
    steps: [
      { title: "Registrar Ocorrência", description: "Documente acidentes, incidentes ou situações relevantes com todos os detalhes." },
      { title: "Classificar Gravidade", description: "Defina o nível de gravidade e ações tomadas imediatamente." },
      { title: "Adicionar Evidências", description: "Anexe fotos e documentos que comprovem a ocorrência." },
      { title: "Acompanhar Resolução", description: "Monitore o status até a resolução completa da ocorrência." },
    ]
  },
  checklists: {
    title: "Tutorial: Checklists",
    steps: [
      { title: "Criar Modelo", description: "Defina modelos de checklist para diferentes tipos de inspeção." },
      { title: "Adicionar Itens", description: "Cadastre os itens que devem ser verificados em cada checklist." },
      { title: "Aplicar Checklist", description: "Execute checklists em campo, marcando itens conforme verificação." },
      { title: "Histórico", description: "Consulte checklists anteriores para análise e auditoria." },
    ]
  },
  settings: {
    title: "Tutorial: Configurações",
    steps: [
      { title: "Perfil", description: "Atualize suas informações pessoais e foto de perfil." },
      { title: "Notificações", description: "Configure quais notificações deseja receber por e-mail." },
      { title: "Segurança", description: "Altere sua senha e configure autenticação de dois fatores." },
      { title: "Preferências", description: "Ajuste preferências de exibição e comportamento do sistema." },
    ]
  },
  "custom-dashboard": {
    title: "Tutorial: Dashboard Personalizado",
    steps: [
      { title: "Criar Dashboard", description: "Crie dashboards personalizados com os widgets que você precisa." },
      { title: "Adicionar Widgets", description: "Escolha entre KPIs, gráficos de produção, tabelas e mais." },
      { title: "Configurar Filtros", description: "Defina filtros globais por projeto e período." },
      { title: "Organizar Layout", description: "Arraste e redimensione widgets para organizar seu dashboard." },
    ]
  },
  "facility-reports": {
    title: "Tutorial: Relatórios de Facilities",
    steps: [
      { title: "Filtrar Período", description: "Selecione o período e projeto para gerar relatórios." },
      { title: "Tarefas e Materiais", description: "Visualize resumo de tarefas executadas e materiais utilizados." },
      { title: "Consumo de Recursos", description: "Acompanhe o consumo de água, energia e gás." },
      { title: "Gráficos de Performance", description: "Analise gráficos de status de tarefas e tipos de manutenção." },
    ]
  },
  "interactive-map": {
    title: "Tutorial: Mapa Interativo",
    steps: [
      { title: "Upload de Mapa", description: "Faça upload de mapas KMZ ou imagens georeferenciadas." },
      { title: "Adicionar Anotações", description: "Marque pontos no mapa com anotações e progresso." },
      { title: "Vincular Frentes", description: "Associe pontos a frentes de serviço e equipes." },
      { title: "Acompanhar Progresso", description: "Visualize o progresso das frentes diretamente no mapa." },
    ]
  },
  admin: {
    title: "Tutorial: Administração",
    steps: [
      { title: "Gerenciar Usuários", description: "Crie, edite e remova usuários do sistema." },
      { title: "Definir Permissões", description: "Configure papéis e permissões para cada usuário." },
      { title: "Pesquisas de Satisfação", description: "Dispare pesquisas para usuários e visualize as respostas." },
      { title: "Cotas de Usuários", description: "Defina limites de projetos e funcionários por usuário." },
    ]
  },
};

export const getTutorial = (pageKey: string): PageTutorial | null => {
  return tutorials[pageKey] || null;
};
