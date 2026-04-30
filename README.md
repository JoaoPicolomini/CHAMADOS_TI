# 🛡️ Costa Lavos | Central de Suporte T.I

Uma plataforma premium de Service Desk construída para modernizar a gestão de incidentes e solicitações de tecnologia. Desenvolvida com **Next.js 16**, **Supabase** e **Azure AD**, a central oferece um ecossistema completo para usuários, técnicos e gestores.

---

## 🌟 Diferenciais do Sistema

*   **Design State-of-the-Art**: Interface moderna baseada em Glassmorphism, tipografia refinada (Inter) e paleta Navy/Gold.
*   **Workflow Inteligente**: Máquina de estados robusta que valida cada transição de status com base no perfil do usuário.
*   **SLA Engine Real-time**: Cálculo de prazos com suporte a Horário Comercial (8h-18h), enviando alertas automáticos de violação.
*   **Segurança Enterprise**: Autenticação via Microsoft MSAL (Azure AD) combinada com controle de acesso granular (RBAC).

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Descrição |
|---|---|---|
| **Core** | [Next.js 16](https://nextjs.org/) | App Router, Server Actions e Turbopack |
| **Banco de Dados** | [Supabase](https://supabase.com/) | PostgreSQL com RLS e Auditoria Imutável |
| **Autenticação** | [Azure MSAL](https://learn.microsoft.com/en-us/entra/identity-platform/msal-overview) | Integração nativa com Microsoft AD |
| **Estilização** | [Tailwind CSS v4](https://tailwindcss.com/) | Design tokens e utilitários modernos |
| **Gráficos** | [Recharts](https://recharts.org/) | Dashboard analítico dinâmico |
| **Notificações** | [Nodemailer](https://nodemailer.com/) | SMTP robusto via Office 365 |
| **Validação** | [Zod](https://zod.dev/) | Schemas de dados e tipagem forte |

---

## 🏗️ Arquitetura do Projeto

O sistema foi migrado e isolado para garantir performance e manutenibilidade.

*   **Frontend**: `/src/app/ti/*` (Rotas isoladas)
*   **Lógica de Negócio**: `/src/lib/ti/*` (Ações, Workflows e Tipos)
*   **API / Webhooks**: `/src/app/api/ti/*` (Jobs de monitoramento e criação)
*   **Banco de Dados**: Migrations prefixadas com `ti_` para separação de esquemas.

---

## 🚀 Funcionalidades Entregues

### 👤 Para Usuários
*   **Abertura Expressa (`/ti/abrir`)**: Wizard de 3 etapas com compressão de imagens no cliente e upload de anexos.
*   **Meus Chamados**: Acompanhamento em tempo real do status, SLA e comentários técnicos.
*   **Base de Conhecimento**: Acesso a artigos de solução rápida para autoatendimento.

### 🛠️ Para Técnicos
*   **Dashboard Operacional**: Filtros avançados por status, prioridade e categoria.
*   **Gestão de Workflow**: Ações de assumir, escalar (N1, N2, N3), pausar e resolver chamados.
*   **Timeline Detalhada**: Histórico visual de todas as alterações feitas no chamado.
*   **Comentários Internos/Externos**: Comunicação segregada entre equipe técnica e usuário.

### 📊 Para Gestores (Admin)
*   **Analytics Pro**: Gráficos de volume, tendência, MTTR e conformidade de SLA.
*   **Gestão de Ativos**: Inventário completo de hardware e software da empresa.
*   **Matriz de Acesso**: Configuração dinâmica de permissões por perfil (RBAC).
*   **Monitor de SLA**: Visão crítica de todos os chamados próximos da violação.
*   **Automação (Jobs)**: Envio automático de lembretes e fechamento de chamados inativos.

---

## 🔐 Segurança e Governança

1.  **RBAC (Role Based Access Control)**: Perfis `user`, `tecnico`, `gestor_ti` e `admin`.
2.  **Auditoria Imutável**: Todas as trocas de status e alterações de campos sensíveis são gravadas em tabelas que não permitem DELETE/UPDATE.
3.  **Whitelist de Acesso**: Apenas e-mails autorizados na tabela `ti_access_users` podem acessar os módulos internos.
4.  **Sanitização de Dados**: Inputs validados via Zod tanto no client quanto no server.

---

## ⚙️ Configuração do Ambiente

### 1. Variáveis de Ambiente (`.env.local`)
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Azure MSAL
NEXT_PUBLIC_AZURE_CLIENT_ID=...
NEXT_PUBLIC_AZURE_TENANT_ID=...

# SMTP
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=ti@costalavos.com.br
SMTP_PASS=...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Banco de Dados
Execute as migrações no SQL Editor do Supabase na ordem:
1. `supabase/migrations/20260430000000_ti_schema.sql`
2. `supabase/migrations/20260430000001_ti_seeds.sql`

### 3. Execução
```bash
npm install
npm run dev
```

---

## 📈 Status do Projeto (Fases)

| Fase | Status | Descrição |
|---|---|---|
| **1. Infraestrutura** | ✅ | Banco, Auth, Email, Layout base |
| **2. Portal Público** | ✅ | Wizard de abertura e Landing Page |
| **3. Dashboard** | ✅ | Listagem, Filtros e Exportação |
| **4. Workflow** | ✅ | Atendimento, Timeline e Ações |
| **5. SLA & Jobs** | ✅ | Alertas automáticos e Auto-close |
| **6. KB (Base)** | ✅ | Artigos e Markdown Editor |
| **7. Analytics** | ✅ | Recharts e BI operacional |
| **8. Administração** | ✅ | Gestão de Ativos, Usuários e RBAC |
| **9. Deploy** | 🔄 | Testes finais e Staging |

---

Developed with ❤️ for **Costa Lavos**.
