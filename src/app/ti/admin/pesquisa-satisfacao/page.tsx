'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import { Loader2, LayoutDashboard, Shield, Star, Search, X, MessageSquare } from 'lucide-react'
import { checkTiUserAccess, buscarSatisfacaoAdminAction } from '@/lib/ti/actions'
import { format } from 'date-fns'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

export default function PesquisaSatisfacaoPage() {
  const router = useRouter()
  const { accounts } = useMsal()

  const [authReady, setAuthReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  
  const [resultados, setResultados] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [notaFilter, setNotaFilter] = useState('')

  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted || (!['admin', 'gestor_ti'].includes(r.perfil ?? '') && !r.permissions.includes('csat.view'))) {
        router.push('/ti/dashboard')
        return
      }
      setIsAdmin(true)
      setAuthReady(true)
    })
  }, [accounts, router])

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await buscarSatisfacaoAdminAction({ 
      search: search || undefined, 
      nota: notaFilter ? parseInt(notaFilter) : undefined, 
      page 
    })
    
    if (res.success) {
      setResultados(res.resultados)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    }
    setLoading(false)
  }, [search, notaFilter, page])

  useEffect(() => { if (authReady) carregar() }, [authReady, carregar])
  useEffect(() => { setPage(1) }, [search, notaFilter])

  function handleSearch() {
    setSearch(searchInput)
    setPage(1)
  }

  function renderStars(nota: number) {
    return (
      <div style={{ display: 'flex', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} size={16} fill={i <= nota ? '#FBBF24' : 'transparent'} color={i <= nota ? '#FBBF24' : '#D1D5DB'} />
        ))}
      </div>
    )
  }

  if (!authReady) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
      <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .row-hover:hover { background-color: #F9FAFB }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.8rem', color: '#6B7280' }}>
            <Link href="/ti/dashboard" style={{ color: '#6B7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <LayoutDashboard size={13} /> Painel
            </Link>
            <span>›</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={13} /> Admin</span>
            <span>›</span>
            <span>Pesquisa de Satisfação</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={24} style={{ color: '#FBBF24', fill: '#FBBF24' }} />
            Pesquisa de Satisfação (CSAT)
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.9rem' }}>
            Resultados das avaliações de atendimento dos chamados ({total} avaliações)
          </p>
        </div>

        {/* Filters */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 250px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar chamado, título ou solicitante..."
              style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: '0.875rem', outline: 'none' }}
            />
          </div>
          <button
            onClick={handleSearch}
            style={{ padding: '9px 18px', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
          >
            Buscar
          </button>
          
          <select
            value={notaFilter}
            onChange={e => setNotaFilter(e.target.value)}
            style={{ padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', background: 'white', minWidth: 140 }}
          >
            <option value="">Todas as Notas</option>
            <option value="5">5 Estrelas</option>
            <option value="4">4 Estrelas</option>
            <option value="3">3 Estrelas</option>
            <option value="2">2 Estrelas</option>
            <option value="1">1 Estrela</option>
          </select>
          
          {(search || notaFilter) && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); setNotaFilter(''); }}
              style={{ padding: '9px 12px', background: 'white', border: '1px solid #D1D5DB', borderRadius: 7, cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}
            >
              <X size={14} /> Limpar
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>
              <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite', marginBottom: 8 }} />
              <p style={{ margin: 0 }}>Carregando avaliações...</p>
            </div>
          ) : resultados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>
              <Star size={32} style={{ color: '#D1D5DB', marginBottom: 8 }} />
              <p style={{ margin: 0 }}>Nenhuma avaliação encontrada.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left', color: '#6B7280' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Data da Avaliação</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Chamado</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Solicitante</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nota</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Comentário</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map(res => (
                  <tr key={res.id} className="row-hover" style={{ borderBottom: '1px solid #E5E7EB', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 16px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                      {res.satisfacao_respondido_em ? format(new Date(res.satisfacao_respondido_em), 'dd/MM/yyyy HH:mm') : '-'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4B5563' }}>
                      <Link href={`/ti/chamado/${res.id}`} style={{ color: BLUE, textDecoration: 'none', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                        {res.numero}
                      </Link>
                      <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{res.titulo}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: '#111827' }}>
                      {res.solicitante_nome}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {renderStars(res.satisfacao_nota)}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4B5563', maxWidth: 300 }}>
                      {res.satisfacao_comentario ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <MessageSquare size={16} style={{ color: '#9CA3AF', flexShrink: 0, marginTop: 2 }} />
                          <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {res.satisfacao_comentario}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Sem comentário</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

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
