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

async function check() {
  console.log('--- Verificação de Dados Remotos ---');
  
  // 1. Verificar Registros
  const { data: records, error: rErr } = await supabase.from('rnc_records').select('id, rnc_number, created_at').limit(5);
  if (rErr) console.error('Erro RNCs:', rErr.message);
  else console.log(`Encontradas ${records.length} RNCs de exemplo. banco possui dados.`);

  // 2. Verificar Usuários na Whitelist
  const { data: users, error: uErr } = await supabase.from('rnc_access_users').select('*');
  if (uErr) console.error('Erro Usuários:', uErr.message);
  else {
    console.log(`Whitelist possui ${users.length} usuários:`);
    users.forEach(u => console.log(`- ${u.email} (${u.role}) [${u.is_active ? 'Ativo' : 'Inativo'}]`));
  }

  // 3. Verificar se existe a tabela de permissões e perfis
  const { data: perms } = await supabase.from('rnc_permissions').select('count', { count: 'exact', head: true });
  console.log(`Tabela rnc_permissions: ${perms ? 'Existe' : 'Não existe ou Vazia'}`);
}

check();
