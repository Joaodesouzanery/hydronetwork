/**
 * Construction parameters and execution rules for sanitation networks.
 * Ported from Python engine_rede/construction.py
 */

export type TipoSolo = "normal" | "saturado" | "rochoso";
export type TipoEscavacao = "manual" | "mecanizada" | "mista";
export type TipoPavimento = "terra" | "paralelepipedo" | "asfalto" | "concreto" | "bloquete";
export type TipoMaterial = "PVC" | "PEAD" | "Concreto" | "Ferro Fundido";

const PROFUNDIDADE_ESCORAMENTO = 1.25;

export interface RequisitoEscoramento {
  necessario: boolean;
  profundidade: number;
  tipo: string;
}

export interface RequisitoEmbasamento {
  necessario: boolean;
  lastroAreia: boolean;
  lastroBrita: boolean;
  dreno: boolean;
}

export interface RequisitoAssentamento {
  material: TipoMaterial;
  termofusao: boolean;
  equipamentoPesado: boolean;
  juntaEspecial: boolean;
}

export interface RequisitoRecomposicao {
  tipoPavimento: TipoPavimento;
  subbase: boolean;
  base: boolean;
  bgs: boolean;
  cbuq: boolean;
}

export interface ComposicaoEquipe {
  encarregado: number;
  pedreiro: number;
  servente: number;
  operadorMaquina: number;
  soldadorPead: number;
  adicionalEscoramento: number;
  adicionalEmbasamento: number;
  adicionalMaterial: number;
  totalProfissionais: number;
  totalAjudantes: number;
  totalEquipe: number;
}

export interface ParametrosExecucao {
  tipoSolo: TipoSolo;
  tipoEscavacao: TipoEscavacao;
  tipoPavimento: TipoPavimento;
  tipoMaterial: TipoMaterial;
  profundidade: number;
  escoramento: RequisitoEscoramento;
  embasamento: RequisitoEmbasamento;
  assentamento: RequisitoAssentamento;
  recomposicao: RequisitoRecomposicao;
  equipe: ComposicaoEquipe;
}

function calcularEscoramento(profundidade: number): RequisitoEscoramento {
  const necessario = profundidade > PROFUNDIDADE_ESCORAMENTO;
  return {
    necessario,
    profundidade,
    tipo: profundidade <= 3.0 ? "Pontaleteamento" : "Estacas-prancha",
  };
}

function calcularEmbasamento(tipoSolo: TipoSolo): RequisitoEmbasamento {
  if (tipoSolo === "saturado") {
    return { necessario: true, lastroAreia: true, lastroBrita: true, dreno: true };
  }
  if (tipoSolo === "rochoso") {
    return { necessario: true, lastroAreia: true, lastroBrita: false, dreno: false };
  }
  return { necessario: false, lastroAreia: false, lastroBrita: false, dreno: false };
}

function calcularAssentamento(tipoMaterial: TipoMaterial): RequisitoAssentamento {
  switch (tipoMaterial) {
    case "PEAD":
      return { material: tipoMaterial, termofusao: true, equipamentoPesado: false, juntaEspecial: true };
    case "Concreto":
    case "Ferro Fundido":
      return { material: tipoMaterial, termofusao: false, equipamentoPesado: true, juntaEspecial: true };
    default:
      return { material: tipoMaterial, termofusao: false, equipamentoPesado: false, juntaEspecial: false };
  }
}

function calcularRecomposicao(tipoPavimento: TipoPavimento): RequisitoRecomposicao {
  switch (tipoPavimento) {
    case "asfalto":
      return { tipoPavimento, subbase: true, base: true, bgs: true, cbuq: true };
    case "concreto":
      return { tipoPavimento, subbase: true, base: true, bgs: false, cbuq: false };
    case "paralelepipedo":
    case "bloquete":
      return { tipoPavimento, subbase: false, base: true, bgs: false, cbuq: false };
    default:
      return { tipoPavimento, subbase: false, base: false, bgs: false, cbuq: false };
  }
}

function calcularEquipe(
  tipoEscavacao: TipoEscavacao,
  escoramento: RequisitoEscoramento,
  embasamento: RequisitoEmbasamento,
  tipoSolo: TipoSolo,
  tipoMaterial: TipoMaterial
): ComposicaoEquipe {
  let encarregado = 1;
  let pedreiro = 0;
  let servente = 2;
  let operadorMaquina = 0;
  let soldadorPead = 0;
  let adicionalEscoramento = 0;
  let adicionalEmbasamento = 0;
  let adicionalMaterial = 0;

  if (tipoEscavacao === "mecanizada" || tipoEscavacao === "mista") {
    operadorMaquina = 1;
  }

  if (escoramento.necessario) {
    adicionalEscoramento = 1;
    pedreiro += 1;
  }

  if (embasamento.necessario && tipoSolo === "saturado") {
    adicionalEmbasamento = 1;
  }

  if (tipoMaterial === "PEAD") {
    soldadorPead = 1;
    adicionalMaterial = 1;
  } else if (tipoMaterial === "Concreto" || tipoMaterial === "Ferro Fundido") {
    adicionalMaterial = 1;
  }

  const totalProfissionais =
    encarregado + pedreiro + operadorMaquina + soldadorPead +
    adicionalEscoramento + adicionalEmbasamento + adicionalMaterial;

  let totalAjudantes = servente;
  if (adicionalEscoramento > 0) totalAjudantes += 1;
  if (adicionalEmbasamento > 0) totalAjudantes += 1;
  if (adicionalMaterial > 0) totalAjudantes += 1;

  return {
    encarregado,
    pedreiro,
    servente,
    operadorMaquina,
    soldadorPead,
    adicionalEscoramento,
    adicionalEmbasamento,
    adicionalMaterial,
    totalProfissionais,
    totalAjudantes,
    totalEquipe: totalProfissionais + totalAjudantes,
  };
}

export function criarParametrosExecucao(
  tipoSolo: TipoSolo,
  tipoEscavacao: TipoEscavacao,
  tipoPavimento: TipoPavimento,
  tipoMaterial: TipoMaterial,
  profundidade: number
): ParametrosExecucao {
  const escoramento = calcularEscoramento(profundidade);
  const embasamento = calcularEmbasamento(tipoSolo);
  const assentamento = calcularAssentamento(tipoMaterial);
  const recomposicao = calcularRecomposicao(tipoPavimento);
  const equipe = calcularEquipe(tipoEscavacao, escoramento, embasamento, tipoSolo, tipoMaterial);

  return {
    tipoSolo,
    tipoEscavacao,
    tipoPavimento,
    tipoMaterial,
    profundidade,
    escoramento,
    embasamento,
    assentamento,
    recomposicao,
    equipe,
  };
}

export function calcularProfundidadeTrecho(
  cotaTerrenoInicio: number,
  cotaTerrenoFim: number,
  cotaTuboInicio: number,
  cotaTuboFim: number
): number {
  const profInicio = cotaTerrenoInicio - cotaTuboInicio;
  const profFim = cotaTerrenoFim - cotaTuboFim;
  return (profInicio + profFim) / 2;
}
