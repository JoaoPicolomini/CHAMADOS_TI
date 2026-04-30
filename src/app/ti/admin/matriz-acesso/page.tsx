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
  toggleProfilePermissionAdminAction
} from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

const PERFIS = ['user', 'tecnico', 'gestor_ti', 'admin']

export default function MatrizAcessoPage() {
  const router = useRouter()
  const { accounts } = useMsal()

  const [authReady, setAuthReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  
  const [permissions, setPermissions] = useState<any[]>([])
  const [profilePermissions, setProfilePermissions] = useState<Record<string, string[]>>({
    user: [], tecnico: [], gestor_ti: [], admin: []
  })
  
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null) // '{perfil}-{permission}'

  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      // Must be admin for this critical module
      if (!r.granted || r.perfil !== 'admin') {
        router.push('/ti/dashboard')
        return
      }
      setIsAdmin(true)
      setAuthReady(true)
    })
  }, [accounts, router])

  const carregar = useCallback(async () => {
    setLoading(true)
    
    const [resPerms, resProfPerms] = await Promise.all([
      buscarPermissoesAdminAction(),
      buscarPerfilPermissoesAdminAction()
    ])
    
    if (resPerms.success) setPermissions(resPerms.permissions || [])
    
    if (resProfPerms.success) {
      const map: Record<string, string[]> = { user: [], tecnico: [], gestor_ti: [], admin: [] }
      resProfPerms.profilePermissions?.forEach((pp: any) => {
        if (!map[pp.perfil]) map[pp.perfil] = []
        map[pp.perfil].push(pp.permission)
      })
      setProfilePermissions(map)
    }
    
    setLoading(false)
  }, [])

  useEffect(() => { if (authReady) carregar() }, [authReady, carregar])

  async function handleToggle(perfil: string, permissionCode: string, isChecked: boolean) {
    const toggleId = `${perfil}-${permissionCode}`
    setToggling(toggleId)
    
    // Optimistic update
    setProfilePermissions(prev => {
      const copy = { ...prev }
      if (isChecked) {
        copy[perfil] = [...(copy[perfil] || []), permissionCode]
      } else {
        copy[perfil] = (copy[perfil] || []).filter(p => p !== permissionCode)
      }
      return copy
    })
    
    const res = await toggleProfilePermissionAdminAction(perfil, permissionCode, isChecked)
    
    if (!res.success) {
      // Revert on failure
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
            <span>Matriz de Acesso</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={24} style={{ color: BLUE }} />
            Matriz de Acesso
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.9rem' }}>
            Controle quais perfis têm acesso a cada funcionalidade do sistema. (Módulo restrito a admins)
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, background: 'white', borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <p style={{ margin: 0, color: '#6B7280' }}>Carregando permissões...</p>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#1E3A5F', color: 'white', textAlign: 'left' }}>
                  <th style={{ padding: '16px', fontWeight: 600, borderTopLeftRadius: 10 }}>Permissão</th>
                  {PERFIS.map(perfil => (
                    <th key={perfil} style={{ padding: '16px', fontWeight: 600, textAlign: 'center', textTransform: 'capitalize' }}>
                      {perfil.replace('_', ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(groupedPermissions).map(group => (
                  <React.Fragment key={group}>
                    {/* Cabeçalho do Grupo */}
                    <tr style={{ background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
                      <td colSpan={5} style={{ padding: '8px 16px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                        Módulo: {group}
                      </td>
                    </tr>
                    
                    {groupedPermissions[group].map((p: any) => (
                      <tr key={p.code} className="row-hover" style={{ borderBottom: '1px solid #E5E7EB', transition: 'background 0.2s' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#111827', fontFamily: 'monospace', fontSize: '0.8rem', background: '#F3F4F6', display: 'inline-block', padding: '2px 6px', borderRadius: 4, marginBottom: 4 }}>
                            {p.code}
                          </div>
                          <div style={{ color: '#4B5563', fontSize: '0.85rem' }}>{p.label}</div>
                          {p.descricao && <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 2 }}>{p.descricao}</div>}
                        </td>
                        
                        {PERFIS.map(perfil => {
                          const isChecked = profilePermissions[perfil]?.includes(p.code)
                          const isToggling = toggling === `${perfil}-${p.code}`
                          
                          return (
                            <td key={`${perfil}-${p.code}`} style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <input 
                                type="checkbox"
                                className="toggle-checkbox"
                                checked={isChecked || false}
                                disabled={isToggling}
                                onChange={(e) => handleToggle(perfil, p.code, e.target.checked)}
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
