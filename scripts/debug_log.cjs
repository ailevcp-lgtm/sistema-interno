const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')

const logFile = path.resolve(__dirname, 'debug_output.log')
function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`
    fs.appendFileSync(logFile, line)
    console.log(msg)
}

fs.writeFileSync(logFile, 'STARTING DEBUG LOG\n')

try {
    const envPath = path.resolve(__dirname, '../.env.local')
    dotenv.config({ path: envPath })

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!URL || !KEY) {
        log('MISSING CREDENTIALS')
        process.exit(1)
    }

    const supabase = createClient(URL, KEY)

    async function run() {
        log('Querying Supabase...')
        const { data, error } = await supabase
            .from('movimientos')
            .select('monto, tipo, descripcion, fecha, import_batch_id, external_id, categorias_financieras(nombre)')

        if (error) {
            log(`ERROR: ${error.message}`)
            return
        }

        log(`Fetched ${data.length} rows`)

        const vasos = data.filter(m => {
            const cat = m.categorias_financieras?.nombre || ''
            return cat.toLowerCase().includes('vasos')
        })

        log(`Found ${vasos.length} Vasos movements`)

        vasos.sort((a, b) => b.monto - a.monto)

        log('TOP 10 VASOS DETAILS:')
        vasos.slice(0, 10).forEach(m => {
            log(`  ${m.fecha} | $${m.monto} | Batch: ${m.import_batch_id} | ExtID: ${m.external_id} | ${m.descripcion}`)
        })
    }

    run().catch(err => log(`FATAL: ${err.message}`))

} catch (err) {
    log(`CRASH: ${err.message}`)
}
