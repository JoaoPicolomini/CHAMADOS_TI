'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import {
  Search, BookOpen, Eye, ThumbsUp, Tag, ChevronRight,
  Loader2, LayoutDashboard, X,
} from 'lucide-react'
import { buscarArtigosKbAction, buscarCategoriasAction, checkTiUserAccess } from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function excerpt(text: string, len = 160) {
  const plain = text.replace(/[#*`>_~\[\]]/g, '').replace(/\n+/g, ' ').trim()
  return plain.length > len ? plain.slice(0, len) + '…' : plain
}

function utilPct(sim: number, nao: number) {
  const total = sim + nao
  if (!total) return null
  return Math.round((sim / total) * 100)
}

export default function BaseConhecimentoPage() {
  const router = useRouter()
  const { accounts } = useMsal()

  const [authReady,    setAuthReady]    = useState(false)
  const [isAdmin,      setIsAdmin]      = useState(false)
  const [artigos,      setArtigos]      = useState<any[]>([])
  const [categorias,   setCategorias]   = useState<any[]>([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [totalPages,   setTotalPages]   = useState(1)
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [categoriaId,  setCategoriaId]  = useState('')

  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted) { router.push('/ti'); return }
      setIsAdmin(['admin', 'gestor_ti'].includes(r.perfil ?? ''))
      setAuthReady(true)
    })
  }, [accounts, router])

  const carregar = useCallback(async () => {
    setLoading(true)
    const [artigosRes, catsRes] = await Promise.all([
      buscarArtigosKbAction({ search: search || undefined, categoria_id: categoriaId || undefined, page, somente_publicados: true }),
      buscarCategoriasAction(),
    ])
    if (artigosRes.success) {
      setArtigos(artigosRes.artigos)
      setTotal(artigosRes.total)
      setTotalPages(artigosRes.totalPages)
    }
    if (catsRes.success) setCategorias(catsRes.categorias.filter((c: any) => !c.categoria_pai))
    setLoading(false)
  }, [search, categoriaId, page])

  useEffect(() => { if (authReady) carregar() }, [authReady, carregar])

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [search, categoriaId])

  function handleSearch() {
    setSearch(searchInput)
    setPage(1)
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

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.8rem', color: '#6B7280' }}>
              <Link href="/ti/dashboard" style={{ color: '#6B7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <LayoutDashboard size={13} /> Painel
              </Link>
              <span>›</span>
              <span>Base de Conhecimento</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={22} style={{ color: BLUE }} />
              Base de Conhecimento
            </h1>
            <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.85rem' }}>
              {total} artigo{total !== 1 ? 's' : ''} disponível{total !== 1 ? 'is' : ''}
            </p>
          </div>
          {isAdmin && (
            <Link href="/ti/admin/base-conhecimento" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: BLUE, color: 'white', borderRadius: 7, textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem' }}>
              Gerenciar Artigos
            </Link>
          )}
        </div>

        {/* Search bar */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Pesquisar artigos..."
                style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <button
              onClick={handleSearch}
              style={{ padding: '9px 18px', background: BLUE, color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
            >
              Buscar
            </button>
            {search && (
              <button
                onClick={() => { setSearchInput(''); setSearch('') }}
                style={{ padding: '9px 12px', background: 'white', border: '1px solid #D1D5DB', borderRadius: 7, cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}
              >
                <X size={14} /> Limpar
              </button>
            )}
          </div>

          {/* Category filter chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setCategoriaId('')}
              style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${!categoriaId ? BLUE : '#D1D5DB'}`, background: !categoriaId ? BLUE : 'white', color: !categoriaId ? 'white' : '#374151', cursor: 'pointer', fontSize: '0.8rem', fontWeight: !categoriaId ? 600 : 400 }}
            >
              Todas
            </button>
            {categorias.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setCategoriaId(categoriaId === c.id ? '' : c.id)}
                style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${categoriaId === c.id ? BLUE : '#D1D5DB'}`, background: categoriaId === c.id ? BLUE : 'white', color: categoriaId === c.id ? 'white' : '#374151', cursor: 'pointer', fontSize: '0.8rem', fontWeight: categoriaId === c.id ? 600 : 400 }}
              >
                {c.nome}
              </button>
            ))}
          </div>
        </div>

        {/* Articles grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>
            <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <p style={{ margin: 0 }}>Carregando artigos...</p>
          </div>
        ) : artigos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, background: 'white', borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <BookOpen size={32} style={{ color: '#D1D5DB', marginBottom: 8 }} />
            <p style={{ margin: 0, color: '#6B7280', fontWeight: 500 }}>
              {search ? `Nenhum artigo encontrado para "${search}"` : 'Nenhum artigo publicado ainda.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {artigos.map((a: any) => {
              const pct = utilPct(a.util_sim ?? 0, a.util_nao ?? 0)
              return (
                <Link
                  key={a.id}
                  href={`/ti/base-conhecimento/${a.id}`}
                  style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '18px 20px', textDecoration: 'none', display: 'block', transition: 'box-shadow 0.15s, border-color 0.15s' }}
                  onMouseOver={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = '#BFDBFE' }}
                  onMouseOut={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none'; (e.currentTarget as HTMLAnchorElement).style.borderColor = '#E5E7EB' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Category + Date */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        {a.categoria && (
                          <span style={{ padding: '2px 8px', borderRadius: 20, background: '#EFF6FF', color: BLUE, fontSize: '0.7rem', fontWeight: 600 }}>
                            {a.categoria.nome}
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{fmtDate(a.created_at)}</span>
                      </div>

                      {/* Title */}
                      <h2 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700, color: NAVY, lineHeight: 1.4 }}>
                        {a.titulo}
                      </h2>

                      {/* Excerpt */}
                      <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#6B7280', lineHeight: 1.6 }}>
                        {excerpt(a.conteudo)}
                      </p>

                      {/* Tags */}
                      {a.tags?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {a.tags.map((t: string) => (
                            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', background: '#F3F4F6', borderRadius: 20, fontSize: '0.7rem', color: '#374151' }}>
                              <Tag size={9} /> {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Stats + arrow */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                      <ChevronRight size={18} style={{ color: '#9CA3AF' }} />
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', color: '#6B7280' }}>
                          <Eye size={12} /> {a.visualizacoes ?? 0}
                        </span>
                        {pct !== null && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', color: pct >= 70 ? '#16A34A' : '#6B7280' }}>
                            <ThumbsUp size={12} /> {pct}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: 6, cursor: page <= 1 ? 'not-allowed' : 'pointer', background: 'white', color: page <= 1 ? '#D1D5DB' : '#374151', fontSize: '0.8rem', fontWeight: 500 }}
            >
              ← Anterior
            </button>
            <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: 6, cursor: page >= totalPages ? 'not-allowed' : 'pointer', background: 'white', color: page >= totalPages ? '#D1D5DB' : '#374151', fontSize: '0.8rem', fontWeight: 500 }}
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
