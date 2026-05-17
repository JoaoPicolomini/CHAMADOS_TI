'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useMsal } from '@azure/msal-react'
import { Ticket, Clock, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { buscarChamadosAction, checkTiUserAccess } from '@/lib/ti/actions'
import { calcularSla } from '@/lib/ti/workflow'
import { STATUS_LABELS, STATUS_COLORS, PRIORIDADE_LABELS, PRIORIDADE_COLORS, STATUS_TERMINAIS_SLA } from '@/lib/ti/constants'
import type { TiStatus, TiPrioridade } from '@/lib/ti/types'

type Chamado = {
  id: string; numero: string; titulo: string
  prioridade: TiPrioridade; tipo: string; status: TiStatus
  solicitante_nome: string; solicitante_setor: string; solicitante_email: string
  sla_prazo: string | null; sla_violado: boolean
  sla_horas_pausadas: number; sla_pausado_em: string | null
  fechado_em: string | null
  created_at: string; updated_at: string
  categoria?: { id: string; nome: string } | null
  equipe?:    { id: string; nome: string } | null
  tecnico?:   { id: string; nome: string; email: string } | null
}

function SlaChip({ chamado }: { chamado: Chamado }) {
  const isTerminal = STATUS_TERMINAIS_SLA.includes(chamado.status)
  const referenceTime = isTerminal && chamado.fechado_em ? new Date(chamado.fechado_em) : undefined
  const sla = calcularSla(chamado.sla_prazo, chamado.sla_violado, chamado.sla_horas_pausadas ?? 0, chamado.created_at, chamado.sla_pausado_em, referenceTime)
  if (!sla) return <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>—</span>

  const cfg = {
    ok:       { bg: '#DCFCE7', color: '#16A34A' },
    warning:  { bg: '#FEF9C3', color: '#CA8A04' },
    critical: { bg: '#FFEDD5', color: '#EA580C' },
    expired:  { bg: '#FEE2E2', color: '#DC2626' },
  }[sla.status]

  let texto: string
  if (sla.violado) texto = 'Vencido'
  else if (sla.horasRestantes < 1) texto = `${Math.max(0, Math.round(sla.minutosRestantes))}min`
  else if (sla.horasRestantes < 24) texto = `${Math.round(sla.horasRestantes)}h`
  else texto = `${Math.floor(sla.horasRestantes / 24)}d`

  return (
    <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '999px', background: cfg.bg, color: cfg.color, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {texto}
    </span>
  )
}

export default function MeusChamadosPage() {
  const { accounts } = useMsal()
  const userEmail = accounts[0]?.username ?? ''

  const [perfil, setPerfil]         = useState<string>('user')
  const [chamados, setChamados]     = useState<Chamado[]>([])
  const [loading, setLoading]       = useState(true)
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal]           = useState(0)
  const [statusFiltro, setStatusFiltro] = useState<TiStatus | 'todos'>('todos')
  const PAGE_SIZE = 25

  // Resolve perfil do usuário
  useEffect(() => {
    if (!userEmail) return
    checkTiUserAccess(userEmail).then(res => {
      if (res.granted && res.perfil) setPerfil(res.perfil)
    })
  }, [userEmail])

  const carregarChamados = useCallback(async (p = 1) => {
    if (!userEmail) return
    setLoading(true)

    const isTecnico = ['tecnico', 'gestor_ti', 'admin'].includes(perfil)

    const filtros: Parameters<typeof buscarChamadosAction>[0] = {
      page: p,
      pageSize: PAGE_SIZE,
      status: statusFiltro !== 'todos' ? [statusFiltro] : undefined,
    }

    // Técnicos: chamados atribuídos a eles
    // Usuários: chamados que eles abriram (por solicitante_email)
    if (isTecnico) {
      filtros.assignee  = 'mine'
      filtros.userEmail = userEmail
    } else {
      filtros.solicitante_email = userEmail
    }

    const res = await buscarChamadosAction(filtros)
    if (res.success) {
      setChamados(res.chamados as Chamado[])
      setTotal(res.total)
      setTotalPages(res.totalPages)
    }
    setLoading(false)
  }, [userEmail, perfil, statusFiltro])

  useEffect(() => { setPage(1); carregarChamados(1) }, [carregarChamados])

  function irParaPagina(p: number) { setPage(p); carregarChamados(p) }

  const isTecnico = ['tecnico', 'gestor_ti', 'admin'].includes(perfil)

  // Contadores por status (dos dados carregados)
  const contadores = {
    abertos:       chamados.filter(c => c.status === 'aberto').length,
    emAtendimento: chamados.filter(c => c.status === 'em_atendimento').length,
    resolvidos:    chamados.filter(c => c.status === 'resolvido').length,
    slaViolados:   chamados.filter(c => c.sla_violado && !['resolvido', 'cancelado'].includes(c.status)).length,
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
          <Ticket size={22} color="#1E3A5F" />
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#1E3A5F', margin: 0 }}>
            {isTecnico ? 'Meus Atendimentos' : 'Meus Chamados'}
          </h1>
        </div>
        <p style={{ color: '#6B7280', fontSize: '0.875rem', margin: 0 }}>
          {isTecnico
            ? 'Chamados atribuídos a você'
            : 'Chamados que você abriu no sistema'}
        </p>
      </div>

      {/* Mini stats */}
      {!loading && total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Abertos',        value: contadores.abertos,       icon: Clock,         color: '#2563EB', bg: '#EFF6FF' },
            { label: 'Em Atendimento', value: contadores.emAtendimento, icon: CheckCircle2,  color: '#059669', bg: '#ECFDF5' },
            { label: 'Resolvidos',     value: contadores.resolvidos,    icon: CheckCircle2,  color: '#16A34A', bg: '#F0FDF4' },
            { label: 'SLA Violados',   value: contadores.slaViolados,   icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2' },
          ].map(s => (
            <div key={s.label} style={{ background: '#FFFFFF', borderRadius: '10px', padding: '0.875rem 1rem', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '32px', height: '32px', background: s.bg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon size={15} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtro rápido de status */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {([
          { key: 'todos',           label: 'Todos' },
          { key: 'aberto',          label: 'Abertos' },
          { key: 'em_atendimento',  label: 'Em Atendimento' },
          { key: 'pendente_usuario',label: 'Aguardando Usuário' },
          { key: 'pendente_terceiro',label: 'Aguardando Terceiros' },
          { key: 'escalado',        label: 'Escalar' },
          { key: 'resolvido',       label: 'Resolvidos' },
          { key: 'reaberto',        label: 'Reabertos' },
          { key: 'cancelado',       label: 'Cancelados' },
        ] as { key: TiStatus | 'todos'; label: string }[]).map(tab => {
          const ativo = statusFiltro === tab.key
          const cor = tab.key !== 'todos' ? STATUS_COLORS[tab.key as TiStatus] : null
          return (
            <button key={tab.key} onClick={() => setStatusFiltro(tab.key)} style={{ padding: '0.375rem 0.875rem', borderRadius: '999px', border: `1.5px solid ${ativo && cor ? cor.border : ativo ? '#2563EB' : '#E5E7EB'}`, background: ativo && cor ? cor.bg : ativo ? '#EFF6FF' : 'transparent', color: ativo && cor ? cor.color : ativo ? '#2563EB' : '#6B7280', fontWeight: ativo ? 600 : 400, fontSize: '0.8125rem', cursor: 'pointer', transition: 'all 0.15s' }}>
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Abrir novo chamado CTA */}
      {!loading && chamados.length === 0 && statusFiltro === 'todos' && (
        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '3rem', textAlign: 'center', border: '2px dashed #E5E7EB', marginBottom: '1rem' }}>
          <Ticket size={36} color="#D1D5DB" style={{ margin: '0 auto 1rem', display: 'block' }} />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>
            {isTecnico ? 'Nenhum chamado atribuído a você' : 'Você ainda não abriu chamados'}
          </h2>
          <p style={{ color: '#9CA3AF', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {isTecnico ? 'Acesse o painel para assumir chamados disponíveis.' : 'Quando você abrir um chamado, ele aparecerá aqui.'}
          </p>
          <Link href={isTecnico ? '/ti/dashboard' : '/ti/abrir'} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg,#1E3A5F,#2563EB)', color: '#FFFFFF', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', fontSize: '0.9375rem' }}>
            <Ticket size={16} />
            {isTecnico ? 'Ver Painel' : 'Abrir Chamado'}
          </Link>
        </div>
      )}

      {/* Tabela */}
      {(loading || chamados.length > 0) && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['Número', 'Título', 'Status', 'Prioridade', 'SLA', 'Atualizado', ''].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
                      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem', display: 'block' }} />
                      Carregando...
                    </td>
                  </tr>
                ) : chamados.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F0F7FF')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
                  >
                    <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                      <Link href={`/ti/chamado/${c.id}`} style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563EB', textDecoration: 'none', fontSize: '0.8125rem' }}>
                        {c.numero}
                      </Link>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', maxWidth: '300px' }}>
                      <Link href={`/ti/chamado/${c.id}`} style={{ color: '#111827', textDecoration: 'none', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.titulo}
                      </Link>
                      {isTecnico && (
                        <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{c.solicitante_nome} · {c.solicitante_setor}</span>
                      )}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '999px', background: STATUS_COLORS[c.status].bg, color: STATUS_COLORS[c.status].color, border: `1px solid ${STATUS_COLORS[c.status].border}`, fontSize: '0.75rem', fontWeight: 600 }}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: PRIORIDADE_COLORS[c.prioridade].bg, color: PRIORIDADE_COLORS[c.prioridade].color, fontSize: '0.75rem', fontWeight: 700 }}>
                        {PRIORIDADE_LABELS[c.prioridade]}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}><SlaChip chamado={c} /></td>
                    <td style={{ padding: '0.875rem 1rem', color: '#9CA3AF', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {new Date(c.updated_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '0.875rem 0.75rem' }}>
                      <Link href={`/ti/chamado/${c.id}`} style={{ padding: '0.25rem 0.75rem', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#374151', fontSize: '0.75rem', fontWeight: 500, textDecoration: 'none', display: 'inline-block' }}>
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderTop: '1px solid #F3F4F6', background: '#FAFAFA' }}>
              <span style={{ fontSize: '0.8125rem', color: '#6B7280' }}>{total} chamados · página {page} de {totalPages}</span>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button onClick={() => irParaPagina(page - 1)} disabled={page === 1} style={{ display: 'flex', alignItems: 'center', padding: '0.375rem 0.625rem', border: '1px solid #E5E7EB', borderRadius: '6px', background: '#FFFFFF', color: page === 1 ? '#D1D5DB' : '#374151', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
                  <ChevronLeft size={14} />
                </button>
                <span style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', color: '#374151' }}>{page} / {totalPages}</span>
                <button onClick={() => irParaPagina(page + 1)} disabled={page === totalPages} style={{ display: 'flex', alignItems: 'center', padding: '0.375rem 0.625rem', border: '1px solid #E5E7EB', borderRadius: '6px', background: '#FFFFFF', color: page === totalPages ? '#D1D5DB' : '#374151', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
          {!loading && total > 0 && totalPages === 1 && (
            <div style={{ padding: '0.625rem 1.25rem', borderTop: '1px solid #F3F4F6', background: '#FAFAFA' }}>
              <span style={{ fontSize: '0.8125rem', color: '#6B7280' }}>{total} chamado{total !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
