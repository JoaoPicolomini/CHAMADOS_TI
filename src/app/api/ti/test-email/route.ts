import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dispatchEmailEvent } from '@/lib/ti/events/n8nDispatcher'
import {
  emailChamadoAberto,
  emailChamadoAtribuido,
  emailStatusAlterado,
  emailNovoComentario,
  emailAlertaSla,
  emailLembretePendencia,
} from '@/lib/ti/email/templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const CHAMADO_FAKE = {
  id:               '00000000-0000-0000-0000-000000000001',
  numero:           '9999',
  titulo:           'Teste de e-mail — pode ignorar',
  descricao:        'Este é um e-mail de teste gerado pela página de diagnóstico do sistema.',
  status:           'em_atendimento' as const,
  prioridade:       'alta' as const,
  tipo:             'incidente' as const,
  solicitante_nome:  'Usuário Teste',
  solicitante_email: '',
  solicitante_setor: 'T.I',
  sla_prazo:         new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  tecnico_nome:      'Técnico Teste',
  tecnico_email:     '',
}

/** GET /api/ti/test-email?numero=000005 — busca chamado real para preview */
export async function GET(req: NextRequest) {
  const numero = (req.nextUrl.searchParams.get('numero') ?? '').trim()
  if (!numero) {
    return NextResponse.json({ error: 'Parâmetro numero obrigatório' }, { status: 400 })
  }

  const supabase = getAdminSupabase()
  const { data, error } = await supabase
    .from('ti_chamados')
    .select(`
      id, numero, titulo, descricao, status, prioridade, tipo,
      solicitante_nome, solicitante_email, solicitante_setor, sla_prazo,
      tecnico:tecnico_id(nome, email)
    `)
    .ilike('numero', `%${numero}`)
    .maybeSingle()

  if (error) {
    console.error('[test-email GET]', error)
    return NextResponse.json({ error: `Erro DB: ${error.message}` }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: `Chamado "${numero}" não encontrado` }, { status: 404 })
  }

  const tec = Array.isArray(data.tecnico) ? data.tecnico[0] : data.tecnico
  return NextResponse.json({
    ...data,
    tecnico_nome:  tec?.nome  ?? null,
    tecnico_email: tec?.email ?? null,
  })
}

/** POST /api/ti/test-email — dispara e-mail de teste */
export async function POST(req: NextRequest) {
  const { template, to, chamado_id } = await req.json()

  if (!to || !template) {
    return NextResponse.json({ error: 'Campos obrigatórios: template, to' }, { status: 400 })
  }

  // Se chamado_id fornecido, busca dados reais
  let chamado = { ...CHAMADO_FAKE, solicitante_email: to }

  if (chamado_id) {
    const supabase = getAdminSupabase()
    const { data } = await supabase
      .from('ti_chamados')
      .select(`
        id, numero, titulo, descricao, status, prioridade, tipo,
        solicitante_nome, solicitante_email, solicitante_setor, sla_prazo,
        tecnico:tecnico_id(nome, email)
      `)
      .eq('id', chamado_id)
      .maybeSingle()

    if (data) {
      const tec = Array.isArray(data.tecnico) ? data.tecnico[0] : data.tecnico
      chamado = {
        ...data,
        solicitante_email: to,   // destinatário do teste substitui o original
        tecnico_nome:  tec?.nome  ?? 'Técnico',
        tecnico_email: tec?.email ?? '',
      }
    }
  }

  let subject: string
  let html: string

  switch (template) {
    case 'chamado_aberto':
      ;({ subject, html } = emailChamadoAberto(chamado, APP_URL))
      break
    case 'chamado_atribuido':
      ;({ subject, html } = emailChamadoAtribuido(chamado, chamado.tecnico_nome, APP_URL))
      break
    case 'status_alterado':
      ;({ subject, html } = emailStatusAlterado(chamado, 'aberto', 'Chamado atribuído ao técnico responsável.', APP_URL))
      break
      case 'novo_comentario':
      ;({ subject, html } = emailNovoComentario(chamado, chamado.tecnico_nome, 'Olá! Estamos verificando o problema relatado. Em breve retornamos com uma solução.', APP_URL))
      break
    case 'alerta_sla':
      ;({ subject, html } = emailAlertaSla(chamado, 85, to, APP_URL))
      break
    case 'lembrete_pendencia':
      ;({ subject, html } = emailLembretePendencia(chamado, 4, APP_URL))
      break
    default:
      return NextResponse.json({ error: `Template desconhecido: ${template}` }, { status: 400 })
  }

  const ok = await dispatchEmailEvent({ to, subject, html, chamado_id: chamado.id, event_type: `test_${template}` })

  return NextResponse.json({ success: ok, subject, to, template })
}
