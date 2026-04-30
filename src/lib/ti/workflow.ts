// ============================================================
// WORKFLOW — State Machine de Chamados de T.I
// ============================================================

import type { TiStatus, TiPrioridade } from './types'
import {
  TRANSICOES_VALIDAS,
  TRANSICOES_REQUEREM_JUSTIFICATIVA,
  TRANSICOES_REQUEREM_SOLUCAO,
  STATUS_TERMINAIS,
  STATUS_SLA_PAUSADO,
} from './constants'

// ─── Resultado de validação ───────────────────────────────────
export interface WorkflowValidationResult {
  allowed: boolean
  requiresJustificativa: boolean
  requiresSolucao: boolean
  requiresCancelReason: boolean
  error?: string
}

// ─── Verifica se a transição é válida ─────────────────────────
export function canTransition(de: TiStatus, para: TiStatus): boolean {
  const permitidos = TRANSICOES_VALIDAS[de] ?? []
  return permitidos.includes(para)
}

// ─── Valida transição com todos os requisitos ─────────────────
export function validateTransition(
  de: TiStatus,
  para: TiStatus,
): WorkflowValidationResult {
  if (!canTransition(de, para)) {
    return {
      allowed: false,
      requiresJustificativa: false,
      requiresSolucao: false,
      requiresCancelReason: false,
      error: `Transição de "${de}" para "${para}" não é permitida.`,
    }
  }

  const requerJustificativa =
    TRANSICOES_REQUEREM_JUSTIFICATIVA[de]?.includes(para) ?? false

  const requerSolucao =
    TRANSICOES_REQUEREM_SOLUCAO[de]?.includes(para) ?? false

  const requerMotivoCancelamento = para === 'cancelado'

  return {
    allowed: true,
    requiresJustificativa: requerJustificativa,
    requiresSolucao: requerSolucao,
    requiresCancelReason: requerMotivoCancelamento,
  }
}

// ─── Lista de status possíveis a partir do atual ──────────────
export function getProximosStatus(atual: TiStatus): TiStatus[] {
  return TRANSICOES_VALIDAS[atual] ?? []
}

// ─── Verifica se status é terminal ────────────────────────────
export function isTerminal(status: TiStatus): boolean {
  return STATUS_TERMINAIS.includes(status)
}

// ─── Verifica se SLA deve ser pausado neste status ────────────
export function shouldPauseSla(status: TiStatus): boolean {
  return STATUS_SLA_PAUSADO.includes(status)
}

// ─── Calcula prazo SLA a partir da criação ────────────────────
export function calcularPrazoSla(
  criadoEm: Date,
  prazoHoras: number,
  horarioComercial = true,
): Date {
  if (!horarioComercial) {
    // SLA corrido: soma diretamente as horas
    const prazo = new Date(criadoEm)
    prazo.setHours(prazo.getHours() + prazoHoras)
    return prazo
  }

  // SLA em horário comercial: 08:00–18:00, segunda a sexta
  let horasRestantes = prazoHoras
  const prazo = new Date(criadoEm)

  while (horasRestantes > 0) {
    const diaSemana = prazo.getDay() // 0=domingo, 6=sábado
    const hora = prazo.getHours()

    // Pula fins de semana
    if (diaSemana === 0 || diaSemana === 6) {
      prazo.setDate(prazo.getDate() + 1)
      prazo.setHours(8, 0, 0, 0)
      continue
    }

    // Fora do horário comercial (antes das 08h ou após as 18h)
    if (hora < 8) {
      prazo.setHours(8, 0, 0, 0)
      continue
    }
    if (hora >= 18) {
      prazo.setDate(prazo.getDate() + 1)
      prazo.setHours(8, 0, 0, 0)
      continue
    }

    // Dentro do horário: quantas horas restam hoje?
    const horasHoje = 18 - hora
    if (horasRestantes <= horasHoje) {
      prazo.setHours(prazo.getHours() + horasRestantes)
      horasRestantes = 0
    } else {
      horasRestantes -= horasHoje
      prazo.setDate(prazo.getDate() + 1)
      prazo.setHours(8, 0, 0, 0)
    }
  }

  return prazo
}

// ─── Calcula percentual do SLA consumido ─────────────────────
export interface SlaCalculo {
  percentual: number           // 0-100+
  horasRestantes: number
  minutosRestantes: number
  violado: boolean
  status: 'ok' | 'warning' | 'critical' | 'expired'
}

export function calcularSla(
  prazoSla: string | null,
  slaViolado: boolean,
  slaHorasPausadas = 0,
  criadoEm?: string,
): SlaCalculo | null {
  if (!prazoSla) return null

  const agora = new Date()
  const prazo = new Date(prazoSla)
  const msRestante = prazo.getTime() - agora.getTime()
  const horasRestantes = msRestante / (1000 * 60 * 60)
  const minutosRestantes = msRestante / (1000 * 60)
  const violado = msRestante <= 0 || slaViolado

  // Percentual: estimamos com base em criadoEm ou marcamos como >100
  let percentual = 100
  if (criadoEm) {
    const criado = new Date(criadoEm)
    const totalMs = prazo.getTime() - criado.getTime()
    const consumidoMs = agora.getTime() - criado.getTime()
    percentual = totalMs > 0 ? Math.min((consumidoMs / totalMs) * 100, 200) : 100
  } else if (violado) {
    percentual = 110
  }

  let status: SlaCalculo['status']
  if (violado || percentual >= 100) {
    status = 'expired'
  } else if (percentual >= 90) {
    status = 'critical'
  } else if (percentual >= 70) {
    status = 'warning'
  } else {
    status = 'ok'
  }

  return { percentual, horasRestantes, minutosRestantes, violado, status }
}

// ─── SLA padrão por prioridade (fallback) ─────────────────────
export const SLA_HORAS_PADRAO: Record<TiPrioridade, number> = {
  critica: 4,
  alta:    8,
  media:   24,
  baixa:   72,
}

export function getPrazoHorasPadrao(prioridade: TiPrioridade): number {
  return SLA_HORAS_PADRAO[prioridade]
}
