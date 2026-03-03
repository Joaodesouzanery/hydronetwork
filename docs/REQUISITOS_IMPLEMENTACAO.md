# Requisitos para Implementacao — ConstruData HydroNetwork

> Documento completo de tudo que o usuario/cliente precisa fornecer e saber para implementar a plataforma ConstruData HydroNetwork em seus projetos de engenharia de saneamento.

**Versao:** 1.0 | **Data:** Março 2026 | **Dominio:** construdata.software

---

## Sumario

1. [Dados Topograficos](#1-dados-topograficos)
2. [Dados da Rede de Esgoto](#2-dados-da-rede-de-esgoto)
3. [Dados da Rede de Agua](#3-dados-da-rede-de-agua)
4. [Dados de Drenagem Pluvial](#4-dados-de-drenagem-pluvial)
5. [Dados para Orcamento SINAPI/SICRO](#5-dados-para-orcamento-sinapisicro)
6. [Dados para Planejamento de Obra](#6-dados-para-planejamento-de-obra)
7. [Dados para Simulacao EPANET](#7-dados-para-simulacao-epanet)
8. [Dados para Conformidade CAESB/SABESP](#8-dados-para-conformidade-caesbsabesp)
9. [Dados para RDO — Relatorio Diario de Obra](#9-dados-para-rdo--relatorio-diario-de-obra)
10. [Requisitos de Infraestrutura](#10-requisitos-de-infraestrutura)
11. [Formato de Entrega dos Dados](#11-formato-de-entrega-dos-dados)
12. [Glossario Tecnico](#12-glossario-tecnico)

---

## 1. Dados Topograficos

A topografia e a base de todo o projeto. Todos os calculos de dimensionamento, orcamento e planejamento dependem de dados topograficos corretos.

### 1.1 Formatos Aceitos

| Formato | Extensao | Observacao |
|---------|----------|------------|
| CSV / Excel | `.csv`, `.xlsx` | Formato mais simples e recomendado para iniciantes |
| AutoCAD DXF | `.dxf` | Pontos como entidades POINT ou TEXT |
| Shapefile | `.shp` + `.dbf` + `.shx` + `.prj` | Obrigatorio incluir o arquivo `.prj` |
| GeoJSON | `.geojson`, `.json` | Coordinate Reference System no campo `crs` |
| LandXML | `.xml` | Formato de softwares topograficos |

### 1.2 Formato CSV — Requisitos

O CSV deve ter as seguintes colunas (separador: virgula ou ponto-e-virgula):

```csv
id;x;y;z;descricao
PV-01;200345.123;8234567.890;1023.450;Poco de visita existente
PV-02;200356.789;8234578.123;1022.300;Poco de visita projetado
TN-01;200340.000;8234560.000;1024.100;Terreno natural
```

**Colunas obrigatorias:**

| Coluna | Tipo | Descricao | Exemplo |
|--------|------|-----------|---------|
| `id` | texto | Identificador unico do ponto | PV-01, TN-15 |
| `x` ou `easting` | numero | Coordenada Leste (metros) | 200345.123 |
| `y` ou `northing` | numero | Coordenada Norte (metros) | 8234567.890 |
| `z` ou `elevation` | numero | Cota/altitude (metros) | 1023.450 |
| `descricao` | texto | Tipo do ponto (PV, TIL, TN, PI) | Poco de visita |

**Colunas opcionais:**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `tipo` | texto | Classificacao (PV, TIL, TN, PI, Caixa) |
| `profundidade` | numero | Profundidade do PV (metros) |
| `diametro` | numero | Diametro do PV (mm) |

### 1.3 Sistema de Coordenadas

- **Datum obrigatorio:** SIRGAS 2000
- **Projecao recomendada:** UTM (zona conforme a regiao)
- **Zonas UTM do Brasil:**

| Regiao | Zona UTM | Meridiano Central |
|--------|----------|-------------------|
| Distrito Federal | 23S | -45° |
| Sao Paulo | 23S | -45° |
| Rio de Janeiro | 23S | -45° |
| Minas Gerais | 23S | -45° |
| Bahia | 24S | -39° |
| Parana | 22S | -51° |
| Rio Grande do Sul | 22S | -51° |

- Se os dados estiverem em coordenadas geograficas (lat/lon), a plataforma converte automaticamente
- Se usar Shapefile, **inclua sempre o arquivo `.prj`** com a definicao do CRS

### 1.4 Densidade de Pontos

| Tipo de Levantamento | Densidade Minima | Recomendado |
|---------------------|------------------|-------------|
| Rede coletora de esgoto | 1 ponto a cada 50m | 1 ponto a cada 20m |
| Rede de distribuicao de agua | 1 ponto a cada 100m | 1 ponto a cada 50m |
| Drenagem pluvial | 1 ponto a cada 30m | 1 ponto a cada 15m |
| Travessias e interferencias | 1 ponto a cada 5m | 1 ponto a cada 2m |

### 1.5 Dicas para Equipes de Campo

- Nomear pontos com prefixo indicando o tipo: `PV-` (poco de visita), `TIL-` (terminal de limpeza), `TN-` (terreno natural), `PI-` (ponto de inflexao)
- Registrar a profundidade dos PVs existentes
- Levantar todos os cruzamentos com redes existentes (agua, gas, eletrica, telefonia)
- Incluir pontos de terreno natural entre os PVs para perfil longitudinal preciso
- Marcar cotas de fundo dos PVs existentes, nao apenas a tampa

---

## 2. Dados da Rede de Esgoto

### 2.1 Parametros por Trecho (obrigatorios)

| Parametro | Unidade | Descricao | Valor Tipico |
|-----------|---------|-----------|--------------|
| Diametro DN | mm | Diametro nominal do tubo | 150, 200, 250, 300 |
| Declividade | m/m | Inclinacao do trecho | 0.005 a 0.05 |
| Comprimento | m | Extensao do trecho | 20 a 100 |
| Profundidade PV montante | m | Profundidade do poco a montante | 1.0 a 6.0 |
| Profundidade PV jusante | m | Profundidade do poco a jusante | 1.0 a 6.0 |
| Material | texto | PVC, PEAD, Concreto, Ferro Fundido | PVC |

### 2.2 Parametros Calculados Automaticamente

A plataforma calcula automaticamente a partir dos dados topograficos:
- Velocidade (m/s)
- Tensao trativa (Pa)
- Lamina d'agua (Y/D)
- Vazao de contribuicao
- Verificacao de auto-limpeza

### 2.3 Conformidade NBR 9649

| Criterio | Limite | Norma |
|----------|--------|-------|
| Diametro minimo | DN 150mm (CAESB) / DN 100mm (NBR) | CAESB NTS 183 / NBR 9649 |
| Velocidade minima | 0.6 m/s | NBR 9649 §5.2 |
| Velocidade maxima | 5.0 m/s | NBR 9649 §5.2 |
| Tensao trativa minima | 1.0 Pa (CAESB) / 1.5 Pa (SABESP) | NTS 183 / NTS 025 |
| Lamina maxima (Y/D) | 75% | NBR 9649 §5.1 |
| Profundidade minima | 0.90m (passeio) / 1.20m (leito) | NTS 183 §6.2 |
| Espacamento maximo PV | 80m (DN < 400) / 100m (DN >= 400) | NTS 183 §6.4 |

### 2.4 Dados de Populacao e Contribuicao

| Parametro | Unidade | Descricao |
|-----------|---------|-----------|
| Populacao atendida | hab | Populacao de inicio e fim de plano |
| Consumo per capita | L/hab.dia | 150 a 300 (CAESB) |
| Coeficiente de retorno | adimensional | 0.80 (padrao) |
| Taxa de infiltracao | L/s.km | 0.05 a 0.50 |
| K1 (coeficiente de dia max) | adimensional | 1.2 |
| K2 (coeficiente de hora max) | adimensional | 1.5 |

---

## 3. Dados da Rede de Agua

### 3.1 Parametros por Trecho

| Parametro | Unidade | Descricao | Valor Tipico |
|-----------|---------|-----------|--------------|
| Diametro DN | mm | Diametro nominal | 50, 75, 100, 150, 200 |
| Comprimento | m | Extensao do trecho | 20 a 600 |
| Material | texto | PVC, PEAD, Ferro Fundido, Aco | PVC |
| Coeficiente C (Hazen-Williams) | adimensional | Rugosidade do tubo | 130-150 (PVC), 100-120 (FoFo) |

### 3.2 Conformidade NBR 12218

| Criterio | Limite | Norma |
|----------|--------|-------|
| Diametro minimo | DN 50mm | CAESB NTS 181 / NBR 12218 |
| Velocidade minima | 0.6 m/s | NTS 181 §5.3 |
| Velocidade maxima | 3.5 m/s | NTS 181 §5.3 |
| Pressao estatica minima | 10 mca | NTS 181 §4.2 |
| Pressao estatica maxima | 50 mca | NTS 181 §4.2 |
| Pressao dinamica minima | 8 mca | NTS 181 §4.2 |
| Recobrimento minimo (passeio) | 0.50m | NTS 181 §6.1 |
| Recobrimento minimo (leito) | 0.80m | NTS 181 §6.1 |

### 3.3 Dados de Demanda

| Parametro | Unidade | Descricao |
|-----------|---------|-----------|
| Populacao atual e futura | hab | Horizonte de projeto: 20 anos |
| Consumo per capita | L/hab.dia | 150 a 300 L/hab.dia (CAESB) |
| Perdas na distribuicao | % | 20% a 40% (indice de perdas) |
| K1 (coeficiente de dia max) | adimensional | 1.2 |
| K2 (coeficiente de hora max) | adimensional | 1.5 |

### 3.4 Dados de Reservatorios e Boosters

| Parametro | Descricao |
|-----------|-----------|
| Cota do reservatorio | Cota do nivel d'agua (m) |
| Volume do reservatorio | Capacidade total (m³) |
| Cota da bomba | Elevacao da estacao de bombeamento |
| Curva da bomba | Pontos (Q, H) — minimo 3 pontos |
| Pressao de saida | Pressao na saida do booster (mca) |

---

## 4. Dados de Drenagem Pluvial

### 4.1 Parametros Necessarios

| Parametro | Unidade | Descricao |
|-----------|---------|-----------|
| Area de contribuicao | ha | Delimitacao das sub-bacias |
| Coeficiente de escoamento (C) | adimensional | 0.30 (area verde) a 0.95 (asfalto) |
| Tempo de concentracao | min | Tempo de percurso ate o ponto de analise |
| Intensidade de chuva (i) | mm/h | Da equacao IDF local |
| Periodo de retorno (T) | anos | 2, 5, 10, 25, 50 anos |

### 4.2 Equacao IDF (Intensidade-Duracao-Frequencia)

A plataforma necessita dos parametros da equacao IDF local:

```
i = (K * T^a) / (t + b)^c
```

| Parametro | Descricao | Exemplo (Brasilia) |
|-----------|-----------|-------------------|
| K | Constante | 1783.74 |
| a | Expoente de T | 0.174 |
| b | Constante de tempo | 20.65 |
| c | Expoente de t | 0.860 |

### 4.3 Conformidade NBR 10844

| Criterio | Limite |
|----------|--------|
| Velocidade minima | 0.75 m/s |
| Velocidade maxima | 5.0 m/s |
| Lamina maxima | 85% do diametro |
| Declividade minima | conforme diametro |

---

## 5. Dados para Orcamento SINAPI/SICRO

### 5.1 Parametros Obrigatorios

| Parametro | Descricao | Como Obter |
|-----------|-----------|------------|
| Mes de referencia SINAPI | Mes/Ano da base de precos | Ex: Jan/2026 |
| Estado da obra | UF para referencia regional | Ex: DF, SP, MG |
| Onerado/Desonerado | Regime tributario | Verificar com a contratante |
| BDI (%) | Bonificacoes e Despesas Indiretas | Conforme TCU |

### 5.2 BDI — Acordao TCU 2622/2013

| Componente | Faixa Aceitavel TCU |
|------------|---------------------|
| Administracao Central (AC) | 3.00% a 5.50% |
| Seguro e Garantia (S+G) | 0.80% a 1.00% |
| Risco (R) | 0.97% a 1.27% |
| Despesas Financeiras (DF) | 0.59% a 1.39% |
| Lucro (L) | 6.16% a 8.96% |
| ISS | Conforme municipio (2% a 5%) |
| PIS | 0.65% |
| COFINS | 3.00% |
| CPRB | 4.50% (se desonerado) |
| **BDI Total (obras)** | **20.34% a 25.00%** |

### 5.3 Dados de Solo e Escavacao

| Parametro | Opcoes | Impacto no Custo |
|-----------|--------|-----------------|
| Tipo de solo | Normal, Rochoso, Alagado | Rochoso: +200% a +400% |
| Tipo de escavacao | Mecanizada, Manual, Mista | Manual: +150% a +300% |
| Tipo de pavimento | Asfalto, Concreto, Paralelepipedo, Terra | Asfalto: recomposicao obrigatoria |
| Profundidade media | metros | Escavacao profunda (>3m): escoramento |
| Largura da vala | metros | Minimo: DN + 0.60m |

### 5.4 Composicoes Utilizadas

A plataforma utiliza composicoes SINAPI automaticas para:

| Servico | Composicao SINAPI |
|---------|-------------------|
| Escavacao mecanizada | 96995, 96996 |
| Escavacao manual | 96522 |
| Reaterro compactado | 96396 |
| Assentamento tubulacao PVC | 89356, 89357 |
| Poco de visita (PV) | 89709, 89710 |
| Recomposicao asfaltica | 72961 |
| Escoramento continuo | 73948 |
| Lastro de brita | 94993 |

---

## 6. Dados para Planejamento de Obra

### 6.1 Parametros de Entrada

| Parametro | Unidade | Descricao |
|-----------|---------|-----------|
| Data de inicio | data | Data prevista para inicio |
| Numero de equipes | unid | Quantidade de frentes de trabalho |
| Produtividade diaria | m/dia/equipe | Metros lineares por dia por equipe |
| Dias uteis/mes | dias | Normalmente 22 dias |
| Horario de trabalho | horas/dia | Normalmente 8h |

### 6.2 Composicao de Equipe Padrao

| Funcao | Quantidade | Descricao |
|--------|-----------|-----------|
| Encarregado | 1 | Supervisao da equipe |
| Operador retroescavadeira | 1 | Escavacao mecanizada |
| Tubuleiro | 2 | Assentamento de tubulacao |
| Servente | 4 | Apoio geral |
| Motorista caminhao | 1 | Transporte de materiais |

### 6.3 Produtividades de Referencia

| Servico | Produtividade Tipica |
|---------|---------------------|
| Escavacao mecanizada (solo normal) | 30 a 50 m/dia |
| Escavacao manual (solo normal) | 5 a 10 m/dia |
| Assentamento PVC DN 150 | 40 a 60 m/dia |
| Assentamento PVC DN 200 | 30 a 50 m/dia |
| Construcao de PV | 1 a 2 PV/dia |
| Recomposicao asfaltica | 20 a 40 m²/dia |

### 6.4 Calendario

| Parametro | Descricao |
|-----------|-----------|
| Feriados | Lista de feriados nacionais/estaduais/municipais |
| Periodo chuvoso | Meses com chuva frequente (reducao de produtividade) |
| Reducao por chuva | % de reducao na produtividade (normalmente 20-30%) |
| Jornada extraordinaria | Se prevista, em horas/dia |

---

## 7. Dados para Simulacao EPANET

### 7.1 Se ja possui modelo EPANET

- Arquivo `.INP` pronto para importacao direta
- A plataforma le o arquivo e executa via WebAssembly (epanet-js)

### 7.2 Se vai criar modelo do zero

| Parametro | Descricao |
|-----------|-----------|
| Nos (junctions) | Cota, demanda base (L/s) |
| Trechos (pipes) | Comprimento, diametro, rugosidade C |
| Reservatorios | Cota do NA, volume, dimensoes |
| Bombas | Curva Q x H (minimo 3 pontos) |
| Valvulas | Tipo (PRV, PSV, FCV), parametros |
| Padroes de demanda | Fatores horarios (24 valores) |
| Opcoes de simulacao | Unidades, formula de perda de carga |

### 7.3 Coeficientes de Rugosidade (Hazen-Williams C)

| Material | C (novo) | C (10 anos) | C (20 anos) |
|----------|----------|-------------|-------------|
| PVC | 150 | 145 | 140 |
| PEAD | 150 | 145 | 140 |
| Ferro Fundido novo | 130 | 110 | 90 |
| Ferro Fundido revestido | 140 | 130 | 120 |
| Aco galvanizado | 120 | 100 | 80 |
| Concreto | 130 | 120 | 110 |

### 7.4 Padrao de Demanda Tipico (Residencial)

| Hora | Fator | Hora | Fator |
|------|-------|------|-------|
| 00h | 0.30 | 12h | 1.10 |
| 01h | 0.25 | 13h | 1.05 |
| 02h | 0.20 | 14h | 0.95 |
| 03h | 0.20 | 15h | 0.90 |
| 04h | 0.25 | 16h | 0.95 |
| 05h | 0.40 | 17h | 1.10 |
| 06h | 0.80 | 18h | 1.30 |
| 07h | 1.20 | 19h | 1.40 |
| 08h | 1.40 | 20h | 1.25 |
| 09h | 1.35 | 21h | 1.00 |
| 10h | 1.25 | 22h | 0.70 |
| 11h | 1.15 | 23h | 0.45 |

---

## 8. Dados para Conformidade CAESB/SABESP

### 8.1 Normas Tecnicas Aplicaveis

| Norma | Descricao |
|-------|-----------|
| CAESB NTS 181 | Redes de distribuicao de agua |
| CAESB NTS 182 | Adutoras |
| CAESB NTS 183 | Redes coletoras de esgoto |
| SABESP NTS 019 | Projeto de redes de distribuicao de agua |
| SABESP NTS 025 | Projeto de redes coletoras de esgoto |
| NBR 9649 | Projeto de redes coletoras de esgoto sanitario |
| NBR 12211 | Estudos de concepcao de sistemas publicos de abastecimento de agua |
| NBR 12214 | Projeto de sistema de bombeamento de agua para abastecimento publico |
| NBR 12215 | Projeto de adutora de agua |
| NBR 12218 | Projeto de rede de distribuicao de agua |
| NBR 10844 | Instalacoes prediais de aguas pluviais |

### 8.2 Checklist de Documentos para Submissao CAESB

**Documentos Obrigatorios:**

| # | Documento | Referencia |
|---|-----------|-----------|
| 1 | Memorial Descritivo | CAESB NTS §2.1 |
| 2 | Memorial de Calculo | CAESB NTS §2.2 |
| 3 | Planta Geral (situacao e locacao) | CAESB NTS §3.1 |
| 4 | Perfil Longitudinal | CAESB NTS §3.2 |
| 5 | ART/RRT do projetista | Lei 6.496/77 |
| 6 | Planilha de Quantitativos | CAESB NTS §4.1 |
| 7 | Orcamento (base SINAPI) | CAESB NTS §4.2 / TCU |
| 8 | Cronograma Fisico-Financeiro | CAESB NTS §4.3 |
| 9 | Planilha de Dimensionamento Hidraulico | NTS 183 / NBR 9649 |
| 10 | Detalhes de PVs e TILs | NTS 183 §6 |
| 11 | Estudo de Contribuicao/Demanda | NTS 183 §3 ou NTS 181 §3 |

**Documentos para Adutoras (adicionais):**

| # | Documento | Referencia |
|---|-----------|-----------|
| 12 | Estudo de Transientes (MOC) | NTS 182 §8 / NBR 12215 |
| 13 | Especificacao de Protecoes | NTS 182 §8.5 |
| 14 | Envoltoria de Pressoes | NBR 12215 §9 |

### 8.3 Pre-Projeto CAESB — Fluxo Kanban

A plataforma oferece um modulo de Kanban para gerenciar pre-projetos CAESB:

1. **Pedido Inicial** — Registro da solicitacao com dados basicos
2. **Formulario** — Preenchimento de dados tecnicos detalhados
3. **Demanda Gerada** — Numero de demanda gerado automaticamente (CAESB-2026-XXXX)
4. **Aprovado** — Projeto aprovado para execucao

---

## 9. Dados para RDO — Relatorio Diario de Obra

### 9.1 Informacoes do RDO

| Campo | Tipo | Descricao |
|-------|------|-----------|
| Data | data | Data do relatorio |
| Projeto | texto | Nome/codigo do projeto |
| Trecho | texto | Trecho trabalhado (PV-XX a PV-YY) |
| Clima | selecao | Bom, Nublado, Chuva, Chuva Forte |
| Efetivo | numeros | Quantidade por funcao |
| Equipamentos | texto | Equipamentos utilizados e horas |
| Servicos executados | texto | Descricao dos servicos |
| Producao do dia | numero | Metros lineares executados |
| Ocorrencias | texto | Problemas, paralisacoes |
| Fotos | imagens | Fotos georreferenciadas do trecho |

### 9.2 Documentacao Fotografica

| Requisito | Descricao |
|-----------|-----------|
| Antes da escavacao | Foto do trecho antes do inicio |
| Durante a escavacao | Foto da vala aberta com medicoes |
| Assentamento | Foto do tubo assentado no berco |
| Teste de estanqueidade | Foto do teste hidraulico |
| Reaterro e recomposicao | Foto do trecho finalizado |
| GPS | Fotos com coordenadas (metadados EXIF) |

### 9.3 Controle de Producao

| Indicador | Formula | Meta |
|-----------|---------|------|
| Producao diaria | metros/dia | Conforme planejamento |
| IDP (Indice de Desempenho de Prazo) | Valor Agregado / Valor Planejado | >= 1.0 |
| IDC (Indice de Desempenho de Custo) | Valor Agregado / Custo Real | >= 1.0 |
| % Fisico executado | Producao acumulada / Total | Conforme Curva S |

---

## 10. Requisitos de Infraestrutura

### 10.1 Navegadores Suportados

| Navegador | Versao Minima |
|-----------|---------------|
| Google Chrome | 100+ |
| Mozilla Firefox | 100+ |
| Microsoft Edge | 100+ |
| Safari | 16+ |

### 10.2 Dispositivos

| Dispositivo | Requisito |
|-------------|-----------|
| Desktop | Tela minima 1280x720 (recomendado 1920x1080) |
| Tablet | iPad ou Android tablet com tela >= 10" |
| Smartphone | Tela >= 5.5" (funcionalidades limitadas para RDO) |

### 10.3 Conexao com Internet

| Uso | Velocidade Minima |
|-----|-------------------|
| Navegacao geral | 2 Mbps |
| Upload de arquivos | 5 Mbps |
| Simulacao EPANET PRO | 5 Mbps (download inicial do WASM) |
| Mapa interativo (Leaflet) | 3 Mbps |

### 10.4 Limites de Upload

| Tipo de Arquivo | Tamanho Maximo |
|-----------------|----------------|
| CSV / Excel | 50 MB |
| DXF | 100 MB |
| Shapefile (ZIP) | 200 MB |
| GeoJSON | 100 MB |
| Fotos (RDO) | 10 MB por foto |
| Arquivo EPANET .INP | 50 MB |

### 10.5 Conta Supabase

A plataforma utiliza Supabase para persistencia de dados. Para uso em producao:

- Criar projeto no Supabase (supabase.com)
- Configurar as variaveis de ambiente:
  - `VITE_SUPABASE_URL` — URL do projeto
  - `VITE_SUPABASE_PUBLISHABLE_KEY` — Chave publica (anon key)
- Executar os scripts SQL de setup (pasta `sql-setup/`)

---

## 11. Formato de Entrega dos Dados

### 11.1 Estrutura de Pastas Recomendada

```
projeto-nome/
├── topografia/
│   ├── levantamento.csv
│   ├── pontos.shp (+ .dbf, .shx, .prj)
│   └── terreno.dxf
├── esgoto/
│   ├── rede-existente.csv
│   └── contribuicoes.xlsx
├── agua/
│   ├── rede-existente.csv
│   └── demandas.xlsx
├── drenagem/
│   ├── sub-bacias.geojson
│   └── idf-parametros.txt
├── orcamento/
│   ├── sinapi-referencia.xlsx
│   └── bdi-composicao.xlsx
├── epanet/
│   └── modelo.inp
├── documentos/
│   ├── memorial-descritivo.pdf
│   ├── art-projetista.pdf
│   └── licencas-ambientais.pdf
└── fotos/
    └── rdo/
        ├── 2026-01-15/
        └── 2026-01-16/
```

### 11.2 Convencoes de Nomes de Arquivo

| Padrao | Exemplo |
|--------|---------|
| `[tipo]-[local]-[data].[ext]` | `topo-setor-norte-2026-01.csv` |
| Sem espacos (use `-` ou `_`) | `rede-esgoto_existente.shp` |
| Data no formato ISO | `2026-01-15` |
| Minusculas sem acentos | `orcamento-sinapi.xlsx` |

### 11.3 Checklist de Validacao Pre-Import

Antes de importar dados na plataforma, verifique:

- [ ] Coordenadas estao em SIRGAS 2000
- [ ] CSV tem separador correto (`;` ou `,`)
- [ ] Todas as colunas obrigatorias estao presentes
- [ ] Nao ha linhas em branco no meio dos dados
- [ ] Cotas (Z) estao em metros (nao em centimetros)
- [ ] Diametros estao em milimetros (nao em metros)
- [ ] Declividades estao em m/m (nao em %)
- [ ] Arquivo Shapefile tem o `.prj` correspondente
- [ ] Nomes de pontos sao unicos (sem duplicatas)
- [ ] Encoding do arquivo e UTF-8

---

## 12. Glossario Tecnico

| Sigla | Significado |
|-------|------------|
| PV | Poco de Visita — caixa de inspecao e manutencao da rede |
| TIL | Terminal de Limpeza — ponto inicial de rede coletora |
| TL | Tubo de Ligacao — conexao predial a rede |
| DN | Diametro Nominal — diametro interno padronizado (mm) |
| mca | Metros de Coluna de Agua — unidade de pressao |
| Y/D | Relacao Lamina/Diametro — nivel de preenchimento do tubo |
| NBR | Norma Brasileira — norma tecnica da ABNT |
| NTS | Norma Tecnica de Servico — norma das concessionarias |
| SINAPI | Sistema Nacional de Pesquisa de Custos e Indices |
| SICRO | Sistema de Custos Referenciais de Obras |
| BDI | Bonificacoes e Despesas Indiretas |
| TCU | Tribunal de Contas da Uniao |
| CAESB | Companhia de Saneamento Ambiental do Distrito Federal |
| SABESP | Companhia de Saneamento Basico do Estado de Sao Paulo |
| EPANET | Software de simulacao hidraulica (EPA/USEPA) |
| SWMM | Storm Water Management Model — modelo de drenagem urbana |
| GIS | Geographic Information System — Sistema de Informacao Geografica |
| RDO | Relatorio Diario de Obra |
| EVM | Earned Value Management — Gerenciamento de Valor Agregado |
| IDP | Indice de Desempenho de Prazo (SPI) |
| IDC | Indice de Desempenho de Custo (CPI) |
| MOC | Metodo das Caracteristicas — simulacao de transientes hidraulicos |
| TDH | Altura Manometrica Total — pressao total da bomba |
| NPSH | Net Positive Suction Head — altura de succao disponivel |
| VRP | Valvula Redutora de Pressao |
| UTM | Universal Transverse Mercator — projecao cartografica |
| SIRGAS | Sistema de Referencia Geocentrico para as Americas |
| ART | Anotacao de Responsabilidade Tecnica (CREA) |
| RRT | Registro de Responsabilidade Tecnica (CAU) |
| CRS | Coordinate Reference System — sistema de coordenadas |
| IDF | Intensidade-Duracao-Frequencia — equacao de chuvas |
| FoFo | Ferro Fundido (material de tubulacao) |
| PEAD | Polietileno de Alta Densidade |
| PVC | Policloreto de Vinila |
| PRV | Pressure Reducing Valve (valvula redutora de pressao) |

---

## Suporte

Para duvidas sobre a implementacao:

- **Email:** construdata.contato@gmail.com
- **LinkedIn:** [ConstruData Software](https://www.linkedin.com/company/construdatasoftware)
- **Plataforma:** [construdata.software](https://construdata.software)

---

*Documento gerado pela equipe ConstruData — Marco 2026*
