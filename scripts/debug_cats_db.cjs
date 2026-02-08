const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
    const { data: cats, error } = await supabase
        .from('categorias_financieras')
        .select('*')
        .order('nombre')

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log('--- Categories in DB ---')
    cats.forEach(c => {
        console.log(`[${c.id}] "${c.nombre}" (${c.tipo})`)
    })
}

main().catch(console.error)
