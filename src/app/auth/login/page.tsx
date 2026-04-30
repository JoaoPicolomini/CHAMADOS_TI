'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { loginRequest } from '@/lib/msal/config'

export default function LoginPage() {
  const { instance } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Quando a página carrega ou o MSAL atualiza o estado de sessão:
  useEffect(() => {
    // Se o usuário completou o login com sucesso e a sessão existe
    if (isAuthenticated) {
      router.push('/ti')
    }
  }, [isAuthenticated, router])

  const handleLogin = async () => {
    setLoading(true)
    try {
      await instance.loginRedirect(loginRequest)
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  // Se já estiver logado (evita piscar a tela de login antes de redirecionar pro dashboard)
  if (isAuthenticated) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cl-beige)' }}>
        Carregando painel...
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', background: 'var(--cl-beige)',
    }}>
      <div className="card animate-fade-in" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: '2.5rem 2rem' }}>
        {/* Logo */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          <Image src="/logo-costalavos-app.png" alt="Costa Lavos" width={120} height={120}
            style={{ objectFit: 'contain', margin: '0 auto' }} priority />
        </div>

        {/* Gold separator */}
        <div style={{
          width: '60px', height: '2px', margin: '0 auto 1.5rem',
          background: 'linear-gradient(90deg, transparent, var(--cl-gold), transparent)',
        }} />

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--cl-burgundy)' }}>
          Acesso Interno
        </h2>
        <p style={{ fontSize: '0.8125rem', color: 'var(--cl-text-muted)', marginBottom: '1.5rem' }}>
          Realize o login utilizando a conta corporativa da Microsoft
        </p>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', backgroundColor: '#0078D4', borderColor: '#0078D4' }}>
          {loading ? 'Redirecionando para a Microsoft...' : 'Entrar com Microsoft'}
        </button>

        <div style={{ fontSize: '0.75rem', color: 'var(--cl-text-muted)' }}>
          Acesso restrito a usuários autorizados MSAL
        </div>

        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--cl-border)' }}>
          <Link href="/ti/abrir" style={{ fontSize: '0.8125rem', color: '#1E3A5F', textDecoration: 'none', fontWeight: 500 }}>
            Abrir um Chamado sem login →
          </Link>
        </div>
      </div>
    </div>
  )
}
