import { createRequire } from 'module'
const require = createRequire(import.meta.url)
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load env like in import-xlsx.ts
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env.local') })
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  console.log('--- Analyzing Categories ---')

  // 1. Get all movements and aggregate in memory (simpler than SQL group by for now if views are complex)
  const { data: movs, error } = await supabase
    .from('movimientos')
    .select('monto, tipo, descripcion, fecha, categorias_financieras(nombre)')
  
  if (error) {
    console.error('Error fetching movements:', error)
    return
  }

  const catTotals: Record<string, number> = {}
  const vasoMovs: any[] = []

  movs.forEach(m => {
    // @ts-ignore
    const catName = m.categorias_financieras?.nombre || 'Sin Categoría'
    if (!catTotals[catName]) catTotals[catName] = 0
    catTotals[catName] += m.monto

    if (catName.toLowerCase().includes('vasos')) {
      vasoMovs.push(m)
    }
  })

  // Sort and print top categories
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
  
  console.log('\nTop Categories by Total Amount:')
  sorted.slice(0, 20).forEach(([name, total]) => {
    console.log(`  ${name}: $${total.toLocaleString('es-AR')}`)
  })

  console.log('\n--- Details for "Vasos" ---')
  console.log(`Found ${vasoMovs.length} movements for Vasos`)
  // Sort by amount desc
  vasoMovs.sort((a, b) => b.monto - a.monto)
  
  if (vasoMovs.length > 0) {
    console.log('Top 10 Vasos movements:')
    vasoMovs.slice(0, 10).forEach(m => {
        console.log(`  ${m.fecha} | $${m.monto} | ${m.tipo} | ${m.descripcion}`)
    })
  }
}

main().catch(console.error)
