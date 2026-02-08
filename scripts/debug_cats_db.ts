import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
    const { data: cats } = await supabase
        .from('categorias_financieras')
        .select('*')
        .order('nombre')

    console.log('--- Categories in DB ---')
    cats?.forEach(c => {
        console.log(\`[\${c.id}] "\${c.nombre}" (\${c.tipo})\`)
  })
}

main().catch(console.error)
