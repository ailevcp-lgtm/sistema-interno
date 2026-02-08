import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
    // 1. Get Category ID
    const { data: cats } = await supabase
        .from('categorias_financieras')
        .select('*')
        .ilike('nombre', '%Aportes Internos%')

    console.log('--- Categories found ---')
    console.table(cats)

    const catId = cats?.[0]?.id

    // 2. Get Event ID
    const { data: events } = await supabase
        .from('eventos')
        .select('*')
        .ilike('nombre', '%MINU%')

    console.log('--- Events found ---')
    console.table(events)

    const eventId = events?.[0]?.id

    if (!catId || !eventId) {
        console.log('Could not find Category or Event')
        return
    }

    // 3. Count movements matching both
    const { count, error, data } = await supabase
        .from('movimientos')
        .select('*', { count: 'exact' })
        .eq('categoria_id', catId)
        .eq('evento_id', eventId)

    console.log(`--- Movements for Category "${cats[0].nombre}" AND Event "${events[0].nombre}" ---`)
    console.log(`Count: ${count}`)
    if (data && data.length > 0) {
        console.log('Example movement:', data[0])
    }
}

main().catch(console.error)
