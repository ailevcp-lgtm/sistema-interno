
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load env from project root
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env.local') })
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const FILE_PATH = path.resolve(import.meta.dirname, '../../DATOS XLSX TESORERIA/Aportes (2026).xlsx')
const CUOTA_MONTO = 7000

function normalizeStr(str: string): string {
    if (!str) return ""
    const withoutParens = str.replace(/\s*\(.*?\)\s*/g, " ")
    return withoutParens.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
}

async function main() {
    console.log('AILE Debt Import Script (With Historic)')
    console.log('Reading:', FILE_PATH)

    const workbook = XLSX.readFile(FILE_PATH)
    const sheet = workbook.Sheets['Hoja 7']

    if (!sheet) {
        console.error('Sheet "Hoja 7" not found')
        return
    }

    // Get all partners from DB
    console.log('Fetching socios from DB...')
    const { data: socios, error } = await supabase.from('socios').select('*')
    if (error) {
        console.error('Error fetching socios:', error)
        return
    }

    const socioMap = new Map<string, any>()
    socios.forEach(s => {
        socioMap.set(normalizeStr(`${s.apellido}, ${s.nombre}`), s)
        socioMap.set(normalizeStr(`${s.nombre} ${s.apellido}`), s)
        socioMap.set(normalizeStr(`${s.apellido} ${s.nombre}`), s)
    })

    // Parse Excel
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    let processed = 0
    let skipped = 0
    let unmatched = 0

    console.log('Processing rows...')

    for (const row of rows) {
        const rawName = row[0]
        if (typeof rawName !== 'string' || !rawName.trim()) {
            skipped++
            continue
        }

        const cleanName = normalizeStr(rawName)
        const socio = socioMap.get(cleanName)

        if (!socio) {
            console.warn(`  [WARN] Socio not found: "${rawName}"`)
            unmatched++
            continue
        }

        processed++

        // Setup quotas
        const debtCount = typeof row[5] === 'number' ? row[5] : 0
        const paid2026 = typeof row[6] === 'number' ? row[6] : 0

        // 1. Current Year (2026)
        // Jan 2026
        const janPaid = paid2026 >= 1
        await upsertCuota(socio.id, '2026-01', janPaid ? 'pagada' : 'vencida') // Jan is overdue if unpaid

        // Feb 2026
        const febPaid = paid2026 >= 2
        await upsertCuota(socio.id, '2026-02', febPaid ? 'pagada' : 'pendiente') // Feb is pending if unpaid

        // 2. Historic Debt
        // Calculate how many of the "debtCount" are attributed to 2026
        let debtsIn2026 = 0
        if (!janPaid) debtsIn2026++
        if (!febPaid) debtsIn2026++ // Wait, is Feb debt? If pending, it counts as debt in the excel?
        // In the excel image: Paz has 11.
        // Hoja 7 Col 6 is 1. (Paid Jan).
        // So Feb is unpaid.
        // If Feb unpaid counts towards "11", then Historic = 11 - 1 (Feb) = 10.
        // Let's assume Pending counts as Debt in that column.

        const historicCount = debtCount - debtsIn2026

        if (historicCount > 0) {
            console.log(`    Creating ${historicCount} historic quotas for ${rawName}`)
            let date = new Date(2025, 11, 1) // Dec 2025

            for (let i = 0; i < historicCount; i++) {
                const year = date.getFullYear()
                const month = String(date.getMonth() + 1).padStart(2, '0')
                const periodo = `${year}-${month}`

                await upsertCuota(socio.id, periodo, 'vencida')

                // Go back 1 month
                date.setMonth(date.getMonth() - 1)
            }
        }

        // Update socio 'tiene_deuda' flag
        const hasDebt = debtCount > 0
        if (hasDebt !== socio.tiene_deuda) {
            await supabase.from('socios').update({ tiene_deuda: hasDebt }).eq('id', socio.id)
        }
    }

    console.log(`Done. Processed ${processed}, Skipped ${skipped}, Unmatched ${unmatched}`)
}

async function upsertCuota(socioId: string, periodo: string, estado: 'pagada' | 'pendiente' | 'vencida') {
    const monto = CUOTA_MONTO
    const montoPagado = estado === 'pagada' ? monto : 0
    const fechaPago = estado === 'pagada' ? new Date().toISOString() : null

    await supabase
        .from('cuotas')
        .upsert({
            socio_id: socioId,
            periodo: periodo,
            monto_esperado: monto,
            monto_pagado: montoPagado,
            estado: estado,
            fecha_pago: fechaPago
        }, { onConflict: 'socio_id, periodo' })
}

main().catch(console.error)
