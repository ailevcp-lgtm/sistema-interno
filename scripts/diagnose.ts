
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load env
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env.local') })
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const DATA_DIR = path.resolve(import.meta.dirname, '../../DATOS XLSX TESORERIA')
const FILE_2026 = path.join(DATA_DIR, 'Movimientos (2026).xlsx')
const FILE_2024 = path.join(DATA_DIR, 'Base de datos relacional para Power BI (2024-2025).xlsx')
const FILE_APORTES = path.join(DATA_DIR, 'Aportes (2026).xlsx')

async function main() {
    console.log('--- Database Check ---')
    const { count, error } = await supabase.from('movimientos').select('*', { count: 'exact', head: true })
    console.log(`Total rows in 'movimientos': ${count}`)

    const { data: samples } = await supabase.from('movimientos').select('id, import_batch_id, external_id').limit(5)
    console.log('Sample rows:', samples)

    console.log('\n--- Excel 2026 Check ---')
    const workbook = XLSX.readFile(FILE_2026)
    console.log('Sheets:', workbook.SheetNames)

    // Try to find a month sheet
    const monthSheet = workbook.SheetNames.find(s => /enero|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic/i.test(s))
    if (monthSheet) {
        console.log(`Inspecting sheet: ${monthSheet}`)
        const sheet = workbook.Sheets[monthSheet]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        if (rows.length > 0) {
            console.log('Headers:', rows[0])
            console.log('Row 1:', rows[1])
        }
    }

    console.log('\n--- Excel Aportes 2026 Check ---')
    try {
        const wbAportes = XLSX.readFile(FILE_APORTES)
        console.log('Sheets:', wbAportes.SheetNames)
        const sheetA = wbAportes.Sheets[wbAportes.SheetNames[0]]
        const rowsA = XLSX.utils.sheet_to_json(sheetA, { header: 1 })
        if (rowsA.length > 0) {
            console.log('Headers:', rowsA[0])
            console.log('Row 1:', rowsA[1])
        }
    } catch (e) {
        console.log('Error reading Aportes:', e.message)
    }
}

main()
