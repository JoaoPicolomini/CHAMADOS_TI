-- Add new fields for "Ação Corretiva" stage
ALTER TABLE rnc_records
ADD COLUMN IF NOT EXISTS corrective_action_responsible text,
ADD COLUMN IF NOT EXISTS corrective_action_deadline date,
ADD COLUMN IF NOT EXISTS corrective_action_scope text;
