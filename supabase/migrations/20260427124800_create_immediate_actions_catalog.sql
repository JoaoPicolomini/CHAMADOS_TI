-- Create table for predefined immediate actions
CREATE TABLE IF NOT EXISTS rnc_immediate_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rnc_immediate_actions ENABLE ROW LEVEL SECURITY;

-- Allow all for now (matching existing catalog pattern or adjusting if needed)
-- Note: Usually catalogs are read-only for public and manageable by staff
CREATE POLICY "Allow public read-only access" ON rnc_immediate_actions
    FOR SELECT USING (is_active = true);

CREATE POLICY "Allow authenticated full access" ON rnc_immediate_actions
    FOR ALL TO authenticated USING (true);
