'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import {
  Settings, Plus, Pencil, Trash2, Check, X,
  Loader2, LayoutDashboard, Clock,
} from 'lucide-react'
import {
  buscarSlaConfigsAction,
  salvarSlaConfigAction,
  excluirSlaConfigAction,
  buscarCategoriasAction,
  checkTiUserAccess,
} from '@/lib/ti/actions'
import { PRIORIDADE_LABELS } from '@/lib/ti/constants'
import type { TiPrioridade } from '@/lib/ti/types'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

const PRIORIDADES: TiPrioridade[] = ['critica', 'alta', 'media', 'baixa']

const PRIORIDADE_COLORS: Record<TiPrioridade, string> = {
  critica: '#DC2626',
  alta:    '#EA580C',
  media:   '#D97706',
  baixa:   '#6B7280',
}

type FormData = {
  prioridade: TiPrioridade
  categoria_id: string
  prazo_horas: number
  horario_comercial: boolean
  alerta_pct_70: boolean
  alerta_pct_90: boolean
  ativo: boolean
}

const DEFAULT_FORM: FormData = {
  prioridade:        'media',
  categoria_id:      '',
  prazo_horas:       24,
  horario_comercial: true,
  alerta_pct_70:     true,
  alerta_pct_90:     true,
  ativo:             true,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB',
  borderRadius: 6, fontSize: '0.875rem', boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, background: 'white' }

export default function SlaConfigPage() {
  const router = useRouter()
  const { accounts } = useMsal()

  const [authReady,   setAuthReady]   = useState(false)
  const [configs,     setConfigs]     = useState<any[]>([])
  const [categorias,  setCategorias]  = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editId,      setEditId]      = useState<string | null>(null)
  const [form,        setForm]        = useState<FormData>(DEFAULT_FORM)
  const [submitting,  setSubmitting]  = useState(false)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)

  // Auth — somente admin
  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted || r.perfil !== 'admin') {
        router.push('/ti/dashboard')
        return
      }
      setAuthReady(true)
    })
  }, [accounts, router])

  const carregar = useCallback(async () => {
    setLoading(true)
    const [cfgResult, catResult] = await Promise.all([
      buscarSlaConfigsAction(),
      buscarCategoriasAction(),
    ])
    if (cfgResult.success) setConfigs(cfgResult.configs)
    if (catResult.success) setCategorias(catResult.categorias)
    setLoading(false)
  }, [])

  useEffect(() => { if (authReady) carregar() }, [authReady, carregar])

  function openCreate() {
    setEditId(null)
    setForm(DEFAULT_FORM)
    setModalOpen(true)
  }

  function openEdit(cfg: any) {
    setEditId(cfg.id)
    setForm({
      prioridade:        cfg.prioridade,
      categoria_id:      cfg.categoria_id ?? '',
      prazo_horas:       cfg.prazo_horas,
      horario_comercial: cfg.horario_comercial,
      alerta_pct_70:     cfg.alerta_pct_70,
      alerta_pct_90:     cfg.alerta_pct_90,
      ativo:             cfg.ativo,
    })
    setModalOpen(true)
  }

  async function handleSalvar() {
    if (!form.prazo_horas || form.prazo_horas <= 0) {
      alert('Prazo em horas deve ser maior que zero.')
      return
    }
    setSubmitting(true)
    const result = await salvarSlaConfigAction({
      id:                editId ?? undefined,
      prioridade:        form.prioridade,
      categoria_id:      form.categoria_id || null,
      prazo_horas:       form.prazo_horas,
      horario_comercial: form.horario_comercial,
      alerta_pct_70:     form.alerta_pct_70,
      alerta_pct_90:     form.alerta_pct_90,
      ativo:             form.ativo,
    })
    setSubmitting(false)
    if (result.success) {
      setModalOpen(false)
      await carregar()
    } else {
      alert(result.error)
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm('Excluir esta configuração de SLA?')) return
    setDeletingId(id)
    await excluirSlaConfigAction(id)
    setDeletingId(null)
    await carregar()
  }

  const set = (field: keyof FormData, value: any) => setForm(prev => ({ ...prev, [field]: value }))

  // Categorias raiz apenas (para simplicidade)
  const categoriasRaiz = categorias.filter(c => !c.categoria_pai)

  if (!authReady) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
      <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui, sans-serif' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.8rem', color: '#6B7280' }}>
              <Link href="/ti/dashboard" style={{ color: '#6B7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <LayoutDashboard size={13} /> Painel
              </Link>
              <span>›</span>
              <span>Configuração SLA</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: NAVY }}>Configuração de SLA</h1>
            <p style={{ margin: '2px 0 0', color: '#6B7280', fontSize: '0.85rem' }}>Defina prazos por prioridade e categoria</p>
          </div>
          <button
            onClick={openCreate}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: BLUE, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
          >
            <Plus size={15} /> Nova Regra
          </button>
        </div>

        {/* Info box */}
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: '0.8rem', color: '#1E40AF' }}>
          <strong>Prioridade das regras:</strong> A configuração com categoria específica tem prioridade sobre a genérica (sem categoria). A regra genérica por prioridade funciona como fallback.
        </div>

        {/* Table */}
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
              <Loader2 size={24} style={{ color: BLUE, animation: 'spin 1s linear infinite', marginBottom: 8 }} />
              <p style={{ margin: 0 }}>Carregando...</p>
            </div>
          ) : configs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
              <Settings size={28} style={{ marginBottom: 8 }} />
              <p style={{ margin: 0 }}>Nenhuma regra configurada. Clique em "Nova Regra" para começar.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Prioridade', 'Categoria', 'Prazo (h)', 'Horário Comercial', 'Alerta 70%', 'Alerta 90%', 'Ativo', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {configs.map((cfg: any) => (
                  <tr key={cfg.id} style={{ borderTop: '1px solid #F3F4F6', opacity: cfg.ativo ? 1 : 0.5 }}>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, color: PRIORIDADE_COLORS[cfg.prioridade as TiPrioridade] ?? '#6B7280', background: `${PRIORIDADE_COLORS[cfg.prioridade as TiPrioridade] ?? '#6B7280'}18` }}>
                        {PRIORIDADE_LABELS[cfg.prioridade as TiPrioridade] ?? cfg.prioridade}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '0.85rem', color: '#374151' }}>
                      {cfg.categoria?.nome ?? <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Genérica (fallback)</span>}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.875rem', fontWeight: 600, color: NAVY }}>
                        <Clock size={13} style={{ color: '#6B7280' }} /> {cfg.prazo_horas}h
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      {cfg.horario_comercial ? <Check size={16} style={{ color: '#16A34A' }} /> : <X size={16} style={{ color: '#6B7280' }} />}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      {cfg.alerta_pct_70 ? <Check size={16} style={{ color: '#CA8A04' }} /> : <X size={16} style={{ color: '#6B7280' }} />}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      {cfg.alerta_pct_90 ? <Check size={16} style={{ color: '#EA580C' }} /> : <X size={16} style={{ color: '#6B7280' }} />}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      {cfg.ativo ? <Check size={16} style={{ color: '#16A34A' }} /> : <X size={16} style={{ color: '#DC2626' }} />}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => openEdit(cfg)}
                          style={{ background: 'none', border: '1px solid #D1D5DB', borderRadius: 5, cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#374151', fontWeight: 500 }}
                        >
                          <Pencil size={12} /> Editar
                        </button>
                        <button
                          onClick={() => handleExcluir(cfg.id)}
                          disabled={deletingId === cfg.id}
                          style={{ background: 'none', border: '1px solid #FCA5A5', borderRadius: 5, cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#DC2626', fontWeight: 500 }}
                        >
                          {deletingId === cfg.id
                            ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                            : <Trash2 size={12} />}
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: NAVY, fontSize: '1rem' }}>
                {editId ? 'Editar Regra de SLA' : 'Nova Regra de SLA'}
              </span>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '1.25rem' }}>×</button>
            </div>
            <div style={{ padding: 20 }}>

              {/* Prioridade */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
                  Prioridade <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select value={form.prioridade} onChange={e => set('prioridade', e.target.value)} style={selectStyle}>
                  {PRIORIDADES.map(p => (
                    <option key={p} value={p}>{PRIORIDADE_LABELS[p]}</option>
                  ))}
                </select>
              </div>

              {/* Categoria */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
                  Categoria <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(vazio = regra genérica)</span>
                </label>
                <select value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)} style={selectStyle}>
                  <option value="">— Genérica (fallback para qualquer categoria) —</option>
                  {categoriasRaiz.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              {/* Prazo */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
                  Prazo em horas <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={form.prazo_horas}
                  onChange={e => set('prazo_horas', Number(e.target.value))}
                  style={inputStyle}
                />
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6B7280' }}>
                  Exemplos: Crítica = 4h, Alta = 8h, Média = 24h, Baixa = 72h
                </p>
              </div>

              {/* Checkboxes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { field: 'horario_comercial', label: 'Horário comercial (8h–18h, seg–sex)' },
                  { field: 'alerta_pct_70',     label: 'Enviar alerta em 70%' },
                  { field: 'alerta_pct_90',     label: 'Enviar alerta em 90%' },
                  { field: 'ativo',             label: 'Regra ativa' },
                ].map(({ field, label }) => (
                  <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8rem', color: '#374151', padding: '8px 10px', background: '#F9FAFB', borderRadius: 6, border: '1px solid #E5E7EB' }}>
                    <input
                      type="checkbox"
                      checked={form[field as keyof FormData] as boolean}
                      onChange={e => set(field as keyof FormData, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{ padding: '8px 16px', background: 'white', border: '1px solid #D1D5DB', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvar}
                  disabled={submitting}
                  style={{ padding: '8px 16px', background: BLUE, color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
