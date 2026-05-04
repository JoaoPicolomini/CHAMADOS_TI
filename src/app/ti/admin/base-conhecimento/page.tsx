'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import {
  Plus, Pencil, Trash2, Eye, EyeOff, BookOpen, Loader2,
  LayoutDashboard, ThumbsUp, ExternalLink, Tag, Check,
} from 'lucide-react'
import {
  buscarArtigosKbAction,
  salvarArtigoKbAction,
  excluirArtigoKbAction,
  buscarCategoriasAction,
  checkTiUserAccess,
} from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type FormData = {
  titulo: string
  conteudo: string
  categoria_id: string
  tags: string          // comma-separated
  publicado: boolean
}

const DEFAULT_FORM: FormData = {
  titulo:       '',
  conteudo:     '',
  categoria_id: '',
  tags:         '',
  publicado:    false,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB',
  borderRadius: 7, fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none',
}
const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical', minHeight: 300, fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.6',
}

export default function AdminBaseConhecimentoPage() {
  const router = useRouter()
  const { accounts } = useMsal()

  const [authReady,    setAuthReady]    = useState(false)
  const [userEmail,    setUserEmail]    = useState('')
  const [artigos,      setArtigos]      = useState<any[]>([])
  const [categorias,   setCategorias]   = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showAll,      setShowAll]      = useState(true)

  // Modal / editor
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editId,       setEditId]       = useState<string | null>(null)
  const [form,         setForm]         = useState<FormData>(DEFAULT_FORM)
  const [preview,      setPreview]      = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)

  // Auth — kb.manage ou admin
  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    setUserEmail(account.username)
    checkTiUserAccess(account.username).then(r => {
      const allowed = r.granted && (
        ['admin', 'gestor_ti'].includes(r.perfil ?? '') ||
        r.permissions.includes('kb.manage')
      )
      if (!allowed) { router.push('/ti/base-conhecimento'); return }
      setAuthReady(true)
    })
  }, [accounts, router])

  const carregar = useCallback(async () => {
    setLoading(true)
    const [artRes, catRes] = await Promise.all([
      buscarArtigosKbAction({ pageSize: 100, somente_publicados: false }),
      buscarCategoriasAction(),
    ])
    if (artRes.success) setArtigos(artRes.artigos)
    if (catRes.success) setCategorias(catRes.categorias.filter((c: any) => !c.categoria_pai))
    setLoading(false)
  }, [])

  useEffect(() => { if (authReady) carregar() }, [authReady, carregar])

  function openCreate() {
    setEditId(null)
    setForm(DEFAULT_FORM)
    setPreview(false)
    setModalOpen(true)
  }

  function openEdit(a: any) {
    setEditId(a.id)
    setForm({
      titulo:       a.titulo,
      conteudo:     a.conteudo,
      categoria_id: a.categoria_id ?? '',
      tags:         (a.tags ?? []).join(', '),
      publicado:    a.publicado,
    })
    setPreview(false)
    setModalOpen(true)
  }

  async function handleSalvar(publicar?: boolean) {
    if (!form.titulo.trim() || !form.conteudo.trim()) {
      alert('Título e conteúdo são obrigatórios.')
      return
    }
    const payload = {
      id:           editId ?? undefined,
      titulo:       form.titulo.trim(),
      conteudo:     form.conteudo.trim(),
      categoria_id: form.categoria_id || null,
      tags:         form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
      publicado:    publicar !== undefined ? publicar : form.publicado,
      autor_email:  userEmail,
    }
    setSubmitting(true)
    const result = await salvarArtigoKbAction(payload)
    setSubmitting(false)
    if (result.success) {
      setModalOpen(false)
      await carregar()
    } else {
      alert(result.error)
    }
  }

  async function handleTogglePublicado(a: any) {
    await salvarArtigoKbAction({
      id:           a.id,
      titulo:       a.titulo,
      conteudo:     a.conteudo,
      categoria_id: a.categoria_id,
      tags:         a.tags,
      publicado:    !a.publicado,
      autor_email:  userEmail,
    })
    await carregar()
  }

  async function handleExcluir(id: string) {
    if (!confirm('Excluir este artigo permanentemente?')) return
    setDeletingId(id)
    await excluirArtigoKbAction(id)
    setDeletingId(null)
    await carregar()
  }

  const set = (field: keyof FormData, value: any) => setForm(p => ({ ...p, [field]: value }))

  const artigosFiltrados = showAll ? artigos : artigos.filter(a => !a.publicado)

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
              <Link href="/ti/base-conhecimento" style={{ color: '#6B7280', textDecoration: 'none' }}>Base de Conhecimento</Link>
              <span>›</span>
              <span>Admin</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: NAVY }}>Gerenciar Artigos</h1>
            <p style={{ margin: '2px 0 0', color: '#6B7280', fontSize: '0.85rem' }}>
              {artigos.length} artigo{artigos.length !== 1 ? 's' : ''} · {artigos.filter(a => a.publicado).length} publicado{artigos.filter(a => a.publicado).length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/ti/base-conhecimento" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'white', border: '1px solid #D1D5DB', borderRadius: 7, textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', color: '#374151' }}>
              <ExternalLink size={13} /> Ver KB
            </Link>
            <button
              onClick={openCreate}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: BLUE, color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              <Plus size={15} /> Novo Artigo
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {[{ label: 'Todos', val: true }, { label: 'Rascunhos', val: false }].map(opt => (
            <button
              key={String(opt.val)}
              onClick={() => setShowAll(opt.val)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${showAll === opt.val ? BLUE : '#D1D5DB'}`, background: showAll === opt.val ? BLUE : 'white', color: showAll === opt.val ? 'white' : '#374151', cursor: 'pointer', fontSize: '0.8rem', fontWeight: showAll === opt.val ? 700 : 400 }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
              <Loader2 size={24} style={{ color: BLUE, animation: 'spin 1s linear infinite', marginBottom: 8 }} />
              <p style={{ margin: 0 }}>Carregando...</p>
            </div>
          ) : artigosFiltrados.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#6B7280' }}>
              <BookOpen size={28} style={{ marginBottom: 8 }} />
              <p style={{ margin: 0 }}>Nenhum artigo encontrado. Crie o primeiro!</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Título', 'Categoria', 'Tags', 'Visualizações', 'Utilidade', 'Status', 'Atualizado', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {artigosFiltrados.map((a: any) => {
                  const totalVotos = (a.util_sim ?? 0) + (a.util_nao ?? 0)
                  const pct = totalVotos > 0 ? Math.round(((a.util_sim ?? 0) / totalVotos) * 100) : null
                  return (
                    <tr key={a.id} style={{ borderTop: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '12px 14px', maxWidth: 280 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.titulo}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {a.categoria ? (
                          <span style={{ padding: '2px 8px', borderRadius: 20, background: '#EFF6FF', color: BLUE, fontSize: '0.72rem', fontWeight: 600 }}>{a.categoria.nome}</span>
                        ) : <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', maxWidth: 150 }}>
                        {a.tags?.length > 0 ? (
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            {a.tags.slice(0, 2).map((t: string) => (
                              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '1px 6px', background: '#F3F4F6', borderRadius: 20, fontSize: '0.7rem', color: '#374151' }}>
                                <Tag size={8} />{t}
                              </span>
                            ))}
                            {a.tags.length > 2 && <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>+{a.tags.length - 2}</span>}
                          </div>
                        ) : <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.85rem', color: '#374151', textAlign: 'center' }}>
                        {a.visualizacoes ?? 0}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {pct !== null ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: pct >= 70 ? '#16A34A' : '#6B7280', fontWeight: 600 }}>
                            <ThumbsUp size={12} /> {pct}% <span style={{ fontWeight: 400, color: '#9CA3AF', fontSize: '0.7rem' }}>({totalVotos})</span>
                          </span>
                        ) : <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: a.publicado ? '#F0FDF4' : '#FEF9C3', color: a.publicado ? '#16A34A' : '#92400E', border: `1px solid ${a.publicado ? '#BBF7D0' : '#FDE68A'}` }}>
                          {a.publicado ? <><Eye size={10} /> Publicado</> : <><EyeOff size={10} /> Rascunho</>}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.75rem', color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtDate(a.updated_at)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button
                            onClick={() => openEdit(a)}
                            style={{ background: 'none', border: '1px solid #D1D5DB', borderRadius: 5, cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: '#374151', fontWeight: 500 }}
                          >
                            <Pencil size={11} /> Editar
                          </button>
                          <button
                            onClick={() => handleTogglePublicado(a)}
                            style={{ background: 'none', border: `1px solid ${a.publicado ? '#FCA5A5' : '#BBF7D0'}`, borderRadius: 5, cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: a.publicado ? '#DC2626' : '#16A34A', fontWeight: 500 }}
                          >
                            {a.publicado ? <><EyeOff size={11} /> Retirar</> : <><Eye size={11} /> Publicar</>}
                          </button>
                          <button
                            onClick={() => handleExcluir(a.id)}
                            disabled={deletingId === a.id}
                            style={{ background: 'none', border: '1px solid #FCA5A5', borderRadius: 5, cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: '#DC2626', fontWeight: 500 }}
                          >
                            {deletingId === a.id ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={11} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Editor Modal ── */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: '16px', overflowY: 'auto' }}>
          <div style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 860, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', marginTop: 16, marginBottom: 16 }}>

            {/* Modal header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontWeight: 700, color: NAVY, fontSize: '1rem' }}>
                {editId ? 'Editar Artigo' : 'Novo Artigo'}
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setPreview(p => !p)}
                  style={{ padding: '6px 12px', background: preview ? NAVY : 'white', color: preview ? 'white' : '#374151', border: '1px solid #D1D5DB', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  {preview ? 'Editar' : 'Preview'}
                </button>
                <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
              </div>
            </div>

            <div style={{ padding: 20 }}>
              {!preview ? (
                /* ── Edit mode ── */
                <>
                  {/* Título */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', marginBottom: 5, fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
                      Título <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={form.titulo}
                      onChange={e => set('titulo', e.target.value)}
                      placeholder="Título do artigo..."
                      style={inputStyle}
                    />
                  </div>

                  {/* Categoria + Tags row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 5, fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Categoria</label>
                      <select value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)} style={{ ...inputStyle, background: 'white' }}>
                        <option value="">— Sem categoria —</option>
                        {categorias.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 5, fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
                        Tags <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(separadas por vírgula)</span>
                      </label>
                      <input
                        type="text"
                        value={form.tags}
                        onChange={e => set('tags', e.target.value)}
                        placeholder="vpn, acesso remoto, rede..."
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
                        Conteúdo (Markdown) <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                        Suporte: # ## ### **bold** *italic* `code` ```bloco``` - lista &gt; quote ---
                      </span>
                    </div>
                    <textarea
                      value={form.conteudo}
                      onChange={e => set('conteudo', e.target.value)}
                      placeholder={'# Título do Artigo\n\n## Descrição\n\nDescreva o problema ou tópico...\n\n## Solução\n\n1. Passo um\n2. Passo dois\n\n```\ncódigo de exemplo\n```'}
                      style={textareaStyle}
                    />
                  </div>
                </>
              ) : (
                /* ── Preview mode ── */
                <div>
                  <h1 style={{ margin: '0 0 12px', fontSize: '1.4rem', fontWeight: 800, color: NAVY }}>{form.titulo || '(sem título)'}</h1>
                  {form.tags && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                      {form.tags.split(',').filter(Boolean).map(t => (
                        <span key={t} style={{ padding: '2px 8px', background: '#F3F4F6', borderRadius: 20, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Tag size={10} />{t.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  <div
                    style={{ padding: '16px', background: '#FAFAFA', borderRadius: 8, border: '1px solid #E5E7EB', minHeight: 200 }}
                    dangerouslySetInnerHTML={{ __html: form.conteudo ? renderMarkdown(form.conteudo) : '<p style="color:#9CA3AF">Nenhum conteúdo ainda...</p>' }}
                  />
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={form.publicado}
                    onChange={e => set('publicado', e.target.checked)}
                  />
                  Publicar imediatamente
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setModalOpen(false)}
                    style={{ padding: '8px 16px', background: 'white', border: '1px solid #D1D5DB', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleSalvar(false)}
                    disabled={submitting}
                    style={{ padding: '8px 16px', background: '#F9FAFB', border: '1px solid #D1D5DB', color: '#374151', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', opacity: submitting ? 0.7 : 1 }}
                  >
                    Salvar Rascunho
                  </button>
                  <button
                    onClick={() => handleSalvar(true)}
                    disabled={submitting}
                    style={{ padding: '8px 16px', background: BLUE, color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, opacity: submitting ? 0.7 : 1 }}
                  >
                    {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                    Publicar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Inline markdown renderer (shared with detail page logic)
function renderMarkdown(raw: string): string {
  let s = raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const codeBlocks: string[] = []
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, (_: string, code: string) => {
    const idx = codeBlocks.length
    codeBlocks.push(`<pre style="background:#1E293B;color:#E2E8F0;padding:14px;border-radius:8px;overflow-x:auto;font-size:0.82rem;line-height:1.5;margin:12px 0"><code>${code.trim()}</code></pre>`)
    return `@@CODE${idx}@@`
  })
  s = s.replace(/`([^`]+)`/g, '<code style="background:#F3F4F6;padding:2px 5px;border-radius:3px;font-size:0.88em;color:#DC2626">$1</code>')
  s = s.replace(/^### (.+)$/gm, '<h3 style="font-size:1rem;font-weight:700;color:#1E3A5F;margin:16px 0 6px">$1</h3>')
  s = s.replace(/^## (.+)$/gm, '<h2 style="font-size:1.15rem;font-weight:700;color:#1E3A5F;margin:20px 0 8px;border-bottom:1px solid #E5E7EB;padding-bottom:4px">$1</h2>')
  s = s.replace(/^# (.+)$/gm, '<h1 style="font-size:1.3rem;font-weight:700;color:#1E3A5F;margin:24px 0 10px">$1</h1>')
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
  s = s.replace(/^&gt; (.+)$/gm, '<blockquote style="border-left:3px solid #2563EB;padding:8px 14px;margin:10px 0;background:#EFF6FF;color:#1E40AF;border-radius:0 6px 6px 0">$1</blockquote>')
  s = s.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0">')
  s = s.replace(/^[-*] (.+)$/gm, '<li style="margin:4px 0">$1</li>')
  s = s.replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g, (m: string) => `<ul style="padding-left:20px;margin:10px 0">${m}</ul>`)
  const lines = s.split('\n')
  const result: string[] = []
  for (const line of lines) {
    if (line.startsWith('@@CODE') || line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('<li') || line.startsWith('<blockquote') || line.startsWith('<hr')) {
      result.push(line)
    } else if (line.trim() === '') {
      result.push('')
    } else {
      result.push(`<p style="margin:0 0 10px;line-height:1.7;color:#374151">${line}</p>`)
    }
  }
  s = result.join('\n')
  codeBlocks.forEach((block, idx) => { s = s.replace(`@@CODE${idx}@@`, block) })
  return s
}
