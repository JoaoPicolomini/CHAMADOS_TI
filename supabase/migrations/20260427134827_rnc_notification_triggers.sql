-- Migration: RNC Sync & Notification Triggers
-- Purpose: Live sync from auth.users and automated enqueue to notification_outbox
-- Based on approved design 2026-04-27

-- 1. Sync auth.users -> rnc_contatos
CREATE OR REPLACE FUNCTION public.sync_rnc_contato_from_auth()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_display text;
BEGIN
  v_display := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    split_part(NEW.email, '@', 1)
  );

  -- UPSERT by auth_user_id
  INSERT INTO public.rnc_contatos (auth_user_id, email, display_name, source, is_active)
  VALUES (NEW.id, NEW.email, v_display, 'auth_sync', true)
  ON CONFLICT (auth_user_id) DO UPDATE
    SET email        = EXCLUDED.email,
        display_name = COALESCE(public.rnc_contatos.display_name, EXCLUDED.display_name),
        source       = 'auth_sync',
        updated_at   = now()
  WHERE public.rnc_contatos.email IS DISTINCT FROM EXCLUDED.email;

  -- "Promotion" of external contact whose email now exists in Auth
  UPDATE public.rnc_contatos
     SET auth_user_id = NEW.id,
         source       = 'auth_sync',
         updated_at   = now()
   WHERE auth_user_id IS NULL
     AND lower(email) = lower(NEW.email);

  RETURN NEW;
END $$;

-- Drop trigger if exists to avoid errors on redeploy
DROP TRIGGER IF EXISTS on_auth_user_upsert ON auth.users;

CREATE TRIGGER on_auth_user_upsert
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data
  ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_rnc_contato_from_auth();


-- 2. Enqueue RNC notifications
CREATE OR REPLACE FUNCTION public.enqueue_rnc_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_supervisor_email text;
  v_payload          jsonb;
  v_client_name      text;
BEGIN
  -- Resolve supervisor (if linked and active) and client name
  SELECT COALESCE(c.notification_email, c.email), rc.name
    INTO v_supervisor_email, v_client_name
    FROM public.rnc_clients rc
    LEFT JOIN public.rnc_contatos c ON c.id = rc.supervisor_contato_id AND c.is_active
   WHERE rc.id = NEW.client_id;

  v_payload := jsonb_build_object(
    'rnc_id',     NEW.id,
    'rnc_number', NEW.rnc_number,
    'client_id',  NEW.client_id,
    'client_name', v_client_name,
    'opened_at',  NEW.created_at
  );

  -- 1) Requester (always)
  IF NEW.email IS NOT NULL THEN
    INSERT INTO public.notification_outbox
      (kind, recipient_email, payload, created_at)
    VALUES
      ('rnc_opened', NEW.email, v_payload || jsonb_build_object('role', 'responsavel'), now());
  END IF;

  -- 2) Supervisor (if exists and active)
  IF v_supervisor_email IS NOT NULL AND v_supervisor_email IS DISTINCT FROM NEW.email THEN
    INSERT INTO public.notification_outbox
      (kind, recipient_email, payload, created_at)
    VALUES
      ('rnc_opened', v_supervisor_email, v_payload || jsonb_build_object('role', 'supervisor'), now());
  END IF;

  RETURN NEW;
END $$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_rnc_insert_notify ON public.rnc_records;

CREATE TRIGGER on_rnc_insert_notify
  AFTER INSERT ON public.rnc_records
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_rnc_notifications();
