import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
    // 1. Get IDs
    const { data: cats } = await supabase.from('categorias_financieras').select('id, nombre').ilike('nombre', '%Aportes Internos%')
    const { data: events } = await supabase.from('eventos').select('id, nombre').ilike('nombre', '%MINU%')

    const catId = cats?.[0]?.id
    const eventId = events?.[0]?.id

    if (!catId || !eventId) {
        console.log('Missing category or event')
        return
    }

    console.log(`Cat ID: ${catId} (${cats[0].nombre})`)
    console.log(`Event ID: ${eventId} (${events[0].nombre})`)

    // 2. Count "Aportes Internos" (ANY event)
    const countCat = await supabase
        .from('movimientos')
        .select('*', { count: 'exact', head: true })
        .eq('categoria_id', catId)

    console.log(`\nMovements with Category "Aportes Internos" (Total): ${countCat.count}`)

    // 3. Count "MINU" (ANY category)
    const countEvent = await supabase
        .from('movimientos')
        .select('*', { count: 'exact', head: true })
        .eq('evento_id', eventId)

    console.log(`Movements with Event "MINU" (Total): ${countEvent.count}`)

    // 4. Sample "Aportes Internos" to see their events
    const sampleCat = await supabase
        .from('movimientos')
        .select('id, descripcion, evento_id, fecha')
        .eq('categoria_id', catId)
        .limit(5)

    console.log('\n--- Sample "Aportes Internos" Movements ---')
    console.table(sampleCat.data)

    // 5. Sample "MINU" to see their categories
    const sampleEvent = await supabase
        .from('movimientos')
        .select('id, descripcion, categoria_id, fecha')
        .eq('evento_id', eventId)
        .limit(5)

    console.log('\n--- Sample "MINU" Movements ---')
    console.table(sampleEvent.data)
}

main().catch(console.error)
