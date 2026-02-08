import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) { console.error('Missing env vars'); process.exit(1) }

const supabase = createClient(url, key)

async function clean() {
  console.log('Limpiando todos los datos financieros...')

  const { error: e1 } = await supabase.from('movimientos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  console.log('  movimientos:', e1 ? e1.message : 'borrados')

  const { error: e2 } = await supabase.from('import_batches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  console.log('  import_batches:', e2 ? e2.message : 'borrados')

  const { error: e3 } = await supabase.from('eventos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  console.log('  eventos:', e3 ? e3.message : 'borrados')

  const { count: m } = await supabase.from('movimientos').select('*', { count: 'exact', head: true })
  const { count: e } = await supabase.from('eventos').select('*', { count: 'exact', head: true })
  const { count: b } = await supabase.from('import_batches').select('*', { count: 'exact', head: true })
  console.log('\nEstado final:')
  console.log('  movimientos:', m)
  console.log('  eventos:', e)
  console.log('  import_batches:', b)
  console.log('\nBase de datos financiera en 0.')
}

clean()
