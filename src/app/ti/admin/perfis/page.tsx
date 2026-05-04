'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import { 
  Loader2, 
  LayoutDashboard, 
  ShieldCheck, 
  Shield, 
  ChevronRight,
  ShieldAlert,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Palette,
  Type
} from 'lucide-react'
import { 
  checkTiUserAccess, 
  buscarPerfisAction, 
  salvarPerfilAction, 
  excluirPerfilAction 
} from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

export default function PerfisPage() {
  const router = useRouter()
  const { accounts } = useMsal()
  
  const [authReady, setAuthReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  
  const [perfis, setPerfis] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editPerfil, setEditPerfil] = useState<any>(null)
  const [formData, setFormData] = useState({
    slug: '',
    nome: '',
    descricao: '',
    cor: '#2563EB',
    icone: 'Shield',
    ordem: 0
  })

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await buscarPerfisAction()
    if (res.success) setPerfis(res.perfis || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted || r.perfil !== 'admin') {
        router.push('/ti/dashboard')
        return
      }
      setIsAdmin(true)
      setAuthReady(true)
      carregar()
    })
  }, [accounts, router, carregar])

  const openModal = (perfil?: any) => {
    if (perfil) {
      setEditPerfil(perfil)
      setFormData({
        slug: perfil.slug,
        nome: perfil.nome,
        descricao: perfil.descricao || '',
        cor: perfil.cor || '#2563EB',
        icone: perfil.icone || 'Shield',
        ordem: perfil.ordem || 0
      })
    } else {
      setEditPerfil(null)
      setFormData({
        slug: '',
        nome: '',
        descricao: '',
        cor: '#2563EB',
        icone: 'Shield',
        ordem: perfis.length + 1
      })
    }
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const res = await salvarPerfilAction({
      id: editPerfil?.id,
      ...formData
    })
    
    if (res.success) {
      setModalOpen(false)
      carregar()
    } else {
      alert(`Erro: ${res.error}`)
    }
    setSaving(false)
  }

  const handleDelete = async (perfil: any) => {
    if (['admin', 'user'].includes(perfil.slug)) {
      alert('Perfis fundamentais do sistema (admin/user) não podem ser removidos.')
      return
    }
    
    if (!confirm(`Tem certeza que deseja excluir o perfil "${perfil.nome}"?`)) return
    
    const res = await excluirPerfilAction(perfil.id)
    if (res.success) {
      carregar()
    } else {
      alert(res.error)
    }
  }

  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
        <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
        
        {/* Breadcrumb & Title */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: '0.8rem', color: '#6B7280' }}>
              <Link href="/ti/dashboard" style={{ color: '#6B7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <LayoutDashboard size={13} /> Painel
              </Link>
              <span>›</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={13} /> Admin</span>
              <span>›</span>
              <span style={{ fontWeight: 600, color: NAVY }}>Perfis de Acesso</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: NAVY, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, background: 'white', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <ShieldCheck size={28} style={{ color: BLUE }} />
              </div>
              Perfis de Acesso
            </h1>
          </div>

          <button 
            onClick={() => openModal()}
            style={{ 
              background: BLUE, 
              color: 'white', 
              border: 'none', 
              padding: '10px 18px', 
              borderRadius: 10, 
              fontWeight: 600, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37,99,235,0.2)'
            }}
          >
            <Plus size={18} /> Novo Perfil
          </button>
        </div>

        {/* Matrix Link CTA */}
        <div style={{ 
          background: 'linear-gradient(135deg, #1E3A5F, #2563EB)', 
          padding: '20px 24px', 
          borderRadius: 16, 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
          boxShadow: '0 8px 24px rgba(37,99,235,0.2)'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Gerenciar Permissões Granulares</h3>
            <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
              Configure exatamente o que cada perfil pode ver ou editar na Matriz de Acesso.
            </p>
          </div>
          <Link 
            href="/ti/admin/matriz-acesso"
            style={{ 
              background: 'rgba(255,255,255,0.15)', 
              color: 'white', 
              padding: '10px 20px', 
              borderRadius: 10, 
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            Acessar Matriz <ChevronRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <Loader2 size={32} style={{ color: BLUE, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: 24 }}>
            {perfis.map(profile => (
              <div 
                key={profile.id}
                style={{ 
                  background: 'white', 
                  borderRadius: 16, 
                  padding: 24, 
                  border: '1px solid #E5E7EB',
                  display: 'flex',
                  gap: 20,
                  position: 'relative'
                }}
              >
                <div style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: 14, 
                  background: `${profile.cor}10`, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Shield size={28} style={{ color: profile.cor }} />
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: NAVY }}>{profile.nome}</h3>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button 
                        onClick={() => openModal(profile)}
                        style={{ border: 'none', background: 'transparent', padding: 6, borderRadius: 6, cursor: 'pointer', color: '#6B7280' }}
                        title="Editar Perfil"
                      >
                        <Pencil size={16} />
                      </button>
                      {profile.slug !== 'admin' && profile.slug !== 'user' && (
                        <button 
                          onClick={() => handleDelete(profile)}
                          style={{ border: 'none', background: 'transparent', padding: 6, borderRadius: 6, cursor: 'pointer', color: '#EF4444' }}
                          title="Excluir Perfil"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <code style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: '#F3F4F6', color: '#6B7280', fontWeight: 600, display: 'inline-block', marginBottom: 8 }}>
                    SLUG: {profile.slug}
                  </code>
                  <p style={{ margin: 0, color: '#4B5563', lineHeight: 1.5, fontSize: '0.9rem' }}>
                    {profile.descricao}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {modalOpen && (
          <div style={{ 
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            zIndex: 100, backdropFilter: 'blur(4px)' 
          }}>
            <div style={{ background: 'white', width: '100%', maxWidth: 500, borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: NAVY }}>
                  {editPerfil ? 'Editar Perfil' : 'Novo Perfil'}
                </h2>
                <button onClick={() => setModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280' }}>
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSave} style={{ padding: '24px 32px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  
                  {/* Row 1: Name and Slug */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Type size={14} /> Nome do Perfil
                      </label>
                      <input 
                        required
                        type="text"
                        value={formData.nome}
                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                        placeholder="Ex: Supervisor de T.I"
                        style={{ 
                          width: '100%', padding: '12px 14px', borderRadius: 10, 
                          border: '1.5px solid #E5E7EB', outline: 'none', fontSize: '0.95rem',
                          transition: 'border-color 0.2s'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 6 }}>
                        Identificador (Slug)
                      </label>
                      <input 
                        required
                        disabled={!!editPerfil}
                        type="text"
                        value={formData.slug}
                        onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                        placeholder="ex_perfil_slug"
                        style={{ 
                          width: '100%', padding: '12px 14px', borderRadius: 10, 
                          border: '1.5px solid #E5E7EB', outline: 'none', fontSize: '0.95rem',
                          background: editPerfil ? '#F3F4F6' : 'white',
                          color: editPerfil ? '#6B7280' : 'inherit',
                          cursor: editPerfil ? 'not-allowed' : 'text'
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 2: Description */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY }}>Descrição do Perfil</label>
                    <textarea 
                      value={formData.descricao}
                      onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Descreva as permissões e responsabilidades deste grupo..."
                      style={{ 
                        width: '100%', padding: '12px 14px', borderRadius: 10, 
                        border: '1.5px solid #E5E7EB', outline: 'none', minHeight: 100, 
                        fontSize: '0.95rem', resize: 'vertical', lineHeight: 1.5
                      }}
                    />
                  </div>

                  {/* Row 3: Color and Order */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Palette size={14} /> Cor Visual
                      </label>
                      <div style={{ 
                        display: 'flex', alignItems: 'center', gap: 0, 
                        border: '1.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' 
                      }}>
                        <div style={{ 
                          width: 46, height: 46, background: formData.cor, 
                          borderRight: '1.5px solid #E5E7EB', position: 'relative' 
                        }}>
                          <input 
                            type="color"
                            value={formData.cor}
                            onChange={e => setFormData({ ...formData, cor: e.target.value })}
                            style={{ 
                              position: 'absolute', inset: 0, opacity: 0, width: '100%', 
                              height: '100%', cursor: 'pointer' 
                            }}
                          />
                        </div>
                        <input 
                          type="text"
                          value={formData.cor.toUpperCase()}
                          onChange={e => setFormData({ ...formData, cor: e.target.value })}
                          style={{ flex: 1, padding: '12px', border: 'none', outline: 'none', fontSize: '0.9rem', fontWeight: 600, color: '#4B5563' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY }}>Ordem na Lista</label>
                      <input 
                        type="number"
                        min="0"
                        value={formData.ordem}
                        onChange={e => setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })}
                        style={{ 
                          width: '100%', padding: '12px 14px', borderRadius: 10, 
                          border: '1.5px solid #E5E7EB', outline: 'none', fontSize: '0.95rem'
                        }}
                      />
                    </div>
                  </div>

                </div>

                <div style={{ marginTop: 40, display: 'flex', gap: 16 }}>
                  <button 
                    type="button"
                    onClick={() => setModalOpen(false)}
                    style={{ 
                      flex: 1, padding: '14px', borderRadius: 12, border: '1.5px solid #E5E7EB', 
                      background: 'white', fontWeight: 700, color: '#6B7280', cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseOut={e => (e.currentTarget.style.background = 'white')}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    style={{ 
                      flex: 1.5, padding: '14px', borderRadius: 12, border: 'none', 
                      background: BLUE, color: 'white', fontWeight: 700, fontSize: '1rem',
                      cursor: saving ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      boxShadow: `0 4px 14px ${BLUE}40`,
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                    onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    {saving ? <Loader2 size={20} className="spin" /> : <Save size={20} />}
                    {editPerfil ? 'Confirmar Alterações' : 'Criar Novo Perfil'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
          .spin { animation: spin 1s linear infinite; }
        `}</style>

      </div>
    </div>
  )
}
