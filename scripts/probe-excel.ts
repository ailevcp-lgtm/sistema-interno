
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
import * as path from 'path'

const FILE_PATH = path.resolve(import.meta.dirname, '../../DATOS XLSX TESORERIA/Aportes (2026).xlsx')

function probe() {
    console.log('Probing:', FILE_PATH)
    const workbook = XLSX.readFile(FILE_PATH)

    const sheetName = 'Sandbox'
    if (workbook.Sheets[sheetName]) {
        console.log(`\n--- Sheet: ${sheetName} ---`)
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

        // Look for "Estadísticas" or "Socios Deudores" keywords
        let statsStart = -1
        for (let i = 0; i < rows.length; i++) {
            const rowStr = JSON.stringify(rows[i] || [])
            if (rowStr.includes('Estadísticas') || rowStr.includes('Socios Deudores') || rowStr.includes('Totales')) {
                console.log(`Found keyword at row ${i}: ${rowStr}`)
                // Print surrounding rows
                const end = Math.min(i + 15, rows.length)
                console.log(JSON.stringify(rows.slice(i, end), null, 2))
            }
        }
    }
}

probe()
