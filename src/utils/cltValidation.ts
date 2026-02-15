// Utilitários de validação CLT

export interface ConfiguracaoCLT {
  jornada_diaria_padrao: number;
  jornada_semanal_padrao: number;
  limite_horas_extras_dia: number;
  percentual_hora_extra_50: number;
  percentual_hora_extra_100: number;
  intervalo_minimo_6h: number;
  intervalo_minimo_4h: number;
  descanso_entre_jornadas: number;
  dias_trabalho_antes_folga: number;
  hora_inicio_noturno: string;
  hora_fim_noturno: string;
  percentual_adicional_noturno: number;
}

export interface AlertaCLT {
  tipo: 'bloqueio' | 'alerta' | 'info';
  mensagem: string;
  regra: string;
}

export const CONFIG_CLT_PADRAO: ConfiguracaoCLT = {
  jornada_diaria_padrao: 8,
  jornada_semanal_padrao: 44,
  limite_horas_extras_dia: 2,
  percentual_hora_extra_50: 50,
  percentual_hora_extra_100: 100,
  intervalo_minimo_6h: 1,
  intervalo_minimo_4h: 0.25,
  descanso_entre_jornadas: 11,
  dias_trabalho_antes_folga: 6,
  hora_inicio_noturno: '22:00',
  hora_fim_noturno: '05:00',
  percentual_adicional_noturno: 20,
};

// Calcular horas trabalhadas
export function calcularHorasTrabalhadas(
  horaEntrada: string,
  horaSaida: string,
  horaInicioIntervalo?: string,
  horaFimIntervalo?: string
): number {
  const [entradaH, entradaM] = horaEntrada.split(':').map(Number);
  const [saidaH, saidaM] = horaSaida.split(':').map(Number);
  
  let totalMinutos = (saidaH * 60 + saidaM) - (entradaH * 60 + entradaM);
  
  // Se saída menor que entrada, passou da meia-noite
  if (totalMinutos < 0) {
    totalMinutos += 24 * 60;
  }
  
  // Descontar intervalo
  if (horaInicioIntervalo && horaFimIntervalo) {
    const [inicioIntH, inicioIntM] = horaInicioIntervalo.split(':').map(Number);
    const [fimIntH, fimIntM] = horaFimIntervalo.split(':').map(Number);
    const intervaloMinutos = (fimIntH * 60 + fimIntM) - (inicioIntH * 60 + inicioIntM);
    totalMinutos -= Math.max(0, intervaloMinutos);
  }
  
  return totalMinutos / 60;
}

// Calcular horas noturnas (22h às 05h)
export function calcularHorasNoturnas(
  horaEntrada: string,
  horaSaida: string,
  config: ConfiguracaoCLT = CONFIG_CLT_PADRAO
): number {
  const [entradaH, entradaM] = horaEntrada.split(':').map(Number);
  const [saidaH, saidaM] = horaSaida.split(':').map(Number);
  const [inicioNotH] = config.hora_inicio_noturno.split(':').map(Number);
  const [fimNotH] = config.hora_fim_noturno.split(':').map(Number);
  
  let horasNoturnas = 0;
  
  // Verificar cada hora se está no período noturno
  for (let h = entradaH; h !== saidaH || (h === entradaH && saidaH !== entradaH); h = (h + 1) % 24) {
    if (h >= inicioNotH || h < fimNotH) {
      horasNoturnas += 1;
    }
  }
  
  return horasNoturnas;
}

// Validar escala conforme CLT
export function validarEscalaCLT(
  horasTrabalhadas: number,
  horasNoturnas: number,
  temIntervalo: boolean,
  diasTrabalhadosConsecutivos: number,
  horasDescansoAnterior: number,
  config: ConfiguracaoCLT = CONFIG_CLT_PADRAO
): AlertaCLT[] {
  const alertas: AlertaCLT[] = [];
  
  // Limite de jornada diária + horas extras
  const limiteTotal = config.jornada_diaria_padrao + config.limite_horas_extras_dia;
  if (horasTrabalhadas > limiteTotal) {
    alertas.push({
      tipo: 'bloqueio',
      mensagem: `Jornada de ${horasTrabalhadas.toFixed(1)}h excede limite de ${limiteTotal}h`,
      regra: 'Art. 59 CLT - Máximo 2h extras/dia'
    });
  } else if (horasTrabalhadas > config.jornada_diaria_padrao) {
    const extras = horasTrabalhadas - config.jornada_diaria_padrao;
    alertas.push({
      tipo: 'alerta',
      mensagem: `${extras.toFixed(1)}h extras serão computadas`,
      regra: 'Art. 59 CLT - Horas extras'
    });
  }
  
  // Intervalo intrajornada
  if (horasTrabalhadas > 6 && !temIntervalo) {
    alertas.push({
      tipo: 'bloqueio',
      mensagem: 'Jornada > 6h requer intervalo mínimo de 1h',
      regra: 'Art. 71 CLT - Intervalo intrajornada'
    });
  } else if (horasTrabalhadas > 4 && horasTrabalhadas <= 6 && !temIntervalo) {
    alertas.push({
      tipo: 'alerta',
      mensagem: 'Jornada 4-6h deve ter intervalo de 15min',
      regra: 'Art. 71 §1º CLT'
    });
  }
  
  // Descanso entre jornadas
  if (horasDescansoAnterior > 0 && horasDescansoAnterior < config.descanso_entre_jornadas) {
    alertas.push({
      tipo: 'bloqueio',
      mensagem: `Descanso de ${horasDescansoAnterior.toFixed(1)}h é menor que ${config.descanso_entre_jornadas}h`,
      regra: 'Art. 66 CLT - Descanso entre jornadas'
    });
  }
  
  // DSR - Descanso Semanal Remunerado
  if (diasTrabalhadosConsecutivos >= config.dias_trabalho_antes_folga) {
    alertas.push({
      tipo: 'bloqueio',
      mensagem: `${diasTrabalhadosConsecutivos} dias consecutivos - folga obrigatória`,
      regra: 'Art. 67 CLT - DSR'
    });
  } else if (diasTrabalhadosConsecutivos >= config.dias_trabalho_antes_folga - 1) {
    alertas.push({
      tipo: 'alerta',
      mensagem: 'Próximo dia deve ser folga (DSR)',
      regra: 'Art. 67 CLT - DSR'
    });
  }
  
  // Adicional noturno
  if (horasNoturnas > 0) {
    alertas.push({
      tipo: 'info',
      mensagem: `${horasNoturnas.toFixed(1)}h noturnas (+${config.percentual_adicional_noturno}%)`,
      regra: 'Art. 73 CLT - Adicional noturno'
    });
  }
  
  return alertas;
}

// Calcular custo da escala
export function calcularCustoEscala(
  horasTrabalhadas: number,
  horasNoturnas: number,
  salarioBase: number,
  isDomingo: boolean,
  isFeriado: boolean,
  config: ConfiguracaoCLT = CONFIG_CLT_PADRAO
): { 
  horasNormais: number;
  horasExtras: number;
  valorHoraNormal: number;
  valorHoraExtra: number;
  valorAdicionalNoturno: number;
  custoTotal: number;
} {
  const horasMes = 220; // CLT padrão
  const valorHora = salarioBase / horasMes;
  
  let horasNormais = Math.min(horasTrabalhadas, config.jornada_diaria_padrao);
  let horasExtras = Math.max(0, horasTrabalhadas - config.jornada_diaria_padrao);
  
  // Percentual de hora extra
  let percentualExtra = config.percentual_hora_extra_50;
  if (isDomingo || isFeriado) {
    percentualExtra = config.percentual_hora_extra_100;
    // Em domingo/feriado, todas as horas são extras
    horasExtras = horasTrabalhadas;
    horasNormais = 0;
  }
  
  const valorHoraNormal = valorHora * horasNormais;
  const valorHoraExtra = valorHora * (1 + percentualExtra / 100) * horasExtras;
  const valorAdicionalNoturno = valorHora * (config.percentual_adicional_noturno / 100) * horasNoturnas;
  
  const custoTotal = valorHoraNormal + valorHoraExtra + valorAdicionalNoturno;
  
  return {
    horasNormais,
    horasExtras,
    valorHoraNormal,
    valorHoraExtra,
    valorAdicionalNoturno,
    custoTotal
  };
}

// Formatar moeda
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

// Gerar escalas automáticas
export function gerarEscala6x1(
  dataInicio: Date,
  funcionarioId: string,
  horaEntrada: string,
  horaSaida: string,
  diasGerar: number = 30
): Array<{
  funcionario_id: string;
  data: string;
  hora_entrada: string;
  hora_saida: string;
  is_folga: boolean;
  tipo_escala: string;
}> {
  const escalas = [];
  let diasTrabalhados = 0;
  
  for (let i = 0; i < diasGerar; i++) {
    const data = new Date(dataInicio);
    data.setDate(data.getDate() + i);
    
    const isFolga = diasTrabalhados >= 6;
    
    escalas.push({
      funcionario_id: funcionarioId,
      data: data.toISOString().split('T')[0],
      hora_entrada: isFolga ? '00:00' : horaEntrada,
      hora_saida: isFolga ? '00:00' : horaSaida,
      is_folga: isFolga,
      tipo_escala: '6x1'
    });
    
    if (isFolga) {
      diasTrabalhados = 0;
    } else {
      diasTrabalhados++;
    }
  }
  
  return escalas;
}

export function gerarEscala12x36(
  dataInicio: Date,
  funcionarioId: string,
  horaEntrada: string,
  diasGerar: number = 30
): Array<{
  funcionario_id: string;
  data: string;
  hora_entrada: string;
  hora_saida: string;
  is_folga: boolean;
  tipo_escala: string;
}> {
  const escalas = [];
  
  // Calcular hora de saída (12h depois)
  const [h, m] = horaEntrada.split(':').map(Number);
  const saidaH = (h + 12) % 24;
  const horaSaida = `${String(saidaH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  
  for (let i = 0; i < diasGerar; i++) {
    const data = new Date(dataInicio);
    data.setDate(data.getDate() + i);
    
    // 12x36: trabalha um dia, folga outro
    const isFolga = i % 2 === 1;
    
    escalas.push({
      funcionario_id: funcionarioId,
      data: data.toISOString().split('T')[0],
      hora_entrada: isFolga ? '00:00' : horaEntrada,
      hora_saida: isFolga ? '00:00' : horaSaida,
      is_folga: isFolga,
      tipo_escala: '12x36'
    });
  }
  
  return escalas;
}
