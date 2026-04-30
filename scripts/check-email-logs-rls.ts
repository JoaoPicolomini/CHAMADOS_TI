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

async function main() {
  console.log('🔍 Verificando tabela rnc_email_logs...')

  // Tentar fazer um SELECT simples como serviço para validar que existe
  const { data, error, count } = await supabase
    .from('rnc_email_logs')
    .select('*', { count: 'exact' })
    .limit(3)

  if (error) {
    console.error('❌ Erro ao acessar rnc_email_logs:', error.message)
  } else {
    console.log(`✅ Tabela existe! Total de registros: ${count}`)
    console.log('Primeiros registros:', data?.slice(0, 2))
  }

  // Verificar/criar políticas RLS para que o browser possa ler
  // A tabela precisa de uma policy SELECT para usuários autenticados
  const { error: policyError } = await supabase.rpc('exec_sql' as any, {
    sql: `
      DO $$ BEGIN
        -- Checar se RLS está habilitado (provavelmente já está)
        ALTER TABLE rnc_email_logs ENABLE ROW LEVEL SECURITY;
        
        -- Criar policy se não existir
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename='rnc_email_logs' AND policyname='Admins can read email logs'
        ) THEN
          CREATE POLICY "Admins can read email logs"
          ON rnc_email_logs FOR SELECT
          USING (true);
          RAISE NOTICE 'Policy criada.';
        ELSE
          RAISE NOTICE 'Policy já existia.';
        END IF;
      END $$;
    `
  })

  if (policyError) {
    // exec_sql pode não existir; tentar via SQL direto
    console.log('ℹ️ RPC não disponível, a tabela pode ter RLS sem policy de leitura.')
    console.log('Solução: Execute no SQL Editor do Supabase:')
    console.log(`
ALTER TABLE rnc_email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read" ON rnc_email_logs
  FOR SELECT USING (auth.role() = 'authenticated');
    `)
  } else {
    console.log('✅ Políticas RLS verificadas.')
  }
}

main()
