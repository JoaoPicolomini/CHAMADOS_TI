-- ============================================
-- Costa Lavos RNC — App Access Control List
-- ============================================

CREATE TABLE IF NOT EXISTS rnc_access_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  position text,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin', 'quality_manager')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger para atualizar o `updated_at` automaticamente (reaproveitando a função existente)
CREATE TRIGGER trg_rnc_access_users_updated_at
  BEFORE UPDATE ON rnc_access_users
  FOR EACH ROW EXECUTE FUNCTION rnc_set_updated_at();

-- RLS: Apenas leitura segura pelo server-side (Service Role)
ALTER TABLE rnc_access_users ENABLE ROW LEVEL SECURITY;

-- Nota: Como o Backend validará o e-mail via Server Actions (Service Key),
-- Nenhuma política pública de SELECT será necessária. A tabela fica 100% blindada contra Frontend anônimo.
