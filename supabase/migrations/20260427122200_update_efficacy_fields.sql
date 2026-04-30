-- Add new fields for "Verificação de Eficácia" stage
ALTER TABLE rnc_records
ADD COLUMN IF NOT EXISTS efficacy_responsible text,
ADD COLUMN IF NOT EXISTS efficacy_deadline date;
