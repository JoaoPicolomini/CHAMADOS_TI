import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dispatchEmailEvent } from '@/lib/ti/events/n8nDispatcher'
import { emailNovoComentario } from '@/lib/ti/email/templates'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const STATUS_REOPEN     = new Set(['resolvido', 'fechado', 'fechado_automatico'])
const STATUS_REACTIVATE = new Set(['pendente_usuario'])

/**
 * POST /api/webhooks/n8n
 * Recebe respostas de e-mail processadas pelo n8n e as injeta como comentários.
 *
 * Payload esperado:
 *   { chamado_numero: number, remetente_email: string, texto_comentario: string }
 */
export async function POST(req: NextRequest) {
  // Proteção: valida token do n8n
  const secret = req.headers.get('x-webhook-secret')
  if (process.env.NODE_ENV !== 'development' && secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { chamado_numero?: string | number; remetente_email?: string; texto_comentario?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { chamado_numero, remetente_email, texto_comentario } = body

  if (!chamado_numero || !remetente_email || !texto_comentario?.trim()) {
    return NextResponse.json(
      { error: 'campos obrigatórios: chamado_numero, remetente_email, texto_comentario' },
      { status: 400 },
    )
  }

  const supabase = getAdminSupabase()

  // Busca o chamado pelo número
  const { data: chamado, error: chamadoError } = await supabase
    .from('ti_chamados')
    .select('id, numero, titulo, status, solicitante_email, solicitante_nome, tecnico:tecnico_id(email, nome)')
    .eq('numero', chamado_numero)
    .maybeSingle()

  if (chamadoError || !chamado) {
    return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
  }

  // Valida remetente
  if (chamado.solicitante_email.toLowerCase() !== remetente_email.toLowerCase()) {
    return NextResponse.json({ error: 'Remetente não autorizado neste chamado' }, { status: 403 })
  }

  // Insere o comentário
  const { data: comentario, error: insertError } = await supabase
    .from('ti_comentarios')
    .insert({
      chamado_id:  chamado.id,
      autor_nome:  chamado.solicitante_nome,
      autor_email: remetente_email,
      conteudo:    texto_comentario.trim(),
      interno:     false,
    })
    .select('id')
    .single()

  if (insertError || !comentario) {
    console.error('[n8n inbound] Erro ao inserir comentário:', insertError)
    return NextResponse.json({ error: 'Erro ao salvar comentário' }, { status: 500 })
  }

  // Ajusta status conforme regra de negócio
  let novoStatus: string | null = null
  if (STATUS_REOPEN.has(chamado.status)) {
    novoStatus = 'reaberto'
  } else if (STATUS_REACTIVATE.has(chamado.status)) {
    novoStatus = 'em_atendimento'
  }

  if (novoStatus) {
    await supabase
      .from('ti_chamados')
      .update({ status: novoStatus })
      .eq('id', chamado.id)

    await supabase.from('ti_workflow_events').insert({
      chamado_id:    chamado.id,
      status_de:     chamado.status,
      status_para:   novoStatus,
      realizado_por: remetente_email,
      justificativa: 'Resposta por e-mail do solicitante',
    })
  }

  // Notifica o técnico responsável sobre a resposta do solicitante
  const tecnico = Array.isArray(chamado.tecnico) ? chamado.tecnico[0] : chamado.tecnico
  if (tecnico?.email) {
    const { tecnico: _, ...chamadoClean } = chamado
    const { subject, html } = emailNovoComentario(
      chamadoClean as any,
      chamado.solicitante_nome,
      texto_comentario.trim(),
      process.env.NEXT_PUBLIC_APP_URL || '',
    )
    await dispatchEmailEvent({
      to:         tecnico.email,
      subject,
      html,
      chamado_id: chamado.id,
      event_type: 'inbound_reply',
    })
  }

  return NextResponse.json({ success: true, comentario_id: comentario.id })
}
