# Plano de Correções e Melhorias - HydroNetwork

## Visão Geral
4 áreas de trabalho: Topografia (bugs de coordenadas), Performance de Importação (IFC/DXF), RDO Hydro (funcionalidades), Planejamento (calculadora inversa).

---

## 1. Topografia - Bugs de Coordenadas

### 1.1 Fix: Default UTM zone 23 quando detecção falha
**Arquivo:** `src/engine/coordinateTransform.ts` (linha ~128)

**Problema:** Quando `autoDetectCRS()` não consegue detectar a zona UTM (nenhuma zona passa na validação de ±3.5° do meridiano central), a função retorna silenciosamente zone 23 como fallback. Isso causa interpretação errada de coordenadas que estão em outras zonas (18-22, 24-25).

**Correção:**
- Em vez de defaultar para zona 23, tentar todas as zonas com tolerância progressiva (±3.5° → ±6° → ±10°)
- Se nenhuma zona passar, retornar a zona cujo meridiano central está mais próximo da longitude convertida do ponto amostral
- Adicionar log/warning quando usando detecção por proximidade em vez de match exato

### 1.2 Fix: Swap de coordenadas geográficas não tratado
**Arquivo:** `src/engine/coordinateTransform.ts` (linhas ~208-210)

**Problema:** `transformCoordinate()` assume que coordenadas geográficas sempre vêm como x=longitude, y=latitude. Mas `detectBatchCRS()` em `hydraulics.ts` já detecta convention "xy" vs "yx". Essa informação não é usada na transformação.

**Correção:**
- Adicionar campo opcional `convention?: "xy" | "yx"` ao tipo `ImportCRSConfig`
- Em `transformCoordinate()`, quando source é geographic, verificar a convention antes de atribuir lat/lng
- Se convention === "yx": lat=x, lng=y (invertido)

### 1.3 Melhoria: Detecção de CRS em batch para edge cases
**Arquivo:** `src/engine/hydraulics.ts` (linhas ~239-321)

**Problema:** `detectBatchCRS()` pode falhar para coordenadas em limites de zona ou com offsets locais, defaultando para resultados incorretos.

**Correção:**
- Adicionar scoring por zona: testar múltiplos pontos (não apenas 1) contra cada zona UTM
- A zona com mais pontos validados vence
- Melhorar detecção de coordenadas locais (IFC/DXF de CAD) vs UTM real

---

## 2. Performance de Importação (IFC/DXF)

### 2.1 Otimizar parser IFC
**Arquivo:** `src/components/hydronetwork/UnifiedImportPanel.tsx` (linhas ~687-812)

**Problema:** O parser IFC faz 3 passes com regex sobre o conteúdo completo do arquivo, tem limite hardcoded de 5000 pontos, e não usa Web Workers.

**Correções:**
- **Single-pass parsing:** Refatorar para ler o arquivo linha por linha uma única vez, coletando cartesian points, placements e entidades MEP simultaneamente
- **Remover/aumentar limite de 5000 pontos:** Tornar configurável (padrão 50000) ou remover completamente, usando paginação na UI
- **Progress callback:** Adicionar callback de progresso para mostrar barra de loading durante importação

### 2.2 Virtualização da tabela de pontos
**Arquivo:** `src/components/hydronetwork/UnifiedImportPanel.tsx` ou componente de tabela relevante

**Problema:** A tabela renderiza até 100 rows sem paginação nem virtualização. Com arquivos grandes, a UI fica lenta.

**Correção:**
- Usar `react-window` (ou virtualização manual com height fixo) para renderizar apenas as linhas visíveis
- Adicionar paginação como fallback se react-window não estiver disponível no projeto

---

## 3. RDO Hydro

### 3.1 "Avanço por Trecho" - Checkbox concluído/não concluído
**Arquivo:** `src/components/hydronetwork/RDOHydroModule.tsx` (linhas ~411-527)

**Problema:** Não há como marcar manualmente um trecho como concluído/não concluído. O status é calculado apenas pela porcentagem.

**Correção:**
- Adicionar campo `manualStatus?: "concluido" | "nao_concluido"` ao tipo de segmento
- Adicionar coluna de checkbox na tabela "Avanço por Trecho"
- Quando checkbox marcado, overrida o status calculado automaticamente
- Persistir estado no RDO ou no estado do projeto

### 3.2 "Serviços Mais Executados" - Dados reais (RDO + Planejamento)
**Arquivo:** `src/components/hydronetwork/RDOHydroModule.tsx` (linhas ~219-224, 397-409)

**Problema:** Usa dados mock hardcoded em vez de dados reais dos RDOs e do Planejamento.

**Correção:**
- Agregar serviços de todos os RDOs (`rdos.flatMap(r => r.services)`) por tipo/nome
- Somar quantidades executadas por serviço
- Buscar serviços planejados da configuração de produtividade do Planning (se disponível)
- Mostrar ranking: serviço, quantidade executada, quantidade planejada, % de conclusão
- Ordenar por quantidade executada (descrescente)
- Substituir os badges mock por gráfico de barras horizontais (planejado vs executado)

### 3.3 "Serviços Executados" - Ordenação por cronograma
**Arquivo:** `src/components/hydronetwork/RDOHydroModule.tsx` (linhas ~629-674)

**Problema:** A tabela de serviços executados não tem ordenação por cronograma/data.

**Correção:**
- Adicionar sort por data (coluna "Data") como ordenação padrão
- Adicionar opção de ordenar por categoria, valor, tipo
- Implementar header clickável para toggle de ordenação (asc/desc)

---

## 4. Planejamento - Calculadora Inversa

### 4.1 Calculadora inversa: data final → equipes/metros por dia
**Arquivo:** `src/components/hydronetwork/PlanningModule.tsx` (linhas ~243-476)

**Problema:** Atualmente só existe cálculo direto: dados equipes + metros/dia + data início → data término. Não existe o inverso: dada uma data final desejada → calcular quantas equipes ou metros/dia são necessários.

**Correção:**
- Adicionar toggle "Modo de cálculo": "Direto" (atual) vs "Inverso"
- No modo inverso:
  - Inputs: data início, data término desejada, metros totais (do projeto)
  - O usuário pode fixar equipes OU metros/dia, e o outro é calculado
  - Fórmula: `diasUteis = businessDays(inicio, termino, holidays, workDays)`
  - Se fixar equipes: `metrosDia = totalMetros / (diasUteis * numEquipes)`
  - Se fixar metros/dia: `numEquipes = ceil(totalMetros / (diasUteis * metrosDia))`
- Mostrar resultado em card destacado com os valores calculados
- Manter mesma lógica de feriados e dias úteis do cálculo direto

---

## Ordem de Implementação Sugerida

1. **Topografia (1.1, 1.2, 1.3)** - Bugs críticos que afetam dados
2. **RDO Hydro (3.1, 3.2, 3.3)** - Funcionalidades solicitadas
3. **Planejamento (4.1)** - Nova funcionalidade
4. **Performance (2.1, 2.2)** - Otimizações

## Arquivos Afetados

| Arquivo | Mudanças |
|---------|----------|
| `src/engine/coordinateTransform.ts` | Fix zone detection, fix coordinate swap |
| `src/engine/hydraulics.ts` | Improve batch CRS detection |
| `src/components/hydronetwork/RDOHydroModule.tsx` | Checkbox avanço, serviços reais, ordenação |
| `src/components/hydronetwork/PlanningModule.tsx` | Calculadora inversa |
| `src/components/hydronetwork/UnifiedImportPanel.tsx` | Otimizar IFC parser, virtualização |
