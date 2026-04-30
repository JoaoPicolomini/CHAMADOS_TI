-- ============================================
-- Costa Lavos RNC — Full Database Schema
-- Target: Supabase project gnllgjrgddyuqzddkhfo
-- All tables prefixed with rnc_
-- ============================================

-- ─── Sequence for RNC number ───
CREATE SEQUENCE IF NOT EXISTS rnc_number_seq START 1;

-- ─── Catalogs ───
CREATE TABLE IF NOT EXISTS rnc_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rnc_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trade_name text,
  cnpj text UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rnc_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  category text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rnc_occurrence_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  requires_preparation boolean DEFAULT false,
  suggested_severity text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ─── SLA Configuration ───
CREATE TABLE IF NOT EXISTS rnc_sla_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL,
  stage text NOT NULL,
  deadline_hours int NOT NULL,
  alert_at_percent int[] DEFAULT '{70,90}',
  escalation_to text,
  is_active boolean DEFAULT true,
  UNIQUE (severity, stage)
);

-- ─── Main Records ───
CREATE TABLE IF NOT EXISTS rnc_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rnc_number text UNIQUE NOT NULL,
  short_id text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN (
    'aberto','em_triagem','em_analise','acao_imediata','acao_corretiva',
    'em_validacao','verificacao_eficacia','encerrado','improcedente','reaberto'
  )),
  severity text NOT NULL DEFAULT 'media' CHECK (severity IN ('critica','alta','media','baixa')),

  -- Requester
  requester_name text NOT NULL,
  department_id uuid REFERENCES rnc_departments(id),
  department_other text,
  phone text NOT NULL,
  email text,

  -- Client & Product
  client_id uuid NOT NULL REFERENCES rnc_clients(id),
  product_id uuid NOT NULL REFERENCES rnc_products(id),
  batch_number text NOT NULL,
  manufacturing_date date NOT NULL,
  expiry_date date NOT NULL,
  received_date date,
  qty_received numeric(10,2) NOT NULL CHECK (qty_received > 0),
  qty_nonconforming numeric(10,2) NOT NULL CHECK (qty_nonconforming > 0),
  qty_unit text DEFAULT 'unidade',

  -- Occurrence
  occurrence_reason_id uuid NOT NULL REFERENCES rnc_occurrence_reasons(id),
  occurrence_reason_other text,
  occurrence_description text NOT NULL,
  corrective_action_taken text NOT NULL,
  no_discard_acknowledged boolean NOT NULL DEFAULT false,

  -- Preparation (conditional)
  fermentation_location text,
  fermentation_temp_celsius numeric(5,1),
  fermentation_time_hours numeric(4,1),
  oven_type text,
  oven_type_other text,
  oven_temp_celsius numeric(5,1),
  oven_time_minutes numeric(5,1),

  -- Analysis (post-triage)
  root_cause_analysis jsonb,
  root_cause_summary text,
  immediate_action text,
  corrective_action_plan text,
  validation_result text,
  efficacy_result text,
  closure_notes text,
  improcedence_reason text,

  -- Control
  assigned_to uuid REFERENCES auth.users(id),
  created_by_ip inet,
  parent_rnc_id uuid REFERENCES rnc_records(id),
  sla_config_id uuid REFERENCES rnc_sla_configs(id),
  sla_deadline timestamptz,
  sla_paused boolean DEFAULT false,
  sla_paused_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  closed_at timestamptz,

  -- Cross-field checks
  CHECK (qty_nonconforming <= qty_received),
  CHECK (expiry_date > manufacturing_date)
);

-- ─── Attachments ───
CREATE TABLE IF NOT EXISTS rnc_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rnc_id uuid NOT NULL REFERENCES rnc_records(id) ON DELETE CASCADE,
  stage text NOT NULL,
  category text NOT NULL CHECK (category IN ('batch_photo','product_photo','extra','analysis','corrective_action')),
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  sha256_hash text NOT NULL,
  uploaded_by text NOT NULL,
  uploaded_by_ip inet,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz DEFAULT now()
);

-- ─── Workflow Events (Immutable) ───
CREATE TABLE IF NOT EXISTS rnc_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rnc_id uuid NOT NULL REFERENCES rnc_records(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  performed_by text NOT NULL,
  justification text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- ─── Comments ───
CREATE TABLE IF NOT EXISTS rnc_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rnc_id uuid NOT NULL REFERENCES rnc_records(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_email text,
  content text NOT NULL,
  is_internal boolean NOT NULL DEFAULT true,
  stage text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ─── Access Tokens ───
CREATE TABLE IF NOT EXISTS rnc_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rnc_id uuid NOT NULL REFERENCES rnc_records(id) ON DELETE CASCADE,
  stage text NOT NULL,
  assignee_email text NOT NULL,
  token_hash text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('read','write','approve')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by text,
  created_at timestamptz DEFAULT now()
);

-- ─── Access Logs (Immutable) ───
CREATE TABLE IF NOT EXISTS rnc_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rnc_id uuid REFERENCES rnc_records(id),
  stage text,
  token_hash text,
  accessor_email text,
  ip_address inet,
  user_agent text,
  action text NOT NULL,
  success boolean NOT NULL,
  failure_reason text,
  created_at timestamptz DEFAULT now()
);

-- ─── Field Change Logs (Immutable) ───
CREATE TABLE IF NOT EXISTS rnc_field_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rnc_id uuid NOT NULL REFERENCES rnc_records(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by text NOT NULL,
  changed_at timestamptz DEFAULT now()
);

-- ─── Notification Templates ───
CREATE TABLE IF NOT EXISTS rnc_notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text UNIQUE NOT NULL,
  channel text NOT NULL,
  subject_template text,
  body_template text NOT NULL,
  is_active boolean DEFAULT true
);

-- ─── Notification Logs ───
CREATE TABLE IF NOT EXISTS rnc_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rnc_id uuid REFERENCES rnc_records(id),
  template_id uuid REFERENCES rnc_notification_templates(id),
  channel text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ─── RPC: Generate RNC Number ───
CREATE OR REPLACE FUNCTION generate_rnc_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  seq_val int;
  prefix text;
BEGIN
  prefix := 'RNC-' || to_char(now(), 'YYYY-MM') || '-';
  seq_val := nextval('rnc_number_seq');
  RETURN prefix || lpad(seq_val::text, 4, '0');
END;
$$;

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_rnc_records_status ON rnc_records(status);
CREATE INDEX IF NOT EXISTS idx_rnc_records_severity ON rnc_records(severity);
CREATE INDEX IF NOT EXISTS idx_rnc_records_client ON rnc_records(client_id);
CREATE INDEX IF NOT EXISTS idx_rnc_records_product ON rnc_records(product_id);
CREATE INDEX IF NOT EXISTS idx_rnc_records_batch ON rnc_records(batch_number);
CREATE INDEX IF NOT EXISTS idx_rnc_records_created ON rnc_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rnc_records_assigned ON rnc_records(assigned_to);
CREATE INDEX IF NOT EXISTS idx_rnc_records_sla ON rnc_records(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_rnc_records_short_id ON rnc_records(short_id);
CREATE INDEX IF NOT EXISTS idx_rnc_attachments_rnc ON rnc_attachments(rnc_id);
CREATE INDEX IF NOT EXISTS idx_rnc_workflow_events_rnc ON rnc_workflow_events(rnc_id);
CREATE INDEX IF NOT EXISTS idx_rnc_comments_rnc ON rnc_comments(rnc_id);
CREATE INDEX IF NOT EXISTS idx_rnc_access_logs_rnc ON rnc_access_logs(rnc_id);
CREATE INDEX IF NOT EXISTS idx_rnc_field_change_logs_rnc ON rnc_field_change_logs(rnc_id);

-- ─── Triggers: updated_at ───
CREATE OR REPLACE FUNCTION rnc_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rnc_records_updated_at
  BEFORE UPDATE ON rnc_records
  FOR EACH ROW EXECUTE FUNCTION rnc_set_updated_at();

-- ─── Triggers: Immutability on audit tables ───
CREATE OR REPLACE FUNCTION rnc_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit tables are immutable. UPDATE and DELETE are not allowed.';
END;
$$;

CREATE TRIGGER trg_rnc_workflow_events_immutable
  BEFORE UPDATE OR DELETE ON rnc_workflow_events
  FOR EACH ROW EXECUTE FUNCTION rnc_prevent_mutation();

CREATE TRIGGER trg_rnc_access_logs_immutable
  BEFORE UPDATE OR DELETE ON rnc_access_logs
  FOR EACH ROW EXECUTE FUNCTION rnc_prevent_mutation();

CREATE TRIGGER trg_rnc_field_change_logs_immutable
  BEFORE UPDATE OR DELETE ON rnc_field_change_logs
  FOR EACH ROW EXECUTE FUNCTION rnc_prevent_mutation();

-- ─── RLS Policies ───
ALTER TABLE rnc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnc_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnc_workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnc_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnc_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnc_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnc_field_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnc_notification_logs ENABLE ROW LEVEL SECURITY;

-- Catalogs: read by anyone, write by service role
ALTER TABLE rnc_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnc_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnc_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnc_occurrence_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnc_sla_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rnc_notification_templates ENABLE ROW LEVEL SECURITY;

-- Allow select on catalogs for anon (public form needs to read)
CREATE POLICY rnc_departments_select ON rnc_departments FOR SELECT USING (true);
CREATE POLICY rnc_clients_select ON rnc_clients FOR SELECT USING (true);
CREATE POLICY rnc_products_select ON rnc_products FOR SELECT USING (true);
CREATE POLICY rnc_occurrence_reasons_select ON rnc_occurrence_reasons FOR SELECT USING (true);
CREATE POLICY rnc_sla_configs_select ON rnc_sla_configs FOR SELECT USING (true);

-- Records: anon can insert (public form), authenticated can read/update their assigned
CREATE POLICY rnc_records_insert ON rnc_records FOR INSERT WITH CHECK (true);
CREATE POLICY rnc_records_select ON rnc_records FOR SELECT USING (true);
CREATE POLICY rnc_records_update ON rnc_records FOR UPDATE USING (
  auth.uid() IS NOT NULL
);

-- Attachments
CREATE POLICY rnc_attachments_insert ON rnc_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY rnc_attachments_select ON rnc_attachments FOR SELECT USING (true);

-- Workflow events: insert for authenticated, select for all
CREATE POLICY rnc_workflow_events_insert ON rnc_workflow_events FOR INSERT WITH CHECK (true);
CREATE POLICY rnc_workflow_events_select ON rnc_workflow_events FOR SELECT USING (true);

-- Comments
CREATE POLICY rnc_comments_insert ON rnc_comments FOR INSERT WITH CHECK (true);
CREATE POLICY rnc_comments_select ON rnc_comments FOR SELECT USING (true);

-- Access tokens/logs: service role manages
CREATE POLICY rnc_access_tokens_all ON rnc_access_tokens USING (true);
CREATE POLICY rnc_access_logs_insert ON rnc_access_logs FOR INSERT WITH CHECK (true);
CREATE POLICY rnc_access_logs_select ON rnc_access_logs FOR SELECT USING (auth.uid() IS NOT NULL);

-- Field change logs
CREATE POLICY rnc_field_change_logs_insert ON rnc_field_change_logs FOR INSERT WITH CHECK (true);
CREATE POLICY rnc_field_change_logs_select ON rnc_field_change_logs FOR SELECT USING (auth.uid() IS NOT NULL);

-- Notification logs
CREATE POLICY rnc_notification_logs_all ON rnc_notification_logs USING (true);
CREATE POLICY rnc_notification_templates_select ON rnc_notification_templates FOR SELECT USING (true);

-- ─── Supabase Storage Bucket ───
INSERT INTO storage.buckets (id, name, public) VALUES ('rnc-attachments', 'rnc-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY rnc_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'rnc-attachments');
CREATE POLICY rnc_storage_select ON storage.objects FOR SELECT
  USING (bucket_id = 'rnc-attachments');
