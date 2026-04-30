-- Migration: rnc_contatos registry
-- Purpose: Centralized contact registry for supervisors (Auth and External)
-- Based on approved design 2026-04-27

-- 1. Create rnc_contatos table
CREATE TABLE IF NOT EXISTS public.rnc_contatos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id        uuid UNIQUE NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  email               text NOT NULL UNIQUE,
  display_name        text NOT NULL,
  phone               text NULL,                        -- Green point 1
  source              text NOT NULL DEFAULT 'manual',   -- Green point 2 (manual/auth_sync)
  notification_email  text NULL,                        -- Override (D6)
  is_active           boolean NOT NULL DEFAULT true,    -- Soft delete (D8)
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid NULL REFERENCES auth.users(id),
  CONSTRAINT rnc_contatos_identity_chk
    CHECK (auth_user_id IS NOT NULL OR email IS NOT NULL)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rnc_contatos_auth_user_id ON public.rnc_contatos(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rnc_contatos_email_lower ON public.rnc_contatos(lower(email));
CREATE INDEX IF NOT EXISTS idx_rnc_contatos_ativo ON public.rnc_contatos(is_active) WHERE is_active = true;

-- 2. Update rnc_clients to link with supervisor
ALTER TABLE public.rnc_clients
  ADD COLUMN IF NOT EXISTS supervisor_contato_id uuid NULL REFERENCES public.rnc_contatos(id);

CREATE INDEX IF NOT EXISTS idx_rnc_clients_supervisor_contato_id
  ON public.rnc_clients(supervisor_contato_id)
  WHERE supervisor_contato_id IS NOT NULL;

-- 3. RLS Policies
ALTER TABLE public.rnc_contatos ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can see their own full record, or others (possibly masked/limited)
-- As per user: "restringir SELECT a admin, ou mascarar email para non-admin"
-- For now, let's allow selective read and implement a masking view if needed later, 
-- but we will stick to the basic policy from the design doc for simplicity unless instructed otherwise.
CREATE POLICY rnc_contatos_select_authenticated
  ON public.rnc_contatos FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt()->'app_metadata')->>'role')::text = 'admin' 
    OR auth.uid() = auth_user_id
  );

-- INSERT: only admin
CREATE POLICY rnc_contatos_insert_admin
  ON public.rnc_contatos FOR INSERT
  TO authenticated
  WITH CHECK (((auth.jwt()->'app_metadata')->>'role')::text = 'admin');

-- UPDATE: admin (everything) or self (specific fields)
CREATE POLICY rnc_contatos_update_admin
  ON public.rnc_contatos FOR UPDATE
  TO authenticated
  USING (((auth.jwt()->'app_metadata')->>'role')::text = 'admin');

CREATE POLICY rnc_contatos_update_self
  ON public.rnc_contatos FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- 4. Triggers: updated_at
CREATE TRIGGER trg_rnc_contatos_updated_at
  BEFORE UPDATE ON public.rnc_contatos
  FOR EACH ROW EXECUTE FUNCTION public.rnc_set_updated_at();

-- 5. Trigger: Self-update guard (P6.C)
CREATE OR REPLACE FUNCTION public.rnc_contatos_self_update_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (((auth.jwt()->'app_metadata')->>'role')::text = 'admin') THEN
    RETURN NEW;
  END IF;

  -- Self update: only notification_email, phone, and display_name can change
  IF NEW.email          IS DISTINCT FROM OLD.email
   OR NEW.auth_user_id  IS DISTINCT FROM OLD.auth_user_id
   OR NEW.is_active     IS DISTINCT FROM OLD.is_active
   OR NEW.source        IS DISTINCT FROM OLD.source
   OR NEW.updated_by    IS DISTINCT FROM OLD.updated_by THEN
    RAISE EXCEPTION 'Campo protegido alterado por usuário não-admin';
  END IF;

  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER tr_rnc_contatos_self_update_guard
  BEFORE UPDATE ON public.rnc_contatos
  FOR EACH ROW EXECUTE FUNCTION public.rnc_contatos_self_update_guard();
