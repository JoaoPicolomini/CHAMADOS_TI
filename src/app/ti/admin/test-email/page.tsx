'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import { Loader2, Send, CheckCircle2, XCircle, FlaskConical, ArrowLeft, Search, Database } from 'lucide-react'
import Link from 'next/link'
import { checkTiUserAccess } from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

const TEMPLATES = [
  { id: 'chamado_aberto',     label: 'Chamado Aberto',      desc: 'Confirmação enviada ao solicitante ao abrir chamado' },
  { id: 'chamado_atribuido',  label: 'Chamado Atribuído',   desc: 'Notificação enviada ao técnico quando chamado é atribuído' },
  { id: 'status_alterado',    label: 'Status Alterado',     desc: 'Notificação ao solicitante quando status muda' },
  { id: 'novo_comentario',    label: 'Novo Comentário',     desc: 'Notificação ao solicitante quando técnico comenta' },
  { id: 'alerta_sla',         label: 'Alerta de SLA (85%)', desc: 'Alerta enviado ao técnico quando SLA está em risco' },
  { id: 'lembrete_pendencia', label: 'Lembrete de Pendência', desc: 'Lembrete ao solicitante após 4 dias aguardando resposta' },
]

type TestResult = {
  template: string
  success: boolean
  subject?: string
  error?: string
}

type ChamadoPreview = {
  id: string
  numero: number
  titulo: string
  status: string
  prioridade: string
  solicitante_nome: string
  solicitante_email: string
  tecnico_nome: string | null
}

const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto', em_atendimento: 'Em atendimento', pendente_usuario: 'Pendente usuário',
  resolvido: 'Resolvido', fechado: 'Fechado', escalado: 'Escalado', reaberto: 'Reaberto',
}

export default function TestEmailPage() {
  const router       = useRouter()
  const { accounts } = useMsal()

  const [authReady, setAuthReady]           = useState(false)
  const [to, setTo]                         = useState('')
  const [sending, setSending]               = useState<string | null>(null)
  const [results, setResults]               = useState<TestResult[]>([])

  const [numeroBusca, setNumeroBusca]       = useState('')
  const [buscando, setBuscando]             = useState(false)
  const [chamado, setChamado]               = useState<ChamadoPreview | null>(null)
  const [erroBusca, setErroBusca]           = useState('')

  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted || !['admin', 'gestor_ti'].includes(r.perfil ?? '')) {
        router.push('/ti/dashboard')
        return
      }
      setTo(account.username)
      setAuthReady(true)
    })
  }, [accounts, router])

  async function buscarChamado() {
    if (!numeroBusca) return
    setBuscando(true)
    setErroBusca('')
    setChamado(null)

    try {
      const res = await fetch(`/api/ti/test-email?numero=${numeroBusca}`)
      const data = await res.json()
      if (!res.ok) {
        setErroBusca(data.error ?? 'Chamado não encontrado')
      } else {
        setChamado(data)
        setResults([])
      }
    } catch {
      setErroBusca('Erro ao buscar chamado')
    } finally {
      setBuscando(false)
    }
  }

  async function dispararTeste(templateId: string) {
    if (!to) return
    setSending(templateId)

    try {
      const res = await fetch('/api/ti/test-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: templateId, to, chamado_id: chamado?.id }),
      })
      const data = await res.json()

      setResults(prev => [
        { template: templateId, success: data.success, subject: data.subject, error: data.error },
        ...prev.filter(r => r.template !== templateId),
      ])
    } catch (err: any) {
      setResults(prev => [
        { template: templateId, success: false, error: err.message },
        ...prev.filter(r => r.template !== templateId),
      ])
    } finally {
      setSending(null)
    }
  }

  async function dispararTodos() {
    for (const t of TEMPLATES) {
      await dispararTeste(t.id)
    }
  }

  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
        <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/ti/admin" style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 14 }}>
          <ArrowLeft size={16} /> Admin
        </Link>
        <div style={{ width: 1, height: 20, background: '#E5E7EB' }} />
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlaskConical size={22} style={{ color: BLUE }} />
          Teste de E-mail
        </h1>
      </div>

      <div style={{ maxWidth: 760, margin: '32px auto', padding: '0 24px' }}>

        {/* Alerta informativo */}
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#1E40AF' }}>
          Os e-mails são enviados via <strong>n8n</strong> e chegam de verdade. Use seu próprio e-mail como destinatário.
        </div>

        {/* Destinatário */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 24, marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Destinatário para teste
          </label>
          <input
            type="email"
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="seu@email.com"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>

        {/* Chamado real */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '14px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={16} style={{ color: NAVY }} />
            <span style={{ fontWeight: 600, color: NAVY, fontSize: 15 }}>Dados do chamado</span>
          </div>

          <div style={{ padding: 24 }}>
            {/* Busca */}
            <div style={{ display: 'flex', gap: 8, marginBottom: chamado || erroBusca ? 16 : 0 }}>
              <input
                type="number"
                value={numeroBusca}
                onChange={e => setNumeroBusca(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarChamado()}
                placeholder="Nº do chamado"
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14 }}
              />
              <button
                onClick={buscarChamado}
                disabled={!numeroBusca || buscando}
                style={{
                  padding: '8px 16px', background: NAVY, color: '#fff', border: 'none',
                  borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: buscando ? 'wait' : 'pointer',
                  opacity: !numeroBusca ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {buscando ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
                Carregar
              </button>
            </div>

            {/* Erro */}
            {erroBusca && (
              <div style={{ fontSize: 13, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                <XCircle size={14} /> {erroBusca}
              </div>
            )}

            {/* Preview do chamado */}
            {chamado ? (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: BLUE, marginRight: 8 }}>#{chamado.numero}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{chamado.titulo}</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    background: '#DBEAFE', color: '#1E40AF', flexShrink: 0,
                  }}>
                    {STATUS_LABELS[chamado.status] ?? chamado.status}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', fontSize: 12, color: '#6B7280' }}>
                  <span><strong style={{ color: '#374151' }}>Solicitante:</strong> {chamado.solicitante_nome}</span>
                  <span><strong style={{ color: '#374151' }}>E-mail orig.:</strong> {chamado.solicitante_email}</span>
                  <span><strong style={{ color: '#374151' }}>Prioridade:</strong> {chamado.prioridade}</span>
                  <span><strong style={{ color: '#374151' }}>Técnico:</strong> {chamado.tecnico_nome ?? '—'}</span>
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: '#9CA3AF' }}>
                  O e-mail será enviado para <strong>{to}</strong> (seu e-mail de teste), não para o solicitante original.
                </div>
              </div>
            ) : !erroBusca && (
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>
                Sem chamado carregado — os templates usarão dados fictícios (Chamado #9999).
              </div>
            )}
          </div>
        </div>

        {/* Templates */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, color: NAVY, fontSize: 15 }}>Templates disponíveis</span>
            <button
              onClick={dispararTodos}
              disabled={!to || !!sending}
              style={{
                padding: '7px 16px', background: NAVY, color: '#fff', border: 'none',
                borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: !to || sending ? 'not-allowed' : 'pointer',
                opacity: !to || sending ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Send size={14} /> Enviar todos
            </button>
          </div>

          {TEMPLATES.map((t, i) => {
            const result  = results.find(r => r.template === t.id)
            const loading = sending === t.id

            return (
              <div
                key={t.id}
                style={{
                  padding: '14px 24px',
                  borderBottom: i < TEMPLATES.length - 1 ? '1px solid #F3F4F6' : 'none',
                  display: 'flex', alignItems: 'center', gap: 16,
                }}
              >
                <div style={{ width: 22, flexShrink: 0 }}>
                  {loading ? (
                    <Loader2 size={18} style={{ color: BLUE, animation: 'spin 1s linear infinite' }} />
                  ) : result?.success ? (
                    <CheckCircle2 size={18} style={{ color: '#059669' }} />
                  ) : result && !result.success ? (
                    <XCircle size={18} style={{ color: '#DC2626' }} />
                  ) : (
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #D1D5DB' }} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{t.desc}</div>
                  {result?.subject && (
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3, fontFamily: 'monospace' }}>
                      {result.subject}
                    </div>
                  )}
                  {result?.error && (
                    <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{result.error}</div>
                  )}
                </div>

                <button
                  onClick={() => dispararTeste(t.id)}
                  disabled={!to || !!sending}
                  style={{
                    padding: '6px 14px', background: BLUE, color: '#fff', border: 'none',
                    borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: !to || sending ? 'not-allowed' : 'pointer',
                    opacity: !to || sending ? 0.5 : 1, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Send size={12} /> Enviar
                </button>
              </div>
            )
          })}
        </div>

        <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', margin: 0 }}>
          {chamado
            ? `Usando dados reais do Chamado #${chamado.numero}. Nenhum dado é alterado.`
            : 'Sem chamado carregado — usando dados fictícios (Chamado #9999). Nenhum dado é alterado.'
          }
        </p>

      </div>
    </div>
  )
}
