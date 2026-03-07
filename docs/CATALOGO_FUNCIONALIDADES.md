# CATALOGO DE FUNCIONALIDADES — ConstruData HydroNetwork

> Documentacao detalhada de TODAS as funcionalidades da plataforma, organizadas por modulo.

**Data:** Marco 2026 | **Versao:** 1.0 | **Plataforma:** www.construdata.software

---

## INDICE

1. [Nucleo HydroNetwork (Motor de Calculo)](#1-nucleo-hydronetwork)
2. [Gestao de Obra](#2-gestao-de-obra)
3. [Planejamento e Lean Construction](#3-planejamento-e-lean-construction)
4. [RDO Digital](#4-rdo-digital)
5. [Hub de Noticias e Licitacoes](#5-hub-de-noticias-e-licitacoes)
6. [CRM e Comercial](#6-crm-e-comercial)
7. [RH e Equipes](#7-rh-e-equipes)
8. [Materiais e Almoxarifado](#8-materiais-e-almoxarifado)
9. [Manutencao e Ativos](#9-manutencao-e-ativos)
10. [Dashboards e Analytics](#10-dashboards-e-analytics)
11. [Mapa Interativo e GIS](#11-mapa-interativo-e-gis)
12. [Administracao e Configuracoes](#12-administracao-e-configuracoes)
13. [Exportacoes e Integracao](#13-exportacoes-e-integracao)
14. [Seguranca e Infraestrutura](#14-seguranca-e-infraestrutura)

---

## 1. NUCLEO HYDRONETWORK

O motor de calculo e o coracao da plataforma. Realiza dimensionamento hidraulico conforme normas brasileiras.

### 1.1 Rede de Esgoto (NBR 9649)

**Engine:** `qesgEngine.ts`

| Funcionalidade | Descricao |
|----------------|-----------|
| Dimensionamento automatico | Calculo de todos os trechos da rede com base na vazao, populacao e parametros normativos |
| Formula de Manning | Calculo de vazao e velocidade em condutos livres |
| Tensao trativa | Verificacao de autolimpeza conforme NBR 9649 (minimo 1,0 Pa) |
| Lamina d'agua | Verificacao da relacao Y/D (lamina maxima 75%) |
| Velocidade critica | Verificacao de velocidades minima e maxima |
| Diametro minimo | Verificacao do diametro minimo (DN 100 para esgoto) |
| Profundidade de PV | Calculo automatico de profundidade dos pocos de visita |
| Recobrimento minimo | Verificacao de recobrimento conforme norma |
| Declividade minima/maxima | Calculo e verificacao de declividades |
| Trecho a trecho | Dimensionamento individual de cada trecho com resultados detalhados |
| Resumo da rede | Totalizacao de extensoes, volumes de escavacao, tubulacoes |
| Validacao normativa | Alertas automaticos para nao-conformidades |

### 1.2 Rede de Agua (NBR 12218)

**Engine:** `qwaterEngine.ts`

| Funcionalidade | Descricao |
|----------------|-----------|
| Hazen-Williams | Calculo de perda de carga por Hazen-Williams |
| Verificacao de pressao | Pressao estatica e dinamica em todos os nos |
| Vazao de dimensionamento | Calculo de demanda por trecho |
| Diametros comerciais | Selecao automatica de diametros comerciais disponiveis |
| Velocidade maxima | Verificacao de limites de velocidade (0,6 a 3,5 m/s) |
| Pressao minima/maxima | Verificacao de pressao residual minima (10 mca) e maxima estatica (50 mca) |
| Rede ramificada | Dimensionamento de redes ramificadas |
| Coeficientes C | Tabela de coeficientes C para diferentes materiais (PVC, ferro, concreto) |

### 1.3 Drenagem Pluvial

**Engine:** `hydraulics.ts`

| Funcionalidade | Descricao |
|----------------|-----------|
| Metodo Racional | Calculo de vazao pluvial pelo metodo racional (Q = C.I.A) |
| Intensidade pluviometrica | Parametros IDF (Intensidade-Duracao-Frequencia) |
| Coeficiente de escoamento | Tabela de coeficientes por tipo de superficie |
| Tempo de concentracao | Calculo por formulas classicas |
| Dimensionamento de galerias | Calculo de secoes para galerias de aguas pluviais |
| NBR 10844 (parcial) | Conformidade basica com norma de aguas pluviais |

### 1.4 Estacao Elevatoria

**Engine:** `elevatorStationEngine.ts`

| Funcionalidade | Descricao |
|----------------|-----------|
| Dimensionamento de bombas | Selecao de bombas por vazao e altura manometrica |
| Curva do sistema | Calculo da curva de perda de carga do sistema |
| Potencia da bomba | Calculo de potencia necessaria (CV e kW) |
| Rendimento | Estimativa de rendimento e eficiencia |
| NPSH | Verificacao de NPSH disponivel vs requerido |
| Poco umido | Dimensionamento do poco de succao |
| Tempo de detencao | Calculo de volume util e tempo de detencao |

### 1.5 Sistema de Recalque

**Engine:** `recalqueEngine.ts`

| Funcionalidade | Descricao |
|----------------|-----------|
| Linha de recalque | Dimensionamento da tubulacao de recalque |
| Perda de carga | Calculo de perdas localizadas e distribuidas |
| Altura manometrica total | AMT = Hg + Perdas |
| Diametro economico | Calculo do diametro economico (Bresse) |
| Formula de Bresse | D = K × √Q para diametro economico |
| Selecao de material | Comparativo de materiais (PEAD, PVC, ferro) |

### 1.6 Transientes Hidraulicos

**Engine:** `transientEngine.ts`

| Funcionalidade | Descricao |
|----------------|-----------|
| Golpe de ariete | Calculo da sobrepressao por Joukowsky (ΔP = ρ.a.ΔV) |
| Celeridade da onda | Calculo da velocidade de propagacao da onda |
| Tempo de manobra | Calculo de tempo critico de fechamento |
| Envoltoria de pressao | Grafico de maxima e minima pressao ao longo da tubulacao |
| Dispositivos de protecao | Dimensionamento basico de VAG, TAU, chimenea de equilibrio |

### 1.7 Simulacao EPANET

**Engine:** `epanetRunner.ts` (via epanet-js WASM)

| Funcionalidade | Descricao |
|----------------|-----------|
| Simulacao hidraulica | Simulacao completa de redes de agua via EPANET 2.2 |
| Execucao no navegador | Roda via WebAssembly — sem necessidade de instalar EPANET |
| Importacao INP | Carregamento de arquivos .INP existentes |
| Resultados visuais | Visualizacao de pressao, vazao e velocidade por no/trecho |
| Exportacao INP | Geracao de arquivos .INP para uso externo |
| Simulacao em periodo estendido | Analise temporal com padroes de demanda |

### 1.8 Quantitativos e Orcamento

**Engines:** `budget.ts`, `sinapi.ts`

| Funcionalidade | Descricao |
|----------------|-----------|
| Quantitativos automaticos | Geracao de quantitativos direto do dimensionamento |
| Escavacao por faixa | Calculo de volumes de escavacao por profundidade (0-1,5m, 1,5-3m, 3-4,5m, rocha) |
| Tubulacao por diametro | Totalizacao de extensoes por diametro e material |
| Pocos de visita | Quantitativo de PVs por tipo e profundidade |
| Reaterro e compactacao | Calculo de volumes de reaterro |
| Base SINAPI | Precos SINAPI 01/2026 desonerado SP (ajustado INCC +8%) |
| Composicao de precos | Custo unitario por servico com codigo SINAPI |
| Orcamento global | Resumo total com totalizacao por categoria |
| Exportacao Excel | Planilha orcamentaria completa |

### 1.9 BDI — Composicao TCU

**Engine:** `bdi.ts`

| Funcionalidade | Descricao |
|----------------|-----------|
| Calculo de BDI | Conforme Acordao TCU 2622/2013 |
| Componentes detalhados | Administracao Central, Seguro/Garantia, Risco, Despesas Financeiras, Lucro, Tributos |
| Cenarios | Comparativo entre cenarios de BDI |
| Faixas TCU | Verificacao contra faixas de referencia do TCU |
| Viabilidade | Analise de viabilidade economica |
| BDI diferenciado | Calculo para materiais, equipamentos, servicos |

### 1.10 Conformidade CAESB

**Engine:** `caesbEngine.ts`

| Funcionalidade | Descricao |
|----------------|-----------|
| NTS CAESB | Verificacao contra Normas Tecnicas de Saneamento da CAESB |
| Checklists normativos | Lista de verificacao especifica por concessionaria |
| Regras de projeto | Validacao de parametros especificos CAESB |
| Relatorios de conformidade | Geracao de relatorio de atendimento normativo |

---

## 2. GESTAO DE OBRA

### 2.1 Dashboard Principal (`/dashboard`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Cards de resumo | Visao rapida de KPIs: obras ativas, RDOs pendentes, alertas, producao |
| Navegacao rapida | Acesso direto a todos os modulos via cards |
| Selecao de obra | Alternancia entre obras/projetos ativos |
| Indicadores de atraso | Alertas visuais para atividades criticas |

### 2.2 Controle de Producao (`/production`, `/production-control`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Medicao por frente | Registro de avancos por frente de servico |
| Curva de avanso | Comparativo planejado vs realizado |
| Produtividade diaria | Calculo de produtividade (m/dia, m³/dia) |
| Fotos de medicao | Upload de fotos geolocalizadas |
| Historico de producao | Timeline de avancos registrados |

### 2.3 Projetos

| Funcionalidade | Descricao |
|----------------|-----------|
| Multi-projeto | Gestao de multiplas obras simultaneas |
| Timeline de projeto | Visao temporal do projeto |
| Status por fase | Acompanhamento fase a fase |
| Equipe do projeto | Vinculacao de profissionais a obras |

### 2.4 Ocorrencias (`/occurrences`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Registro de NAO conformidade | Documentacao de problemas encontrados |
| Classificacao | Por tipo, gravidade e frente de servico |
| Fotos e evidencias | Upload de registros fotograficos |
| Status de resolucao | Acompanhamento de tratativa |

### 2.5 Checklists (`/checklists`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Checklists personalizaveis | Criacao de modelos de checklist |
| Execucao em campo | Preenchimento mobile-friendly |
| Historico | Registro de todas as verificacoes |
| Templates | Modelos prontos para diferentes servicos |

### 2.6 Controle de Aprovacao (`/approval-control`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Workflow de aprovacao | Fluxo configuravel de aprovacoes |
| Niveis hierarquicos | Aprovacao em cascata (tecnico → coordenador → gerente) |
| Historico de decisoes | Registro de quem aprovou/rejeitou e quando |
| Notificacoes | Alertas para aprovadores pendentes |

---

## 3. PLANEJAMENTO E LEAN CONSTRUCTION

### 3.1 Planejamento Gantt (`/planning`)

**Engine:** `planning.ts`

| Funcionalidade | Descricao |
|----------------|-----------|
| Gantt interativo | Grafico de Gantt com arrastar e soltar |
| Curva S | Curva de avanso fisico-financeiro (planejado vs real) |
| Histograma de recursos | Distribuicao de mao-de-obra ao longo do tempo |
| Alocacao de equipes | Vinculacao de equipes a atividades |
| Caminho critico | Identificacao de atividades criticas |
| Dependencias | Relacoes fim-inicio, inicio-inicio entre atividades |
| Marcos (milestones) | Definicao de marcos do projeto |
| Linha de base | Comparativo com planejamento original |
| EVM (Earned Value) | Indicadores CPI, SPI, EAC, ETC |

### 3.2 LPS — Last Planner System (`/lean-constraints`)

**Engines:** `lps.ts`, `lean-constraints.ts`

| Funcionalidade | Descricao |
|----------------|-----------|
| Gestao de restricoes | Cadastro e acompanhamento de restricoes por tipo |
| Tipos de restricao | Projeto, Material, MO, Equipamento, Predecessora, Espaco, Seguranca, Climatica, Financeira, Contratual |
| Status visual | Cards coloridos por status (identificada, em analise, em tratamento, removida) |
| Responsaveis | Atribuicao de responsavel por restricao |
| Prazo de remocao | Data limite para tratativa |
| Restricoes vencidas | Alerta para restricoes nao tratadas no prazo |

### 3.3 Dashboard Lean (`/lean-dashboard`)

| Funcionalidade | Descricao |
|----------------|-----------|
| PPC (Percentual de Planos Concluidos) | Indicador semanal de cumprimento |
| IRC (Indice de Remocao de Constrains) | Taxa de remocao de restricoes |
| Analise de causas | Pareto de motivos de nao cumprimento |
| Tendencias | Graficos de evolucao dos indicadores Lean |
| 5 Porques | Analise de causa raiz integrada |

### 3.4 Compliance de RDO (Novo)

| Funcionalidade | Descricao |
|----------------|-----------|
| Agenda de RDO | Configuracao de frequencia de preenchimento (diario, dias uteis, dia sim/dia nao, semanal, personalizado) |
| Alertas automaticos | Lembrete ao encarregado quando RDO pendente |
| Escalacao hierarquica | Notificacao ao supervisor apos X dias sem RDO |
| Dashboard de conformidade | Percentual de conformidade, dias atrasados, historico |
| Justificativa de ausencia | Possibilidade de justificar dias sem RDO |
| Verificacao sob demanda | Botao "Verificar agora" para checagem imediata |

---

## 4. RDO DIGITAL

### 4.1 Formulario de RDO (`/rdo`, `/rdo/new`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Dados climaticos | Registro de condicoes climaticas (integracao Weather API) |
| Equipes em campo | Registro de equipes e quantitativos de mao-de-obra |
| Frentes de servico | Detalhamento por frente/atividade |
| Avancos fisicos | Registro de producao do dia por servico |
| Observacoes | Campo livre para ocorrencias e anotacoes |
| Fotos geolocalizadas | Upload de fotos com GPS automatico |
| Assinatura digital | Assinatura do responsavel |
| Status do RDO | Rascunho, enviado, aprovado, revisado |

### 4.2 Historico de RDO (`/rdo/history`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Timeline | Visualizacao cronologica dos RDOs |
| Filtros | Por data, obra, responsavel, status |
| Visualizacao completa | Detalhamento de cada RDO enviado |
| Exportacao PDF | Geracao de relatorio PDF do RDO |
| Busca | Busca textual nos RDOs |

---

## 5. HUB DE NOTICIAS E LICITACOES

### 5.1 Hub de Noticias (`/hub-noticias`)

| Funcionalidade | Descricao |
|----------------|-----------|
| 4 Abas navegaveis | Noticias, Licitacoes, Vinculos, Indicadores |
| Cards de resumo | Contadores: total noticias, licitacoes, empresas, valor total |
| Filtros | Busca textual, filtro por categoria, estado, tipo |
| Responsivo | Layout otimizado para mobile e desktop |
| Skeleton loading | Indicador visual durante carregamento |

### 5.2 Licitacoes (`/licitacoes`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Coleta automatica PNCP | Edge Function coleta do Portal Nacional de Contratacoes Publicas |
| Filtro por estado | Selecao de UF para busca direcionada |
| Filtro por valor | Faixa de valores de interesse |
| Filtro por orgao | Busca por orgao licitante |
| Detalhes da licitacao | Modal com informacoes completas |
| Link para edital | Acesso direto ao edital no portal oficial |
| Monitoramento | Acompanhamento de licitacoes de interesse |

### 5.3 Vinculos e Empresas

| Funcionalidade | Descricao |
|----------------|-----------|
| Cadastro de empresas | Base de empresas do setor de saneamento |
| Busca por empresa | Filtragem por nome, CNPJ, cidade |
| Dados cadastrais | Razao social, CNPJ, endereco, contatos |
| Vinculos contratuais | Historico de contratos e vinculos |

### 5.4 Indicadores

| Funcionalidade | Descricao |
|----------------|-----------|
| Graficos de categoria | Distribuicao de licitacoes por categoria |
| Distribuicao por estado | Mapa de calor por UF |
| Valores consolidados | Totalizacao de valores por categoria/estado |
| Tendencias | Evolucao temporal de indicadores |

---

## 6. CRM E COMERCIAL

### 6.1 CRM (`/crm`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Cadastro de contatos | Gestao completa de contatos e leads |
| Pipeline de vendas | Funil de vendas visual com arraste |
| Categorias | Classificacao: prospect, lead, cliente, parceiro |
| Historico de interacoes | Registro de contatos, reunioes, propostas |
| Tarefas relacionadas | Tarefas vinculadas a contatos |
| Busca e filtros | Busca por nome, empresa, status |

### 6.2 Orcamentos (`/budgets`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Elaboracao de orcamentos | Criacao de orcamentos com base SINAPI |
| Composicoes | Composicoes de custo unitario |
| BDI integrado | Aplicacao automatica do BDI calculado |
| Versoes | Controle de versoes do orcamento |
| Comparativo | Comparacao entre versoes e cenarios |

---

## 7. RH E EQUIPES

### 7.1 Recursos Humanos (`/rh`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Gestao de equipes | Organizacao de equipes por obra |
| Escalas de trabalho | Configuracao de turnos e escalas |
| Alocacao de pessoal | Distribuicao de mao-de-obra entre frentes |
| Custos de equipe | Calculo de custo homem-hora |

### 7.2 Funcionarios (`/employees`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Cadastro completo | Dados pessoais, funcao, especialidade |
| Documentacao | Controle de ASO, NR, treinamentos |
| Disponibilidade | Status de disponibilidade por periodo |
| Historico | Obras e frentes em que atuou |

---

## 8. MATERIAIS E ALMOXARIFADO

### 8.1 Catalogo de Materiais (`/materials`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Cadastro de itens | Base de materiais com codigo, descricao, unidade |
| Categorias | Organizacao por categoria (tubos, conexoes, equipamentos) |
| Precos de referencia | Vinculacao com base SINAPI |
| Fichas tecnicas | Upload de datasheets e especificacoes |

### 8.2 Controle de Materiais (`/material-control`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Entradas e saidas | Registro de movimentacoes de estoque |
| Saldo atual | Visualizacao de estoque em tempo real |
| Alertas de estoque | Notificacao quando abaixo do minimo |
| Rastreabilidade | Historico de movimentacoes por item |

### 8.3 Pedidos de Material (`/material-requests`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Solicitacao de compra | Formulario de pedido com justificativa |
| Fluxo de aprovacao | Aprovacao multinivel (solicitante → coordenador → compras) |
| Status em tempo real | Notificacoes via Realtime (aprovado, em separacao, entregue) |
| Historico de pedidos | Rastreamento completo dos pedidos |

### 8.4 Inventario (`/inventory`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Inventario fisico | Conferencia de estoque vs sistema |
| Divergencias | Identificacao e tratativa de diferencas |
| Controle por obra | Estoque segregado por obra |
| Relatorios | Resumo de inventario e movimentacoes |

---

## 9. MANUTENCAO E ATIVOS

### 9.1 Solicitacoes de Manutencao (`/maintenance-requests`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Abertura de OS | Ordem de servico para manutencao |
| Classificacao | Corretiva, preventiva, preditiva |
| Prioridade | Urgente, alta, media, baixa |
| Atribuicao | Designacao de responsavel |
| Acompanhamento | Timeline da OS ate conclusao |

### 9.2 Tarefas de Manutencao (`/maintenance-tasks`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Plano de manutencao | Cronograma de manutencoes preventivas |
| Checklist de execucao | Lista de verificacao por tipo de ativo |
| Registro de execucao | Historico de manutencoes realizadas |
| Custos | Controle de custos de manutencao |

### 9.3 QR Codes de Ativos (`/maintenance-qrcodes`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Geracao de QR Codes | QR Code unico por equipamento/ativo |
| Leitura em campo | Scan do QR abre ficha do equipamento no celular |
| Historico do ativo | Timeline de manutencoes por equipamento |
| Impressao de etiquetas | Geracao de etiquetas para fixacao |

---

## 10. DASHBOARDS E ANALYTICS

### 10.1 Dashboard 360 (`/dashboard-360`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Visao consolidada | Todos os indicadores em uma tela |
| KPIs de obra | Avanso, producao, custos, equipes |
| Graficos interativos | Clique para detalhar |
| Periodo configuravel | Filtro por data/periodo |

### 10.2 Dashboard Personalizado (`/custom-dashboard`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Widgets arrastaveis | Monte seu dashboard com drag-and-drop |
| Tipos de widget | Graficos, tabelas, KPIs, mapas |
| Salvar layout | Cada usuario salva sua configuracao |
| Compartilhar | Compartilhar dashboard com equipe |

### 10.3 Metricas de Usuario (`/user-metrics`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Analytics de uso | Quais modulos sao mais acessados |
| Tempo de uso | Duracao de sessao por modulo |
| Atividade por periodo | Frequencia de uso ao longo do tempo |
| Engajamento | Indicadores de engajamento por usuario |

### 10.4 Pesquisa de Satisfacao (`/satisfaction-survey`)

| Funcionalidade | Descricao |
|----------------|-----------|
| NPS (Net Promoter Score) | Pesquisa de satisfacao 0-10 |
| CSAT | Customer Satisfaction Score |
| Feedback textual | Campo aberto para sugestoes |
| Historico de respostas | Evolucao da satisfacao no tempo |

### 10.5 Dashboard de Sentimento (`/sentiment-dashboard`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Analise de sentimento | Classificacao de feedbacks em positivo/neutro/negativo |
| Nuvem de palavras | Termos mais frequentes nos feedbacks |
| Tendencias | Evolucao do sentimento ao longo do tempo |
| Alertas | Deteccao de queda na satisfacao |

### 10.6 QA e Diagnosticos (`/qa-diagnostics`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Diagnostico de qualidade | Verificacao automatica de integridade de dados |
| Testes de consistencia | Validacao cruzada entre modulos |
| Relatorio de saude | Status geral da base de dados e configuracoes |
| Recomendacoes | Sugestoes automaticas de melhoria |

---

## 11. MAPA INTERATIVO E GIS

### 11.1 Mapa Interativo (`/interactive-map`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Mapa Leaflet | Mapa interativo com tiles OpenStreetMap |
| Camadas tematicas | Rede de esgoto, agua, drenagem, PVs |
| Avanso por trecho | Coloracao por status (executado, em execucao, pendente) |
| Popup de informacao | Detalhes do trecho ao clicar |
| Zoom e navegacao | Pan, zoom, localizacao GPS |
| Modo satelite | Alternar entre mapa e imagem de satelite |
| Importacao de dados | Carregamento de coordenadas CSV/SHP |

---

## 12. ADMINISTRACAO E CONFIGURACOES

### 12.1 Painel Administrativo (`/admin`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Gestao de usuarios | Criar, editar, desativar usuarios |
| Roles e permissoes | Atribuicao de papeis (admin, engenheiro, encarregado, tecnico) |
| Logs de atividade | Auditoria de acoes no sistema |
| Configuracoes globais | Parametros da plataforma |
| Visao de uso | Metricas de utilizacao por usuario/modulo |

### 12.2 Configuracoes (`/settings`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Perfil do usuario | Nome, email, foto, dados pessoais |
| Preferencias | Tema, idioma, notificacoes |
| Seguranca | Alteracao de senha, MFA |
| Integracao | Configuracao de APIs externas |

### 12.3 Alertas (`/alerts`)

| Funcionalidade | Descricao |
|----------------|-----------|
| Configuracao de alertas | Tipos de alerta: RDO, producao, estoque, manutencao |
| Canais de notificacao | Email, push notification, in-app |
| Regras de alerta | Condicoes personalizaveis para disparo |
| Historico de alertas | Log de todos os alertas enviados |
| Alertas em tempo real | Notificacoes instantaneas via Supabase Realtime |

---

## 13. EXPORTACOES E INTEGRACAO

### 13.1 Formatos de Exportacao

| Formato | Modulos | Descricao |
|---------|---------|-----------|
| PDF | RDO, Orcamento, Relatorios | Documentos formatados para impressao |
| Excel (.xlsx) | Quantitativos, Orcamento, Producao | Planilhas editaveis |
| CSV | Dados tabulares gerais | Formato universal |
| SHP (Shapefile) | Mapa, Rede | Para uso em QGIS/ArcGIS |
| GeoJSON | Mapa, Rede | Formato GIS web |
| KML | Mapa, Rede | Para Google Earth |
| INP (EPANET) | Simulacao | Formato nativo do EPANET |

### 13.2 Integracoes Externas

| Integracao | Status | Descricao |
|------------|--------|-----------|
| PNCP (Licitacoes) | Ativo | Coleta automatica via API publica |
| OpenWeatherMap | Ativo | Dados climaticos para RDO |
| EPANET (WASM) | Ativo | Simulacao hidraulica no navegador |
| Leaflet + OSM | Ativo | Mapas interativos |
| UTMify | Ativo | Tracking de conversoes |
| Supabase Realtime | Ativo | Notificacoes em tempo real |

---

## 14. SEGURANCA E INFRAESTRUTURA

### 14.1 Autenticacao e Acesso

| Funcionalidade | Descricao |
|----------------|-----------|
| Email e senha | Autenticacao tradicional via Supabase Auth |
| Recuperacao de senha | Fluxo de reset por email |
| Sessoes seguras | JWT com refresh token automatico |
| RLS (Row Level Security) | Isolamento de dados por usuario/empresa |

### 14.2 Infraestrutura

| Componente | Tecnologia | Descricao |
|------------|-----------|-----------|
| Frontend | React + Vite + TypeScript | SPA com code splitting |
| UI | Tailwind CSS + shadcn/ui | Componentes modernos e responsivos |
| Backend | Supabase (PostgreSQL) | BaaS com Auth, Storage, Realtime |
| Edge Functions | Deno (Supabase) | 14 funcoes serverless |
| Hospedagem | Vercel | CDN global, SSL automatico |
| Dominio | construdata.software | Via Hostinger + Vercel DNS |

### 14.3 Funcoes Edge (Serverless)

| Funcao | Descricao |
|--------|-----------|
| `check-rdo-compliance` | Verificacao de conformidade de RDO com alertas e escalacao |
| `collect-pncp` | Coleta de licitacoes do PNCP |
| `send-alert` | Envio de alertas por email/push |
| `generate-pdf` | Geracao de PDFs de relatorios |
| `weather-data` | Consulta de dados climaticos |
| + 9 outras funcoes | Funcoes auxiliares do sistema |

---

## RESUMO QUANTITATIVO

| Categoria | Quantidade |
|-----------|-----------|
| **Modulos de calculo (engines)** | 12 |
| **Paginas/interfaces** | 40+ |
| **Normas tecnicas atendidas** | 5+ (NBR 9649, 12218, 10844, TCU 2622, CAESB NTS) |
| **Edge Functions** | 14 |
| **Formatos de exportacao** | 7 (PDF, Excel, CSV, SHP, GeoJSON, KML, INP) |
| **Integracoes externas** | 6+ |
| **Tipos de dashboard** | 6 |
| **Modulos de gestao** | 15+ |

---

*Documento gerado em Marco/2026 — ConstruData HydroNetwork v1.0*
*Revisao a cada release com novas funcionalidades*
