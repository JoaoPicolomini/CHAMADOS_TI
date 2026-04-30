'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import {
  Clock, AlertTriangle, CheckCircle, LayoutDashboard,
  RefreshCw, Play, Loader2, TrendingUp, ShieldAlert,
} from 'lucide-react'
import { buscarChamadosAction, checkTiUserAccess } from '@/lib/ti/actions'
import { calcularSla } from '@/lib/ti/workflow'
import { STATUS_LABELS, PRIORIDADE_LABELS, PRIORIDADE_COLORS } from '@/lib/ti/constants'
import type { TiStatus, TiPrioridade } from '@/lib/ti/types'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

const STATUS_ATIVOS: TiStatus[] = ['aberto', 'em_atendimento', 'pendente_usuario', 'pendente_terceiro', 'escalado', 'reaberto']

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

type SlaGrupo = 'violado' | 'critico' | 'alerta' | 'ok'

function getSlaGrupo(pct: number, violado: boolean): SlaGrupo {
  if (violado || pct >= 100) return 'violado'
  if (pct >= 90)             return 'critico'
  if (pct >= 70)             return 'alerta'
  return 'ok'
}

const GRUPO_CONFIG: Record<SlaGrupo, { label: string; color: string; bg: string; border: string }> = {
  violado: { label: 'SLA Violado',     color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  critico: { label: 'Crítico (≥ 90%)', color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
  alerta:  { label: 'Atenção (≥ 70%)', color: '#CA8A04', bg: '#FEFCE8', border: '#FEF08A' },
  ok:      { label: 'No prazo',        color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
}

export default function SlaMonitoringPage() {
  const router = useRouter()
  const { accounts } = useMsal()

  const [authReady,   setAuthReady]   = useState(false)
  const [chamados,    setChamados]    = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [jobRunning,  setJobRunning]  = useState(false)
  const [jobResult,   setJobResult]   = useState<string | null>(null)

  // Auth — requer gestor_ti ou admin
  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted || !['gestor_ti', 'admin'].includes(r.perfil ?? '')) {
        router.push('/ti/dashboard')
        return
      }
      setAuthReady(true)
    })
  }, [accounts, router])

  const carregar = useCallback(async () => {
    setLoading(true)
    const result = await buscarChamadosAction({
      status:   STATUS_ATIVOS,
      pageSize: 100,
    })
    if (result.success) setChamados(result.chamados)
    setLoading(false)
  }, [])

  useEffect(() => { if (authReady) carregar() }, [authReady, carregar])

  // Enriquece com SLA calculado e agrupa
  const enriched = chamados.map(c => {
    const sla = calcularSla(c.sla_prazo, c.sla_violado, c.sla_horas_pausadas ?? 0, c.created_at)
    const grupo: SlaGrupo = sla ? getSlaGrupo(sla.percentual, sla.violado) : 'ok'
    return { ...c, sla, grupo }
  })

  const grupos: SlaGrupo[] = ['violado', 'critico', 'alerta', 'ok']
  const porGrupo = grupos.map(g => ({
    grupo: g,
    items: enriched.filter(c => c.grupo === g).sort((a, b) => (a.sla?.percentual ?? 0) > (b.sla?.percentual ?? 0) ? -1 : 1),
  }))

  const stats = {
    total:   enriched.length,
    violado: enriched.filter(c => c.grupo === 'violado').length,
    critico: enriched.filter(c => c.grupo === 'critico').length,
    alerta:  enriched.filter(c => c.grupo === 'alerta').length,
    ok:      enriched.filter(c => c.grupo === 'ok').length,
  }

  async function runJob(job: 'sla-monitor' | 'auto-close') {
    setJobRunning(true)
    setJobResult(null)
    try {
      const res  = await fetch(`/api/ti/jobs/${job}`)
      const data = await res.json()
      setJobResult(JSON.stringify(data.stats ?? data, null, 2))
      await carregar()
    } catch (e: any) {
      setJobResult(`Erro: ${e.message}`)
    }
    setJobRunning(false)
  }

  if (!authReady) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
      <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui, sans-serif' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.8rem', color: '#6B7280' }}>
              <Link href="/ti/dashboard" style={{ color: '#6B7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <LayoutDashboard size={13} /> Painel
              </Link>
              <span>›</span>
              <span>Monitoramento SLA</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: NAVY }}>Monitoramento de SLA</h1>
            <p style={{ margin: '2px 0 0', color: '#6B7280', fontSize: '0.85rem' }}>
              {enriched.length} chamados ativos · atualizado agora
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={carregar}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'white', border: '1px solid #D1D5DB', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: '#374151' }}
            >
              <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
              Atualizar
            </button>
            <button
              onClick={() => runJob('sla-monitor')}
              disabled={jobRunning}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#EA580C', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: 'white', opacity: jobRunning ? 0.7 : 1 }}
            >
              {jobRunning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
              Rodar SLA Monitor
            </button>
            <button
              onClick={() => runJob('auto-close')}
              disabled={jobRunning}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: NAVY, border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: 'white', opacity: jobRunning ? 0.7 : 1 }}
            >
              {jobRunning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
              Rodar Auto-close
            </button>
          </div>
        </div>

        {/* Job result */}
        {jobResult && (
          <div style={{ background: '#1E293B', color: '#86EFAC', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre' }}>
            {jobResult}
          </div>
        )}

        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Ativos', value: stats.total,   color: NAVY,      icon: <Clock size={18} /> },
            { label: 'SLA Violado',  value: stats.violado, color: '#DC2626',  icon: <AlertTriangle size={18} /> },
            { label: 'Crítico',      value: stats.critico, color: '#EA580C',  icon: <ShieldAlert size={18} /> },
            { label: 'Atenção',      value: stats.alerta,  color: '#CA8A04',  icon: <TrendingUp size={18} /> },
            { label: 'No Prazo',     value: stats.ok,      color: '#16A34A',  icon: <CheckCircle size={18} /> },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Grupos */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>
            <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <p style={{ margin: 0 }}>Carregando chamados...</p>
          </div>
        ) : (
          porGrupo.filter(g => g.items.length > 0).map(({ grupo, items }) => {
            const cfg = GRUPO_CONFIG[grupo]
            return (
              <div key={grupo} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, fontSize: '0.8rem', fontWeight: 700 }}>
                    {cfg.label}
                    <span style={{ background: cfg.color, color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>{items.length}</span>
                  </span>
                </div>

                <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB' }}>
                        {['Número', 'Título', 'Solicitante', 'Prioridade', 'Status', 'SLA', 'Prazo', 'Técnico'].map(h => (
                          <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((c: any) => {
                        const sla   = c.sla
                        const pct   = sla ? Math.min(Math.round(sla.percentual), 999) : null
                        const priCfg = PRIORIDADE_COLORS[c.prioridade as TiPrioridade] ?? { color: '#6B7280', bg: 'rgba(107,114,128,0.1)' }
                        return (
                          <tr key={c.id} style={{ borderTop: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '10px 14px' }}>
                              <Link href={`/ti/chamado/${c.id}`} style={{ fontFamily: 'monospace', fontWeight: 700, color: BLUE, textDecoration: 'none', fontSize: '0.85rem' }}>
                                {c.numero}
                              </Link>
                            </td>
                            <td style={{ padding: '10px 14px', maxWidth: 220 }}>
                              <span style={{ fontSize: '0.85rem', color: '#111827', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titulo}</span>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#6B7280', whiteSpace: 'nowrap' }}>{c.solicitante_nome}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, color: priCfg.color, background: priCfg.bg }}>
                                {PRIORIDADE_LABELS[c.prioridade as TiPrioridade] ?? c.prioridade}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: '0.75rem', color: '#374151', whiteSpace: 'nowrap' }}>
                              {STATUS_LABELS[c.status as TiStatus] ?? c.status}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {pct !== null ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                                  <div style={{ flex: 1, height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: cfg.color, borderRadius: 3 }} />
                                  </div>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: cfg.color, minWidth: 36 }}>{pct}%</span>
                                </div>
                              ) : <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: '0.75rem', color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtDate(c.sla_prazo)}</td>
                            <td style={{ padding: '10px 14px', fontSize: '0.75rem', color: '#6B7280' }}>{c.tecnico?.nome ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        )}

        {!loading && enriched.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, background: 'white', border: '1px solid #E5E7EB', borderRadius: 10 }}>
            <CheckCircle size={32} style={{ color: '#16A34A', marginBottom: 8 }} />
            <p style={{ margin: 0, fontWeight: 600, color: '#16A34A' }}>Nenhum chamado com SLA em risco!</p>
          </div>
        )}
      </div>
    </div>
  )
}
