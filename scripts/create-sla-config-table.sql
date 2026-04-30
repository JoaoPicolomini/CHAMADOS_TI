-- ============================================================
-- TABELA DE CONFIGURAÇÃO DE SLA
-- Execute este script no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS rnc_sla_config (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity       text NOT NULL CHECK (severity IN ('critica', 'alta', 'media', 'baixa')),
  status         text NOT NULL,
  deadline_hours int  NOT NULL DEFAULT 24 CHECK (deadline_hours > 0),
  warning_hours  int  NOT NULL DEFAULT 4  CHECK (warning_hours > 0),
  is_active      bool NOT NULL DEFAULT true,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (severity, status)
);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_sla_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sla_config_updated_at
BEFORE UPDATE ON rnc_sla_config
FOR EACH ROW EXECUTE FUNCTION update_sla_config_timestamp();

-- RLS
ALTER TABLE rnc_sla_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read" ON rnc_sla_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_all" ON rnc_sla_config
  FOR ALL TO service_role USING (true);

-- ============================================================
-- DADOS PADRÃO — Matriz Severidade × Status
-- ============================================================
INSERT INTO rnc_sla_config (severity, status, deadline_hours, warning_hours) VALUES
  -- Crítica
  ('critica', 'aberto',                 2,   1),
  ('critica', 'em_triagem',             4,   1),
  ('critica', 'em_analise',             8,   2),
  ('critica', 'acao_imediata',          4,   1),
  ('critica', 'acao_corretiva',        24,   4),
  ('critica', 'em_validacao',          12,   2),
  ('critica', 'verificacao_eficacia',  24,   4),
  ('critica', 'reaberto',               4,   1),
  -- Alta
  ('alta', 'aberto',                    4,   1),
  ('alta', 'em_triagem',                8,   2),
  ('alta', 'em_analise',               24,   4),
  ('alta', 'acao_imediata',             8,   2),
  ('alta', 'acao_corretiva',           48,   8),
  ('alta', 'em_validacao',             24,   4),
  ('alta', 'verificacao_eficacia',     48,   8),
  ('alta', 'reaberto',                  8,   2),
  -- Média
  ('media', 'aberto',                   8,   2),
  ('media', 'em_triagem',              24,   4),
  ('media', 'em_analise',              48,   8),
  ('media', 'acao_imediata',           24,   4),
  ('media', 'acao_corretiva',          72,  12),
  ('media', 'em_validacao',            48,   8),
  ('media', 'verificacao_eficacia',    72,  12),
  ('media', 'reaberto',                24,   4),
  -- Baixa
  ('baixa', 'aberto',                  24,   4),
  ('baixa', 'em_triagem',              48,   8),
  ('baixa', 'em_analise',              72,  12),
  ('baixa', 'acao_imediata',           48,   8),
  ('baixa', 'acao_corretiva',         120,  24),
  ('baixa', 'em_validacao',            72,  12),
  ('baixa', 'verificacao_eficacia',   120,  24),
  ('baixa', 'reaberto',                48,   8)
ON CONFLICT (severity, status) DO NOTHING;
