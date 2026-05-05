import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { emailLembretePendencia } from '@/lib/ti/email/templates'
import { dispatchEmailEvent } from '@/lib/ti/events/n8nDispatcher'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const DIAS_LEMBRETE = 3  // dias pendente_usuario → lembrete

/**
 * GET /api/ti/jobs/auto-close
 * Envia lembrete ao solicitante após 3 dias em pendente_usuario.
 */
export async function GET(req: NextRequest) {
  // Proteção
  const authHeader = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === 'true'
  const isLocal = process.env.NODE_ENV === 'development'

  if (!isLocal && !isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = getAdminSupabase()
  const now      = new Date()

  const stats = { lembretes: 0, erros: 0 }

  function diasAtras(n: number) {
    return new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
  }

  try {
    // LEMBRETE — pendente_usuario há >= 3 dias
    const { data: pendentesLembrete } = await supabase
      .from('ti_chamados')
      .select('id, numero, titulo, solicitante_nome, solicitante_email, updated_at')
      .eq('status', 'pendente_usuario')
      .lte('updated_at', diasAtras(DIAS_LEMBRETE))

    for (const chamado of pendentesLembrete ?? []) {
      try {
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
        await dispatchEmailEvent({ to: chamado.solicitante_email, subject, html, chamado_id: chamado.id, event_type: 'pending_reminder' })
        stats.lembretes++
      } catch (e) {
        console.error(`[lembrete] ${chamado.numero}:`, e)
        stats.erros++
      }
    }

    return NextResponse.json({ success: true, timestamp: now.toISOString(), stats })

  } catch (err: any) {
    console.error('[auto-close]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

