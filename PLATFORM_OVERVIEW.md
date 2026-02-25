# ConstruData — HydroNetwork: Visão Geral da Plataforma

> Documento de referência para geração de conteúdo, apresentações comerciais e materiais de divulgação.

---

## O que é o ConstruData HydroNetwork?

O **ConstruData HydroNetwork** é uma plataforma web completa para engenharia de saneamento que integra mais de 30 módulos em um único ambiente. Da topografia ao RDO (Relatório Diário de Obra), os dados fluem automaticamente entre os módulos, eliminando redigitação e fragmentação de ferramentas.

A plataforma é **100% online**, funciona diretamente no navegador (sem instalação), e é **gratuita**.

---

## Problema que Resolve

Engenheiros de saneamento enfrentam:

- **Fragmentação de ferramentas:** 5-10 softwares diferentes para um único projeto (AutoCAD, EPANET, Excel, ERPs)
- **Processos manuais:** Dimensionamento, orçamento e cronogramas feitos em planilhas
- **Custos elevados:** Licenças de softwares isolados custam dezenas de milhares de reais por ano
- **Falta de rastreabilidade:** RDOs em papel, fotos perdidas, histórico inexistente
- **Retrabalho constante:** Dados redigitados entre softwares geram erros e perda de tempo

---

## Módulos e Funcionalidades

### Engenharia de Redes (HydroNetwork Core)

| Módulo | Descrição |
|--------|-----------|
| **Topografia Inteligente** | Importação automática de dados topográficos em CSV, TXT, XLSX, DXF, SHP, GeoJSON e LandXML. Processamento de coordenadas X, Y, Z e geração automática de trechos. |
| **Rede de Esgoto** | Dimensionamento de redes por gravidade e elevatória. Cálculo de declividades, diâmetros e velocidades. Verificação automática ABNT (NBR 9649). |
| **Rede de Água** | Projeto de redes pressurizadas com cálculo de pressão, velocidade e perdas de carga. Conformidade com NBR 12211/12218. |
| **Drenagem Pluvial** | Dimensionamento de galerias e estruturas pelo método racional. Tempo de concentração e capacidade de escoamento. NBR 10844. |
| **Quantitativos** | Cálculo automático de volumes de escavação, reaterro, tubulação, PVs e serviços complementares, por trecho. |
| **Orçamento e Custos** | Composições SINAPI/SICRO vinculadas por trecho. Visualização de custos no mapa interativo com faixas de cor. |
| **BDI (TCU)** | Cálculo de BDI conforme Acórdão TCU 2622/2013. Composição detalhada com simulação de cenários. |
| **Planejamento de Obra** | Cronograma executivo com Gantt interativo, Curva S automática, EVM (Earned Value Management) e caminho crítico. |

### Simulação e Análise

| Módulo | Descrição |
|--------|-----------|
| **EPANET (Motor Nativo)** | Simulação hidráulica integrada com exportação de arquivos .INP. Análise de pressão e vazão por trecho. |
| **EPANET PRO (WebAssembly)** | Motor EPANET completo compilado para WebAssembly (epanet-js). Import/export de .INP. Resultados visuais por pressão e velocidade. Execução 100% no navegador. |
| **SWMM** | Modelagem de drenagem urbana com análise de escoamento, capacidade de galerias e cenários de chuva. |
| **Perfil Longitudinal** | Visualização SVG do corte vertical da rede com escalas configuráveis e exagero vertical. Terreno + greide. |
| **Mapa Interativo** | Mapa Leaflet georreferenciado com codificação por cores, status por trecho e popup técnico. |

### Integrações e Exportação

| Módulo | Descrição |
|--------|-----------|
| **OpenProject** | Integração com OpenProject para gestão ágil. Criação automática de Work Packages. |
| **ProjectLibre** | Exportação de cronograma compatível com ProjectLibre e MS Project. |
| **QGIS** | Exportação com camadas vetoriais em Shapefile, GeoJSON e GeoPackage. |
| **Exportação GIS** | Multi-formato: Shapefile, GeoJSON, GeoPackage, KML/KMZ, DXF e CSV. |
| **Revisão por Pares** | Workflow automatizado de verificação técnica com checklist normativo ABNT. |

### Diário de Obra (RDO)

| Módulo | Descrição |
|--------|-----------|
| **RDO Digital** | Relatório Diário de Obra especializado para saneamento. Avanço por trecho com fotos, GPS e clima. |
| **RDO x Planejamento** | Curva S comparativa (Planejado vs. Executado). Alertas automáticos de atraso. |
| **Mapa de Progresso RDO** | Visualização georreferenciada do progresso da obra com dados do RDO. |
| **Controle de Produção** | Dashboard de produtividade com métricas por frente de serviço. |
| **Fotos de Validação** | Registro fotográfico geotagueado para comprovação de serviços executados. |

### Gestão Operacional (ConstruData Obras)

| Módulo | Descrição |
|--------|-----------|
| **Dashboard 360°** | KPIs em tempo real: produção, materiais, equipes e indicadores financeiros. |
| **Materiais & Almoxarifado** | Controle de estoque com importação de planilhas e histórico de preços. |
| **Gestão de Equipes** | Cadastro, alocação por frente de serviço e controle de produtividade. |
| **Alertas Inteligentes** | Notificações automáticas por regras configuráveis. |
| **QR Codes de Manutenção** | QR Codes para ativos com formulário web de abertura de chamados. |
| **Gestão Predial** | Manutenção de edificações com kanban, relatórios de consumo e dashboards. |
| **CRM** | Gestão de clientes, contatos, pipeline de negócios e atividades comerciais. |
| **RH & Escalas CLT** | Escalas de trabalho conformes CLT, controle de férias e custo primo. |
| **Backup & Exportação** | Exportação completa de dados em ZIP e backup de todas as tabelas. |

---

## Diferenciais Competitivos

| Funcionalidade | Planilhas | Outros Softwares | HydroNetwork |
|---------------|-----------|-------------------|--------------|
| Pré-dimensionamento automático de redes | Não | Não | Sim |
| Simulação EPANET integrada | Não | Parcial | Sim |
| Simulação SWMM integrada | Não | Não | Sim |
| Orçamento SINAPI/SICRO por trecho | Não | Não | Sim |
| Mapa interativo com custos | Não | Não | Sim |
| Gantt + Curva S + EVM | Não | Parcial | Sim |
| Exportação QGIS / Shapefile / DXF | Não | Parcial | Sim |
| RDO Digital por trecho | Não | Não | Sim |
| Revisão técnica automatizada | Não | Não | Sim |
| 100% Online — sem instalação | Sim | Parcial | Sim |

---

## Stack Tecnológica

- **Frontend:** React + TypeScript + Tailwind CSS + shadcn/ui
- **Mapas:** Leaflet com suporte a múltiplos tile layers
- **Simulação:** EPANET via WebAssembly (epanet-js)
- **Gráficos:** Recharts para dashboards e métricas
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **GIS:** Exportação nativa para Shapefile, GeoJSON, GeoPackage, KML/KMZ, DXF
- **Hospedagem:** 100% web, sem instalação necessária

---

## Fluxo de Trabalho — 8 Etapas Integradas

```
Topografia → Dimensionamento → Orçamento → Simulação → Planejamento → Revisão → Execução → Exportação
```

1. **Topografia:** Upload de dados CAD, CSV, SHP ou DXF
2. **Dimensionamento:** Cálculo automático de redes (esgoto, água, drenagem)
3. **Orçamento:** Composições SINAPI/SICRO por trecho
4. **Simulação:** EPANET (pressão) e SWMM (drenagem)
5. **Planejamento:** Gantt, Curva S e caminho crítico
6. **Revisão:** Peer Review com checklist normativo
7. **Execução:** RDO Digital com avanço por trecho
8. **Exportação:** GIS, DXF, PDF e relatórios

---

## Normas ABNT Suportadas

- **NBR 9649** — Projeto de redes coletoras de esgoto sanitário
- **NBR 12211** — Estudos de concepção de sistemas de abastecimento de água
- **NBR 12218** — Projeto de rede de distribuição de água
- **NBR 10844** — Instalações de águas pluviais
- **Acórdão TCU 2622/2013** — Cálculo de BDI para obras públicas
- **SINAPI/SICRO** — Composições de custo para orçamentação

---

## Formatos de Exportação Suportados

- CSV / Excel (XLSX)
- DXF (AutoCAD)
- Shapefile (.shp + .dbf + .shx + .prj)
- GeoJSON
- GeoPackage (.gpkg)
- KML / KMZ (Google Earth)
- .INP (EPANET / SWMM)
- PDF (relatórios)
- XML (ProjectLibre / MS Project)
- ZIP (backup completo do projeto)

---

## Métricas de Impacto

- **30+** módulos integrados
- **87%** mais rápido que processos manuais
- **35%** economia média em projetos
- **99%** precisão técnica nos cálculos
- **8+** formatos de exportação
- **3** motores de cálculo (EPANET, SWMM, Motor interno)
- **6** normas ABNT integradas

---

## Público-Alvo

- Engenheiros civis e sanitaristas
- Projetistas de redes de saneamento
- Empresas de consultoria em saneamento
- Construtoras de obras de infraestrutura
- Órgãos públicos (Sabesp, Copasa, Sanepar, etc.)
- Fiscais de obra
- Estudantes de engenharia

---

## Contato

- **Email:** construdata.contato@gmail.com
- **LinkedIn:** [ConstruData Software](https://www.linkedin.com/company/construdatasoftware)
- **Plataforma:** Acesso direto pelo navegador

---

> Este documento pode ser utilizado como base para geração de conteúdo em redes sociais, apresentações, propostas comerciais e materiais de marketing.
