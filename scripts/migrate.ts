import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Função simples para carregar .env.local manual
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    content.split('\n').forEach(line => {
      const [key, ...value] = line.split('=')
      if (key && value) {
        process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '')
      }
    })
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Erro: Variáveis de ambiente não encontradas.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function migrate() {
  console.log('🚀 Iniciando migração...')

  // Tentar rodar SQL via RPC se disponível. Se não, as permissões via insert já resolvem parte do problema.
  const { error: tError } = await supabase.rpc('exec_sql', {
    sql_query: `
      CREATE TABLE IF NOT EXISTS rnc_email_logs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          rnc_id uuid REFERENCES rnc_records(id),
          recipient text NOT NULL,
          subject text NOT NULL,
          status text NOT NULL,
          error_message text,
          created_at timestamptz DEFAULT now()
      );

      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rnc_profiles' AND column_name='can_receive_assignment') THEN
          ALTER TABLE rnc_profiles ADD COLUMN can_receive_assignment boolean DEFAULT false;
          -- Default system roles that should be assignable
          UPDATE rnc_profiles SET can_receive_assignment = true WHERE id IN ('admin', 'qualidade', 'quality_manager');
        END IF;
      END $$;
    `
  })

  if (tError) {
    console.warn('⚠️ Nota: RPC exec_sql falhou (esperado se não configurado).')
  }

  // 2. Inserir permissões
  const perms = [
    { id: 'dashboard.view', module: 'Dashboard', action: 'Visualizar', description: 'Permite ver o painel principal' },
    { id: 'rnc.manage', module: 'RNC', action: 'Gerenciar', description: 'Permite gerenciar ocorrências' },
    { id: 'analytics.view', module: 'Analytics', action: 'Visualizar', description: 'Permite ver o analytics' },
    { id: 'catalog.view', module: 'Catálogos', action: 'Visualizar', description: 'Permite ver catálogos' },
    { id: 'audit.view', module: 'Auditoria', action: 'Visualizar', description: 'Permite ver auditoria' },
    { id: 'users.manage', module: 'Administração', action: 'Gerenciar Usuários', description: 'Permite criar/editar usuários' },
    { id: 'matrix.manage', module: 'Administração', action: 'Gerenciar Matriz', description: 'Permite alterar permissões' },
    { id: 'email.logs.view', module: 'Administração', action: 'Ver Logs de Email', description: 'Permite ver o histórico de e-mails' },
    { id: 'rnc.assign_global', module: 'RNC', action: 'Atribuir Global', description: 'Permite atribuir RNCs a qualquer técnico' },
    { id: 'rnc.assign_self', module: 'RNC', action: 'Assumir Autoria', description: 'Permite assumir a responsabilidade de uma RNC' }

  ]

  const { error: pError } = await supabase
    .from('rnc_permissions')
    .upsert(perms)

  if (pError) {
    console.error('❌ Erro ao inserir permissões:', pError)
  } else {
    console.log('✅ Permissões inseridas/atualizadas com sucesso.')
  }
}

migrate()
