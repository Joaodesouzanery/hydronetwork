# Especificacao do Modulo de Transientes Hidraulicos (Golpe de Ariete)

## Prompt para Implementacao

> **Objetivo**: Criar um modulo completo de simulacao de transientes hidraulicos (golpe de ariete) para o HydroNetwork, integrado diretamente com o modulo de Recalque (ElevatorStationModule) e com o QWater/EPANET. O modulo deve seguir as normas ABNT NBR 12215:2017, NBR 12214:2020, AWWA M11, e criterios CAESB/SABESP.

---

## 1. Arquitetura do Modulo

### 1.1 Novos Arquivos a Criar

```
src/engine/transientEngine.ts          -- Motor de calculo MOC (Method of Characteristics)
src/engine/transientProtection.ts      -- Dispositivos de protecao (ventosas, TAU, valvulas)
src/engine/transientTypes.ts           -- Tipos e interfaces
src/components/hydronetwork/modules/TransientModule.tsx  -- UI principal
```

### 1.2 Integracao com Modulos Existentes

O modulo DEVE conversar diretamente com:

- **`elevatorStationEngine.ts`** (Recalque): Ler dados de TDH, vazao, potencia, diametro de recalque, comprimento da adutora, material, coeficiente de atrito. O resultado do dimensionamento do recalque alimenta automaticamente a entrada do transiente.

- **`qwaterEpanetBridge.ts`** (QWater/EPANET): Importar topologia de rede, resultados de regime permanente (pressoes e vazoes iniciais), elevacoes dos nos, diametros e materiais. O estado estacionario do EPANET serve como condicao inicial para a simulacao de transientes.

- **`qwaterEngine.ts`** (QWater): Usar resultados de dimensionamento (DN, material, Hazen-Williams) como entrada.

- **`rasterStore.ts`** / **`elevationExtractor.ts`**: Extrair cotas do MDT para o perfil piezometrico.

---

## 2. Motor de Calculo — Metodo das Caracteristicas (MOC)

### 2.1 Equacoes Governantes

**Equacao da Continuidade:**
```
dH/dt + (a^2 / (g * A)) * dQ/dx = 0
```

**Equacao da Quantidade de Movimento:**
```
dQ/dt + g * A * dH/dx + (f / (2 * D * A)) * Q * |Q| = 0
```

Onde:
- `H` = carga piezometrica (m)
- `Q` = vazao (m3/s)
- `a` = celeridade da onda de pressao (m/s)
- `g` = 9.81 m/s2
- `A` = area da secao transversal (m2)
- `D` = diametro interno (m)
- `f` = fator de atrito de Darcy-Weisbach

### 2.2 Linhas Caracteristicas

**C+ (progressiva):**
```
HP = 0.5 * (H_i-1 + H_i+1) + (a / (2*g*A)) * (Q_i-1 - Q_i+1)
     - (f * dt / (4*D*A^2)) * (Q_i-1 * |Q_i-1| + Q_i+1 * |Q_i+1|)
```

**C- (regressiva):**
```
QP = 0.5 * (Q_i-1 + Q_i+1) + (g*A / (2*a)) * (H_i-1 - H_i+1)
     - (f * dt / (4*D*A^2)) * (Q_i-1 * |Q_i-1| + Q_i+1 * |Q_i+1|)
```

### 2.3 Celeridade da Onda (Formula de Joukowsky)

```typescript
function calcWaveSpeed(params: {
  K: number;         // Modulo de elasticidade volumetrica da agua (2.1e9 Pa)
  rho: number;       // Massa especifica da agua (998.2 kg/m3)
  D: number;         // Diametro interno (m)
  e: number;         // Espessura da parede (m)
  E: number;         // Modulo de elasticidade do material (Pa)
  psi: number;       // Coeficiente de ancoragem (0.91 para tubos ancorados)
}): number {
  // a = sqrt(K/rho / (1 + (K*D)/(E*e) * psi))
  const { K, rho, D, e, E, psi } = params;
  return Math.sqrt((K / rho) / (1 + (K * D) / (E * e) * psi));
}
```

**Materiais pre-configurados (E em Pa):**
| Material | E (Pa) | psi |
|----------|--------|-----|
| Aco | 2.1e11 | 0.91 |
| Ferro Fundido | 1.0e11 | 0.91 |
| PVC | 3.0e9 | 0.91 |
| PEAD | 0.8e9 | 0.91 |
| Concreto | 2.0e10 | 0.91 |
| Fibra de Vidro (PRFV) | 2.0e10 | 0.91 |

### 2.4 Sobrepressao de Joukowsky

```
DeltaH = (a * DeltaV) / g
```

Onde `DeltaV` = variacao de velocidade (m/s)

### 2.5 Tempo Critico de Manobra

```
Tc = 2 * L / a
```

Onde `L` = comprimento da adutora (m)

---

## 3. Cenarios de Simulacao

### 3.1 Parada Brusca de Bomba (Principal)
- Perda total de energia eletrica
- Momento de inercia GD2 da bomba/motor
- Decaimento exponencial da rotacao
- Curva caracteristica da bomba nos 4 quadrantes (opcional)

### 3.2 Fechamento de Valvula
- Lei de fechamento: linear, parabolica, ou customizada
- Tempo de fechamento configuravel
- Posicao da valvula ao longo do tempo: `tau(t) = f(t/Tf)`

### 3.3 Partida de Bomba
- Rampa de partida (VFD/soft-starter)
- Enchimento progressivo da tubulacao

### 3.4 Abertura de Valvula
- Abertura rapida vs. gradual
- Impacto na rede a jusante

---

## 4. Condicoes de Contorno

### 4.1 Reservatorio (Nivel Constante)
```
H_boundary = H_reservatorio (constante)
Q_boundary = calculado pela linha caracteristica
```

### 4.2 Bomba (Curva Caracteristica)
```typescript
interface PumpCurve {
  // Pontos (Q, H) da curva da bomba
  points: { vazao: number; altura: number }[];
  // Momento de inercia GD2 (kg*m2) — para calculo de desaceleracao
  gd2: number;
  // Rotacao nominal (rpm)
  rotacaoNominal: number;
  // Rendimento nominal
  rendimento: number;
}
```

### 4.3 Valvula de Retencao (Check Valve)
- Quando Q <= 0: valvula fecha
- Diferencial de pressao para reabertura

### 4.4 Ventosa (Air Valve)
- Admissao de ar quando P < P_atm
- Expulsao de ar quando P > P_atm
- Diametro e coeficiente de descarga

### 4.5 Tanque Hidropneumatico (TAU)
- Lei politropica: `P * V^n = constante`
- Volume de ar, pressao de pre-carga
- Diametro e comprimento da tubulacao de conexao

### 4.6 Camara de Ar
- Similar ao TAU mas com coluna de ar livre

---

## 5. Tipos TypeScript (transientTypes.ts)

```typescript
export interface TransientPipeInput {
  id: string;
  /** No de montante */
  nodeUpstream: string;
  /** No de jusante */
  nodeDownstream: string;
  /** Comprimento (m) */
  length: number;
  /** Diametro interno (m) */
  diameter: number;
  /** Espessura da parede (m) */
  wallThickness: number;
  /** Material */
  material: 'aco' | 'ferro_fundido' | 'pvc' | 'pead' | 'concreto' | 'prfv';
  /** Rugosidade (mm) — para calculo de f */
  roughness: number;
  /** Cota de montante (m) */
  elevationUp: number;
  /** Cota de jusante (m) */
  elevationDown: number;
  /** Celeridade calculada automaticamente */
  waveSpeed?: number;
}

export interface TransientNodeInput {
  id: string;
  /** Cota do terreno (m) */
  elevation: number;
  /** Tipo do no */
  type: 'junction' | 'reservoir' | 'pump' | 'valve' | 'tank' | 'air_valve' | 'surge_tank';
  /** Pressao inicial (mca) */
  initialHead?: number;
  /** Vazao inicial (m3/s) */
  initialFlow?: number;
}

export interface TransientEvent {
  /** Tipo do evento */
  type: 'pump_trip' | 'pump_start' | 'valve_close' | 'valve_open';
  /** Tempo de inicio (s) */
  startTime: number;
  /** Duracao do evento (s) — para fechamento/abertura de valvula */
  duration?: number;
  /** No afetado */
  nodeId: string;
  /** Perfil temporal: 'linear' | 'parabolico' | 'custom' */
  profile?: 'linear' | 'parabolic' | 'custom';
  /** Pontos customizados (t, valor) para perfil custom */
  customProfile?: { t: number; value: number }[];
}

export interface TransientSimulationConfig {
  /** Tempo total de simulacao (s) */
  totalTime: number;
  /** Passo de tempo (s) — calculado automaticamente pelo Courant */
  timeStep?: number;
  /** Numero de Courant (default 0.9) */
  courantNumber?: number;
  /** Modelo de atrito: 'steady' | 'quasi-steady' | 'unsteady' */
  frictionModel: 'steady' | 'quasi-steady' | 'unsteady';
  /** Eventos de transiente */
  events: TransientEvent[];
}

export interface TransientResult {
  /** Serie temporal para cada no */
  nodeResults: Map<string, {
    time: number[];
    head: number[];     // Carga piezometrica (m)
    flow: number[];     // Vazao (m3/s)
  }>;
  /** Serie temporal para cada tubo */
  pipeResults: Map<string, {
    time: number[];
    /** Head em cada secao ao longo do tubo */
    headProfile: number[][];  // [time_index][section_index]
    /** Flow em cada secao */
    flowProfile: number[][];
  }>;
  /** Envoltoria de pressao maxima/minima */
  envelope: {
    nodeId: string;
    maxHead: number;
    minHead: number;
    maxPressure: number;   // maxHead - elevation
    minPressure: number;   // minHead - elevation
    elevation: number;
  }[];
  /** Verificacao de cavitacao */
  cavitationRisk: {
    nodeId: string;
    time: number;
    pressure: number;    // Se < 0 → risco
  }[];
  /** Sobrepressao maxima (Joukowsky) */
  maxSurge: number;
  /** Subpressao maxima */
  maxVacuum: number;
  /** Celeridade calculada */
  waveSpeed: number;
  /** Tempo critico */
  criticalTime: number;
}

export interface ProtectionDevice {
  type: 'surge_tank' | 'air_chamber' | 'air_valve' | 'check_valve' |
        'pressure_relief_valve' | 'flywheel';
  nodeId: string;
  parameters: Record<string, number>;
}

export interface ProtectionAnalysisResult {
  /** Envoltoria COM protecao */
  protectedEnvelope: TransientResult['envelope'];
  /** Reducao de sobrepressao (%) */
  surgeReduction: number;
  /** Reducao de subpressao (%) */
  vacuumReduction: number;
  /** Dispositivos recomendados */
  recommendations: string[];
  /** Atende norma? */
  compliant: boolean;
  /** Mensagens de diagnostico */
  diagnostics: string[];
}
```

---

## 6. Integracao com Recalque (ElevatorStationModule)

### 6.1 Fluxo de Dados Recalque → Transiente

```typescript
// Em TransientModule.tsx:
import { StationResult } from '@/engine/elevatorStationEngine';

function importFromRecalque(station: StationResult): TransientSimulationConfig {
  return {
    pipes: [{
      id: 'recalque_main',
      length: station.comprimentoRecalque,
      diameter: station.diametroRecalque / 1000,  // mm → m
      material: station.material,
      wallThickness: estimateWallThickness(station.diametroRecalque, station.classePN),
      elevationUp: station.cotaSuccao,
      elevationDown: station.cotaDescarga,
    }],
    events: [{
      type: 'pump_trip',
      startTime: 0,
      nodeId: 'pump_station',
    }],
    pump: {
      vazao: station.vazaoProjeto / 1000,  // L/s → m3/s
      altura: station.alturaManometrica,
      potencia: station.potenciaAbsorvida,
      rotacao: 3500,
      rendimento: station.rendimentoBomba,
      gd2: estimateGD2(station.potenciaAbsorvida),
    },
  };
}
```

### 6.2 Modulo de Recalque de Esgoto e Booster

Criar funcionalidade de **Recalque de Esgoto** e **Booster de Agua** que:
1. Leia a rede dimensionada do QEsg ou QWater
2. Identifique pontos de recalque (onde a rede nao consegue escoar por gravidade)
3. Dimensione a estacao elevatoria
4. Alimente automaticamente o modulo de transientes

---

## 7. Integracao com QWater/EPANET

### 7.1 Fluxo EPANET → Transiente

```typescript
// Em TransientModule.tsx:
import { runWaterEpanet } from '@/engine/qwaterEpanetBridge';

async function importFromEpanet(): Promise<void> {
  // 1. Rodar simulacao estacionaria
  const epanetResults = await runWaterEpanet(waterNodeAttrs, waterEdgeAttrs);

  // 2. Extrair condicoes iniciais
  const initialConditions = epanetResults.nodes.map(n => ({
    id: n.id,
    head: n.cota + n.pressao,  // cota + pressao = carga piezometrica
    flow: 0,  // sera calculado por trecho
  }));

  // 3. Converter topologia
  const pipes = epanetResults.edges.map(e => ({
    id: e.id,
    nodeUpstream: e.from,
    nodeDownstream: e.to,
    length: e.length,
    diameter: e.diameter / 1000,
    // ...
  }));
}
```

---

## 8. Interface do Usuario (TransientModule.tsx)

### 8.1 Abas do Modulo

1. **Contexto**: Selecionar tipo (Adutora Nova / Retrofit / Analise Pericial)
2. **Dados da Adutora**: Importar de Recalque ou QWater, ou inserir manualmente
3. **Cenario**: Configurar eventos (parada de bomba, fechamento de valvula)
4. **Simulacao**: Executar MOC, exibir progresso
5. **Resultados**: Envoltoria de pressao, serie temporal, perfil piezometrico
6. **Protecao**: Dimensionar dispositivos (ventosa, TAU, camara de ar)
7. **Relatorio**: Gerar memorial de calculo (PDF)

### 8.2 Visualizacoes

- **Perfil Piezometrico**: Envoltoria max/min sobre perfil de terreno
- **Serie Temporal**: Grafico H(t) e Q(t) em nos selecionados
- **Mapa de Pressao**: Cores indicando sobrepressao/subpressao na rede
- **Animacao**: Propagacao da onda ao longo do tempo

---

## 9. Criterios Normativos

### 9.1 ABNT NBR 12215:2017
- Pressao maxima ≤ PN da tubulacao
- Pressao minima > 0 mca (evitar cavitacao)
- Tempo de fechamento de valvula ≥ 2L/a

### 9.2 AWWA M11
- Sobrepressao transitoria ≤ 1.5x pressao de servico
- Pressao minima > -6 mca (pressao de vapor a 20C)

### 9.3 Criterios CAESB
- Simulacao via MOC obrigatoria para DN ≥ 300mm
- Verificacao de parada brusca de bomba
- Verificacao de falha de energia
- Memorial de calculo com envoltoria de pressao

---

## 10. Exemplo de Uso Completo

```typescript
// 1. Importar dados do recalque
const stationData = getElevatorStationResult();
const transientInput = importFromRecalque(stationData);

// 2. Configurar simulacao
const config: TransientSimulationConfig = {
  totalTime: 60,  // 60 segundos
  courantNumber: 0.9,
  frictionModel: 'quasi-steady',
  events: [{
    type: 'pump_trip',
    startTime: 0,
    nodeId: 'pump_1',
  }],
};

// 3. Executar simulacao
const result = runTransientSimulation(pipes, nodes, config);

// 4. Verificar norma
const check = checkTransientCompliance(result, {
  maxPressure: getPipePN(material, diameter),  // PN da tubulacao
  minPressure: 0,  // Evitar cavitacao
});

// 5. Se nao atende, dimensionar protecao
if (!check.compliant) {
  const protection = designProtection(result, pipes, {
    allowedDevices: ['surge_tank', 'air_valve', 'check_valve'],
  });
}
```

---

## 11. Referencias Tecnicas para Implementacao

### Repositorios de Referencia
1. **TSNet** (Python/MIT): https://github.com/glorialulu/TSNet
   - MOC classico com 3 modelos de atrito
   - Entrada via .inp EPANET (via WNTR)
   - Modelagem de bombas, valvulas, tanques de surge, camaras de ar
   - Melhor referencia para a arquitetura geral

2. **Water_Hammer_MATLAB**: https://github.com/Alifarrd/Water_Hammer_MATLAB
   - MOC com interacao fluido-estrutura (FSI)
   - 4 equacoes acopladas (v, p, u, z)
   - Referencia para FSI avancado

3. **GasTranSim.jl** (Julia/MIT): https://github.com/kaarthiksundar/GasTranSim.jl
   - Grade escalonada explicita para transientes compressiveis
   - Boa referencia para arquitetura de E/S e integracao temporal

### Normas
- ABNT NBR 12215:2017 — Projeto de adutora de agua
- ABNT NBR 12214:2020 — Projeto de sistemas de bombeamento
- ABNT NBR 12218:2017 — Projeto de rede de distribuicao
- AWWA M11 — Steel Pipe Design
- AWWA M51 — Air Release Valves
- NR-13 — Vasos de pressao (para TAU)
- SABESP NTS 025 — Projeto hidraulico de adutoras

---

## 12. Prioridade de Implementacao

### Fase 1 (MVP)
1. `transientTypes.ts` — Tipos e interfaces
2. `transientEngine.ts` — MOC basico (tubo unico, reservatorio + bomba)
3. Calculo de celeridade por material
4. Sobrepressao de Joukowsky
5. Envoltoria de pressao max/min
6. UI basica com graficos

### Fase 2 (Integracao)
1. Importar dados do ElevatorStationModule
2. Importar dados do QWater/EPANET
3. Extrair cotas do MDT para perfil
4. Fechamento de valvula (linear/parabolico)
5. Curva da bomba nos 4 quadrantes

### Fase 3 (Protecao)
1. `transientProtection.ts` — Ventosa, TAU, camara de ar, check valve
2. Dimensionamento automatico de protecao
3. Comparacao antes/depois da protecao
4. Verificacao de norma

### Fase 4 (Avancado)
1. Rede complexa (multiplos tubos, ramificacoes)
2. Atrito nao-estacionario (Brunone)
3. Animacao temporal
4. Exportacao de relatorio PDF
5. Modulo de Recalque de Esgoto completo
6. Modulo de Booster de Agua

---

## 13. Contextos de Aplicacao

O modulo deve perguntar ao usuario na abertura:

> **Qual o seu contexto?**
> 1. **Projeto de adutora nova** — Dimensionamento completo + protecao
> 2. **Retrofit** — Verificacao de sistema existente + melhorias
> 3. **Analise pericial** — Investigacao de falha + laudo tecnico

Cada contexto ativa um fluxo de trabalho diferente com formularios e relatorios especificos.
