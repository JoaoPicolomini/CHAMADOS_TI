import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calcularSla } from '@/lib/ti/workflow'
import { emailAlertaSla } from '@/lib/ti/email/templates'
import { dispatchEmailEvent } from '@/lib/ti/events/n8nDispatcher'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const STATUS_ATIVOS = ['aberto', 'em_atendimento', 'escalado', 'reaberto']

/**
 * GET /api/ti/jobs/sla-monitor
 * Verificação de SLA: marca violações e envia alertas de 70% e 90%.
 */
export async function GET(req: NextRequest) {
  // Proteção: apenas o Vercel Cron ou quem tiver o segredo pode rodar
  const authHeader = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === 'true'
  const isLocal = process.env.NODE_ENV === 'development'

  if (!isLocal && !isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = getAdminSupabase()
  const now      = new Date()

  const stats = {
    processados: 0,
    violadosNovos: 0,
    alertas70: 0,
    alertas90: 0,
    erros: 0,
  }

  try {
    // ── Busca chamados ativos com SLA ──────────────────────
    const { data: chamados, error } = await supabase
      .from('ti_chamados')
      .select(`
        id, numero, titulo, prioridade, status, created_at,
        sla_prazo, sla_violado, sla_horas_pausadas,
        solicitante_nome, solicitante_email, solicitante_setor,
        tecnico:tecnico_id(id, email, nome)
      `)
      .in('status', STATUS_ATIVOS)
      .not('sla_prazo', 'is', null)

    if (error) throw error

    for (const chamado of chamados ?? []) {
      try {
        stats.processados++

        const sla = calcularSla(
          chamado.sla_prazo,
          chamado.sla_violado,
          chamado.sla_horas_pausadas ?? 0,
          chamado.created_at,
        )
        if (!sla) continue

        // 1. Marca como violado se ainda não estava
        if (sla.violado && !chamado.sla_violado) {
          await supabase
            .from('ti_chamados')
            .update({ sla_violado: true, sla_violado_em: now.toISOString() })
            .eq('id', chamado.id)
          stats.violadosNovos++
        }

        // 2. Alerta ao técnico (somente se houver técnico atribuído)
        const tData = Array.isArray(chamado.tecnico) ? chamado.tecnico[0] : chamado.tecnico
        const tecnico = tData as { id: string; email: string; nome: string } | null
        if (!tecnico?.email) continue

        const limiarAlerta = sla.percentual >= 90 ? 90 : sla.percentual >= 70 ? 70 : 0
        if (!limiarAlerta) continue

        // Verifica se já foi enviado alerta recente para este chamado
        const janela = limiarAlerta >= 90
          ? new Date(now.getTime() - 24 * 60 * 60 * 1000)   // 24h para crítico
          : new Date(now.getTime() - 72 * 60 * 60 * 1000)   // 72h para warning

        const { data: alertaRecente } = await supabase
          .from('ti_email_logs')
          .select('id')
          .eq('chamado_id', chamado.id)
          .eq('status', 'success')
          .ilike('subject', '%SLA em risco%')
          .gte('created_at', janela.toISOString())
          .limit(1)
          .maybeSingle()

        if (alertaRecente) continue

        // Envia alerta
        const { subject, html } = emailAlertaSla(
          { ...chamado, tecnico } as any,
          sla.percentual,
          tecnico.email,
          APP_URL,
        )
        await dispatchEmailEvent({ to: tecnico.email, subject, html, chamado_id: chamado.id, event_type: 'sla_alert' })

        if (limiarAlerta >= 90) stats.alertas90++
        else stats.alertas70++

      } catch (innerErr) {
        console.error(`[sla-monitor] Chamado ${chamado.numero}:`, innerErr)
        stats.erros++
      }
    }

    return NextResponse.json({ success: true, timestamp: now.toISOString(), stats })

  } catch (err: any) {
    console.error('[sla-monitor]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
