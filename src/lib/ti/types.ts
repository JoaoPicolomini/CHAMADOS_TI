// ============================================================
// TIPOS — Sistema de Chamados de T.I
// ============================================================

// ─── Enums ────────────────────────────────────────────────────

export type TiStatus =
  | 'aberto'
  | 'em_atendimento'
  | 'pendente_usuario'
  | 'pendente_terceiro'
  | 'escalado'
  | 'resolvido'
  | 'fechado'
  | 'fechado_automatico'
  | 'reaberto'
  | 'cancelado'

export type TiPrioridade = 'critica' | 'alta' | 'media' | 'baixa'

export type TiTipo = 'incidente' | 'solicitacao' | 'problema' | 'mudanca'

export type TiOrigem = 'portal' | 'email' | 'telefone' | 'presencial' | 'api'

export type TiNivelSuporte = 1 | 2 | 3

export type TiPerfil = 'user' | 'tecnico' | 'gestor_ti' | 'admin'

export type TiAtivoTipo =
  | 'computador'
  | 'notebook'
  | 'monitor'
  | 'impressora'
  | 'telefone'
  | 'servidor'
  | 'switch'
  | 'nobreak'
  | 'outros'

export type TiAtivoStatus = 'ativo' | 'manutencao' | 'descartado' | 'emprestado' | 'reserva'

export type TiAnexoCategoria = 'screenshot' | 'log' | 'documento' | 'outro'

export type TiRelacionamentoTipo = 'duplicata' | 'pai_filho' | 'relacionado'

// ─── Entidades ────────────────────────────────────────────────

export interface TiCategoria {
  id: string
  nome: string
  slug: string
  categoria_pai: string | null
  icone: string | null
  descricao: string | null
  ordem: number
  ativo: boolean
  tipo_padrao: TiTipo
  severidade: TiPrioridade | null
  created_at: string
  // Relações
  subcategorias?: TiCategoria[]
  pai?: TiCategoria
}

export interface TiSetor {
  id: string
  nome: string
  ativo: boolean
  created_at: string
}

export interface TiUnidade {
  id: string
  nome: string
  ativo: boolean
  created_at: string
}

export interface TiEquipe {
  id: string
  nome: string
  descricao: string | null
  email_fila: string | null
  nivel: number
  ativo: boolean
  created_at: string
  updated_at: string
  // Relações
  tecnicos?: TiTecnico[]
}

export interface TiTecnico {
  id: string
  user_id: string | null
  email: string
  nome: string
  cargo: string | null
  equipe_id: string | null
  ramal: string | null
  ativo: boolean
  created_at: string
  updated_at: string
  // Relações
  equipe?: TiEquipe
}

export interface TiAtivo {
  id: string
  tipo: TiAtivoTipo
  nome: string
  patrimonio: string | null
  numero_serie: string | null
  modelo: string | null
  fabricante: string | null
  setor: string | null
  responsavel: string | null
  ip: string | null
  hostname: string | null
  sistema_operacional: string | null
  data_aquisicao: string | null
  garantia_ate: string | null
  status: TiAtivoStatus
  observacoes: string | null
  valor_compra: number | null
  imei: string | null
  created_at: string
  updated_at: string
}

export interface TiSlaConfig {
  id: string
  prioridade: TiPrioridade
  categoria_id: string | null
  prazo_horas: number
  alerta_pct_70: boolean
  alerta_pct_90: boolean
  horario_comercial: boolean
  ativo: boolean
  created_at: string
  updated_at: string
  categoria?: {
    id: string
    nome: string
    categoria_pai: string | null
    pai?: {
      nome: string
    }
  }
}

export interface TiChamado {
  id: string
  numero: string

  // Solicitante
  solicitante_nome: string
  solicitante_email: string
  solicitante_ramal: string | null
  solicitante_setor: string
  solicitante_unidade: string | null

  // Classificação
  categoria_id: string | null
  subcategoria_id: string | null
  prioridade: TiPrioridade
  tipo: TiTipo

  // Conteúdo
  titulo: string
  descricao: string
  passos_reproduzir: string | null

  // Ativo
  ativo_id: string | null
  ativo_descricao: string | null

  // Atribuição
  equipe_id: string | null
  tecnico_id: string | null

  // Status
  status: TiStatus

  // SLA
  sla_prazo: string | null
  sla_pausado_em: string | null
  sla_horas_pausadas: number
  sla_violado: boolean
  sla_violado_em: string | null

  // Escalonamento
  nivel_suporte: TiNivelSuporte
  escalado_em: string | null
  escalado_por: string | null

  // Resolução
  solucao: string | null
  causa_raiz: string | null
  artigo_kb_id: string | null

  // Fechamento
  motivo_cancelamento: string | null
  fechado_em: string | null
  fechado_por: string | null

  // Satisfação
  satisfacao_nota: number | null
  satisfacao_comentario: string | null
  satisfacao_respondido_em: string | null
  satisfacao_enviado_em: string | null

  // Metadados
  ip_abertura: string | null
  origem: TiOrigem
  tags: string[] | null

  created_at: string
  updated_at: string

  // Relações (join)
  categoria?: TiCategoria
  subcategoria?: TiCategoria
  equipe?: TiEquipe
  tecnico?: TiAccessUser
  ativo?: TiAtivo
}

export interface TiWorkflowEvent {
  id: string
  chamado_id: string
  status_de: TiStatus | null
  status_para: TiStatus
  realizado_por: string
  justificativa: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface TiFieldChangeLog {
  id: string
  chamado_id: string
  campo: string
  valor_antigo: string | null
  valor_novo: string | null
  alterado_por: string
  created_at: string
}

export interface TiComentario {
  id: string
  chamado_id: string
  autor_nome: string
  autor_email: string
  conteudo: string
  interno: boolean
  created_at: string
  updated_at: string
}

export interface TiAnexo {
  id: string
  chamado_id: string
  categoria: TiAnexoCategoria | null
  storage_path: string
  nome_original: string
  mime_type: string | null
  tamanho_bytes: number | null
  hash_sha256: string | null
  enviado_por: string | null
  enviado_por_ip: string | null
  deleted_at: string | null
  deleted_por: string | null
  created_at: string
}

export interface TiRelacionamento {
  id: string
  chamado_id: string
  relacionado_id: string
  tipo: TiRelacionamentoTipo
  criado_por: string
  created_at: string
  // Relações
  chamado?: Partial<TiChamado>
  relacionado?: Partial<TiChamado>
}

export interface TiBaseConhecimento {
  id: string
  titulo: string
  conteudo: string
  categoria_id: string | null
  tags: string[] | null
  publicado: boolean
  visualizacoes: number
  util_sim: number
  util_nao: number
  autor_email: string
  created_at: string
  updated_at: string
  // Relações
  categoria?: TiCategoria
}

export interface TiAccessUser {
  id: string
  email: string
  nome: string
  cargo: string | null
  perfil: TiPerfil
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface TiNotificationLog {
  id: string
  chamado_id: string | null
  tipo: string
  destinatario: string
  status: 'pendente' | 'enviado' | 'falhou'
  tentativas: number
  erro: string | null
  enviado_em: string | null
  created_at: string
}

export interface TiEmailLog {
  id: string
  chamado_id: string | null
  recipient: string
  subject: string
  status: 'success' | 'error'
  error_message: string | null
  created_at: string
}

// ─── DTOs / Payloads ──────────────────────────────────────────

export interface CriarChamadoPayload {
  solicitante_nome: string
  solicitante_email: string
  solicitante_ramal?: string
  solicitante_setor: string
  solicitante_unidade?: string
  categoria_id?: string
  subcategoria_id?: string
  prioridade?: TiPrioridade
  tipo?: TiTipo
  descricao: string
  ativo_id?: string
  ativo_descricao?: string
  origem?: TiOrigem
  tags?: string[]
}

export interface TransicaoStatusPayload {
  chamado_id: string
  novo_status: TiStatus
  justificativa?: string
  solucao?: string
  causa_raiz?: string
  motivo_cancelamento?: string
  realizado_por: string
}

export interface AtribuirChamadoPayload {
  chamado_id: string
  tecnico_id?: string | null
  equipe_id?: string | null
  atribuido_por: string
}

export interface EscalarChamadoPayload {
  chamado_id: string
  nivel_destino: TiNivelSuporte
  equipe_destino_id?: string
  justificativa: string
  escalado_por: string
}

export interface AdicionarComentarioPayload {
  chamado_id: string
  autor_nome: string
  autor_email: string
  conteudo: string
  interno: boolean
}

// ─── UI Helpers ───────────────────────────────────────────────

export interface StatusInfo {
  label: string
  color: string
  bg: string
  icon?: string
}

export interface PrioridadeInfo {
  label: string
  color: string
  bg: string
}

export interface SlaInfo {
  status: 'ok' | 'warning' | 'expired' | 'paused' | 'none'
  label: string
  percentual: number | null
  horasRestantes: number | null
}

// Resultado de verificação de acesso
export interface AccessCheckResult {
  granted: boolean
  perfil?: TiPerfil
  permissions: string[]
  user?: TiAccessUser
}

// Paginação
export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Filtros do dashboard
export interface ChamadoFiltros {
  status?: TiStatus[]
  prioridade?: TiPrioridade[]
  tipo?: TiTipo[]
  categoria_id?: string
  equipe_id?: string
  tecnico_id?: string
  assignee?: 'mine' | 'unassigned' | 'all'
  search?: string
  sla_violado?: boolean
  page?: number
  pageSize?: number
  dateFrom?: string
  dateTo?: string
}
