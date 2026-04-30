'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Monitor, ChevronRight, Check, Upload, X, FileText,
  AlertCircle, ArrowLeft, Loader2, CheckCircle2, Ticket,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadAnexoAction } from '@/lib/ti/actions'
import { TIPO_LABELS } from '@/lib/ti/constants'
import type { TiCategoria, TiTipo } from '@/lib/ti/types'

// ─── Constants ───────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Identificação' },
  { id: 2, label: 'Problema' },
  { id: 3, label: 'Evidências' },
]

const SETORES = [
  'Administrativo', 'Comercial', 'Compras', 'Contabilidade', 'Diretoria',
  'Engenharia', 'Estoque', 'Financeiro', 'Jurídico', 'Logística',
  'Marketing', 'Produção', 'Qualidade', 'Recursos Humanos', 'TI', 'Vendas',
]

const MAX_FILES      = 5
const MAX_FILE_BYTES = 20 * 1024 * 1024

// ─── Types ───────────────────────────────────────────────────────
interface FileItem {
  file:      File
  preview:   string | null
  categoria: 'screenshot' | 'log' | 'documento' | 'outro'
}

interface FormState {
  // Etapa 1
  solicitante_nome:    string
  solicitante_email:   string
  solicitante_ramal:   string
  solicitante_setor:   string
  solicitante_unidade: string
  // Etapa 2
  categoria_id:      string
  subcategoria_id:   string
  tipo:              TiTipo
  titulo:            string
  descricao:         string
  passos_reproduzir: string
  ativo_descricao:   string
}

// ─── Helpers ─────────────────────────────────────────────────────
async function compressImage(file: File): Promise<File> {
  const MAX_DIM = 1600
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = e => {
      const img = new Image()
      img.src = e.target?.result as string
      img.onload = () => {
        let w = img.width, h = img.height
        if (w > MAX_DIM) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM }
        if (h > MAX_DIM) { w = Math.round(w * MAX_DIM / h); h = MAX_DIM }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          blob => {
            if (!blob) return resolve(file)
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() }))
          },
          'image/jpeg', 0.82,
        )
      }
      img.onerror = () => resolve(file)
    }
    reader.onerror = () => resolve(file)
  })
}

function guessCategoria(file: File): FileItem['categoria'] {
  if (file.type.startsWith('image/')) return 'screenshot'
  if (file.type === 'text/plain' || file.name.endsWith('.log')) return 'log'
  if (file.type.includes('pdf') || file.type.includes('word') || file.type.includes('excel') || file.type.includes('sheet')) return 'documento'
  return 'outro'
}

// ─── Field wrapper ────────────────────────────────────────────────
function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className={`label${required ? ' label-required' : ''}`}>{label}</label>
      {children}
      {hint  && !error && <div className="field-hint">{hint}</div>}
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────
export default function AbrirChamadoPage() {
  const [step, setStep]               = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess]         = useState<{ numero: string } | null>(null)
  const [errors, setErrors]           = useState<Record<string, string>>({})
  const [categorias, setCategorias]   = useState<TiCategoria[]>([])
  const [files, setFiles]             = useState<FileItem[]>([])
  const [dragOver, setDragOver]       = useState(false)

  const [form, setForm] = useState<FormState>({
    solicitante_nome: '', solicitante_email: '', solicitante_ramal: '',
    solicitante_setor: '', solicitante_unidade: '',
    categoria_id: '', subcategoria_id: '', tipo: 'incidente',
    titulo: '', descricao: '', passos_reproduzir: '', ativo_descricao: '',
  })

  // Load categories via anon supabase client
  useEffect(() => {
    const sb = createClient()
    sb.from('ti_categorias').select('*').eq('ativo', true).order('ordem')
      .then(({ data }) => { if (data) setCategorias(data) })
  }, [])

  const rootCats = categorias.filter(c => c.categoria_pai === null)
  const subCats  = categorias.filter(c => c.categoria_pai === form.categoria_id)

  const update = useCallback((updates: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...updates }))
    const keys = Object.keys(updates)
    setErrors(prev => { const n = { ...prev }; keys.forEach(k => delete n[k]); return n })
  }, [])

  // ─── Validation ────────────────────────────────────────────────
  function validate(s: number): boolean {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!form.solicitante_nome.trim())    e.solicitante_nome  = 'Nome é obrigatório'
      else if (form.solicitante_nome.trim().length < 2) e.solicitante_nome = 'Nome muito curto'
      if (!form.solicitante_email.trim())   e.solicitante_email = 'E-mail é obrigatório'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.solicitante_email)) e.solicitante_email = 'E-mail inválido'
      if (!form.solicitante_setor.trim())   e.solicitante_setor = 'Informe o setor'
    }
    if (s === 2) {
      if (!form.titulo.trim())   e.titulo   = 'Título é obrigatório'
      else if (form.titulo.trim().length < 5) e.titulo = 'Título muito curto (mín. 5 caracteres)'
      if (!form.descricao.trim()) e.descricao = 'Descrição é obrigatória'
      else if (form.descricao.trim().length < 10) e.descricao = 'Descreva o problema com mais detalhes (mín. 10 caracteres)'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function nextStep() { if (validate(step)) setStep(s => s + 1) }
  function prevStep() { setStep(s => s - 1); setErrors({}) }

  // ─── File handling ─────────────────────────────────────────────
  async function addFiles(raw: FileList | File[]) {
    const arr = Array.from(raw)
    const toAdd: FileItem[] = []
    let fileErr = ''

    for (const file of arr) {
      if (files.length + toAdd.length >= MAX_FILES) { fileErr = `Limite de ${MAX_FILES} arquivos atingido`; break }
      if (file.size > MAX_FILE_BYTES) { fileErr = `"${file.name}" excede 20 MB`; continue }

      let processed = file
      let preview: string | null = null
      if (file.type.startsWith('image/')) {
        processed = await compressImage(file)
        preview = URL.createObjectURL(processed)
      }
      toAdd.push({ file: processed, preview, categoria: guessCategoria(file) })
    }

    if (fileErr) setErrors(prev => ({ ...prev, files: fileErr }))
    setFiles(prev => [...prev, ...toAdd])
  }

  function removeFile(idx: number) {
    setFiles(prev => {
      const next = [...prev]
      if (next[idx].preview) URL.revokeObjectURL(next[idx].preview!)
      next.splice(idx, 1)
      return next
    })
  }

  // ─── Submit ────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validate(2)) { setStep(2); return }
    setIsSubmitting(true)
    setErrors({})

    try {
      const res = await fetch('/api/ti/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solicitante_nome:    form.solicitante_nome.trim(),
          solicitante_email:   form.solicitante_email.trim().toLowerCase(),
          solicitante_ramal:   form.solicitante_ramal.trim() || undefined,
          solicitante_setor:   form.solicitante_setor.trim(),
          solicitante_unidade: form.solicitante_unidade.trim() || undefined,
          categoria_id:        form.categoria_id || undefined,
          subcategoria_id:     form.subcategoria_id || undefined,
          tipo:                form.tipo,
          titulo:              form.titulo.trim(),
          descricao:           form.descricao.trim(),
          passos_reproduzir:   form.passos_reproduzir.trim() || undefined,
          ativo_descricao:     form.ativo_descricao.trim() || undefined,
        }),
      })

      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Erro ao criar chamado')

      // Upload attachments via server action
      for (const item of files) {
        const fd = new FormData()
        fd.append('file', item.file)
        fd.append('chamado_id', json.chamado_id)
        fd.append('categoria', item.categoria)
        fd.append('enviado_por', form.solicitante_nome.trim())
        await uploadAnexoAction(fd)
      }

      setSuccess({ numero: json.numero })
    } catch (err: any) {
      setErrors({ submit: err.message || 'Erro ao enviar chamado. Tente novamente.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Success screen ────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ minHeight: '100dvh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '3rem 2.5rem', maxWidth: '460px', width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB' }}>
          <div style={{ width: '68px', height: '68px', background: '#ECFDF5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <CheckCircle2 size={34} color="#10B981" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E3A5F', marginBottom: '0.5rem' }}>
            Chamado aberto!
          </h1>
          <p style={{ color: '#6B7280', marginBottom: '1.75rem', lineHeight: '1.65', fontSize: '0.9375rem' }}>
            Seu chamado foi registrado com sucesso. Um e-mail de confirmação foi enviado e você será notificado sobre as atualizações.
          </p>
          <div style={{ background: '#EFF6FF', border: '2px solid #2563EB', borderRadius: '12px', padding: '1rem 1.5rem', marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.6875rem', color: '#2563EB', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              Número do Chamado
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#1E3A5F', letterSpacing: '3px' }}>
              {success.numero}
            </div>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', marginBottom: '1.75rem' }}>
            Guarde este número para consultar o andamento do atendimento.
          </p>
          <Link
            href="/ti"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.75rem', background: 'linear-gradient(135deg, #1E3A5F, #2563EB)', color: '#FFFFFF', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', fontSize: '0.9375rem' }}
          >
            <ArrowLeft size={16} />
            Voltar ao início
          </Link>
        </div>
      </div>
    )
  }

  // ─── Main render ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: '#F5F7FA' }}>

      {/* Top bar */}
      <header style={{ background: '#1E3A5F', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
        <Link href="/ti" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none', flex: 1 }}>
          <div style={{ width: '30px', height: '30px', background: '#2563EB', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Monitor size={15} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.9375rem', lineHeight: 1.2 }}>Chamados T.I</div>
            <div style={{ fontSize: '0.625rem', color: '#93C5FD', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Abertura de Chamado</div>
          </div>
        </Link>
        <Link href="/ti" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: '0.8125rem', flexShrink: 0 }}>
          <ArrowLeft size={14} /> Voltar
        </Link>
      </header>

      <main style={{ maxWidth: '660px', margin: '2rem auto', padding: '0 1rem 4rem' }}>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '1.75rem' }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', flex: i < STEPS.length - 1 ? 1 : undefined }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.875rem',
                  background: step > s.id ? '#10B981' : step === s.id ? '#2563EB' : '#E5E7EB',
                  color: step >= s.id ? '#FFFFFF' : '#9CA3AF',
                  transition: 'all 0.25s',
                }}>
                  {step > s.id ? <Check size={15} /> : s.id}
                </div>
                <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: step === s.id ? '#2563EB' : '#9CA3AF', whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: '2px', margin: '16px 0.5rem 0', background: step > s.id ? '#10B981' : '#E5E7EB', transition: 'background 0.3s' }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #E5E7EB' }}>

          {/* ── Etapa 1 ── */}
          {step === 1 && (
            <>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1E3A5F', marginBottom: '4px' }}>Seus dados</h2>
              <p style={{ color: '#9CA3AF', fontSize: '0.875rem', marginBottom: '1.75rem' }}>Informe como entraremos em contato com você.</p>

              <div style={{ display: 'grid', gap: '1.25rem' }}>
                <Field label="Nome completo" required error={errors.solicitante_nome}>
                  <input className={`input${errors.solicitante_nome ? ' input-error' : ''}`} placeholder="Ex: João da Silva" value={form.solicitante_nome} onChange={e => update({ solicitante_nome: e.target.value })} autoComplete="name" />
                </Field>

                <Field label="E-mail" required error={errors.solicitante_email}>
                  <input className={`input${errors.solicitante_email ? ' input-error' : ''}`} type="email" placeholder="seu@empresa.com" value={form.solicitante_email} onChange={e => update({ solicitante_email: e.target.value })} autoComplete="email" />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Field label="Setor" required error={errors.solicitante_setor}>
                    <input className={`input${errors.solicitante_setor ? ' input-error' : ''}`} list="ti-setores" placeholder="Ex: Financeiro" value={form.solicitante_setor} onChange={e => update({ solicitante_setor: e.target.value })} />
                    <datalist id="ti-setores">
                      {SETORES.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </Field>
                  <Field label="Unidade / Filial">
                    <input className="input" placeholder="Ex: São Paulo" value={form.solicitante_unidade} onChange={e => update({ solicitante_unidade: e.target.value })} />
                  </Field>
                </div>

                <Field label="Ramal" hint="Opcional — para contato telefônico interno">
                  <input className="input" placeholder="Ex: 1234" value={form.solicitante_ramal} onChange={e => update({ solicitante_ramal: e.target.value })} />
                </Field>
              </div>
            </>
          )}

          {/* ── Etapa 2 ── */}
          {step === 2 && (
            <>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1E3A5F', marginBottom: '4px' }}>Descreva o problema</h2>
              <p style={{ color: '#9CA3AF', fontSize: '0.875rem', marginBottom: '1.75rem' }}>Quanto mais detalhes, mais rápido conseguiremos ajudar.</p>

              <div style={{ display: 'grid', gap: '1.25rem' }}>

                {/* Tipo */}
                <div>
                  <label className="label label-required">Tipo de chamado</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {(['incidente', 'solicitacao', 'problema', 'mudanca'] as TiTipo[]).map(tipo => (
                      <button key={tipo} type="button" onClick={() => update({ tipo })} style={{
                        padding: '0.5rem 1rem', borderRadius: '999px',
                        border: `1.5px solid ${form.tipo === tipo ? '#2563EB' : '#E5E7EB'}`,
                        background: form.tipo === tipo ? '#EFF6FF' : 'transparent',
                        color: form.tipo === tipo ? '#2563EB' : '#6B7280',
                        fontWeight: form.tipo === tipo ? 600 : 400,
                        fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                        {TIPO_LABELS[tipo]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categoria / Subcategoria */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Field label="Categoria">
                    <select className="input" value={form.categoria_id} onChange={e => update({ categoria_id: e.target.value, subcategoria_id: '' })}>
                      <option value="">Selecione...</option>
                      {rootCats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </Field>
                  <Field label="Subcategoria">
                    <select className="input" value={form.subcategoria_id} onChange={e => update({ subcategoria_id: e.target.value })} disabled={!form.categoria_id || subCats.length === 0}>
                      <option value="">Selecione...</option>
                      {subCats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="Título do chamado" required error={errors.titulo} hint={`${form.titulo.length}/255 caracteres`}>
                  <input className={`input${errors.titulo ? ' input-error' : ''}`} placeholder="Descreva brevemente o problema" value={form.titulo} onChange={e => update({ titulo: e.target.value })} maxLength={255} />
                </Field>

                <Field label="Descrição detalhada" required error={errors.descricao}>
                  <textarea className={`input${errors.descricao ? ' input-error' : ''}`} placeholder="Descreva o problema com o máximo de detalhes possível: o que aconteceu, quando começou, qual o impacto..." value={form.descricao} onChange={e => update({ descricao: e.target.value })} rows={4} />
                </Field>

                <Field label="Passos para reproduzir" hint="Opcional — como reproduzir o problema passo a passo">
                  <textarea className="input" placeholder={'1. Abrir o sistema...\n2. Clicar em...\n3. O erro ocorre quando...'} value={form.passos_reproduzir} onChange={e => update({ passos_reproduzir: e.target.value })} rows={3} />
                </Field>

                <Field label="Equipamento afetado" hint="Opcional — hostname, patrimônio ou descrição do ativo">
                  <input className="input" placeholder="Ex: Notebook Dell Latitude / Impressora HP M401" value={form.ativo_descricao} onChange={e => update({ ativo_descricao: e.target.value })} />
                </Field>
              </div>
            </>
          )}

          {/* ── Etapa 3 ── */}
          {step === 3 && (
            <>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1E3A5F', marginBottom: '4px' }}>Evidências</h2>
              <p style={{ color: '#9CA3AF', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
                Opcional — anexe screenshots, logs ou documentos que ajudem a entender o problema.
              </p>

              {/* Drop zone */}
              {files.length < MAX_FILES && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
                  onClick={() => document.getElementById('ti-file-input')?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? '#2563EB' : '#D1D5DB'}`,
                    borderRadius: '12px', padding: '2.25rem 1.5rem',
                    textAlign: 'center', cursor: 'pointer',
                    background: dragOver ? '#EFF6FF' : '#F9FAFB',
                    transition: 'all 0.2s', marginBottom: '1rem',
                  }}
                >
                  <Upload size={26} color={dragOver ? '#2563EB' : '#9CA3AF'} style={{ margin: '0 auto 0.625rem', display: 'block' }} />
                  <div style={{ fontWeight: 600, color: '#374151', marginBottom: '4px', fontSize: '0.9375rem' }}>
                    Clique ou arraste arquivos aqui
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>
                    PNG, JPG, PDF, DOC, XLS, TXT · Máx. 20 MB · Até {MAX_FILES} arquivos
                  </div>
                  <input
                    id="ti-file-input" type="file" multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.log"
                    style={{ display: 'none' }}
                    onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
                  />
                </div>
              )}

              {errors.files && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#DC2626', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
                  <AlertCircle size={14} /> {errors.files}
                </div>
              )}

              {/* File list */}
              {files.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {files.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                      {item.preview ? (
                        <img src={item.preview} alt="" style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '42px', height: '42px', background: '#E5E7EB', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={19} color="#6B7280" />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.file.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{(item.file.size / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                      <select
                        value={item.categoria}
                        onChange={e => setFiles(prev => { const n = [...prev]; n[i] = { ...n[i], categoria: e.target.value as FileItem['categoria'] }; return n })}
                        style={{ fontSize: '0.8125rem', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#374151', cursor: 'pointer', flexShrink: 0 }}
                      >
                        <option value="screenshot">Screenshot</option>
                        <option value="log">Log</option>
                        <option value="documento">Documento</option>
                        <option value="outro">Outro</option>
                      </select>
                      <button type="button" onClick={() => removeFile(i)} style={{ background: 'transparent', border: 'none', padding: '0.375rem', cursor: 'pointer', color: '#9CA3AF', borderRadius: '4px', display: 'flex', flexShrink: 0 }}>
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center', padding: '0.5rem 0' }}>
                  Nenhum arquivo anexado — você pode prosseguir sem evidências.
                </p>
              )}

              {/* Submit error */}
              {errors.submit && (
                <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem 1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '0.875rem' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  {errors.submit}
                </div>
              )}
            </>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #F3F4F6' }}>
            {step > 1 ? (
              <button type="button" onClick={prevStep} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', background: 'transparent', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                <ArrowLeft size={16} /> Voltar
              </button>
            ) : <div />}

            {step < 3 ? (
              <button type="button" onClick={nextStep} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #1E3A5F, #2563EB)', border: 'none', borderRadius: '8px', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}>
                Próximo <ChevronRight size={16} />
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={isSubmitting} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.75rem', background: isSubmitting ? '#9CA3AF' : 'linear-gradient(135deg, #059669, #10B981)', border: 'none', borderRadius: '8px', color: '#FFFFFF', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '0.875rem', boxShadow: isSubmitting ? 'none' : '0 2px 8px rgba(5,150,105,0.3)' }}>
                {isSubmitting
                  ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</>
                  : <><Ticket size={16} /> Abrir Chamado</>
                }
              </button>
            )}
          </div>
        </div>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
