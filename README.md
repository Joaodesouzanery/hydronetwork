# ConstruData — HydroNetwork

**A Engenharia de Saneamento Reimaginada**

Plataforma completa e 100% online para engenharia de saneamento e gestao de obras. Integra mais de 30 modulos — do levantamento topografico ao diario de obra digital — eliminando planilhas dispersas, redigitacao e softwares fragmentados.

---

## Por que o HydroNetwork?

| Problema | Solucao |
|----------|---------|
| Engenheiros usam 5-10 softwares diferentes para um unico projeto | Uma plataforma unica com todos os modulos integrados |
| Dados precisam ser redigitados entre ferramentas | Fluxo automatico — dado entra uma vez e propaga para todos os modulos |
| Softwares caros com licencas por maquina | 100% online, gratuito, roda no navegador |
| Resultados manuais propensos a erro | Calculos automatizados com conformidade ABNT |
| Falta de rastreabilidade entre projeto e execucao | RDO digital vinculado ao planejamento com comparativo planejado vs. executado |

---

## Funcionalidades

### Topografia Inteligente
- Importacao de multiplos formatos: **CSV, TXT, XLSX, DXF, SHP, GeoJSON, LandXML, GeoTIFF, IFC**
- Extracao automatica de curvas de nivel a partir de rasters (TIF/GeoTIFF)
- Interpolacao de terreno para cotas automaticas
- Transformacao de coordenadas (UTM ↔ Geograficas) com suporte a fusos brasileiros
- Visualizacao interativa no mapa com Leaflet

### Redes de Esgoto (QEsg)
- Pre-dimensionamento automatico de redes coletoras de esgoto por gravidade
- Conformidade com **ABNT NBR 9649** (Projeto de redes coletoras de esgoto sanitario)
- Calculo de vazoes (inicio e fim de plano), tensao trativa, velocidade critica
- Verificacao automatica de lamina d'agua, declividade minima e recobrimento
- Dimensionamento de trechos com diametro minimo DN 150mm

### Redes de Agua (QWater)
- Pre-dimensionamento de redes de distribuicao de agua
- Conformidade com **ABNT NBR 12211/12218**
- Calculo de pressoes, perdas de carga (Hazen-Williams) e velocidades
- Verificacao de pressao minima e maxima nos nos

### Simulacao Hidraulica — EPANET
- **EPANET Motor**: simulacao hidraulica nativa integrada ao navegador
- **EPANET PRO**: implementacao via WebAssembly para simulacoes de alta performance
- Importacao e exportacao de arquivos `.inp`
- Resultados de pressao, vazao e velocidade por trecho e no

### Simulacao de Drenagem — SWMM
- Modelagem de drenagem urbana
- Metodo racional para dimensionamento de galerias
- Conformidade com **ABNT NBR 10844**

### Drenagem Pluvial
- Calculo pelo metodo racional
- Dimensionamento de galerias e bocas de lobo
- Intensidade pluviometrica por regiao

### Quantitativos Automaticos
- Geracao automatica de quantitativos a partir da geometria da rede
- Volumes de escavacao, reaterro e bota-fora
- Metragem de tubulacao por diametro e material
- Quantidade de pocos de visita (PVs) e conexoes

### Orcamento com SINAPI/SICRO
- Composicoes de custo baseadas nas tabelas **SINAPI** e **SICRO**
- Vinculacao automatica de servicos por trecho da rede
- Calculo de BDI conforme **Acordao TCU 2622/2013**
- Curva ABC de insumos e servicos

### Planejamento de Obra (Gantt)
- Cronograma interativo com grafico de Gantt
- **Curva S** automatica (prevista vs. realizada)
- Analise de Valor Agregado (**EVM**): CPI, SPI, EAC, ETC
- Caminho critico
- Salvamento e versionamento de planos
- Compartilhamento de planejamentos entre usuarios

### LPS — Last Planner System
- Planejamento colaborativo de curto prazo
- Restricoes com tags, prazos e responsaveis
- Campos enriquecidos e graficos de acompanhamento
- Persistencia local (localStorage)

### Lean Construction — Restricoes
- Cadastro e acompanhamento de restricoes
- Classificacao por tipo, area e criticidade
- Analise 5 Porques (5 Whys)
- Painel de acoes corretivas
- Calculo de PPC (Percentual de Pacotes Concluidos)
- Compromissos semanais com historico
- Dashboard com KPIs: taxa de resolucao, tempo medio, areas criticas
- Notificacoes de prazo
- Exportacao de dados Lean

### RDO — Diario de Obra Digital
- Registro diario de obra completo (clima, equipe, equipamentos, atividades)
- Vinculacao de progresso por trecho da rede
- Comparativo **planejado vs. executado** com desvios
- Historico e galeria de fotos
- Importacao de RDOs existentes (PDF, planilha)

### Mapa Interativo
- Visualizacao georeferenciada de toda a rede com **Leaflet**
- Coloracao por tipo de rede (esgoto, agua, drenagem)
- Camada de restricoes Lean no mapa
- Status de execucao por trecho (nao iniciado, em andamento, concluido)
- Curvas de nivel sobrepostas

### Controle de Producao
- Dashboard 360 com KPIs de obra
- Graficos de produtividade por equipe
- Acompanhamento de materiais e estoque
- Alertas inteligentes configuraveis

### Revisao Tecnica Automatizada
- Checklist automatico de conformidade com normas ABNT
- Verificacao de parametros hidraulicos
- Relatorio de peer review

### QA — Diagnosticos de Qualidade
- Pagina dedicada a diagnosticos e testes do sistema
- Verificacao de integridade dos dados

---

## Integracoes e Exportacao

| Formato | Importar | Exportar |
|---------|----------|----------|
| CSV / TXT / XLSX | Sim | Sim |
| DXF (AutoCAD / CIVIL 3D) | Sim | Sim |
| SHP (Shapefile) | Sim | Sim |
| GeoJSON | Sim | Sim |
| GeoTIFF / TIF | Sim | — |
| IFC (BIM) | Sim | — |
| LandXML | Sim | — |
| KML / KMZ (Google Earth) | — | Sim |
| GeoPackage | — | Sim |
| INP (EPANET) | Sim | Sim |
| PDF (Relatorios) | — | Sim |
| MS Project / ProjectLibre | — | Sim |

### Integracoes com ferramentas externas
- **QGIS**: exportacao nativa para Shapefile, GeoJSON e GeoPackage
- **OpenProject**: integracao para gestao de projetos
- **ProjectLibre / MS Project**: exportacao de cronogramas
- **Supabase**: persistencia de dados na nuvem com autenticacao

---

## Stack Tecnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui (Radix) |
| Mapas | Leaflet + React-Leaflet |
| Graficos | Recharts + Chart.js |
| Simulacao | epanet-js (WebAssembly) |
| GIS | shpjs, geotiff, coordenadas nativas |
| PDF | jsPDF + html2pdf.js + html2canvas |
| Planilhas | xlsx (SheetJS) |
| Compactacao | JSZip |
| QR Code | qrcode |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| State | TanStack Query + React Context |
| Formularios | React Hook Form + Zod |
| Deploy | Vercel |

---

## Como Rodar Localmente

```bash
# 1. Clone o repositorio
git clone https://github.com/Joaodesouzanery/hydronetwork.git

# 2. Entre na pasta
cd hydronetwork

# 3. Instale as dependencias
npm install

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

O app estara disponivel em `http://localhost:5173`.

### Outros comandos

```bash
npm run build          # Build de producao
npm run build:dev      # Build de desenvolvimento
npm run preview        # Preview do build
npm run lint           # Verificacao de codigo
npm run build:share    # Build em arquivo unico (single-file)
```

---

## Estrutura do Projeto

```
src/
├── components/
│   ├── hydronetwork/          # Modulos de engenharia hidraulica
│   │   ├── modules/           # 16 modulos especializados
│   │   ├── panels/            # Paineis de dimensionamento (QEsg/QWater)
│   │   ├── TopographyMap.tsx   # Mapa topografico interativo
│   │   ├── UnifiedImportPanel.tsx  # Importacao unificada multi-formato
│   │   ├── PlanningModule.tsx  # Planejamento Gantt + Curva S
│   │   └── ...
│   ├── lean-constraints/      # Modulo Lean Construction
│   └── planning/              # Utilitarios de planejamento
├── engine/                    # Motores de calculo
│   ├── qesgEngine.ts          # Dimensionamento de esgoto
│   ├── qwaterEngine.ts        # Dimensionamento de agua
│   ├── hydraulics.ts          # Calculos hidraulicos base
│   ├── budget.ts              # Orcamentacao SINAPI/SICRO
│   ├── lps.ts                 # Last Planner System
│   ├── rdo.ts                 # Diario de Obra
│   ├── tifReader.ts           # Parser GeoTIFF
│   ├── shpReader.ts           # Parser Shapefile
│   ├── ifcReader.ts           # Parser IFC (BIM)
│   ├── dxfReader.ts           # Parser DXF
│   ├── coordinateTransform.ts # Transformacao de coordenadas
│   ├── contourExtractor.ts    # Extracao de curvas de nivel
│   ├── terrainInterpolation.ts # Interpolacao de terreno
│   └── ...
├── pages/                     # Paginas da aplicacao
│   ├── HydroNetwork.tsx        # Hub principal de engenharia
│   ├── InteractiveMap.tsx      # Mapa interativo
│   ├── LeanConstraints.tsx     # Gestao de restricoes
│   ├── LeanDashboard.tsx       # Dashboard Lean
│   ├── QADiagnostics.tsx       # Diagnosticos QA
│   └── ...
├── hooks/                     # React hooks customizados
├── contexts/                  # Contextos (Auth, etc.)
└── types/                     # Tipos TypeScript
```

---

## Normas Atendidas

- **ABNT NBR 9649** — Projeto de redes coletoras de esgoto sanitario
- **ABNT NBR 12211** — Estudos de concepcao de sistemas de abastecimento de agua
- **ABNT NBR 12218** — Projeto de rede de distribuicao de agua
- **ABNT NBR 10844** — Instalacoes de aguas pluviais
- **Acordao TCU 2622/2013** — Calculo de BDI
- **SINAPI** — Sistema Nacional de Pesquisa de Custos e Indices
- **SICRO** — Sistema de Custos Referenciais de Obras

---

## Contato

- **Email**: construdata.contato@gmail.com
- **LinkedIn**: [ConstruData Software](https://www.linkedin.com/company/construdata-software)
- **Agendar Demo**: [Calendly](https://calendly.com/joaodsouzanery/apresentacao-personalrh)

---

## Licenca

Projeto proprietario — ConstruData Software. Todos os direitos reservados.
