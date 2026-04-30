-- Add new fields for "Ação de Correção" (formerly Ação Imediata) stage
ALTER TABLE rnc_records
ADD COLUMN IF NOT EXISTS immediate_action_responsible text,
ADD COLUMN IF NOT EXISTS immediate_action_deadline date,
ADD COLUMN IF NOT EXISTS immediate_action_scope text;

-- Update SLA configs if needed (optional, just ensuring consistency)
-- The stage name in rnc_sla_configs is still 'acao_imediata' internally, which is fine.
