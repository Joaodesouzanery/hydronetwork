# Plano de Implementação - HydroNetwork Sprint Completo

## Visão Geral
6 frentes de trabalho simultâneas: Correção de Persistência, Parsers de Arquivo (SHP/IFC/TIF), Rede sobre Levantamento, Integração CIVIL 3D via DXF, Otimização de Orçamento/Quantitativo, e Módulo QEsg/QWater.

---

## 1. Correção de Persistência (CRÍTICO)

### 1.1 Fix: user_id ausente em PlanningModule.tsx
**Arquivo:** `src/components/hydronetwork/PlanningModule.tsx`

**Problema:** A função `syncPlansToSupabase()` (linhas 114-137) faz upsert na tabela `hydro_saved_plans` **SEM** incluir o campo `user_id`. Além disso, `loadPlansFromSupabase()` (linhas 140-173) carrega todos os planos **SEM** filtrar por `user_id`.

**Impacto:** Dados de planejamento não são isolados por usuário. Todos os usuários veem todos os planos. Dados podem ser sobrescritos entre usuários.

**Correção:**
1. Importar `getUserId` de `savedPlanning.ts` (que já usa corretamente)
2. Em `syncPlansToSupabase()`: adicionar `user_id: await getUserId()` ao objeto de upsert
3. Em `loadPlansFromSupabase()`: adicionar `.eq("user_id", userId)` ao query de select
4. Seguir o padrão já correto de `savedPlanning.ts` e `rdo.ts`

**Nota:** `SavedPlansDialog.tsx`, `rdo.ts` e `RDOHydroModule.tsx` já estão corretos.

---

## 2. Parsers de Arquivo para Topografia

### 2.1 Implementar Parser SHP (Shapefile)
**Arquivos:** `src/engine/importEngine.ts`, novo: `src/engine/shpReader.ts`

**Situação atual:** `detectFileFormat()` detecta SHP e classifica como paradigma "gis", mas **não existe parser**. O import pipeline cai no erro "Formato não suportado: SHP".

**Implementação:**
1. Instalar biblioteca `shpjs` (npm) - parser JavaScript puro para Shapefiles
2. Criar `src/engine/shpReader.ts` com:
   - `parseSHPToPoints(buffer: ArrayBuffer): PontoTopografico[]` - extrai pontos com coordenadas e elevação Z
   - `parseSHPToInternal(buffer: ArrayBuffer): { nodes: InternalNode[], edges: InternalEdge[] }` - converte geometrias para modelo interno
   - Suporte a Point, MultiPoint (→ nós), LineString, MultiLineString (→ arestas)
   - Leitura de atributos do DBF embutido (diâmetro, material, id)
3. Integrar no `importEngine.ts`:
   - Adicionar case "SHP" em `analyzeFileRaw()` para estatísticas
   - Adicionar case "SHP" em pipeline de importação para chamar `parseSHPToInternal()`
4. Tratar CRS: se .prj disponível, detectar; senão, usar auto-detect por coordenadas

### 2.2 Melhorar Parser IFC (de regex para parser estruturado)
**Arquivo:** `src/engine/importEngine.ts`

**Situação atual:** O parser IFC faz 3 passes com regex sobre texto bruto. Extrai apenas IFCCARTESIANPOINT como coordenadas. Não faz parsing real da estrutura IFC (hierarquia de objetos, relações, propriedades de tubos).

**Implementação:**
1. Instalar `web-ifc` (npm) - parser IFC compilado para WebAssembly, roda no browser
2. Criar `src/engine/ifcReader.ts` com:
   - `parseIFCToPoints(buffer: ArrayBuffer): PontoTopografico[]` - extrai pontos 3D de todas as entidades
   - `parseIFCToInternal(buffer: ArrayBuffer): { nodes, edges }` - extrai pipes, fittings como rede
   - Mapear IfcPipeSegment → edges, IfcPipeFitting/IfcJunction → nodes
   - Extrair propriedades: diâmetro, material, comprimento das PropertySets
3. Substituir regex em `analyzeFileRaw()` pela análise via web-ifc
4. Remover limite de 5000 pontos (ou tornar configurável)
5. Adicionar progress callback para UI

### 2.3 Implementar Suporte a TIF/GeoTIFF
**Arquivos:** `src/engine/importEngine.ts`, novo: `src/engine/tifReader.ts`

**Situação atual:** TIFF não é detectado nem suportado. O formato é raster (DEM/DTM), diferente dos vetoriais.

**Implementação:**
1. Instalar `geotiff` (npm) - parser GeoTIFF puro JavaScript
2. Criar `src/engine/tifReader.ts` com:
   - `parseGeoTIFFToPoints(buffer: ArrayBuffer, sampleStep?: number): PontoTopografico[]` - converte raster de elevação em grade de pontos
   - Auto-detectar CRS dos tags GeoTIFF (EPSG code)
   - Amostragem configurável (cada N pixels) para não gerar milhões de pontos
   - Gerar grid de pontos com x, y (coordenadas geográficas/projetadas) e cota (valor do pixel)
3. Adicionar "TIF"/"TIFF" em `detectFileFormat()` no importEngine
4. Classificar paradigma como "raster" (novo tipo)
5. Integrar no pipeline de importação

### 2.4 Garantir DXF robusto
**Arquivo:** `src/engine/dxfReader.ts`

**Situação atual:** ✅ DXF já funciona bem. Revisão de qualidade:
- Verificar parsing de 3DPOLYLINE com elevações variáveis
- Garantir que LWPOLYLINE com elevação por vértice seja preservada
- Testar com arquivos CIVIL 3D exportados como DXF

---

## 3. Rede Projetada no Levantamento / Malha

### 3.1 Snap de rede nos pontos topográficos
**Arquivo:** `src/components/hydronetwork/TopographyMap.tsx`

**Problema:** Quando o usuário importa pontos topográficos (levantamento) e depois cria trechos de rede, os nós da rede devem "grudar" nos pontos do levantamento para herdar suas cotas.

**Implementação:**
1. Ao criar um nó de rede (água/esgoto/drenagem), buscar o ponto topográfico mais próximo dentro de uma tolerância (ex: 1m)
2. Se encontrado, copiar a cota do ponto topográfico para o nó da rede
3. Adicionar indicador visual de que o nó está "snapado" ao levantamento
4. Para trechos importados de DXF/IFC, auto-snap nas elevações do levantamento se disponível

### 3.2 Interpolação de elevação na malha
**Arquivo:** `src/engine/hydraulics.ts` ou novo `src/engine/terrainInterpolation.ts`

**Implementação:**
1. Criar triangulação Delaunay dos pontos topográficos (usar algoritmo simples ou biblioteca)
2. Para qualquer ponto da rede, interpolar a cota do terreno a partir dos triângulos adjacentes
3. Calcular automaticamente: profundidade de instalação = cota terreno - cota rede

---

## 4. Integração CIVIL 3D via DXF

### 4.1 Importação de DXF do CIVIL 3D com redes
**Arquivo:** `src/engine/dxfReader.ts` + `src/engine/importEngine.ts`

**Situação:** CIVIL 3D exporta DXF com layers organizados (rede água, rede esgoto, topografia). O parser DXF já lê todas as entidades, mas não mapeia layers → tipos de rede automaticamente.

**Implementação:**
1. Adicionar detecção de layers típicos do CIVIL 3D:
   - `C-WATR-*` → rede de água
   - `C-SSWR-*` → rede de esgoto
   - `C-STRM-*` → rede de drenagem
   - `C-TOPO-*` → topografia
2. Criar mapeamento automático: layer → tipoRede
3. Extrair propriedades de blocos/atributos INSERT (diâmetro, material)
4. Gerar quantitativo automaticamente a partir dos trechos importados:
   - Comprimento por diâmetro × material
   - Quantidade de conexões por tipo
   - Volume de escavação estimado (se cota terreno disponível)

---

## 5. Otimização de Orçamento / Quantitativo

### 5.1 Geração automática de quantitativo a partir da rede
**Arquivo:** `src/engine/budget.ts`

**Situação:** O módulo de orçamento já existe e funciona, mas precisa gerar quantitativo automaticamente dos trechos.

**Implementação:**
1. Criar função `generateQuantitiesFromNetwork(trechos: Trecho[], pontos: PontoTopografico[])`:
   - Agrupar trechos por tipoRede × diâmetro × material
   - Somar comprimentos por grupo
   - Calcular volumes de escavação (largura × profundidade × comprimento)
   - Listar conexões (tês, curvas, reduções) baseado na topologia
2. Integrar com tabela de custos unitários existente
3. Exportar memorial de cálculo (PDF/XLSX)

---

## 6. Módulo QEsg / QWater (Novo)

### 6.1 Scaffold do Backend FastAPI
**Novo diretório:** `backend/` na raiz do projeto

**Implementação:**
1. Criar estrutura FastAPI:
   ```
   backend/
   ├── main.py              # FastAPI app + CORS
   ├── requirements.txt     # Dependencies
   ├── routers/
   │   ├── qesg.py          # Endpoints de dimensionamento de esgoto
   │   └── qwater.py        # Endpoints de dimensionamento de água
   ├── engines/
   │   ├── qesg_engine.py   # Algoritmos Manning, perdas de carga esgoto
   │   └── qwater_engine.py # Algoritmos Hazen-Williams, Colebrook, pressão
   └── models/
       └── schemas.py       # Pydantic models (input/output)
   ```

2. Endpoints QEsg (baseado no repositório Sketua/QEsg):
   - `POST /api/qesg/dimension` - Dimensionamento de rede coletora de esgoto
     - Input: trechos com vazão, extensão, cota montante/jusante
     - Algoritmo: Manning (n=0.013 PVC), velocidade mínima 0.6 m/s, y/D ≤ 0.75
     - Output: diâmetro calculado, velocidade, lâmina d'água, tensão trativa
   - `POST /api/qesg/verify` - Verificação de rede existente

3. Endpoints QWater (baseado no repositório Sketua/QWater):
   - `POST /api/qwater/dimension` - Dimensionamento de rede de distribuição
     - Input: trechos com vazão, comprimento, cota, material
     - Algoritmo: Hazen-Williams ou Colebrook-White
     - Output: diâmetro, perda de carga, velocidade, pressão nos nós
   - `POST /api/qwater/verify` - Verificação de pressões e velocidades

### 6.2 Módulo Frontend QEsg/QWater
**Novo arquivo:** `src/components/hydronetwork/modules/QEsgWaterModule.tsx`

**Implementação:**
1. Criar módulo com duas abas: "QEsg (Esgoto)" e "QWater (Água)"
2. Cada aba terá:
   - Conexão com backend FastAPI (URL configurável)
   - Botão "Dimensionar rede" que envia trechos atuais do projeto
   - Tabela de resultados com: trecho, diâmetro calculado, velocidade, perda de carga
   - Indicadores visuais (verde/vermelho) para verificação de norma
   - Botão "Aplicar diâmetros" que atualiza os trechos do projeto
3. Registrar módulo no sistema de módulos em HydroNetwork.tsx
4. Posicionar abaixo da Topografia na interface

---

## Dependências NPM a Instalar

| Pacote | Versão | Uso |
|--------|--------|-----|
| `shpjs` | ^4.0 | Parser Shapefile (SHP+DBF+PRJ) |
| `geotiff` | ^2.1 | Parser GeoTIFF para DEM/DTM |
| `web-ifc` | ^0.0.57 | Parser IFC (WebAssembly) |

**Nota:** `web-ifc` é ~5MB (WASM). Alternativa mais leve: melhorar o parser regex existente com single-pass + estrutura. Decisão: começar com parser regex melhorado, avaliar web-ifc se necessário.

---

## Ordem de Implementação

1. **Persistência (1.1)** — Fix rápido, impacto imediato ✅
2. **Parser SHP (2.1)** — Formato mais pedido
3. **Parser IFC melhorado (2.2)** — Single-pass + extração de rede
4. **Parser TIF/GeoTIFF (2.3)** — Suporte a DEM
5. **DXF CIVIL 3D (4.1)** — Mapeamento de layers + quantitativo
6. **Snap rede no levantamento (3.1)** — Integração topografia + rede
7. **Quantitativo automático (5.1)** — Geração a partir dos trechos
8. **Backend FastAPI QEsg/QWater (6.1)** — Scaffold + algoritmos
9. **Módulo Frontend QEsg/QWater (6.2)** — Interface + integração

## Arquivos Afetados

| Arquivo | Mudanças |
|---------|----------|
| `src/components/hydronetwork/PlanningModule.tsx` | Fix user_id em sync + load |
| `src/engine/importEngine.ts` | Integrar SHP, IFC melhorado, TIF |
| `src/engine/shpReader.ts` | **NOVO** — Parser Shapefile |
| `src/engine/tifReader.ts` | **NOVO** — Parser GeoTIFF |
| `src/engine/ifcReader.ts` | **NOVO** — Parser IFC melhorado |
| `src/engine/dxfReader.ts` | Melhorias CIVIL 3D layers |
| `src/engine/budget.ts` | Quantitativo automático |
| `src/engine/terrainInterpolation.ts` | **NOVO** — Interpolação de elevação |
| `src/components/hydronetwork/TopographyMap.tsx` | Snap de rede no levantamento |
| `src/components/hydronetwork/modules/QEsgWaterModule.tsx` | **NOVO** — Módulo QEsg/QWater |
| `src/pages/HydroNetwork.tsx` | Registrar módulo QEsg/QWater |
| `backend/` | **NOVO** — FastAPI backend |
| `package.json` | Novas dependências (shpjs, geotiff) |
