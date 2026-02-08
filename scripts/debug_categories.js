const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const dotenv = require('dotenv')

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars:', { SUPABASE_URL, SUPABASE_KEY: !!SUPABASE_KEY })
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  console.log('--- Analyzing Categories (JS) ---')

  const { data: movs, error } = await supabase
    .from('movimientos')
    .select('monto, tipo, descripcion, fecha, categorias_financieras(nombre)')
  
  if (error) {
    console.error('Error fetching movements:', error)
    return
  }

  const catTotals = {}
  const vasoMovs = []

  movs.forEach(m => {
    const catName = m.categorias_financieras?.nombre || 'Sin Categoría'
    if (!catTotals[catName]) catTotals[catName] = 0
    catTotals[catName] += m.monto

    if (catName.toLowerCase().includes('vasos')) {
      vasoMovs.push(m)
    }
  })

  // Sort and print top categories
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
  
  console.log('\nTop 20 Categories by Total Amount:')
  sorted.slice(0, 20).forEach(([name, total]) => {
    // Basic formatting
    console.log(`  ${name}: $${total.toFixed(2)}`)
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
