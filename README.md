# 🛡️ Costa Lavos — Central de Suporte T.I

Portal completo de **Service Desk** para gestão de incidentes, solicitações e ativos de T.I., construído com Next.js 16, Supabase e autenticação via Azure AD (Microsoft MSAL).

---

## Sumário

- [Visão Geral](#visão-geral)
- [Stack Tecnológica](#stack-tecnológica)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Banco de Dados](#banco-de-dados)
- [Funcionalidades](#funcionalidades)
- [Perfis de Acesso](#perfis-de-acesso)
- [Máquina de Estados (Workflow)](#máquina-de-estados-workflow)
- [SLA Engine](#sla-engine)
- [E-mails Automáticos](#e-mails-automáticos)
- [Jobs Agendados (Cron)](#jobs-agendados-cron)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Instalação e Execução](#instalação-e-execução)
- [Migrations Supabase](#migrations-supabase)

---

## Visão Geral

A Central de Suporte T.I. é uma plataforma interna que permite:

- Usuários finais **abrirem chamados** de suporte pelo portal, com categorização, prioridade e anexos.
- Técnicos **gerenciarem chamados** com atribuição, alteração de status, comentários internos e externos.
- Gestores **monitorarem indicadores** de desempenho (SLA, MTTR, volume por técnico/categoria/setor).
- Administradores **configurarem** catálogos, equipes, usuários, SLAs, ativos e permissões por perfil.

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| **Framework** | Next.js (App Router + Server Actions) | 16.2.1 |
| **Banco de Dados** | Supabase (PostgreSQL + Storage) | — |
| **Autenticação** | Microsoft MSAL / Azure AD | ^5.6.1 |
| **UI** | React + CSS-in-JS inline | ^19 |
| **Gráficos** | Recharts | ^2.13 |
| **Export Excel** | SheetJS (xlsx) | ^0.18.5 |
| **Ícones** | Lucide React | ^0.460 |
| **E-mail** | Nodemailer (SMTP) | ^6.9.7 |
| **Forms** | React Hook Form + Zod | — |
| **Linguagem** | TypeScript | ^5.7 |
| **Testes** | Vitest + Testing Library | — |

---

## Estrutura do Projeto

```
src/
├── app/
│   ├── api/ti/
│   │   ├── create/route.ts          # Criação de chamado via API externa
│   │   └── jobs/
│   │       ├── auto-close/route.ts  # Cron: lembrete após 3 dias em pendente_usuario
│   │       └── sla-monitor/route.ts # Cron: verificação e violação de SLA
│   └── ti/
│       ├── layout.tsx               # Layout global do portal (MSAL provider)
│       ├── page.tsx                 # Página inicial do portal
│       ├── abrir/page.tsx           # Formulário de abertura de chamado
│       ├── dashboard/page.tsx       # Painel principal (listagem + filtros + export Excel)
│       ├── meus-chamados/page.tsx   # Chamados do solicitante logado
│       ├── chamado/[id]/page.tsx    # Detalhe do chamado (timeline, status, comentários, anexos)
│       ├── analytics/page.tsx       # Indicadores e gráficos gerenciais
│       ├── base-conhecimento/       # Artigos de KB (listagem + detalhe)
│       └── admin/
│           ├── ativos/              # CRUD de ativos de T.I.
│           ├── base-conhecimento/   # Gerenciar artigos da KB
│           ├── catalogos/           # Categorias, subcategorias e SLA por categoria
│           ├── email-logs/          # Histórico de e-mails enviados
│           ├── equipes/             # CRUD de equipes de suporte
│           ├── matriz-acesso/       # Permissões por perfil (visão matricial)
│           ├── perfis/              # Configuração de perfis e permissões
│           ├── pesquisa-satisfacao/ # Configuração e respostas CSAT
│           ├── sla-monitoring/      # Monitor de SLA em tempo real
│           └── usuarios/            # CRUD de usuários do sistema
├── lib/ti/
│   ├── actions.ts      # Todas as Server Actions do portal
│   ├── constants.ts    # Labels, cores, status e configurações globais
│   ├── types.ts        # Tipos TypeScript de todas as entidades
│   ├── validations.ts  # Schemas Zod para validação de formulários
│   ├── workflow.ts     # Máquina de estados, SLA engine e helpers
│   └── email/
│       ├── transporter.ts  # Configuração SMTP Nodemailer
│       └── templates.ts    # Templates HTML de todos os e-mails
└── supabase/
    └── migrations/         # SQL de criação das tabelas e seeds iniciais
```

---

## Banco de Dados

### Tabelas principais

| Tabela | Descrição |
|---|---|
| `ti_chamados` | Registro central de cada chamado |
| `ti_categorias` | Categorias e subcategorias (auto-referencial via `categoria_pai`) |
| `ti_equipes` | Equipes de suporte (N1, N2, N3) |
| `ti_access_users` | Usuários do sistema com perfil e permissões |
| `ti_sla_configs` | Configurações de SLA por prioridade e/ou categoria |
| `ti_ativos` | Inventário de ativos de T.I. |
| `ti_workflow_events` | Eventos de transição de status (histórico imutável) |
| `ti_comentarios` | Comentários públicos e notas internas |
| `ti_anexos` | Metadados de arquivos (armazenados no bucket `ti-attachments`) |
| `ti_field_change_logs` | Log de alterações de campos (técnico, equipe, categoria, subcategoria) |
| `ti_email_logs` | Histórico de todos os e-mails enviados pelo sistema |
| `ti_base_conhecimento` | Artigos de base de conhecimento |
| `ti_satisfacao_pesquisa` | Respostas de pesquisa CSAT |

### Campos-chave de `ti_chamados`

```sql
numero              TEXT UNIQUE      -- ex: TI-000042
status              TEXT             -- veja máquina de estados
prioridade          TEXT             -- critica | alta | media | baixa
tipo                TEXT             -- incidente | solicitacao | problema | mudanca
origem              TEXT             -- portal | email | telefone | presencial | api
categoria_id        UUID → ti_categorias
subcategoria_id     UUID → ti_categorias
tecnico_id          UUID → ti_access_users
equipe_id           UUID → ti_equipes
sla_prazo           TIMESTAMPTZ
sla_violado         BOOLEAN
sla_horas_pausadas  NUMERIC          -- acumulado em status de pausa
fechado_em          TIMESTAMPTZ
solucao             TEXT
causa_raiz          TEXT
motivo_cancelamento TEXT
satisfacao_nota     INT (1–5)
```

---

## Funcionalidades

### Portal do Usuário

- **Abrir chamado**: título, descrição, categoria/subcategoria, prioridade sugerida, passos para reproduzir, ativo relacionado, anexos (até 20 MB, formatos: imagem, PDF, Word, Excel, ZIP, texto).
- **Meus Chamados**: listagem dos próprios chamados com status em badge colorido e link direto ao detalhe.
- **Base de Conhecimento**: artigos públicos pesquisáveis por termo e categoria, com feedback (útil / não útil) e contador de visualizações.

### Painel do Técnico — Dashboard (`/ti/dashboard`)

- Listagem completa com filtros combinados: status, prioridade, tipo, categoria, técnico atribuído e busca textual.
- Indicadores rápidos no topo: total, abertos, encerrados, violações de SLA.
- **Exportar para Excel**: modal solicita intervalo de datas (baseado na data de abertura do chamado). Gera planilha com duas abas:
  - **Chamados**: 38 colunas com todos os dados do chamado (número, título, status, prioridade, tipo, solicitante, setor, técnico, equipe, categoria, subcategoria, SLA, datas, solução, etc.).
  - **Sumário**: totais por grupo de status, MTTR médio e compliance de SLA.

### Detalhe do Chamado (`/ti/chamado/[id]`)

- **Barra de SLA** em tempo real: percentual usado, horas restantes, label de alerta (no prazo / atenção / crítico / violado), indicação de SLA pausado.
- **Info strip** em 5 colunas: Solicitante, Classificação, Atribuição, SLA, Datas.
- **Campo Contato**: exibe o ramal/telefone do solicitante com botão **WA** verde que:
  1. Abre `wa.me` com mensagem pré-preenchida contendo número do chamado, categoria, subcategoria e título.
  2. Adiciona DDI `55` automaticamente se ausente.
  3. Registra o contato na **timeline** como nota interna.
- **Editar Classificação** (ícone de lápis no cabeçalho "Classificação"): técnicos podem alterar categoria e subcategoria com justificativa obrigatória — alteração registrada na timeline e a justificativa salva como comentário interno.
- **Alterar Status**: modal com validação da máquina de estados; campos contextuais conforme a transição (solução + causa raiz ao resolver; motivo ao cancelar; justificativa ao escalar/pendenciar).
- **Atribuir Técnico**: seleciona analista da lista de usuários ativos.
- **Timeline unificada**: status, comentários, anexos e alterações de campo ordenados cronologicamente com ícone, autor e data.
- **Comentários**: públicos (notificam o solicitante por e-mail) e notas internas (apenas técnicos visualizam, marcadas com "🔒 Interno").
- **Anexos**: upload múltiplo com drag-and-drop visual, download por URL assinada temporária do Supabase Storage.

### Analytics (`/ti/analytics`)

Todos os indicadores são calculados no client a partir dos dados brutos retornados pela Server Action, sem processamento extra no banco:

| Indicador | Cálculo |
|---|---|
| Total | Todos os chamados no período |
| Em Aberto | `aberto + em_atendimento + reaberto + pendente_usuario + pendente_terceiro + escalado` |
| Encerrado / Resolvido | `resolvido + fechado + fechado_automatico` |
| Cancelados | `cancelado` |
| MTTR | Média de `(fechado_em ?? updated_at) - created_at` dos encerrados, em horas |
| SLA Compliance | % dos encerrados sem `sla_violado = true` |

**Gráficos disponíveis:**

| Gráfico | Tipo |
|---|---|
| Tendência Temporal (diário / semanal / mensal) | Linha — Abertos vs. Encerrados |
| Volume por Categoria (top 10) | Barra horizontal |
| Volume por Técnico Atribuído | Barra |
| Volume por Setor Solicitante (top 8) | Barra |
| Distribuição por Status | Barra colorida por status |

**Filtros:**

- Período pré-definido: 7, 15, 30, 90, 180 ou 365 dias
- Período personalizado: data de início + data de fim (intervalo sobre `created_at`)
- Categoria
- Técnico atribuído

**Resumo detalhado:** Situação (abertos/encerrados/cancelados), Resultados (MTTR, compliance SLA) e Por Prioridade (contagem por crítica/alta/média/baixa).

### Administração

| Módulo | Funcionalidades |
|---|---|
| **Usuários** | CRUD completo, importação em lote (CSV/JSON), definição de perfil, ativar/inativar |
| **Equipes** | CRUD com nível (N1/N2/N3) e e-mail de fila |
| **Catálogos** | Categorias + subcategorias; SLA configurável por prioridade × categoria; severidade sugerida |
| **Ativos** | Inventário de equipamentos com tipo, patrimônio, número de série, IMEI, modelo, fabricante, setor |
| **Perfis** | Permissões granulares por perfil (`pode_atribuir`, `pode_escalar`, `pode_ver_interno`, etc.) |
| **Matriz de Acesso** | Visão cruzada perfil × permissão com toggle direto |
| **SLA Monitoring** | Lista de chamados em risco ordenada por % de SLA consumido |
| **Base de Conhecimento** | CRUD de artigos com categoria, tags, publicado/rascunho |
| **E-mail Logs** | Histórico paginado de e-mails com status (success/error), destinatário e subject |
| **Pesquisa de Satisfação** | Configuração (ativa, horas após fechamento, lembretes) e visualização de respostas |

---

## Perfis de Acesso

| Perfil | Acesso |
|---|---|
| `solicitante` | Abre chamados, acompanha os próprios, acessa KB |
| `tecnico` | Atende chamados, comenta, altera status, classificação e atribuição |
| `gestor_ti` | Tudo do técnico + analytics, relatórios e configurações de SLA |
| `admin` | Acesso total incluindo usuários, perfis, permissões e configurações |

Permissões granulares são configuradas na tabela `ti_perfis_permissoes` e verificadas em tempo de execução via `checkTiUserAccess`.

---

## Máquina de Estados (Workflow)

```
aberto
  └─► em_atendimento ──┬─► resolvido ──► reaberto
                       ├─► pendente_usuario
                       ├─► pendente_terceiro
                       └─► escalado
                       └─► cancelado

Todos os estados podem transitar para cancelado (com justificativa).
resolvido / fechado / fechado_automatico podem ser reabertos.
cancelado é terminal sem possibilidade de reabertura.
```

**Grupos de status para métricas e exibição:**

| Grupo | Status incluídos | Label na UI |
|---|---|---|
| Em Aberto | `aberto`, `em_atendimento`, `reaberto`, `pendente_usuario`, `pendente_terceiro`, `escalado` | Labels individuais |
| Encerrado / Resolvido | `resolvido`, `fechado`, `fechado_automatico` | "Encerrado / Resolvido" |
| Terminal (SLA para) | `fechado`, `fechado_automatico`, `cancelado` | — |

**SLA pausa** enquanto o chamado está em: `pendente_usuario`, `pendente_terceiro`, `escalado`.

**Transições que exigem justificativa:** cancelamento, escalamento, pendência de usuário/terceiro, reabertura.

**Transições que exigem solução:** `em_atendimento → resolvido`.

---

## SLA Engine

Configurado em `ti_sla_configs` (prioridade × categoria opcional) com fallback por prioridade global:

| Prioridade | Prazo padrão |
|---|---|
| Crítica | 4 horas |
| Alta | 8 horas |
| Média | 24 horas |
| Baixa | 72 horas |

- Cálculo considera apenas **horário comercial** (segunda a sexta, 8h–18h).
- Horas pausadas são acumuladas em `sla_horas_pausadas` quando o chamado entra em status de pausa.
- **Alertas visuais:**
  - Verde: < 70% do prazo consumido
  - Amarelo: 70–90% (atenção)
  - Laranja: 90–100% (crítico)
  - Vermelho: prazo expirado (violado)

---

## E-mails Automáticos

Todos os e-mails são registrados em `ti_email_logs` com status, subject e destinatário.

| Evento | Destinatário |
|---|---|
| Chamado aberto | Solicitante (confirmação + número) + fila da equipe |
| Chamado atribuído | Técnico designado |
| Novo comentário público | Solicitante (notificação) |
| SLA violado | Técnico responsável + fila da equipe |
| 3 dias sem resposta em `pendente_usuario` | Solicitante (lembrete único por dia) |
| Chamado resolvido | Solicitante (com solução aplicada) |
| Chamado cancelado | Solicitante (com motivo) |
| Pesquisa CSAT | Solicitante (configurável: horas após fechamento) |

---

## Jobs Agendados (Cron)

Endpoints protegidos por `Authorization: Bearer <CRON_SECRET>`.

### `GET /api/ti/jobs/auto-close`
Envia **e-mail de lembrete** ao solicitante após **3 dias** em `pendente_usuario`, limitando 1 lembrete por chamado por dia (verifica `ti_email_logs`).

### `GET /api/ti/jobs/sla-monitor`
Verifica todos os chamados em aberto com SLA configurado. Ao detectar violação:
- Atualiza `sla_violado = true` e registra `sla_violado_em`.
- Envia e-mail de alerta ao técnico e à fila da equipe.

**Exemplo de configuração no Vercel (`vercel.json`):**

```json
{
  "crons": [
    { "path": "/api/ti/jobs/auto-close",  "schedule": "0 9 * * *"    },
    { "path": "/api/ti/jobs/sla-monitor", "schedule": "*/15 * * * *" }
  ]
}
```

---

## Variáveis de Ambiente

Crie `.env.local` na raiz do projeto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Azure AD (Microsoft MSAL)
NEXT_PUBLIC_AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXT_PUBLIC_AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# URL pública da aplicação
NEXT_PUBLIC_APP_URL=https://seu-dominio.com.br

# E-mail SMTP
SMTP_HOST=smtp.seuservidor.com
SMTP_PORT=587
SMTP_USER=noreply@seudominio.com
SMTP_PASS=sua_senha_smtp
SMTP_FROM="Central T.I. <noreply@seudominio.com>"

# Segurança dos Cron Jobs
CRON_SECRET=string_aleatoria_forte_minimo_32_chars
```

---

## Instalação e Execução

```bash
# 1. Clone o repositório
git clone <url-do-repositorio>
cd chamados-ti

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais reais

# 4. Aplique as migrations no Supabase
supabase db push
# ou aplique manualmente os arquivos de supabase/migrations/ no SQL Editor

# 5. Execute em desenvolvimento
npm run dev
# Disponível em http://localhost:3000

# 6. Build de produção
npm run build
npm run start
```

---

## Migrations Supabase

Os arquivos em `supabase/migrations/` devem ser aplicados na ordem numérica:

| Arquivo | Conteúdo |
|---|---|
| `20260430000000_ti_schema.sql` | Schema completo: todas as tabelas, sequências, índices e RLS |
| `20260430000001_ti_seeds.sql` | Dados iniciais: categorias padrão e SLAs globais |
| `20260430000002_dynamic_profiles.sql` | Sistema de perfis e permissões dinâmicas |
| `20260504000000_tecnico_assignment_to_access_users.sql` | Migração de atribuição de técnicos para `ti_access_users` |
| `20260504000001_ativos_valor_imei.sql` | Campos `valor` e `imei` na tabela de ativos |
| `20260504000001_dynamic_catalogs.sql` | Catálogos dinâmicos de categorias |
| `20260504000002_category_severity.sql` | Campo `severidade` por categoria para sugestão de prioridade |

---

## Licença

Uso interno — Costa Lavos. Todos os direitos reservados.
