'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import { Loader2, LayoutDashboard, Settings, Save, AlertCircle } from 'lucide-react'
import { checkTiUserAccess, buscarSatisfacaoConfigAction, salvarSatisfacaoConfigAction } from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

export default function ConfigPage() {
  const router = useRouter()
  const { accounts } = useMsal()

  const [authReady, setAuthReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  
  const [config, setConfig] = useState({
    id: '',
    ativa: true,
    horas_apos_fechamento: 1,
    lembrete_horas: 24,
    max_lembretes: 2
  })

  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted || (!['admin', 'gestor_ti'].includes(r.perfil ?? '') && !r.permissions.includes('config.view'))) {
        router.push('/ti/dashboard')
        return
      }
      setIsAdmin(true)
      setAuthReady(true)
    })
  }, [accounts, router])

  useEffect(() => {
    if (!authReady) return
    
    async function carregar() {
      setLoading(true)
      const res = await buscarSatisfacaoConfigAction()
      if (res.success && res.data) {
        setConfig(res.data)
      } else {
        setErrorMsg(res.error || 'Erro ao carregar configurações.')
      }
      setLoading(false)
    }
    carregar()
  }, [authReady])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdmin && !config.id) return
    
    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')
    
    const res = await salvarSatisfacaoConfigAction(config)
    
    if (res.success) {
      setSuccessMsg('Configurações salvas com sucesso!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } else {
      setErrorMsg(res.error || 'Erro ao salvar configurações.')
    }
    
    setSaving(false)
  }

  if (!authReady || loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
      <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
        
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.8rem', color: '#6B7280' }}>
            <Link href="/ti/dashboard" style={{ color: '#6B7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <LayoutDashboard size={13} /> Painel
            </Link>
            <span>›</span>
            <span>Configurações</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={24} style={{ color: BLUE }} />
            Configurações Gerais
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.9rem' }}>
            Gerencie os parâmetros globais do sistema de chamados.
          </p>
        </div>

        {errorMsg && (
          <div style={{ background: '#FEF2F2', border: '1px solid #F87171', color: '#B91C1C', padding: 12, borderRadius: 8, marginBottom: 24, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={18} /> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ background: '#ECFDF5', border: '1px solid #34D399', color: '#047857', padding: 12, borderRadius: 8, marginBottom: 24, fontSize: '0.9rem' }}>
            {successMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: 24 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: NAVY, marginTop: 0, marginBottom: 16, borderBottom: '1px solid #E5E7EB', paddingBottom: 12 }}>
            Pesquisa de Satisfação (CSAT)
          </h2>
          
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, color: '#374151', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={config.ativa}
                onChange={e => setConfig({ ...config, ativa: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: BLUE }}
              />
              Ativar envio automático de pesquisa de satisfação
            </label>
            <p style={{ margin: '4px 0 0 24px', fontSize: '0.8rem', color: '#6B7280' }}>
              Quando ativo, o sistema enviará um e-mail com a pesquisa CSAT após o fechamento do chamado.
            </p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, opacity: config.ativa ? 1 : 0.6, pointerEvents: config.ativa ? 'auto' : 'none' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                Horas após fechamento
              </label>
              <input
                type="number"
                min="0"
                value={config.horas_apos_fechamento}
                onChange={e => setConfig({ ...config, horas_apos_fechamento: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: '0.875rem', outline: 'none' }}
              />
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6B7280' }}>Tempo de espera para enviar o 1º e-mail.</p>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                Lembrete (Horas)
              </label>
              <input
                type="number"
                min="1"
                value={config.lembrete_horas}
                onChange={e => setConfig({ ...config, lembrete_horas: parseInt(e.target.value) || 1 })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: '0.875rem', outline: 'none' }}
              />
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6B7280' }}>Intervalo entre lembretes se não respondido.</p>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                Máximo de Lembretes
              </label>
              <input
                type="number"
                min="0"
                max="5"
                value={config.max_lembretes}
                onChange={e => setConfig({ ...config, max_lembretes: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: '0.875rem', outline: 'none' }}
              />
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6B7280' }}>Quantos lembretes enviar no total.</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E5E7EB', paddingTop: 20 }}>
            <button
              type="submit"
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: saving ? '#9CA3AF' : BLUE, color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.875rem', cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
            >
              {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
