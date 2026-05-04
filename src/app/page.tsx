import Image from 'next/image'
import Link from 'next/link'
import { HeadphonesIcon, LogIn, ChevronRight, Clock, ShieldCheck, BarChart3, Zap, BookOpen } from 'lucide-react'

export default function HomePage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--cl-beige)' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#1E3A5F',
        padding: '0 2rem',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Image src="/logo-costalavos-app.png" alt="Costa Lavos" width={34} height={34}
            style={{ objectFit: 'contain', borderRadius: '8px' }} priority />
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
              Costa Lavos
            </div>
            <div style={{
              fontSize: '0.625rem', color: 'var(--cl-gold)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1,
            }}>
              Central de T.I
            </div>
          </div>
        </div>

        <Link href="/auth/login" className="landing-header-btn">
          <LogIn size={15} />
          Acesso Interno
        </Link>
      </header>

      {/* ── Hero ── */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '3rem 1.5rem 4rem',
      }}>

        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }} className="animate-fade-in">
          <div style={{
            width: 96, height: 96, borderRadius: '24px',
            background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 8px 32px rgba(106,16,37,0.18), 0 0 0 4px var(--cl-bordeaux-subtle)',
          }}>
            <Image src="/logo-costalavos-app.png" alt="Costa Lavos" width={68} height={68}
              style={{ objectFit: 'contain' }} priority />
          </div>

          {/* Gold separator */}
          <div style={{
            width: 80, height: 2, margin: '0 auto 1.5rem',
            background: 'linear-gradient(90deg, transparent, var(--cl-gold), transparent)',
          }} />

          <h1 style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 800,
            color: 'var(--cl-burgundy)',
            margin: '0 0 0.75rem',
            lineHeight: 1.15,
          }}>
            Central de Chamados T.I
          </h1>
          <p style={{
            fontSize: '1.0625rem',
            color: 'var(--cl-text-secondary)',
            maxWidth: 460,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            Suporte técnico ágil e eficiente para todos os colaboradores da Costa Lavos.
          </p>
        </div>

        {/* ── Action Cards ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          maxWidth: 960,
          width: '100%',
          marginBottom: '3rem',
        }} className="animate-fade-in">

          {/* Abrir Chamado */}
          <div className="card landing-card-action" style={{
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            border: '1px solid var(--cl-border)',
            transition: 'box-shadow 0.2s, transform 0.2s',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--cl-bordeaux) 0%, var(--cl-bordeaux-light) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(106,16,37,0.2)',
            }}>
              <HeadphonesIcon size={24} color="#fff" />
            </div>

            <div>
              <h2 style={{ fontSize: '1.1875rem', fontWeight: 700, color: 'var(--cl-text)', margin: '0 0 0.375rem' }}>
                Abrir um Chamado
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--cl-text-muted)', lineHeight: 1.55, margin: 0 }}>
                Registre um incidente, solicitação ou problema sem precisar de login. Receba atualização por e-mail.
              </p>
            </div>

            <Link href="/ti/abrir" className="btn btn-primary" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem', marginTop: 'auto',
            }}>
              Abrir Chamado
              <ChevronRight size={16} />
            </Link>
          </div>

          {/* Acesso Interno */}
          <div className="card landing-card-action" style={{
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            border: '1px solid var(--cl-border)',
            background: 'linear-gradient(160deg, #fff 60%, rgba(30,58,95,0.04) 100%)',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '14px',
              background: 'linear-gradient(135deg, #1E3A5F 0%, #2C5282 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(30,58,95,0.22)',
            }}>
              <LogIn size={24} color="#fff" />
            </div>

            <div>
              <h2 style={{ fontSize: '1.1875rem', fontWeight: 700, color: 'var(--cl-text)', margin: '0 0 0.375rem' }}>
                Acesso Interno
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--cl-text-muted)', lineHeight: 1.55, margin: 0 }}>
                Para colaboradores e técnicos de T.I. Acesse o painel completo com sua conta corporativa.
              </p>
            </div>

            <Link href="/auth/login" className="btn" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem', marginTop: 'auto',
              background: '#0078D4', color: '#fff', border: 'none',
              fontWeight: 600, borderRadius: 'var(--radius-sm)',
            }}>
              Entrar
              <LogIn size={15} />
            </Link>
          </div>

          {/* Base de Conhecimento */}
          <div className="card landing-card-action" style={{
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            border: '1px solid var(--cl-border)',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '14px',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(5,150,105,0.2)',
            }}>
              <BookOpen size={24} color="#fff" />
            </div>

            <div>
              <h2 style={{ fontSize: '1.1875rem', fontWeight: 700, color: 'var(--cl-text)', margin: '0 0 0.375rem' }}>
                Base de Conhecimento
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--cl-text-muted)', lineHeight: 1.55, margin: 0 }}>
                Consulte manuais, FAQs e tutoriais para resolver problemas comuns rapidamente.
              </p>
            </div>

            <Link href="/ti/base-conhecimento?public=true" className="btn" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem', marginTop: 'auto',
              background: '#F9FAFB', color: '#374151', border: '1px solid #D1D5DB',
              fontWeight: 600, borderRadius: 'var(--radius-sm)',
            }}>
              Acessar Base
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        {/* ── Feature Strip ── */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.5rem',
          justifyContent: 'center',
          maxWidth: 640,
        }} className="animate-fade-in">
          {[
            { icon: <Zap size={15} />, label: 'Atendimento Ágil', sub: 'Triagem automática e SLA monitorado' },
            { icon: <Clock size={15} />, label: 'Acompanhamento em Tempo Real', sub: 'Notificações por e-mail a cada atualização' },
            { icon: <BarChart3 size={15} />, label: 'Relatórios & Analytics', sub: 'Métricas e histórico detalhados' },
            { icon: <ShieldCheck size={15} />, label: 'Seguro e Auditável', sub: 'Logs completos de todas as ações' },
          ].map(({ icon, label, sub }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
              padding: '0.75rem 1rem',
              background: '#fff',
              border: '1px solid var(--cl-border)',
              borderRadius: 'var(--radius-sm)',
              flex: '1 1 240px',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '8px',
                background: 'var(--cl-bordeaux-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--cl-bordeaux)', flexShrink: 0,
              }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--cl-text)', lineHeight: 1.3 }}>{label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cl-text-muted)', lineHeight: 1.4 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{
        padding: '1.25rem 2rem',
        borderTop: '1px solid var(--cl-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        background: '#fff',
      }}>
        <div style={{
          width: 4, height: 4, borderRadius: '50%',
          background: 'var(--cl-gold)',
        }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--cl-text-muted)' }}>
          © {new Date().getFullYear()} Costa Lavos RNC — Departamento de Tecnologia da Informação
        </span>
        <div style={{
          width: 4, height: 4, borderRadius: '50%',
          background: 'var(--cl-gold)',
        }} />
      </footer>
    </div>
  )
}
