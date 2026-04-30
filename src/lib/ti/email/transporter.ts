import nodemailer from 'nodemailer'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const tiTransporter = nodemailer.createTransport({
  host:   (process.env.SMTP_HOST || 'smtp.office365.com').trim(),
  port:   parseInt((process.env.SMTP_PORT || '587').trim()),
  secure: false,
  auth: {
    user: (process.env.SMTP_USER || '').trim(),
    pass: (process.env.SMTP_PASS || '').trim(),
  },
  tls: {
    rejectUnauthorized: false,
  },
})

export async function sendTiEmail({
  to,
  subject,
  html,
  chamado_id,
  attachments,
}: {
  to: string
  subject: string
  html: string
  chamado_id?: string
  attachments?: nodemailer.SendMailOptions['attachments']
}) {
  const user = (process.env.SMTP_USER || '').trim()
  const supabase = createServiceRoleClient()

  if (!user) {
    console.warn('⚠️ [TI Mail] Disparo ignorado: SMTP não configurado.')
    return false
  }

  try {
    const info = await tiTransporter.sendMail({
      from:        `"Suporte T.I" <${user}>`,
      to,
      subject,
      html,
      attachments,
    })
    console.log('✅ [TI Mail] E-mail enviado:', info.messageId)

    await supabase.from('ti_email_logs').insert({
      chamado_id: chamado_id ?? null,
      recipient:  to,
      subject,
      status:     'success',
    })

    return true
  } catch (error: any) {
    console.error('❌ [TI Mail] Erro ao enviar:', error)

    await supabase.from('ti_email_logs').insert({
      chamado_id:    chamado_id ?? null,
      recipient:     to,
      subject,
      status:        'error',
      error_message: error.message,
    })

    return false
  }
}
