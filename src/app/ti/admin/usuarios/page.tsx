'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import {
  Search, Users, Plus, Upload, X, Loader2, LayoutDashboard,
  Edit2, Check, AlertCircle, Shield
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { checkTiUserAccess, buscarUsuariosAdminAction, salvarUsuarioAdminAction, importarUsuariosAdminAction } from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'
const PERFIS = ['user', 'tecnico', 'gestor_ti', 'admin']

export default function UsuariosAdminPage() {
  const router = useRouter()
  const { accounts } = useMsal()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [authReady, setAuthReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [perfilFilter, setPerfilFilter] = useState('')
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<any>(null)
  const [formData, setFormData] = useState({ email: '', nome: '', cargo: '', perfil: 'user', ativo: true })
  const [saving, setSaving] = useState(false)
  
  // Import state
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')

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
    const res = await buscarUsuariosAdminAction({ search: search || undefined, perfil: perfilFilter || undefined, page })
    if (res.success) {
      setUsuarios(res.usuarios)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    }
    setLoading(false)
  }, [search, perfilFilter, page])

  useEffect(() => { if (authReady) carregar() }, [authReady, carregar])
  useEffect(() => { setPage(1) }, [search, perfilFilter])

  function handleSearch() {
    setSearch(searchInput)
    setPage(1)
  }

  function openModal(user?: any) {
    if (user) {
      setEditUser(user)
      setFormData({ email: user.email, nome: user.nome, cargo: user.cargo || '', perfil: user.perfil, ativo: user.ativo })
    } else {
      setEditUser(null)
      setFormData({ email: '', nome: '', cargo: '', perfil: 'user', ativo: true })
    }
    setModalOpen(true)
  }

  async function handleSave() {
    if (!formData.email || !formData.nome || !formData.perfil) return
    setSaving(true)
    const payload = { ...formData, id: editUser?.id }
    const res = await salvarUsuarioAdminAction(payload)
    if (res.success) {
      setModalOpen(false)
      carregar()
    } else {
      alert(`Erro: ${res.error}`)
    }
    setSaving(false)
  }

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    setImporting(true)
    setImportMessage('Lendo arquivo...')
    
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet)
      
      setImportMessage(`Enviando ${rows.length} registros...`)
      
      const res = await importarUsuariosAdminAction(rows)
      if (res.success) {
        setImportMessage(`Importação concluída: ${res.count} usuários.`)
        carregar()
      } else {
        setImportMessage(`Erro: ${res.error}`)
      }
    } catch (err: any) {
      setImportMessage(`Erro ao ler Excel: ${err.message}`)
    }
    
    if (fileInputRef.current) fileInputRef.current.value = ''
    setImporting(false)
    setTimeout(() => setImportMessage(''), 5000)
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
              <span>Usuários</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={24} style={{ color: BLUE }} />
              Gestão de Usuários
            </h1>
            <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.9rem' }}>
              Gerencie acessos, perfis e contas do sistema ({total} no total)
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: 10 }}>
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImportExcel}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="btn-hover"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'white', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 7, cursor: importing ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s' }}
            >
              {importing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={16} />}
              Importar
            </button>
            <button
              onClick={() => openModal()}
              className="btn-hover"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: BLUE, color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s' }}
            >
              <Plus size={16} /> Novo Usuário
            </button>
          </div>
        </div>

        {importMessage && (
          <div style={{ padding: '12px 16px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, color: '#1E40AF', marginBottom: 16, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} /> {importMessage}
          </div>
        )}

        {/* Filters */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar por nome ou e-mail..."
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
            value={perfilFilter}
            onChange={e => setPerfilFilter(e.target.value)}
            style={{ padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', background: 'white', minWidth: 150 }}
          >
            <option value="">Todos os perfis</option>
            {PERFIS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          
          {(search || perfilFilter) && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); setPerfilFilter('') }}
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
          ) : usuarios.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>
              <Users size={32} style={{ color: '#D1D5DB', marginBottom: 8 }} />
              <p style={{ margin: 0 }}>Nenhum usuário encontrado.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left', color: '#6B7280' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nome</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>E-mail</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Cargo</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Perfil</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: 80 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id} className="row-hover" style={{ borderBottom: '1px solid #E5E7EB', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: '#111827' }}>{u.nome}</td>
                    <td style={{ padding: '12px 16px', color: '#4B5563' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px', color: '#6B7280' }}>{u.cargo || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                        background: u.perfil === 'admin' ? '#FEE2E2' : u.perfil === 'gestor_ti' ? '#FEF3C7' : u.perfil === 'tecnico' ? '#E0E7FF' : '#F3F4F6',
                        color: u.perfil === 'admin' ? '#991B1B' : u.perfil === 'gestor_ti' ? '#92400E' : u.perfil === 'tecnico' ? '#3730A3' : '#374151'
                      }}>
                        {u.perfil}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                        background: u.ativo ? '#DCFCE7' : '#FEE2E2', color: u.ativo ? '#166534' : '#991B1B'
                      }}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button 
                        onClick={() => openModal(u)}
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
            <div style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 500, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: NAVY }}>
                  {editUser ? 'Editar Usuário' : 'Novo Usuário'}
                </h3>
                <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
                  <X size={20} />
                </button>
              </div>
              
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Nome Completo *</label>
                  <input 
                    value={formData.nome} 
                    onChange={e => setFormData({...formData, nome: e.target.value})}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>E-mail *</label>
                  <input 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    type="email"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: '0.9rem', outline: 'none', background: editUser ? '#F3F4F6' : 'white' }}
                    readOnly={!!editUser} // Usually email is not changeable or requires special care
                  />
                  {editUser && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9CA3AF' }}>O e-mail não pode ser alterado após o cadastro.</p>}
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cargo</label>
                  <input 
                    value={formData.cargo} 
                    onChange={e => setFormData({...formData, cargo: e.target.value})}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Perfil *</label>
                    <select 
                      value={formData.perfil} 
                      onChange={e => setFormData({...formData, perfil: e.target.value})}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: '0.9rem', outline: 'none', background: 'white' }}
                    >
                      {PERFIS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Status</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={formData.ativo} 
                        onChange={e => setFormData({...formData, ativo: e.target.checked})}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.9rem', color: '#374151' }}>Usuário Ativo</span>
                    </label>
                  </div>
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
                  disabled={saving || !formData.email || !formData.nome || !formData.perfil}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: BLUE, border: 'none', borderRadius: 6, color: 'white', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: (saving || !formData.email || !formData.nome) ? 0.6 : 1 }}
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
