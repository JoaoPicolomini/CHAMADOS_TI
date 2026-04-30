# Sistema de Chamados de T.I

Central de suporte de T.I com abertura de chamados, acompanhamento de SLA, base de conhecimento e relatórios analíticos.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Next.js 16 (App Router) |
| Banco | Supabase (PostgreSQL) |
| Autenticação | Azure MSAL (Microsoft AD) |
| Estilização | Tailwind CSS v4 |
| Formulários | React Hook Form + Zod |
| E-mail | Nodemailer (SMTP Office 365) |
| Storage | Supabase Storage |
| Exportação | XLSX |
| Gráficos | Recharts |

---

## Estrutura de Rotas

```
/                            → Landing page pública
/ti/abrir                    → Formulário público de abertura (sem login)
/auth/login                  → Login via Azure AD

/ti/                         → Home do sistema (requer login)
/ti/dashboard                → Painel de chamados com filtros
/ti/meus-chamados            → Chamados do usuário logado
/ti/chamado/[id]             → Detalhe e atendimento do chamado
/ti/analytics                → Relatórios e gráficos
/ti/base-conhecimento        → Artigos de suporte
/ti/auditoria                → Trilha de auditoria

/ti/admin/usuarios           → Gerenciar usuários
/ti/admin/tecnicos           → Técnicos e equipes
/ti/admin/ativos             → Inventário de ativos de TI
/ti/admin/perfis             → Perfis de acesso
/ti/admin/matriz-acesso      → RBAC — permissões por perfil
/ti/admin/email-logs         → Logs de notificações
/ti/config                   → Configurações gerais e SLA
```

---

## Banco de Dados (Supabase)

### Tabelas Principais

| Tabela | Descrição |
|---|---|
| `ti_chamados` | Tabela principal de chamados |
| `ti_categorias` | Hierarquia de categorias e subcategorias |
| `ti_equipes` | Equipes de suporte (N1, N2, N3, Infra...) |
| `ti_tecnicos` | Técnicos vinculados às equipes |
| `ti_ativos` | Inventário de ativos de TI |
| `ti_sla_configs` | Regras de SLA por prioridade e categoria |
| `ti_workflow_events` | Log imutável de transições de status |
| `ti_field_change_logs` | Log de alterações de campos |
| `ti_comentarios` | Thread de comentários por chamado |
| `ti_anexos` | Arquivos e evidências |
| `ti_relacionamentos` | Vínculos entre chamados (duplicata, pai/filho) |
| `ti_base_conhecimento` | Artigos de resolução |
| `ti_access_users` | Whitelist de usuários com perfis |
| `ti_permissions` | Permissões do sistema |
| `ti_profile_permissions` | Matriz de permissões por perfil |
| `ti_notification_logs` | Fila de notificações |
| `ti_email_logs` | Log de e-mails enviados |

### Aplicar Migrações

```bash
# Via Supabase CLI
supabase db push

# Ou via Dashboard do Supabase:
# SQL Editor → Cole o conteúdo dos arquivos na ordem:
# 1. supabase/migrations/20260430000000_ti_schema.sql
# 2. supabase/migrations/20260430000001_ti_seeds.sql
```

### Storage Bucket

Crie o bucket `ti-attachments` no painel do Supabase (Storage → New Bucket) com acesso privado.

---

## Workflow de Status

```
aberto
  ├──→ em_atendimento
  └──→ cancelado

em_atendimento
  ├──→ pendente_usuario
  ├──→ pendente_terceiro
  ├──→ escalado
  ├──→ resolvido  ← requer campo "solução"
  └──→ cancelado  ← requer justificativa

pendente_usuario
  ├──→ em_atendimento
  └──→ fechado_automatico  (automático após 7 dias sem resposta)

pendente_terceiro
  └──→ em_atendimento

escalado
  └──→ em_atendimento

resolvido
  ├──→ fechado
  └──→ reaberto  ← requer justificativa

fechado / fechado_automatico
  └──→ reaberto

cancelado  (terminal)
```

---

## Perfis de Acesso

| Perfil | Descrição |
|---|---|
| `user` | Colaborador — abre e acompanha os próprios chamados |
| `tecnico` | Técnico de TI — atende chamados, gerencia KB |
| `gestor_ti` | Gestão — analytics, configurações, equipes |
| `admin` | Acesso total ao sistema |

---

## Variáveis de Ambiente

Crie o arquivo `.env.local` baseado no exemplo abaixo:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key

# Azure MSAL
NEXT_PUBLIC_AZURE_CLIENT_ID=seu_client_id
NEXT_PUBLIC_AZURE_TENANT_ID=seu_tenant_id

# SMTP (Office 365)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=ti@suaempresa.com.br
SMTP_PASS=sua_senha_app

# URL da aplicação (para links nos e-mails)
NEXT_PUBLIC_APP_URL=https://chamados.suaempresa.com.br
```

---

## Executar localmente

```bash
npm install
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

---

## Fases de Implementação

| Fase | Descrição | Status |
|---|---|---|
| 1 | Infraestrutura — banco, tipos, workflow, email, layout | ✅ Concluída |
| 2 | Formulário público de abertura (`/ti/abrir`) | 🔄 Próxima |
| 3 | Dashboard com filtros e listagem | ⏳ Pendente |
| 4 | Detalhe do chamado e workflow completo | ⏳ Pendente |
| 5 | SLA engine e notificações automáticas | ⏳ Pendente |
| 6 | Base de conhecimento | ⏳ Pendente |
| 7 | Analytics e relatórios | ⏳ Pendente |
| 8 | Admin — usuários, equipes, ativos, SLA | ⏳ Pendente |
| 9 | Polimento, testes e deploy | ⏳ Pendente |

---

## Estrutura de Arquivos

```
src/
├── app/
│   ├── ti/
│   │   ├── layout.tsx           ← Sidebar + autenticação
│   │   ├── page.tsx             ← Home
│   │   ├── abrir/page.tsx       ← Formulário público
│   │   ├── dashboard/page.tsx
│   │   ├── chamado/[id]/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── base-conhecimento/
│   │   ├── auditoria/page.tsx
│   │   └── admin/
│   └── auth/login/page.tsx
├── lib/
│   └── ti/
│       ├── types.ts             ← Interfaces TypeScript
│       ├── constants.ts         ← Labels, cores, constantes
│       ├── workflow.ts          ← State machine de status
│       ├── actions.ts           ← Server Actions (CRUD)
│       └── email/
│           ├── transporter.ts   ← Nodemailer
│           └── templates.ts     ← Templates HTML
└── supabase/
    └── migrations/
        ├── 20260430000000_ti_schema.sql
        └── 20260430000001_ti_seeds.sql
```
