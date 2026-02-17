# ConstruData + HydroNetwork — Plataforma de Engenharia Integrada

## O que a plataforma faz

**ConstruData** e **HydroNetwork** formam uma plataforma única e integrada para engenheiros, projetistas e construtoras que trabalham com **obras de saneamento, infraestrutura hidráulica e gestão de obras civis**. Tudo funciona 100% online, no navegador, sem necessidade de instalação.

---

## Problemas que Resolve

### 1. Fragmentação de Ferramentas
**Problema:** Engenheiros usam 5-10 softwares diferentes (AutoCAD, EPANET, Excel, ERPs, Word) para um único projeto, gerando retrabalho, erros de transcrição e perda de dados.

**Solução:** Uma plataforma única onde os dados fluem da topografia ao RDO sem redigitação. Importe uma vez, use em todos os módulos.

### 2. Cálculos Manuais e Demorados
**Problema:** Dimensionamento de redes, orçamentos SINAPI e cronogramas são feitos manualmente em planilhas, sujeitos a erros e consumindo semanas.

**Solução:** Motores de cálculo integrados (Manning, Hazen-Williams, EPANET) que dimensionam automaticamente redes de esgoto, água e drenagem. Orçamentos SINAPI gerados em segundos.

### 3. Falta de Rastreabilidade
**Problema:** RDOs (Relatórios Diários de Obra) em papel, fotos perdidas, histórico inexistente, dificuldade em comprovar serviços executados.

**Solução:** RDO digital com fotos de validação, GPS, dados climáticos automáticos, histórico completo e exportação em PDF.

### 4. Análise de Viabilidade de Contratos
**Problema:** Empresas calculam BDI em planilhas frágeis, sem padronização TCU, sem simulação de cenários.

**Solução:** Módulo BDI completo com fórmula TCU (Acórdão 2622/2013), composição detalhada, simulação de cenários, análise de viabilidade orçado vs. edital.

### 5. Manutenção Predial Desorganizada
**Problema:** Edificações com centenas de ativos (elevadores, bombas, HVAC) sem controle de manutenção preventiva.

**Solução:** Gestão predial com QR Codes para ativos, kanban de tarefas, relatórios de consumo e dashboards de performance.

---

## Módulos Principais

### 🌊 HydroNetwork — Engenharia de Saneamento
| Módulo | Função |
|--------|--------|
| **Topografia** | Importa CSV, TXT, XLSX, DXF. Renderiza pontos e segmentos no mapa Leaflet com conversão UTM↔LatLon |
| **Rede de Esgoto** | Dimensionamento por gravidade conforme NBR 9649. Cálculo de vazão, velocidade, declividade |
| **Rede de Água** | Dimensionamento pressurizado conforme NBR 12211/12218 |
| **Drenagem** | Dimensionamento pluvial conforme NBR 10844 |
| **Quantitativos** | Geração automática de quantitativos (escavação, reaterro, tubulação, PVs) |
| **Orçamento** | Orçamento automático com base SINAPI/SICRO. BDI configurável |
| **Planejamento** | Cronograma Gantt, Curva S, alocação de equipes, caminho crítico |
| **EPANET** | Simulação hidráulica básica |
| **EPANET PRO** | Simulação completa via WebAssembly (epanet-js). Import/export .INP. Resultados por pressão e velocidade |
| **SWMM** | Simulação de drenagem urbana (em desenvolvimento) |
| **RDO Hydro** | Relatório Diário de Obra específico para saneamento |
| **Perfil Longitudinal** | Visualização SVG do perfil da rede com terreno, greide, PVs |
| **BDI** | Cálculo de BDI conforme TCU. Cadastro de contratos, simulação de cenários, viabilidade |
| **Revisão por Pares** | Verificação normativa automática |
| **Exportação GIS** | Shapefile, GeoJSON, GeoPackage, KML, DXF |

### 🏗️ ConstruData Obras — Gestão de Obras
| Módulo | Função |
|--------|--------|
| **Dashboard** | Visão geral com indicadores de produção, clima, alertas |
| **Controle de Produção** | Acompanhamento de metas e serviços executados |
| **RDO Digital** | Relatório Diário de Obra com fotos, GPS, clima |
| **Alertas Inteligentes** | Notificações automáticas por condições configuráveis |
| **Relatório de Ligações** | Relatórios de ligações de água/esgoto com materiais e fotos |
| **Ocorrências** | Registro e acompanhamento de ocorrências em obra |
| **Materiais** | Controle de materiais e almoxarifado |
| **Funcionários** | Cadastro de equipes e colaboradores |
| **RH** | Escalas CLT, férias, faltas, custo primo |
| **CRM** | Gestão de clientes, contatos, negócios |
| **Gestão Predial** | Manutenção de edificações com QR Codes |
| **Backup** | Exportação e backup de dados |

---

## Formatos Suportados

### Importação
- **CSV, TXT** — Pontos topográficos (X, Y, Z)
- **XLSX, XLS** — Planilhas de dados
- **DXF** — Desenho CAD (entidades POINT, LINE, POLYLINE)
- **INP** — Modelo EPANET

### Exportação
- **CSV** — Dados tabulares
- **Excel (.xlsx)** — Planilhas formatadas
- **GeoJSON** — Dados geoespaciais
- **DXF** — Desenho CAD
- **Shapefile (.shp)** — GIS
- **GeoPackage (.gpkg)** — GIS SQLite
- **KML** — Google Earth
- **PDF** — Relatórios

---

## Motores de Cálculo

1. **Manning** — Escoamento em canais e tubulações por gravidade
2. **Hazen-Williams** — Perda de carga em redes pressurizadas
3. **EPANET (WebAssembly)** — Simulação hidráulica completa via epanet-js

---

## Normas Técnicas Atendidas

- **NBR 9649** — Projeto de Redes Coletoras de Esgoto
- **NBR 12211** — Estudos de Concepção de Sistemas de Abastecimento de Água
- **NBR 12218** — Projeto de Rede de Distribuição de Água
- **NBR 10844** — Instalações de Drenagem Pluvial
- **SINAPI 2025** — Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil
- **SICRO** — Sistema de Custos Referenciais de Obras (DNIT)
- **Acórdão TCU 2622/2013** — Referência para cálculo de BDI

---

## Tecnologia

- **Frontend:** React 18, TypeScript, Tailwind CSS, Shadcn/UI
- **Mapas:** Leaflet com múltiplos tile layers (OSM, Satélite, Topográfico)
- **Gráficos:** Recharts, Chart.js
- **Backend:** Lovable Cloud (Supabase)
- **Simulação:** epanet-js (EPANET via WebAssembly)
- **Coordenadas:** UTM SIRGAS 2000 (EPSG:31983) ↔ WGS84 (EPSG:4326)

---

## Para Quem

- Empresas de saneamento e infraestrutura
- Escritórios de engenharia e projetos
- Construtoras de obras civis
- Concessionárias de água e esgoto (SABESP, SAAE, DAE, BRK)
- Prefeituras e órgãos públicos
- Engenheiros autônomos e consultores

---

## Acesso

- **Plano DEMO:** Gratuito, sem cadastro obrigatório, sem cartão de crédito
- **Plano PRO:** Capacidade ilimitada para projetos profissionais
- **100% Online:** Funciona no navegador, sem instalação
