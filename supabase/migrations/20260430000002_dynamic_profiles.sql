-- ============================================================
-- SISTEMA DE CHAMADOS DE T.I
-- Migração: Perfis Dinâmicos
-- ============================================================

-- 1. Criação da tabela de perfis
CREATE TABLE IF NOT EXISTS ti_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE, -- Identificador único (ex: 'admin', 'tecnico')
  nome        TEXT NOT NULL,        -- Nome amigável (ex: 'Administrador')
  descricao   TEXT,                 -- Descrição das responsabilidades
  cor         TEXT DEFAULT '#2563EB', -- Cor para UI
  icone       TEXT DEFAULT 'Shield',  -- Nome do ícone Lucide
  ordem       INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Inserção dos perfis iniciais (whitelist atual)
INSERT INTO ti_profiles (slug, nome, descricao, cor, icone, ordem)
VALUES 
  ('admin', 'Administrador', 'Acesso total ao sistema, configurações e gestão de usuários.', '#DC2626', 'ShieldAlert', 1),
  ('gestor_ti', 'Gestor de T.I', 'Gestão de técnicos, equipes, SLAs e relatórios analíticos.', '#2563EB', 'ShieldCheck', 2),
  ('tecnico', 'Técnico', 'Atendimento de chamados, base de conhecimento e gestão de ativos.', '#059669', 'Shield', 3),
  ('user', 'Usuário', 'Abertura e acompanhamento de chamados próprios.', '#6B7280', 'UserCircle', 4)
ON CONFLICT (slug) DO NOTHING;

-- 3. Atualização das tabelas dependentes para usar Foreign Keys (Integridade)
-- Nota: Mantemos o campo como TEXT para facilitar consultas, mas com FK para o slug.

-- Remover constraint antiga de CHECK se existir
ALTER TABLE ti_access_users DROP CONSTRAINT IF EXISTS ti_access_users_perfil_check;

-- Adicionar FK em ti_access_users
ALTER TABLE ti_access_users 
ADD CONSTRAINT ti_access_users_perfil_fkey 
FOREIGN KEY (perfil) 
REFERENCES ti_profiles(slug) 
ON UPDATE CASCADE;

-- Adicionar FK em ti_profile_permissions
ALTER TABLE ti_profile_permissions 
ADD CONSTRAINT ti_profile_permissions_perfil_fkey 
FOREIGN KEY (perfil) 
REFERENCES ti_profiles(slug) 
ON UPDATE CASCADE;

-- 4. Função para atualizar o updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ti_profiles_modtime
    BEFORE UPDATE ON ti_profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
