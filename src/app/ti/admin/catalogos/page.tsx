'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import {
  ChevronRight, Plus, Save, X, Loader2,
  Settings, FolderTree, Building2, MapPin,
  AlertCircle, ChevronDown,
  Power, PowerOff, ListPlus, Edit3, Clock
} from 'lucide-react'
import { checkTiUserAccess, buscarDadosCatalogosAction, salvarCategoriaCompletaAction, alternarStatusCatalogoAction, salvarSetorAction, salvarUnidadeAction, salvarSlaConfigAction, atualizarSeveridadeCategoriaAction } from '@/lib/ti/actions'
import type { TiCategoria, TiSetor, TiUnidade, TiTipo, TiPrioridade } from '@/lib/ti/types'
import { slugify } from '@/lib/utils'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

type Tab = 'categorias' | 'setores' | 'unidades' | 'sla'

export default function AdminCatalogosPage() {
  const router = useRouter()
  const { accounts } = useMsal()
  
  const [authReady, setAuthReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('categorias')
  const [loading, setLoading] = useState(true)
  
  // Data
  const [categorias, setCategorias] = useState<TiCategoria[]>([])
  const [setores, setSetores] = useState<TiSetor[]>([])
  const [unidades, setUnidades] = useState<TiUnidade[]>([])

  // UI state
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<Tab>('categorias')
  const [editingItem, setEditingItem] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  // Form Category
  const [catName, setCatName] = useState('')
  const [catTipo, setCatTipo] = useState<TiTipo>('incidente')
  const [catSeveridade, setCatSeveridade] = useState<TiPrioridade | ''>('')
  const [subCats, setSubCats] = useState<string[]>([])
  const [newSubName, setNewSubName] = useState('')

  // Form Simple (Setor/Unidade)
  const [simpleName, setSimpleName] = useState('')

  // Form SLA
  const [slaPrioridade, setSlaPrioridade] = useState<TiPrioridade>('media')
  const [slaCategoriaId, setSlaCategoriaId] = useState<string>('')
  const [slaPrazoHoras, setSlaPrazoHoras] = useState<number>(24)
  const [slaHorarioComercial, setSlaHorarioComercial] = useState<boolean>(true)

  // Control
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const carregarDados = useCallback(async () => {
    setLoading(true)
    const res = await buscarDadosCatalogosAction()
    if (res.success) {
      setCategorias(res.categorias || [])
      setSetores(res.setores || [])
      setUnidades(res.unidades || [])
    }

    setLoading(false)
  }, [])

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
      carregarDados()
    })
  }, [accounts, router, carregarDados])

  const toggleExpand = (id: string) => {
    setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // --- Handlers ---

  async function handleToggleStatus(table: any, id: string, current: boolean) {
    if (togglingId) return
    setTogglingId(id)
    try {
      const res = await alternarStatusCatalogoAction(table, id, !current)
      if (res.success) await carregarDados()
    } finally {
      setTogglingId(null)
    }
  }

  function openCategoryModal(cat?: TiCategoria) {
    setModalType('categorias')
    if (cat) {
      setEditingItem(cat)
      setCatName(cat.nome)
      setCatTipo(cat.tipo_padrao || 'incidente')
      setCatSeveridade(cat.severidade || '')
      const children = categorias.filter(c => c.categoria_pai === cat.id)
      setSubCats(children.map(c => c.nome))
    } else {
      setEditingItem(null)
      setCatName('')
      setCatTipo('incidente')
      setCatSeveridade('')
      setSubCats([])
    }
    setModalOpen(true)
  }
  function openSimpleModal(type: Tab, item?: any) {
    setModalType(type)
    if (item) {
      setEditingItem(item)
      setSimpleName(item.nome)
    } else {
      setEditingItem(null)
      setSimpleName('')
    }
    setModalOpen(true)
  }

  function openSlaModal(config?: any) {
    setModalType('sla')
    if (config) {
      setEditingItem(config)
      setSlaPrioridade(config.prioridade)
      setSlaCategoriaId(config.categoria_id || '')
      setSlaPrazoHoras(config.prazo_horas)
      setSlaHorarioComercial(config.horario_comercial)
    } else {
      setEditingItem(null)
      setSlaPrioridade('media')
      setSlaCategoriaId('')
      setSlaPrazoHoras(24)
      setSlaHorarioComercial(true)
    }
    setModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (modalType === 'categorias') {
        const parentSlug = slugify(catName)
        const parent = editingItem 
          ? { id: editingItem.id, nome: catName, slug: parentSlug, tipo_padrao: catTipo, severidade: catSeveridade || null }
          : { nome: catName, slug: parentSlug, ordem: 0, tipo_padrao: catTipo, severidade: catSeveridade || null }
        
        // Subcategorias com slug prefixado pelo pai para evitar conflitos (ex: hardware-outros, software-outros)
        const children = subCats.map(name => ({
          nome: name,
          slug: `${parentSlug}-${slugify(name)}`,
          ordem: 0,
          ativo: true
        }))

        const res = await salvarCategoriaCompletaAction(parent as any, children as any)
        if (!res.success) throw new Error(res.error)
      } 
      else if (modalType === 'setores') {
        const res = await salvarSetorAction({ id: editingItem?.id, nome: simpleName, ativo: true })
        if (!res.success) throw new Error(res.error)
      }
      else if (modalType === 'unidades') {
        const res = await salvarUnidadeAction({ id: editingItem?.id, nome: simpleName, ativo: true })
        if (!res.success) throw new Error(res.error)
      }
      else if (modalType === 'sla') {
        const res = await salvarSlaConfigAction({
          id: editingItem?.id,
          prioridade: slaPrioridade,
          categoria_id: slaCategoriaId || null,
          prazo_horas: slaPrazoHoras,
          horario_comercial: slaHorarioComercial,
          ativo: true
        })
        if (!res.success) throw new Error(res.error)
      }

      setModalOpen(false)
      carregarDados()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!authReady || !isAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={40} color={NAVY} />
      </div>
    )
  }

  const rootCats = categorias.filter(c => !c.categoria_pai)

  return (
    <div style={{ minHeight: '100vh', background: BG, paddingBottom: '4rem' }}>
      {/* Header */}
      <header style={{ background: '#FFF', borderBottom: '1px solid #E5E7EB', padding: '1.25rem 2rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: NAVY, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Settings size={28} />
              Gestão de Catálogos
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.25rem' }}>
              Gerencie categorias, setores e unidades do sistema
            </p>
          </div>
          <button 
            onClick={() => {
              if (activeTab === 'categorias') openCategoryModal()
              else if (activeTab === 'sla') openSlaModal()
              else openSimpleModal(activeTab)
            }}
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem' }}
          >
            <Plus size={20} />
            Novo {activeTab === 'categorias' ? 'Catálogo' : activeTab === 'setores' ? 'Setor' : activeTab === 'unidades' ? 'Unidade' : 'SLA'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 2rem' }}>
        
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.5rem' }}>
          {(['categorias', 'setores', 'unidades', 'sla'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: activeTab === t ? BLUE : '#6B7280',
                borderBottom: `2px solid ${activeTab === t ? BLUE : 'transparent'}`,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem'
              }}
            >
              {t === 'categorias' && <FolderTree size={18} />}
              {t === 'setores' && <Building2 size={18} />}
              {t === 'unidades' && <MapPin size={18} />}
              {t === 'sla' && <Clock size={18} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <Loader2 className="animate-spin" size={32} color="#94A3B8" />
          </div>
        ) : (
          <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            
            {activeTab === 'categorias' && (
              <div style={{ padding: '1rem' }}>
                {rootCats.map(cat => {
                  const children = categorias.filter(c => c.categoria_pai === cat.id)
                  const isExpanded = expandedCats[cat.id]
                  
                  return (
                    <div key={cat.id} style={{ marginBottom: '0.75rem', border: '1px solid #F3F4F6', borderRadius: '8px', overflow: 'hidden' }}>
                      {/* Parent Row */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '1rem 1.25rem', 
                        background: cat.ativo ? '#FFF' : '#F9FAFB',
                        transition: 'background 0.2s'
                      }}>
                        <button 
                          onClick={() => toggleExpand(cat.id)}
                          style={{ marginRight: '1rem', color: '#94A3B8' }}
                        >
                          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </button>
                        
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontWeight: 700, color: cat.ativo ? NAVY : '#9CA3AF', fontSize: '1rem' }}>
                            {cat.nome}
                            {!cat.ativo && <span style={{ marginLeft: '0.75rem', fontSize: '0.7rem', background: '#E5E7EB', color: '#6B7280', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle' }}>INATIVO</span>}
                          </h3>
                          <p style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{children.length} subcategorias vinculadas</p>
                        </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => openCategoryModal(cat)} className="btn-icon" title="Editar" disabled={togglingId === cat.id}><Edit3 size={18} /></button>
                            <button 
                              onClick={() => handleToggleStatus('ti_categorias', cat.id, cat.ativo)}
                              className={cat.ativo ? 'btn-icon text-red' : 'btn-icon text-green'}
                              title={cat.ativo ? 'Inativar' : 'Reativar'}
                              disabled={togglingId === cat.id}
                            >
                              {togglingId === cat.id ? <Loader2 className="animate-spin" size={18} /> : (cat.ativo ? <PowerOff size={18} /> : <Power size={18} />)}
                            </button>
                          </div>
                      </div>

                      {/* Children List */}
                      {isExpanded && (
                        <div style={{ background: '#F9FAFB', borderTop: '1px solid #F3F4F6', padding: '0.5rem 1.25rem 1rem 3.5rem' }}>
                          {children.length === 0 ? (
                            <p style={{ fontSize: '0.875rem', color: '#9CA3AF', fontStyle: 'italic', padding: '0.5rem 0' }}>Nenhuma subcategoria</p>
                          ) : (
                            children.map(sub => (
                              <div key={sub.id} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                padding: '0.6rem 0',
                                borderBottom: '1px solid #F1F5F9'
                              }}>
                                <span style={{ fontSize: '0.9rem', color: sub.ativo ? '#374151' : '#9CA3AF', fontWeight: 500 }}>
                                  {sub.nome}
                                  {!sub.ativo && <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>(Inativo)</span>}
                                </span>
                                <button 
                                  onClick={() => handleToggleStatus('ti_categorias', sub.id, sub.ativo)}
                                  style={{ color: sub.ativo ? '#EF4444' : '#10B981', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                  disabled={togglingId === sub.id}
                                >
                                  {togglingId === sub.id && <Loader2 className="animate-spin" size={12} />}
                                  {sub.ativo ? 'Inativar' : 'Ativar'}
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'sla' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem' }}>
                <div style={{ borderBottom: '2px solid #F1F5F9', paddingBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: NAVY }}>Configuração de Severidade por Subcategoria</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '0.25rem' }}>
                    Defina a severidade padrão para cada subcategoria. Isso determinará o <b>SLA automático</b> na abertura do chamado.
                  </p>
                </div>

                <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                        <th style={{ textAlign: 'left', padding: '1rem 1.5rem', color: '#475569', fontWeight: 700 }}>Catálogo / Subcategoria</th>
                        <th style={{ textAlign: 'center', padding: '1rem 1.5rem', color: '#475569', fontWeight: 700, width: '240px' }}>Severidade Padrão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rootCats.map(parent => {
                        const children = categorias.filter(c => c.categoria_pai === parent.id && c.ativo)
                        if (children.length === 0) return null

                        return (
                          <React.Fragment key={parent.id}>
                            <tr style={{ background: '#F1F5F9' }}>
                              <td colSpan={2} style={{ padding: '0.75rem 1.5rem', fontWeight: 800, color: NAVY, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {parent.nome}
                              </td>
                            </tr>
                            {children.map(sub => {
                              const isToggling = togglingId === sub.id
                              return (
                                <tr key={sub.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                  <td style={{ padding: '0.75rem 1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <ChevronRight size={14} color="#CBD5E1" />
                                      <span style={{ fontWeight: 600, color: '#334155' }}>{sub.nome}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.75rem 1.5rem', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                      <select
                                        value={sub.severidade || ''}
                                        onChange={async (e) => {
                                          const val = e.target.value as TiPrioridade || null
                                          setTogglingId(sub.id)
                                          try {
                                            await atualizarSeveridadeCategoriaAction(sub.id, val)
                                            await carregarDados()
                                          } finally {
                                            setTogglingId(null)
                                          }
                                        }}
                                        disabled={isToggling}
                                        style={{
                                          padding: '0.5rem 0.75rem',
                                          borderRadius: '8px',
                                          border: '1px solid #E2E8F0',
                                          fontSize: '0.875rem',
                                          background: '#FFF',
                                          color: sub.severidade ? 
                                            (sub.severidade === 'critica' ? '#EF4444' : 
                                             sub.severidade === 'alta' ? '#F97316' : 
                                             sub.severidade === 'media' ? '#3B82F6' : '#64748B') 
                                            : '#94A3B8',
                                          fontWeight: sub.severidade ? 700 : 400,
                                          cursor: isToggling ? 'wait' : 'pointer',
                                          minWidth: '140px',
                                          outline: 'none'
                                        }}
                                      >
                                        <option value="">Não Definida</option>
                                        <option value="critica" style={{ color: '#EF4444', fontWeight: 700 }}>🔴 Crítica (4h)</option>
                                        <option value="alta" style={{ color: '#F97316', fontWeight: 700 }}>🟠 Alta (8h)</option>
                                        <option value="media" style={{ color: '#3B82F6', fontWeight: 700 }}>🔵 Média (24h)</option>
                                        <option value="baixa" style={{ color: '#64748B', fontWeight: 700 }}>⚪ Baixa (72h)</option>
                                      </select>
                                      {isToggling && <Loader2 className="animate-spin" size={16} color={BLUE} />}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#F0F9FF', padding: '1.25rem', borderRadius: '12px', border: '1px solid #BAE6FD' }}>
                  <AlertCircle size={20} color="#0369A1" />
                  <p style={{ fontSize: '0.85rem', color: '#0369A1', lineHeight: '1.5' }}>
                    <b>Informação:</b> Ao selecionar uma severidade, o sistema aplicará automaticamente o prazo correspondente. 
                    Se "Não Definida" for selecionado, o chamado usará a prioridade padrão (Média).
                  </p>
                </div>
              </div>
            )}

            {(activeTab === 'setores' || activeTab === 'unidades') && (
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase' }}>Nome</th>
                    <th style={{ textAlign: 'center', padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', width: '120px' }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', width: '100px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === 'setores' ? setores : unidades).map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.95rem', fontWeight: 500, color: item.ativo ? '#1F2937' : '#9CA3AF' }}>
                        {item.nome}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 700, 
                          padding: '0.25rem 0.6rem', 
                          borderRadius: '99px',
                          background: item.ativo ? '#ECFDF5' : '#F3F4F6',
                          color: item.ativo ? '#10B981' : '#6B7280'
                        }}>
                          {item.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => openSimpleModal(activeTab, item)} className="btn-icon" disabled={togglingId === item.id}><Edit3 size={16} /></button>
                          <button 
                            onClick={() => handleToggleStatus(activeTab === 'setores' ? 'ti_setores' : 'ti_unidades', item.id, item.ativo)}
                            className={item.ativo ? 'btn-icon text-red' : 'btn-icon text-green'}
                            disabled={togglingId === item.id}
                          >
                            {togglingId === item.id ? <Loader2 className="animate-spin" size={16} /> : (item.ativo ? <PowerOff size={16} /> : <Power size={16} />)}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

          </div>
        )}
      </main>

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
          <div style={{ background: '#FFF', borderRadius: '16px', width: '100%', maxWidth: modalType === 'categorias' ? '540px' : '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 1.5rem', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: NAVY }}>
                {editingItem ? 'Editar' : 'Novo'} {modalType === 'categorias' ? 'Catálogo' : modalType === 'setores' ? 'Setor' : 'Unidade'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ color: '#94A3B8' }}><X size={24} /></button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {modalType === 'sla' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Categoria</label>
                    <select 
                      value={slaCategoriaId} 
                      onChange={e => setSlaCategoriaId(e.target.value)}
                      className="input"
                    >
                      <option value="">Todas as Categorias (Geral)</option>
                      {rootCats.map(parent => (
                        <optgroup key={parent.id} label={parent.nome}>
                          <option value={parent.id}>Apenas {parent.nome}</option>
                          {categorias.filter(c => c.categoria_pai === parent.id).map(sub => (
                            <option key={sub.id} value={sub.id}>&nbsp;&nbsp;↳ {sub.nome}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Prioridade</label>
                      <select 
                        value={slaPrioridade} 
                        onChange={e => setSlaPrioridade(e.target.value as any)}
                        className="input"
                      >
                        <option value="critica">Crítica</option>
                        <option value="alta">Alta</option>
                        <option value="media">Média</option>
                        <option value="baixa">Baixa</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Prazo (Horas)</label>
                      <input 
                        type="number" 
                        value={slaPrazoHoras} 
                        onChange={e => setSlaPrazoHoras(Number(e.target.value))}
                        className="input"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#F9FAFB', padding: '0.75rem', borderRadius: '8px' }}>
                    <input 
                      type="checkbox" 
                      id="horario_comercial"
                      checked={slaHorarioComercial} 
                      onChange={e => setSlaHorarioComercial(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="horario_comercial" style={{ fontSize: '0.875rem', color: '#4B5563', fontWeight: 500, cursor: 'pointer' }}>
                      Considerar apenas Horário Comercial (08h às 18h)
                    </label>
                  </div>
                </div>
              ) : modalType === 'categorias' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Nome do Catálogo (Pai)</label>
                    <input 
                      type="text" 
                      value={catName} 
                      onChange={e => setCatName(e.target.value)}
                      placeholder="Ex: Hardware, Software, E-mail..."
                      className="input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Severidade Padrão</label>
                    <select 
                      value={catSeveridade} 
                      onChange={e => setCatSeveridade(e.target.value as TiPrioridade | '')}
                      className="input"
                    >
                      <option value="">Não Definida</option>
                      <option value="critica">Crítica (4h)</option>
                      <option value="alta">Alta (8h)</option>
                      <option value="media">Média (24h)</option>
                      <option value="baixa">Baixa (72h)</option>
                    </select>
                    <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.4rem' }}>
                      Define a prioridade automática para este catálogo/subcategoria.
                    </p>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Subcategorias</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      <input 
                        type="text" 
                        value={newSubName} 
                        onChange={e => setNewSubName(e.target.value)}
                        placeholder="Nome da subcategoria"
                        className="input"
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), subCats.includes(newSubName) || !newSubName.trim() ? null : (setSubCats([...subCats, newSubName.trim()]), setNewSubName('')))}
                      />
                      <button 
                        onClick={() => {
                          if (!newSubName.trim() || subCats.includes(newSubName.trim())) return
                          setSubCats([...subCats, newSubName.trim()])
                          setNewSubName('')
                        }}
                        style={{ padding: '0 1rem', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '8px', color: NAVY }}
                      >
                        <ListPlus size={20} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', minHeight: '40px', padding: '0.5rem', border: '1px dashed #E2E8F0', borderRadius: '8px' }}>
                      {subCats.length === 0 && <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: 'auto' }}>Adicione subcategorias acima</p>}
                      {subCats.map((sub, i) => (
                        <div key={i} style={{ background: '#EFF6FF', color: BLUE, padding: '4px 10px', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {sub}
                          <button onClick={() => setSubCats(subCats.filter((_, idx) => idx !== i))} style={{ color: '#94A3B8' }}><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Nome</label>
                  <input 
                    type="text" 
                    value={simpleName} 
                    onChange={e => setSimpleName(e.target.value)}
                    placeholder={`Nome do ${modalType.slice(0, -1)}`}
                    className="input"
                  />
                </div>
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', background: '#F9FAFB', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
              <button 
                onClick={handleSave} 
                className="btn-primary" 
                disabled={saving || (modalType === 'categorias' ? !catName : !simpleName)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          font-size: 0.95rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input:focus {
          outline: none;
          border-color: #2563EB;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .btn-primary {
          background: #1E3A5F;
          color: #FFF;
          border: none;
          padding: 0.6rem 1.25rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-primary:hover:not(:disabled) { background: #162C4A; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        
        .btn-secondary {
          background: #FFF;
          color: #4B5563;
          border: 1px solid #E5E7EB;
          padding: 0.6rem 1.25rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-secondary:hover { background: #F9FAFB; }

        .btn-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          border: 1px solid #F3F4F6;
          background: #FFF;
          color: #6B7280;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-icon:hover { background: #F9FAFB; color: #1E3A5F; }
        .text-red { color: #EF4444 !important; }
        .text-green { color: #10B981 !important; }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}
