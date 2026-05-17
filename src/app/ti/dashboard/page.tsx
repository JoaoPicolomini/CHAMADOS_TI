'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useMsal } from '@azure/msal-react'
import {
  Search, Download, Ticket, AlertTriangle, Clock,
  LayoutDashboard, ChevronLeft, ChevronRight, RefreshCw,
  UserCheck, Loader2, Settings, X, Calendar,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  buscarChamadosAction,
  exportarChamadosAction,
  buscarStatsDashboard,
  buscarCategoriasAction,
  checkTiUserAccess,
  atribuirChamadoAction,
} from '@/lib/ti/actions'
import { calcularSla } from '@/lib/ti/workflow'
import {
  STATUS_LABELS, STATUS_COLORS,
  PRIORIDADE_LABELS, PRIORIDADE_COLORS,
  TIPO_LABELS,
  STATUS_TERMINAIS_SLA,
} from '@/lib/ti/constants'
import type { TiStatus, TiPrioridade, TiCategoria } from '@/lib/ti/types'

// ─── Types ────────────────────────────────────────────────────
type Chamado = {
  id: string; numero: string; titulo: string
  prioridade: TiPrioridade; tipo: string; status: TiStatus
  solicitante_nome: string; solicitante_setor: string; solicitante_email: string
  sla_prazo: string | null; sla_violado: boolean
  sla_horas_pausadas: number; sla_pausado_em: string | null
  fechado_em: string | null
  created_at: string; updated_at: string
  categoria?: { id: string; nome: string } | null
  tecnico?:   { id: string; nome: string; email: string } | null
}

type AuthState = { id: string; perfil: string; permissions: string[] }

// ─── Helpers ──────────────────────────────────────────────────
const TODOS_STATUS: TiStatus[] = [
  'aberto', 'em_atendimento', 'pendente_usuario', 'pendente_terceiro', 'escalado', 'reaberto', 'resolvido', 'cancelado',
]

const PRIORIDADES: TiPrioridade[] = ['critica', 'alta', 'media', 'baixa']

function SlaChip({ chamado }: { chamado: Chamado }) {
  const isTerminal = STATUS_TERMINAIS_SLA.includes(chamado.status)
  const referenceTime = isTerminal && chamado.fechado_em ? new Date(chamado.fechado_em) : undefined
  const sla = calcularSla(chamado.sla_prazo, chamado.sla_violado, chamado.sla_horas_pausadas ?? 0, chamado.created_at, chamado.sla_pausado_em, referenceTime)
  if (!sla) return <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>—</span>

  const cfg = {
    ok:       { bg: '#DCFCE7', color: '#16A34A', label: '' },
    warning:  { bg: '#FEF9C3', color: '#CA8A04', label: '' },
    critical: { bg: '#FFEDD5', color: '#EA580C', label: '' },
    expired:  { bg: '#FEE2E2', color: '#DC2626', label: '⚠ ' },
  }[sla.status]

  let texto: string
  if (sla.violado) {
    texto = 'Vencido'
  } else if (sla.horasRestantes < 1) {
    texto = `${Math.max(0, Math.round(sla.minutosRestantes))}min`
  } else if (sla.horasRestantes < 24) {
    texto = `${Math.round(sla.horasRestantes)}h`
  } else {
    const dias = Math.floor(sla.horasRestantes / 24)
    texto = `${dias}d`
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '999px', background: cfg.bg, color: cfg.color, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {cfg.label}{texto}
    </span>
  )
}

function StatusBadge({ status }: { status: TiStatus }) {
  const c = STATUS_COLORS[status]
  return (
    <span style={{ padding: '2px 8px', borderRadius: '999px', background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function PrioridadeBadge({ prioridade }: { prioridade: TiPrioridade }) {
  const c = PRIORIDADE_COLORS[prioridade]
  return (
    <span style={{ padding: '2px 8px', borderRadius: '4px', background: c.bg, color: c.color, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {PRIORIDADE_LABELS[prioridade]}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function DashboardPage() {
  const { accounts } = useMsal()
  const userEmail = accounts[0]?.username ?? ''

  const [auth, setAuth]           = useState<AuthState | null>(null)
  const [chamados, setChamados]   = useState<Chamado[]>([])
  const [stats, setStats]         = useState({ total: 0, abertos: 0, emAtendimento: 0, slaViolados: 0 })
  const [categorias, setCategorias] = useState<TiCategoria[]>([])
  const [loading, setLoading]     = useState(true)
  const [exporting,       setExporting]       = useState(false)
  const [assumindo,       setAssumindo]       = useState<string | null>(null)
  const [modalExport,     setModalExport]     = useState(false)
  const [exportDataIni,   setExportDataIni]   = useState('')
  const [exportDataFim,   setExportDataFim]   = useState('')

  // Paginação
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal]         = useState(0)
  const PAGE_SIZE = 25

  // Filtros
  const [search, setSearch]           = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFiltro, setStatusFiltro]     = useState<TiStatus[]>([])
  const [priorFiltro, setPriorFiltro]       = useState<TiPrioridade[]>([])
  const [assignee, setAssignee]             = useState<'all' | 'mine' | 'unassigned'>('all')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')

  const isTecnico = auth?.perfil === 'tecnico' || auth?.perfil === 'gestor_ti' || auth?.perfil === 'admin'
  const isAdmin   = auth?.perfil === 'admin' || auth?.perfil === 'gestor_ti'

  // Load auth + stats + categories once
  useEffect(() => {
    if (!userEmail) return
    Promise.all([
      checkTiUserAccess(userEmail),
      buscarStatsDashboard(),
      buscarCategoriasAction(),
    ]).then(([authRes, statsRes, catRes]) => {
      if (authRes.granted) setAuth({ id: authRes.user?.id ?? '', perfil: authRes.perfil!, permissions: authRes.permissions })
      if (statsRes.success) setStats({ total: statsRes.total, abertos: statsRes.abertos, emAtendimento: statsRes.emAtendimento, slaViolados: statsRes.slaViolados })
      if (catRes.success) setCategorias(catRes.categorias.filter((c: TiCategoria) => !c.categoria_pai))
    })
  }, [userEmail])

  // Load chamados
  const carregarChamados = useCallback(async (p = 1) => {
    setLoading(true)
    const res = await buscarChamadosAction({
      status:     statusFiltro.length ? statusFiltro : undefined,
      prioridade: priorFiltro.length  ? priorFiltro  : undefined,
      categoria_id: categoriaFiltro   || undefined,
      search:     search              || undefined,
      userEmail,
      assignee:   assignee !== 'all'  ? assignee     : undefined,
      page:       p,
      pageSize:   PAGE_SIZE,
    })
    if (res.success) {
      setChamados(res.chamados as Chamado[])
      setTotal(res.total)
      setTotalPages(res.totalPages)
    }
    setLoading(false)
  }, [statusFiltro, priorFiltro, categoriaFiltro, search, assignee, userEmail])

  useEffect(() => { setPage(1); carregarChamados(1) }, [carregarChamados])

  function irParaPagina(p: number) { setPage(p); carregarChamados(p) }

  function toggleStatus(s: TiStatus) {
    setStatusFiltro(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }
  function togglePrior(p: TiPrioridade) {
    setPriorFiltro(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  // Exportar Excel
  async function exportarExcel(dataInicio: string, dataFim: string) {
    setModalExport(false)
    setExporting(true)
    try {
      const res = await exportarChamadosAction({
        dataInicio: dataInicio || undefined,
        dataFim:    dataFim    || undefined,
        status:     statusFiltro.length ? statusFiltro : undefined,
        prioridade: priorFiltro.length  ? priorFiltro  : undefined,
        categoria_id: categoriaFiltro   || undefined,
        search:     search              || undefined,
        userEmail,
        assignee:   assignee !== 'all'  ? assignee     : undefined,
      })

      if (!res.success || !res.chamados.length) return

      const fmt = (d: string | null) => d ? new Date(d).toLocaleString('pt-BR') : ''
      const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : ''

      const rows = res.chamados.map((c: any) => {
        const aberturaMs  = new Date(c.created_at).getTime()
        const fechadoMs   = c.fechado_em ? new Date(c.fechado_em).getTime() : null
        const tempoResHrs = fechadoMs ? Math.round((fechadoMs - aberturaMs) / 36e5 * 10) / 10 : null

        const slaPrazoMs    = c.sla_prazo ? new Date(c.sla_prazo).getTime() : null
        const slaDiffMs     = slaPrazoMs && fechadoMs ? fechadoMs - slaPrazoMs : null
        const slaDesvioHrs  = slaDiffMs !== null ? Math.round(slaDiffMs / 36e5 * 10) / 10 : null

        return {
          // ─── Identificação ────────────────────────
          'Número':                c.numero,
          'Título':                c.titulo,
          // ─── Classificação ────────────────────────
          'Status':                STATUS_LABELS[c.status as TiStatus] ?? c.status,
          'Tipo':                  TIPO_LABELS[c.tipo as keyof typeof TIPO_LABELS] ?? c.tipo,
          'Prioridade':            PRIORIDADE_LABELS[c.prioridade as TiPrioridade] ?? c.prioridade,
          'Origem':                c.origem ?? '',
          'Nível Suporte':         c.nivel_suporte ? `N${c.nivel_suporte}` : '',
          // ─── Categorização ────────────────────────
          'Categoria':             (c.categoria as any)?.nome ?? '',
          'Subcategoria':          (c.subcategoria as any)?.nome ?? '',
          // ─── Equipe / Técnico ─────────────────────
          'Equipe':                (c.equipe as any)?.nome ?? '',
          'Técnico Responsável':   (c.tecnico as any)?.nome ?? '',
          'E-mail Técnico':        (c.tecnico as any)?.email ?? '',
          // ─── Solicitante ──────────────────────────
          'Solicitante':           c.solicitante_nome,
          'E-mail Solicitante':    c.solicitante_email,
          'Ramal':                 c.solicitante_ramal ?? '',
          'Setor':                 c.solicitante_setor,
          'Unidade':               c.solicitante_unidade ?? '',
          // ─── SLA ──────────────────────────────────
          'SLA Prazo':             fmt(c.sla_prazo),
          'SLA Violado':           c.sla_violado ? 'Sim' : 'Não',
          'SLA Violado Em':        fmt(c.sla_violado_em),
          'SLA Horas Pausadas':    c.sla_horas_pausadas ?? 0,
          'SLA Desvio (h)':        slaDesvioHrs !== null ? (slaDesvioHrs > 0 ? `+${slaDesvioHrs}h` : `${slaDesvioHrs}h`) : '',
          // ─── Resolução / Fechamento ───────────────
          'Solução':               c.solucao ?? '',
          'Causa Raiz':            c.causa_raiz ?? '',
          'Motivo Cancelamento':   c.motivo_cancelamento ?? '',
          'Fechado Em':            fmt(c.fechado_em),
          'Fechado Por':           c.fechado_por ?? '',
          'Tempo de Resolução (h)': tempoResHrs !== null ? `${tempoResHrs}h` : '',
          // ─── Escalonamento ────────────────────────
          'Escalado Em':           fmt(c.escalado_em),
          'Escalado Por':          c.escalado_por ?? '',
          // ─── Satisfação ───────────────────────────
          'CSAT Nota':             c.satisfacao_nota ?? '',
          'CSAT Comentário':       c.satisfacao_comentario ?? '',
          'CSAT Respondido Em':    fmt(c.satisfacao_respondido_em),
          // ─── Metadados ────────────────────────────
          'Tags':                  Array.isArray(c.tags) ? c.tags.join(', ') : '',
          'IP Abertura':           c.ip_abertura ?? '',
          'Abertura':              fmt(c.created_at),
          'Última Atualização':    fmt(c.updated_at),
          'Data Abertura (só data)': fmtDate(c.created_at),
        }
      })

      const ws = XLSX.utils.json_to_sheet(rows)

      // Larguras das colunas
      const colWidths = [
        10, 45, 16, 14, 12, 12, 4, 20, 20, 20, 24, 18,
        14, 28, 30, 8, 20, 16, 20, 6, 16, 16, 8, 10,
        50, 50, 30, 20, 20, 8, 20, 20, 6, 40, 20,
        20, 10, 18, 14, 20,
      ]
      ws['!cols'] = colWidths.map(w => ({ wch: w }))

      // Congela primeira linha
      ws['!freeze'] = { xSplit: 0, ySplit: 1 }

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Chamados')

      // Aba de sumário
      const STATUS_ENCERRADOS = ['resolvido', 'fechado', 'fechado_automatico']
      const STATUS_ABERTOS    = ['aberto', 'em_atendimento', 'reaberto', 'pendente_usuario', 'pendente_terceiro', 'escalado']
      const totalExportados = rows.length
      const emAberto  = res.chamados.filter((c: any) => STATUS_ABERTOS.includes(c.status)).length
      const violados  = res.chamados.filter((c: any) => c.sla_violado).length
      const fechados  = res.chamados.filter((c: any) => STATUS_ENCERRADOS.includes(c.status)).length
      const mediaRes  = (() => {
        const tempos = res.chamados
          .filter((c: any) => STATUS_ENCERRADOS.includes(c.status))
          .map((c: any) => {
            const fim = c.fechado_em ?? c.updated_at
            return (new Date(fim).getTime() - new Date(c.created_at).getTime()) / 36e5
          })
        return tempos.length ? Math.round(tempos.reduce((a: number, b: number) => a + b, 0) / tempos.length * 10) / 10 : 0
      })()

      const sumario = [
        ['Relatório de Chamados T.I', ''],
        ['Gerado em', new Date().toLocaleString('pt-BR')],
        ['Filtros Aplicados', [
          statusFiltro.length ? `Status: ${statusFiltro.map(s => STATUS_LABELS[s]).join(', ')}` : '',
          priorFiltro.length  ? `Prioridade: ${priorFiltro.map(p => PRIORIDADE_LABELS[p]).join(', ')}` : '',
          search ? `Busca: "${search}"` : '',
        ].filter(Boolean).join(' | ') || 'Nenhum'],
        ['', ''],
        ['Total Exportado',           totalExportados],
        ['Em Aberto',                emAberto],
        ['Encerrados / Resolvidos',  fechados],
        ['SLA Violados',             violados],
        ['Tempo Médio Resolução (h)', mediaRes],
      ]
      const wsSumario = XLSX.utils.aoa_to_sheet(sumario)
      wsSumario['!cols'] = [{ wch: 32 }, { wch: 50 }]
      XLSX.utils.book_append_sheet(wb, wsSumario, 'Sumário')

      const fileName = `chamados-ti-${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)
    } finally {
      setExporting(false)
    }
  }

  // Assumir chamado
  async function assumir(chamadoId: string) {
    if (!userEmail || !auth?.id) return
    setAssumindo(chamadoId)
    await atribuirChamadoAction({ chamado_id: chamadoId, tecnico_id: auth.id, atribuido_por: userEmail })
    await carregarChamados(page)
    setAssumindo(null)
  }

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <LayoutDashboard size={22} color="#1E3A5F" />
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Painel de Chamados</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <button onClick={() => carregarChamados(page)} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', background: 'transparent', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: '0.8125rem' }}>
            <RefreshCw size={14} /> Atualizar
          </button>
          <button onClick={() => setModalExport(true)} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', background: exporting ? '#E5E7EB' : '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', color: '#16A34A', fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}>
            {exporting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
            Exportar
          </button>

          <Link href="/ti/abrir" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', background: 'linear-gradient(135deg,#1E3A5F,#2563EB)', border: 'none', borderRadius: '8px', color: '#FFFFFF', fontWeight: 600, fontSize: '0.8125rem', textDecoration: 'none' }}>
            <Ticket size={14} /> Abrir Chamado
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Chamados Ativos',  value: stats.total,         icon: Ticket,        color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Abertos',          value: stats.abertos,       icon: Clock,         color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Em Atendimento',   value: stats.emAtendimento, icon: UserCheck,     color: '#059669', bg: '#ECFDF5' },
          { label: 'SLA Violados',     value: stats.slaViolados,   icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2' },
        ].map(s => (
          <div key={s.label} style={{ background: '#FFFFFF', borderRadius: '10px', padding: '1rem 1.125rem', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 500 }}>{s.label}</span>
              <div style={{ width: '28px', height: '28px', background: s.bg, borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={14} color={s.color} />
              </div>
            </div>
            <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#111827' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid #E5E7EB', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

        {/* Search + quick tabs */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              placeholder="Buscar por número, título ou solicitante..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setSearch(searchInput)}
              onBlur={() => setSearch(searchInput)}
              style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.25rem', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {([
              { key: 'all',        label: 'Todos' },
              { key: 'mine',       label: 'Meus' },
              { key: 'unassigned', label: 'Sem técnico' },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setAssignee(tab.key)} style={{ padding: '0.5rem 0.875rem', borderRadius: '8px', border: `1.5px solid ${assignee === tab.key ? '#2563EB' : '#E5E7EB'}`, background: assignee === tab.key ? '#EFF6FF' : 'transparent', color: assignee === tab.key ? '#2563EB' : '#6B7280', fontWeight: assignee === tab.key ? 600 : 400, fontSize: '0.8125rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status chips */}
        <div style={{ marginBottom: '0.625rem' }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '0.5rem' }}>Status</span>
          <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.375rem' }}>
            {TODOS_STATUS.map(s => {
              const ativo = statusFiltro.includes(s)
              const c = STATUS_COLORS[s]
              return (
                <button key={s} onClick={() => toggleStatus(s)} style={{ padding: '2px 10px', borderRadius: '999px', border: `1.5px solid ${ativo ? c.border : '#E5E7EB'}`, background: ativo ? c.bg : 'transparent', color: ativo ? c.color : '#9CA3AF', fontWeight: ativo ? 600 : 400, fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                  {STATUS_LABELS[s]}
                </button>
              )
            })}
            {statusFiltro.length > 0 && (
              <button onClick={() => setStatusFiltro([])} style={{ padding: '2px 8px', borderRadius: '999px', border: '1px solid #E5E7EB', background: 'transparent', color: '#9CA3AF', fontSize: '0.75rem', cursor: 'pointer' }}>✕ limpar</button>
            )}
          </div>
        </div>

        {/* Prioridade chips + Categoria */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '0.5rem' }}>Prioridade</span>
            <div style={{ display: 'inline-flex', gap: '0.375rem', marginTop: '0.375rem' }}>
              {PRIORIDADES.map(p => {
                const ativo = priorFiltro.includes(p)
                const c = PRIORIDADE_COLORS[p]
                return (
                  <button key={p} onClick={() => togglePrior(p)} style={{ padding: '2px 10px', borderRadius: '999px', border: `1.5px solid ${ativo ? c.color : '#E5E7EB'}`, background: ativo ? c.bg : 'transparent', color: ativo ? c.color : '#9CA3AF', fontWeight: ativo ? 700 : 400, fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {PRIORIDADE_LABELS[p]}
                  </button>
                )
              })}
              {priorFiltro.length > 0 && (
                <button onClick={() => setPriorFiltro([])} style={{ padding: '2px 8px', borderRadius: '999px', border: '1px solid #E5E7EB', background: 'transparent', color: '#9CA3AF', fontSize: '0.75rem', cursor: 'pointer' }}>✕</button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Categoria</span>
            <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)} style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem', border: '1px solid #E5E7EB', borderRadius: '6px', color: '#374151', background: '#FFFFFF', cursor: 'pointer' }}>
              <option value="">Todas</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Número', 'Título', 'Status', 'Prioridade', 'Categoria', 'SLA', 'Técnico', 'Abertura', ''].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem', display: 'block' }} />
                    Carregando chamados...
                  </td>
                </tr>
              ) : chamados.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
                    <Ticket size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.4 }} />
                    Nenhum chamado encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : chamados.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F0F7FF')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
                >
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                    <Link href={`/ti/chamado/${c.id}`} style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563EB', textDecoration: 'none', fontSize: '0.8125rem' }}>
                      {c.numero}
                    </Link>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', maxWidth: '260px' }}>
                    <Link href={`/ti/chamado/${c.id}`} style={{ color: '#111827', textDecoration: 'none', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.titulo}
                    </Link>
                    <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{c.solicitante_nome} · {c.solicitante_setor}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}><StatusBadge status={c.status} /></td>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}><PrioridadeBadge prioridade={c.prioridade} /></td>
                  <td style={{ padding: '0.75rem 1rem', color: '#6B7280', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{c.categoria?.nome ?? '—'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}><SlaChip chamado={c} /></td>
                  <td style={{ padding: '0.75rem 1rem', color: '#6B7280', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    {c.tecnico?.nome ?? <span style={{ color: '#D1D5DB', fontStyle: 'italic' }}>Sem técnico</span>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#9CA3AF', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ padding: '0.75rem 0.75rem', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <Link href={`/ti/chamado/${c.id}`} style={{ padding: '0.25rem 0.625rem', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#374151', fontSize: '0.75rem', fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        Ver
                      </Link>
                      {isTecnico && !c.tecnico && !['fechado', 'fechado_automatico', 'cancelado', 'resolvido'].includes(c.status) && (
                        <button onClick={() => assumir(c.id)} disabled={assumindo === c.id} style={{ padding: '0.25rem 0.625rem', borderRadius: '6px', border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#2563EB', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          {assumindo === c.id ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <UserCheck size={11} />}
                          Assumir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderTop: '1px solid #F3F4F6', background: '#FAFAFA' }}>
            <span style={{ fontSize: '0.8125rem', color: '#6B7280' }}>
              {total} chamados · página {page} de {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <button onClick={() => irParaPagina(page - 1)} disabled={page === 1} style={{ display: 'flex', alignItems: 'center', padding: '0.375rem 0.625rem', border: '1px solid #E5E7EB', borderRadius: '6px', background: '#FFFFFF', color: page === 1 ? '#D1D5DB' : '#374151', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page + i - 2
                if (p < 1 || p > totalPages) return null
                return (
                  <button key={p} onClick={() => irParaPagina(p)} style={{ padding: '0.375rem 0.625rem', border: `1px solid ${p === page ? '#2563EB' : '#E5E7EB'}`, borderRadius: '6px', background: p === page ? '#EFF6FF' : '#FFFFFF', color: p === page ? '#2563EB' : '#374151', fontWeight: p === page ? 700 : 400, cursor: 'pointer', fontSize: '0.8125rem', minWidth: '32px' }}>
                    {p}
                  </button>
                )
              })}
              <button onClick={() => irParaPagina(page + 1)} disabled={page === totalPages} style={{ display: 'flex', alignItems: 'center', padding: '0.375rem 0.625rem', border: '1px solid #E5E7EB', borderRadius: '6px', background: '#FFFFFF', color: page === totalPages ? '#D1D5DB' : '#374151', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}>
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Modal de Exportação */}
      {modalExport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div style={{ background: '#FFF', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={18} color="#16A34A" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1E3A5F' }}>Exportar Relatório</h2>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#9CA3AF' }}>Filtro por data de abertura do chamado</p>
                </div>
              </div>
              <button onClick={() => setModalExport(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  Data de início <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="date"
                  value={exportDataIni}
                  onChange={e => setExportDataIni(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', color: '#111827' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  Data de término
                  <span style={{ fontWeight: 400, color: '#9CA3AF', marginLeft: '0.4rem' }}>(opcional — deixe em branco para até hoje)</span>
                </label>
                <input
                  type="date"
                  value={exportDataFim}
                  min={exportDataIni || undefined}
                  onChange={e => setExportDataFim(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', color: '#111827' }}
                />
              </div>

              {/* Info box */}
              <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.78rem', color: '#0369A1', lineHeight: 1.5 }}>
                O relatório incluirá <b>todos os chamados</b> abertos no período, com os filtros de status, prioridade e categoria ativos no painel aplicados.
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.5rem', background: '#F9FAFB', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => { setModalExport(false); setExportDataIni(''); setExportDataFim('') }}
                style={{ padding: '0.5rem 1.25rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => exportarExcel(exportDataIni, exportDataFim)}
                disabled={!exportDataIni}
                style={{ padding: '0.5rem 1.25rem', background: !exportDataIni ? '#E5E7EB' : 'linear-gradient(135deg,#16A34A,#15803D)', border: 'none', borderRadius: '8px', color: !exportDataIni ? '#9CA3AF' : '#FFF', fontWeight: 600, cursor: !exportDataIni ? 'not-allowed' : 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Download size={15} /> Gerar Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
