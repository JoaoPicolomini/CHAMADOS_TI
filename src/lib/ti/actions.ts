'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type {
  CriarChamadoPayload,
  TransicaoStatusPayload,
  AtribuirChamadoPayload,
  EscalarChamadoPayload,
  AdicionarComentarioPayload,
  AccessCheckResult,
  TiStatus,
  TiPrioridade,
  TiSlaConfig,
  TiCategoria
} from './types'
import { validateTransition, calcularPrazoSla, getPrazoHorasPadrao } from './workflow'
import { TI_STORAGE_BUCKET } from './constants'
import { dispatchEmailEvent } from './events/n8nDispatcher'

import {
  emailChamadoAberto,
  emailChamadoAtribuido,
  emailStatusAlterado,
  emailNovoComentario,
} from './email/templates'

// ─── Admin Supabase (service role) ───────────────────────────
function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// ============================================================
// ACESSO — Verifica whitelist e permissões
// ============================================================
export async function checkTiUserAccess(email: string): Promise<AccessCheckResult> {
  try {
    const supabase = getAdminSupabase()

    const { data: user, error } = await supabase
      .from('ti_access_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('ativo', true)
      .single()

    if (error || !user) {
      return { granted: false, permissions: [] }
    }

    const { data: perms } = await supabase
      .from('ti_profile_permissions')
      .select('permission')
      .eq('perfil', user.perfil)

    const permissions = perms?.map((p: any) => p.permission) ?? []

    return {
      granted:     true,
      perfil:      user.perfil,
      permissions,
      user,
    }
  } catch {
    return { granted: false, permissions: [] }
  }
}

// ============================================================
// CHAMADO — Criar
// ============================================================
export async function criarChamadoAction(payload: CriarChamadoPayload) {
  try {
    const { headers } = await import('next/headers')
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? null

    const supabase = getAdminSupabase()

    // 1. Determina a prioridade baseada na severidade da categoria/subcategoria
    let prioridade: TiPrioridade = payload.prioridade || 'media'
    
    // Busca informações da categoria/subcategoria
    const targetId = payload.subcategoria_id || payload.categoria_id
    if (targetId) {
      const { data: catInfo } = await supabase
        .from('ti_categorias')
        .select('severidade')
        .eq('id', targetId)
        .single()
      
      if (catInfo?.severidade) {
        prioridade = catInfo.severidade
      }
    }

    // 2. Busca config de SLA baseada na prioridade definida
    let prazoHoras = getPrazoHorasPadrao(prioridade)
    let horarioComercial = true
    let slaEncontrado = false

    if (payload.categoria_id) {
      // Tenta SLA específico da categoria selecionada
      const { data: slaEspecifico } = await supabase
        .from('ti_sla_configs')
        .select('prazo_horas, horario_comercial')
        .eq('prioridade', prioridade)
        .eq('categoria_id', payload.categoria_id)
        .eq('ativo', true)
        .maybeSingle()

      if (slaEspecifico) {
        prazoHoras = slaEspecifico.prazo_horas
        horarioComercial = slaEspecifico.horario_comercial
        slaEncontrado = true
      }
    }

    // Fallback Genérico (Geral)
    if (!slaEncontrado) {
      const { data: slaGenerico } = await supabase
        .from('ti_sla_configs')
        .select('prazo_horas, horario_comercial')
        .eq('prioridade', prioridade)
        .is('categoria_id', null)
        .eq('ativo', true)
        .maybeSingle()

      if (slaGenerico) {
        prazoHoras = slaGenerico.prazo_horas
        horarioComercial = slaGenerico.horario_comercial
      }
    }

    const slaPrazo = calcularPrazoSla(new Date(), prazoHoras, horarioComercial)

    // Determina o tipo baseado na categoria se não informado
    let tipoFinal = payload.tipo || 'incidente'
    if (payload.categoria_id) {
      const { data: cat } = await supabase
        .from('ti_categorias')
        .select('tipo_padrao')
        .eq('id', payload.categoria_id)
        .single()
      if (cat?.tipo_padrao) tipoFinal = cat.tipo_padrao
    }

    // Insere o chamado
    const { data: chamado, error } = await supabase
      .from('ti_chamados')
      .insert({
        solicitante_nome:    payload.solicitante_nome,
        solicitante_email:   payload.solicitante_email.toLowerCase(),
        solicitante_ramal:   payload.solicitante_ramal ?? null,
        solicitante_setor:   payload.solicitante_setor,
        solicitante_unidade: payload.solicitante_unidade ?? null,
        categoria_id:        payload.categoria_id ?? null,
        subcategoria_id:     payload.subcategoria_id ?? null,
        prioridade,
        tipo:                tipoFinal,
        titulo:              payload.descricao.slice(0, 100),
        descricao:           payload.descricao,
        ativo_id:            payload.ativo_id ?? null,
        ativo_descricao:     payload.ativo_descricao ?? null,
        origem:              payload.origem || 'portal',
        tags:                payload.tags ?? null,
        sla_prazo:           slaPrazo.toISOString(),
        ip_abertura:         ip,
      })
      .select()
      .single()

    if (error) throw error

    // Log de workflow
    await supabase.from('ti_workflow_events').insert({
      chamado_id:    chamado.id,
      status_de:     null,
      status_para:   'aberto',
      realizado_por: chamado.solicitante_email,
      justificativa: 'Chamado aberto pelo solicitante',
    })

    // E-mail de confirmação ao solicitante
    const { subject, html } = emailChamadoAberto(chamado, APP_URL)
    await dispatchEmailEvent({
      to:         chamado.solicitante_email,
      subject,
      html,
      chamado_id: chamado.id,
      event_type: 'ticket_created',
    })

    return { success: true, chamado }
  } catch (err: any) {
    console.error('[criarChamado]', err)
    return { success: false, error: err.message }
  }
}

// ============================================================
// CHAMADO — Transição de status
// ============================================================
export async function transicionarStatusAction(payload: TransicaoStatusPayload) {
  try {
    const supabase = getAdminSupabase()

    // Busca chamado atual
    const { data: chamado, error: fetchErr } = await supabase
      .from('ti_chamados')
      .select('*')
      .eq('id', payload.chamado_id)
      .single()

    if (fetchErr || !chamado) throw new Error('Chamado não encontrado.')

    // Valida transição
    const validation = validateTransition(chamado.status as TiStatus, payload.novo_status)
    if (!validation.allowed) throw new Error(validation.error)

    if (validation.requiresJustificativa && !payload.justificativa?.trim()) {
      throw new Error('Justificativa obrigatória para esta transição.')
    }

    if (validation.requiresSolucao && !payload.solucao?.trim()) {
      throw new Error('Informe a solução antes de marcar como resolvido.')
    }

    if (validation.requiresCancelReason && !payload.motivo_cancelamento?.trim()) {
      throw new Error('Informe o motivo do cancelamento.')
    }

    // Monta update
    const updateData: Record<string, any> = {
      status:     payload.novo_status,
      updated_at: new Date().toISOString(),
    }

    if (payload.solucao)              updateData.solucao            = payload.solucao
    if (payload.causa_raiz)           updateData.causa_raiz         = payload.causa_raiz
    if (payload.motivo_cancelamento)  updateData.motivo_cancelamento = payload.motivo_cancelamento

    // Fechamento
    if (['fechado', 'fechado_automatico', 'cancelado', 'resolvido'].includes(payload.novo_status)) {
      updateData.fechado_em  = new Date().toISOString()
      updateData.fechado_por = payload.realizado_por
    }

    // Reaberto: limpa fechamento
    if (payload.novo_status === 'reaberto') {
      updateData.fechado_em  = null
      updateData.fechado_por = null
    }

    // Lógica de SLA (Pausa)
    const { shouldPauseSla } = await import('./workflow')
    const eraPausado = shouldPauseSla(chamado.status as TiStatus)
    const vaiPausar = shouldPauseSla(payload.novo_status)

    if (!eraPausado && vaiPausar) {
      updateData.sla_pausado_em = new Date().toISOString()
    } else if (eraPausado && !vaiPausar && chamado.sla_pausado_em) {
      const inicio = new Date(chamado.sla_pausado_em)
      const fim = new Date()
      const diffHoras = (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60)
      
      updateData.sla_pausado_em = null
      updateData.sla_horas_pausadas = (chamado.sla_horas_pausadas || 0) + Math.max(0, diffHoras)
    }

    // Executa update
    const { error: updateErr } = await supabase
      .from('ti_chamados')
      .update(updateData)
      .eq('id', payload.chamado_id)

    if (updateErr) throw updateErr

    // Log de workflow
    await supabase.from('ti_workflow_events').insert({
      chamado_id:    payload.chamado_id,
      status_de:     chamado.status,
      status_para:   payload.novo_status,
      realizado_por: payload.realizado_por,
      justificativa: payload.justificativa ?? null,
    })

    // Notificação ao solicitante
    const { subject, html } = emailStatusAlterado(
      { ...chamado, status: payload.novo_status },
      chamado.status,
      payload.justificativa,
      APP_URL,
    )
    await dispatchEmailEvent({
      to:         chamado.solicitante_email,
      subject,
      html,
      event_type: 'status_changed',
      chamado_id: chamado.id,
    })

    return { success: true }
  } catch (err: any) {
    console.error('[transicionarStatus]', err)
    return { success: false, error: err.message }
  }
}

// ============================================================
// CHAMADO — Atribuir técnico / equipe
// ============================================================
export async function atribuirChamadoAction(payload: AtribuirChamadoPayload) {
  try {
    const supabase = getAdminSupabase()

    const { data: chamado } = await supabase
      .from('ti_chamados')
      .select('*')
      .eq('id', payload.chamado_id)
      .single()

    if (!chamado) throw new Error('Chamado não encontrado.')

    const updates: Record<string, any> = {}
    const logs: Array<{ campo: string; valor_antigo: string | null; valor_novo: string | null }> = []

    if (payload.tecnico_id !== undefined) {
      logs.push({ campo: 'tecnico_id', valor_antigo: chamado.tecnico_id, valor_novo: payload.tecnico_id })
      updates.tecnico_id = payload.tecnico_id
    }
    if (payload.equipe_id !== undefined) {
      logs.push({ campo: 'equipe_id', valor_antigo: chamado.equipe_id, valor_novo: payload.equipe_id })
      updates.equipe_id = payload.equipe_id
    }

    if (Object.keys(updates).length === 0) return { success: true }

    await supabase.from('ti_chamados').update(updates).eq('id', payload.chamado_id)

    // Field change logs
    await supabase.from('ti_field_change_logs').insert(
      logs.map(l => ({ ...l, chamado_id: payload.chamado_id, alterado_por: payload.atribuido_por }))
    )

    // Notifica técnico se atribuído
    if (payload.tecnico_id) {
      const { data: tecnico } = await supabase
        .from('ti_access_users')
        .select('email, nome')
        .eq('id', payload.tecnico_id)
        .single()

      if (tecnico) {
        const { subject, html } = emailChamadoAtribuido(chamado, tecnico.nome, APP_URL)
        await dispatchEmailEvent({ to: tecnico.email, subject, html, chamado_id: chamado.id, event_type: 'ticket_assigned' })
      }
    }

    return { success: true }
  } catch (err: any) {
    console.error('[atribuirChamado]', err)
    return { success: false, error: err.message }
  }
}

// ============================================================
// CHAMADO — Escalar
// ============================================================
export async function escalarChamadoAction(payload: EscalarChamadoPayload) {
  try {
    const supabase = getAdminSupabase()

    const updates: Record<string, any> = {
      status:        'escalado',
      nivel_suporte: payload.nivel_destino,
      escalado_em:   new Date().toISOString(),
      escalado_por:  payload.escalado_por,
      sla_pausado_em: new Date().toISOString(),
    }

    if (payload.equipe_destino_id) {
      updates.equipe_id  = payload.equipe_destino_id
      updates.tecnico_id = null
    }

    await supabase.from('ti_chamados').update(updates).eq('id', payload.chamado_id)

    await supabase.from('ti_workflow_events').insert({
      chamado_id:    payload.chamado_id,
      status_de:     'em_atendimento',
      status_para:   'escalado',
      realizado_por: payload.escalado_por,
      justificativa: payload.justificativa,
      metadata:      { nivel_destino: payload.nivel_destino },
    })

    return { success: true }
  } catch (err: any) {
    console.error('[escalarChamado]', err)
    return { success: false, error: err.message }
  }
}

// ============================================================
// COMENTÁRIO — Adicionar
// ============================================================
export async function adicionarComentarioAction(payload: AdicionarComentarioPayload) {
  try {
    const supabase = getAdminSupabase()

    const { data: comentario, error } = await supabase
      .from('ti_comentarios')
      .insert({
        chamado_id:  payload.chamado_id,
        autor_nome:  payload.autor_nome,
        autor_email: payload.autor_email,
        conteudo:    payload.conteudo,
        interno:     payload.interno,
      })
      .select()
      .single()

    if (error) throw error

    // Notifica solicitante se comentário público
    if (!payload.interno) {
      const { data: chamado } = await supabase
        .from('ti_chamados')
        .select('id, numero, titulo, solicitante_nome, solicitante_email')
        .eq('id', payload.chamado_id)
        .single()

      if (chamado && chamado.solicitante_email !== payload.autor_email) {
        const { subject, html } = emailNovoComentario(
          chamado, payload.autor_nome, payload.conteudo, APP_URL
        )
        await dispatchEmailEvent({ to: chamado.solicitante_email, subject, html, chamado_id: chamado.id, event_type: 'new_comment' })
      }
    }

    return { success: true, comentario }
  } catch (err: any) {
    console.error('[adicionarComentario]', err)
    return { success: false, error: err.message }
  }
}

// ============================================================
// CONTATO VIA WHATSAPP — Registra na timeline
// ============================================================
export async function registrarContatoWhatsappAction(payload: {
  chamado_id: string
  autor_nome: string
  autor_email: string
  numero: string
}) {
  try {
    const supabase = getAdminSupabase()

    const { data: chamado } = await supabase
      .from('ti_chamados')
      .select('numero, titulo, categoria:categoria_id(nome), subcategoria:subcategoria_id(nome)')
      .eq('id', payload.chamado_id)
      .single()

    const cat    = (chamado?.categoria as any)?.nome    ?? '—'
    const subcat = (chamado?.subcategoria as any)?.nome ?? '—'

    await supabase.from('ti_comentarios').insert({
      chamado_id:  payload.chamado_id,
      autor_nome:  payload.autor_nome,
      autor_email: payload.autor_email,
      conteudo:    `[Contato via WhatsApp] Número: ${payload.numero} | Chamado: ${chamado?.numero} | Categoria: ${cat} | Subcategoria: ${subcat}`,
      interno:     true,
    })

    revalidatePath(`/ti/chamado/${payload.chamado_id}`)
    return { success: true }
  } catch (err: any) {
    console.error('[registrarContatoWhatsapp]', err)
    return { success: false, error: err.message }
  }
}

// ============================================================
// ANEXO — Upload
// ============================================================
export async function uploadAnexoAction(formData: FormData) {
  try {
    const file       = formData.get('file') as File
    const chamado_id = formData.get('chamado_id') as string
    const categoria  = (formData.get('categoria') as string) || 'outro'
    const enviado_por = (formData.get('enviado_por') as string) || 'Usuário'

    if (!file) throw new Error('Arquivo não fornecido.')

    const supabase = getAdminSupabase()
    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext      = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
    const path     = `${chamado_id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(TI_STORAGE_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) throw new Error(`Storage: ${uploadError.message}`)

    const { headers } = await import('next/headers')
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? null

    const { data: anexo, error: dbError } = await supabase
      .from('ti_anexos')
      .insert({
        chamado_id,
        categoria,
        storage_path:  path,
        nome_original: file.name,
        mime_type:     file.type,
        tamanho_bytes: file.size,
        enviado_por,
        enviado_por_ip: ip,
      })
      .select()
      .single()

    if (dbError) throw dbError

    return { success: true, anexo }
  } catch (err: any) {
    console.error('[uploadAnexo]', err)
    return { success: false, error: err.message }
  }
}

// ============================================================
// SATISFAÇÃO — Registrar resposta
// ============================================================
export async function registrarSatisfacaoAction(
  chamadoId: string,
  nota: number,
  comentario?: string,
) {
  try {
    if (nota < 1 || nota > 5) throw new Error('Nota inválida.')

    const supabase = getAdminSupabase()
    await supabase
      .from('ti_chamados')
      .update({
        satisfacao_nota:          nota,
        satisfacao_comentario:    comentario ?? null,
        satisfacao_respondido_em: new Date().toISOString(),
      })
      .eq('id', chamadoId)

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ============================================================
// DASHBOARD — Buscar chamados com filtros
// ============================================================
export async function buscarChamadosAction(filtros: {
  status?: string[]
  prioridade?: string[]
  equipe_id?: string
  tecnico_id?: string
  categoria_id?: string
  solicitante_email?: string
  search?: string
  userEmail?: string
  assignee?: string
  page?: number
  pageSize?: number
}) {
  try {
    const supabase  = getAdminSupabase()
    const page      = filtros.page || 1
    const pageSize  = Math.min(filtros.pageSize || 25, 100)
    const offset    = (page - 1) * pageSize

    let query = supabase
      .from('ti_chamados')
      .select(`
        id, numero, titulo, prioridade, tipo, status,
        solicitante_nome, solicitante_setor, solicitante_email,
        equipe_id, tecnico_id, sla_prazo, sla_violado,
        sla_horas_pausadas, sla_pausado_em, fechado_em,
        nivel_suporte, created_at, updated_at,
        categoria:categoria_id(id, nome),
        equipe:equipe_id(id, nome),
        tecnico:tecnico_id(id, nome, email)
      `, { count: 'exact' })

    if (filtros.status?.length)       query = query.in('status', filtros.status)
    if (filtros.prioridade?.length)   query = query.in('prioridade', filtros.prioridade)
    if (filtros.equipe_id)            query = query.eq('equipe_id', filtros.equipe_id)
    if (filtros.tecnico_id)           query = query.eq('tecnico_id', filtros.tecnico_id)
    if (filtros.categoria_id)         query = query.eq('categoria_id', filtros.categoria_id)
    if (filtros.solicitante_email)    query = query.eq('solicitante_email', filtros.solicitante_email.toLowerCase())

    if (filtros.assignee === 'mine' && filtros.userEmail) {
      const { data: tec } = await supabase
        .from('ti_access_users').select('id').eq('email', filtros.userEmail).maybeSingle()
      if (tec) query = query.eq('tecnico_id', tec.id)
    } else if (filtros.assignee === 'unassigned') {
      query = query.is('tecnico_id', null)
    }

    if (filtros.search) {
      query = query.or(
        `numero.ilike.%${filtros.search}%,titulo.ilike.%${filtros.search}%,solicitante_nome.ilike.%${filtros.search}%,solicitante_email.ilike.%${filtros.search}%`
      )
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    return {
      success:    true,
      chamados:   data ?? [],
      total:      count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    }
  } catch (err: any) {
    console.error('[buscarChamados]', err)
    return { success: false, error: err.message, chamados: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
  }
}

// ============================================================
// CHAMADO — Buscar por ID (detalhe completo)
// ============================================================
export async function buscarChamadoPorIdAction(id: string) {
  try {
    const supabase = getAdminSupabase()

    const { data: chamado, error } = await supabase
      .from('ti_chamados')
      .select(`
        *,
        categoria:categoria_id(*),
        subcategoria:subcategoria_id(*),
        equipe:equipe_id(*),
        tecnico:tecnico_id(*),
        ativo:ativo_id(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    const [
      { data: eventos },
      { data: comentarios },
      { data: anexos },
      { data: fieldLogs },
      { data: usuarios },
      { data: equipes }
    ] = await Promise.all([
      supabase.from('ti_workflow_events').select('*').eq('chamado_id', id).order('created_at'),
      supabase.from('ti_comentarios').select('*').eq('chamado_id', id).order('created_at'),
      supabase.from('ti_anexos').select('*').eq('chamado_id', id).is('deleted_at', null).order('created_at'),
      supabase.from('ti_field_change_logs').select('*').eq('chamado_id', id).order('created_at'),
      supabase.from('ti_access_users').select('id, nome'),
      supabase.from('ti_equipes').select('id, nome'),
    ])

    return {
      success: true,
      chamado,
      eventos:     eventos ?? [],
      comentarios: comentarios ?? [],
      anexos:      anexos ?? [],
      fieldLogs:   fieldLogs ?? [],
      usuarios:    usuarios ?? [],
      equipes:     equipes ?? [],
    }
  } catch (err: any) {
    console.error('[buscarChamadoPorId]', err)
    return { success: false, error: err.message }
  }
}

// ============================================================
// CATÁLOGOS — Buscar categorias, equipes, técnicos
// ============================================================
export async function buscarCategoriasAction() {
  try {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase
      .from('ti_categorias')
      .select('*')
      .eq('ativo', true)
      .order('ordem')
    if (error) throw error
    return { success: true, categorias: data ?? [] }
  } catch (err: any) {
    return { success: false, categorias: [], error: err.message }
  }
}

export async function buscarEquipesAction() {
  try {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase
      .from('ti_equipes')
      .select('*, tecnicos:ti_tecnicos(id, nome, email, ativo)')
      .eq('ativo', true)
      .order('nivel')
    if (error) throw error
    return { success: true, equipes: data ?? [] }
  } catch (err: any) {
    return { success: false, equipes: [], error: err.message }
  }
}

export async function buscarAnalistasAtivosAction() {
  try {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase
      .from('ti_access_users')
      .select('id, nome, email')
      .in('perfil', ['tecnico', 'gestor_ti', 'admin'])
      .eq('ativo', true)
      .order('nome')
    if (error) throw error
    return { success: true, analistas: data ?? [] }
  } catch (err: any) {
    return { success: false, analistas: [], error: err.message }
  }
}

// ============================================================
// DASHBOARD — Estatísticas rápidas
// ============================================================
export async function buscarStatsDashboard() {
  try {
    const supabase = getAdminSupabase()
    const ATIVOS = ['aberto', 'em_atendimento', 'reaberto']

    const [rTotal, rAbertos, rEmAtendimento, rSlaViolados] = await Promise.all([
      supabase.from('ti_chamados').select('*', { count: 'exact', head: true }).in('status', ATIVOS),
      supabase.from('ti_chamados').select('*', { count: 'exact', head: true }).eq('status', 'aberto'),
      supabase.from('ti_chamados').select('*', { count: 'exact', head: true }).eq('status', 'em_atendimento'),
      supabase.from('ti_chamados').select('*', { count: 'exact', head: true }).eq('sla_violado', true).in('status', ATIVOS),
    ])

    return {
      success:       true,
      total:         rTotal.count         ?? 0,
      abertos:       rAbertos.count       ?? 0,
      emAtendimento: rEmAtendimento.count ?? 0,
      slaViolados:   rSlaViolados.count   ?? 0,
    }
  } catch (err: any) {
    return { success: false, total: 0, abertos: 0, emAtendimento: 0, slaViolados: 0 }
  }
}

// ============================================================
// BASE DE CONHECIMENTO
// ============================================================
export async function buscarArtigosKbAction(filtros: {
  search?: string
  categoria_id?: string
  somente_publicados?: boolean
  page?: number
  pageSize?: number
}) {
  try {
    const supabase  = getAdminSupabase()
    const page      = filtros.page || 1
    const pageSize  = Math.min(filtros.pageSize || 20, 100)
    const offset    = (page - 1) * pageSize

    let query = supabase
      .from('ti_base_conhecimento')
      .select('id, titulo, conteudo, categoria_id, tags, publicado, visualizacoes, util_sim, util_nao, autor_email, created_at, updated_at, categoria:categoria_id(id, nome)', { count: 'exact' })

    if (filtros.somente_publicados !== false) query = query.eq('publicado', true)
    if (filtros.categoria_id)  query = query.eq('categoria_id', filtros.categoria_id)
    if (filtros.search) {
      query = query.or(`titulo.ilike.%${filtros.search}%,conteudo.ilike.%${filtros.search}%`)
    }

    const { data, count, error } = await query
      .order('visualizacoes', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    return { success: true, artigos: data ?? [], total: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) }
  } catch (err: any) {
    return { success: false, artigos: [], total: 0, page: 1, pageSize: 20, totalPages: 0, error: err.message }
  }
}

export async function buscarArtigoKbPorIdAction(id: string, incrementar = true) {
  try {
    const supabase = getAdminSupabase()
    const { data: artigo, error } = await supabase
      .from('ti_base_conhecimento')
      .select('*, categoria:categoria_id(id, nome)')
      .eq('id', id)
      .single()
    if (error) throw error
    if (incrementar) {
      await supabase.from('ti_base_conhecimento').update({ visualizacoes: (artigo.visualizacoes ?? 0) + 1 }).eq('id', id)
    }
    return { success: true, artigo }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function salvarArtigoKbAction(payload: {
  id?: string
  titulo: string
  conteudo: string
  categoria_id?: string | null
  tags?: string[] | null
  publicado: boolean
  autor_email: string
}) {
  try {
    const supabase = getAdminSupabase()
    const { id, ...rest } = payload
    if (id) {
      const { error } = await supabase.from('ti_base_conhecimento').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      return { success: true, id }
    } else {
      const { data, error } = await supabase.from('ti_base_conhecimento').insert({ ...rest, categoria_id: rest.categoria_id ?? null, tags: rest.tags ?? null, visualizacoes: 0, util_sim: 0, util_nao: 0 }).select('id').single()
      if (error) throw error
      return { success: true, id: data.id }
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function excluirArtigoKbAction(id: string) {
  try {
    const supabase = getAdminSupabase()
    const { error } = await supabase.from('ti_base_conhecimento').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function registrarFeedbackKbAction(id: string, tipo: 'sim' | 'nao') {
  try {
    const supabase = getAdminSupabase()
    const campo = tipo === 'sim' ? 'util_sim' : 'util_nao'
    const { data: atual } = await supabase.from('ti_base_conhecimento').select(campo).eq('id', id).single()
    await supabase.from('ti_base_conhecimento').update({ [campo]: ((atual as any)?.[campo] ?? 0) + 1 }).eq('id', id)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function gerarUrlAnexoAction(storagePath: string) {
  try {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase.storage
      .from(TI_STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600)
    if (error) throw error
    return { success: true, url: data.signedUrl }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ============================================================
// SLA CONFIG — CRUD
// ============================================================
export async function buscarSlaConfigsAction() {
  try {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase
      .from('ti_sla_configs')
      .select('*, categoria:ti_categorias(id, nome, categoria_pai, pai:categoria_pai(nome))')
      .order('prioridade')
      .order('prazo_horas')
    if (error) throw error
    return { success: true, configs: (data || []) as (TiSlaConfig & { categoria: { nome: string } })[] }
  } catch (err: any) {
    return { success: false, configs: [], error: err.message }
  }
}

export async function salvarSlaConfigAction(payload: Partial<TiSlaConfig>) {
  try {
    const supabase = getAdminSupabase()
    const { id, ...rest } = payload

    if (id) {
      const { error } = await supabase
        .from('ti_sla_configs')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('ti_sla_configs')
        .insert([{ 
          ...rest, 
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          alerta_pct_70: rest.alerta_pct_70 ?? true,
          alerta_pct_90: rest.alerta_pct_90 ?? true,
          ativo: rest.ativo ?? true
        }])
      if (error) throw error
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ============================================================
// ANALYTICS — Dashboard analítico
// ============================================================
export async function buscarAnalyticsAction(
  periodo: '7d' | '30d' | '90d' | '365d',
  filtros?: { categoria_id?: string; tecnico_id?: string; dataInicio?: string; dataFim?: string }
) {
  try {
    const supabase = getAdminSupabase()

    // Range customizado tem prioridade sobre o período pré-definido
    const dias = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[periodo]
    let inicioISO: string
    let fimISO: string | null = null
    if (filtros?.dataInicio) {
      inicioISO = new Date(filtros.dataInicio).toISOString()
      fimISO    = filtros.dataFim ? new Date(filtros.dataFim + 'T23:59:59').toISOString() : null
    } else {
      inicioISO = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
    }

    const STATUS_ATIVOS = ['aberto', 'em_atendimento', 'pendente_usuario', 'pendente_terceiro', 'reaberto', 'escalado']

    let chamadosQuery = supabase
      .from('ti_chamados')
      .select('id, numero, titulo, status, prioridade, tipo, created_at, fechado_em, updated_at, sla_violado, solicitante_nome, solicitante_setor, categoria:categoria_id(nome), equipe:equipe_id(nome), tecnico:tecnico_id(id, nome, email)')
      .gte('created_at', inicioISO)
      .order('created_at')

    if (fimISO)                chamadosQuery = chamadosQuery.lte('created_at', fimISO)
    if (filtros?.categoria_id) chamadosQuery = chamadosQuery.eq('categoria_id', filtros.categoria_id)
    if (filtros?.tecnico_id)   chamadosQuery = chamadosQuery.eq('tecnico_id',   filtros.tecnico_id)

    const [chamadosRes, emAbertoRes] = await Promise.all([
      chamadosQuery,
      supabase
        .from('ti_chamados')
        .select('id', { count: 'exact', head: true })
        .in('status', STATUS_ATIVOS),
    ])

    const chamados = chamadosRes.data ?? []
    const emAberto = emAbertoRes.count ?? 0
    const total = chamados.length

    // MTTR (horas médias até fechamento)
    const fechadosCom = chamados.filter((c: any) => c.fechado_em)
    let mttrHoras: number | null = null
    if (fechadosCom.length > 0) {
      const totalMs = fechadosCom.reduce((acc: number, c: any) =>
        acc + (new Date(c.fechado_em).getTime() - new Date(c.created_at).getTime()), 0)
      mttrHoras = Math.round((totalMs / fechadosCom.length / 3_600_000) * 10) / 10
    }

    // SLA compliance
    const comSla = chamados.filter((c: any) => c.sla_violado !== null)
    const slaOk = comSla.filter((c: any) => !c.sla_violado).length
    const slaCompliance = comSla.length > 0 ? Math.round((slaOk / comSla.length) * 100) : null

    // Por categoria (top 10)
    const catMap = new Map<string, number>()
    chamados.forEach((c: any) => {
      const nome = (c.categoria as any)?.nome ?? 'Sem categoria'
      catMap.set(nome, (catMap.get(nome) ?? 0) + 1)
    })
    const porCategoria = Array.from(catMap.entries())
      .map(([name, count]) => ({ name, total: count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // Por equipe
    const equipeMap = new Map<string, number>()
    chamados.forEach((c: any) => {
      const nome = (c.equipe as any)?.nome ?? 'Sem equipe'
      equipeMap.set(nome, (equipeMap.get(nome) ?? 0) + 1)
    })
    const porEquipe = Array.from(equipeMap.entries())
      .map(([name, count]) => ({ name, total: count }))
      .sort((a, b) => b.total - a.total)

    // Por prioridade
    const prioMap = new Map<string, number>()
    chamados.forEach((c: any) => { prioMap.set(c.prioridade, (prioMap.get(c.prioridade) ?? 0) + 1) })
    const porPrioridade = [
      { name: 'Crítica', total: prioMap.get('critica') ?? 0 },
      { name: 'Alta',    total: prioMap.get('alta')    ?? 0 },
      { name: 'Média',   total: prioMap.get('media')   ?? 0 },
      { name: 'Baixa',   total: prioMap.get('baixa')   ?? 0 },
    ]

    // Tendência temporal (diária / semanal / mensal)
    const STATUS_ENCERRADOS_TEND = ['resolvido', 'fechado', 'fechado_automatico']
    // Data de encerramento: fechado_em se existir, senão updated_at como fallback
    function dataEnc(c: any): string | null {
      if (!STATUS_ENCERRADOS_TEND.includes(c.status)) return null
      return c.fechado_em ?? c.updated_at ?? null
    }

    let tendencia: { label: string; abertos: number; fechados: number }[] = []

    if (periodo === '365d') {
      const monthMap = new Map<string, { abertos: number; fechados: number }>()
      for (let i = 11; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthMap.set(key, { abertos: 0, fechados: 0 })
      }
      chamados.forEach((c: any) => {
        const key = String(c.created_at).slice(0, 7)
        const e = monthMap.get(key); if (e) e.abertos++
        const enc = dataEnc(c)
        if (enc) { const f = monthMap.get(String(enc).slice(0, 7)); if (f) f.fechados++ }
      })
      tendencia = Array.from(monthMap.entries()).map(([label, v]) => ({ label, ...v }))

    } else if (periodo === '90d') {
      const weekStarts: string[] = []
      for (let i = 12; i >= 0; i--) {
        const d = new Date(Date.now() - i * 7 * 86_400_000)
        weekStarts.push(d.toISOString().split('T')[0])
      }
      const weekMap = new Map(weekStarts.map(k => [k, { abertos: 0, fechados: 0 }]))
      function findWeek(dateStr: string) {
        return weekStarts.filter(k => k <= dateStr).at(-1)
      }
      chamados.forEach((c: any) => {
        const wk = findWeek(String(c.created_at).split('T')[0])
        if (wk) { const e = weekMap.get(wk); if (e) e.abertos++ }
        const enc = dataEnc(c)
        if (enc) {
          const fwk = findWeek(String(enc).split('T')[0])
          if (fwk) { const f = weekMap.get(fwk); if (f) f.fechados++ }
        }
      })
      tendencia = Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, v]) => ({ label, ...v }))

    } else {
      const dayMap = new Map<string, { abertos: number; fechados: number }>()
      for (let i = dias - 1; i >= 0; i--) {
        const key = new Date(Date.now() - i * 86_400_000).toISOString().split('T')[0]
        dayMap.set(key, { abertos: 0, fechados: 0 })
      }
      chamados.forEach((c: any) => {
        const key = String(c.created_at).split('T')[0]
        const e = dayMap.get(key); if (e) e.abertos++
        const enc = dataEnc(c)
        if (enc) { const f = dayMap.get(String(enc).split('T')[0]); if (f) f.fechados++ }
      })
      tendencia = Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, v]) => ({ label, ...v }))
    }

    return {
      success: true,
      data: { total, emAberto, mttrHoras, slaCompliance, porCategoria, porEquipe, porPrioridade, tendencia, chamadosRaw: chamados, periodo },
    }
  } catch (err: any) {
    console.error('[buscarAnalytics]', err)
    return { success: false, error: err.message, data: null }
  }
}

// ============================================================
// EXPORTAÇÃO — Todos os campos para relatório
// ============================================================
export async function exportarChamadosAction(filtros: {
  status?: string[]
  prioridade?: string[]
  equipe_id?: string
  tecnico_id?: string
  categoria_id?: string
  solicitante_email?: string
  search?: string
  userEmail?: string
  assignee?: string
  dataInicio?: string
  dataFim?: string
}) {
  try {
    const supabase = getAdminSupabase()

    let query = supabase
      .from('ti_chamados')
      .select(`
        id, numero, titulo, prioridade, tipo, status, origem, nivel_suporte,
        solicitante_nome, solicitante_email, solicitante_ramal,
        solicitante_setor, solicitante_unidade,
        sla_prazo, sla_violado, sla_violado_em, sla_horas_pausadas,
        escalado_em, escalado_por,
        solucao, causa_raiz, motivo_cancelamento,
        fechado_em, fechado_por,
        satisfacao_nota, satisfacao_comentario, satisfacao_respondido_em,
        tags, ip_abertura,
        created_at, updated_at,
        categoria:categoria_id(id, nome),
        subcategoria:subcategoria_id(id, nome),
        equipe:equipe_id(id, nome),
        tecnico:tecnico_id(id, nome, email)
      `)

    if (filtros.status?.length)     query = query.in('status', filtros.status)
    if (filtros.prioridade?.length) query = query.in('prioridade', filtros.prioridade)
    if (filtros.equipe_id)          query = query.eq('equipe_id', filtros.equipe_id)
    if (filtros.tecnico_id)         query = query.eq('tecnico_id', filtros.tecnico_id)
    if (filtros.categoria_id)       query = query.eq('categoria_id', filtros.categoria_id)
    if (filtros.solicitante_email)  query = query.eq('solicitante_email', filtros.solicitante_email.toLowerCase())

    if (filtros.assignee === 'mine' && filtros.userEmail) {
      const { data: tec } = await supabase
        .from('ti_access_users').select('id').eq('email', filtros.userEmail).maybeSingle()
      if (tec) query = query.eq('tecnico_id', tec.id)
    } else if (filtros.assignee === 'unassigned') {
      query = query.is('tecnico_id', null)
    }

    if (filtros.search) {
      query = query.or(
        `numero.ilike.%${filtros.search}%,titulo.ilike.%${filtros.search}%,solicitante_nome.ilike.%${filtros.search}%,solicitante_email.ilike.%${filtros.search}%`
      )
    }

    if (filtros.dataInicio) query = query.gte('created_at', new Date(filtros.dataInicio).toISOString())
    if (filtros.dataFim)    query = query.lte('created_at', new Date(filtros.dataFim + 'T23:59:59').toISOString())

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return { success: true, chamados: data ?? [] }
  } catch (err: any) {
    console.error('[exportarChamados]', err)
    return { success: false, error: err.message, chamados: [] }
  }
}

export async function excluirSlaConfigAction(id: string) {
  try {
    const supabase = getAdminSupabase()
    const { error } = await supabase.from('ti_sla_configs').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function buscarAtivosAction(search?: string) {
  try {
    const supabase = getAdminSupabase()
    let query = supabase.from('ti_ativos').select('*').eq('status', 'ativo')
    if (search) query = query.ilike('nome', `%${search}%`)
    const { data, error } = await query.order('nome').limit(50)
    if (error) throw error
    return { success: true, ativos: data ?? [] }
  } catch (err: any) {
    return { success: false, ativos: [], error: err.message }
  }
}

// ============================================================
// ADMIN: USUÁRIOS
// ============================================================

export async function buscarUsuariosAdminAction(params: { search?: string, perfil?: string, ativo?: boolean, page: number }) {
  try {
    const supabase = getAdminSupabase()
    let query = supabase.from('ti_access_users').select('*', { count: 'exact' })
    
    if (params.search) {
      query = query.or(`nome.ilike.%${params.search}%,email.ilike.%${params.search}%`)
    }
    if (params.perfil) {
      query = query.eq('perfil', params.perfil)
    }
    if (params.ativo !== undefined) {
      query = query.eq('ativo', params.ativo)
    }
    
    const pageSize = 15
    const from = (params.page - 1) * pageSize
    const to = from + pageSize - 1
    
    const { data, error, count } = await query.order('nome').range(from, to)
    if (error) throw error
    
    return { 
      success: true, 
      usuarios: data ?? [],
      total: count ?? 0,
      totalPages: count ? Math.ceil(count / pageSize) : 1
    }
  } catch (err: any) {
    return { success: false, error: err.message, usuarios: [], total: 0, totalPages: 1 }
  }
}

export async function salvarUsuarioAdminAction(usuario: { id?: string, email: string, nome: string, cargo?: string, perfil: string, ativo: boolean }) {
  try {
    const supabase = getAdminSupabase()
    
    const payload = {
      email: usuario.email.toLowerCase(),
      nome: usuario.nome,
      cargo: usuario.cargo || null,
      perfil: usuario.perfil,
      ativo: usuario.ativo,
      updated_at: new Date().toISOString()
    }

    let result;
    if (usuario.id) {
      result = await supabase.from('ti_access_users').update(payload).eq('id', usuario.id)
    } else {
      result = await supabase.from('ti_access_users').insert([payload])
    }
    
    if (result.error) throw result.error
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function importarUsuariosAdminAction(usuarios: any[]) {
  try {
    const supabase = getAdminSupabase()
    
    // Preparar payload
    const payload = usuarios.map(u => ({
      email: String(u.email || u.Email || '').toLowerCase(),
      nome: String(u.nome || u.Nome || ''),
      cargo: u.cargo || u.Cargo || null,
      perfil: u.perfil || u.Perfil || 'user',
      ativo: u.ativo !== undefined ? u.ativo : true,
      updated_at: new Date().toISOString()
    })).filter(u => u.email && u.nome)
    
    if (payload.length === 0) {
      return { success: false, error: 'Nenhum usuário válido encontrado para importação.' }
    }

    const { error } = await supabase.from('ti_access_users').upsert(payload, { onConflict: 'email' })
    if (error) throw error
    
    return { success: true, count: payload.length }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ============================================================
// ADMIN: EQUIPES E TÉCNICOS
// ============================================================

export async function buscarEquipesAdminAction(params: { search?: string, ativo?: boolean }) {
  try {
    const supabase = getAdminSupabase()
    let query = supabase.from('ti_equipes').select('*')
    
    if (params.search) {
      query = query.ilike('nome', `%${params.search}%`)
    }
    if (params.ativo !== undefined) {
      query = query.eq('ativo', params.ativo)
    }
    
    const { data, error } = await query.order('nome')
    if (error) throw error
    
    return { success: true, equipes: data ?? [] }
  } catch (err: any) {
    return { success: false, error: err.message, equipes: [] }
  }
}

export async function salvarEquipeAdminAction(equipe: { id?: string, nome: string, descricao?: string, email_fila?: string, nivel: number, ativo: boolean }) {
  try {
    const supabase = getAdminSupabase()
    
    const payload = {
      nome: equipe.nome,
      descricao: equipe.descricao || null,
      email_fila: equipe.email_fila || null,
      nivel: equipe.nivel,
      ativo: equipe.ativo,
      updated_at: new Date().toISOString()
    }

    let result;
    if (equipe.id) {
      result = await supabase.from('ti_equipes').update(payload).eq('id', equipe.id)
    } else {
      result = await supabase.from('ti_equipes').insert([payload])
    }
    
    if (result.error) throw result.error
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ============================================================
// ADMIN: ATIVOS DE T.I
// ============================================================

export async function buscarAtivosAdminAction(params: { search?: string, tipo?: string, status?: string, page: number }) {
  try {
    const supabase = getAdminSupabase()
    let query = supabase.from('ti_ativos').select('*', { count: 'exact' })
    
    if (params.search) {
      query = query.or(`nome.ilike.%${params.search}%,patrimonio.ilike.%${params.search}%,numero_serie.ilike.%${params.search}%`)
    }
    if (params.tipo) {
      query = query.eq('tipo', params.tipo)
    }
    if (params.status) {
      query = query.eq('status', params.status)
    }
    
    const pageSize = 15
    const from = (params.page - 1) * pageSize
    const to = from + pageSize - 1
    
    const { data, error, count } = await query.order('nome').range(from, to)
    if (error) throw error
    
    return { 
      success: true, 
      ativos: data ?? [],
      total: count ?? 0,
      totalPages: count ? Math.ceil(count / pageSize) : 1
    }
  } catch (err: any) {
    return { success: false, error: err.message, ativos: [], total: 0, totalPages: 1 }
  }
}

export async function buscarStatsAtivosAction() {
  try {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase
      .from('ti_ativos')
      .select('tipo, status, valor_compra')
    if (error) throw error
    const total      = data?.length ?? 0
    const notebook   = data?.filter((a: any) => a.tipo === 'notebook').length   ?? 0
    const monitor    = data?.filter((a: any) => a.tipo === 'monitor').length    ?? 0
    const computador = data?.filter((a: any) => a.tipo === 'computador').length ?? 0
    const manutencao = data?.filter((a: any) => a.status === 'manutencao').length ?? 0
    const emUso      = data?.filter((a: any) => a.status === 'ativo').length ?? 0
    const disponiveis = data?.filter((a: any) => a.status === 'reserva').length ?? 0
    const valorTotal = data?.reduce((s: number, a: any) => s + (Number(a.valor_compra) || 0), 0) ?? 0

    return { 
      success: true, 
      stats: { total, notebook, monitor, computador, manutencao, emUso, disponiveis, valorTotal } 
    }
  } catch (err: any) {
    return { success: false, stats: null, error: err.message }
  }
}

export async function importarAtivosAdminAction(ativos: any[]) {
  try {
    const supabase = getAdminSupabase()
    const payload = ativos.map(a => ({
      nome:         a.nome,
      tipo:         a.tipo         || 'outros',
      fabricante:   a.fabricante   || null,
      modelo:       a.modelo       || null,
      numero_serie: a.numero_serie || null,
      setor:        a.setor        || null,
      responsavel:  a.responsavel  || null,
      valor_compra: a.valor_compra ? Number(a.valor_compra) : null,
      imei:         a.imei         || null,
      status:       a.status       || 'ativo',
      updated_at:   new Date().toISOString(),
    }))
    const { error } = await supabase.from('ti_ativos').insert(payload)
    if (error) throw error
    return { success: true, count: payload.length }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function salvarAtivoAdminAction(ativo: any) {
  try {
    const supabase = getAdminSupabase()

    const payload = {
      ...ativo,
      updated_at: new Date().toISOString()
    }
    
    if (payload.id) {
      // Don't update id
      const { id, ...updatePayload } = payload
      const result = await supabase.from('ti_ativos').update(updatePayload).eq('id', id)
      if (result.error) throw result.error
    } else {
      const result = await supabase.from('ti_ativos').insert([payload])
      if (result.error) throw result.error
    }
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ============================================================
// ADMIN: MATRIZ DE ACESSO E PERFIS
// ============================================================

export async function buscarPermissoesAdminAction() {
  try {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase.from('ti_permissions').select('*').order('code')
    if (error) throw error
    return { success: true, permissions: data ?? [] }
  } catch (err: any) {
    return { success: false, error: err.message, permissions: [] }
  }
}

export async function buscarPerfilPermissoesAdminAction() {
  try {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase.from('ti_profile_permissions').select('*')
    if (error) throw error
    return { success: true, profilePermissions: data ?? [] }
  } catch (err: any) {
    return { success: false, error: err.message, profilePermissions: [] }
  }
}

export async function toggleProfilePermissionAdminAction(perfil: string, permission: string, checked: boolean) {
  try {
    const supabase = getAdminSupabase()
    
    if (checked) {
      const { error } = await supabase.from('ti_profile_permissions').upsert({
        perfil, permission
      }, { onConflict: 'perfil, permission' })
      if (error) throw error
    } else {
      const { error } = await supabase.from('ti_profile_permissions')
        .delete()
        .eq('perfil', perfil)
        .eq('permission', permission)
      if (error) throw error
    }
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ============================================================
// ADMIN: EMAIL LOGS
// ============================================================

export async function buscarEmailLogsAdminAction(params: {
  search?: string
  status?: string
  direction?: string
  page: number
}) {
  try {
    const supabase = getAdminSupabase()

    let query = supabase.from('ti_email_logs')
      .select('*, ti_chamados!left(numero)', { count: 'exact' })

    if (params.search) {
      query = query.or(`recipient.ilike.%${params.search}%,subject.ilike.%${params.search}%,from_email.ilike.%${params.search}%`)
    }
    if (params.status) {
      query = query.eq('status', params.status)
    }
    if (params.direction) {
      query = query.eq('direction', params.direction)
    }

    const pageSize = 20
    const from = (params.page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to)
    if (error) throw error

    return {
      success: true,
      logs: data ?? [],
      total: count ?? 0,
      totalPages: count ? Math.ceil(count / pageSize) : 1
    }
  } catch (err: any) {
    return { success: false, error: err.message, logs: [], total: 0, totalPages: 1 }
  }
}

export async function reenviarEmailAdminAction(id: string) {
  try {
    const supabase = getAdminSupabase()

    const { data: log, error } = await supabase
      .from('ti_email_logs')
      .select('id, recipient, subject, body_html, chamado_id, event_type, direction')
      .eq('id', id)
      .single()

    if (error || !log) throw new Error('Log não encontrado')
    if (log.direction !== 'outbound') throw new Error('Apenas e-mails de saída podem ser reenviados')
    if (!log.body_html) throw new Error('Corpo do e-mail não disponível para reenvio')

    const ok = await dispatchEmailEvent({
      to:         log.recipient,
      subject:    log.subject,
      html:       log.body_html,
      chamado_id: log.chamado_id ?? undefined,
      event_type: log.event_type ?? undefined,
    })

    await supabase
      .from('ti_email_logs')
      .update(ok
        ? { status: 'success', sent_at: new Date().toISOString(), error_message: null }
        : { status: 'error',   error_message: 'Reenvio falhou' }
      )
      .eq('id', id)

    return ok ? { success: true } : { success: false, error: 'Falha no reenvio' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ============================================================
// ADMIN: AUDITORIA (FIELD CHANGE LOGS)
// ============================================================

export async function buscarAuditoriaAdminAction(params: { search?: string, field?: string, page: number }) {
  try {
    const supabase = getAdminSupabase()
    
    let query = supabase.from('ti_field_change_logs')
      .select('*, ti_chamados!inner(numero)', { count: 'exact' })
      
    if (params.search) {
      query = query.or(`alterado_por.ilike.%${params.search}%,valor_novo.ilike.%${params.search}%,valor_antigo.ilike.%${params.search}%,ti_chamados.numero.ilike.%${params.search}%`)
    }
    if (params.field) {
      query = query.eq('campo', params.field)
    }
    
    const pageSize = 30
    const from = (params.page - 1) * pageSize
    const to = from + pageSize - 1
    
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to)
    if (error) throw error
    
    return { 
      success: true, 
      logs: data ?? [],
      total: count ?? 0,
      totalPages: count ? Math.ceil(count / pageSize) : 1
    }
  } catch (err: any) {
    return { success: false, error: err.message, logs: [], total: 0, totalPages: 1 }
  }
}

// ============================================================
// ADMIN: PESQUISA DE SATISFAÇÃO (CSAT)
// ============================================================

export async function buscarSatisfacaoAdminAction(params: { search?: string, nota?: number, page: number }) {
  try {
    const supabase = getAdminSupabase()
    
    let query = supabase.from('ti_chamados')
      .select('id, numero, titulo, solicitante_nome, satisfacao_nota, satisfacao_comentario, satisfacao_respondido_em', { count: 'exact' })
      .not('satisfacao_nota', 'is', null)
      
    if (params.search) {
      query = query.or(`numero.ilike.%${params.search}%,titulo.ilike.%${params.search}%,solicitante_nome.ilike.%${params.search}%`)
    }
    if (params.nota) {
      query = query.eq('satisfacao_nota', params.nota)
    }
    
    const pageSize = 30
    const from = (params.page - 1) * pageSize
    const to = from + pageSize - 1
    
    const { data, error, count } = await query.order('satisfacao_respondido_em', { ascending: false }).range(from, to)
    if (error) throw error
    
    return { success: true, resultados: data ?? [], total: count ?? 0, totalPages: count ? Math.ceil(count / pageSize) : 1 }
  } catch (err: any) {
    return { success: false, error: err.message, resultados: [], total: 0, totalPages: 1 }
  }
}

// ============================================================
// ADMIN: CONFIGURAÇÕES DE SATISFAÇÃO (CSAT)
// ============================================================

export async function buscarSatisfacaoConfigAction() {
  try {
    const supabase = getAdminSupabase()
    
    // As there is only one config row typically, let's just get the first one
    let { data, error } = await supabase.from('ti_satisfacao_config').select('*').limit(1).single()
    
    if (error && error.code !== 'PGRST116') {
      throw error
    }
    
    if (!data) {
      // Create default if none exists
      const { data: newData, error: insertError } = await supabase.from('ti_satisfacao_config').insert({
        ativa: true,
        horas_apos_fechamento: 1,
        lembrete_horas: 24,
        max_lembretes: 2
      }).select().single()
      
      if (insertError) throw insertError
      data = newData
    }
    
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function salvarSatisfacaoConfigAction(config: { id: string, ativa: boolean, horas_apos_fechamento: number, lembrete_horas: number, max_lembretes: number }) {
  try {
    const supabase = getAdminSupabase()
    
    const { error } = await supabase.from('ti_satisfacao_config').update({
      ativa: config.ativa,
      horas_apos_fechamento: config.horas_apos_fechamento,
      lembrete_horas: config.lembrete_horas,
      max_lembretes: config.max_lembretes,
      updated_at: new Date().toISOString()
    }).eq('id', config.id)
    
    if (error) throw error
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ============================================================
// ADMIN: PERFIS DE ACESSO (DYNAMIC PROFILES)
// ============================================================

export async function buscarPerfisAction() {
  try {
    const supabase = getAdminSupabase()
    const { data, error } = await supabase
      .from('ti_profiles')
      .select('*')
      .order('ordem')
    if (error) throw error
    return { success: true, perfis: data ?? [] }
  } catch (err: any) {
    return { success: false, perfis: [], error: err.message }
  }
}

export async function salvarPerfilAction(payload: {
  id?: string
  slug: string
  nome: string
  descricao?: string
  cor?: string
  icone?: string
  ordem?: number
}) {
  try {
    const supabase = getAdminSupabase()
    const { id, ...rest } = payload
    
    if (id) {
      const { error } = await supabase
        .from('ti_profiles')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      return { success: true }
    } else {
      const { data, error } = await supabase
        .from('ti_profiles')
        .insert(rest)
        .select('id')
        .single()
      if (error) throw error
      return { success: true, id: data.id }
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function excluirPerfilAction(id: string) {
  try {
    const supabase = getAdminSupabase()
    
    // Check if any users are using this profile
    const { data: perfilData } = await supabase.from('ti_profiles').select('slug').eq('id', id).single()
    if (perfilData) {
      // 1. Check if any users are using this profile
      const { count } = await supabase
        .from('ti_access_users')
        .select('*', { count: 'exact', head: true })
        .eq('perfil', perfilData.slug)
      
      if (count && count > 0) {
        throw new Error(`Não é possível excluir este perfil porque existem ${count} usuários vinculados a ele. Primeiro, altere o perfil desses usuários.`)
      }

      // 2. Delete permissions associated with this profile
      const { error: permError } = await supabase
        .from('ti_profile_permissions')
        .delete()
        .eq('perfil', perfilData.slug)
      
      if (permError) throw permError
    }

    // 3. Finally delete the profile
    const { error } = await supabase.from('ti_profiles').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ============================================================
// GESTÃO DE CATÁLOGOS (Categorias, Setores, Unidades)
// ============================================================

/**
 * Busca todos os dados para a tela de administração de catálogos
 */
export async function buscarDadosCatalogosAction() {
  try {
    const supabase = getAdminSupabase()
    
    const [cats, setores, unidades] = await Promise.all([
      supabase.from('ti_categorias').select('*').order('categoria_pai', { nullsFirst: true }).order('ordem'),
      supabase.from('ti_setores').select('*').order('nome'),
      supabase.from('ti_unidades').select('*').order('nome')
    ])

    if (cats.error) throw cats.error
    if (setores.error) throw setores.error
    if (unidades.error) throw unidades.error

    return { 
      success: true, 
      categorias: cats.data, 
      setores: setores.data, 
      unidades: unidades.data 
    }
  } catch (err: any) {
    return { 
      success: false, 
      error: err.message,
      categorias: [],
      setores: [],
      unidades: []
    }
  }
}

/**
 * Busca dados simplificados e ativos para o formulário de abertura (público)
 */
export async function buscarCatalogosPublicosAction() {
  try {
    const supabase = getAdminSupabase() // Usamos admin para garantir bypass de RLS se necessário, ou client normal
    const [cats, setores, unidades] = await Promise.all([
      supabase.from('ti_categorias').select('*').eq('ativo', true).order('ordem'),
      supabase.from('ti_setores').select('*').eq('ativo', true).order('nome'),
      supabase.from('ti_unidades').select('*').eq('ativo', true).order('nome')
    ])
    return { 
      success: true, 
      categorias: cats.data || [], 
      setores: setores.data || [], 
      unidades: unidades.data || [] 
    }
  } catch (err: any) {
    return { 
      success: false, 
      error: err.message,
      categorias: [],
      setores: [],
      unidades: []
    }
  }
}

/**
 * Salva ou atualiza uma categoria e opcionalmente suas subcategorias
 */
export async function salvarCategoriaCompletaAction(
  parent: Partial<TiCategoria>,
  children: Partial<TiCategoria>[] = []
) {
  try {
    const supabase = getAdminSupabase()

    // 1. Upsert na categoria pai
    const { data: savedParent, error: pError } = await supabase
      .from('ti_categorias')
      .upsert({ ...parent }, { onConflict: 'id' })
      .select()
      .single()

    if (pError) throw pError

    // 2. Busca filhos existentes para calcular diff (delete dos removidos)
    const { data: existingChildren } = await supabase
      .from('ti_categorias')
      .select('id, nome')
      .eq('categoria_pai', savedParent.id)

    const existingNames = new Set((existingChildren ?? []).map((c: any) => c.nome))
    const incomingNames = new Set(children.map(c => c.nome))

    // Deleta subcategorias removidas pelo usuário
    const toDelete = (existingChildren ?? []).filter((c: any) => !incomingNames.has(c.nome))
    if (toDelete.length > 0) {
      const { error: dError } = await supabase
        .from('ti_categorias')
        .delete()
        .in('id', toDelete.map((c: any) => c.id))
      if (dError) throw dError
    }

    // Insere apenas as subcategorias novas (que não existiam pelo nome)
    const toInsert = children
      .filter(c => !existingNames.has(c.nome))
      .map(c => ({
        nome: c.nome,
        slug: c.slug,
        ordem: c.ordem ?? 0,
        ativo: c.ativo ?? true,
        categoria_pai: savedParent.id,
        tipo_padrao: c.tipo_padrao || savedParent.tipo_padrao || 'incidente',
      }))

    if (toInsert.length > 0) {
      const { error: cError } = await supabase
        .from('ti_categorias')
        .insert(toInsert)
      if (cError) throw cError
    }

    revalidatePath('/ti/admin/catalogos')
    return { success: true, id: savedParent.id }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Altera o status (ativo/inativo) de qualquer registro de catálogo
 */
export async function alternarStatusCatalogoAction(
  table: 'ti_categorias' | 'ti_setores' | 'ti_unidades',
  id: string,
  ativo: boolean
) {
  try {
    const supabase = getAdminSupabase()
    const { error } = await supabase
      .from(table)
      .update({ ativo } as any)
      .eq('id', id)

    if (error) throw error

    // Se for uma categoria pai sendo inativada, inativar filhos também
    if (table === 'ti_categorias' && !ativo) {
       await supabase
        .from('ti_categorias')
        .update({ ativo: false })
        .eq('categoria_pai', id)
    }

    revalidatePath('/ti/admin/catalogos')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Salva ou atualiza um setor
 */
export async function salvarSetorAction(data: { id?: string; nome: string; ativo?: boolean }) {
  try {
    const supabase = getAdminSupabase()
    const { error } = await supabase
      .from('ti_setores')
      .upsert(data)

    if (error) throw error
    revalidatePath('/ti/admin/catalogos')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Salva ou atualiza uma unidade
 */
export async function salvarUnidadeAction(data: { id?: string; nome: string; ativo?: boolean }) {
  try {
    const supabase = getAdminSupabase()
    const { error } = await supabase
      .from('ti_unidades')
      .upsert(data)

    if (error) throw error
    revalidatePath('/ti/admin/catalogos')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Atualiza apenas a severidade de uma categoria (usado na matriz de SLA simplificada)
 */
export async function alterarCategoriaAction(payload: {
  chamado_id: string
  categoria_id: string | null
  subcategoria_id: string | null
  justificativa: string
  alterado_por: string
}) {
  try {
    const supabase = getAdminSupabase()

    // Busca valores atuais para registrar no log
    const { data: chamado, error: fetchErr } = await supabase
      .from('ti_chamados')
      .select('categoria_id, subcategoria_id')
      .eq('id', payload.chamado_id)
      .single()

    if (fetchErr) throw fetchErr

    const logs: Array<{ campo: string; valor_antigo: string | null; valor_novo: string | null }> = []

    if (chamado.categoria_id !== payload.categoria_id) {
      logs.push({ campo: 'categoria_id', valor_antigo: chamado.categoria_id, valor_novo: payload.categoria_id })
    }
    if (chamado.subcategoria_id !== payload.subcategoria_id) {
      logs.push({ campo: 'subcategoria_id', valor_antigo: chamado.subcategoria_id, valor_novo: payload.subcategoria_id })
    }

    if (logs.length === 0) return { success: true }

    await supabase
      .from('ti_chamados')
      .update({ categoria_id: payload.categoria_id, subcategoria_id: payload.subcategoria_id, updated_at: new Date().toISOString() })
      .eq('id', payload.chamado_id)

    await supabase.from('ti_field_change_logs').insert(
      logs.map(l => ({ ...l, chamado_id: payload.chamado_id, alterado_por: payload.alterado_por }))
    )

    // Registra justificativa como comentário interno
    await supabase.from('ti_comentarios').insert({
      chamado_id:  payload.chamado_id,
      autor_nome:  payload.alterado_por,
      autor_email: payload.alterado_por,
      conteudo:    `[Alteração de classificação] ${payload.justificativa}`,
      interno:     true,
    })

    revalidatePath(`/ti/chamado/${payload.chamado_id}`)
    return { success: true }
  } catch (err: any) {
    console.error('[alterarCategoria]', err)
    return { success: false, error: err.message }
  }
}

export async function atualizarSeveridadeCategoriaAction(id: string, severidade: TiPrioridade | null) {
  try {
    const supabase = getAdminSupabase()
    const { error } = await supabase
      .from('ti_categorias')
      .update({ severidade })
      .eq('id', id)

    if (error) throw error
    revalidatePath('/ti/admin/catalogos')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
