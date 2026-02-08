import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  console.log('Searching for category Vasos...')
  
  // 1. List all categories approx matching
  const { data: cats, error: errCat } = await supabase
    .from('categorias_financieras')
    .select('id, nombre, tipo')
    .ilike('nombre', '%vasos%')

  if (errCat) {
    console.error('Error fetching categories:', errCat)
    return
  }

  if (!cats || cats.length === 0) {
    console.log('No category found matching "vasos"')
    // List all just in case
    const { data: all } = await supabase.from('categorias_financieras').select('nombre').limit(10)
    console.log('Sample categories:', all)
    return
  }

  console.log('Found categories:', cats)

  for (const cat of cats) {
    console.log(`\nChecking movements for category: ${cat.nombre} (${cat.tipo})`)
    const { data: movs, error: errMov } = await supabase
      .from('movimientos')
      .select('fecha, descripcion, monto, tipo')
      .eq('categoria_id', cat.id)
      .order('monto', { ascending: false })
      .limit(20)

    if (errMov) {
      console.error('Error fetching movements:', errMov)
      continue
    }

    console.table(movs)
  }
}

main().catch(console.error)
