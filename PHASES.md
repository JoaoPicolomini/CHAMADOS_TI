# Evolução das Fases — Sistema de Chamados de T.I

> Documento de rastreamento de progresso. Atualizado a cada fase concluída.
> Última atualização: 2026-04-30

---

## GUIA DE CONTINUAÇÃO — Leia antes de iniciar qualquer fase

> **Destinado ao próximo agente/sessão.** Contém todo o contexto necessário para continuar sem ler o histórico.

### Sobre o projeto

Sistema de Chamados de T.I construído sobre um projeto Next.js 16 existente (Costa Lavos RNC). Os dois sistemas **coexistem no mesmo repositório**:

- Sistema RNC → rotas `/app/*`, tabelas `rnc_*`, lib em `src/lib/`
- Sistema TI  → rotas `/ti/*`, tabelas `ti_*`, lib em `src/lib/ti/`

**Nunca modificar** arquivos fora de `src/lib/ti/`, `src/app/ti/`, `src/app/api/ti/` e `supabase/migrations/ti_*`, salvo quando explicitamente necessário para integração.

---

### Stack (versões exatas)

```
Next.js          16.2.1   (App Router — 'use client' / 'use server' / Server Actions)
React            19.0.0
TypeScript       5.7.2
Tailwind CSS     4.0.0    (sem config file — usa @import "tailwindcss" no globals.css)
Supabase JS      2.45.0   (@supabase/supabase-js)
Supabase SSR     0.5.2    (@supabase/ssr)
Azure MSAL       5.6.1    (@azure/msal-browser + @azure/msal-react)
Zod              3.23.8
React Hook Form  7.53.0
Nodemailer       6.9.7
Recharts         2.13.0
XLSX             0.18.5
Lucide React     0.460.0
date-fns         4.1.0
```

> **ATENÇÃO — Next.js 16**: Antes de escrever qualquer código, leia o guia relevante em `node_modules/next/dist/docs/`. APIs, convenções e estrutura de arquivos podem diferir do treinamento.

---

### Padrões obrigatórios

#### 1. Supabase — dois clientes

```typescript
// Cliente browser (anon key) — usar em 'use client' para leitura pública
import { createClient } from '@/lib/supabase/client'
const sb = createClient()

// Cliente admin (service role) — usar apenas em Server Actions e API Routes
import { createClient } from '@supabase/supabase-js'
function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
```

#### 2. Server Actions — padrão de retorno

Todas as server actions em `src/lib/ti/actions.ts` retornam:
```typescript
{ success: true, data... }   // sucesso
{ success: false, error: string }  // falha
```

#### 3. Autenticação — dois níveis

- **MSAL** autentica a identidade (Microsoft AD)
- **`ti_access_users`** autoriza o acesso ao sistema TI (whitelist)
- **`ti_profile_permissions`** define permissões granulares por perfil

Perfis: `user | tecnico | gestor_ti | admin`

#### 4. Proteção de rotas

O layout `src/app/ti/layout.tsx` verifica autenticação MSAL + whitelist.
**Exceção**: `/ti/abrir` tem bypass — `if (isPublicRoute) return <>{children}</>`.
Para adicionar rotas públicas futuras: modificar `isPublicRoute` no layout.

#### 5. Estilização

- Classes CSS globais disponíveis: `.card`, `.btn`, `.btn-primary`, `.input`, `.label`, `.label-required`, `.field-error`, `.field-hint`
- **Atenção**: `.btn-primary` usa cor bordeaux (RNC). Para TI use **inline styles** com a paleta TI:
  - Navy: `#1E3A5F` | Azul principal: `#2563EB` | Fundo: `#F5F7FA`
  - Background cards: `#FFFFFF` | Bordas: `#E5E7EB` | Texto muted: `#6B7280`
- Manter consistência com os arquivos já criados em `src/app/ti/`

#### 6. Imports principais disponíveis

```typescript
// Tipos
import type { TiStatus, TiPrioridade, TiTipo, TiChamado, TiCategoria, TiEquipe, TiTecnico, ... } from '@/lib/ti/types'

// Constantes / labels / cores
import { STATUS_LABELS, STATUS_COLORS, PRIORIDADE_LABELS, PRIORIDADE_COLORS, TIPO_LABELS } from '@/lib/ti/constants'

// Workflow (state machine + SLA)
import { canTransition, validateTransition, calcularSla, calcularPrazoSla, getPrazoHorasPadrao } from '@/lib/ti/workflow'

// Server Actions (chamar de qualquer lugar — client ou server)
import {
  checkTiUserAccess,
  criarChamadoAction,
  transicionarStatusAction,
  atribuirChamadoAction,
  escalarChamadoAction,
  adicionarComentarioAction,
  uploadAnexoAction,
  buscarChamadosAction,
  buscarChamadoPorIdAction,
  buscarCategoriasAction,
  buscarEquipesAction,
  buscarAtivosAction,
} from '@/lib/ti/actions'

// Email
import { sendTiEmail } from '@/lib/ti/email/transporter'
import { emailChamadoAberto, emailStatusAlterado, emailAlertaSla, ... } from '@/lib/ti/email/templates'

// Validações Zod
import { criarChamadoSchema, etapa1Schema, etapa2Schema } from '@/lib/ti/validations'
```

---

### Arquivos críticos — leia antes de alterar

| Arquivo | Quando ler |
|---|---|
| `src/lib/ti/types.ts` | Sempre — todas as interfaces estão aqui |
| `src/lib/ti/constants.ts` | Para labels, cores e state machine |
| `src/lib/ti/workflow.ts` | Para transições e cálculo de SLA |
| `src/lib/ti/actions.ts` | Para entender server actions já implementadas |
| `src/app/ti/layout.tsx` | Para entender autenticação e RBAC |
| `supabase/migrations/20260430000000_ti_schema.sql` | Para entender estrutura do banco |
| `supabase/migrations/20260430000001_ti_seeds.sql` | Para UUIDs fixos de categorias/equipes |

---

### Estrutura completa de arquivos criados

```
supabase/migrations/
  20260430000000_ti_schema.sql   ← Schema: 17 tabelas, triggers, RLS, sequência ti_chamado_seq
  20260430000001_ti_seeds.sql    ← Seeds: categorias, equipes, SLA, permissões

src/lib/ti/
  types.ts          ← Todas as interfaces (TiChamado, TiCategoria, TiEquipe, DTOs, etc.)
  constants.ts      ← Labels, cores por status/prioridade, state machine TRANSICOES_VALIDAS
  workflow.ts       ← canTransition(), validateTransition(), calcularPrazoSla(), calcularSla()
  actions.ts        ← 'use server' — checkTiUserAccess, criarChamado, transicionarStatus,
                       atribuirChamado, escalar, adicionarComentario, uploadAnexo,
                       buscarChamados, buscarChamadoPorId, buscarCategorias, buscarEquipes, buscarAtivos
  validations.ts    ← Zod: etapa1Schema, etapa2Schema, criarChamadoSchema
  email/
    transporter.ts  ← sendTiEmail({ to, subject, html, chamado_id })
    templates.ts    ← emailChamadoAberto, emailChamadoAtribuido, emailStatusAlterado,
                       emailAlertaSla, emailPesquisaSatisfacao, emailLembretePendencia, emailNovoComentario

src/app/ti/
  layout.tsx        ← 'use client' — MSAL + whitelist + RBAC + sidebar. Bypass em /ti/abrir
  page.tsx          ← Home autenticada: CTA + módulos + info
  abrir/page.tsx    ← Público (sem auth): wizard 3 etapas + upload + confirmação

src/app/api/ti/
  create/route.ts   ← POST /api/ti/create — cria chamado (usado pelo form público)
```

---

### Convenções de nomenclatura do banco

- Todas as tabelas: prefixo `ti_`
- Sequência de número: `ti_chamado_seq` → gera `TI-000001`, `TI-000002`...
- O campo `numero` em `ti_chamados` é gerado automaticamente no INSERT via DEFAULT
- Colunas de auditoria: `created_at`, `updated_at` (via trigger `ti_set_updated_at`)
- Tabelas imutáveis (trigger previne UPDATE/DELETE): `ti_workflow_events`, `ti_field_change_logs`

---

### Próxima fase a implementar: Fase 8

**Administração** — arquivos a criar:

```
src/app/ti/admin/usuarios/page.tsx          ← CRUD de usuários + importação Excel
src/app/ti/admin/tecnicos/page.tsx          ← Técnicos e vínculo a equipes
src/app/ti/admin/ativos/page.tsx            ← Inventário de ativos de T.I
src/app/ti/admin/perfis/page.tsx            ← Visualizar permissões por perfil
src/app/ti/admin/matriz-acesso/page.tsx     ← Editar permissões por perfil
src/app/ti/admin/email-logs/page.tsx        ← Histórico de notificações enviadas
src/app/ti/auditoria/page.tsx               ← Eventos, alterações de campo, acessos
src/app/ti/config/page.tsx                  ← Configurações gerais do sistema
src/app/ti/admin/pesquisa-satisfacao/page.tsx ← Respostas e config CSAT
```

**O que a Fase 8 deve entregar:**
- Gestão completa de usuários (CRUD + ativo/inativo + perfil + importação Excel)
- Gestão de técnicos com vínculo a equipes
- Inventário de ativos (equipamentos, seriais, responsáveis)
- Visualização e edição da matriz de permissões por perfil
- Log completo de e-mails enviados (filtro por chamado, tipo, período)
- Auditoria: workflow events + field change logs + acessos
- Config geral: nome do sistema, e-mail remetente, horário comercial
- Filtros: status (chips múltiplos), prioridade (chips múltiplos), tipo, categoria, equipe, período de criação, busca textual (número / título / solicitante)
- Visões rápidas: "Todos" / "Meus" / "Sem técnico" / "Minha equipe"
- Badge SLA: verde (< 70%), amarelo (70-90%), vermelho (> 90% ou violado)
- Paginação (DEFAULT_PAGE_SIZE = 25)
- Ação rápida inline: botão "Assumir" para técnicos (chama `atribuirChamadoAction`)
- Exportação Excel via `xlsx` (colunas selecionadas)
- `buscarChamadosAction(filtros)` já está implementada em `actions.ts` — use ela
- Para saber o usuário logado: `useMsal()` → `accounts[0]?.username`
- Para saber o perfil e permissões: chamar `checkTiUserAccess(email)` no useEffect

**Referências de implementação:**
- Ver `src/app/app/dashboard/page.tsx` (sistema RNC) para padrão de filtros e tabela
- `calcularSla(sla_prazo, sla_violado, sla_horas_pausadas, created_at)` → retorna `{ percentual, status, horasRestantes }`
- `STATUS_COLORS[status]` → `{ color, bg, border }` para badges

**Fase 4 após isso:**
`src/app/ti/chamado/[id]/page.tsx` — detalhe completo do chamado em abas (Detalhes, Atendimento, Timeline, Comentários, Anexos).

---

## Legenda

| Símbolo | Significado |
|---|---|
| ✅ | Concluído |
| 🔄 | Em andamento |
| ⏳ | Pendente |
| ❌ | Bloqueado |

---

## Fase 1 — Infraestrutura e Fundação

**Status:** ✅ Concluída — 2026-04-30

**Objetivo:** Criar toda a base do projeto: banco de dados, tipos, lógica de negócio, e-mail e layout protegido.

### Itens entregues

| Item | Arquivo | Descrição |
|---|---|---|
| ✅ Schema SQL | `supabase/migrations/20260430000000_ti_schema.sql` | 17 tabelas, índices, triggers, RLS |
| ✅ Seeds SQL | `supabase/migrations/20260430000001_ti_seeds.sql` | 7 categorias raiz, 36 subcategorias, 5 equipes, SLA padrão, 21 permissões por perfil |
| ✅ Tipos TypeScript | `src/lib/ti/types.ts` | Interfaces de todas as entidades do sistema |
| ✅ Constantes | `src/lib/ti/constants.ts` | Labels, cores de status/prioridade, limites, state machine |
| ✅ Workflow | `src/lib/ti/workflow.ts` | Validação de transições, cálculo de SLA com horário comercial |
| ✅ Server Actions | `src/lib/ti/actions.ts` | Criar, transicionar, atribuir, escalar, comentar, upload, buscar |
| ✅ Email Transporter | `src/lib/ti/email/transporter.ts` | Nodemailer configurado para Office 365 |
| ✅ Email Templates | `src/lib/ti/email/templates.ts` | 7 templates HTML (abertura, atribuição, status, SLA, satisfação, lembrete, comentário) |
| ✅ App Layout | `src/app/ti/layout.tsx` | Sidebar com MSAL + RBAC completo por perfil |
| ✅ README | `README.md` | Documentação geral do projeto |

### Tabelas criadas no banco

```
ti_categorias           ti_equipes              ti_tecnicos
ti_ativos               ti_sla_configs          ti_chamados
ti_workflow_events      ti_field_change_logs    ti_comentarios
ti_anexos               ti_relacionamentos      ti_base_conhecimento
ti_access_users         ti_permissions          ti_profile_permissions
ti_notification_logs    ti_email_logs           ti_satisfacao_config
```

### Decisões técnicas tomadas

- Rotas TI sob prefixo `/ti/` para coexistir com o sistema RNC existente
- Service Role Key no backend — anon key apenas para inserção pública de chamados
- SLA calculado com suporte a horário comercial (08h–18h, seg–sex)
- Tabelas de auditoria (`ti_workflow_events`, `ti_field_change_logs`) com trigger de imutabilidade

---

## Fase 2 — Formulário Público de Abertura

**Status:** ✅ Concluída — 2026-04-30

**Objetivo:** Criar o formulário de abertura de chamados acessível sem login (`/ti/abrir`) e a landing page (`/ti`).

### Itens a entregar

| Item | Arquivo | Descrição |
|---|---|---|
| ✅ Landing Page | `src/app/ti/page.tsx` | Página home com CTAs e módulos do sistema |
| ✅ Formulário 3 etapas | `src/app/ti/abrir/page.tsx` | Wizard de abertura de chamado |
| ✅ Etapa 1 | — | Dados do solicitante (nome, e-mail, ramal, setor, unidade) |
| ✅ Etapa 2 | — | Categoria, subcategoria, tipo, título, descrição, passos para reproduzir, ativo |
| ✅ Etapa 3 | — | Upload de anexos com drag-and-drop (screenshots, logs, documentos) |
| ✅ Tela de confirmação | — | Número do chamado gerado + instrução para acompanhamento |
| ✅ API Route | `src/app/api/ti/create/route.ts` | Endpoint de criação com validação Zod e SLA |
| ✅ Validação Zod | `src/lib/ti/validations.ts` | Schemas etapa1Schema, etapa2Schema, criarChamadoSchema |

### Comportamentos esperados

- Formulário sem autenticação (anon)
- Busca dinâmica de categorias e subcategorias ao selecionar
- Compressão de imagens no client antes do upload
- E-mail de confirmação disparado automaticamente ao solicitante
- Notificação enviada para a fila da equipe padrão (N1)

---

## Fase 3 — Dashboard e Listagem

**Status:** ✅ Concluída — 2026-04-30

**Objetivo:** Painel principal com listagem de chamados, filtros avançados e indicadores de SLA.

### Itens a entregar

| Item | Arquivo | Descrição |
|---|---|---|
| ✅ Dashboard | `src/app/ti/dashboard/page.tsx` | Tabela com paginação, filtros e stats cards |
| ✅ Meus Chamados | `src/app/ti/meus-chamados/page.tsx` | Visão filtrada por técnico ou solicitante logado |
| ✅ Filtros | — | Status (multi), prioridade (multi), categoria, busca textual |
| ✅ Visões rápidas | — | "Todos", "Meus", "Sem técnico" |
| ✅ Badge SLA | — | Verde/amarelo/laranja/vermelho por prazo restante |
| ✅ Ação rápida "Assumir" | — | Botão inline para técnicos em chamados sem técnico |
| ✅ Exportação Excel | — | Download via xlsx com filtros aplicados |
| ✅ Stats cards | — | Total ativos, abertos, em atendimento, SLA violados |
| ✅ `buscarStatsDashboard()` | `src/lib/ti/actions.ts` | Action com 4 queries paralelas de contagem |
| ✅ Filtros em actions | `src/lib/ti/actions.ts` | Adicionados `categoria_id` e `solicitante_email` |

### Filtros planejados

- Status (múltiplos)
- Prioridade (múltiplos)
- Tipo (incidente, solicitação, problema, mudança)
- Categoria / subcategoria
- Equipe / técnico
- SLA violado
- Busca por número, título, solicitante, e-mail
- Período de criação

---

## Fase 4 — Detalhe do Chamado e Workflow

**Status:** ✅ Concluída — 2026-04-30

**Objetivo:** Página completa de atendimento com todas as ações do ciclo de vida do chamado.

### Itens entregues

| Item | Arquivo | Descrição |
|---|---|---|
| ✅ Página de detalhe | `src/app/ti/chamado/[id]/page.tsx` | Layout em abas (Client Component, `use(params)`) |
| ✅ Aba Detalhes | — | Descrição, passos, solução, causa raiz, motivo cancelamento |
| ✅ Aba Timeline | — | Histórico de workflow_events com linha do tempo visual |
| ✅ Aba Comentários | — | Thread com flag interno/externo + formulário de adição |
| ✅ Aba Anexos | — | Tabela de arquivos + upload + download via URL assinada |
| ✅ Sidebar de info | — | Solicitante, classificação, atribuição, SLA, datas, satisfação |
| ✅ Barra SLA visual | — | Barra de progresso colorida com tempo restante |
| ✅ Modal de transição | — | Validação com `validateTransition`, campos condicionais |
| ✅ Modal de atribuição | — | Selecionar equipe e técnico filtrado por equipe |
| ✅ Modal de escalonamento | — | N2/N3, equipe destino, justificativa obrigatória |
| ✅ `gerarUrlAnexoAction` | `src/lib/ti/actions.ts` | Gera URL assinada (1h) para download de anexo |

### Transições disponíveis por perfil

- `user`: sem acesso às transições
- `tecnico`: assumir, pendência, resolver, escalar
- `gestor_ti` / `admin`: todas as transições

---

## Fase 5 — SLA Engine e Notificações

**Status:** ✅ Concluída — 2026-04-30

**Objetivo:** Monitoramento automático de SLA com alertas e auto-fechamento de chamados pendentes.

### Itens entregues

| Item | Arquivo | Descrição |
|---|---|---|
| ✅ Job SLA monitor | `src/app/api/ti/jobs/sla-monitor/route.ts` | Verifica prazos, marca violados, envia alertas 70%/90% |
| ✅ Job auto-close | `src/app/api/ti/jobs/auto-close/route.ts` | Lembrete 3d, fecha pendente 7d, fecha resolvido 5d + CSAT |
| ✅ Painel SLA admin | `src/app/ti/admin/sla-monitoring/page.tsx` | Visão em tempo real com grupos violado/crítico/alerta/ok |
| ✅ Config SLA | `src/app/ti/config/sla/page.tsx` | CRUD de regras por prioridade e categoria (admin only) |
| ✅ Actions SLA config | `src/lib/ti/actions.ts` | `buscarSlaConfigsAction`, `salvarSlaConfigAction`, `excluirSlaConfigAction` |
| ✅ Fix URLs email | `src/lib/ti/email/templates.ts` | Corrigido `/app/chamado/` → `/ti/chamado/` em todos os templates |
| ✅ Sidebar links | `src/app/ti/layout.tsx` | Adicionado "Monitor de SLA" e "Config SLA" no menu admin |

### Segurança dos jobs

- Protegidos por `Authorization: Bearer <CRON_SECRET>` (env var)
- Sem `CRON_SECRET` definido → aceita qualquer request (modo dev)
- Podem ser acionados manualmente pelo painel admin ou via cron (Vercel Cron Jobs, GitHub Actions, etc.)

### Regras de auto-fechamento

| Evento | Dias | Ação |
|---|---|---|
| Sem resposta do usuário | 3 dias | Envia lembrete (`emailLembretePendencia`) |
| Sem resposta do usuário | 7 dias | Fecha (`fechado_automatico`) + CSAT |
| Chamado resolvido sem confirmação | 5 dias | Fecha (`fechado_automatico`) + CSAT |

---

## Fase 6 — Base de Conhecimento

**Status:** ✅ Concluída — 2026-04-30

**Objetivo:** Repositório de artigos de solução para consulta e vinculação a chamados resolvidos.

### Itens entregues

| Item | Arquivo | Descrição |
|---|---|---|
| ✅ Listagem | `src/app/ti/base-conhecimento/page.tsx` | Busca textual, filtro por categoria, paginação |
| ✅ Detalhe | `src/app/ti/base-conhecimento/[id]/page.tsx` | Markdown renderizado + feedback útil/não-útil |
| ✅ Admin CRUD | `src/app/ti/admin/base-conhecimento/page.tsx` | Tabela + modal editor com preview |
| ✅ Editor Markdown | — | Textarea + toggle Preview com renderer inline |
| ✅ Busca full-text | — | `ilike` em título e conteúdo via Supabase |
| ✅ Feedback | — | ThumbsUp/Down com contador em tempo real |
| ✅ Actions KB | `src/lib/ti/actions.ts` | `buscarArtigosKb`, `buscarArtigoKbPorId`, `salvarArtigoKb`, `excluirArtigoKb`, `registrarFeedbackKb` |
| ✅ Markdown renderer | — | Suporte a h1-h3, bold, italic, code, listas, blockquote, HR, code blocks |

---

## Fase 7 — Analytics e Relatórios

**Status:** ✅ Concluída — 2026-04-30

**Objetivo:** Dashboard analítico com gráficos, tendências e exportações para gestão de T.I.

### Itens entregues

| Item | Arquivo | Descrição |
|---|---|---|
| ✅ Página analytics | `src/app/ti/analytics/page.tsx` | Dashboard com Recharts |
| ✅ Volume por categoria | — | BarChart horizontal (top 10) |
| ✅ Volume por equipe | — | BarChart horizontal com totais |
| ✅ Volume por prioridade | — | BarChart com cores por nível |
| ✅ MTTR | — | Média de horas até fechamento |
| ✅ SLA compliance | — | % chamados dentro do prazo (com cor semafórica) |
| ✅ Tendência temporal | — | LineChart diário/semanal/mensal conforme período |
| ✅ Filtro de período | — | 7d / 30d / 90d / 12 meses |
| ✅ Resumo de métricas | — | Cards com críticos, violados, categorias ativas |
| ✅ Exportação Excel | — | Download .xlsx com todos os chamados do período |
| ✅ `buscarAnalyticsAction` | `src/lib/ti/actions.ts` | Agrega métricas e séries temporais server-side |

### Arquitetura do buscarAnalyticsAction

- Query única de chamados com join categoria + equipe
- Agrega tendência: diária (7d/30d), semanal (90d), mensal (365d)
- Retorna `chamadosRaw` para export Excel no cliente
- Conta `emAberto` separadamente (todos os status ativos, não só do período)

---

## Fase 8 — Administração

**Status:** ✅ Concluída — 2026-04-30

**Objetivo:** Módulos de gestão completa do sistema: usuários, equipes, ativos, perfis e configurações.

### Itens a entregar

| Item | Arquivo | Descrição |
|---|---|---|
| ✅ Gestão de usuários | `src/app/ti/admin/usuarios/page.tsx` | CRUD + importação Excel |
| ✅ Gestão de técnicos | `src/app/ti/admin/tecnicos/page.tsx` | Técnicos + vínculo a equipes |
| ✅ Gestão de equipes | — | CRUD de equipes e níveis |
| ✅ Gestão de ativos | `src/app/ti/admin/ativos/page.tsx` | Inventário completo de equipamentos |
| ✅ Perfis de acesso | `src/app/ti/admin/perfis/page.tsx` | Visualizar permissões por perfil |
| ✅ Matriz de acesso | `src/app/ti/admin/matriz-acesso/page.tsx` | Editar permissões por perfil |
| ✅ Logs de e-mail | `src/app/ti/admin/email-logs/page.tsx` | Histórico de notificações enviadas |
| ✅ Auditoria | `src/app/ti/auditoria/page.tsx` | Eventos, alterações de campo, acessos |
| ✅ Config geral | `src/app/ti/config/page.tsx` | Configurações do sistema |
| ✅ Config SLA | `src/app/ti/config/sla/page.tsx` | Regras de prazo por prioridade/categoria |
| ✅ Pesquisa satisfação | `src/app/ti/admin/pesquisa-satisfacao/page.tsx` | Respostas e configuração CSAT |

---

## Fase 9 — Polimento e Deploy

**Status:** ⏳ Pendente

**Objetivo:** Testes end-to-end, responsividade, ajustes finais e publicação em produção.

### Itens a entregar

| Item | Descrição |
|---|---|
| ⏳ Testes de fluxo completo | Abertura → Atendimento → Resolução → Fechamento |
| ⏳ Testes de SLA | Criação de chamado, pausa, retomada, violação |
| ⏳ Testes de e-mail | Todos os 7 templates em cliente real |
| ⏳ Responsividade mobile | Formulário público e dashboard |
| ✅ Tratamento de erros | Páginas 404 e 500 customizadas |
| ⏳ Variáveis de produção | `.env` validado em ambiente real |
| ⏳ Storage bucket | Políticas de acesso e CORS configurados |
| ⏳ Cron jobs | Agendamento dos jobs SLA e auto-close |
| ⏳ Deploy | Vercel ou servidor de produção |
| ✅ Primeiro usuário admin | INSERT em `ti_access_users` com perfil `admin` |

---

## Resumo Geral

| Fase | Descrição | Início | Conclusão | Status |
|---|---|---|---|---|
| 1 | Infraestrutura e Fundação | 2026-04-30 | 2026-04-30 | ✅ Concluída |
| 2 | Formulário público de abertura | 2026-04-30 | 2026-04-30 | ✅ Concluída |
| 3 | Dashboard e listagem | 2026-04-30 | 2026-04-30 | ✅ Concluída |
| 4 | Detalhe do chamado e workflow | 2026-04-30 | 2026-04-30 | ✅ Concluída |
| 5 | SLA engine e notificações | 2026-04-30 | 2026-04-30 | ✅ Concluída |
| 6 | Base de conhecimento | 2026-04-30 | 2026-04-30 | ✅ Concluída |
| 7 | Analytics e relatórios | 2026-04-30 | 2026-04-30 | ✅ Concluída |
| 8 | Administração | 2026-04-30 | 2026-04-30 | ✅ Concluída |
| 9 | Polimento e deploy | — | — | ⏳ Pendente |

---

## Arquivos criados até agora

```
supabase/migrations/
  20260430000000_ti_schema.sql     ← Schema completo (17 tabelas)
  20260430000001_ti_seeds.sql      ← Seeds (categorias, equipes, SLA, permissões)

src/lib/ti/
  types.ts                         ← Interfaces TypeScript
  constants.ts                     ← Labels, cores, state machine
  workflow.ts                      ← Validação de transições + cálculo SLA
  actions.ts                       ← Server Actions (CRUD completo)
  email/
    transporter.ts                 ← Nodemailer Office 365
    templates.ts                   ← 7 templates HTML

src/lib/ti/
  validations.ts                   ← Schemas Zod (etapa1, etapa2, criarChamado)

src/app/ti/
  layout.tsx                       ← Sidebar + MSAL + RBAC (bypass para /ti/abrir)
  page.tsx                         ← Home do sistema (módulos + CTA)
  abrir/page.tsx                   ← Formulário público 3 etapas

src/app/api/ti/
  create/route.ts                  ← POST — cria chamado + SLA + e-mail confirmação
  jobs/
    sla-monitor/route.ts           ← GET (cron) — verifica prazos, marca violados, alertas 70/90%
    auto-close/route.ts            ← GET (cron) — lembrete 3d, fecha pendente 7d, fecha resolvido 5d

src/app/ti/
  chamado/[id]/page.tsx            ← Detalhe em abas (Detalhes, Timeline, Comentários, Anexos)
  meus-chamados/page.tsx           ← Chamados do usuário logado (filtro por e-mail)
  analytics/page.tsx               ← Dashboard analítico com Recharts
  base-conhecimento/page.tsx       ← Listagem com busca e filtro por categoria
  base-conhecimento/[id]/page.tsx  ← Artigo com Markdown renderer + feedback
  admin/
    sla-monitoring/page.tsx        ← Monitor em tempo real (violado/crítico/alerta/ok)
    base-conhecimento/page.tsx     ← CRUD de artigos com editor + preview Markdown
  config/
    sla/page.tsx                   ← CRUD de regras SLA por prioridade/categoria

README.md                          ← Documentação do projeto
PHASES.md                          ← Este arquivo
```
