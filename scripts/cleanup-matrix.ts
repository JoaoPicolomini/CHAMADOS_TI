import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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

const supabase = createClient(supabaseUrl, serviceKey)

async function cleanupGhostPermissions() {
  console.log('🧹 Limpando permissões fantasmas (não fixadas no Frontend)...')

  const validIds = [
    'dashboard.view',
    'rnc.manage',
    'analytics.view',
    'catalog.view',
    'audit.view',
    'users.manage',
    'matrix.manage',
    'email.logs.view'
  ]

  // Deleta tudo que não pertence a validIds
  const { data, error } = await supabase
    .from('rnc_permissions')
    .delete()
    .not('id', 'in', `(${validIds.join(',')})`)
    .select()

  if (error) {
    console.error('❌ Erro ao deletar permissões fantasmas:', error)
  } else {
    console.log(`✅ ${data?.length || 0} Permissões Fantasmas Removidas.`)
  }

  console.log('✅ A Matriz de Acessos agora contêm apenas permissões válidas.')
}

cleanupGhostPermissions()
