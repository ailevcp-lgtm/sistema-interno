const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
    console.log('Testing Select with OR filter...')

    // Test 1: external_id like PBI-%
    const { count: count1, error: err1 } = await supabase
        .from('movimientos')
        .select('*', { count: 'exact', head: true })
        .like('external_id', 'PBI-%')

    console.log(`Count (like PBI-%): ${count1} (Error: ${err1?.message})`)

    // Test 2: The OR syntax
    const query = 'import_batch_id.not.is.null,external_id.like.PBI-%,external_id.like.2026-%'
    const { count: count2, error: err2 } = await supabase
        .from('movimientos')
        .select('*', { count: 'exact', head: true })
        .or(query)

    console.log(`Count (OR query): ${count2} (Error: ${err2?.message})`)

    if (count2 === 0) {
        console.log('Query matched 0 rows. Syntax might be wrong.')
    } else {
        console.log('Query correctly matched rows.')
    }
}

main().catch(console.error)
