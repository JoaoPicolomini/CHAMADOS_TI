'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import {
  LayoutDashboard, BarChart3, RefreshCw, Loader2,
  TrendingUp, Clock, ShieldCheck, Ticket, AlertTriangle,
  CheckCircle2, XCircle,
} from 'lucide-react'
import { checkTiUserAccess, buscarAnalyticsAction, buscarCategoriasAction, buscarAnalistasAtivosAction } from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

const PERIODOS = [
  { value: '7d',   label: '7 dias'   },
  { value: '30d',  label: '30 dias'  },
  { value: '90d',  label: '90 dias'  },
  { value: '365d', label: '12 meses' },
] as const

type Periodo = typeof PERIODOS[number]['value']

const CHART_COLORS = [
  '#2563EB', '#7C3AED', '#DB2777', '#EA580C',
  '#16A34A', '#0891B2', '#8B5CF6', '#F59E0B',
  '#DC2626', '#059669',
]

const PRIORIDADE_FILL: Record<string, string> = {
  'Crítica': '#DC2626',
  'Alta':    '#EA580C',
  'Média':   '#D97706',
  'Baixa':   '#16A34A',
}

const STATUS_ABERTOS    = ['aberto', 'em_atendimento', 'reaberto', 'pendente_usuario', 'pendente_terceiro', 'escalado']
const STATUS_ENCERRADOS = ['resolvido', 'fechado', 'fechado_automatico']

function fmtLabel(label: string, periodo: Periodo): string {
  if (periodo === '365d') {
    const [y, m] = label.split('-')
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${months[parseInt(m) - 1]}/${y.slice(2)}`
  }
  const [, m, d] = label.split('-')
  return `${d}/${m}`
}

function StatCard({
  icon, label, value, suffix, color, bg, sub,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  suffix?: string
  color: string
  bg: string
  sub?: string
}) {
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '18px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ fontSize: '0.78rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: NAVY, lineHeight: 1 }}>
        {value}{suffix}
      </div>
      {sub && <div style={{ marginTop: 5, fontSize: '0.72rem', color: '#9CA3AF' }}>{sub}</div>}
    </div>
  )
}

function ChartCard({ title, subtitle, children, minHeight = 280 }: {
  title: string; subtitle: string; children: React.ReactNode; minHeight?: number
}) {
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '20px 24px' }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: NAVY }}>{title}</h3>
        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9CA3AF' }}>{subtitle}</p>
      </div>
      <div style={{ minHeight }}>{children}</div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#D1D5DB', fontSize: '0.85rem' }}>
      Nenhum dado no período
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ padding: '12px 16px', background: BG, borderRadius: 8 }}>
      <div style={{ fontSize: '0.72rem', color: '#6B7280', marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color ?? NAVY }}>{value}</div>
    </div>
  )
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { accounts } = useMsal()

  const [authReady,   setAuthReady]   = useState(false)
  const [periodo,     setPeriodo]     = useState<Periodo>('30d')
  const [loading,     setLoading]     = useState(true)
  const [data,        setData]        = useState<any>(null)
  const [raw,         setRaw]         = useState<any[]>([])
  const [error,       setError]       = useState<string | null>(null)
  const [categorias,  setCategorias]  = useState<{ id: string; nome: string }[]>([])
  const [tecnicos,    setTecnicos]    = useState<{ id: string; nome: string }[]>([])
  const [catFiltro,   setCatFiltro]   = useState('')
  const [tecFiltro,   setTecFiltro]   = useState('')
  const [dataInicio,  setDataInicio]  = useState('')
  const [dataFim,     setDataFim]     = useState('')
  const modoCustom = !!(dataInicio || dataFim)

  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted) { router.push('/ti'); return }
      setAuthReady(true)
    })
  }, [accounts, router])

  // Carrega listas de filtros uma vez
  useEffect(() => {
    Promise.all([buscarCategoriasAction(), buscarAnalistasAtivosAction()]).then(([catRes, tecRes]) => {
      if (catRes.success) setCategorias(catRes.categorias.filter((c: any) => !c.categoria_pai))
      if (tecRes.success) setTecnicos(tecRes.analistas)
    })
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await buscarAnalyticsAction(periodo, {
      categoria_id: catFiltro  || undefined,
      tecnico_id:   tecFiltro  || undefined,
      dataInicio:   dataInicio || undefined,
      dataFim:      dataFim    || undefined,
    })
    if (res.success && res.data) {
      setData(res.data)
      setRaw(res.data.chamadosRaw ?? [])
    } else {
      setError((res as any).error ?? 'Erro ao carregar dados.')
    }
    setLoading(false)
  }, [periodo, catFiltro, tecFiltro, dataInicio, dataFim])

  useEffect(() => { if (authReady) carregar() }, [authReady, carregar])

  // ── Métricas derivadas de raw ─────────────────────────────────
  const emAberto    = raw.filter(c => STATUS_ABERTOS.includes(c.status)).length
  const encerrados  = raw.filter(c => STATUS_ENCERRADOS.includes(c.status)).length
  const cancelados  = raw.filter(c => c.status === 'cancelado').length
  const slaViolados = raw.filter(c => c.sla_violado).length
  const reabertos   = raw.filter(c => c.status === 'reaberto').length
  const escalados   = raw.filter(c => c.status === 'escalado').length
  const aguardando  = raw.filter(c => c.status === 'pendente_usuario' || c.status === 'pendente_terceiro').length

  const taxaResolucao = data?.total > 0
    ? Math.round((encerrados / data.total) * 100)
    : null

  const mttr = (() => {
    const fechados = raw.filter(c => STATUS_ENCERRADOS.includes(c.status))
    if (!fechados.length) return null
    const tempos = fechados.map(c => {
      const fim = c.fechado_em ?? c.updated_at
      return (new Date(fim).getTime() - new Date(c.created_at).getTime()) / 36e5
    })
    return Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length * 10) / 10
  })()

  const slaCompliance = (() => {
    const comSla = raw.filter(c => c.sla_violado !== null && c.sla_violado !== undefined)
    if (!comSla.length) return null
    const ok = comSla.filter(c => !c.sla_violado).length
    return Math.round((ok / comSla.length) * 100)
  })()

  // Por status agrupado
  const porStatus = [
    { name: 'Aberto',              value: raw.filter(c => c.status === 'aberto').length,              color: '#2563EB' },
    { name: 'Em Atendimento',      value: raw.filter(c => c.status === 'em_atendimento').length,      color: '#7C3AED' },
    { name: 'Aguardando',          value: aguardando,                                                  color: '#D97706' },
    { name: 'Escalado',            value: escalados,                                                   color: '#DC2626' },
    { name: 'Reaberto',            value: reabertos,                                                   color: '#B91C1C' },
    { name: 'Encerrado/Resolvido', value: encerrados,                                                  color: '#16A34A' },
    { name: 'Cancelado',           value: cancelados,                                                  color: '#6B7280' },
  ].filter(s => s.value > 0)

  // Por técnico atribuído (top 10)
  const tecnicoMap = new Map<string, number>()
  raw.forEach(c => {
    const nome = (c.tecnico as any)?.nome ?? 'Sem técnico'
    tecnicoMap.set(nome, (tecnicoMap.get(nome) ?? 0) + 1)
  })
  const porTecnico = Array.from(tecnicoMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // Por setor do solicitante (top 8)
  const setorMap = new Map<string, number>()
  raw.forEach(c => {
    const s = c.solicitante_setor ?? 'Sem setor'
    setorMap.set(s, (setorMap.get(s) ?? 0) + 1)
  })
  const porSetor = Array.from(setorMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  if (!authReady) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.8rem', color: '#6B7280' }}>
            <Link href="/ti/dashboard" style={{ color: '#6B7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <LayoutDashboard size={13} /> Painel
            </Link>
            <span>›</span>
            <span>Analytics</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={22} style={{ color: BLUE }} />
            Analytics e Relatórios
          </h1>
          {data && (
            <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.82rem' }}>
              {data.total} chamado{data.total !== 1 ? 's' : ''} —{' '}
              {modoCustom
                ? `${dataInicio ? new Date(dataInicio).toLocaleDateString('pt-BR') : '?'} até ${dataFim ? new Date(dataFim).toLocaleDateString('pt-BR') : 'hoje'}`
                : `últimos ${periodo === '365d' ? '12 meses' : periodo}`}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Filtro Categoria */}
          <select
            value={catFiltro}
            onChange={e => setCatFiltro(e.target.value)}
            style={{ padding: '7px 10px', background: 'white', border: `1px solid ${catFiltro ? BLUE : '#E5E7EB'}`, borderRadius: 8, fontSize: '0.8rem', color: catFiltro ? BLUE : '#374151', fontWeight: catFiltro ? 600 : 400, cursor: 'pointer', outline: 'none' }}
          >
            <option value="">Todas as categorias</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>

          {/* Filtro Técnico */}
          <select
            value={tecFiltro}
            onChange={e => setTecFiltro(e.target.value)}
            style={{ padding: '7px 10px', background: 'white', border: `1px solid ${tecFiltro ? BLUE : '#E5E7EB'}`, borderRadius: 8, fontSize: '0.8rem', color: tecFiltro ? BLUE : '#374151', fontWeight: tecFiltro ? 600 : 400, cursor: 'pointer', outline: 'none' }}
          >
            <option value="">Todos os técnicos</option>
            {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>

          {/* Período pré-definido — desativado no modo customizado */}
          <div style={{ display: 'flex', background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', opacity: modoCustom ? 0.4 : 1, pointerEvents: modoCustom ? 'none' : 'auto' }}>
            {PERIODOS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                style={{
                  padding: '7px 14px', border: 'none', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 600,
                  background: !modoCustom && periodo === p.value ? BLUE : 'transparent',
                  color: !modoCustom && periodo === p.value ? 'white' : '#374151',
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Separador */}
          <span style={{ color: '#D1D5DB', fontSize: '0.8rem', fontWeight: 500 }}>ou</span>

          {/* Datas personalizadas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'white', border: `1px solid ${modoCustom ? BLUE : '#E5E7EB'}`, borderRadius: 8, padding: '4px 8px' }}>
            <span style={{ fontSize: '0.72rem', color: '#9CA3AF', whiteSpace: 'nowrap' }}>De</span>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '0.8rem', color: '#374151', background: 'transparent', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.72rem', color: '#9CA3AF', whiteSpace: 'nowrap' }}>até</span>
            <input
              type="date"
              value={dataFim}
              min={dataInicio || undefined}
              onChange={e => setDataFim(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '0.8rem', color: '#374151', background: 'transparent', cursor: 'pointer' }}
            />
            {modoCustom && (
              <button
                onClick={() => { setDataInicio(''); setDataFim('') }}
                title="Limpar datas"
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center', padding: '0 2px' }}
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={carregar}
            disabled={loading}
            style={{ padding: '7px 10px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#374151', opacity: loading ? 0.5 : 1 }}
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: '#DC2626' }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#6B7280' }}>
          <Loader2 size={32} style={{ color: BLUE, animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <p style={{ margin: 0 }}>Carregando dados...</p>
        </div>
      ) : data && (
        <>
          {/* ── Linha 1: 6 KPI cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
            <StatCard
              icon={<Ticket size={17} />}
              label="Total no Período"
              value={data.total}
              color="#2563EB" bg="#EFF6FF"
              sub="chamados registrados"
            />
            <StatCard
              icon={<TrendingUp size={17} />}
              label="Em Aberto"
              value={emAberto}
              color="#EA580C" bg="#FFF7ED"
              sub={`${data.emAberto} ativos no geral`}
            />
            <StatCard
              icon={<CheckCircle2 size={17} />}
              label="Encerrados"
              value={encerrados}
              color="#16A34A" bg="#F0FDF4"
              sub={taxaResolucao != null ? `${taxaResolucao}% de resolução` : '—'}
            />
            <StatCard
              icon={<XCircle size={17} />}
              label="Cancelados"
              value={cancelados}
              color="#6B7280" bg="#F9FAFB"
              sub="encerrados sem resolução"
            />
            <StatCard
              icon={<Clock size={17} />}
              label="MTTR"
              value={mttr ?? '—'}
              suffix={mttr != null ? 'h' : ''}
              color="#7C3AED" bg="#F5F3FF"
              sub="tempo médio de resolução"
            />
            <StatCard
              icon={<ShieldCheck size={17} />}
              label="SLA Compliance"
              value={slaCompliance ?? '—'}
              suffix={slaCompliance != null ? '%' : ''}
              color={slaCompliance == null ? '#6B7280' : slaCompliance >= 80 ? '#16A34A' : slaCompliance >= 60 ? '#D97706' : '#DC2626'}
              bg={slaCompliance == null ? '#F9FAFB' : slaCompliance >= 80 ? '#F0FDF4' : slaCompliance >= 60 ? '#FFFBEB' : '#FEF2F2'}
              sub={`${slaViolados} violação${slaViolados !== 1 ? 'ões' : ''} no período`}
            />
          </div>

          {/* ── Linha 2: Tendência + Por categoria ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <ChartCard
              title="Tendência Temporal"
              subtitle={
                periodo === '365d' ? 'Abertos e encerrados por mês' :
                periodo === '90d'  ? 'Abertos e encerrados por semana' :
                                     'Abertos e encerrados por dia'
              }
            >
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.tendencia ?? []} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickFormatter={l => fmtLabel(l, periodo)}
                    interval={periodo === '7d' ? 0 : periodo === '30d' ? 4 : periodo === '90d' ? 1 : 0}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip labelFormatter={l => fmtLabel(l, periodo)}
                    formatter={(v: any, name: string) => [v, name === 'abertos' ? 'Abertos' : 'Encerrado / Resolvido']}
                  />
                  <Legend formatter={(v: string) => v === 'abertos' ? 'Abertos' : 'Encerrado / Resolvido'} />
                  <Line type="monotone" dataKey="abertos"  stroke="#2563EB" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="fechados" stroke="#16A34A" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Volume por Categoria" subtitle="Top 10 categorias mais recorrentes no período">
              {data.porCategoria.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.porCategoria} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={115} />
                    <Tooltip />
                    <Bar dataKey="total" name="Chamados" radius={[0, 4, 4, 0]}>
                      {data.porCategoria.map((_: any, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* ── Linha 3: Por status + Por prioridade ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <ChartCard title="Distribuição por Status" subtitle="Chamados agrupados por estado atual no período" minHeight={220}>
              {porStatus.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={porStatus} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                    <Tooltip />
                    <Bar dataKey="value" name="Chamados" radius={[0, 4, 4, 0]}>
                      {porStatus.map((s, i) => <Cell key={i} fill={s.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Volume por Prioridade" subtitle="Distribuição dos chamados por urgência" minHeight={220}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.porPrioridade} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" name="Chamados" radius={[4, 4, 0, 0]}>
                    {data.porPrioridade.map((p: any) => (
                      <Cell key={p.name} fill={PRIORIDADE_FILL[p.name] ?? '#6B7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ── Linha 4: Por equipe + Por setor ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <ChartCard title="Volume por Técnico Atribuído" subtitle="Top 10 técnicos com mais chamados no período" minHeight={220}>
              {porTecnico.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={porTecnico} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                    <Tooltip />
                    <Bar dataKey="total" name="Chamados" radius={[0, 4, 4, 0]}>
                      {porTecnico.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Volume por Setor Solicitante" subtitle="Top 8 setores que mais abriram chamados" minHeight={220}>
              {porSetor.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={porSetor} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="total" name="Chamados" radius={[0, 4, 4, 0]}>
                      {porSetor.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* ── Resumo detalhado ── */}
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '20px 24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 700, color: NAVY }}>
              Resumo Detalhado do Período
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {/* Coluna 1: Situação */}
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Situação</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <MiniStat label="Abertos"            value={raw.filter(c => c.status === 'aberto').length}           color="#2563EB" />
                  <MiniStat label="Em Atendimento"     value={raw.filter(c => c.status === 'em_atendimento').length}   color="#7C3AED" />
                  <MiniStat label="Aguardando Usuário" value={raw.filter(c => c.status === 'pendente_usuario').length} color="#D97706" />
                  <MiniStat label="Aguardando Terceiros" value={raw.filter(c => c.status === 'pendente_terceiro').length} color="#EA580C" />
                  <MiniStat label="Escalados"          value={escalados}                                               color="#DC2626" />
                  <MiniStat label="Reabertos"          value={reabertos}                                               color="#B91C1C" />
                </div>
              </div>

              {/* Coluna 2: Resultados */}
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resultados</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <MiniStat label="Encerrados / Resolvidos" value={encerrados}  color="#16A34A" />
                  <MiniStat label="Cancelados"              value={cancelados}  color="#6B7280" />
                  <MiniStat label="Taxa de Resolução"       value={taxaResolucao != null ? `${taxaResolucao}%` : '—'} color="#059669" />
                  <MiniStat label="MTTR (h)"                value={mttr != null ? `${mttr}h` : '—'} color="#7C3AED" />
                  <MiniStat label="SLA Compliance"          value={slaCompliance != null ? `${slaCompliance}%` : '—'}
                    color={slaCompliance == null ? '#6B7280' : slaCompliance >= 80 ? '#16A34A' : slaCompliance >= 60 ? '#D97706' : '#DC2626'} />
                  <MiniStat label="SLA Violados"            value={slaViolados} color="#DC2626" />
                </div>
              </div>

              {/* Coluna 3: Prioridades */}
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Por Prioridade</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <MiniStat label="Crítica" value={data.porPrioridade.find((p: any) => p.name === 'Crítica')?.total ?? 0} color="#DC2626" />
                  <MiniStat label="Alta"    value={data.porPrioridade.find((p: any) => p.name === 'Alta')?.total    ?? 0} color="#EA580C" />
                  <MiniStat label="Média"   value={data.porPrioridade.find((p: any) => p.name === 'Média')?.total   ?? 0} color="#D97706" />
                  <MiniStat label="Baixa"   value={data.porPrioridade.find((p: any) => p.name === 'Baixa')?.total   ?? 0} color="#16A34A" />
                  <MiniStat label="Total no Período" value={data.total} />
                  <MiniStat label="Em Aberto (geral)" value={data.emAberto} color="#EA580C" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
