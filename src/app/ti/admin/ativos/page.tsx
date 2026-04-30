'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import {
  Search, Plus, X, Loader2, LayoutDashboard,
  Edit2, Check, Shield, Monitor
} from 'lucide-react'
import { checkTiUserAccess, buscarAtivosAdminAction, salvarAtivoAdminAction } from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

const TIPOS = ['computador', 'notebook', 'monitor', 'impressora', 'telefone', 'servidor', 'switch', 'nobreak', 'outros']
const STATUS = ['ativo', 'manutencao', 'descartado', 'emprestado', 'reserva']

export default function AtivosAdminPage() {
  const router = useRouter()
  const { accounts } = useMsal()

  const [authReady, setAuthReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  
  const [ativos, setAtivos] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editAtivo, setEditAtivo] = useState<any>(null)
  
  const defaultForm = {
    nome: '', tipo: 'computador', status: 'ativo', patrimonio: '', numero_serie: '',
    modelo: '', fabricante: '', setor: '', responsavel: '',
    ip: '', hostname: '', sistema_operacional: '', data_aquisicao: '', garantia_ate: '', observacoes: ''
  }
  const [formData, setFormData] = useState<any>(defaultForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted || !['admin', 'gestor_ti'].includes(r.perfil ?? '')) {
        router.push('/ti/dashboard')
        return
      }
      setIsAdmin(true)
      setAuthReady(true)
    })
  }, [accounts, router])

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await buscarAtivosAdminAction({ 
      search: search || undefined, 
      tipo: tipoFilter || undefined, 
      status: statusFilter || undefined, 
      page 
    })
    
    if (res.success) {
      setAtivos(res.ativos)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    }
    setLoading(false)
  }, [search, tipoFilter, statusFilter, page])

  useEffect(() => { if (authReady) carregar() }, [authReady, carregar])
  useEffect(() => { setPage(1) }, [search, tipoFilter, statusFilter])

  function handleSearch() {
    setSearch(searchInput)
    setPage(1)
  }

  function openModal(ativo?: any) {
    if (ativo) {
      setEditAtivo(ativo)
      setFormData({
        nome: ativo.nome, tipo: ativo.tipo, status: ativo.status, 
        patrimonio: ativo.patrimonio || '', numero_serie: ativo.numero_serie || '',
        modelo: ativo.modelo || '', fabricante: ativo.fabricante || '', 
        setor: ativo.setor || '', responsavel: ativo.responsavel || '',
        ip: ativo.ip || '', hostname: ativo.hostname || '', sistema_operacional: ativo.sistema_operacional || '', 
        data_aquisicao: ativo.data_aquisicao || '', garantia_ate: ativo.garantia_ate || '', observacoes: ativo.observacoes || ''
      })
    } else {
      setEditAtivo(null)
      setFormData(defaultForm)
    }
    setModalOpen(true)
  }

  async function handleSave() {
    if (!formData.nome || !formData.tipo) return
    setSaving(true)
    const payload = { 
      ...formData, 
      id: editAtivo?.id,
      patrimonio: formData.patrimonio || null,
      numero_serie: formData.numero_serie || null,
      data_aquisicao: formData.data_aquisicao || null,
      garantia_ate: formData.garantia_ate || null
    }
    const res = await salvarAtivoAdminAction(payload)
    if (res.success) {
      setModalOpen(false)
      carregar()
    } else {
      alert(`Erro: ${res.error}`)
    }
    setSaving(false)
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
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px) } to { opacity: 1; transform: translateY(0) } }
        .btn-hover:hover { opacity: 0.9; transform: translateY(-1px) }
        .row-hover:hover { background-color: #F9FAFB }
        .input-base { width: 100%; padding: 8px 12px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.9rem; outline: none; background: white; }
        .label-base { display: block; font-size: 0.85rem; font-weight: 600; color: #374151; margin-bottom: 4px; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.8rem', color: '#6B7280' }}>
              <Link href="/ti/dashboard" style={{ color: '#6B7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <LayoutDashboard size={13} /> Painel
              </Link>
              <span>›</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={13} /> Admin</span>
              <span>›</span>
              <span>Ativos de T.I</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Monitor size={24} style={{ color: BLUE }} />
              Gestão de Ativos
            </h1>
            <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.9rem' }}>
              Controle de inventário, equipamentos e infraestrutura ({total} registrados)
            </p>
          </div>
          
          <button
            onClick={() => openModal()}
            className="btn-hover"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: BLUE, color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s' }}
          >
            <Plus size={16} /> Novo Ativo
          </button>
        </div>

        {/* Filters */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 250px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar (nome, patrimônio, S/N)..."
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
            value={tipoFilter}
            onChange={e => setTipoFilter(e.target.value)}
            style={{ padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', background: 'white', minWidth: 140 }}
          >
            <option value="">Todos os Tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', background: 'white', minWidth: 140 }}
          >
            <option value="">Todos os Status</option>
            {STATUS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          
          {(search || tipoFilter || statusFilter) && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); setTipoFilter(''); setStatusFilter(''); }}
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
              <p style={{ margin: 0 }}>Carregando...</p>
            </div>
          ) : ativos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>
              <Monitor size={32} style={{ color: '#D1D5DB', marginBottom: 8 }} />
              <p style={{ margin: 0 }}>Nenhum ativo encontrado.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left', color: '#6B7280' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Identificação</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Tipo</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Setor/Local</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Rede</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: 80 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {ativos.map(a => (
                  <tr key={a.id} className="row-hover" style={{ borderBottom: '1px solid #E5E7EB', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{a.nome}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: 2 }}>
                        {a.patrimonio && <span>Patrimônio: {a.patrimonio} • </span>}
                        {a.numero_serie && <span>S/N: {a.numero_serie}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4B5563', textTransform: 'capitalize' }}>{a.tipo}</td>
                    <td style={{ padding: '12px 16px', color: '#6B7280' }}>
                      {a.setor || '-'}
                      {a.responsavel && <div style={{ fontSize: '0.75rem', marginTop: 2 }}>Resp: {a.responsavel}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6B7280' }}>
                      {a.ip || '-'}
                      {a.hostname && <div style={{ fontSize: '0.75rem', marginTop: 2 }}>{a.hostname}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize',
                        background: a.status === 'ativo' ? '#DCFCE7' : a.status === 'manutencao' ? '#FEF3C7' : a.status === 'descartado' ? '#FEE2E2' : '#F3F4F6',
                        color: a.status === 'ativo' ? '#166534' : a.status === 'manutencao' ? '#92400E' : a.status === 'descartado' ? '#991B1B' : '#374151'
                      }}>
                        {a.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button 
                        onClick={() => openModal(a)}
                        style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: BLUE }}
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
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

        {/* Modal Editor */}
        {modalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: NAVY }}>
                  {editAtivo ? 'Editar Ativo' : 'Novo Ativo'}
                </h3>
                <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
                  <X size={20} />
                </button>
              </div>
              
              <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Linha 1 */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="label-base">Nome / Identificação *</label>
                    <input className="input-base" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
                  </div>
                  <div>
                    <label className="label-base">Tipo *</label>
                    <select className="input-base" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                      {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-base">Status *</label>
                    <select className="input-base" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                      {STATUS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                </div>

                {/* Linha 2 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="label-base">Patrimônio</label>
                    <input className="input-base" value={formData.patrimonio} onChange={e => setFormData({...formData, patrimonio: e.target.value})} />
                  </div>
                  <div>
                    <label className="label-base">Número de Série</label>
                    <input className="input-base" value={formData.numero_serie} onChange={e => setFormData({...formData, numero_serie: e.target.value})} />
                  </div>
                  <div>
                    <label className="label-base">Fabricante</label>
                    <input className="input-base" value={formData.fabricante} onChange={e => setFormData({...formData, fabricante: e.target.value})} />
                  </div>
                  <div>
                    <label className="label-base">Modelo</label>
                    <input className="input-base" value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} />
                  </div>
                </div>

                {/* Linha 3 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="label-base">Setor/Local</label>
                    <input className="input-base" value={formData.setor} onChange={e => setFormData({...formData, setor: e.target.value})} />
                  </div>
                  <div>
                    <label className="label-base">Responsável</label>
                    <input className="input-base" value={formData.responsavel} onChange={e => setFormData({...formData, responsavel: e.target.value})} />
                  </div>
                  <div>
                    <label className="label-base">IP</label>
                    <input className="input-base" value={formData.ip} onChange={e => setFormData({...formData, ip: e.target.value})} />
                  </div>
                  <div>
                    <label className="label-base">Hostname</label>
                    <input className="input-base" value={formData.hostname} onChange={e => setFormData({...formData, hostname: e.target.value})} />
                  </div>
                </div>

                {/* Linha 4 */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="label-base">Sistema Operacional</label>
                    <input className="input-base" value={formData.sistema_operacional} onChange={e => setFormData({...formData, sistema_operacional: e.target.value})} />
                  </div>
                  <div>
                    <label className="label-base">Data Aquisição</label>
                    <input type="date" className="input-base" value={formData.data_aquisicao} onChange={e => setFormData({...formData, data_aquisicao: e.target.value})} />
                  </div>
                  <div>
                    <label className="label-base">Garantia Até</label>
                    <input type="date" className="input-base" value={formData.garantia_ate} onChange={e => setFormData({...formData, garantia_ate: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="label-base">Observações</label>
                  <textarea 
                    className="input-base" 
                    rows={3} 
                    style={{ resize: 'vertical' }}
                    value={formData.observacoes} 
                    onChange={e => setFormData({...formData, observacoes: e.target.value})} 
                  />
                </div>
              </div>
              
              <div style={{ padding: '16px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#F9FAFB' }}>
                <button 
                  onClick={() => setModalOpen(false)}
                  style={{ padding: '8px 16px', background: 'white', border: '1px solid #D1D5DB', borderRadius: 6, color: '#374151', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saving || !formData.nome || !formData.tipo}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: BLUE, border: 'none', borderRadius: 6, color: 'white', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: (saving || !formData.nome || !formData.tipo) ? 0.6 : 1 }}
                >
                  {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
