// ============================================================
// EMAIL TEMPLATES — Sistema de Chamados de T.I
// ============================================================

import type { TiChamado } from '../types'
import { STATUS_LABELS, PRIORIDADE_LABELS, TIPO_LABELS } from '../constants'

// ─── Base HTML ────────────────────────────────────────────────
function baseTemplate(conteudo: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#EFEDE8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFEDE8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #F0EFEB;">
              <span style="font-size:22px;font-weight:700;color:#1A1A1A;letter-spacing:-0.3px;">Costa Lavos</span>
              <span style="font-size:22px;font-weight:700;color:#2563EB;margin-left:6px;">T.I</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              ${conteudo}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #F0EFEB;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
                Este e-mail foi gerado automaticamente pelo sistema de Chamados de T.I.<br>
                Você pode <strong>responder a este e-mail</strong> para adicionar um comentário ao chamado.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Badge do chamado ─────────────────────────────────────────
function numeroBadge(numero: string | undefined): string {
  return `<span style="display:inline-block;padding:4px 14px;border:1.5px solid #1A1A1A;border-radius:999px;font-size:13px;font-weight:600;color:#1A1A1A;letter-spacing:0.02em;">${numero ?? ''}</span>`
}

// ─── Badge de prioridade ──────────────────────────────────────
function prioridadeBadge(prioridade: string): string {
  const cores: Record<string, string> = {
    critica: '#DC2626',
    alta:    '#EA580C',
    media:   '#D97706',
    baixa:   '#6B7280',
  }
  const cor = cores[prioridade] || '#6B7280'
  const label = PRIORIDADE_LABELS[prioridade as keyof typeof PRIORIDADE_LABELS] || prioridade
  return `<span style="display:inline-block;padding:3px 10px;background:${cor}18;color:${cor};border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">${label}</span>`
}

// ─── Badge de status ──────────────────────────────────────────
function statusBadge(status: string): string {
  const cores: Record<string, string> = {
    aberto:             '#2563EB',
    em_atendimento:     '#7C3AED',
    pendente_usuario:   '#D97706',
    pendente_terceiro:  '#EA580C',
    escalado:           '#DC2626',
    resolvido:          '#059669',
    fechado:            '#16A34A',
    fechado_automatico: '#6B7280',
    reaberto:           '#B91C1C',
    cancelado:          '#374151',
  }
  const cor = cores[status] || '#6B7280'
  const label = STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status
  return `<span style="display:inline-block;padding:3px 10px;background:${cor}15;color:${cor};border-radius:4px;font-size:12px;font-weight:600;">${label}</span>`
}

// ─── Caixa de mensagem (estilo RNC) ───────────────────────────
function caixaMensagem(label: string, conteudo: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="border:1px solid #E5E3DC;border-radius:8px;padding:16px 20px;">
        <div style="font-size:11px;font-weight:700;color:#9CA3AF;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">${label}</div>
        <div style="font-size:14px;color:#374151;line-height:1.7;border-left:3px solid #2563EB;padding-left:12px;font-style:italic;">${conteudo}</div>
      </td>
    </tr>
  </table>`
}

// ─── Linha de detalhe ─────────────────────────────────────────
function detalheRow(label: string, valor: string): string {
  return `
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #F3F4F6;font-size:12px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;width:35%;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid #F3F4F6;font-size:13px;color:#1A1A1A;">${valor}</td>
  </tr>`
}

// ─── Botão CTA ────────────────────────────────────────────────
function ctaButton(texto: string, url: string): string {
  return `
  <div style="text-align:center;margin:28px 0 8px;">
    <a href="${url}" style="display:inline-block;padding:13px 32px;background:#1A1A1A;color:#FFFFFF;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;letter-spacing:0.02em;">
      ${texto}
    </a>
  </div>`
}

// ============================================================
// TEMPLATE 1 — Chamado aberto (para o solicitante)
// ============================================================
export function emailChamadoAberto(chamado: Partial<TiChamado>, appUrl: string): { subject: string; html: string } {
  const subject = `✅ [Chamado #${chamado.numero}] Aberto — ${chamado.titulo}`

  const html = baseTemplate(`
    <div style="text-align:center;margin-bottom:28px;">
      ${numeroBadge(chamado.numero)}
      <h2 style="margin:16px 0 6px;font-size:20px;font-weight:700;color:#1A1A1A;">Chamado Aberto com Sucesso</h2>
      <p style="margin:0;font-size:14px;color:#6B7280;">Olá, <strong>${chamado.solicitante_nome}</strong>! Seu chamado foi registrado.</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      ${detalheRow('Título', chamado.titulo || '')}
      ${detalheRow('Tipo', TIPO_LABELS[chamado.tipo as keyof typeof TIPO_LABELS] || chamado.tipo || '')}
      ${detalheRow('Status', statusBadge(chamado.status || 'aberto'))}
      ${detalheRow('Prioridade', prioridadeBadge(chamado.prioridade || 'media'))}
      ${chamado.sla_prazo ? detalheRow('Prazo SLA', new Date(chamado.sla_prazo).toLocaleString('pt-BR')) : ''}
    </table>

    ${chamado.descricao ? caixaMensagem('Descrição', chamado.descricao) : ''}

    <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;text-align:center;">
      Você receberá atualizações por e-mail conforme o chamado avançar.
    </p>
  `)

  return { subject, html }
}

// ============================================================
// TEMPLATE 2 — Chamado atribuído (para o técnico)
// ============================================================
export function emailChamadoAtribuido(
  chamado: Partial<TiChamado>,
  tecnicoNome: string,
  appUrl: string,
): { subject: string; html: string } {
  const subject = `🔔 [Chamado #${chamado.numero}] Atribuído a você`
  const url = `${appUrl}/ti/chamado/${chamado.id}`

  const html = baseTemplate(`
    <div style="text-align:center;margin-bottom:28px;">
      ${numeroBadge(chamado.numero)}
      <h2 style="margin:16px 0 6px;font-size:20px;font-weight:700;color:#1A1A1A;">Chamado Atribuído a Você</h2>
      <p style="margin:0;font-size:14px;color:#6B7280;">Olá, <strong>${tecnicoNome}</strong>! O chamado abaixo está sob sua responsabilidade.</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      ${detalheRow('Título', chamado.titulo || '')}
      ${detalheRow('Solicitante', chamado.solicitante_nome || '')}
      ${detalheRow('Setor', chamado.solicitante_setor || '')}
      ${detalheRow('Contato', chamado.solicitante_email || '')}
      ${detalheRow('Prioridade', prioridadeBadge(chamado.prioridade || 'media'))}
      ${chamado.sla_prazo ? detalheRow('Prazo SLA', `<strong style="color:#DC2626;">${new Date(chamado.sla_prazo).toLocaleString('pt-BR')}</strong>`) : ''}
    </table>

    ${chamado.descricao ? caixaMensagem('Descrição do Problema', chamado.descricao) : ''}

    ${ctaButton('Abrir Chamado', url)}
  `)

  return { subject, html }
}

// ============================================================
// TEMPLATE 3 — Status alterado (para o solicitante)
// ============================================================
export function emailStatusAlterado(
  chamado: Partial<TiChamado>,
  statusAnterior: string,
  comentario: string | undefined,
  appUrl: string,
): { subject: string; html: string } {
  const statusLabel = STATUS_LABELS[chamado.status as keyof typeof STATUS_LABELS] || chamado.status
  const subject = `🔄 [Chamado #${chamado.numero}] Status: ${statusLabel}`

  const html = baseTemplate(`
    <div style="text-align:center;margin-bottom:28px;">
      ${numeroBadge(chamado.numero)}
      <h2 style="margin:16px 0 6px;font-size:20px;font-weight:700;color:#1A1A1A;">Atualização no Chamado</h2>
      <p style="margin:0;font-size:14px;color:#6B7280;">Olá, <strong>${chamado.solicitante_nome}</strong>! Houve uma mudança no status do seu chamado.</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      ${detalheRow('Título', chamado.titulo || '')}
      ${detalheRow('Status anterior', statusBadge(statusAnterior))}
      ${detalheRow('Novo status', statusBadge(chamado.status || ''))}
    </table>

    ${comentario ? caixaMensagem('Observação do Técnico', comentario) : ''}

    ${chamado.status === 'resolvido' || chamado.status === 'fechado' ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px 20px;text-align:center;">
          <div style="font-size:14px;font-weight:600;color:#15803D;">Chamado resolvido!</div>
          <div style="font-size:13px;color:#166534;margin-top:4px;">Se o problema retornar, você pode reabrir o chamado respondendo a este e-mail.</div>
        </td>
      </tr>
    </table>` : ''}
  `)

  return { subject, html }
}

// ============================================================
// TEMPLATE 4 — Alerta de SLA
// ============================================================
export function emailAlertaSla(
  chamado: Partial<TiChamado>,
  percentualConsumido: number,
  _tecnicoEmail: string,
  appUrl: string,
): { subject: string; html: string } {
  const isCritico = percentualConsumido >= 90
  const subject = `${isCritico ? '🚨' : '⚠️'} [Chamado #${chamado.numero}] SLA em risco (${percentualConsumido.toFixed(0)}%)`
  const url = `${appUrl}/ti/chamado/${chamado.id}`
  const corAlerta = isCritico ? '#DC2626' : '#D97706'

  const html = baseTemplate(`
    <div style="text-align:center;margin-bottom:28px;">
      ${numeroBadge(chamado.numero)}
      <h2 style="margin:16px 0 6px;font-size:20px;font-weight:700;color:#1A1A1A;">
        ${isCritico ? 'Prazo Crítico de SLA' : 'Alerta de SLA'}
      </h2>
      <p style="margin:0;font-size:14px;color:#6B7280;">
        O chamado abaixo está com <strong style="color:${corAlerta};">${percentualConsumido.toFixed(0)}% do prazo consumido</strong>.
      </p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      ${detalheRow('Título', chamado.titulo || '')}
      ${detalheRow('Solicitante', `${chamado.solicitante_nome} — ${chamado.solicitante_setor}`)}
      ${detalheRow('Prioridade', prioridadeBadge(chamado.prioridade || 'media'))}
      ${detalheRow('Status', statusBadge(chamado.status || ''))}
      ${chamado.sla_prazo ? detalheRow('Prazo SLA', `<strong style="color:${corAlerta};">${new Date(chamado.sla_prazo).toLocaleString('pt-BR')}</strong>`) : ''}
    </table>

    ${ctaButton('Atender Chamado Agora', url)}
  `)

  return { subject, html }
}

// ============================================================
// TEMPLATE 5 — Pesquisa de satisfação
// ============================================================
export function emailPesquisaSatisfacao(
  chamado: Partial<TiChamado>,
  appUrl: string,
): { subject: string; html: string } {
  const subject = `⭐ [Chamado #${chamado.numero}] Como foi seu atendimento?`
  const baseUrl = `${appUrl}/satisfacao/${chamado.id}`

  const estrelas = [1, 2, 3, 4, 5].map(nota => `
    <a href="${baseUrl}?nota=${nota}" style="display:inline-block;padding:10px 14px;background:#F9FAFB;border:1.5px solid #E5E3DC;border-radius:8px;text-decoration:none;margin:4px;font-size:20px;" title="${nota} estrela${nota > 1 ? 's' : ''}">
      ${'⭐'.repeat(nota)}
    </a>
  `).join('')

  const html = baseTemplate(`
    <div style="text-align:center;margin-bottom:28px;">
      ${numeroBadge(chamado.numero)}
      <h2 style="margin:16px 0 6px;font-size:20px;font-weight:700;color:#1A1A1A;">Como foi o atendimento?</h2>
      <p style="margin:0;font-size:14px;color:#6B7280;">
        Olá, <strong>${chamado.solicitante_nome}</strong>! Seu chamado foi resolvido. Avalie o suporte recebido.
      </p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td style="border:1px solid #E5E3DC;border-radius:8px;padding:20px;text-align:center;">
          <div style="font-size:11px;font-weight:700;color:#9CA3AF;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:14px;">Clique para avaliar</div>
          <div>${estrelas}</div>
        </td>
      </tr>
    </table>

    <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;text-align:center;">
      Sua avaliação nos ajuda a melhorar continuamente o suporte de T.I. Obrigado!
    </p>
  `)

  return { subject, html }
}

// ============================================================
// TEMPLATE 6 — Lembrete de pendência (usuário não respondeu)
// ============================================================
export function emailLembretePendencia(
  chamado: Partial<TiChamado>,
  diasPendente: number,
  appUrl: string,
): { subject: string; html: string } {
  const subject = `⏳ [Chamado #${chamado.numero}] Aguardando sua resposta`

  const html = baseTemplate(`
    <div style="text-align:center;margin-bottom:28px;">
      ${numeroBadge(chamado.numero)}
      <h2 style="margin:16px 0 6px;font-size:20px;font-weight:700;color:#1A1A1A;">Aguardando sua Resposta</h2>
      <p style="margin:0;font-size:14px;color:#6B7280;">
        Olá, <strong>${chamado.solicitante_nome}</strong>! Seu chamado está aguardando uma resposta sua há <strong>${diasPendente} dia${diasPendente > 1 ? 's' : ''}</strong>.
      </p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      ${detalheRow('Título', chamado.titulo || '')}
      ${detalheRow('Status', statusBadge('pendente_usuario'))}
      ${detalheRow('Aguardando há', `${diasPendente} dia${diasPendente > 1 ? 's' : ''}`)}
    </table>

    ${diasPendente >= 5 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:14px 20px;text-align:center;">
          <div style="font-size:13px;font-weight:600;color:#DC2626;">Se não houver resposta em breve, o chamado será fechado automaticamente.</div>
        </td>
      </tr>
    </table>` : ''}

    <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;text-align:center;">
      Para interagir com este chamado, basta responder a este e-mail.
    </p>
  `)

  return { subject, html }
}

// ============================================================
// TEMPLATE 7 — Novo comentário
// ============================================================
export function emailNovoComentario(
  chamado: Partial<TiChamado>,
  autorNome: string,
  conteudo: string,
  appUrl: string,
): { subject: string; html: string } {
  const subject = `💬 [Chamado #${chamado.numero}] Novo comentário`

  const html = baseTemplate(`
    <div style="text-align:center;margin-bottom:28px;">
      ${numeroBadge(chamado.numero)}
      <h2 style="margin:16px 0 6px;font-size:20px;font-weight:700;color:#1A1A1A;">Novo Comentário Adicionado</h2>
      <p style="margin:0;font-size:14px;color:#6B7280;">
        Olá, <strong>${chamado.solicitante_nome}</strong>! <strong>${autorNome}</strong> comentou no seu chamado.
      </p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      ${detalheRow('Chamado', chamado.titulo || '')}
      ${detalheRow('Comentado por', autorNome)}
    </table>

    ${caixaMensagem('Mensagem', conteudo)}
  `)

  return { subject, html }
}
