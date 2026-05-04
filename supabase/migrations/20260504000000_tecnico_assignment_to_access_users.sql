-- ============================================================
-- CHAMADOS T.I — Atribuição de chamados via perfil
-- Remove dependência de ti_tecnicos para atribuição:
-- agora qualquer usuário com perfil 'tecnico' em ti_access_users
-- pode ser atribuído a um chamado.
-- ============================================================

-- 1. Remover FK antiga (ti_chamados.tecnico_id -> ti_tecnicos)
ALTER TABLE ti_chamados
  DROP CONSTRAINT IF EXISTS ti_chamados_tecnico_id_fkey;

-- 2. Limpar referências antigas (IDs de ti_tecnicos não existem em ti_access_users)
UPDATE ti_chamados SET tecnico_id = NULL;

-- 3. Adicionar nova FK (ti_chamados.tecnico_id -> ti_access_users)
ALTER TABLE ti_chamados
  ADD CONSTRAINT ti_chamados_tecnico_id_fkey
  FOREIGN KEY (tecnico_id)
  REFERENCES ti_access_users(id)
  ON DELETE SET NULL;
