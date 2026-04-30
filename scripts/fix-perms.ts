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

async function fixPermissions() {
  console.log('🛠️ Corrigindo permissões de Admin...')

  // 1. Pegar todos os IDs de permissão
  const { data: perms } = await supabase.from('rnc_permissions').select('id')
  if (!perms) return

  // 2. Vincular todas ao perfil 'admin' (ou 'qualidade_adm', etc)
  const profileId = 'admin' // Alinhado com o que costuma ser usado
  
  const mapping = perms.map(p => ({
    profile_id: profileId,
    permission_id: p.id
  }))

  const { error } = await supabase
    .from('rnc_profile_permissions')
    .upsert(mapping)

  if (error) {
    console.error('❌ Erro ao vincular permissões:', error)
  } else {
    console.log(`✅ ${mapping.length} permissões vinculadas ao perfil: ${profileId}`)
  }

  // Tentar também para 'qualidade' que é comum nesse projeto
  const qMapping = perms.map(p => ({
    profile_id: 'qualidade',
    permission_id: p.id
  }))
  await supabase.from('rnc_profile_permissions').upsert(qMapping)
}

fixPermissions()
