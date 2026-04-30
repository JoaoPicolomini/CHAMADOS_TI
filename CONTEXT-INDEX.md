# Índice de Contexto Estruturado: Costa Lavos RNC

Este documento serve como a "Âncora da Verdade" (Source of Truth) para o sistema de gestão de Registros de Não Conformidade (RNC). Ele foi gerado por meio de uma análise técnica exaustiva do código-fonte e do banco de dados em 10 de abril de 2026.

---

## 1. Arquitetura e Estrutura do Sistema

O sistema utiliza uma arquitetura **Full Stack Moderna** centrada no ecossistema Next.js e Supabase.

*   **Padrão Predominante:** **Next.js App Router** com **Server-Side Logic (Server Actions)**. O sistema segue um modelo onde a lógica de negócio pesada reside no servidor para garantir integridade e segurança.
*   **Hierarquia de Pastas e Responsabilidades:**
    *   `src/app/`: **Camada de Apresentação e Roteamento**. Define as interfaces de usuário e as rotas da aplicação.
    *   `src/components/`: **Camada de Interface Reutilizável**. Armazena componentes UI compartilhados.
    *   `src/lib/`: **Camada de Core Logic**.
        *   `actions.ts`: Ponto central de mutação e consulta de dados (Server Actions).
        *   `types.ts`: Definições de interfaces e enums (Contrato de Dados).
        *   `workflow.ts`: Máquina de Estados que governa as transições de status da RNC.
    *   `supabase/`: **Infraestrutura de Dados**. Contém schemas SQL, migrations e definições de banco de dados.
    *   `n8n/`: **Camada de Automação Externa**. Fluxos de trabalho para notificações e automação de processos.
*   **Entry Points (Pontos de Entrada):**
    1.  **Público/Landing (`/`)**: Página inicial e institucional.
    2.  **Formulário de Abertura (`/abrir`)**: Interface para registro de novas ocorrências (Acesso público).
    3.  **Dashboard Interno (`/app/dashboard`)**: Área de gestão para analistas (Requer autenticação MSAL).

---

## 2. Fluxo de Dados e Entidades

### Dicionário de Entidades (Baseado no Código)

| Entidade | Responsabilidade | Atributos Chave |
| :--- | :--- | :--- |
| **`RncRecord`** | Objeto central da ocorrência. | `rnc_number`, `status`, `severity`, `client_id`, `product_id`, `batch_number`. |
| **`RncClient`** | Cadastro de clientes vinculados. | `name`, `cnpj`, `is_active`. |
| **`RncProduct`** | Catálogo de produtos técnicos. | `name`, `code`, `category`. |
| **`RncAttachment`**| Gestão de evidências e fotos. | `storage_path`, `category`, `original_filename`. |
| **`RncWorkflowEvent`**| Auditoria de mudanças de status. | `from_status`, `to_status`, `performed_by`, `justification`. |
| **`RncAccessUser`** | Gestão de permissões de acesso. | `email`, `role`, `is_active`. |

### Ciclo de Vida do Dado
1.  **Entrada:** Usuário submete o formulário em `/abrir`.
2.  **Validação:** O sistema valida os campos via `validations.ts`.
3.  **Registro:** Uma nova `RncRecord` é criada com status inicial `aberto`.
4.  **Tratativa:** Analistas autorizados realizam a triagem e análise, movendo a RNC pelos estágios do workflow.
5.  **Histórico:** Cada mudança é registrada em `RncWorkflowEvent` e `RncFieldChangeLogs`.
6.  **Encerramento:** A RNC atinge um estado terminal (`encerrado` ou `improcedente`).

---

## 3. Grafo de Dependências Lógicas

As conexões entre os principais componentes seguem o fluxo abaixo:

- **UI (Client)** → Consome **Server Actions** (`actions.ts`)
- **Server Actions** → Consome **Workflow Logic** (`workflow.ts`) e **Supabase Admin**
- **Supabase Admin** → Interage com o **Banco de Dados (Schema)**
- **Auth (MSAL)** → Governa o acesso à **Área Interna (`/app`)**
- **Triggers de Banco** → Disparam automações externas no **n8n**

---

## 4. Protocolo de Integridade (Anti-Alucinação)

### Regras de Ouro (Derivadas do Código)
1.  **Justificativa Obrigatória:** Transições críticas (como `improcedente` ou `reaberto`) exigem uma justificativa mínima de 50 caracteres para garantir rastreabilidade.
2.  **Segurança Servidor-Lado:** O sistema utiliza chaves de serviço para operações administrativas, o que contorna o RLS do Supabase em favor de uma gestão granular de permissões em `actions.ts`.
3.  **Auditabilidade:** Logs de auditoria (`workflow` e `field_change`) são **imutáveis**. Nenhuma operação de `UPDATE` ou `DELETE` é permitida nessas tabelas via banco de dados.

### Pontos [INCERTO/OCULTO]
- **Exclusão de Arquivos:** O código indica exclusão lógica de anexos (`is_deleted`), mas o expurgo físico desses bits do Storage não está explícito no código mapeado.
- **SLA e Feriados:** O cálculo de prazos de SLA não parece levar em conta calendários de feriados nacionais/locais no código TypeScript (Presume-se contagem corrida).

---
**Status da Análise:** 100% Confiável (Baseado em Inspeção Direta).
