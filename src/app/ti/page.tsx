'use client'

import Link from 'next/link'
import { useMsal } from '@azure/msal-react'
import {
  Ticket, LayoutDashboard, BarChart3, BookOpen,
  Clock, AlertCircle, CheckCircle2, ChevronRight,
} from 'lucide-react'

const MODULES = [
  { href: '/ti/dashboard',         label: 'Painel',                icon: LayoutDashboard, desc: 'Todos os chamados com filtros avançados',  color: '#7C3AED', bg: '#F5F3FF' },
  { href: '/ti/meus-chamados',     label: 'Meus Chamados',         icon: Clock,           desc: 'Chamados que você abriu ou está atendendo', color: '#059669', bg: '#ECFDF5' },
  { href: '/ti/analytics',         label: 'Relatórios',            icon: BarChart3,       desc: 'Estatísticas de volume, SLA e CSAT',        color: '#D97706', bg: '#FFFBEB' },
  { href: '/ti/base-conhecimento', label: 'Base de Conhecimento',  icon: BookOpen,        desc: 'Artigos e soluções de suporte',             color: '#0891B2', bg: '#ECFEFF' },
]

export default function TiHomePage() {
  const { accounts } = useMsal()
  const firstName = (accounts[0]?.name || accounts[0]?.username || 'usuário').split(' ')[0]

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: '#1E3A5F', marginBottom: '0.25rem' }}>
          Olá, {firstName}
        </h1>
        <p style={{ color: '#6B7280', fontSize: '0.9375rem', margin: 0 }}>
          Central de Suporte de T.I — o que você precisa hoje?
        </p>
      </div>

      {/* CTA principal */}
      <Link
        href="/ti/abrir"
        style={{
          display: 'flex', alignItems: 'center', gap: '1.5rem',
          background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)',
          borderRadius: '14px', padding: '1.5rem 2rem',
          textDecoration: 'none', marginBottom: '1.75rem',
          boxShadow: '0 6px 20px rgba(37,99,235,0.28)',
        }}
      >
        <div style={{
          width: '52px', height: '52px', background: 'rgba(255,255,255,0.15)',
          borderRadius: '12px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <Ticket size={26} color="#FFFFFF" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '3px' }}>
            Abrir Novo Chamado
          </div>
          <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.72)' }}>
            Registre um incidente, solicitação, problema ou mudança de TI
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.18)', borderRadius: '8px',
          padding: '0.5rem 1rem', color: '#FFFFFF', fontWeight: 600,
          fontSize: '0.875rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          Acessar <ChevronRight size={14} />
        </div>
      </Link>

      {/* Módulos */}
      <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.875rem' }}>
        Módulos
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {MODULES.map(item => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              background: '#FFFFFF', borderRadius: '12px', padding: '1.125rem 1.25rem',
              border: '1px solid #E5E7EB', textDecoration: 'none',
              display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'box-shadow 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#CBD5E1' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#E5E7EB' }}
          >
            <div style={{
              width: '38px', height: '38px', background: item.bg,
              borderRadius: '9px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <item.icon size={19} color={item.color} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem', marginBottom: '2px' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: '1.4' }}>
                {item.desc}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Info rápida */}
      <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.875rem' }}>
        Informações do Suporte
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.875rem' }}>
        {[
          { icon: CheckCircle2, color: '#10B981', label: 'SLA Padrão (Média)',   value: '24 horas' },
          { icon: AlertCircle,  color: '#2563EB', label: 'Horário de Suporte',   value: 'Seg–Sex, 8h–18h' },
          { icon: Clock,        color: '#7C3AED', label: 'Urgências Críticas',   value: 'SLA: 4 horas' },
        ].map(item => (
          <div key={item.label} style={{
            background: '#FFFFFF', borderRadius: '10px', padding: '1rem 1.125rem',
            border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '0.75rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <item.icon size={18} color={item.color} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 500 }}>{item.label}</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>{item.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
