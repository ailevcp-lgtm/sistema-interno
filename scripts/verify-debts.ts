
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load env from project root
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env.local') })
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
    console.log('Verifying Debts Import...')

    // Count total quotas
    const { count, error } = await supabase
        .from('cuotas')
        .select('*', { count: 'exact', head: true })

    if (error) {
        console.error('Error counting quotas:', error)
        return
    }

    console.log(`Total quotas in DB: ${count}`)

    // Get summary by status for 2026-01 and 2026-02
    const periods = ['2026-01', '2026-02']

    for (const p of periods) {
        const { data: summary, error } = await supabase
            .from('cuotas')
            .select('estado')
            .eq('periodo', p)

        if (summary) {
            const counts = summary.reduce((acc: any, curr) => {
                acc[curr.estado] = (acc[curr.estado] || 0) + 1
                return acc
            }, {})
            console.log(`\nPeriodo ${p}:`)
            console.log(JSON.stringify(counts, null, 2))
        }
    }

    // Check specific socio: "Alina Parra Arribas"
    console.log('\nChecking Alina Parra Arribas...')
    const { data: alina } = await supabase
        .from('socios')
        .select('id, nombre, apellido')
        .ilike('nombre', '%Alina%')
        .single()

    if (alina) {
        const { data: cuotas } = await supabase
            .from('cuotas')
            .select('*')
            .eq('socio_id', alina.id)
        console.log(cuotas)
    } else {
        console.log('Alina not found in DB')
    }
}

main().catch(console.error)
