'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import { Loader2, LayoutDashboard, Shield, Key } from 'lucide-react'
import { 
  checkTiUserAccess, 
  buscarPermissoesAdminAction, 
  buscarPerfilPermissoesAdminAction,
  toggleProfilePermissionAdminAction,
  buscarPerfisAction
} from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

export default function MatrizAcessoPage() {
  const router = useRouter()
  const { accounts } = useMsal()

  const [authReady, setAuthReady] = useState(false)
  
  const [perfis, setPerfis] = useState<any[]>([])
  const [permissions, setPermissions] = useState<any[]>([])
  const [profilePermissions, setProfilePermissions] = useState<Record<string, string[]>>({})
  
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null) // '{perfil}-{permission}'

  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted || r.perfil !== 'admin') {
        router.push('/ti/dashboard')
        return
      }
      setAuthReady(true)
    })
  }, [accounts, router])

  const carregar = useCallback(async () => {
    setLoading(true)
    
    const [resPerfis, resPerms, resProfPerms] = await Promise.all([
      buscarPerfisAction(),
      buscarPermissoesAdminAction(),
      buscarPerfilPermissoesAdminAction()
    ])
    
    if (resPerfis.success) setPerfis(resPerfis.perfis || [])
    if (resPerms.success) setPermissions(resPerms.permissions || [])
    
    if (resProfPerms.success) {
      const map: Record<string, string[]> = {}
      resProfPerms.profilePermissions?.forEach((pp: any) => {
        if (!map[pp.perfil]) map[pp.perfil] = []
        map[pp.perfil].push(pp.permission)
      })
      setProfilePermissions(map)
    }
    
    setLoading(false)
  }, [])

  useEffect(() => { if (authReady) carregar() }, [authReady, carregar])

  async function handleToggle(perfilSlug: string, permissionCode: string, isChecked: boolean) {
    const toggleId = `${perfilSlug}-${permissionCode}`
    setToggling(toggleId)
    
    // Optimistic update
    setProfilePermissions(prev => {
      const copy = { ...prev }
      if (isChecked) {
        copy[perfilSlug] = [...(copy[perfilSlug] || []), permissionCode]
      } else {
        copy[perfilSlug] = (copy[perfilSlug] || []).filter(p => p !== permissionCode)
      }
      return copy
    })
    
    const res = await toggleProfilePermissionAdminAction(perfilSlug, permissionCode, isChecked)
    
    if (!res.success) {
      alert(`Erro ao atualizar permissão: ${res.error}`)
      carregar() 
    }
    setToggling(null)
  }

  // Agrupar permissões (ex: "chamado.view.own" -> grupo "chamado")
  const groupedPermissions = permissions.reduce((acc: any, p: any) => {
    const prefix = p.code.split('.')[0]
    if (!acc[prefix]) acc[prefix] = []
    acc[prefix].push(p)
    return acc
  }, {})

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
        .toggle-checkbox { width: 18px; height: 18px; cursor: pointer; accent-color: #2563EB; }
        .toggle-checkbox:disabled { opacity: 0.5; cursor: wait; }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
        
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.8rem', color: '#6B7280' }}>
            <Link href="/ti/dashboard" style={{ color: '#6B7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <LayoutDashboard size={13} /> Painel
            </Link>
            <span>›</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={13} /> Admin</span>
            <span>›</span>
            <span>Matriz de Acesso</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={24} style={{ color: BLUE }} />
            Matriz de Acesso Dinâmica
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.9rem' }}>
            Configure permissões para todos os perfis cadastrados no sistema.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, background: 'white', borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <p style={{ margin: 0, color: '#6B7280' }}>Sincronizando perfis e permissões...</p>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', overflowX: 'auto', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#1E3A5F', color: 'white', textAlign: 'left' }}>
                  <th style={{ padding: '20px 16px', fontWeight: 700, minWidth: 280 }}>FUNCIONALIDADE / PERMISSÃO</th>
                  {perfis.map(p => (
                    <th key={p.id} style={{ padding: '16px', fontWeight: 700, textAlign: 'center', minWidth: 120 }}>
                      <div style={{ color: p.cor, fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: 2 }}>{p.slug}</div>
                      <div>{p.nome}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(groupedPermissions).map(group => (
                  <React.Fragment key={group}>
                    {/* Cabeçalho do Grupo */}
                    <tr style={{ background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
                      <td colSpan={perfis.length + 1} style={{ padding: '10px 16px', fontWeight: 800, color: '#1E3A5F', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                        Módulo: {group}
                      </td>
                    </tr>
                    
                    {groupedPermissions[group].map((p: any) => (
                      <tr key={p.code} className="row-hover" style={{ borderBottom: '1px solid #E5E7EB', transition: 'background 0.2s' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#111827', fontFamily: 'monospace', fontSize: '0.75rem', background: '#F1F5F9', display: 'inline-block', padding: '2px 6px', borderRadius: 4, marginBottom: 4, border: '1px solid #E2E8F0' }}>
                            {p.code}
                          </div>
                          <div style={{ fontWeight: 600, color: NAVY, fontSize: '0.9rem' }}>{p.label}</div>
                          {p.descricao && <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 2 }}>{p.descricao}</div>}
                        </td>
                        
                        {perfis.map(perfil => {
                          const isChecked = profilePermissions[perfil.slug]?.includes(p.code)
                          const isToggling = toggling === `${perfil.slug}-${p.code}`
                          
                          return (
                            <td key={`${perfil.slug}-${p.code}`} style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <input 
                                type="checkbox"
                                className="toggle-checkbox"
                                checked={isChecked || false}
                                disabled={isToggling}
                                onChange={(e) => handleToggle(perfil.slug, p.code, e.target.checked)}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
