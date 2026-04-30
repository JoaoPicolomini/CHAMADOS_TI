import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTiEmail } from '@/lib/ti/email/transporter'
import { emailChamadoAberto } from '@/lib/ti/email/templates'
import { calcularPrazoSla, getPrazoHorasPadrao } from '@/lib/ti/workflow'
import { criarChamadoSchema } from '@/lib/ti/validations'
import type { TiPrioridade } from '@/lib/ti/types'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const parsed = criarChamadoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const data      = parsed.data
    const supabase  = getAdminSupabase()
    const prioridade: TiPrioridade = 'media'

    // SLA lookup — por categoria, depois genérico
    let prazoHoras      = getPrazoHorasPadrao(prioridade)
    let horarioComercial = true

    if (data.categoria_id) {
      const { data: slaCat } = await supabase
        .from('ti_sla_configs')
        .select('prazo_horas, horario_comercial')
        .eq('prioridade', prioridade)
        .eq('categoria_id', data.categoria_id)
        .eq('ativo', true)
        .maybeSingle()
      if (slaCat) {
        prazoHoras       = slaCat.prazo_horas
        horarioComercial = slaCat.horario_comercial
      }
    }

    if (!prazoHoras) {
      const { data: slaGen } = await supabase
        .from('ti_sla_configs')
        .select('prazo_horas, horario_comercial')
        .eq('prioridade', prioridade)
        .is('categoria_id', null)
        .eq('ativo', true)
        .maybeSingle()
      if (slaGen) {
        prazoHoras       = slaGen.prazo_horas
        horarioComercial = slaGen.horario_comercial
      }
    }

    const slaPrazo = calcularPrazoSla(new Date(), prazoHoras, horarioComercial).toISOString()
    const ip       = req.headers.get('x-forwarded-for')?.split(',')[0] ?? null

    const { data: chamado, error } = await supabase
      .from('ti_chamados')
      .insert({
        solicitante_nome:    data.solicitante_nome.trim(),
        solicitante_email:   data.solicitante_email.trim().toLowerCase(),
        solicitante_ramal:   data.solicitante_ramal?.trim() ?? null,
        solicitante_setor:   data.solicitante_setor.trim(),
        solicitante_unidade: data.solicitante_unidade?.trim() ?? null,
        categoria_id:        data.categoria_id ?? null,
        subcategoria_id:     data.subcategoria_id ?? null,
        tipo:                data.tipo,
        prioridade,
        titulo:              data.titulo.trim(),
        descricao:           data.descricao.trim(),
        passos_reproduzir:   data.passos_reproduzir?.trim() ?? null,
        ativo_descricao:     data.ativo_descricao?.trim() ?? null,
        status:              'aberto',
        origem:              'portal',
        sla_prazo:           slaPrazo,
        sla_horas_pausadas:  0,
        sla_violado:         false,
        nivel_suporte:       1,
        ip_abertura:         ip,
      })
      .select('id, numero, titulo, solicitante_nome, solicitante_email, sla_prazo, prioridade, tipo, status, descricao, created_at')
      .single()

    if (error) throw new Error(error.message)

    // Log workflow
    await supabase.from('ti_workflow_events').insert({
      chamado_id:   chamado.id,
      status_de:    null,
      status_para:  'aberto',
      realizado_por: chamado.solicitante_email,
      metadata:     { source: 'public_form', ip },
    })

    // Confirmation e-mail (non-blocking on error)
    try {
      const { subject, html } = emailChamadoAberto(chamado, APP_URL)
      await sendTiEmail({ to: chamado.solicitante_email, subject, html, chamado_id: chamado.id })
    } catch (emailErr) {
      console.error('[TI Create] Email error:', emailErr)
    }

    return NextResponse.json({ success: true, chamado_id: chamado.id, numero: chamado.numero })
  } catch (err: any) {
    console.error('[TI Create]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
