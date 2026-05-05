'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import {
  Search, Plus, X, Loader2, LayoutDashboard,
  Edit2, Check, Shield, Server
} from 'lucide-react'
import { checkTiUserAccess, buscarEquipesAdminAction, salvarEquipeAdminAction } from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

export default function EquipesAdminPage() {
  const router = useRouter()
  const { accounts } = useMsal()

  const [authReady, setAuthReady] = useState(false)
  
  const [equipes, setEquipes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editEquipe, setEditEquipe] = useState<any>(null)
  const [formData, setFormData] = useState({ nome: '', descricao: '', email_fila: '', nivel: 1, ativo: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted || !['admin', 'gestor_ti'].includes(r.perfil ?? '')) {
        router.push('/ti/dashboard')
        return
      }
      setAuthReady(true)
    })
  }, [accounts, router])

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await buscarEquipesAdminAction({ search: search || undefined })
    if (res.success) {
      setEquipes(res.equipes)
    }
    setLoading(false)
  }, [search])

  useEffect(() => { if (authReady) carregar() }, [authReady, carregar])

  function handleSearch() {
    setSearch(searchInput)
  }

  function openModal(equipe?: any) {
    if (equipe) {
      setEditEquipe(equipe)
      setFormData({ nome: equipe.nome, descricao: equipe.descricao || '', email_fila: equipe.email_fila || '', nivel: equipe.nivel, ativo: equipe.ativo })
    } else {
      setEditEquipe(null)
      setFormData({ nome: '', descricao: '', email_fila: '', nivel: 1, ativo: true })
    }
    setModalOpen(true)
  }

  async function handleSave() {
    if (!formData.nome) return
    setSaving(true)
    const payload = { ...formData, id: editEquipe?.id }
    const res = await salvarEquipeAdminAction(payload)
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
      `}</style>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
        
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
              <span>Equipes de T.I</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={24} style={{ color: BLUE }} />
              Gestão de Equipes
            </h1>
            <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.9rem' }}>
              Cadastre equipes para agrupar técnicos e atribuir chamados
            </p>
          </div>
          
          <button
            onClick={() => openModal()}
            className="btn-hover"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: BLUE, color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s' }}
          >
            <Plus size={16} /> Nova Equipe
          </button>
        </div>

        {/* Filters */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar pelo nome da equipe..."
              style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: '0.875rem', outline: 'none' }}
            />
          </div>
          <button
            onClick={handleSearch}
            style={{ padding: '9px 18px', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
          >
            Buscar
          </button>
          {search && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); }}
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
          ) : equipes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>
              <Server size={32} style={{ color: '#D1D5DB', marginBottom: 8 }} />
              <p style={{ margin: 0 }}>Nenhuma equipe encontrada.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left', color: '#6B7280' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nome da Equipe</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nível Suporte</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>E-mail Fila</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: 80 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {equipes.map(eq => (
                  <tr key={eq.id} className="row-hover" style={{ borderBottom: '1px solid #E5E7EB', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>
                      {eq.nome}
                      {eq.descricao && <p style={{ margin: '2px 0 0', fontWeight: 400, fontSize: '0.75rem', color: '#6B7280' }}>{eq.descricao}</p>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4B5563' }}>Nível {eq.nivel}</td>
                    <td style={{ padding: '12px 16px', color: '#6B7280' }}>{eq.email_fila || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                        background: eq.ativo ? '#DCFCE7' : '#FEE2E2', color: eq.ativo ? '#166534' : '#991B1B'
                      }}>
                        {eq.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button 
                        onClick={() => openModal(eq)}
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

        {/* Modal Editor */}
        {modalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 500, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: NAVY }}>
                  {editEquipe ? 'Editar Equipe' : 'Nova Equipe'}
                </h3>
                <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
                  <X size={20} />
                </button>
              </div>
              
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Nome da Equipe *</label>
                  <input 
                    value={formData.nome} 
                    onChange={e => setFormData({...formData, nome: e.target.value})}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Descrição</label>
                  <textarea 
                    value={formData.descricao} 
                    onChange={e => setFormData({...formData, descricao: e.target.value})}
                    rows={2}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: '0.9rem', outline: 'none', resize: 'vertical' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>E-mail da Fila (Opcional)</label>
                  <input 
                    value={formData.email_fila} 
                    onChange={e => setFormData({...formData, email_fila: e.target.value})}
                    type="email"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: '0.9rem', outline: 'none' }}
                  />
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9CA3AF' }}>Se preenchido, enviaremos alertas para esta lista de distribuição.</p>
                </div>
                
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Nível de Suporte *</label>
                    <select 
                      value={formData.nivel} 
                      onChange={e => setFormData({...formData, nivel: Number(e.target.value)})}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: '0.9rem', outline: 'none', background: 'white' }}
                    >
                      <option value={1}>Nível 1 (Helpdesk / Triagem)</option>
                      <option value={2}>Nível 2 (Sustentação)</option>
                      <option value={3}>Nível 3 (Especialistas / Infra)</option>
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
                      <span style={{ fontSize: '0.9rem', color: '#374151' }}>Equipe Ativa</span>
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
                  disabled={saving || !formData.nome}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: BLUE, border: 'none', borderRadius: 6, color: 'white', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: (saving || !formData.nome) ? 0.6 : 1 }}
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
