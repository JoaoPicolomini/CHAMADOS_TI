import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line.includes('='))
    .map(line => {
      const [key, ...val] = line.split('=');
      return [key.trim(), val.join('=').trim().replace(/^["']|["']$/g, '')];
    })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function fix() {
  console.log('🛠️ Tentando habilitar POLICIES de SELECT (público) no banco remoto...');
  
  const sql = `
    -- Liberar leitura para todos nas tabelas principais
    DROP POLICY IF EXISTS rnc_records_select ON rnc_records;
    CREATE POLICY rnc_records_select ON rnc_records FOR SELECT USING (true);

    DROP POLICY IF EXISTS rnc_clients_select ON rnc_clients;
    CREATE POLICY rnc_clients_select ON rnc_clients FOR SELECT USING (true);

    DROP POLICY IF EXISTS rnc_products_select ON rnc_products;
    CREATE POLICY rnc_products_select ON rnc_products FOR SELECT USING (true);

    DROP POLICY IF EXISTS rnc_occurrence_reasons_select ON rnc_occurrence_reasons;
    CREATE POLICY rnc_occurrence_reasons_select ON rnc_occurrence_reasons FOR SELECT USING (true);

    DROP POLICY IF EXISTS rnc_departments_select ON rnc_departments;
    CREATE POLICY rnc_departments_select ON rnc_departments FOR SELECT USING (true);
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('❌ Falha ao executar via RPC exec_sql:', error.message);
    console.log('\n💡 O seu banco remoto não possui a função "exec_sql".');
    console.log('Por favor, COPIE e COLE o SQL abaixo no "SQL Editor" do painel do seu Supabase:\n');
    console.log(sql);
  } else {
    console.log('✅ Políticas aplicadas com sucesso via RPC!');
  }
}

fix();
