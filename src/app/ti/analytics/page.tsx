'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import * as XLSX from 'xlsx'
import {
  LayoutDashboard, BarChart3, Download, RefreshCw, Loader2,
  TrendingUp, Clock, ShieldCheck, Ticket, AlertTriangle,
} from 'lucide-react'
import { checkTiUserAccess, buscarAnalyticsAction } from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

const PERIODOS = [
  { value: '7d',   label: '7 dias'    },
  { value: '30d',  label: '30 dias'   },
  { value: '90d',  label: '90 dias'   },
  { value: '365d', label: '12 meses'  },
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

// ─── Label formatters ─────────────────────────────────────────
function fmtLabel(label: string, periodo: Periodo): string {
  if (periodo === '365d') {
    // label = 'YYYY-MM'
    const [y, m] = label.split('-')
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${months[parseInt(m) - 1]}/${y.slice(2)}`
  }
  // daily or weekly: 'YYYY-MM-DD'
  const [, m, d] = label.split('-')
  return `${d}/${m}`
}

// ─── StatCard ─────────────────────────────────────────────────
function StatCard({
  icon, label, value, suffix, color, sub,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  suffix?: string
  color: string
  sub?: string
}) {
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ fontSize: '0.82rem', color: '#6B7280', fontWeight: 500 }}>{label}</span>
        <div style={{ color, opacity: 0.85 }}>{icon}</div>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: NAVY, lineHeight: 1 }}>
        {value}{suffix}
      </div>
      {sub && <div style={{ marginTop: 4, fontSize: '0.75rem', color: '#9CA3AF' }}>{sub}</div>}
    </div>
  )
}

// ─── ChartCard ────────────────────────────────────────────────
function ChartCard({
  title, subtitle, children, minHeight = 280,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  minHeight?: number
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

// ─── Page ─────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const router = useRouter()
  const { accounts } = useMsal()

  const [authReady,    setAuthReady]    = useState(false)
  const [periodo,      setPeriodo]      = useState<Periodo>('30d')
  const [loading,      setLoading]      = useState(true)
  const [data,         setData]         = useState<any>(null)
  const [chamadosRaw,  setChamadosRaw]  = useState<any[]>([])
  const [error,        setError]        = useState<string | null>(null)

  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted) { router.push('/ti'); return }
      setAuthReady(true)
    })
  }, [accounts, router])

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await buscarAnalyticsAction(periodo)
    if (res.success && res.data) {
      setData(res.data)
      setChamadosRaw(res.data.chamadosRaw ?? [])
    } else {
      setError((res as any).error ?? 'Erro ao carregar analytics.')
    }
    setLoading(false)
  }, [periodo])

  useEffect(() => { if (authReady) carregar() }, [authReady, carregar])

  function exportar() {
    if (!chamadosRaw.length) return
    const rows = chamadosRaw.map((c: any) => ({
      'Número':       c.numero ?? '',
      'Título':       c.titulo ?? '',
      'Status':       c.status,
      'Prioridade':   c.prioridade,
      'Categoria':    (c.categoria as any)?.nome ?? 'Sem categoria',
      'Equipe':       (c.equipe as any)?.nome ?? 'Sem equipe',
      'Solicitante':  c.solicitante_nome ?? '',
      'Setor':        c.solicitante_setor ?? '',
      'Criado em':    c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '',
      'Fechado em':   c.fechado_em ? new Date(c.fechado_em).toLocaleDateString('pt-BR') : '',
      'SLA Violado':  c.sla_violado ? 'Sim' : 'Não',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    // Auto column widths
    const cols = Object.keys(rows[0] ?? {}).map(k => ({ wch: Math.max(k.length, 12) }))
    ws['!cols'] = cols
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Chamados ${periodo}`)
    XLSX.writeFile(wb, `ti-analytics-${periodo}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // ─── Loading / Error states ────────────────────────────────
  if (!authReady) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ── */}
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
              {data.total} chamado{data.total !== 1 ? 's' : ''} nos últimos {periodo === '365d' ? '12 meses' : periodo}
            </p>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Period tabs */}
          <div style={{ display: 'flex', background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
            {PERIODOS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                style={{
                  padding: '7px 14px', border: 'none', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 600,
                  background: periodo === p.value ? BLUE : 'transparent',
                  color: periodo === p.value ? 'white' : '#374151',
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={carregar}
            disabled={loading}
            title="Atualizar"
            style={{
              padding: '7px 10px', background: 'white', border: '1px solid #E5E7EB',
              borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center',
              color: '#374151', opacity: loading ? 0.5 : 1,
            }}
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>

          {/* Export */}
          <button
            onClick={exportar}
            disabled={!chamadosRaw.length || loading}
            style={{
              padding: '7px 14px', background: NAVY, color: 'white',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.8rem', fontWeight: 600,
              opacity: chamadosRaw.length && !loading ? 1 : 0.5,
            }}
          >
            <Download size={14} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: '#DC2626' }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* ── Loading overlay ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#6B7280' }}>
          <Loader2 size={32} style={{ color: BLUE, animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <p style={{ margin: 0 }}>Carregando dados...</p>
        </div>
      ) : data && (
        <>
          {/* ── Stats cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <StatCard
              icon={<Ticket size={20} />}
              label="Total no Período"
              value={data.total}
              color="#2563EB"
              sub="chamados abertos"
            />
            <StatCard
              icon={<TrendingUp size={20} />}
              label="Em Aberto Agora"
              value={data.emAberto}
              color="#EA580C"
              sub="aguardando atendimento"
            />
            <StatCard
              icon={<Clock size={20} />}
              label="MTTR"
              value={data.mttrHoras ?? '—'}
              suffix={data.mttrHoras != null ? 'h' : ''}
              color="#7C3AED"
              sub={data.mttrHoras != null ? 'tempo médio de resolução' : 'sem dados de fechamento'}
            />
            <StatCard
              icon={<ShieldCheck size={20} />}
              label="SLA Compliance"
              value={data.slaCompliance ?? '—'}
              suffix={data.slaCompliance != null ? '%' : ''}
              color={data.slaCompliance != null ? (data.slaCompliance >= 80 ? '#16A34A' : data.slaCompliance >= 60 ? '#D97706' : '#DC2626') : '#6B7280'}
              sub={data.slaCompliance != null ? 'chamados dentro do prazo' : 'sem dados de SLA'}
            />
          </div>

          {/* ── Row 1: Tendência + Por categoria ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

            {/* Tendência diária/semanal/mensal */}
            <ChartCard
              title="Tendência Temporal"
              subtitle={
                periodo === '365d' ? 'Chamados abertos e fechados por mês' :
                periodo === '90d'  ? 'Chamados abertos e fechados por semana' :
                                     'Chamados abertos e fechados por dia'
              }
            >
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.tendencia ?? []} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickFormatter={l => fmtLabel(l, periodo)}
                    interval={
                      periodo === '7d'  ? 0  :
                      periodo === '30d' ? 4  :
                      periodo === '90d' ? 1  : 0
                    }
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={l => fmtLabel(l, periodo)}
                    formatter={(v: any, name: string) => [v, name === 'abertos' ? 'Abertos' : 'Fechados']}
                  />
                  <Legend formatter={(v: string) => v === 'abertos' ? 'Abertos' : 'Fechados'} />
                  <Line type="monotone" dataKey="abertos" stroke="#2563EB" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="fechados" stroke="#16A34A" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Por categoria */}
            <ChartCard
              title="Volume por Categoria"
              subtitle="Top 10 categorias mais recorrentes no período"
            >
              {data.porCategoria.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={data.porCategoria}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                  >
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

          {/* ── Row 2: Por prioridade + Por equipe ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

            {/* Por prioridade */}
            <ChartCard
              title="Volume por Prioridade"
              subtitle="Distribuição dos chamados por nível de urgência"
              minHeight={220}
            >
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

            {/* Por equipe */}
            <ChartCard
              title="Volume por Equipe"
              subtitle="Chamados atribuídos por equipe no período"
              minHeight={220}
            >
              {data.porEquipe.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={data.porEquipe}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="total" name="Chamados" fill={BLUE} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* ── Row 3: Métricas detalhadas ── */}
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '20px 24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 700, color: NAVY }}>
              Resumo do Período
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              {[
                { label: 'Chamados abertos',   value: data.total },
                { label: 'Chamados fechados',  value: data.porPrioridade.reduce((a: number, _: any) => a, 0) !== 0
                    ? chamadosRaw.filter((c: any) => c.fechado_em).length : chamadosRaw.filter((c: any) => c.fechado_em).length },
                { label: 'Críticos',           value: data.porPrioridade.find((p: any) => p.name === 'Crítica')?.total ?? 0 },
                { label: 'Alta prioridade',    value: data.porPrioridade.find((p: any) => p.name === 'Alta')?.total ?? 0 },
                { label: 'SLA violados',       value: chamadosRaw.filter((c: any) => c.sla_violado).length },
                { label: 'Categorias ativas',  value: data.porCategoria.length },
              ].map(item => (
                <div key={item.label} style={{ padding: '12px 16px', background: BG, borderRadius: 8 }}>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: NAVY }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
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
