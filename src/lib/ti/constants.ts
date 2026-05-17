// ============================================================
// CONSTANTS — Sistema de Chamados de T.I
// ============================================================

import type { TiStatus, TiPrioridade, TiTipo, TiOrigem, TiAtivoTipo } from './types'

// ─── Storage ──────────────────────────────────────────────────
export const TI_STORAGE_BUCKET = 'ti-attachments'

// ─── Labels de Status ─────────────────────────────────────────
export const STATUS_LABELS: Record<TiStatus, string> = {
  aberto:             'Aberto',
  em_atendimento:     'Em Atendimento',
  pendente_usuario:   'Aguardando Usuário',
  pendente_terceiro:  'Aguardando Terceiros',
  escalado:           'Escalado',
  resolvido:          'Encerrado / Resolvido',
  fechado:            'Encerrado / Resolvido',
  fechado_automatico: 'Encerrado / Resolvido',
  reaberto:           'Reaberto',
  cancelado:          'Cancelado',
}

// ─── Cores de Status ──────────────────────────────────────────
export const STATUS_COLORS: Record<TiStatus, { color: string; bg: string; border: string }> = {
  aberto:             { color: '#2563EB', bg: 'rgba(37,99,235,0.08)',   border: '#2563EB' },
  em_atendimento:     { color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', border: '#7C3AED' },
  pendente_usuario:   { color: '#D97706', bg: 'rgba(217,119,6,0.08)',  border: '#D97706' },
  pendente_terceiro:  { color: '#EA580C', bg: 'rgba(234,88,12,0.08)',  border: '#EA580C' },
  escalado:           { color: '#DC2626', bg: 'rgba(220,38,38,0.08)',  border: '#DC2626' },
  resolvido:          { color: '#059669', bg: 'rgba(5,150,105,0.08)',  border: '#059669' },
  fechado:            { color: '#16A34A', bg: 'rgba(22,163,74,0.08)',  border: '#16A34A' },
  fechado_automatico: { color: '#6B7280', bg: 'rgba(107,114,128,0.08)',border: '#6B7280' },
  reaberto:           { color: '#B91C1C', bg: 'rgba(185,28,28,0.08)',  border: '#B91C1C' },
  cancelado:          { color: '#374151', bg: 'rgba(55,65,81,0.08)',   border: '#374151' },
}

// ─── Labels de Prioridade ─────────────────────────────────────
export const PRIORIDADE_LABELS: Record<TiPrioridade, string> = {
  critica: 'Crítica',
  alta:    'Alta',
  media:   'Média',
  baixa:   'Baixa',
}

// ─── Cores de Prioridade ──────────────────────────────────────
export const PRIORIDADE_COLORS: Record<TiPrioridade, { color: string; bg: string }> = {
  critica: { color: '#DC2626', bg: 'rgba(220,38,38,0.1)'  },
  alta:    { color: '#EA580C', bg: 'rgba(234,88,12,0.1)'  },
  media:   { color: '#D97706', bg: 'rgba(217,119,6,0.1)'  },
  baixa:   { color: '#6B7280', bg: 'rgba(107,114,128,0.1)'},
}

// ─── Labels de Tipo ───────────────────────────────────────────
export const TIPO_LABELS: Record<TiTipo, string> = {
  incidente:   'Incidente',
  solicitacao: 'Solicitação',
  problema:    'Problema',
  mudanca:     'Mudança',
}

// ─── Labels de Origem ─────────────────────────────────────────
export const ORIGEM_LABELS: Record<TiOrigem, string> = {
  portal:     'Portal',
  email:      'E-mail',
  telefone:   'Telefone',
  presencial: 'Presencial',
  api:        'API',
}

// ─── Labels de Ativo ──────────────────────────────────────────
export const ATIVO_TIPO_LABELS: Record<TiAtivoTipo, string> = {
  computador:  'Computador',
  notebook:    'Notebook',
  monitor:     'Monitor',
  impressora:  'Impressora',
  telefone:    'Telefone',
  servidor:    'Servidor',
  switch:      'Switch',
  nobreak:     'Nobreak',
  outros:      'Outros',
}

// ─── Status terminais (não transitam mais) ────────────────────
export const STATUS_TERMINAIS: TiStatus[] = ['fechado', 'fechado_automatico', 'cancelado']

// ─── Status terminais para fins de SLA (inclui 'resolvido') ──
export const STATUS_TERMINAIS_SLA: TiStatus[] = ['fechado', 'fechado_automatico', 'cancelado', 'resolvido']

// ─── Status que SLA continua correndo ─────────────────────────
export const STATUS_SLA_ATIVO: TiStatus[] = [
  'aberto', 'em_atendimento', 'reaberto'
]

// ─── Status que pausam o SLA ──────────────────────────────────
export const STATUS_SLA_PAUSADO: TiStatus[] = [
  'pendente_usuario', 'pendente_terceiro', 'escalado'
]

// ─── Transições válidas (State Machine) ───────────────────────
export const TRANSICOES_VALIDAS: Record<TiStatus, TiStatus[]> = {
  aberto:             ['em_atendimento', 'cancelado'],
  em_atendimento:     ['resolvido', 'cancelado', 'pendente_usuario', 'pendente_terceiro', 'escalado'],
  pendente_usuario:   ['em_atendimento', 'cancelado', 'resolvido'],
  pendente_terceiro:  ['em_atendimento', 'cancelado', 'resolvido'],
  escalado:           ['em_atendimento', 'cancelado', 'resolvido'],
  resolvido:          ['reaberto'],
  fechado:            ['reaberto'],
  fechado_automatico: ['reaberto'],
  reaberto:           ['em_atendimento', 'cancelado'],
  cancelado:          [],
}

// ─── Transições que requerem justificativa ────────────────────
export const TRANSICOES_REQUEREM_JUSTIFICATIVA: Partial<Record<TiStatus, TiStatus[]>> = {
  em_atendimento: ['cancelado', 'escalado', 'pendente_usuario', 'pendente_terceiro'],
  resolvido:      ['reaberto'],
  fechado:        ['reaberto'],
}

// ─── Transições que requerem solução ─────────────────────────
export const TRANSICOES_REQUEREM_SOLUCAO: Partial<Record<TiStatus, TiStatus[]>> = {
  em_atendimento: ['resolvido'],
}

// ─── Configurações de auto-fechamento ─────────────────────────
export const AUTO_CLOSE_DIAS_SEM_RESPOSTA = 7  // dias sem resposta → fecha
export const LEMBRETE_DIAS_SEM_RESPOSTA   = 3  // dias → envia lembrete

// ─── Paginação ────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE     = 100

// ─── SLA helpers ──────────────────────────────────────────────
export const SLA_ALERTA_PCT  = 70  // alerta amarelo
export const SLA_CRITICO_PCT = 90  // alerta vermelho

// ─── Tamanho máximo de upload ─────────────────────────────────
export const MAX_FILE_SIZE_MB  = 20
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

// ─── Tipos MIME aceitos ───────────────────────────────────────
export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
]
