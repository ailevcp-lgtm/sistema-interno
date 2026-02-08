import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

console.error('STARTING DEBUG SCRIPT')
console.error('CWD:', process.cwd())

// Try to load env from current directory
const envPath = path.resolve(process.cwd(), '.env.local')
console.error('Loading env from:', envPath)
dotenv.config({ path: envPath })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!URL || !KEY) {
    console.error('ERROR: Missing Credentials')
    console.error('URL:', URL)
    console.error('KEY Present:', !!KEY)
    process.exit(1)
}

const supabase = createClient(URL, KEY)

async function main() {
    console.error('Querying Supabase...')
    const { data: movs, error } = await supabase
        .from('movimientos')
        .select('monto, tipo, descripcion, fecha, categorias_financieras(nombre)')
    
    if (error) {
        console.error('Supabase Error:', error)
        return
    }

    console.error(`Fetched ${movs.length} rows`)

    const catTotals: Record<string, number> = {}
    const vasosMovs: any[] = []

    movs.forEach(m => {
        // @ts-ignore
        const catName = m.categorias_financieras?.nombre || 'Sin Categoría'
        const amt = Number(m.monto)
        if (!catTotals[catName]) catTotals[catName] = 0
        catTotals[catName] += amt

        if (catName.toLowerCase().includes('vasos')) {
            vasosMovs.push(m)
        }
    })

    const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
    console.log('TOP CATEGORIES:')
    sorted.slice(0, 15).forEach(([name, total]) => {
        console.log(`  ${name}: $${total.toLocaleString('es-AR')}`)
    })

    console.log('\nVASOS MOVEMENTS (Top 10):')
    vasosMovs.sort((a, b) => b.monto - a.monto)
    vasosMovs.slice(0, 10).forEach(m => {
        console.log(`  ${m.fecha}: $${m.monto} (${m.tipo}) - ${m.descripcion}`)
    })

}

main().catch(err => console.error('FATAL:', err))
