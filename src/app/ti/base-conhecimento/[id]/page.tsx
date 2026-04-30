'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import {
  ArrowLeft, Eye, ThumbsUp, ThumbsDown, Tag, Clock,
  BookOpen, Loader2, AlertTriangle,
} from 'lucide-react'
import {
  buscarArtigoKbPorIdAction,
  registrarFeedbackKbAction,
  checkTiUserAccess,
} from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

// ─── Markdown renderer (sem biblioteca externa) ───────────────
function renderMarkdown(raw: string): string {
  // 1. Escapa HTML para prevenir XSS
  let s = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  // 2. Protege blocos de código (evita transformações internas)
  const codeBlocks: string[] = []
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, (_: string, code: string) => {
    const idx = codeBlocks.length
    codeBlocks.push(
      `<pre style="background:#1E293B;color:#E2E8F0;padding:16px;border-radius:8px;overflow-x:auto;font-size:0.85rem;line-height:1.6;margin:16px 0"><code>${code.trim()}</code></pre>`
    )
    return `@@CODE${idx}@@`
  })

  // 3. Código inline
  s = s.replace(/`([^`]+)`/g, '<code style="background:#F3F4F6;padding:2px 6px;border-radius:4px;font-size:0.88em;color:#DC2626;font-family:monospace">$1</code>')

  // 4. Headers
  s = s.replace(/^### (.+)$/gm, '<h3 style="font-size:1.05rem;font-weight:700;color:#1E3A5F;margin:20px 0 6px">$1</h3>')
  s = s.replace(/^## (.+)$/gm, '<h2 style="font-size:1.2rem;font-weight:700;color:#1E3A5F;margin:28px 0 8px;padding-bottom:6px;border-bottom:2px solid #E5E7EB">$1</h2>')
  s = s.replace(/^# (.+)$/gm,  '<h1 style="font-size:1.5rem;font-weight:700;color:#1E3A5F;margin:32px 0 10px">$1</h1>')

  // 5. Bold + Italic
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // 6. Blockquote (nota: > foi escapado como &gt; acima)
  s = s.replace(/^&gt; (.+)$/gm, '<blockquote style="border-left:4px solid #2563EB;margin:12px 0;padding:10px 16px;background:#EFF6FF;color:#1E40AF;border-radius:0 8px 8px 0;font-style:italic">$1</blockquote>')

  // 7. Separador horizontal
  s = s.replace(/^---$/gm, '<hr style="border:none;border-top:2px solid #E5E7EB;margin:24px 0">')

  // 8. Listas não-ordenadas
  s = s.replace(/^[-*] (.+)$/gm, '<li style="margin:5px 0;color:#374151">$1</li>')
  s = s.replace(/(<li[^>]*>.*?<\/li>\n?)+/gs, (m: string) =>
    `<ul style="padding-left:24px;margin:12px 0;list-style:disc">${m}</ul>`
  )

  // 9. Listas ordenadas
  s = s.replace(/^\d+\. (.+)$/gm, '<li style="margin:5px 0;color:#374151">$1</li>')

  // 10. Parágrafos (linhas simples entre blocos)
  const lines = s.split('\n')
  const result: string[] = []
  for (const line of lines) {
    if (line.startsWith('@@CODE') || line.startsWith('<h') || line.startsWith('<ul') ||
        line.startsWith('<li') || line.startsWith('<blockquote') || line.startsWith('<hr')) {
      result.push(line)
    } else if (line.trim() === '') {
      result.push('')
    } else {
      result.push(`<p style="margin:0 0 12px;line-height:1.75;color:#374151">${line}</p>`)
    }
  }
  s = result.join('\n')

  // 11. Restaura blocos de código
  codeBlocks.forEach((block, idx) => { s = s.replace(`@@CODE${idx}@@`, block) })

  return s
}

// ─── Helpers ──────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ─── Page ─────────────────────────────────────────────────────
export default function ArtigoKbPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()
  const { accounts } = useMsal()

  const [authReady,  setAuthReady]  = useState(false)
  const [artigo,     setArtigo]     = useState<any>(null)
  const [loading,    setLoading]    = useState(true)
  const [dataError,  setDataError]  = useState<string | null>(null)
  const [feedback,   setFeedback]   = useState<'sim' | 'nao' | null>(null)
  const [utilSim,    setUtilSim]    = useState(0)
  const [utilNao,    setUtilNao]    = useState(0)

  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted) { router.push('/ti'); return }
      setAuthReady(true)
    })
  }, [accounts, router])

  useEffect(() => {
    if (!authReady) return
    buscarArtigoKbPorIdAction(id).then(r => {
      if (r.success && r.artigo) {
        setArtigo(r.artigo)
        setUtilSim(r.artigo.util_sim ?? 0)
        setUtilNao(r.artigo.util_nao ?? 0)
      } else {
        setDataError(r.error || 'Artigo não encontrado.')
      }
      setLoading(false)
    })
  }, [authReady, id])

  async function handleFeedback(tipo: 'sim' | 'nao') {
    if (feedback) return
    setFeedback(tipo)
    if (tipo === 'sim') setUtilSim(n => n + 1)
    else setUtilNao(n => n + 1)
    await registrarFeedbackKbAction(id, tipo)
  }

  if (!authReady || loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
      <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (dataError || !artigo) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
      <div style={{ textAlign: 'center' }}>
        <AlertTriangle size={32} style={{ color: '#DC2626', marginBottom: 12 }} />
        <p style={{ color: '#DC2626', fontWeight: 600 }}>{dataError || 'Artigo não encontrado.'}</p>
        <Link href="/ti/base-conhecimento" style={{ color: BLUE, display: 'inline-block', marginTop: 8 }}>← Voltar à Base de Conhecimento</Link>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const totalVotos = utilSim + utilNao
  const pctUtil    = totalVotos > 0 ? Math.round((utilSim / totalVotos) * 100) : null

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui, sans-serif' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px' }}>

        {/* Back link */}
        <Link
          href="/ti/base-conhecimento"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6B7280', textDecoration: 'none', fontSize: '0.85rem', marginBottom: 16, fontWeight: 500 }}
        >
          <ArrowLeft size={14} /> Base de Conhecimento
        </Link>

        {/* Article card */}
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>

          {/* Article header */}
          <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid #F3F4F6' }}>
            {/* Category + meta row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              {artigo.categoria && (
                <span style={{ padding: '3px 10px', borderRadius: 20, background: '#EFF6FF', color: BLUE, fontSize: '0.75rem', fontWeight: 600 }}>
                  {artigo.categoria.nome}
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#9CA3AF' }}>
                <Clock size={12} /> {fmtDate(artigo.updated_at)}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#9CA3AF' }}>
                <Eye size={12} /> {artigo.visualizacoes ?? 0} visualizações
              </span>
              {pctUtil !== null && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#16A34A', fontWeight: 600 }}>
                  <ThumbsUp size={12} /> {pctUtil}% acharam útil
                </span>
              )}
            </div>

            <h1 style={{ margin: '0 0 12px', fontSize: '1.5rem', fontWeight: 800, color: NAVY, lineHeight: 1.3 }}>
              {artigo.titulo}
            </h1>

            {/* Tags */}
            {artigo.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {artigo.tags.map((t: string) => (
                  <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: '#F3F4F6', borderRadius: 20, fontSize: '0.75rem', color: '#374151', fontWeight: 500 }}>
                    <Tag size={10} /> {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Article content */}
          <div
            style={{ padding: '28px 32px', lineHeight: 1.75 }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(artigo.conteudo) }}
          />

          {/* Feedback section */}
          <div style={{ padding: '20px 32px', borderTop: '1px solid #F3F4F6', background: '#FAFAFA' }}>
            <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: '0.9rem', color: NAVY }}>
              Este artigo foi útil?
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={() => handleFeedback('sim')}
                disabled={!!feedback}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8, cursor: feedback ? 'default' : 'pointer',
                  border: `1px solid ${feedback === 'sim' ? '#16A34A' : '#D1D5DB'}`,
                  background: feedback === 'sim' ? '#F0FDF4' : 'white',
                  color: feedback === 'sim' ? '#16A34A' : '#374151',
                  fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s',
                  opacity: feedback && feedback !== 'sim' ? 0.5 : 1,
                }}
              >
                <ThumbsUp size={15} /> Sim {utilSim > 0 && `(${utilSim})`}
              </button>

              <button
                onClick={() => handleFeedback('nao')}
                disabled={!!feedback}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8, cursor: feedback ? 'default' : 'pointer',
                  border: `1px solid ${feedback === 'nao' ? '#DC2626' : '#D1D5DB'}`,
                  background: feedback === 'nao' ? '#FEF2F2' : 'white',
                  color: feedback === 'nao' ? '#DC2626' : '#374151',
                  fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s',
                  opacity: feedback && feedback !== 'nao' ? 0.5 : 1,
                }}
              >
                <ThumbsDown size={15} /> Não {utilNao > 0 && `(${utilNao})`}
              </button>

              {feedback && (
                <span style={{ fontSize: '0.85rem', color: '#6B7280', fontStyle: 'italic' }}>
                  {feedback === 'sim' ? 'Ótimo! Agradecemos o feedback.' : 'Obrigado. Vamos melhorar.'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Back link bottom */}
        <div style={{ marginTop: 24 }}>
          <Link
            href="/ti/base-conhecimento"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: BLUE, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}
          >
            <BookOpen size={14} /> Ver todos os artigos
          </Link>
        </div>
      </div>
    </div>
  )
}
