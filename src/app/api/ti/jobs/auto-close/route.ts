import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { emailLembretePendencia, emailPesquisaSatisfacao } from '@/lib/ti/email/templates'
import { sendTiEmail } from '@/lib/ti/email/transporter'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET || ''

// Constantes de tempo
const DIAS_LEMBRETE       = 3  // dias pendente_usuario → lembrete
const DIAS_FECHAR_USUARIO = 7  // dias pendente_usuario → auto-fechar
const DIAS_FECHAR_RESOLVIDO = 5 // dias resolvido → auto-fechar

/**
 * GET /api/ti/jobs/auto-close
 * 1. Envia lembrete ao solicitante após 3 dias em pendente_usuario
 * 2. Fecha automaticamente após 7 dias em pendente_usuario
 * 3. Fecha automaticamente após 5 dias em resolvido + envia CSAT
 *
 * Protegido por Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = getAdminSupabase()
  const now      = new Date()

  const stats = {
    lembretes:     0,
    fechadosPendente: 0,
    fechadosResolvido: 0,
    csatEnviados:  0,
    erros:         0,
  }

  // ── Helper: calcula data limite ────────────────────────────
  function diasAtras(n: number) {
    return new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
  }

  try {

    // ─────────────────────────────────────────────────────────
    // 1. LEMBRETE — pendente_usuario há >= 3 dias (mas < 7)
    // ─────────────────────────────────────────────────────────
    const { data: pendentesLembrete } = await supabase
      .from('ti_chamados')
      .select('id, numero, titulo, solicitante_nome, solicitante_email, updated_at')
      .eq('status', 'pendente_usuario')
      .lte('updated_at', diasAtras(DIAS_LEMBRETE))
      .gt('updated_at',  diasAtras(DIAS_FECHAR_USUARIO))

    for (const chamado of pendentesLembrete ?? []) {
      try {
        // Verifica se já enviamos lembrete recente (últimas 24h)
        const { data: lembreteRecente } = await supabase
          .from('ti_email_logs')
          .select('id')
          .eq('chamado_id', chamado.id)
          .eq('status', 'success')
          .ilike('subject', '%Aguardando sua resposta%')
          .gte('created_at', diasAtras(1))
          .limit(1)
          .maybeSingle()

        if (lembreteRecente) continue

        const diasPendente = Math.floor(
          (now.getTime() - new Date(chamado.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        )
        const { subject, html } = emailLembretePendencia(chamado, diasPendente, APP_URL)
        await sendTiEmail({ to: chamado.solicitante_email, subject, html, chamado_id: chamado.id })
        stats.lembretes++
      } catch (e) {
        console.error(`[auto-close] Lembrete ${chamado.numero}:`, e)
        stats.erros++
      }
    }

    // ─────────────────────────────────────────────────────────
    // 2. AUTO-FECHAR — pendente_usuario há >= 7 dias
    // ─────────────────────────────────────────────────────────
    const { data: pendentesFechar } = await supabase
      .from('ti_chamados')
      .select('id, numero, titulo, solicitante_nome, solicitante_email, updated_at')
      .eq('status', 'pendente_usuario')
      .lte('updated_at', diasAtras(DIAS_FECHAR_USUARIO))

    for (const chamado of pendentesFechar ?? []) {
      try {
        // Fecha como fechado_automatico
        await supabase
          .from('ti_chamados')
          .update({
            status:     'fechado_automatico',
            fechado_em: now.toISOString(),
            fechado_por: 'sistema',
            updated_at: now.toISOString(),
          })
          .eq('id', chamado.id)

        // Workflow event
        await supabase.from('ti_workflow_events').insert({
          chamado_id:    chamado.id,
          status_de:     'pendente_usuario',
          status_para:   'fechado_automatico',
          realizado_por: 'sistema',
          justificativa: `Fechado automaticamente após ${DIAS_FECHAR_USUARIO} dias sem resposta do solicitante.`,
        })

        stats.fechadosPendente++

        // Envia CSAT
        await enviarCsat(supabase, chamado)
        stats.csatEnviados++
      } catch (e) {
        console.error(`[auto-close] Fechar pendente ${chamado.numero}:`, e)
        stats.erros++
      }
    }

    // ─────────────────────────────────────────────────────────
    // 3. AUTO-FECHAR — resolvido há >= 5 dias sem confirmação
    // ─────────────────────────────────────────────────────────
    const { data: resolvidosFechar } = await supabase
      .from('ti_chamados')
      .select('id, numero, titulo, solicitante_nome, solicitante_email, updated_at')
      .eq('status', 'resolvido')
      .lte('updated_at', diasAtras(DIAS_FECHAR_RESOLVIDO))

    for (const chamado of resolvidosFechar ?? []) {
      try {
        await supabase
          .from('ti_chamados')
          .update({
            status:     'fechado_automatico',
            fechado_em: now.toISOString(),
            fechado_por: 'sistema',
            updated_at: now.toISOString(),
          })
          .eq('id', chamado.id)

        await supabase.from('ti_workflow_events').insert({
          chamado_id:    chamado.id,
          status_de:     'resolvido',
          status_para:   'fechado_automatico',
          realizado_por: 'sistema',
          justificativa: `Fechado automaticamente após ${DIAS_FECHAR_RESOLVIDO} dias sem confirmação do solicitante.`,
        })

        stats.fechadosResolvido++

        // Envia CSAT (somente se não enviou antes)
        const enviou = await enviarCsat(supabase, chamado)
        if (enviou) stats.csatEnviados++
      } catch (e) {
        console.error(`[auto-close] Fechar resolvido ${chamado.numero}:`, e)
        stats.erros++
      }
    }

    return NextResponse.json({ success: true, timestamp: now.toISOString(), stats })

  } catch (err: any) {
    console.error('[auto-close]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// ─── Helper: envia CSAT se ainda não enviado ──────────────────
async function enviarCsat(supabase: ReturnType<typeof createClient>, chamado: any): Promise<boolean> {
  try {
    // Verifica se já enviou
    const { data: csatExistente } = await supabase
      .from('ti_email_logs')
      .select('id')
      .eq('chamado_id', chamado.id)
      .eq('status', 'success')
      .ilike('subject', '%Como foi seu atendimento%')
      .limit(1)
      .maybeSingle()

    if (csatExistente) return false

    const { subject, html } = emailPesquisaSatisfacao(chamado, APP_URL)
    await sendTiEmail({ to: chamado.solicitante_email, subject, html, chamado_id: chamado.id })

    // Marca satisfacao_enviado_em
    await supabase
      .from('ti_chamados')
      .update({ satisfacao_enviado_em: new Date().toISOString() })
      .eq('id', chamado.id)

    return true
  } catch {
    return false
  }
}
