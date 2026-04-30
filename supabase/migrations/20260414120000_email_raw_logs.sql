-- ─── Transitory Email Logs ───
-- This table stores ALL incoming emails fetched by n8n before filtering for RNCs.

CREATE TABLE IF NOT EXISTS rnc_email_raw_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  sender text NOT NULL,
  subject text NOT NULL,
  body_text text,
  received_at timestamptz,
  rnc_number_detected text,
  processed_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE rnc_email_raw_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role access (for n8n)
-- Since we are using the service role key in n8n, it bypasses RLS,
-- but we define policies for visibility in the dashboard.
CREATE POLICY rnc_email_raw_logs_select ON rnc_email_raw_logs FOR SELECT USING (true);
CREATE POLICY rnc_email_raw_logs_insert ON rnc_email_raw_logs FOR INSERT WITH CHECK (true);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_rnc_email_raw_logs_msgid ON rnc_email_raw_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_rnc_email_raw_logs_received ON rnc_email_raw_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_rnc_email_raw_logs_rnc ON rnc_email_raw_logs(rnc_number_detected);
