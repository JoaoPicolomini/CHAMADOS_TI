import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export interface EmailDispatchPayload {
  to: string
  subject: string
  html: string
  chamado_id?: string
  event_type?: string
}

// Usado apenas quando o SMTP fallback está ativo (n8n fora do ar)
async function logEmailFallback(
  payload: EmailDispatchPayload,
  status: 'success' | 'error',
  errorMessage?: string,
) {
  const supabase = getAdminSupabase()
  await supabase.from('ti_email_logs').insert({
    chamado_id:    payload.chamado_id ?? null,
    recipient:     payload.to,
    subject:       payload.subject,
    event_type:    payload.event_type ?? null,
    status,
    error_message: errorMessage ?? null,
  })
}

async function sendViaN8n(payload: EmailDispatchPayload): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL!

  const res = await fetch(url, {
    method:  'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-n8n-api-key': process.env.N8N_WEBHOOK_SECRET || ''
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(`n8n respondeu ${res.status}: ${await res.text()}`)
  }
}

async function sendViaSMTP(payload: EmailDispatchPayload): Promise<void> {
  const user = (process.env.SMTP_USER || '').trim()
  if (!user) throw new Error('SMTP não configurado')

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.default.createTransport({
    host:   (process.env.SMTP_HOST || 'smtp.office365.com').trim(),
    port:   parseInt((process.env.SMTP_PORT || '587').trim()),
    secure: false,
    auth:   { user, pass: (process.env.SMTP_PASS || '').trim() },
    tls:    { rejectUnauthorized: false },
  })

  await transporter.sendMail({
    from:    `"Suporte T.I" <${user}>`,
    to:      payload.to,
    subject: payload.subject,
    html:    payload.html,
  })
}

export async function dispatchEmailEvent(payload: EmailDispatchPayload): Promise<boolean> {
  const n8nConfigured = !!process.env.N8N_WEBHOOK_URL

  if (n8nConfigured) {
    try {
      await sendViaN8n(payload)
      // Log é feito pelo nó Postgres do n8n — não duplicar aqui
      console.log(`✅ [TI Mail] n8n OK — ${payload.event_type ?? 'email'} → ${payload.to}`)
      return true
    } catch (err: any) {
      console.error(`⚠️ [TI Mail] n8n falhou, usando SMTP fallback: ${err.message}`)
    }
  }

  // Fallback: SMTP direto + log manual (n8n não está envolvido)
  try {
    await sendViaSMTP(payload)
    await logEmailFallback(payload, 'success')
    console.log(`✅ [TI Mail] SMTP fallback OK → ${payload.to}`)
    return true
  } catch (err: any) {
    console.error(`❌ [TI Mail] Falha total no envio: ${err.message}`)
    await logEmailFallback(payload, 'error', err.message)
    return false
  }
}
