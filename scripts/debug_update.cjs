const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(URL, KEY)

async function main() {
    const targetId = 'PBI-350' // "Ingresos Buffet MINU"
    const newCatId = 'f1d29a7c-746f-4edc-a14f-0b027f930b38' // Buffet

    console.log(`Trying to update ${targetId} to category ${newCatId} using key starting with ${KEY.substring(0, 5)}...`)

    const { data, error } = await supabase
        .from('movimientos')
        .update({ categoria_id: newCatId })
        .eq('external_id', targetId)
        .select()

    if (error) {
        console.error('Update Failed:', error)
    } else {
        console.log('Update Success:', data)
    }
}

main().catch(console.error)
