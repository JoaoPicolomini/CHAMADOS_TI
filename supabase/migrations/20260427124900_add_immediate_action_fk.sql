-- Add immediate_action_id to rnc_records
ALTER TABLE rnc_records ADD COLUMN IF NOT EXISTS immediate_action_id UUID REFERENCES rnc_immediate_actions(id);
