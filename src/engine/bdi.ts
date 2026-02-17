/**
 * BDI Engine — Benefícios e Despesas Indiretas
 * Cálculos conforme Acórdão TCU 2622/2013
 */

export enum TipoContrato {
  REDE_AGUA = 'Assentamento de Rede de Água',
  REDE_ESGOTO = 'Assentamento de Rede de Esgoto',
  REDE_AGUA_ESGOTO = 'Assentamento de Rede de Água + Esgoto',
  ETA = 'Montagem de ETA',
  ETE = 'Montagem de ETE',
  ESTACAO_ELEVATORIA = 'Estações Elevatórias',
  DRENAGEM = 'Drenagem Pluvial',
  OBRA_CIVIL = 'Obra Civil de Saneamento',
  MANUTENCAO = 'Manutenção de Redes',
  MISTO = 'Contrato Misto'
}

export enum StatusContrato {
  PROPOSTA = 'Proposta',
  EM_ANDAMENTO = 'Em Andamento',
  CONCLUIDO = 'Concluído',
  CANCELADO = 'Cancelado'
}

export interface ContratoBDI {
  id: string;
  nome: string;
  contratante: string;
  tipoContrato: TipoContrato;
  numeroEdital: string;
  dataInicio: string;
  dataTermino: string;
  duracaoMeses: number;
  municipio: string;
  estado: string;
  status: StatusContrato;
  maoDeObra: CargoEquipe[];
  equipamentos: EquipamentoContrato[];
  custoMateriaisMes: number;
  usarOrcamentoPlataforma: boolean;
  composicaoBDI: ComposicaoBDI;
  modoSimplificado: boolean;
  bdiSimplificado: number;
  valorEdital: number;
  createdAt: string;
  updatedAt: string;
}

export interface CargoEquipe {
  id: string;
  cargo: string;
  quantidade: number;
  salarioMensal: number;
  encargosPercent: number;
  custoTotalMes: number;
}

export interface EquipamentoContrato {
  id: string;
  equipamento: string;
  quantidade: number;
  proprioOuAlugado: 'Próprio' | 'Alugado';
  custoMensal: number;
  horasMes: number;
}

export interface ComposicaoBDI {
  administracaoCentral: number;
  seguroGarantia: number;
  risco: number;
  despesasFinanceiras: number;
  lucro: number;
  pis: number;
  cofins: number;
  iss: number;
  cprb: number;
  irpj: number;
  csll: number;
}

export interface OrcamentoContrato {
  custoMaoObraMes: number;
  custoEquipamentosMes: number;
  custoMateriaisMes: number;
  custoDiretoMes: number;
  duracaoMeses: number;
  custoDiretoTotal: number;
}

export interface ResultadoBDI {
  modoSimplificado: boolean;
  bdiPercentual: number;
  bdiValor: number;
  precoVenda: number;
  precoVendaMes: number;
  composicao: ComposicaoBDI;
}

export interface AnaliseViabilidade {
  valorEdital: number;
  precoVendaCalculado: number;
  diferenca: number;
  diferencaPercent: number;
  lucroReal: number;
  lucroRealPercent: number;
  bdiReal: number;
  status: 'VIAVEL' | 'ATENCAO' | 'INVIAVEL';
}

export interface CenarioBDI {
  nome: string;
  bdiPercent: number;
  precoVenda: number;
  margemVsEdital: number;
  margemPercent: number;
  status: 'VIAVEL' | 'ATENCAO' | 'INVIAVEL';
}

export const DEFAULT_COMPOSICAO_BDI: ComposicaoBDI = {
  administracaoCentral: 3.00,
  seguroGarantia: 0.80,
  risco: 1.27,
  despesasFinanceiras: 1.23,
  lucro: 6.16,
  pis: 0.65,
  cofins: 3.00,
  iss: 2.00,
  cprb: 0.00,
  irpj: 0.00,
  csll: 0.00,
};

export const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

export const CARGOS_PADRAO: Omit<CargoEquipe, 'id' | 'custoTotalMes'>[] = [
  { cargo: 'Engenheiro Residente', quantidade: 1, salarioMensal: 18500, encargosPercent: 73.33 },
  { cargo: 'Encarregado de Obra', quantidade: 1, salarioMensal: 6800, encargosPercent: 73.33 },
  { cargo: 'Técnico em Segurança', quantidade: 1, salarioMensal: 5200, encargosPercent: 73.33 },
  { cargo: 'Oficial/Encanador', quantidade: 2, salarioMensal: 3800, encargosPercent: 73.33 },
  { cargo: 'Ajudante Geral', quantidade: 4, salarioMensal: 2100, encargosPercent: 73.33 },
  { cargo: 'Operador de Máquinas', quantidade: 1, salarioMensal: 4500, encargosPercent: 73.33 },
  { cargo: 'Motorista', quantidade: 1, salarioMensal: 3200, encargosPercent: 73.33 },
];

export const EQUIPAMENTOS_PADRAO: Omit<EquipamentoContrato, 'id'>[] = [
  { equipamento: 'Retroescavadeira', quantidade: 1, proprioOuAlugado: 'Alugado', custoMensal: 18500, horasMes: 176 },
  { equipamento: 'Compactador Mecânico', quantidade: 1, proprioOuAlugado: 'Alugado', custoMensal: 3200, horasMes: 176 },
  { equipamento: 'Caminhão Basculante', quantidade: 1, proprioOuAlugado: 'Alugado', custoMensal: 12800, horasMes: 176 },
  { equipamento: 'Caminhão Munk 12t', quantidade: 1, proprioOuAlugado: 'Alugado', custoMensal: 15500, horasMes: 176 },
];

export function calcularCustoCargo(cargo: Omit<CargoEquipe, 'custoTotalMes'>): number {
  return cargo.quantidade * cargo.salarioMensal * (1 + cargo.encargosPercent / 100);
}

export function calcularCustoEquipamento(equip: EquipamentoContrato): number {
  return equip.quantidade * equip.custoMensal;
}

/**
 * Calcula BDI pelo método TCU (Acórdão 2622/2013)
 * BDI = [(1+AC+SG+R+DF) × (1+L) × (1+I)] - 1
 */
export function calcularBDI_TCU(composicao: ComposicaoBDI): number {
  const AC = composicao.administracaoCentral / 100;
  const SG = composicao.seguroGarantia / 100;
  const R  = composicao.risco / 100;
  const DF = composicao.despesasFinanceiras / 100;
  const L  = composicao.lucro / 100;
  const I  = (composicao.pis + composicao.cofins + composicao.iss +
              composicao.cprb + composicao.irpj + composicao.csll) / 100;
  const bdi = ((1 + AC + SG + R + DF) * (1 + L) * (1 + I)) - 1;
  return Math.round(bdi * 10000) / 100;
}

export function calcularPrecoVenda(custoDiretoTotal: number, bdiPercent: number): number {
  return Math.round(custoDiretoTotal * (1 + bdiPercent / 100) * 100) / 100;
}

export function analisarViabilidade(
  custoDiretoTotal: number,
  precoVendaCalculado: number,
  valorEdital: number
): AnaliseViabilidade {
  const diferenca = valorEdital - precoVendaCalculado;
  const diferencaPercent = valorEdital > 0 ? (diferenca / valorEdital) * 100 : 0;
  const lucroReal = valorEdital - custoDiretoTotal;
  const lucroRealPercent = custoDiretoTotal > 0 ? (lucroReal / custoDiretoTotal) * 100 : 0;
  const bdiReal = custoDiretoTotal > 0 ? ((valorEdital / custoDiretoTotal) - 1) * 100 : 0;

  let status: 'VIAVEL' | 'ATENCAO' | 'INVIAVEL';
  if (diferencaPercent > 2) status = 'VIAVEL';
  else if (diferencaPercent >= -2) status = 'ATENCAO';
  else status = 'INVIAVEL';

  return {
    valorEdital,
    precoVendaCalculado,
    diferenca: Math.round(diferenca * 100) / 100,
    diferencaPercent: Math.round(diferencaPercent * 100) / 100,
    lucroReal: Math.round(lucroReal * 100) / 100,
    lucroRealPercent: Math.round(lucroRealPercent * 100) / 100,
    bdiReal: Math.round(bdiReal * 100) / 100,
    status
  };
}

export function gerarCenarios(
  custoDiretoTotal: number,
  valorEdital: number,
  cenariosBDI: number[] = [8, 10, 12, 15, 18, 20, 22, 25, 30]
): CenarioBDI[] {
  return cenariosBDI.map(bdi => {
    const precoVenda = calcularPrecoVenda(custoDiretoTotal, bdi);
    const margem = valorEdital - precoVenda;
    const margemPercent = valorEdital > 0 ? (margem / valorEdital) * 100 : 0;
    let status: 'VIAVEL' | 'ATENCAO' | 'INVIAVEL';
    if (margemPercent > 2) status = 'VIAVEL';
    else if (margemPercent >= -2) status = 'ATENCAO';
    else status = 'INVIAVEL';
    return {
      nome: `BDI ${bdi}%`,
      bdiPercent: bdi,
      precoVenda: Math.round(precoVenda * 100) / 100,
      margemVsEdital: Math.round(margem * 100) / 100,
      margemPercent: Math.round(margemPercent * 100) / 100,
      status
    };
  });
}

export const DEMO_CONTRATO: Omit<ContratoBDI, 'id' | 'createdAt' | 'updatedAt'> = {
  nome: "Itapetininga - Assentamento Rede Água/Esgoto + ETA + Estações Elevatórias",
  contratante: "SABESP",
  tipoContrato: TipoContrato.MISTO,
  numeroEdital: "PE-2025/0142",
  dataInicio: "2025-03-01",
  dataTermino: "2025-12-31",
  duracaoMeses: 10,
  municipio: "Itapetininga",
  estado: "SP",
  status: StatusContrato.EM_ANDAMENTO,
  maoDeObra: [
    { id: "1", cargo: "Engenheiro Residente", quantidade: 1, salarioMensal: 18500, encargosPercent: 73.33, custoTotalMes: 0 },
    { id: "2", cargo: "Encarregado de Obra", quantidade: 3, salarioMensal: 6800, encargosPercent: 73.33, custoTotalMes: 0 },
    { id: "3", cargo: "Técnico em Segurança", quantidade: 1, salarioMensal: 5200, encargosPercent: 73.33, custoTotalMes: 0 },
    { id: "4", cargo: "Oficial/Encanador", quantidade: 12, salarioMensal: 3800, encargosPercent: 73.33, custoTotalMes: 0 },
    { id: "5", cargo: "Ajudante Geral", quantidade: 24, salarioMensal: 2100, encargosPercent: 73.33, custoTotalMes: 0 },
    { id: "6", cargo: "Operador de Máquinas", quantidade: 4, salarioMensal: 4500, encargosPercent: 73.33, custoTotalMes: 0 },
    { id: "7", cargo: "Motorista", quantidade: 6, salarioMensal: 3200, encargosPercent: 73.33, custoTotalMes: 0 },
    { id: "8", cargo: "Almoxarife", quantidade: 1, salarioMensal: 3500, encargosPercent: 73.33, custoTotalMes: 0 },
    { id: "9", cargo: "Topógrafo", quantidade: 2, salarioMensal: 5800, encargosPercent: 73.33, custoTotalMes: 0 },
  ].map(c => ({ ...c, custoTotalMes: calcularCustoCargo(c) })),
  equipamentos: [
    { id: "1", equipamento: "Retroescavadeira", quantidade: 3, proprioOuAlugado: 'Alugado', custoMensal: 18500, horasMes: 176 },
    { id: "2", equipamento: "Compactador Mecânico", quantidade: 4, proprioOuAlugado: 'Alugado', custoMensal: 3200, horasMes: 176 },
    { id: "3", equipamento: "Caminhão Basculante", quantidade: 4, proprioOuAlugado: 'Alugado', custoMensal: 12800, horasMes: 176 },
    { id: "4", equipamento: "Caminhão Munk 12t", quantidade: 2, proprioOuAlugado: 'Alugado', custoMensal: 15500, horasMes: 176 },
    { id: "5", equipamento: "Bomba Submersa", quantidade: 2, proprioOuAlugado: 'Próprio', custoMensal: 1800, horasMes: 80 },
    { id: "6", equipamento: "Gerador 150kVA", quantidade: 1, proprioOuAlugado: 'Alugado', custoMensal: 8500, horasMes: 120 },
    { id: "7", equipamento: "Veículo Apoio", quantidade: 3, proprioOuAlugado: 'Próprio', custoMensal: 4200, horasMes: 176 },
  ],
  custoMateriaisMes: 3500000,
  usarOrcamentoPlataforma: false,
  composicaoBDI: { ...DEFAULT_COMPOSICAO_BDI },
  modoSimplificado: false,
  bdiSimplificado: 12,
  valorEdital: 112000000,
};
