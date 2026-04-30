-- ============================================================
-- SISTEMA DE CHAMADOS DE T.I
-- Migração Principal — Todas as tabelas do sistema
-- ============================================================

-- ─── Extensões ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Sequência para número de chamado ─────────────────────────
CREATE SEQUENCE IF NOT EXISTS ti_chamado_seq START 1;

-- ─── 1. CATEGORIAS ────────────────────────────────────────────
CREATE TABLE ti_categorias (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  categoria_pai UUID REFERENCES ti_categorias(id) ON DELETE SET NULL,
  icone         TEXT,
  descricao     TEXT,
  ordem         INT DEFAULT 0,
  ativo         BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. EQUIPES ───────────────────────────────────────────────
CREATE TABLE ti_equipes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  descricao     TEXT,
  email_fila    TEXT,
  nivel         INT DEFAULT 1 CHECK (nivel IN (1, 2, 3)),
  ativo         BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. TÉCNICOS ──────────────────────────────────────────────
CREATE TABLE ti_tecnicos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email       TEXT NOT NULL UNIQUE,
  nome        TEXT NOT NULL,
  cargo       TEXT,
  equipe_id   UUID REFERENCES ti_equipes(id) ON DELETE SET NULL,
  ramal       TEXT,
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. SLA CONFIG ────────────────────────────────────────────
CREATE TABLE ti_sla_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prioridade        TEXT NOT NULL CHECK (prioridade IN ('critica', 'alta', 'media', 'baixa')),
  categoria_id      UUID REFERENCES ti_categorias(id) ON DELETE CASCADE,
  prazo_horas       INT NOT NULL,
  alerta_pct_70     BOOLEAN DEFAULT true,
  alerta_pct_90     BOOLEAN DEFAULT true,
  horario_comercial BOOLEAN DEFAULT true,
  ativo             BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (prioridade, categoria_id)
);

-- ─── 5. ATIVOS DE TI ──────────────────────────────────────────
CREATE TABLE ti_ativos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                TEXT NOT NULL CHECK (tipo IN (
    'computador', 'notebook', 'monitor', 'impressora',
    'telefone', 'servidor', 'switch', 'nobreak', 'outros'
  )),
  nome                TEXT NOT NULL,
  patrimonio          TEXT UNIQUE,
  numero_serie        TEXT,
  modelo              TEXT,
  fabricante          TEXT,
  setor               TEXT,
  responsavel         TEXT,
  ip                  TEXT,
  hostname            TEXT,
  sistema_operacional TEXT,
  data_aquisicao      DATE,
  garantia_ate        DATE,
  status              TEXT DEFAULT 'ativo' CHECK (status IN (
    'ativo', 'manutencao', 'descartado', 'emprestado', 'reserva'
  )),
  observacoes         TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ─── 6. CHAMADOS (TABELA PRINCIPAL) ───────────────────────────
CREATE TABLE ti_chamados (
  -- Identificação
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL UNIQUE DEFAULT (
    'TI-' || LPAD(nextval('ti_chamado_seq')::TEXT, 6, '0')
  ),

  -- Solicitante
  solicitante_nome    TEXT NOT NULL,
  solicitante_email   TEXT NOT NULL,
  solicitante_ramal   TEXT,
  solicitante_setor   TEXT NOT NULL,
  solicitante_unidade TEXT,

  -- Classificação
  categoria_id      UUID REFERENCES ti_categorias(id) ON DELETE SET NULL,
  subcategoria_id   UUID REFERENCES ti_categorias(id) ON DELETE SET NULL,
  prioridade        TEXT NOT NULL DEFAULT 'media' CHECK (
    prioridade IN ('critica', 'alta', 'media', 'baixa')
  ),
  tipo              TEXT NOT NULL DEFAULT 'incidente' CHECK (
    tipo IN ('incidente', 'solicitacao', 'problema', 'mudanca')
  ),

  -- Conteúdo
  titulo            TEXT NOT NULL,
  descricao         TEXT NOT NULL,
  passos_reproduzir TEXT,

  -- Ativo relacionado
  ativo_id          UUID REFERENCES ti_ativos(id) ON DELETE SET NULL,
  ativo_descricao   TEXT,

  -- Atribuição
  equipe_id         UUID REFERENCES ti_equipes(id) ON DELETE SET NULL,
  tecnico_id        UUID REFERENCES ti_tecnicos(id) ON DELETE SET NULL,

  -- Status
  status            TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN (
    'aberto',
    'em_atendimento',
    'pendente_usuario',
    'pendente_terceiro',
    'escalado',
    'resolvido',
    'fechado',
    'fechado_automatico',
    'reaberto',
    'cancelado'
  )),

  -- SLA
  sla_prazo             TIMESTAMPTZ,
  sla_pausado_em        TIMESTAMPTZ,
  sla_horas_pausadas    INT DEFAULT 0,
  sla_violado           BOOLEAN DEFAULT false,
  sla_violado_em        TIMESTAMPTZ,

  -- Escalonamento
  nivel_suporte   INT DEFAULT 1 CHECK (nivel_suporte IN (1, 2, 3)),
  escalado_em     TIMESTAMPTZ,
  escalado_por    TEXT,

  -- Resolução
  solucao         TEXT,
  causa_raiz      TEXT,
  artigo_kb_id    UUID,

  -- Fechamento / Cancelamento
  motivo_cancelamento TEXT,
  fechado_em          TIMESTAMPTZ,
  fechado_por         TEXT,

  -- Satisfação (CSAT)
  satisfacao_nota            INT CHECK (satisfacao_nota BETWEEN 1 AND 5),
  satisfacao_comentario      TEXT,
  satisfacao_respondido_em   TIMESTAMPTZ,
  satisfacao_enviado_em      TIMESTAMPTZ,

  -- Metadados
  ip_abertura   TEXT,
  origem        TEXT DEFAULT 'portal' CHECK (
    origem IN ('portal', 'email', 'telefone', 'presencial', 'api')
  ),
  tags          TEXT[],

  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── 7. WORKFLOW EVENTS (AUDITORIA IMUTÁVEL) ──────────────────
CREATE TABLE ti_workflow_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id    UUID NOT NULL REFERENCES ti_chamados(id) ON DELETE CASCADE,
  status_de     TEXT,
  status_para   TEXT NOT NULL,
  realizado_por TEXT NOT NULL,
  justificativa TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── 8. FIELD CHANGE LOGS (AUDITORIA DE CAMPOS) ───────────────
CREATE TABLE ti_field_change_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id    UUID NOT NULL REFERENCES ti_chamados(id) ON DELETE CASCADE,
  campo         TEXT NOT NULL,
  valor_antigo  TEXT,
  valor_novo    TEXT,
  alterado_por  TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── 9. COMENTÁRIOS ───────────────────────────────────────────
CREATE TABLE ti_comentarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id    UUID NOT NULL REFERENCES ti_chamados(id) ON DELETE CASCADE,
  autor_nome    TEXT NOT NULL,
  autor_email   TEXT NOT NULL,
  conteudo      TEXT NOT NULL,
  interno       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── 10. ANEXOS ───────────────────────────────────────────────
CREATE TABLE ti_anexos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id      UUID NOT NULL REFERENCES ti_chamados(id) ON DELETE CASCADE,
  categoria       TEXT CHECK (categoria IN ('screenshot', 'log', 'documento', 'outro')),
  storage_path    TEXT NOT NULL,
  nome_original   TEXT NOT NULL,
  mime_type       TEXT,
  tamanho_bytes   BIGINT,
  hash_sha256     TEXT,
  enviado_por     TEXT,
  enviado_por_ip  TEXT,
  deleted_at      TIMESTAMPTZ,
  deleted_por     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─── 11. RELACIONAMENTOS ENTRE CHAMADOS ───────────────────────
CREATE TABLE ti_relacionamentos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id     UUID NOT NULL REFERENCES ti_chamados(id) ON DELETE CASCADE,
  relacionado_id UUID NOT NULL REFERENCES ti_chamados(id) ON DELETE CASCADE,
  tipo           TEXT CHECK (tipo IN ('duplicata', 'pai_filho', 'relacionado')),
  criado_por     TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (chamado_id, relacionado_id)
);

-- ─── 12. BASE DE CONHECIMENTO ─────────────────────────────────
CREATE TABLE ti_base_conhecimento (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        TEXT NOT NULL,
  conteudo      TEXT NOT NULL,
  categoria_id  UUID REFERENCES ti_categorias(id) ON DELETE SET NULL,
  tags          TEXT[],
  publicado     BOOLEAN DEFAULT false,
  visualizacoes INT DEFAULT 0,
  util_sim      INT DEFAULT 0,
  util_nao      INT DEFAULT 0,
  autor_email   TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── 13. CONTROLE DE ACESSO ───────────────────────────────────
CREATE TABLE ti_access_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  nome       TEXT NOT NULL,
  cargo      TEXT,
  perfil     TEXT NOT NULL DEFAULT 'user' CHECK (
    perfil IN ('user', 'tecnico', 'gestor_ti', 'admin')
  ),
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 14. PERMISSÕES ───────────────────────────────────────────
CREATE TABLE ti_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  descricao   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ti_profile_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil      TEXT NOT NULL,
  permission  TEXT NOT NULL REFERENCES ti_permissions(code) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (perfil, permission)
);

-- ─── 15. NOTIFICAÇÕES ─────────────────────────────────────────
CREATE TABLE ti_notification_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id    UUID REFERENCES ti_chamados(id) ON DELETE SET NULL,
  tipo          TEXT NOT NULL,
  destinatario  TEXT NOT NULL,
  status        TEXT DEFAULT 'pendente' CHECK (
    status IN ('pendente', 'enviado', 'falhou')
  ),
  tentativas    INT DEFAULT 0,
  erro          TEXT,
  enviado_em    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ti_email_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id    UUID REFERENCES ti_chamados(id) ON DELETE SET NULL,
  recipient     TEXT NOT NULL,
  subject       TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── 16. PESQUISA DE SATISFAÇÃO CONFIG ────────────────────────
CREATE TABLE ti_satisfacao_config (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ativa                     BOOLEAN DEFAULT true,
  horas_apos_fechamento     INT DEFAULT 1,
  lembrete_horas            INT DEFAULT 24,
  max_lembretes             INT DEFAULT 2,
  updated_at                TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

-- ti_chamados
CREATE INDEX idx_ti_chamados_status        ON ti_chamados(status);
CREATE INDEX idx_ti_chamados_prioridade    ON ti_chamados(prioridade);
CREATE INDEX idx_ti_chamados_tecnico       ON ti_chamados(tecnico_id);
CREATE INDEX idx_ti_chamados_equipe        ON ti_chamados(equipe_id);
CREATE INDEX idx_ti_chamados_categoria     ON ti_chamados(categoria_id);
CREATE INDEX idx_ti_chamados_email         ON ti_chamados(solicitante_email);
CREATE INDEX idx_ti_chamados_sla           ON ti_chamados(sla_prazo);
CREATE INDEX idx_ti_chamados_created       ON ti_chamados(created_at DESC);
CREATE INDEX idx_ti_chamados_numero        ON ti_chamados(numero);

-- ti_workflow_events
CREATE INDEX idx_ti_wf_chamado ON ti_workflow_events(chamado_id);
CREATE INDEX idx_ti_wf_created ON ti_workflow_events(created_at DESC);

-- ti_comentarios
CREATE INDEX idx_ti_comments_chamado ON ti_comentarios(chamado_id);

-- ti_anexos
CREATE INDEX idx_ti_anexos_chamado ON ti_anexos(chamado_id);

-- ti_base_conhecimento
CREATE INDEX idx_ti_kb_categoria  ON ti_base_conhecimento(categoria_id);
CREATE INDEX idx_ti_kb_publicado  ON ti_base_conhecimento(publicado);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION ti_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ti_chamados_updated_at
  BEFORE UPDATE ON ti_chamados
  FOR EACH ROW EXECUTE FUNCTION ti_set_updated_at();

CREATE TRIGGER trg_ti_equipes_updated_at
  BEFORE UPDATE ON ti_equipes
  FOR EACH ROW EXECUTE FUNCTION ti_set_updated_at();

CREATE TRIGGER trg_ti_tecnicos_updated_at
  BEFORE UPDATE ON ti_tecnicos
  FOR EACH ROW EXECUTE FUNCTION ti_set_updated_at();

CREATE TRIGGER trg_ti_ativos_updated_at
  BEFORE UPDATE ON ti_ativos
  FOR EACH ROW EXECUTE FUNCTION ti_set_updated_at();

CREATE TRIGGER trg_ti_kb_updated_at
  BEFORE UPDATE ON ti_base_conhecimento
  FOR EACH ROW EXECUTE FUNCTION ti_set_updated_at();

CREATE TRIGGER trg_ti_access_users_updated_at
  BEFORE UPDATE ON ti_access_users
  FOR EACH ROW EXECUTE FUNCTION ti_set_updated_at();

-- Imutabilidade de workflow events e field change logs
CREATE OR REPLACE FUNCTION ti_prevent_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Tabela de auditoria é imutável. UPDATE e DELETE não são permitidos.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_ti_wf_immutable
  BEFORE UPDATE OR DELETE ON ti_workflow_events
  FOR EACH ROW EXECUTE FUNCTION ti_prevent_mutation();

CREATE TRIGGER trg_ti_fcl_immutable
  BEFORE UPDATE OR DELETE ON ti_field_change_logs
  FOR EACH ROW EXECUTE FUNCTION ti_prevent_mutation();

-- Auto-detecta violação de SLA ao atualizar chamado
CREATE OR REPLACE FUNCTION ti_check_sla_violation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sla_prazo IS NOT NULL AND NEW.sla_prazo < now() AND NEW.sla_violado = false THEN
    NEW.sla_violado = true;
    NEW.sla_violado_em = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ti_sla_violation
  BEFORE UPDATE ON ti_chamados
  FOR EACH ROW EXECUTE FUNCTION ti_check_sla_violation();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE ti_chamados            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ti_workflow_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ti_field_change_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ti_comentarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ti_anexos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ti_access_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ti_notification_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ti_email_logs          ENABLE ROW LEVEL SECURITY;

-- Anon: pode apenas inserir novos chamados (formulário público)
CREATE POLICY "anon_insert_chamado" ON ti_chamados
  FOR INSERT TO anon WITH CHECK (true);

-- Service role: acesso total (usado pelo backend Next.js)
CREATE POLICY "service_all_chamados" ON ti_chamados
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_wf" ON ti_workflow_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_fcl" ON ti_field_change_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_comments" ON ti_comentarios
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_anexos" ON ti_anexos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_access_users" ON ti_access_users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_notif" ON ti_notification_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_email_logs" ON ti_email_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tabelas de leitura pública (catálogos)
ALTER TABLE ti_categorias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ti_equipes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ti_tecnicos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ti_ativos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ti_sla_configs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ti_base_conhecimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_categorias" ON ti_categorias
  FOR SELECT TO anon, authenticated USING (ativo = true);

CREATE POLICY "service_all_categorias" ON ti_categorias
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_equipes" ON ti_equipes
  FOR SELECT TO anon, authenticated USING (ativo = true);

CREATE POLICY "service_all_equipes" ON ti_equipes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_tecnicos" ON ti_tecnicos
  FOR SELECT TO anon, authenticated USING (ativo = true);

CREATE POLICY "service_all_tecnicos" ON ti_tecnicos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_ativos" ON ti_ativos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_all_ativos" ON ti_ativos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_sla" ON ti_sla_configs
  FOR SELECT TO anon, authenticated USING (ativo = true);

CREATE POLICY "service_all_sla" ON ti_sla_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_kb" ON ti_base_conhecimento
  FOR SELECT TO anon, authenticated USING (publicado = true);

CREATE POLICY "service_all_kb" ON ti_base_conhecimento
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Permissões
ALTER TABLE ti_permissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ti_profile_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_permissions" ON ti_permissions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "service_all_permissions" ON ti_permissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "read_profile_permissions" ON ti_profile_permissions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "service_all_profile_permissions" ON ti_profile_permissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon: inserir chamado (formulário público não autenticado)
CREATE POLICY "anon_insert_comentarios" ON ti_comentarios
  FOR INSERT TO anon WITH CHECK (true);
