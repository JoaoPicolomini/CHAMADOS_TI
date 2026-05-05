'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import {
  Loader2, LayoutDashboard, Shield, MailCheck,
  Search, X, AlertTriangle, RefreshCw, ArrowUpRight, ArrowDownLeft,
  CheckCircle2, Clock, XCircle, Inbox,
} from 'lucide-react'
import {
  checkTiUserAccess,
  buscarEmailLogsAdminAction,
  reenviarEmailAdminAction,
} from '@/lib/ti/actions'
import { format } from 'date-fns'
import type { TiEmailLog } from '@/lib/ti/types'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

// ─── helpers ──────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  ticket_created:  'Abertura',
  inbound_reply:   'Resposta',
  status_alterado: 'Status',
  atribuido:       'Atribuição',
  sla_alerta:      'Alerta SLA',
  novo_comentario: 'Comentário',
  pesquisa:        'Pesquisa',
}

function eventLabel(type: string | null) {
  if (!type) return null
  return EVENT_LABELS[type] ?? type
}

function StatusBadge({ status }: { status: TiEmailLog['status'] }) {
  const map = {
    success:  { bg: '#DCFCE7', color: '#166534', label: 'Enviado',   Icon: CheckCircle2 },
    error:    { bg: '#FEE2E2', color: '#991B1B', label: 'Erro',      Icon: XCircle },
    pending:  { bg: '#FEF9C3', color: '#92400E', label: 'Pendente',  Icon: Clock },
    received: { bg: '#EDE9FE', color: '#5B21B6', label: 'Recebido',  Icon: Inbox },
  }
  const s = map[status] ?? map.error
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      <s.Icon size={11} />
      {s.label}
    </span>
  )
}

function DirectionBadge({ direction }: { direction: TiEmailLog['direction'] }) {
  const isOut = direction === 'outbound'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
      background: isOut ? '#DBEAFE' : '#F3E8FF',
      color:      isOut ? '#1D4ED8' : '#7C3AED',
    }}>
      {isOut ? <ArrowUpRight size={11} /> : <ArrowDownLeft size={11} />}
      {isOut ? 'Saída' : 'Entrada'}
    </span>
  )
}

// ─── page ─────────────────────────────────────────────────────

export default function EmailLogsPage() {
  const router   = useRouter()
  const { accounts } = useMsal()

  const [authReady,    setAuthReady]    = useState(false)
  const [logs,         setLogs]         = useState<TiEmailLog[]>([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [totalPages,   setTotalPages]   = useState(1)
  const [loading,      setLoading]      = useState(true)
  const [resending,    setResending]    = useState<Set<string>>(new Set())
  const [feedback,     setFeedback]     = useState<Record<string, 'ok' | 'fail'>>({})

  const [searchInput,     setSearchInput]     = useState('')
  const [search,          setSearch]          = useState('')
  const [statusFilter,    setStatusFilter]    = useState('')
  const [directionFilter, setDirectionFilter] = useState('')

  // auth
  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted || (!['admin', 'gestor_ti'].includes(r.perfil ?? '') && !r.permissions.includes('email.logs.view'))) {
        router.push('/ti/dashboard')
        return
      }
      setAuthReady(true)
    })
  }, [accounts, router])

  // load
  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await buscarEmailLogsAdminAction({
      search:    search    || undefined,
      status:    statusFilter    || undefined,
      direction: directionFilter || undefined,
      page,
    })
    if (res.success) {
      setLogs(res.logs as TiEmailLog[])
      setTotal(res.total)
      setTotalPages(res.totalPages)
    }
    setLoading(false)
  }, [search, statusFilter, directionFilter, page])

  useEffect(() => { if (authReady) carregar() }, [authReady, carregar])
  useEffect(() => { setPage(1) }, [search, statusFilter, directionFilter])

  function handleSearch() {
    setSearch(searchInput)
    setPage(1)
  }

  function clearFilters() {
    setSearchInput('')
    setSearch('')
    setStatusFilter('')
    setDirectionFilter('')
  }

  async function handleReenviar(log: TiEmailLog) {
    setResending(prev => new Set(prev).add(log.id))
    const res = await reenviarEmailAdminAction(log.id)
    setResending(prev => { const s = new Set(prev); s.delete(log.id); return s })
    setFeedback(prev => ({ ...prev, [log.id]: res.success ? 'ok' : 'fail' }))
    if (res.success) {
      setLogs(prev => prev.map(l => l.id === log.id ? { ...l, status: 'success' } : l))
    }
    setTimeout(() => setFeedback(prev => { const n = { ...prev }; delete n[log.id]; return n }), 3000)
  }

  const hasFilters = !!(search || statusFilter || directionFilter)

  if (!authReady) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
      <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .row-hover:hover { background-color: #F9FAFB }
        .btn-reenviar { transition: background 0.15s, opacity 0.15s }
        .btn-reenviar:hover:not(:disabled) { background: #EFF6FF !important }
        .btn-reenviar:disabled { opacity: 0.5; cursor: not-allowed }
      `}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.8rem', color: '#6B7280' }}>
            <Link href="/ti/dashboard" style={{ color: '#6B7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <LayoutDashboard size={13} /> Painel
            </Link>
            <span>›</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={13} /> Admin</span>
            <span>›</span>
            <span>Logs de E-mail</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MailCheck size={24} style={{ color: BLUE }} />
            Logs de E-mail
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.9rem' }}>
            Histórico de e-mails enviados e recebidos pelo sistema
            {!loading && <span style={{ fontWeight: 600, color: NAVY }}> — {total.toLocaleString('pt-BR')} registros</span>}
          </p>
        </div>

        {/* Filters */}
        <div style={{
          background: 'white', borderRadius: 10, border: '1px solid #E5E7EB',
          padding: 16, marginBottom: 16,
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        }}>
          {/* search */}
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Destinatário, remetente ou assunto..."
              style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={handleSearch}
            style={{ padding: '8px 16px', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
          >
            Buscar
          </button>

          {/* direction */}
          <select
            value={directionFilter}
            onChange={e => setDirectionFilter(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', background: 'white', minWidth: 120 }}
          >
            <option value="">Todas as Direções</option>
            <option value="outbound">↑ Saída</option>
            <option value="inbound">↓ Entrada</option>
          </select>

          {/* status */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', background: 'white', minWidth: 130 }}
          >
            <option value="">Todos os Status</option>
            <option value="success">Enviado</option>
            <option value="pending">Pendente</option>
            <option value="error">Erro</option>
            <option value="received">Recebido</option>
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{ padding: '8px 12px', background: 'white', border: '1px solid #D1D5DB', borderRadius: 7, cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}
            >
              <X size={13} /> Limpar
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 56, color: '#6B7280' }}>
              <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite', marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: '0.875rem' }}>Carregando logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 56, color: '#9CA3AF' }}>
              <MailCheck size={36} style={{ color: '#D1D5DB', marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: '0.875rem' }}>Nenhum log encontrado.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB', textAlign: 'left', color: '#6B7280', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '11px 14px', fontWeight: 600 }}>Data / Hora</th>
                  <th style={{ padding: '11px 14px', fontWeight: 600 }}>Dir.</th>
                  <th style={{ padding: '11px 14px', fontWeight: 600 }}>Contato</th>
                  <th style={{ padding: '11px 14px', fontWeight: 600 }}>Assunto</th>
                  <th style={{ padding: '11px 14px', fontWeight: 600 }}>Tipo</th>
                  <th style={{ padding: '11px 14px', fontWeight: 600 }}>Chamado</th>
                  <th style={{ padding: '11px 14px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '11px 14px', fontWeight: 600 }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const isResending = resending.has(log.id)
                  const fb          = feedback[log.id]
                  const canResend   = log.direction === 'outbound' && (log.status === 'error' || log.status === 'pending') && !!log.body_html
                  const contact     = log.direction === 'outbound' ? log.recipient : (log.from_email ?? log.recipient)
                  const evLabel     = eventLabel(log.event_type)

                  return (
                    <tr key={log.id} className="row-hover" style={{ borderBottom: '1px solid #E5E7EB', transition: 'background 0.15s' }}>

                      {/* data/hora */}
                      <td style={{ padding: '11px 14px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {format(new Date(log.created_at), 'dd/MM/yy HH:mm')}
                      </td>

                      {/* direção */}
                      <td style={{ padding: '11px 14px' }}>
                        <DirectionBadge direction={log.direction ?? 'outbound'} />
                      </td>

                      {/* contato */}
                      <td style={{ padding: '11px 14px', color: '#111827', fontWeight: 500, maxWidth: 200 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={contact}>
                          {contact}
                        </span>
                      </td>

                      {/* assunto */}
                      <td style={{ padding: '11px 14px', color: '#4B5563', maxWidth: 260 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.subject}>
                          {log.subject}
                        </span>
                      </td>

                      {/* tipo */}
                      <td style={{ padding: '11px 14px' }}>
                        {evLabel ? (
                          <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600, background: '#F3F4F6', color: '#374151' }}>
                            {evLabel}
                          </span>
                        ) : <span style={{ color: '#D1D5DB' }}>—</span>}
                      </td>

                      {/* chamado */}
                      <td style={{ padding: '11px 14px' }}>
                        {log.ti_chamados?.numero ? (
                          <Link href={`/ti/chamado/${log.chamado_id}`} style={{ color: BLUE, textDecoration: 'none', fontWeight: 500, fontSize: '0.8rem' }}>
                            {log.ti_chamados.numero}
                          </Link>
                        ) : <span style={{ color: '#D1D5DB' }}>—</span>}
                      </td>

                      {/* status */}
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <StatusBadge status={log.status} />
                          {log.status === 'error' && log.error_message && (
                            <span style={{ fontSize: '0.7rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <AlertTriangle size={10} />
                              <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.error_message}>
                                {log.error_message}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ação */}
                      <td style={{ padding: '11px 14px' }}>
                        {fb === 'ok' && (
                          <span style={{ fontSize: '0.75rem', color: '#16A34A', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <CheckCircle2 size={13} /> Enviado
                          </span>
                        )}
                        {fb === 'fail' && (
                          <span style={{ fontSize: '0.75rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <XCircle size={13} /> Falhou
                          </span>
                        )}
                        {!fb && canResend && (
                          <button
                            className="btn-reenviar"
                            disabled={isResending}
                            onClick={() => handleReenviar(log)}
                            title="Reenviar e-mail"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                              border: '1px solid #BFDBFE', background: 'white',
                              color: BLUE, fontSize: '0.78rem', fontWeight: 600,
                            }}
                          >
                            <RefreshCw size={12} style={isResending ? { animation: 'spin 0.8s linear infinite' } : undefined} />
                            {isResending ? 'Enviando...' : 'Reenviar'}
                          </button>
                        )}
                        {!fb && !canResend && <span style={{ color: '#D1D5DB' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ padding: '6px 14px', border: '1px solid #D1D5DB', borderRadius: 6, cursor: page <= 1 ? 'not-allowed' : 'pointer', background: 'white', color: page <= 1 ? '#D1D5DB' : '#374151', fontSize: '0.8rem', fontWeight: 500 }}
            >
              ← Anterior
            </button>
            <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ padding: '6px 14px', border: '1px solid #D1D5DB', borderRadius: 6, cursor: page >= totalPages ? 'not-allowed' : 'pointer', background: 'white', color: page >= totalPages ? '#D1D5DB' : '#374151', fontSize: '0.8rem', fontWeight: 500 }}
            >
              Próxima →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
