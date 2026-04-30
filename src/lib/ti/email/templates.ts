// ============================================================
// EMAIL TEMPLATES — Sistema de Chamados de T.I
// ============================================================

import type { TiChamado } from '../types'
import { STATUS_LABELS, PRIORIDADE_LABELS, TIPO_LABELS } from '../constants'

// ─── Base HTML ────────────────────────────────────────────────
function baseTemplate(titulo: string, conteudo: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:#F5F7FA;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FA;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1E3A5F,#2563EB);border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:8px;display:flex;align-items:center;justify-content:center;">
                  <span style="color:#FFFFFF;font-size:20px;font-weight:700;">TI</span>
                </div>
                <div>
                  <div style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:-0.5px;">Suporte de T.I</div>
                  <div style="color:rgba(255,255,255,0.7);font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Central de Chamados</div>
                </div>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#FFFFFF;padding:32px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">
              ${conteudo}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                Este e-mail foi gerado automaticamente pelo sistema de Chamados de T.I.<br>
                Por favor, não responda diretamente a este e-mail.
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
  return `<span style="display:inline-block;padding:3px 10px;background:${cor}20;color:${cor};border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">${label}</span>`
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

// ─── Linha de detalhe ─────────────────────────────────────────
function detalheRow(label: string, valor: string): string {
  return `
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #F3F4F6;font-size:13px;color:#6B7280;font-weight:500;width:35%;">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid #F3F4F6;font-size:13px;color:#111827;">${valor}</td>
  </tr>`
}

// ─── Botão CTA ────────────────────────────────────────────────
function ctaButton(texto: string, url: string): string {
  return `
  <div style="text-align:center;margin:28px 0 8px;">
    <a href="${url}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#1E3A5F,#2563EB);color:#FFFFFF;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;letter-spacing:0.01em;">
      ${texto}
    </a>
  </div>`
}

// ============================================================
// TEMPLATE 1 — Chamado aberto (para o solicitante)
// ============================================================
export function emailChamadoAberto(chamado: Partial<TiChamado>, appUrl: string): { subject: string; html: string } {
  const subject = `✅ Chamado ${chamado.numero} aberto — ${chamado.titulo}`
  const url = `${appUrl}/ti/chamado/${chamado.id}`

  const html = baseTemplate('Chamado Aberto', `
    <h2 style="margin:0 0 6px;font-size:22px;color:#111827;font-weight:700;">Chamado aberto com sucesso!</h2>
    <p style="margin:0 0 24px;color:#6B7280;font-size:14px;">Olá, <strong>${chamado.solicitante_nome}</strong>! Seu chamado foi registrado e será atendido em breve.</p>

    <!-- Número do chamado em destaque -->
    <div style="background:#EFF6FF;border:2px solid #2563EB;border-radius:8px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;gap:12px;">
      <div>
        <div style="font-size:11px;color:#2563EB;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px;">Número do Chamado</div>
        <div style="font-size:26px;color:#1E3A5F;font-weight:800;letter-spacing:1px;">${chamado.numero}</div>
      </div>
      <div style="margin-left:auto;">${prioridadeBadge(chamado.prioridade || 'media')}</div>
    </div>

    <!-- Detalhes -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${detalheRow('Título', chamado.titulo || '')}
      ${detalheRow('Tipo', TIPO_LABELS[chamado.tipo as keyof typeof TIPO_LABELS] || chamado.tipo || '')}
      ${detalheRow('Status', statusBadge(chamado.status || 'aberto'))}
      ${chamado.sla_prazo ? detalheRow('Prazo SLA', new Date(chamado.sla_prazo).toLocaleString('pt-BR')) : ''}
    </table>

    <div style="background:#F9FAFB;border-radius:8px;padding:16px;margin-bottom:24px;">
      <div style="font-size:12px;color:#6B7280;font-weight:600;margin-bottom:6px;">DESCRIÇÃO</div>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${chamado.descricao || ''}</p>
    </div>

    ${ctaButton('Acompanhar Chamado', url)}

    <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;text-align:center;">
      Você receberá atualizações por e-mail quando o status do chamado for alterado.
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
  const subject = `🔔 Novo chamado atribuído — ${chamado.numero}`
  const url = `${appUrl}/ti/chamado/${chamado.id}`

  const html = baseTemplate('Chamado Atribuído', `
    <h2 style="margin:0 0 6px;font-size:22px;color:#111827;font-weight:700;">Chamado atribuído a você</h2>
    <p style="margin:0 0 24px;color:#6B7280;font-size:14px;">Olá, <strong>${tecnicoNome}</strong>! O chamado abaixo foi atribuído para seu atendimento.</p>

    <div style="background:#F0FDF4;border:2px solid #16A34A;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:11px;color:#16A34A;font-weight:600;text-transform:uppercase;margin-bottom:2px;">Número do Chamado</div>
      <div style="font-size:26px;color:#14532D;font-weight:800;">${chamado.numero}</div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${detalheRow('Título', chamado.titulo || '')}
      ${detalheRow('Solicitante', `${chamado.solicitante_nome} (${chamado.solicitante_setor})`)}
      ${detalheRow('Contato', chamado.solicitante_email || '')}
      ${detalheRow('Prioridade', prioridadeBadge(chamado.prioridade || 'media'))}
      ${detalheRow('Tipo', TIPO_LABELS[chamado.tipo as keyof typeof TIPO_LABELS] || '')}
      ${chamado.sla_prazo ? detalheRow('Prazo SLA', `<strong style="color:#DC2626;">${new Date(chamado.sla_prazo).toLocaleString('pt-BR')}</strong>`) : ''}
    </table>

    <div style="background:#F9FAFB;border-radius:8px;padding:16px;margin-bottom:24px;">
      <div style="font-size:12px;color:#6B7280;font-weight:600;margin-bottom:6px;">DESCRIÇÃO DO PROBLEMA</div>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${chamado.descricao || ''}</p>
    </div>

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
  const subject = `🔄 Chamado ${chamado.numero} — Status atualizado: ${statusLabel}`
  const url = `${appUrl}/ti/chamado/${chamado.id}`

  const html = baseTemplate('Status Atualizado', `
    <h2 style="margin:0 0 6px;font-size:22px;color:#111827;font-weight:700;">Atualização no seu chamado</h2>
    <p style="margin:0 0 24px;color:#6B7280;font-size:14px;">Olá, <strong>${chamado.solicitante_nome}</strong>! Houve uma atualização no seu chamado <strong>${chamado.numero}</strong>.</p>

    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;background:#F9FAFB;border-radius:8px;padding:16px 20px;">
      <div style="text-align:center;">
        <div style="font-size:11px;color:#6B7280;margin-bottom:4px;">ANTES</div>
        ${statusBadge(statusAnterior)}
      </div>
      <div style="font-size:20px;color:#9CA3AF;">→</div>
      <div style="text-align:center;">
        <div style="font-size:11px;color:#6B7280;margin-bottom:4px;">AGORA</div>
        ${statusBadge(chamado.status || '')}
      </div>
    </div>

    ${comentario ? `
    <div style="background:#F0F9FF;border-left:3px solid #2563EB;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px;">
      <div style="font-size:11px;color:#2563EB;font-weight:600;margin-bottom:4px;">OBSERVAÇÃO DO TÉCNICO</div>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${comentario}</p>
    </div>` : ''}

    ${chamado.status === 'resolvido' || chamado.status === 'fechado' ? `
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
      <div style="font-size:14px;color:#15803D;font-weight:600;margin-bottom:4px;">Chamado resolvido!</div>
      <p style="margin:0;font-size:13px;color:#166534;">
        Se o problema persistir ou retornar, você pode reabrir este chamado acessando o link abaixo.
      </p>
    </div>` : ''}

    ${ctaButton('Ver Chamado Completo', url)}
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
  const subject = `${isCritico ? '🚨' : '⚠️'} SLA em risco — Chamado ${chamado.numero} (${percentualConsumido.toFixed(0)}%)`
  const url = `${appUrl}/ti/chamado/${chamado.id}`
  const corAlerta = isCritico ? '#DC2626' : '#D97706'
  const bgAlerta = isCritico ? '#FEF2F2' : '#FFFBEB'

  const html = baseTemplate('Alerta de SLA', `
    <div style="background:${bgAlerta};border:2px solid ${corAlerta};border-radius:8px;padding:16px 20px;margin-bottom:24px;text-align:center;">
      <div style="font-size:36px;font-weight:800;color:${corAlerta};">${percentualConsumido.toFixed(0)}%</div>
      <div style="font-size:14px;color:${corAlerta};font-weight:600;">do prazo SLA consumido</div>
    </div>

    <h2 style="margin:0 0 6px;font-size:20px;color:#111827;font-weight:700;">
      ${isCritico ? '🚨 Prazo crítico!' : '⚠️ Atenção ao prazo!'}
    </h2>
    <p style="margin:0 0 24px;color:#6B7280;font-size:14px;">
      O chamado abaixo está ${isCritico ? '<strong>em situação crítica de SLA</strong>' : '<strong>com prazo em risco</strong>'}. Ação imediata necessária.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${detalheRow('Chamado', `<strong>${chamado.numero}</strong>`)}
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
  const subject = `⭐ Como foi seu atendimento? — Chamado ${chamado.numero}`
  const baseUrl = `${appUrl}/satisfacao/${chamado.id}`

  const estrelas = [1, 2, 3, 4, 5].map(nota => `
    <a href="${baseUrl}?nota=${nota}" style="display:inline-block;padding:12px 16px;background:#F9FAFB;border:2px solid #E5E7EB;border-radius:8px;text-decoration:none;margin:4px;font-size:22px;color:#374151;" title="${nota} estrela${nota > 1 ? 's' : ''}">
      ${'⭐'.repeat(nota)}
    </a>
  `).join('')

  const html = baseTemplate('Pesquisa de Satisfação', `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:8px;">🎉</div>
      <h2 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">Chamado concluído!</h2>
      <p style="margin:0;color:#6B7280;font-size:14px;">Seu chamado <strong>${chamado.numero}</strong> foi resolvido. Como foi o atendimento?</p>
    </div>

    <div style="background:#F9FAFB;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
      <div style="font-size:13px;color:#6B7280;margin-bottom:12px;">Clique para avaliar o atendimento recebido:</div>
      <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:4px;">
        ${estrelas}
      </div>
    </div>

    <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
      Sua avaliação nos ajuda a melhorar continuamente o suporte de T.I.<br>
      Obrigado pelo seu tempo!
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
  const subject = `⏳ Aguardando sua resposta — Chamado ${chamado.numero}`
  const url = `${appUrl}/ti/chamado/${chamado.id}`

  const html = baseTemplate('Pendente — Aguardando Resposta', `
    <div style="background:#FFFBEB;border:2px solid #D97706;border-radius:8px;padding:16px 20px;margin-bottom:24px;text-align:center;">
      <div style="font-size:36px;font-weight:800;color:#D97706;">${diasPendente}d</div>
      <div style="font-size:14px;color:#B45309;font-weight:600;">aguardando sua resposta</div>
    </div>

    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;font-weight:700;">Precisamos da sua resposta</h2>
    <p style="margin:0 0 24px;color:#6B7280;font-size:14px;">
      Olá, <strong>${chamado.solicitante_nome}</strong>! Seu chamado <strong>${chamado.numero}</strong> está aguardando uma resposta sua há <strong>${diasPendente} dia${diasPendente > 1 ? 's' : ''}</strong>.
      ${diasPendente >= 5 ? `<br><br><span style="color:#DC2626;font-weight:600;">⚠️ Se não houver resposta em breve, o chamado será fechado automaticamente.</span>` : ''}
    </p>

    ${ctaButton('Responder ao Chamado', url)}

    <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;text-align:center;">
      Se o problema já foi resolvido, clique no link para confirmar o fechamento.
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
  const subject = `💬 Novo comentário no chamado ${chamado.numero}`
  const url = `${appUrl}/ti/chamado/${chamado.id}`

  const html = baseTemplate('Novo Comentário', `
    <h2 style="margin:0 0 6px;font-size:22px;color:#111827;font-weight:700;">Novo comentário no seu chamado</h2>
    <p style="margin:0 0 24px;color:#6B7280;font-size:14px;">
      Olá, <strong>${chamado.solicitante_nome}</strong>! <strong>${autorNome}</strong> adicionou um comentário no chamado <strong>${chamado.numero}</strong>.
    </p>

    <div style="background:#F0F9FF;border-left:4px solid #2563EB;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:12px;color:#2563EB;font-weight:600;margin-bottom:6px;">${autorNome}</div>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${conteudo}</p>
    </div>

    ${ctaButton('Ver Chamado Completo', url)}
  `)

  return { subject, html }
}
