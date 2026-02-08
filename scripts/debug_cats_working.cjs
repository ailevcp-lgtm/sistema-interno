const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

const envPath = path.resolve(__dirname, '../.env.local')
console.log('Loading env from:', envPath)
dotenv.config({ path: envPath })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!URL || !KEY) {
    console.error('MISSING CREDENTIALS')
    process.exit(1)
}

const supabase = createClient(URL, KEY)

async function main() {
    console.log('Querying Categories...')
    const { data: cats, error } = await supabase
        .from('categorias_financieras')
        .select('*')
        .order('nombre')

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log(`Found ${cats.length} categories.`)
    cats.forEach(c => {
        // filter useful ones
        if (c.nombre.match(/vasos|buffet|varios|minu/i)) {
            console.log(`[${c.id}] Name: "${c.nombre}" Type: "${c.tipo}" Active: ${c.activa}`)
        }
    })
}

main().catch(console.error)
