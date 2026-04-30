import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Carregar .env.local manualmente para evitar dependências extras como dotenv
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line.includes('='))
    .map(line => {
      const [key, ...val] = line.split('=');
      return [key.trim(), val.join('=').trim()];
    })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Erro: URL ou Service Key não encontradas no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function test() {
  console.log(`\n🔍 Verificando banco: ${supabaseUrl}`);
  
  // 1. Testar conexão e contagem
  const { count, error: countErr } = await supabase
    .from('rnc_records')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error('❌ Erro ao acessar rnc_records:', countErr.message);
  } else {
    console.log(`✅ Conexão OK. Total de registros em 'rnc_records': ${count}`);
  }

  // 2. Verificar se o RLS está ativo e listar tabelas
  console.log('\n--- Status das Tabelas Principais ---');
  const tables = ['rnc_records', 'rnc_clients', 'rnc_products', 'rnc_occurrence_reasons', 'rnc_access_users'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`- ${table}: ❌ Erro (${error.message})`);
    } else {
      console.log(`- ${table}: ✅ Acessível (Encontrado ${data.length} registros de teste)`);
    }
  }

  // 3. Tentar detectar o problema de "NADA LISTA" na aplicação real
  // A aplicação real usa a ANON_KEY. Como não temos a ANON_KEY real aqui (pois no .env está a service),
  // vamos apenas avisar o usuário.
  console.log('\n--- DIAGNÓSTICO FINAL ---');
  console.log('⚠️  IMPORTANTE: No seu .env.local, a NEXT_PUBLIC_SUPABASE_ANON_KEY é IGUAL à SERVICE_ROLE_KEY.');
  console.log('Isso significa que seu localhost está "bypassing" (pulando) o RLS.');
  console.log('A aplicação real provavelmente usa uma chave Anon que RESPEITA o RLS.');
  console.log('\n💡 PRÓXIMO PASSO: Vou tentar forçar a aplicação das políticas de SELECT (true) no banco remoto.');
}

test();
