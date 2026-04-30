'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import { 
  Loader2, 
  LayoutDashboard, 
  ShieldCheck, 
  Shield, 
  UserCircle, 
  ChevronRight,
  ShieldAlert,
  Info
} from 'lucide-react'
import { checkTiUserAccess } from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

const PROFILES_DATA = [
  {
    id: 'admin',
    label: 'Administrador',
    description: 'Acesso total e irrestrito a todas as funcionalidades do sistema, incluindo configurações críticas e logs.',
    icon: ShieldAlert,
    color: '#DC2626'
  },
  {
    id: 'gestor_ti',
    label: 'Gestor de T.I',
    description: 'Focado em relatórios analíticos, gestão de técnicos, equipes e monitoramento de SLAs.',
    icon: ShieldCheck,
    color: '#2563EB'
  },
  {
    id: 'tecnico',
    label: 'Técnico',
    description: 'Perfil operacional para atendimento de chamados, gestão da base de conhecimento e ativos.',
    icon: Shield,
    color: '#059669'
  },
  {
    id: 'user',
    label: 'Usuário (Padrão)',
    description: 'Acesso básico para abertura de chamados, consulta de artigos e acompanhamento do próprio histórico.',
    icon: UserCircle,
    color: '#6B7280'
  }
]

export default function PerfisPage() {
  const router = useRouter()
  const { accounts } = useMsal()
  const [authReady, setAuthReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

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
    })
  }, [accounts, router])

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
        <div style={{ marginBottom: 32 }}>
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
          <p style={{ margin: '8px 0 0', color: '#6B7280', fontSize: '1rem' }}>
            Definição e documentação das funções disponíveis no sistema.
          </p>
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
              gap: 8,
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          >
            Acessar Matriz <ChevronRight size={16} />
          </Link>
        </div>

        {/* Profiles Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: 24 }}>
          {PROFILES_DATA.map(profile => (
            <div 
              key={profile.id}
              style={{ 
                background: 'white', 
                borderRadius: 16, 
                padding: 24, 
                border: '1px solid #E5E7EB',
                display: 'flex',
                gap: 20,
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'default'
              }}
              className="card-profile"
            >
              <div style={{ 
                width: 56, 
                height: 56, 
                borderRadius: 14, 
                background: `${profile.color}10`, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <profile.icon size={28} style={{ color: profile.color }} />
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: NAVY }}>{profile.label}</h3>
                  <code style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 6, background: '#F3F4F6', color: '#6B7280', fontWeight: 600 }}>
                    {profile.id}
                  </code>
                </div>
                <p style={{ margin: 0, color: '#4B5563', lineHeight: 1.5, fontSize: '0.95rem' }}>
                  {profile.description}
                </p>
                
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed #E5E7EB', display: 'flex', gap: 12 }}>
                  <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4, color: '#9CA3AF' }}>
                    <Info size={14} />
                    Status: <span style={{ color: '#059669', fontWeight: 600 }}>Sistema</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <style>{`
          .card-profile:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 24px rgba(0,0,0,0.05);
          }
        `}</style>

      </div>
    </div>
  )
}
