'use client'

import { use, useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import {
  ArrowLeft, Clock, User, Tag, Monitor, Paperclip,
  MessageSquare, GitBranch, LayoutDashboard, AlertTriangle,
  CheckCircle, XCircle, RefreshCw, UserPlus, TrendingUp,
  Download, Upload, Lock, Unlock, ChevronDown, Loader2,
  Trash2, FileText, Image, File,
} from 'lucide-react'
import {
  buscarChamadoPorIdAction,
  checkTiUserAccess,
  transicionarStatusAction,
  atribuirChamadoAction,
  escalarChamadoAction,
  adicionarComentarioAction,
  uploadAnexoAction,
  gerarUrlAnexoAction,
  buscarEquipesAction,
} from '@/lib/ti/actions'
import { calcularSla, getProximosStatus, validateTransition } from '@/lib/ti/workflow'
import {
  STATUS_LABELS, STATUS_COLORS,
  PRIORIDADE_LABELS, PRIORIDADE_COLORS,
  TIPO_LABELS, ORIGEM_LABELS,
} from '@/lib/ti/constants'
import type { TiStatus, TiNivelSuporte } from '@/lib/ti/types'

// ─── Types ────────────────────────────────────────────────────
type TabId = 'detalhes' | 'timeline' | 'comentarios' | 'anexos'

// ─── Colors ───────────────────────────────────────────────────
const NAVY  = '#1E3A5F'
const BLUE  = '#2563EB'
const BG    = '#F5F7FA'
const CARD  = '#FFFFFF'

// ─── Helpers ──────────────────────────────────────────────────
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function fmtFileSize(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(mime: string | null) {
  if (!mime) return <File size={16} />
  if (mime.startsWith('image/')) return <Image size={16} />
  if (mime === 'application/pdf' || mime.includes('word') || mime.includes('sheet'))
    return <FileText size={16} />
  return <File size={16} />
}

// ─── SLA Bar ──────────────────────────────────────────────────
function SlaBar({ chamado }: { chamado: any }) {
  const sla = calcularSla(chamado.sla_prazo, chamado.sla_violado, chamado.sla_horas_pausadas ?? 0, chamado.created_at)
  if (!sla) return null

  const pct = Math.min(sla.percentual, 100)
  const cfg = {
    ok:       { bar: '#16A34A', bg: '#DCFCE7', text: '#16A34A', label: 'SLA no prazo' },
    warning:  { bar: '#CA8A04', bg: '#FEF9C3', text: '#92400E', label: 'SLA em atenção' },
    critical: { bar: '#EA580C', bg: '#FFEDD5', text: '#9A3412', label: 'SLA crítico' },
    expired:  { bar: '#DC2626', bg: '#FEE2E2', text: '#991B1B', label: 'SLA violado' },
  }[sla.status]

  const hrs = Math.abs(Math.round(sla.horasRestantes))
  const timeLabel = sla.violado
    ? `${hrs}h em atraso`
    : sla.horasRestantes < 1
    ? `${Math.round(sla.minutosRestantes)}min restantes`
    : `${hrs}h restantes`

  return (
    <div style={{ background: cfg.bg, borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: cfg.text }}>{cfg.label}</span>
          <span style={{ fontSize: '0.75rem', color: cfg.text }}>{timeLabel}</span>
        </div>
        <div style={{ height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: cfg.bar, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', color: cfg.text, whiteSpace: 'nowrap' }}>
        Prazo: {fmtDate(chamado.sla_prazo)}
      </div>
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────
function StatusBadge({ status }: { status: TiStatus }) {
  const c = STATUS_COLORS[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem',
      fontWeight: 600, border: `1px solid ${c.border}`,
      color: c.color, background: c.bg,
    }}>
      {STATUS_LABELS[status]}
    </span>
  )
}

// ─── Priority Badge ───────────────────────────────────────────
function PrioridadeBadge({ prioridade }: { prioridade: string }) {
  const c = PRIORIDADE_COLORS[prioridade as keyof typeof PRIORIDADE_COLORS] ?? { color: '#6B7280', bg: 'rgba(107,114,128,0.1)' }
  const label = PRIORIDADE_LABELS[prioridade as keyof typeof PRIORIDADE_LABELS] ?? prioridade
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem',
      fontWeight: 600, color: c.color, background: c.bg,
    }}>
      {label}
    </span>
  )
}

// ─── Info Row ─────────────────────────────────────────────────
function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', color: '#111827', fontFamily: mono ? 'monospace' : undefined }}>{value || '—'}</span>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────
function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: CARD, border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ color: NAVY }}>{icon}</span>}
        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: NAVY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      <div style={{ padding: '4px 16px 12px' }}>{children}</div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 520 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
      <div style={{ background: CARD, borderRadius: 12, width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: NAVY, fontSize: '1rem' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

// ─── Form Field ───────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', marginBottom: 5, fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
        {label}{required && <span style={{ color: '#DC2626', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6,
  fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical', minHeight: 80, fontFamily: 'inherit',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle, background: 'white', cursor: 'pointer',
}

// ─── Main Page ────────────────────────────────────────────────
export default function ChamadoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { accounts } = useMsal()

  // Auth
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName,  setUserName]  = useState<string | null>(null)
  const [perfil,    setPerfil]    = useState<string>('')
  const [authReady, setAuthReady] = useState(false)

  // Data
  const [chamado,     setChamado]     = useState<any>(null)
  const [eventos,     setEventos]     = useState<any[]>([])
  const [comentarios, setComentarios] = useState<any[]>([])
  const [anexos,      setAnexos]      = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [dataError,   setDataError]   = useState<string | null>(null)

  // UI
  const [activeTab, setActiveTab] = useState<TabId>('detalhes')

  // Modals
  const [statusModal,  setStatusModal]  = useState(false)
  const [atribuirModal, setAtribuirModal] = useState(false)
  const [escalarModal, setEscalarModal]  = useState(false)

  // Status modal form
  const [novoStatus,          setNovoStatus]          = useState<TiStatus | ''>('')
  const [justificativa,       setJustificativa]       = useState('')
  const [solucao,             setSolucao]             = useState('')
  const [causaRaiz,           setCausaRaiz]           = useState('')
  const [motivoCancelamento,  setMotivoCancelamento]  = useState('')

  // Atribuir modal
  const [equipes,         setEquipes]         = useState<any[]>([])
  const [selectedEquipe,  setSelectedEquipe]  = useState('')
  const [selectedTecnico, setSelectedTecnico] = useState('')

  // Escalar modal
  const [nivelDestino,         setNivelDestino]         = useState<TiNivelSuporte>(2)
  const [equipeDestino,        setEquipeDestino]        = useState('')
  const [justificativaEscalar, setJustificativaEscalar] = useState('')

  // Comentário
  const [novoComentario, setNovoComentario] = useState('')
  const [interno,        setInterno]        = useState(false)

  // Anexo upload
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Submitting
  const [submitting, setSubmitting] = useState(false)

  // ── Auth check ────────────────────────────────────────────
  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    const email = account.username
    const name  = account.name || email
    setUserEmail(email)
    setUserName(name)

    checkTiUserAccess(email).then(result => {
      if (!result.granted) { router.push('/ti'); return }
      setPerfil(result.perfil || '')
      setAuthReady(true)
    })
  }, [accounts, router])

  // ── Load chamado ──────────────────────────────────────────
  const carregarChamado = useCallback(async () => {
    setLoading(true)
    const result = await buscarChamadoPorIdAction(id)
    if (result.success && result.chamado) {
      setChamado(result.chamado)
      setEventos(result.eventos ?? [])
      setComentarios(result.comentarios ?? [])
      setAnexos(result.anexos ?? [])
    } else {
      setDataError(result.error || 'Chamado não encontrado.')
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    if (authReady) carregarChamado()
  }, [authReady, carregarChamado])

  // ── Load equipes ──────────────────────────────────────────
  useEffect(() => {
    if (authReady) buscarEquipesAction().then(r => { if (r.success) setEquipes(r.equipes) })
  }, [authReady])

  // ── Derived ───────────────────────────────────────────────
  const isTecnico     = ['tecnico', 'gestor_ti', 'admin'].includes(perfil)
  const proximosStatus = chamado ? getProximosStatus(chamado.status as TiStatus) : []
  const isTerminal    = chamado && ['fechado', 'fechado_automatico', 'cancelado'].includes(chamado.status)

  // Validation for status modal
  const statusValidation = (novoStatus && chamado)
    ? validateTransition(chamado.status as TiStatus, novoStatus as TiStatus)
    : null

  // Tecnicos from selected equipe (or all if no equipe selected)
  const tecnicosDisponiveis = selectedEquipe
    ? equipes.find(e => e.id === selectedEquipe)?.tecnicos?.filter((t: any) => t.ativo) ?? []
    : equipes.flatMap((e: any) => e.tecnicos?.filter((t: any) => t.ativo) ?? [])

  // ── Action handlers ───────────────────────────────────────
  async function handleTransicionar() {
    if (!novoStatus || !userEmail || !chamado) return
    if (statusValidation?.requiresSolucao && !solucao.trim()) {
      alert('Informe a solução antes de marcar como resolvido.')
      return
    }
    if (statusValidation?.requiresCancelReason && !motivoCancelamento.trim()) {
      alert('Informe o motivo do cancelamento.')
      return
    }
    if (statusValidation?.requiresJustificativa && !justificativa.trim()) {
      alert('Justificativa obrigatória para esta transição.')
      return
    }
    setSubmitting(true)
    const result = await transicionarStatusAction({
      chamado_id:          id,
      novo_status:         novoStatus as TiStatus,
      justificativa:       justificativa  || undefined,
      solucao:             solucao        || undefined,
      causa_raiz:          causaRaiz      || undefined,
      motivo_cancelamento: motivoCancelamento || undefined,
      realizado_por:       userEmail,
    })
    setSubmitting(false)
    if (result.success) {
      setStatusModal(false)
      setNovoStatus(''); setJustificativa(''); setSolucao(''); setCausaRaiz(''); setMotivoCancelamento('')
      await carregarChamado()
    } else {
      alert(result.error)
    }
  }

  async function handleAtribuir() {
    if (!userEmail) return
    setSubmitting(true)
    const result = await atribuirChamadoAction({
      chamado_id:  id,
      tecnico_id:  selectedTecnico || null,
      equipe_id:   selectedEquipe  || null,
      atribuido_por: userEmail,
    })
    setSubmitting(false)
    if (result.success) {
      setAtribuirModal(false)
      setSelectedEquipe(''); setSelectedTecnico('')
      await carregarChamado()
    } else {
      alert(result.error)
    }
  }

  async function handleEscalar() {
    if (!userEmail || !justificativaEscalar.trim()) { alert('Justificativa obrigatória.'); return }
    setSubmitting(true)
    const result = await escalarChamadoAction({
      chamado_id:       id,
      nivel_destino:    nivelDestino,
      equipe_destino_id: equipeDestino || undefined,
      justificativa:    justificativaEscalar,
      escalado_por:     userEmail,
    })
    setSubmitting(false)
    if (result.success) {
      setEscalarModal(false)
      setJustificativaEscalar(''); setEquipeDestino('')
      await carregarChamado()
    } else {
      alert(result.error)
    }
  }

  async function handleComentario() {
    if (!novoComentario.trim() || !userEmail || !userName) return
    setSubmitting(true)
    await adicionarComentarioAction({
      chamado_id:  id,
      autor_nome:  userName,
      autor_email: userEmail,
      conteudo:    novoComentario,
      interno,
    })
    setSubmitting(false)
    setNovoComentario(''); setInterno(false)
    await carregarChamado()
  }

  async function handleUpload() {
    if (!uploadFiles.length || !userName) return
    setSubmitting(true)
    for (const file of uploadFiles) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('chamado_id', id)
      fd.append('enviado_por', userName)
      await uploadAnexoAction(fd)
    }
    setUploadFiles([])
    setSubmitting(false)
    await carregarChamado()
  }

  async function handleDownload(storagePath: string, nome: string) {
    const r = await gerarUrlAnexoAction(storagePath)
    if (r.success && r.url) {
      const a = document.createElement('a')
      a.href = r.url; a.download = nome; a.target = '_blank'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    }
  }

  // Open atribuir modal with current values pre-filled
  function openAtribuirModal() {
    setSelectedEquipe(chamado?.equipe_id ?? '')
    setSelectedTecnico(chamado?.tecnico_id ?? '')
    setAtribuirModal(true)
  }

  // ── Render ────────────────────────────────────────────────
  if (!authReady || loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
      <div style={{ textAlign: 'center' }}>
        <Loader2 size={32} style={{ color: BLUE, animation: 'spin 1s linear infinite', marginBottom: 12 }} />
        <p style={{ color: '#6B7280' }}>Carregando chamado...</p>
      </div>
    </div>
  )

  if (dataError || !chamado) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
      <div style={{ textAlign: 'center' }}>
        <AlertTriangle size={32} style={{ color: '#DC2626', marginBottom: 12 }} />
        <p style={{ color: '#DC2626', fontWeight: 600 }}>{dataError || 'Chamado não encontrado.'}</p>
        <Link href="/ti/dashboard" style={{ color: BLUE, marginTop: 8, display: 'inline-block' }}>← Voltar ao Painel</Link>
      </div>
    </div>
  )

  const tabStyle = (tab: TabId): React.CSSProperties => ({
    padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
    fontWeight: activeTab === tab ? 700 : 500,
    color: activeTab === tab ? BLUE : '#6B7280',
    borderBottom: activeTab === tab ? `2px solid ${BLUE}` : '2px solid transparent',
    fontSize: '0.875rem', transition: 'all 0.15s',
  })

  const btnPrimary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', background: BLUE, color: '#fff',
    border: 'none', borderRadius: 7, cursor: 'pointer',
    fontWeight: 600, fontSize: '0.8rem',
  }

  const btnSecondary: React.CSSProperties = {
    ...btnPrimary, background: 'white', color: NAVY,
    border: `1px solid #D1D5DB`,
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui, sans-serif' }}>
      {/* ── CSS for spin animation ── */}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>

        {/* ── Breadcrumb ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, color: '#6B7280', fontSize: '0.8rem' }}>
          <Link href="/ti/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6B7280', textDecoration: 'none' }}>
            <LayoutDashboard size={14} /> Painel
          </Link>
          <span>›</span>
          <span style={{ color: NAVY, fontWeight: 600 }}>{chamado.numero}</span>
        </div>

        {/* ── Header ── */}
        <div style={{ background: CARD, borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 24px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            {/* Left: title + badges */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: BLUE, fontSize: '1rem' }}>{chamado.numero}</span>
                <StatusBadge status={chamado.status} />
                <PrioridadeBadge prioridade={chamado.prioridade} />
                <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(107,114,128,0.1)', color: '#374151' }}>
                  {TIPO_LABELS[chamado.tipo as keyof typeof TIPO_LABELS] ?? chamado.tipo}
                </span>
                {chamado.nivel_suporte > 1 && (
                  <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(234,88,12,0.1)', color: '#EA580C' }}>
                    N{chamado.nivel_suporte}
                  </span>
                )}
              </div>
              <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: NAVY, lineHeight: 1.3 }}>{chamado.titulo}</h1>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#6B7280' }}>
                Aberto por <strong>{chamado.solicitante_nome}</strong> • {chamado.solicitante_setor} • {fmtDate(chamado.created_at)}
              </p>
            </div>

            {/* Right: action buttons */}
            {isTecnico && !isTerminal && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => { setNovoStatus(''); setStatusModal(true) }} style={btnPrimary}>
                  <GitBranch size={14} /> Alterar Status
                </button>
                <button onClick={openAtribuirModal} style={btnSecondary}>
                  <UserPlus size={14} /> Atribuir
                </button>
                {chamado.status === 'em_atendimento' && (
                  <button onClick={() => setEscalarModal(true)} style={{ ...btnSecondary, color: '#EA580C', borderColor: '#EA580C' }}>
                    <TrendingUp size={14} /> Escalar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── SLA Bar ── */}
        {chamado.sla_prazo && !isTerminal && <SlaBar chamado={chamado} />}

        {/* ── Layout: tabs + sidebar ── */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

          {/* ── Left: Tabs ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Tab Nav */}
            <div style={{ background: CARD, borderRadius: 10, border: '1px solid #E5E7EB', marginBottom: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', overflowX: 'auto' }}>
                <button onClick={() => setActiveTab('detalhes')}     style={tabStyle('detalhes')}>Detalhes</button>
                <button onClick={() => setActiveTab('timeline')}     style={tabStyle('timeline')}>Timeline ({eventos.length})</button>
                <button onClick={() => setActiveTab('comentarios')}  style={tabStyle('comentarios')}>Comentários ({comentarios.length})</button>
                <button onClick={() => setActiveTab('anexos')}       style={tabStyle('anexos')}>Anexos ({anexos.length})</button>
              </div>
            </div>

            {/* ── Detalhes Tab ── */}
            {activeTab === 'detalhes' && (
              <div style={{ background: CARD, borderRadius: 10, border: '1px solid #E5E7EB', padding: '20px 24px' }}>
                <h3 style={{ margin: '0 0 12px', fontWeight: 700, color: NAVY, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descrição</h3>
                <p style={{ margin: '0 0 20px', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{chamado.descricao}</p>

                {chamado.passos_reproduzir && (
                  <>
                    <h3 style={{ margin: '0 0 8px', fontWeight: 700, color: NAVY, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Passos para Reproduzir</h3>
                    <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
                      <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>{chamado.passos_reproduzir}</p>
                    </div>
                  </>
                )}

                {chamado.ativo_descricao && (
                  <>
                    <h3 style={{ margin: '0 0 8px', fontWeight: 700, color: NAVY, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ativo / Equipamento</h3>
                    <p style={{ margin: '0 0 20px', color: '#374151' }}>{chamado.ativo_descricao}</p>
                  </>
                )}

                {(chamado.solucao || chamado.causa_raiz) && (
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '16px' }}>
                    {chamado.solucao && (
                      <>
                        <h3 style={{ margin: '0 0 8px', fontWeight: 700, color: '#16A34A', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✓ Solução Aplicada</h3>
                        <p style={{ margin: '0 0 12px', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{chamado.solucao}</p>
                      </>
                    )}
                    {chamado.causa_raiz && (
                      <>
                        <h3 style={{ margin: '0 0 8px', fontWeight: 700, color: '#16A34A', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Causa Raiz</h3>
                        <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{chamado.causa_raiz}</p>
                      </>
                    )}
                  </div>
                )}

                {chamado.motivo_cancelamento && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '16px', marginTop: 12 }}>
                    <h3 style={{ margin: '0 0 8px', fontWeight: 700, color: '#DC2626', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Motivo do Cancelamento</h3>
                    <p style={{ margin: 0, color: '#374151' }}>{chamado.motivo_cancelamento}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Timeline Tab ── */}
            {activeTab === 'timeline' && (
              <div style={{ background: CARD, borderRadius: 10, border: '1px solid #E5E7EB', padding: '20px 24px' }}>
                {eventos.length === 0 ? (
                  <p style={{ color: '#6B7280', textAlign: 'center', padding: '32px 0' }}>Nenhum evento registrado.</p>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, width: 2, background: '#E5E7EB' }} />
                    {eventos.map((ev: any, i: number) => {
                      const isFirst = i === 0
                      const statusPara = STATUS_LABELS[ev.status_para as TiStatus] ?? ev.status_para
                      const statusDe   = ev.status_de ? (STATUS_LABELS[ev.status_de as TiStatus] ?? ev.status_de) : null
                      const dotColor   = ev.status_para === 'cancelado' ? '#DC2626'
                                       : ev.status_para === 'resolvido' || ev.status_para === 'fechado' ? '#16A34A'
                                       : BLUE
                      return (
                        <div key={ev.id} style={{ display: 'flex', gap: 16, paddingBottom: 20, position: 'relative' }}>
                          <div style={{ width: 34, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: dotColor, border: `2px solid ${CARD}`, boxShadow: `0 0 0 2px ${dotColor}`, marginTop: 4, position: 'relative', zIndex: 1 }} />
                          </div>
                          <div style={{ flex: 1, paddingBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 }}>
                              <div>
                                {statusDe ? (
                                  <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.875rem' }}>
                                    <span style={{ color: '#6B7280' }}>{statusDe}</span>
                                    <span style={{ color: '#9CA3AF', margin: '0 6px' }}>→</span>
                                    <span style={{ color: dotColor }}>{statusPara}</span>
                                  </span>
                                ) : (
                                  <span style={{ fontWeight: 600, color: dotColor, fontSize: '0.875rem' }}>{statusPara}</span>
                                )}
                                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#6B7280' }}>por {ev.realizado_por}</span>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{fmtDate(ev.created_at)}</span>
                            </div>
                            {ev.justificativa && (
                              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#6B7280', fontStyle: 'italic' }}>"{ev.justificativa}"</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Comentários Tab ── */}
            {activeTab === 'comentarios' && (
              <div>
                {/* Comment list */}
                <div style={{ background: CARD, borderRadius: 10, border: '1px solid #E5E7EB', marginBottom: 12, overflow: 'hidden' }}>
                  {comentarios.length === 0 ? (
                    <p style={{ color: '#6B7280', textAlign: 'center', padding: '32px 0' }}>Nenhum comentário ainda.</p>
                  ) : comentarios.map((c: any) => (
                    <div key={c.id} style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid #F3F4F6',
                      background: c.interno ? 'rgba(234,88,12,0.04)' : undefined,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                            {c.autor_nome.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{c.autor_nome}</span>
                          {c.interno && (
                            <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(234,88,12,0.1)', color: '#EA580C', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Lock size={10} /> Interno
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{fmtDate(c.created_at)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.conteudo}</p>
                    </div>
                  ))}
                </div>

                {/* Add comment form */}
                {!isTerminal && (
                  <div style={{ background: CARD, borderRadius: 10, border: '1px solid #E5E7EB', padding: '16px 20px' }}>
                    <h3 style={{ margin: '0 0 12px', fontWeight: 700, color: NAVY, fontSize: '0.875rem' }}>Adicionar Comentário</h3>
                    <textarea
                      value={novoComentario}
                      onChange={e => setNovoComentario(e.target.value)}
                      placeholder="Digite seu comentário..."
                      style={{ ...textareaStyle, minHeight: 100 }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      {isTecnico && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem', color: '#374151' }}>
                          <input type="checkbox" checked={interno} onChange={e => setInterno(e.target.checked)} />
                          <Lock size={12} style={{ color: '#EA580C' }} />
                          Nota interna (não visível ao solicitante)
                        </label>
                      )}
                      {!isTecnico && <div />}
                      <button
                        onClick={handleComentario}
                        disabled={submitting || !novoComentario.trim()}
                        style={{ ...btnPrimary, opacity: submitting || !novoComentario.trim() ? 0.6 : 1 }}
                      >
                        {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <MessageSquare size={14} />}
                        Comentar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Anexos Tab ── */}
            {activeTab === 'anexos' && (
              <div>
                {/* File list */}
                <div style={{ background: CARD, borderRadius: 10, border: '1px solid #E5E7EB', marginBottom: 12, overflow: 'hidden' }}>
                  {anexos.length === 0 ? (
                    <p style={{ color: '#6B7280', textAlign: 'center', padding: '32px 0' }}>Nenhum anexo ainda.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                          {['Arquivo', 'Categoria', 'Tamanho', 'Enviado por', 'Data', ''].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {anexos.map((a: any) => (
                          <tr key={a.id} style={{ borderTop: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '10px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: BLUE }}>{fileIcon(a.mime_type)}</span>
                                <span style={{ fontSize: '0.875rem', color: '#111827' }}>{a.nome_original}</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 20, background: '#F3F4F6', color: '#374151', fontSize: '0.75rem', fontWeight: 500 }}>
                                {a.categoria ?? 'outro'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 16px', fontSize: '0.8rem', color: '#6B7280' }}>{fmtFileSize(a.tamanho_bytes)}</td>
                            <td style={{ padding: '10px 16px', fontSize: '0.8rem', color: '#6B7280' }}>{a.enviado_por ?? '—'}</td>
                            <td style={{ padding: '10px 16px', fontSize: '0.8rem', color: '#6B7280' }}>{fmtDateShort(a.created_at)}</td>
                            <td style={{ padding: '10px 16px' }}>
                              <button
                                onClick={() => handleDownload(a.storage_path, a.nome_original)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: BLUE, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 500 }}
                              >
                                <Download size={14} /> Baixar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Upload form */}
                {!isTerminal && (
                  <div style={{ background: CARD, borderRadius: 10, border: '1px solid #E5E7EB', padding: '16px 20px' }}>
                    <h3 style={{ margin: '0 0 12px', fontWeight: 700, color: NAVY, fontSize: '0.875rem' }}>Adicionar Anexo</h3>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: '2px dashed #D1D5DB', borderRadius: 8, padding: '24px',
                        textAlign: 'center', cursor: 'pointer',
                        background: uploadFiles.length ? '#F0F9FF' : '#FAFAFA',
                        marginBottom: 12,
                      }}
                    >
                      <Upload size={24} style={{ color: '#9CA3AF', marginBottom: 8 }} />
                      <p style={{ margin: 0, color: '#6B7280', fontSize: '0.875rem' }}>
                        {uploadFiles.length ? `${uploadFiles.length} arquivo(s) selecionado(s)` : 'Clique para selecionar arquivos (máx. 20MB)'}
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={e => setUploadFiles(Array.from(e.target.files ?? []))}
                      />
                    </div>
                    {uploadFiles.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        {uploadFiles.map((f, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.8rem', color: '#374151' }}>
                            <span>{f.name}</span>
                            <span style={{ color: '#6B7280' }}>{fmtFileSize(f.size)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      {uploadFiles.length > 0 && (
                        <button onClick={() => setUploadFiles([])} style={btnSecondary}>
                          <Trash2 size={14} /> Limpar
                        </button>
                      )}
                      <button
                        onClick={handleUpload}
                        disabled={submitting || !uploadFiles.length}
                        style={{ ...btnPrimary, opacity: submitting || !uploadFiles.length ? 0.6 : 1 }}
                      >
                        {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                        Enviar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right: Info Sidebar ── */}
          <div style={{ width: 280, flexShrink: 0 }}>

            <Card title="Solicitante" icon={<User size={14} />}>
              <InfoRow label="Nome"    value={chamado.solicitante_nome} />
              <InfoRow label="E-mail"  value={<a href={`mailto:${chamado.solicitante_email}`} style={{ color: BLUE }}>{chamado.solicitante_email}</a>} />
              <InfoRow label="Setor"   value={chamado.solicitante_setor} />
              {chamado.solicitante_unidade && <InfoRow label="Unidade" value={chamado.solicitante_unidade} />}
              {chamado.solicitante_ramal  && <InfoRow label="Ramal"   value={chamado.solicitante_ramal} />}
            </Card>

            <Card title="Classificação" icon={<Tag size={14} />}>
              <InfoRow label="Categoria"    value={chamado.categoria?.nome} />
              <InfoRow label="Subcategoria" value={chamado.subcategoria?.nome} />
              <InfoRow label="Tipo"         value={TIPO_LABELS[chamado.tipo as keyof typeof TIPO_LABELS] ?? chamado.tipo} />
              <InfoRow label="Origem"       value={ORIGEM_LABELS[chamado.origem as keyof typeof ORIGEM_LABELS] ?? chamado.origem} />
              {chamado.tags?.length > 0 && (
                <InfoRow label="Tags" value={
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                    {chamado.tags.map((t: string) => (
                      <span key={t} style={{ padding: '2px 6px', background: '#F3F4F6', borderRadius: 4, fontSize: '0.75rem' }}>{t}</span>
                    ))}
                  </div>
                } />
              )}
            </Card>

            <Card title="Atribuição" icon={<UserPlus size={14} />}>
              <InfoRow label="Equipe"   value={chamado.equipe?.nome} />
              <InfoRow label="Técnico"  value={chamado.tecnico?.nome} />
              <InfoRow label="Nível"    value={`N${chamado.nivel_suporte}`} />
              {chamado.escalado_em && <InfoRow label="Escalado em" value={fmtDate(chamado.escalado_em)} />}
            </Card>

            <Card title="SLA" icon={<Clock size={14} />}>
              <InfoRow label="Prazo"     value={fmtDate(chamado.sla_prazo)} />
              <InfoRow label="Violado"   value={chamado.sla_violado ? <span style={{ color: '#DC2626', fontWeight: 600 }}>Sim</span> : <span style={{ color: '#16A34A' }}>Não</span>} />
              {chamado.sla_violado_em && <InfoRow label="Violado em" value={fmtDate(chamado.sla_violado_em)} />}
              {chamado.sla_horas_pausadas > 0 && <InfoRow label="Horas pausadas" value={`${chamado.sla_horas_pausadas}h`} />}
            </Card>

            <Card title="Datas" icon={<Clock size={14} />}>
              <InfoRow label="Criado em"     value={fmtDate(chamado.created_at)} />
              <InfoRow label="Atualizado em" value={fmtDate(chamado.updated_at)} />
              {chamado.fechado_em && <InfoRow label="Fechado em" value={fmtDate(chamado.fechado_em)} />}
              {chamado.fechado_por && <InfoRow label="Fechado por" value={chamado.fechado_por} />}
            </Card>

            {chamado.satisfacao_nota && (
              <Card title="Satisfação" icon={<CheckCircle size={14} />}>
                <InfoRow label="Nota" value={
                  <span style={{ fontSize: '1.2rem' }}>
                    {'★'.repeat(chamado.satisfacao_nota)}{'☆'.repeat(5 - chamado.satisfacao_nota)}
                  </span>
                } />
                {chamado.satisfacao_comentario && <InfoRow label="Comentário" value={chamado.satisfacao_comentario} />}
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          MODAIS
      ══════════════════════════════════════════════════════ */}

      {/* ── Status Transition Modal ── */}
      {statusModal && (
        <Modal title="Alterar Status do Chamado" onClose={() => setStatusModal(false)}>
          <Field label="Novo status" required>
            <select
              value={novoStatus}
              onChange={e => setNovoStatus(e.target.value as TiStatus)}
              style={selectStyle}
            >
              <option value="">Selecione...</option>
              {proximosStatus.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </Field>

          {novoStatus && statusValidation?.requiresSolucao && (
            <>
              <Field label="Solução aplicada" required>
                <textarea
                  value={solucao}
                  onChange={e => setSolucao(e.target.value)}
                  placeholder="Descreva detalhadamente a solução..."
                  style={textareaStyle}
                />
              </Field>
              <Field label="Causa raiz">
                <textarea
                  value={causaRaiz}
                  onChange={e => setCausaRaiz(e.target.value)}
                  placeholder="Qual foi a causa raiz do problema?"
                  style={textareaStyle}
                />
              </Field>
            </>
          )}

          {novoStatus === 'cancelado' && (
            <Field label="Motivo do cancelamento" required>
              <textarea
                value={motivoCancelamento}
                onChange={e => setMotivoCancelamento(e.target.value)}
                placeholder="Por que está sendo cancelado?"
                style={textareaStyle}
              />
            </Field>
          )}

          {novoStatus && statusValidation?.requiresJustificativa && (
            <Field label="Justificativa" required>
              <textarea
                value={justificativa}
                onChange={e => setJustificativa(e.target.value)}
                placeholder="Justifique esta transição..."
                style={textareaStyle}
              />
            </Field>
          )}

          {novoStatus && !statusValidation?.requiresSolucao && !statusValidation?.requiresJustificativa && novoStatus !== 'cancelado' && (
            <Field label="Observação (opcional)">
              <textarea
                value={justificativa}
                onChange={e => setJustificativa(e.target.value)}
                placeholder="Observação adicional..."
                style={textareaStyle}
              />
            </Field>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={() => setStatusModal(false)} style={btnSecondary}>Cancelar</button>
            <button
              onClick={handleTransicionar}
              disabled={submitting || !novoStatus}
              style={{ ...btnPrimary, opacity: submitting || !novoStatus ? 0.6 : 1 }}
            >
              {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
              Confirmar
            </button>
          </div>
        </Modal>
      )}

      {/* ── Atribuir Modal ── */}
      {atribuirModal && (
        <Modal title="Atribuir Chamado" onClose={() => setAtribuirModal(false)}>
          <Field label="Equipe">
            <select value={selectedEquipe} onChange={e => { setSelectedEquipe(e.target.value); setSelectedTecnico('') }} style={selectStyle}>
              <option value="">Sem equipe</option>
              {equipes.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
            </select>
          </Field>

          <Field label="Técnico">
            <select value={selectedTecnico} onChange={e => setSelectedTecnico(e.target.value)} style={selectStyle}>
              <option value="">Sem técnico</option>
              {tecnicosDisponiveis.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </Field>

          {chamado.tecnico && (
            <p style={{ fontSize: '0.8rem', color: '#6B7280', marginTop: -8 }}>
              Técnico atual: <strong>{chamado.tecnico.nome}</strong>
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={() => setAtribuirModal(false)} style={btnSecondary}>Cancelar</button>
            <button
              onClick={handleAtribuir}
              disabled={submitting}
              style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={14} />}
              Atribuir
            </button>
          </div>
        </Modal>
      )}

      {/* ── Escalar Modal ── */}
      {escalarModal && (
        <Modal title="Escalar Chamado" onClose={() => setEscalarModal(false)}>
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#92400E' }}>
              O chamado será escalado e o status mudará para <strong>Escalado</strong>. O técnico atual será removido.
            </p>
          </div>

          <Field label="Nível de destino" required>
            <select value={nivelDestino} onChange={e => setNivelDestino(Number(e.target.value) as TiNivelSuporte)} style={selectStyle}>
              <option value={2}>N2 — Suporte Avançado</option>
              <option value={3}>N3 — Especialista / Fornecedor</option>
            </select>
          </Field>

          <Field label="Equipe de destino">
            <select value={equipeDestino} onChange={e => setEquipeDestino(e.target.value)} style={selectStyle}>
              <option value="">Sem equipe específica</option>
              {equipes.filter((e: any) => e.nivel >= nivelDestino).map((eq: any) => (
                <option key={eq.id} value={eq.id}>{eq.nome} (N{eq.nivel})</option>
              ))}
            </select>
          </Field>

          <Field label="Justificativa" required>
            <textarea
              value={justificativaEscalar}
              onChange={e => setJustificativaEscalar(e.target.value)}
              placeholder="Por que está sendo escalado?"
              style={textareaStyle}
            />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={() => setEscalarModal(false)} style={btnSecondary}>Cancelar</button>
            <button
              onClick={handleEscalar}
              disabled={submitting || !justificativaEscalar.trim()}
              style={{ ...btnPrimary, background: '#EA580C', opacity: submitting || !justificativaEscalar.trim() ? 0.6 : 1 }}
            >
              {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <TrendingUp size={14} />}
              Escalar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
