'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMsal } from '@azure/msal-react'
import {
  Search, Plus, X, Loader2, LayoutDashboard,
  Edit2, Check, Shield, Monitor, Eye, Upload,
  Package, Laptop, Cpu, DollarSign, AlertTriangle,
  FileSpreadsheet, ChevronLeft, ChevronRight,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  checkTiUserAccess, buscarAtivosAdminAction, salvarAtivoAdminAction,
  buscarStatsAtivosAction, importarAtivosAdminAction,
} from '@/lib/ti/actions'

const NAVY = '#1E3A5F'
const BLUE = '#2563EB'
const BG   = '#F5F7FA'

const TIPOS      = ['computador', 'notebook', 'monitor', 'impressora', 'telefone', 'servidor', 'switch', 'nobreak', 'outros']
const STATUS_OPTS = ['ativo', 'manutencao', 'descartado', 'emprestado', 'reserva']

type Stats = { total: number; notebook: number; monitor: number; computador: number; manutencao: number; emUso: number; disponiveis: number; valorTotal: number }

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function parseCurrency(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return val
  
  // Se for string, limpar formatacao brasileira (R$ 1.234,56) ou americana (1,234.56)
  let s = String(val).replace(/[R$\s]/g, '').trim()
  if (!s) return null

  // Lógica para detectar se é formato PT-BR (1.234,56) ou EN (1,234.56)
  // Se houver vírgula e ponto, e a vírgula estiver depois do ponto, é PT-BR
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    if (lastComma > lastDot) {
      // PT-BR: 1.234,56 -> 1234.56
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // EN: 1,234.56 -> 1234.56
      s = s.replace(/,/g, '')
    }
  } else if (s.includes(',')) {
    // Apenas vírgula: assumimos decimal brasileiro (1234,56 -> 1234.56)
    // a menos que pareça separador de milhar americano (ex: 1,234)
    // Mas no contexto do usuário, vírgula é decimal.
    s = s.replace(',', '.')
  }

  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function mapTipo(v: string): string {
  const l = (v || '').toLowerCase()
  if (l.includes('notebook') || l.includes('laptop')) return 'notebook'
  if (l.includes('monitor'))                           return 'monitor'
  if (l.includes('computador') || l.includes('desktop') || l.includes(' pc')) return 'computador'
  if (l.includes('impressora'))  return 'impressora'
  if (l.includes('telefone') || l.includes('celular')) return 'telefone'
  if (l.includes('servidor') || l.includes('server'))  return 'servidor'
  if (l.includes('switch'))   return 'switch'
  if (l.includes('nobreak') || l.includes('ups'))      return 'nobreak'
  return 'outros'
}

function cleanVal(v: any): string | null {
  const s = String(v ?? '').trim()
  return s && s.toLowerCase() !== 'n/a' ? s : null
}

const defaultForm = {
  nome: '', tipo: 'computador', status: 'ativo', patrimonio: '', numero_serie: '',
  fabricante: '', modelo: '', setor: '', responsavel: '',
  ip: '', hostname: '', sistema_operacional: '', data_aquisicao: '', garantia_ate: '',
  valor_compra: '', imei: '', observacoes: '',
}

export default function AtivosAdminPage() {
  const router   = useRouter()
  const { accounts } = useMsal()

  const [authReady, setAuthReady] = useState(false)
  const [ativos,    setAtivos]    = useState<any[]>([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading,   setLoading]   = useState(true)
  const [stats,     setStats]     = useState<Stats | null>(null)

  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [tipoFilter,   setTipoFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Edit/view modal
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editAtivo,  setEditAtivo]  = useState<any>(null)
  const [isView,     setIsView]     = useState(false)
  const [formData,   setFormData]   = useState<any>(defaultForm)
  const [saving,     setSaving]     = useState(false)

  // Import modal
  const [importModal, setImportModal] = useState(false)
  const [importData,  setImportData]  = useState<any[]>([])
  const [importing,   setImporting]   = useState(false)
  const [importDone,  setImportDone]  = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    const account = accounts[0]
    if (!account) return
    checkTiUserAccess(account.username).then(r => {
      if (!r.granted || !['admin', 'gestor_ti'].includes(r.perfil ?? '')) {
        router.push('/ti/dashboard')
        return
      }
      setAuthReady(true)
    })
  }, [accounts, router])

  // ── Stats ─────────────────────────────────────────────────────
  const refreshStats = useCallback(async () => {
    const r = await buscarStatsAtivosAction()
    if (r.success && r.stats) setStats(r.stats)
  }, [])

  useEffect(() => { if (authReady) refreshStats() }, [authReady, refreshStats])

  // ── List ──────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await buscarAtivosAdminAction({
      search:       search       || undefined,
      tipo:         tipoFilter   || undefined,
      status:       statusFilter || undefined,
      page,
    })
    if (res.success) {
      setAtivos(res.ativos)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    }
    setLoading(false)
  }, [search, tipoFilter, statusFilter, page])

  useEffect(() => { if (authReady) carregar() }, [authReady, carregar])
  useEffect(() => { setPage(1) }, [search, tipoFilter, statusFilter])

  function handleSearch() { setSearch(searchInput); setPage(1) }

  // ── Edit modal ────────────────────────────────────────────────
  function openModal(ativo?: any, view = false) {
    setIsView(view)
    if (ativo) {
      setEditAtivo(ativo)
      setFormData({
        nome:               ativo.nome                 || '',
        tipo:               ativo.tipo                 || 'computador',
        status:             ativo.status               || 'ativo',
        patrimonio:         ativo.patrimonio           || '',
        numero_serie:       ativo.numero_serie         || '',
        fabricante:         ativo.fabricante           || '',
        modelo:             ativo.modelo               || '',
        setor:              ativo.setor                || '',
        responsavel:        ativo.responsavel          || '',
        ip:                 ativo.ip                   || '',
        hostname:           ativo.hostname             || '',
        sistema_operacional: ativo.sistema_operacional || '',
        data_aquisicao:     ativo.data_aquisicao       || '',
        garantia_ate:       ativo.garantia_ate         || '',
        valor_compra:       ativo.valor_compra != null ? String(ativo.valor_compra) : '',
        imei:               ativo.imei                 || '',
        observacoes:        ativo.observacoes          || '',
      })
    } else {
      setEditAtivo(null)
      setFormData(defaultForm)
    }
    setModalOpen(true)
  }

  async function handleSave() {
    if (!formData.nome || !formData.tipo) return
    setSaving(true)
    const payload = {
      ...formData,
      id:            editAtivo?.id,
      patrimonio:    formData.patrimonio    || null,
      numero_serie:  formData.numero_serie  || null,
      data_aquisicao: formData.data_aquisicao || null,
      garantia_ate:  formData.garantia_ate  || null,
      valor_compra:  formData.valor_compra  ? parseFloat(String(formData.valor_compra).replace(',', '.')) : null,
      imei:          formData.imei          || null,
    }
    const res = await salvarAtivoAdminAction(payload)
    if (res.success) {
      setModalOpen(false)
      await Promise.all([carregar(), refreshStats()])
    } else {
      alert(`Erro: ${res.error}`)
    }
    setSaving(false)
  }

  // ── Import ────────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]

        if (rows.length < 2) { alert('Arquivo vazio ou sem dados.'); return }

        // Find first non-empty row = header row
        let headerIdx = 0
        while (headerIdx < rows.length && rows[headerIdx].every((c: any) => !c)) headerIdx++

        const headers = rows[headerIdx].map((h: any) => String(h ?? '').toLowerCase())

        const col = (...variants: string[]) => {
          for (const v of variants) {
            const idx = headers.findIndex(h => h.includes(v))
            if (idx >= 0) return idx
          }
          return -1
        }

        const idxTipo  = col('tipo')
        const idxFab   = col('fabricante', 'marca')
        const idxMod   = col('modelo')
        const idxSN    = col('série', 'serie', 'n.º', 's/n', 'serial')
        const idxSetor = col('departamento', 'setor', 'dept')
        const idxValor = col('valor')
        const idxIMEI  = col('imei')
        const idxResp  = col('usuário', 'usuario', 'atual', 'responsável', 'responsavel')

        const parsed: any[] = []
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i]
          if (row.every((c: any) => !c)) continue

          // Skip footer rows (e.g., "1 itens" / "Total: R$...")
          const first = String(row[0] ?? '').trim()
          if (/^\d+\s*iten?s?$/i.test(first) || /^total/i.test(first) || !first) continue

          const fab  = idxFab  >= 0 ? cleanVal(row[idxFab])  ?? '' : ''
          const mod  = idxMod  >= 0 ? cleanVal(row[idxMod])  ?? '' : ''
          const nome = [fab, mod].filter(Boolean).join(' ') || 'Ativo importado'

          parsed.push({
            nome,
            tipo:         idxTipo  >= 0 ? mapTipo(String(row[idxTipo] ?? '')) : 'outros',
            fabricante:   fab  || null,
            modelo:       mod  || null,
            numero_serie: idxSN    >= 0 ? cleanVal(row[idxSN])    : null,
            setor:        idxSetor >= 0 ? cleanVal(row[idxSetor]) : null,
            responsavel:  idxResp  >= 0 ? cleanVal(row[idxResp])  : null,
            valor_compra: idxValor >= 0 ? parseCurrency(row[idxValor]) : null,
            imei:         idxIMEI  >= 0 ? cleanVal(row[idxIMEI])  : null,
            status:       idxResp >= 0 && String(row[idxResp] ?? '').toLowerCase().includes('estoque') ? 'reserva' : 'ativo',
          })
        }

        setImportData(parsed.filter(r => r.nome !== 'Ativo importado'))
        setImportDone(null)
      } catch (err: any) {
        alert(`Erro ao processar arquivo: ${err.message}`)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    if (!importData.length) return
    setImporting(true)
    const res = await importarAtivosAdminAction(importData)
    if (res.success) {
      setImportDone(res.count ?? 0)
      setImportData([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      await Promise.all([carregar(), refreshStats()])
    } else {
      alert(`Erro na importação: ${res.error}`)
    }
    setImporting(false)
  }

  // ── Guards ────────────────────────────────────────────────────
  if (!authReady) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
      <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // ── Input helpers ─────────────────────────────────────────────
  const inp = (field: string) => ({
    className: 'input-base',
    value:     formData[field],
    onChange:  (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setFormData({ ...formData, [field]: e.target.value }),
    disabled:  isView,
    style:     { background: isView ? '#F3F4F6' : 'white' } as React.CSSProperties,
  })

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }
        .btn-hover:hover   { opacity: 0.9; transform: translateY(-1px) }
        .row-hover:hover   { background-color: #F0F7FF !important }
        .input-base        { width: 100%; padding: 8px 12px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; outline: none; box-sizing: border-box; }
        .label-base        { display: block; font-size: 0.8rem; font-weight: 600; color: #374151; margin-bottom: 4px; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.8rem', color: '#6B7280' }}>
              <Link href="/ti/dashboard" style={{ color: '#6B7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <LayoutDashboard size={13} /> Painel
              </Link>
              <span>›</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={13} /> Admin</span>
              <span>›</span>
              <span>Ativos de T.I</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Monitor size={22} style={{ color: BLUE }} />
              Gestão de Ativos de T.I
            </h1>
            <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.875rem' }}>
              Inventário e controle de equipamentos
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setImportDone(null); setImportData([]); setImportModal(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              <FileSpreadsheet size={15} /> Importar Planilha
            </button>
            <button
              onClick={() => openModal()}
              className="btn-hover"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: BLUE, color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s' }}
            >
              <Plus size={16} /> Novo Ativo
            </button>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        {stats && (() => {
          const cards = [
            { label: 'Total de Ativos',   val: String(stats.total),           icon: Package,       color: '#2563EB', bg: '#EFF6FF', big: true  },
            { label: 'Em Uso',             val: String(stats.emUso),           icon: Check,         color: '#16A34A', bg: '#DCFCE7', big: true  },
            { label: 'Em Manutenção',      val: String(stats.manutencao),      icon: AlertTriangle, color: '#D97706', bg: '#FFFBEB', big: true  },
            { label: 'Disponíveis',        val: String(stats.disponiveis),     icon: Package,       color: '#0D9488', bg: '#F0FDFA', big: true  },
            { label: 'Valor do Parque',    val: fmtBRL(stats.valorTotal),      icon: DollarSign,    color: '#059669', bg: '#ECFDF5', big: false },
          ]
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
              {cards.map(c => (
                <div key={c.label} style={{ background: 'white', borderRadius: 10, padding: '14px 14px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.68rem', color: '#6B7280', fontWeight: 500, lineHeight: 1.2 }}>{c.label}</span>
                    <div style={{ width: 26, height: 26, background: c.bg, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <c.icon size={13} color={c.color} />
                    </div>
                  </div>
                  <div style={{ fontSize: c.big ? '1.5rem' : '0.9rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                    {c.val}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        {/* ── Filters ── */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar nome, patrimônio, S/N..."
              style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button onClick={handleSearch} style={{ padding: '8px 14px', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
            Buscar
          </button>
          <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: '0.875rem', background: 'white', minWidth: 130 }}>
            <option value="">Todos os Tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: '0.875rem', background: 'white', minWidth: 130 }}>
            <option value="">Todos os Status</option>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          {(search || tipoFilter || statusFilter) && (
            <button onClick={() => { setSearchInput(''); setSearch(''); setTipoFilter(''); setStatusFilter('') }}
              style={{ padding: '8px 10px', background: 'white', border: '1px solid #D1D5DB', borderRadius: 7, cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
              <X size={13} /> Limpar
            </button>
          )}
          <span style={{ fontSize: '0.8rem', color: '#9CA3AF', marginLeft: 'auto' }}>{total} registro{total !== 1 ? 's' : ''}</span>
        </div>

        {/* ── Table ── */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>
              <Loader2 size={28} style={{ color: BLUE, animation: 'spin 1s linear infinite', marginBottom: 8 }} />
              <p style={{ margin: 0 }}>Carregando...</p>
            </div>
          ) : ativos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>
              <Monitor size={36} style={{ color: '#D1D5DB', marginBottom: 10 }} />
              <p style={{ margin: '0 0 6px', fontWeight: 500 }}>Nenhum ativo encontrado.</p>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Use "Importar Planilha" para carregar sua base de equipamentos.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                  {['Ativo', 'Tipo', 'Fabricante / Modelo', 'Setor / Responsável', 'Valor', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontWeight: 600, fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ativos.map((a, i) => (
                  <tr key={a.id} className="row-hover"
                    style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#fff' : '#FAFAFA', transition: 'background 0.15s' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{a.nome}</div>
                      <div style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: 2 }}>
                        {a.numero_serie && <span>S/N: {a.numero_serie}</span>}
                        {a.patrimonio && <span>{a.numero_serie ? ' · ' : ''}Pat: {a.patrimonio}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        display: 'inline-flex', padding: '2px 8px', borderRadius: 20,
                        fontSize: '0.7rem', fontWeight: 600, textTransform: 'capitalize',
                        background: a.tipo === 'notebook' ? '#EEF2FF' : a.tipo === 'monitor' ? '#F0FDFA' : a.tipo === 'computador' ? '#FAF5FF' : '#F3F4F6',
                        color:      a.tipo === 'notebook' ? '#6366F1' : a.tipo === 'monitor' ? '#0D9488' : a.tipo === 'computador' ? '#9333EA' : '#6B7280',
                      }}>
                        {a.tipo}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {a.fabricante && <div style={{ fontWeight: 500, color: '#374151' }}>{a.fabricante}</div>}
                      {a.modelo     && <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{a.modelo}</div>}
                      {!a.fabricante && !a.modelo && <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {a.setor       && <div style={{ color: '#374151' }}>{a.setor}</div>}
                      {a.responsavel && <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{a.responsavel}</div>}
                      {!a.setor && !a.responsavel && <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      {a.valor_compra != null
                        ? <span style={{ fontWeight: 500, color: '#374151' }}>{fmtBRL(Number(a.valor_compra))}</span>
                        : <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600, textTransform: 'capitalize',
                        background: a.status === 'ativo' ? '#DCFCE7' : a.status === 'manutencao' ? '#FEF3C7' : a.status === 'descartado' ? '#FEE2E2' : '#F3F4F6',
                        color:      a.status === 'ativo' ? '#166534' : a.status === 'manutencao' ? '#92400E' : a.status === 'descartado' ? '#991B1B' : '#374151',
                      }}>
                        {a.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button onClick={() => openModal(a, true)}
                          style={{ padding: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', borderRadius: 4 }} title="Ver">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => openModal(a, false)}
                          style={{ padding: 5, background: 'none', border: 'none', cursor: 'pointer', color: BLUE, borderRadius: 4 }} title="Editar">
                          <Edit2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: 6, cursor: page <= 1 ? 'not-allowed' : 'pointer', background: 'white', color: page <= 1 ? '#D1D5DB' : '#374151', fontSize: '0.8rem' }}>
              <ChevronLeft size={14} /> Anterior
            </button>
            <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>Página {page} de {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '6px 12px', border: '1px solid #D1D5DB', borderRadius: 6, cursor: page >= totalPages ? 'not-allowed' : 'pointer', background: 'white', color: page >= totalPages ? '#D1D5DB' : '#374151', fontSize: '0.8rem' }}>
              Próxima <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            IMPORT MODAL
        ═══════════════════════════════════════════════════ */}
        {importModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: NAVY }}>Importar Ativos via Planilha</h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#6B7280' }}>
                    Aceita .xlsx, .xls, .csv — colunas detectadas automaticamente: Tipo, Fabricante, Modelo, N.º de Série, Departamento, Valor R$, IMEI, Usuário Atual
                  </p>
                </div>
                <button onClick={() => setImportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', marginLeft: 8 }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
                {importDone !== null ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <Check size={30} color="#16A34A" />
                    </div>
                    <h3 style={{ margin: '0 0 6px', color: '#111827', fontSize: '1.1rem' }}>
                      {importDone} ativo{importDone !== 1 ? 's' : ''} importado{importDone !== 1 ? 's' : ''} com sucesso!
                    </h3>
                    <p style={{ margin: '0 0 20px', color: '#6B7280', fontSize: '0.875rem' }}>Os KPIs foram atualizados automaticamente.</p>
                    <button onClick={() => setImportModal(false)}
                      style={{ padding: '8px 28px', background: BLUE, color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>
                      Fechar
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Drop zone */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{ border: '2px dashed #D1D5DB', borderRadius: 8, padding: '28px', textAlign: 'center', cursor: 'pointer', background: '#FAFAFA', marginBottom: 18 }}
                    >
                      <Upload size={30} style={{ color: '#9CA3AF', marginBottom: 8 }} />
                      <p style={{ margin: '0 0 4px', fontWeight: 500, color: '#374151' }}>
                        {importData.length > 0 ? `${importData.length} registros carregados — clique para trocar o arquivo` : 'Clique para selecionar o arquivo'}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#9CA3AF' }}>Formatos: .xlsx, .xls, .csv</p>
                      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileSelect} />
                    </div>

                    {importData.length > 0 && (() => {
                      const nb  = importData.filter(r => r.tipo === 'notebook').length
                      const mo  = importData.filter(r => r.tipo === 'monitor').length
                      const pc  = importData.filter(r => r.tipo === 'computador').length
                      const vt  = importData.reduce((s, r) => s + (r.valor_compra || 0), 0)
                      return (
                        <>
                          {/* Summary pills */}
                          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 16px', marginBottom: 14, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.875rem', color: '#166534', fontWeight: 700 }}>✓ {importData.length} registros</span>
                            {nb > 0 && <span style={{ fontSize: '0.8rem', color: '#374151' }}>💻 {nb} notebooks</span>}
                            {mo > 0 && <span style={{ fontSize: '0.8rem', color: '#374151' }}>🖥 {mo} monitores</span>}
                            {pc > 0 && <span style={{ fontSize: '0.8rem', color: '#374151' }}>🖱 {pc} computadores</span>}
                            {vt > 0 && <span style={{ fontSize: '0.8rem', color: '#374151' }}>💰 {fmtBRL(vt)}</span>}
                          </div>

                          {/* Preview table */}
                          <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                            <div style={{ padding: '7px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
                              Prévia — primeiros {Math.min(5, importData.length)} de {importData.length} registros
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                  <tr style={{ background: '#F9FAFB' }}>
                                    {['Tipo', 'Fabricante', 'Modelo', 'N/S', 'Setor', 'Responsável', 'Valor'].map(h => (
                                      <th key={h} style={{ padding: '6px 12px', fontWeight: 600, color: '#374151', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {importData.slice(0, 5).map((r, i) => (
                                    <tr key={i} style={{ borderTop: '1px solid #F3F4F6' }}>
                                      <td style={{ padding: '6px 12px', textTransform: 'capitalize', color: '#4B5563' }}>{r.tipo}</td>
                                      <td style={{ padding: '6px 12px', color: '#374151' }}>{r.fabricante || '—'}</td>
                                      <td style={{ padding: '6px 12px', color: '#374151' }}>{r.modelo     || '—'}</td>
                                      <td style={{ padding: '6px 12px', color: '#6B7280' }}>{r.numero_serie || '—'}</td>
                                      <td style={{ padding: '6px 12px', color: '#6B7280' }}>{r.setor       || '—'}</td>
                                      <td style={{ padding: '6px 12px', color: '#6B7280' }}>{r.responsavel || '—'}</td>
                                      <td style={{ padding: '6px 12px', color: '#374151', whiteSpace: 'nowrap' }}>
                                        {r.valor_compra ? fmtBRL(r.valor_compra) : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </>
                )}
              </div>

              {importDone === null && (
                <div style={{ padding: '14px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#F9FAFB' }}>
                  <button onClick={() => setImportModal(false)}
                    style={{ padding: '8px 16px', background: 'white', border: '1px solid #D1D5DB', borderRadius: 6, color: '#374151', fontWeight: 500, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={handleImport} disabled={importing || importData.length === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: '#16A34A', border: 'none', borderRadius: 6, color: 'white', fontWeight: 600, cursor: importing || importData.length === 0 ? 'not-allowed' : 'pointer', opacity: importing || importData.length === 0 ? 0.6 : 1 }}>
                    {importing ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={15} />}
                    {importing ? 'Importando...' : `Importar ${importData.length} ativos`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            EDIT / VIEW MODAL
        ═══════════════════════════════════════════════════ */}
        {modalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 740, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: NAVY }}>
                  {isView ? 'Detalhes do Ativo' : editAtivo ? 'Editar Ativo' : 'Novo Ativo'}
                </h3>
                <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Row 1 */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
                  <div><label className="label-base">Nome / Identificação *</label>
                    <input {...inp('nome')} /></div>
                  <div><label className="label-base">Tipo *</label>
                    <select {...inp('tipo')}>
                      {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select></div>
                  <div><label className="label-base">Status *</label>
                    <select {...inp('status')}>
                      {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select></div>
                </div>

                {/* Row 2 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div><label className="label-base">Fabricante</label><input {...inp('fabricante')} /></div>
                  <div><label className="label-base">Modelo</label><input {...inp('modelo')} /></div>
                </div>

                {/* Row 3 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
                  <div><label className="label-base">Patrimônio</label><input {...inp('patrimonio')} /></div>
                  <div><label className="label-base">Número de Série</label><input {...inp('numero_serie')} /></div>
                  <div><label className="label-base">IMEI</label><input {...inp('imei')} /></div>
                  <div><label className="label-base">Valor de Compra (R$)</label>
                    <input
                      className="input-base"
                      type="number" step="0.01" min="0"
                      value={formData.valor_compra}
                      onChange={e => setFormData({ ...formData, valor_compra: e.target.value })}
                      disabled={isView}
                      style={{ background: isView ? '#F3F4F6' : 'white' }}
                    /></div>
                </div>

                {/* Row 4 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
                  <div><label className="label-base">Setor / Local</label><input {...inp('setor')} /></div>
                  <div><label className="label-base">Responsável / Usuário</label><input {...inp('responsavel')} /></div>
                  <div><label className="label-base">IP</label><input {...inp('ip')} /></div>
                  <div><label className="label-base">Hostname</label><input {...inp('hostname')} /></div>
                </div>

                {/* Row 5 */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
                  <div><label className="label-base">Sistema Operacional</label><input {...inp('sistema_operacional')} /></div>
                  <div><label className="label-base">Data Aquisição</label>
                    <input type="date" {...inp('data_aquisicao')} /></div>
                  <div><label className="label-base">Garantia Até</label>
                    <input type="date" {...inp('garantia_ate')} /></div>
                </div>

                <div><label className="label-base">Observações</label>
                  <textarea
                    className="input-base"
                    rows={2}
                    style={{ resize: 'vertical', background: isView ? '#F3F4F6' : 'white' }}
                    value={formData.observacoes}
                    onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                    disabled={isView}
                  /></div>
              </div>

              <div style={{ padding: '14px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#F9FAFB' }}>
                <button onClick={() => setModalOpen(false)}
                  style={{ padding: '8px 16px', background: 'white', border: '1px solid #D1D5DB', borderRadius: 6, color: '#374151', fontWeight: 500, cursor: 'pointer' }}>
                  {isView ? 'Fechar' : 'Cancelar'}
                </button>
                {!isView && (
                  <button onClick={handleSave} disabled={saving || !formData.nome || !formData.tipo}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: BLUE, border: 'none', borderRadius: 6, color: 'white', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: (saving || !formData.nome || !formData.tipo) ? 0.6 : 1 }}>
                    {saving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={15} />}
                    Salvar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
