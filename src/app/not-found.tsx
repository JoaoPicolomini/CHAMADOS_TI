'use client'


import Link from 'next/link'
import { FileQuestion, Home } from 'lucide-react'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: BG, fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <div style={{ background: 'white', padding: '48px', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', textAlign: 'center', maxWidth: 500, width: '100%', border: '1px solid #E5E7EB' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ background: '#EFF6FF', padding: 24, borderRadius: '50%' }}>
            <FileQuestion size={64} style={{ color: BLUE }} />
          </div>
        </div>
        
        <h1 style={{ margin: '0 0 16px', fontSize: '2rem', fontWeight: 700, color: NAVY }}>
          404 - Página Não Encontrada
        </h1>
        
        <p style={{ margin: '0 0 32px', color: '#6B7280', fontSize: '1.1rem', lineHeight: 1.5 }}>
          A página que você está procurando não existe, foi removida ou você não tem permissão para acessá-la.
        </p>
        
        <Link href="/ti/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: BLUE, color: 'white', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, transition: 'background 0.2s', fontSize: '1rem' }}>
          <Home size={18} />
          Voltar para o Painel
        </Link>
      </div>
    </div>
  )
}
