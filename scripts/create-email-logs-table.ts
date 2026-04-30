import { createClient } from '@supabase/supabase-js'
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const SQL = `
-- Criar tabela de logs de e-mail
CREATE TABLE IF NOT EXISTS rnc_email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rnc_id UUID REFERENCES rnc_records(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE rnc_email_logs ENABLE ROW LEVEL SECURITY;

-- Permitir leitura para usuários autenticados
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rnc_email_logs' AND policyname = 'authenticated_read'
  ) THEN
    CREATE POLICY "authenticated_read" ON rnc_email_logs
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Permitir inserção para service role (já está implícito, mas vamos garantir)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rnc_email_logs' AND policyname = 'service_insert'
  ) THEN
    CREATE POLICY "service_insert" ON rnc_email_logs
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_rnc_email_logs_rnc_id ON rnc_email_logs(rnc_id);
CREATE INDEX IF NOT EXISTS idx_rnc_email_logs_created_at ON rnc_email_logs(created_at DESC);
`

async function main() {
  console.log('🏗️ Criando tabela rnc_email_logs em produção...')

  // Usar REST API diretamente com service role para executar DDL
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_ddl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY as string
    },
    body: JSON.stringify({ ddl: SQL })
  })

  if (!response.ok) {
    // Método alternativo: usar a Management API via SQL direto
    console.log('ℹ️ RPC exec_ddl não disponível. Tentando via Supabase SQL...')
    
    // Testar se a tabela já existe com service role
    const { data, error } = await supabase.from('rnc_email_logs').select('id').limit(1)
    
    if (!error) {
      console.log('✅ Tabela já existe e está acessível!')
      return
    }

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ A tabela rnc_email_logs não existe em produção.

Por favor, execute o SQL abaixo no Supabase DB Editor:
https://supabase.com/dashboard/project/uqqidptqihidpizxovre/sql

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${SQL}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `)
  } else {
    console.log('✅ Operação DDL executada.')
  }
}

main()
