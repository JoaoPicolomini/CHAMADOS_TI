'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Ticket, BarChart3, Settings, History,
  BookOpen, LogOut, Menu, X, ShieldAlert, Users, Key,
  MailCheck, Home, ShieldCheck, Monitor, Wrench, Clock,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { checkTiUserAccess } from '@/lib/ti/actions'

const NAV_ITEMS = [
  { href: '/ti',                   label: 'Início',             icon: Home,          exact: true },
  { href: '/ti/dashboard',         label: 'Painel',             icon: LayoutDashboard, permission: 'dashboard.view' },
  { href: '/ti/meus-chamados',     label: 'Meus Chamados',      icon: Ticket,        permission: 'chamado.view.own' },
  { href: '/ti/analytics',         label: 'Analytics',          icon: BarChart3,     permission: 'analytics.view' },
  { href: '/ti/base-conhecimento', label: 'Base de Conhecimento', icon: BookOpen,    permission: 'kb.view' },
  { href: '/ti/auditoria',         label: 'Auditoria',          icon: History,       permission: 'audit.view' },
]

const ADMIN_ITEMS = [
  { href: '/ti/admin/usuarios',    label: 'Usuários',           icon: Users,         permission: 'users.manage' },
  { href: '/ti/admin/tecnicos',    label: 'Técnicos e Equipes', icon: Wrench,        permission: 'equipes.manage' },
  { href: '/ti/admin/ativos',      label: 'Ativos de T.I',      icon: Monitor,       permission: 'ativos.manage' },
  { href: '/ti/admin/perfis',      label: 'Perfis de Acesso',   icon: ShieldCheck,   permission: 'users.manage' },
  { href: '/ti/admin/matriz-acesso', label: 'Matriz de Acesso', icon: Key,           permission: 'users.manage' },
  { href: '/ti/admin/sla-monitoring', label: 'Monitor de SLA',  icon: Clock,         permission: 'analytics.view' },
  { href: '/ti/admin/email-logs',  label: 'Logs de E-mail',     icon: MailCheck,     permission: 'email.logs.view' },
  { href: '/ti/config/sla',        label: 'Config SLA',         icon: Settings,      permission: 'config.view' },
]

export default function TiAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const { instance, inProgress, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()

  const [authData, setAuthData] = useState<{
    granted: boolean | null
    perfil?: string
    permissions: string[]
  }>({ granted: null, permissions: [] })

  const isPublicRoute = pathname === '/ti/abrir'

  // Redireciona não-autenticados (ignorar rotas públicas)
  useEffect(() => {
    if (isPublicRoute) return
    if (!isAuthenticated && inProgress === 'none') {
      router.push('/auth/login')
    }
  }, [isAuthenticated, inProgress, router, isPublicRoute])

  // Valida acesso na tabela ti_access_users (ignorar rotas públicas)
  useEffect(() => {
    if (isPublicRoute) return
    async function verify() {
      if (isAuthenticated && accounts[0]?.username) {
        const result = await checkTiUserAccess(accounts[0].username)
        setAuthData({
          granted:     result.granted,
          perfil:      result.perfil,
          permissions: result.permissions,
        })
      }
    }
    verify()
  }, [isAuthenticated, accounts, isPublicRoute])

  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri:
        typeof window !== 'undefined' ? `${window.location.origin}/auth/login` : '/',
    })
  }

  // Rota pública — passa direto sem auth
  if (isPublicRoute) return <>{children}</>

  // Loading MSAL
  if (!isAuthenticated || inProgress !== 'none') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner-semi" style={{ borderTopColor: '#2563EB', margin: '0 auto 1rem' }} />
          <p style={{ color: '#1E3A5F', fontWeight: 600 }}>Autenticando com Microsoft...</p>
        </div>
      </div>
    )
  }

  // Loading DB check
  if (authData.granted === null) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner-semi" style={{ borderTopColor: '#2563EB', margin: '0 auto 1rem' }} />
          <p style={{ color: '#1E3A5F', fontWeight: 600 }}>Verificando acesso...</p>
        </div>
      </div>
    )
  }

  // Acesso negado
  if (authData.granted === false) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA' }}>
        <div style={{ background: '#FFF', padding: '3rem', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', maxWidth: '450px' }}>
          <ShieldAlert size={64} color="#DC2626" style={{ margin: '0 auto 1.5rem' }} />
          <h2 style={{ fontSize: '1.5rem', color: '#1E3A5F', marginBottom: '1rem', fontWeight: 700 }}>Acesso Negado</h2>
          <p style={{ color: '#374151', marginBottom: '2rem', lineHeight: '1.6' }}>
            A conta <b>{accounts[0]?.username}</b> não possui acesso ao sistema de Chamados de T.I.
            Solicite acesso ao administrador do sistema.
          </p>
          <button onClick={handleLogout} className="btn btn-primary" style={{ width: '100%' }}>
            Sair desta conta
          </button>
        </div>
      </div>
    )
  }

  const isAdmin = authData.perfil === 'admin' || authData.perfil === 'gestor_ti'

  // Proteção de rota por permissão
  const allItems = [...NAV_ITEMS, ...ADMIN_ITEMS]
  const sorted = [...allItems].sort((a, b) => b.href.length - a.href.length)
  const normalizedPath = pathname.split('?')[0].replace(/\/$/, '')
  const currentItem = sorted.find(i => normalizedPath.startsWith(i.href) && i.href !== '/ti')

  if (
    currentItem?.permission &&
    !isAdmin &&
    !authData.permissions.includes(currentItem.permission)
  ) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA', padding: '2rem' }}>
        <ShieldAlert size={48} color="#2563EB" style={{ marginBottom: '1rem' }} />
        <h2 style={{ color: '#1E3A5F', marginBottom: '0.5rem' }}>Acesso Restrito</h2>
        <p style={{ textAlign: 'center', maxWidth: '400px', marginBottom: '1.5rem', color: '#374151' }}>
          Seu perfil (<b>{authData.perfil}</b>) não possui acesso ao módulo <b>{currentItem.label}</b>.
        </p>
        <Link href="/ti" className="btn btn-primary">Voltar ao Início</Link>
      </div>
    )
  }

  const userInitial = (accounts[0]?.name || accounts[0]?.username || 'U').charAt(0).toUpperCase()

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: '#F5F7FA' }}>

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          position: 'fixed', top: '0.75rem', left: '0.75rem', zIndex: 60,
          background: '#1E3A5F', border: '1px solid rgba(37,99,235,0.3)',
          borderRadius: '8px', padding: '0.5rem', cursor: 'pointer',
          color: '#FFFFFF', display: 'none',
        }}
        className="ti-mobile-btn"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside style={{
        width: '260px', height: '100dvh', background: '#1E3A5F',
        borderRight: '1px solid rgba(37,99,235,0.15)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', left: 0, top: 0, zIndex: 50,
        transform: mobileOpen ? 'translateX(0)' : undefined,
      }} className="ti-sidebar">

        {/* Logo */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Link href="/ti" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
            <div style={{
              width: '36px', height: '36px', background: '#2563EB',
              borderRadius: '8px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <Monitor size={20} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '1rem' }}>Chamados T.I</div>
              <div style={{ fontSize: '0.625rem', color: 'rgba(96,165,250,1)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Central de Suporte
              </div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <div style={{ padding: '0.75rem 0', flex: 1, overflowY: 'auto' }}>

          {/* Abrir chamado CTA */}
          <Link
            href="/ti/abrir"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1.25rem', margin: '0 0.5rem 0.75rem',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
              color: '#FFFFFF', fontWeight: 600, fontSize: '0.875rem',
              textDecoration: 'none', boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
            }}
          >
            <Ticket size={18} />
            Abrir Novo Chamado
          </Link>

          {/* Menu principal */}
          <div style={{ padding: '0 1.25rem', margin: '0.5rem 0 0.375rem' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>
              Menu
            </span>
          </div>

          <nav>
            {NAV_ITEMS.map(item => {
              const hasPermission = !item.permission ||
                authData.permissions.includes(item.permission) || isAdmin
              if (!hasPermission) return null

              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href) && item.href !== '/ti'

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 1.25rem', margin: '0 0.5rem',
                    borderRadius: '8px', textDecoration: 'none', fontSize: '0.875rem',
                    transition: 'all 0.2s',
                    color: isActive ? '#93C5FD' : 'rgba(255,255,255,0.65)',
                    background: isActive ? 'rgba(37,99,235,0.2)' : 'transparent',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Seção Admin */}
          {(isAdmin || ADMIN_ITEMS.some(i => authData.permissions.includes(i.permission))) && (
            <>
              <div style={{ padding: '0 1.25rem', margin: '1rem 0 0.375rem' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>
                  Administração
                </span>
              </div>
              <nav>
                {ADMIN_ITEMS.map(item => {
                  const hasPermission = !item.permission ||
                    authData.permissions.includes(item.permission) || isAdmin
                  if (!hasPermission) return null

                  const isActive = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.75rem 1.25rem', margin: '0 0.5rem',
                        borderRadius: '8px', textDecoration: 'none', fontSize: '0.875rem',
                        transition: 'all 0.2s',
                        color: isActive ? '#93C5FD' : 'rgba(255,255,255,0.65)',
                        background: isActive ? 'rgba(37,99,235,0.2)' : 'transparent',
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      <item.icon size={18} />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </>
          )}
        </div>

        {/* Footer — usuário */}
        <div style={{
          padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', background: '#2563EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.9375rem', fontWeight: 700, color: '#FFFFFF', flexShrink: 0,
          }}>
            {userInitial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {accounts[0]?.name || accounts[0]?.username?.split('@')[0]}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E' }} />
              <span style={{ fontSize: '0.6875rem', color: '#60A5FA', fontWeight: 600, textTransform: 'lowercase' }}>
                {authData.perfil || 'user'}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sair"
            style={{
              background: 'transparent', border: 'none', padding: '0.5rem',
              borderRadius: '6px', color: 'rgba(255,255,255,0.35)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF' }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main style={{ flex: 1, marginLeft: '260px', padding: '1.5rem 2rem', minHeight: '100dvh' }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .ti-mobile-btn { display: flex !important; }
          .ti-sidebar { transform: translateX(-100%); transition: transform 0.3s ease; }
          main { margin-left: 0 !important; padding: 1rem !important; padding-top: 3.5rem !important; }
        }
      `}</style>
    </div>
  )
}
