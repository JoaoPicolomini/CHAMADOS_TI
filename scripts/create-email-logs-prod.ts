import fs from 'fs'
import path from 'path'

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    content.split('\n').forEach(line => {
      const [key, ...value] = line.split('=')
      if (key && value) process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '')
    })
  }
}
loadEnv()

const PROJECT_ID = 'uqqidptqihidpizxovre'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

const SQL = `
CREATE TABLE IF NOT EXISTS rnc_email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rnc_id UUID REFERENCES rnc_records(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rnc_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "authenticated_read" ON rnc_email_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "service_insert" ON rnc_email_logs
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_rnc_email_logs_rnc_id ON rnc_email_logs(rnc_id);
CREATE INDEX IF NOT EXISTS idx_rnc_email_logs_created_at ON rnc_email_logs(created_at DESC);
`

async function runSql(sql: string) {
  const url = `${SUPABASE_URL}/rest/v1/`
  
  // Usar pg endpoint direto da API do Supabase
  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_MANAGEMENT_TOKEN || SERVICE_KEY}`
    },
    body: JSON.stringify({ query: sql })
  })

  if (!resp.ok) {
    const err = await resp.text()
    return { success: false, error: err }
  }

  const result = await resp.json()
  return { success: true, result }
}

async function main() {
  console.log('🏗️ Criando tabela rnc_email_logs em produção via Management API...\n')
  
  const { success, error, result } = await runSql(SQL)
  
  if (!success) {
    console.log('❌ Falhou:', error)
    console.log('\n📋 Execute manualmente no SQL Editor do Supabase:')
    console.log('https://supabase.com/dashboard/project/' + PROJECT_ID + '/sql/new')
    console.log('\n' + SQL)
  } else {
    console.log('✅ Tabela criada com sucesso!\n', result)
  }
}

main()
