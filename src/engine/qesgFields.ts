/**
 * QEsg Standard Fields — Complete list of required fields for the QEsg sewer network.
 * Based on the original QEsg QGIS plugin by jorgealmerio.
 */

export const QESG_EDGE_FIELDS = [
  { name: "DC_ID", type: "string", description: "Identificador do trecho (Coletor)" },
  { name: "PVM", type: "string", description: "Poço de Visita de Montante" },
  { name: "PVJ", type: "string", description: "Poço de Visita de Jusante" },
  { name: "LENGTH", type: "number", description: "Comprimento do trecho (m)" },
  { name: "CTM", type: "number", description: "Cota do Terreno Montante (m)" },
  { name: "CTJ", type: "number", description: "Cota do Terreno Jusante (m)" },
  { name: "CCM", type: "number", description: "Cota do Coletor Montante (m)" },
  { name: "CCJ", type: "number", description: "Cota do Coletor Jusante (m)" },
  { name: "NA_MON", type: "number", description: "Nível d'Água Montante (m)" },
  { name: "NA_JUS", type: "number", description: "Nível d'Água Jusante (m)" },
  { name: "PRFM", type: "number", description: "Profundidade Montante (m)" },
  { name: "PRFJ", type: "number", description: "Profundidade Jusante (m)" },
  { name: "DIAMETER", type: "number", description: "Diâmetro (mm)" },
  { name: "DECL", type: "number", description: "Declividade (m/m)" },
  { name: "MANNING", type: "number", description: "Coeficiente de Manning" },
  { name: "Q_CONC_INI", type: "number", description: "Vazão Concentrada Inicial (L/s)" },
  { name: "Q_CONC_FIM", type: "number", description: "Vazão Concentrada Final (L/s)" },
  { name: "Q_INI", type: "number", description: "Vazão Inicial (L/s)" },
  { name: "Q_FIM", type: "number", description: "Vazão Final (L/s)" },
  { name: "VEL_INI", type: "number", description: "Velocidade Inicial (m/s)" },
  { name: "VEL_FIM", type: "number", description: "Velocidade Final (m/s)" },
  { name: "VEL_CRI", type: "number", description: "Velocidade Crítica (m/s)" },
  { name: "TRATIVA", type: "number", description: "Tensão Trativa (Pa)" },
  { name: "LAM_INI", type: "number", description: "Lâmina Inicial (y/D)" },
  { name: "LAM_FIM", type: "number", description: "Lâmina Final (y/D)" },
  { name: "LAM_MAX", type: "number", description: "Lâmina Máxima (y/D)" },
  { name: "REC_MIN", type: "number", description: "Recobrimento Mínimo (m)" },
  { name: "CONTR_LADO", type: "number", description: "Contribuição Lateral (L/s)" },
  { name: "ETAPA", type: "string", description: "Etapa de Implantação" },
  { name: "PONTA_SECA", type: "number", description: "Ponta Seca (0/1)" },
  { name: "OBS", type: "string", description: "Observações" },
] as const;

export const QESG_NODE_FIELDS = [
  { name: "ID", type: "string", description: "Identificador do nó" },
  { name: "TIPO", type: "string", description: "Tipo (PV, CI, TL, CR, CP, Exutório)" },
  { name: "COTA_TN", type: "number", description: "Cota do Terreno Natural (m)" },
  { name: "COTA_FUNDO", type: "number", description: "Cota de Fundo (m)" },
  { name: "PROFUNDIDADE", type: "number", description: "Profundidade (m)" },
  { name: "X", type: "number", description: "Coordenada X (UTM)" },
  { name: "Y", type: "number", description: "Coordenada Y (UTM)" },
  { name: "POPULACAO", type: "number", description: "População Contribuinte" },
  { name: "VAZAO_CONC", type: "number", description: "Vazão Concentrada (L/s)" },
] as const;

export type QEsgEdgeFieldName = typeof QESG_EDGE_FIELDS[number]["name"];
export type QEsgNodeFieldName = typeof QESG_NODE_FIELDS[number]["name"];

/** Default pipe table (DN × roughness) for QEsg configuration */
export interface QEsgTuboConfig {
  dn: number;
  rugosidade: number;
  material: string;
}

export const DEFAULT_TUBOS_CONFIG: QEsgTuboConfig[] = [
  { dn: 100, rugosidade: 0.013, material: "PVC" },
  { dn: 150, rugosidade: 0.013, material: "PVC" },
  { dn: 200, rugosidade: 0.013, material: "PVC" },
  { dn: 250, rugosidade: 0.013, material: "PVC" },
  { dn: 300, rugosidade: 0.013, material: "PVC" },
  { dn: 350, rugosidade: 0.013, material: "PVC" },
  { dn: 400, rugosidade: 0.013, material: "PVC" },
  { dn: 450, rugosidade: 0.013, material: "PVC" },
  { dn: 500, rugosidade: 0.013, material: "PVC" },
  { dn: 600, rugosidade: 0.013, material: "PVC" },
  { dn: 700, rugosidade: 0.013, material: "PVC" },
  { dn: 800, rugosidade: 0.013, material: "PVC" },
  { dn: 900, rugosidade: 0.013, material: "PVC" },
  { dn: 1000, rugosidade: 0.013, material: "PVC" },
  { dn: 1200, rugosidade: 0.013, material: "PVC" },
  { dn: 1500, rugosidade: 0.013, material: "PVC" },
  { dn: 300, rugosidade: 0.015, material: "Concreto" },
  { dn: 400, rugosidade: 0.015, material: "Concreto" },
  { dn: 500, rugosidade: 0.015, material: "Concreto" },
  { dn: 600, rugosidade: 0.015, material: "Concreto" },
  { dn: 700, rugosidade: 0.015, material: "Concreto" },
  { dn: 800, rugosidade: 0.015, material: "Concreto" },
  { dn: 900, rugosidade: 0.015, material: "Concreto" },
  { dn: 1000, rugosidade: 0.015, material: "Concreto" },
  { dn: 1200, rugosidade: 0.015, material: "Concreto" },
  { dn: 1500, rugosidade: 0.015, material: "Concreto" },
  { dn: 2000, rugosidade: 0.015, material: "Concreto" },
];

/** QEsg project-level configuration */
export interface QEsgProjectConfig {
  // Layers
  layerRede: string;
  layerNos: string;
  layerInterferencias: string;
  layerMDT: string;

  // Dados (population & hydraulic)
  populacaoInicial: number;
  populacaoSaturacao: number;
  diametroMinimo: number;
  recobrimentoMinimo: number;
  perCapita: number;
  taxaInfiltracao: number;
  k1: number;
  k2: number;
  coefRetorno: number;

  // Tubos
  tubos: QEsgTuboConfig[];

  // Opções de Cálculo
  norma: "NBR 9649" | "NBR 14486";
  laminaMaxima: number;
  velMinima: number;
  velMaxima: number;
  tensaoMinima: number;
  manning: number;
  material: string;
}

export const DEFAULT_QESG_CONFIG: QEsgProjectConfig = {
  layerRede: "",
  layerNos: "",
  layerInterferencias: "",
  layerMDT: "",

  populacaoInicial: 0,
  populacaoSaturacao: 0,
  diametroMinimo: 150,
  recobrimentoMinimo: 0.90,
  perCapita: 160,
  taxaInfiltracao: 0.0005,
  k1: 1.2,
  k2: 1.5,
  coefRetorno: 0.8,

  tubos: [...DEFAULT_TUBOS_CONFIG],

  norma: "NBR 9649",
  laminaMaxima: 0.75,
  velMinima: 0.6,
  velMaxima: 5.0,
  tensaoMinima: 1.0,
  manning: 0.013,
  material: "PVC",
};
