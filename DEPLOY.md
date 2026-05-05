# Guia de Deploy — Costa Lavos TI

Este guia detalha os passos necessários para realizar o deploy do sistema de Chamados de T.I no Vercel com segurança.

## 1. Variáveis de Ambiente (Vercel)

Configure as seguintes variáveis no painel do Vercel (**Settings > Environment Variables**):

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`: URL do seu projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Chave anônima do Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: **CRÍTICO**. Chave de serviço para operações administrativas. Nunca exponha ao cliente.

### Aplicação
- `NEXT_PUBLIC_APP_URL`: URL final do sistema (ex: `https://chamados.costalavos.com.br`).
- `CRON_SECRET`: Um segredo aleatório para proteger as rotas de automação (Jobs).
- `WEBHOOK_SECRET`: Um segredo aleatório para validar chamadas vindas do n8n.

### E-mail (SMTP Fallback)
Se o n8n falhar, o sistema tentará enviar via SMTP direto:
- `SMTP_HOST`: ex: `smtp.office365.com`
- `SMTP_PORT`: ex: `587`
- `SMTP_USER`: Seu e-mail de envio.
- `SMTP_PASS`: Senha ou App Password.

### Autenticação (Microsoft/Azure AD)
- `NEXT_PUBLIC_AZURE_AD_CLIENT_ID`: ID do aplicativo registrado no Azure.
- `NEXT_PUBLIC_AZURE_AD_TENANT_ID`: ID do diretório (tenant).

## 2. Configuração de Cron Jobs (Vercel)

O projeto já contém um arquivo `vercel.json` que define os agendamentos. Ao fazer o deploy, o Vercel detectará automaticamente:

- **SLA Monitor**: Executa a cada 15 minutos (`*/15 * * * *`).
- **Auto-Close (Lembretes)**: Executa diariamente às 09:00 (`0 9 * * *`).

**Segurança**: As rotas agora verificam o `CRON_SECRET`. O Vercel injeta isso automaticamente se você configurar a variável, mas você também pode passar o header `Authorization: Bearer <seu_segredo>` para testar manualmente.

## 3. Integração n8n

Para que o recebimento de e-mails funcione:
1. No seu workflow do n8n, adicione um header `x-webhook-secret` com o mesmo valor configurado no Vercel.
2. Aponte o webhook para `https://seu-dominio.com/api/webhooks/n8n`.

## 4. Verificações Finais

- [ ] Execute `npm run build` localmente para garantir que não há erros de tipo. (Já verificado na auditoria atual).
- [ ] Certifique-se de que o bucket `ti-attachments` existe no Storage do Supabase e é público (ou possui as políticas de RLS adequadas).
- [ ] Verifique se a tabela `ti_access_users` contém o seu e-mail com perfil `admin` para que você possa acessar o painel.

---
*Gerado automaticamente pela auditoria de pré-deploy.*
