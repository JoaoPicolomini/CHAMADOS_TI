'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertOctagon, RotateCcw, Home } from 'lucide-react'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service in production
    console.error('Unhandled application error:', error)
  }, [error])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: BG, fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <div style={{ background: 'white', padding: '48px', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', textAlign: 'center', maxWidth: 500, width: '100%', border: '1px solid #E5E7EB' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ background: '#FEF2F2', padding: 24, borderRadius: '50%' }}>
            <AlertOctagon size={64} style={{ color: '#DC2626' }} />
          </div>
        </div>
        
        <h1 style={{ margin: '0 0 16px', fontSize: '2rem', fontWeight: 700, color: NAVY }}>
          Ops! Algo deu errado.
        </h1>
        
        <p style={{ margin: '0 0 32px', color: '#6B7280', fontSize: '1.1rem', lineHeight: 1.5 }}>
          Ocorreu um erro inesperado na aplicação. Nossa equipe técnica foi notificada.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div style={{ background: '#F9FAFB', padding: 16, borderRadius: 8, marginBottom: 32, textAlign: 'left', border: '1px solid #E5E7EB', overflowX: 'auto' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#374151', fontSize: '0.875rem' }}>Detalhes do erro (apenas Dev):</p>
            <code style={{ color: '#DC2626', fontSize: '0.8rem', fontFamily: 'monospace' }}>{error.message}</code>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => reset()}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', color: '#374151', border: '1px solid #D1D5DB', padding: '12px 24px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '1rem', transition: 'background 0.2s' }}
            onMouseOver={e => e.currentTarget.style.background = '#F9FAFB'}
            onMouseOut={e => e.currentTarget.style.background = 'white'}
          >
            <RotateCcw size={18} />
            Tentar Novamente
          </button>
          
          <Link href="/ti/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, background: BLUE, color: 'white', border: 'none', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, transition: 'background 0.2s', fontSize: '1rem' }}>
            <Home size={18} />
            Voltar para o Início
          </Link>
        </div>
      </div>
    </div>
  )
}
