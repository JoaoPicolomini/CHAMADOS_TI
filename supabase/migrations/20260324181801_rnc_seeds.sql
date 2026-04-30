-- ─── Seed: Departments ───
INSERT INTO rnc_departments (name) VALUES
  ('Vendas'),
  ('Apoio'),
  ('Consultores'),
  ('Comitê'),
  ('Outros')
ON CONFLICT (name) DO NOTHING;

-- ─── Seed: Occurrence Reasons ───
INSERT INTO rnc_occurrence_reasons (label, requires_preparation, suggested_severity, sort_order) VALUES
  ('Falha na selagem / pacote aberto', false, 'alta', 1),
  ('Fora da especificação - Tamanho/Peso', false, 'media', 2),
  ('Massa descongelada', false, 'alta', 3),
  ('Massa não desenvolve durante fermentação', true, 'alta', 4),
  ('Desenvolvimento não uniforme entre os pães', true, 'media', 5),
  ('Massa desenrola na fermentação', true, 'media', 6),
  ('Sujidades na massa', false, 'critica', 7),
  ('Bolhas no pão', true, 'media', 8),
  ('Outros', false, null, 9)
ON CONFLICT DO NOTHING;

-- ─── Seed: SLA Configs ───
INSERT INTO rnc_sla_configs (severity, stage, deadline_hours, escalation_to) VALUES
  -- Crítica
  ('critica', 'em_triagem', 2, 'coordenador'),
  ('critica', 'em_analise', 24, 'coordenador'),
  ('critica', 'acao_imediata', 8, 'gerente'),
  ('critica', 'acao_corretiva', 56, 'gerente'),
  ('critica', 'em_validacao', 24, 'gerente'),
  ('critica', 'verificacao_eficacia', 720, null),
  -- Alta
  ('alta', 'em_triagem', 4, 'coordenador'),
  ('alta', 'em_analise', 48, 'coordenador'),
  ('alta', 'acao_imediata', 24, 'gerente'),
  ('alta', 'acao_corretiva', 120, 'gerente'),
  ('alta', 'em_validacao', 40, 'gerente'),
  ('alta', 'verificacao_eficacia', 1440, null),
  -- Média
  ('media', 'em_triagem', 8, 'coordenador'),
  ('media', 'em_analise', 72, 'coordenador'),
  ('media', 'acao_imediata', 48, 'coordenador'),
  ('media', 'acao_corretiva', 160, 'gerente'),
  ('media', 'em_validacao', 56, 'gerente'),
  ('media', 'verificacao_eficacia', 2160, null),
  -- Baixa
  ('baixa', 'em_triagem', 24, 'coordenador'),
  ('baixa', 'em_analise', 120, 'coordenador'),
  ('baixa', 'acao_imediata', 72, 'coordenador'),
  ('baixa', 'acao_corretiva', 240, 'gerente'),
  ('baixa', 'em_validacao', 80, 'gerente'),
  ('baixa', 'verificacao_eficacia', 2160, null)
ON CONFLICT (severity, stage) DO NOTHING;
