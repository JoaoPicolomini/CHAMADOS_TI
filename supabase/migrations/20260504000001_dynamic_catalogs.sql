-- ============================================================
-- CHAMADOS T.I — Catálogos Dinâmicos
-- Cria tabelas para Setores e Unidades, permitindo gestão via admin.
-- ============================================================

-- 1. SETORES
CREATE TABLE IF NOT EXISTS ti_setores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL UNIQUE,
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. UNIDADES / FILIAIS
CREATE TABLE IF NOT EXISTS ti_unidades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL UNIQUE,
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. PERMISSÕES DE RLS
ALTER TABLE ti_setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ti_unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_setores" ON ti_setores FOR SELECT TO anon, authenticated USING (ativo = true);
CREATE POLICY "service_all_setores" ON ti_setores FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_unidades" ON ti_unidades FOR SELECT TO anon, authenticated USING (ativo = true);
CREATE POLICY "service_all_unidades" ON ti_unidades FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. SEEDS INICIAIS (Setores)
INSERT INTO ti_setores (nome) VALUES 
  ('Administrativo'), ('Comercial'), ('Compras'), ('Contabilidade'), ('Diretoria'),
  ('Engenharia'), ('Estoque'), ('Financeiro'), ('Jurídico'), ('Logística'),
  ('Marketing'), ('Produção'), ('Qualidade'), ('Recursos Humanos'), ('TI'), ('Vendas')
ON CONFLICT (nome) DO NOTHING;
