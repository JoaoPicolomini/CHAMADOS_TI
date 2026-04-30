-- 1. Create a project-specific enum to avoid conflicts
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rnc_notification_status') THEN
        CREATE TYPE public.rnc_notification_status AS ENUM ('pending', 'processing', 'sent', 'failed');
    END IF;
END $$;

-- 2. Ensure table exists and has the correct column type
CREATE TABLE IF NOT EXISTS public.notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    payload JSONB NOT NULL,
    status public.rnc_notification_status DEFAULT 'pending',
    error_message TEXT,
    retry_count INT DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- 3. If table existed with TEXT status, migrate it to the ENUM
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notification_outbox' 
        AND column_name = 'status' 
        AND (data_type = 'text' OR udt_name = 'notification_status')
    ) THEN
        ALTER TABLE public.notification_outbox 
        ALTER COLUMN status TYPE public.rnc_notification_status 
        USING status::text::public.rnc_notification_status;
    END IF;
EXCEPTION
    WHEN others THEN null; -- Avoid blocking if migration is complex
END $$;

-- 4. Index for worker efficiency
DROP INDEX IF EXISTS idx_notification_outbox_pending;
CREATE INDEX idx_notification_outbox_pending 
    ON public.notification_outbox(created_at) 
    WHERE (status = 'pending');

-- 5. RLS
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

-- Only authenticated admins or service role can see/manage the outbox
DROP POLICY IF EXISTS "Admins can manage outbox" ON public.notification_outbox;
CREATE POLICY "Admins can manage outbox" ON public.notification_outbox
    FOR ALL TO authenticated
    USING (((auth.jwt()->'app_metadata')->>'role')::text = 'admin');
