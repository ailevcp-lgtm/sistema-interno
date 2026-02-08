import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
import * as path from 'path'

const FILE = path.resolve(process.cwd(), '../DATOS XLSX TESORERIA/Base de datos relacional para Power BI (2024-2025).xlsx')

console.log('Reading Excel:', FILE)
const workbook = XLSX.readFile(FILE)

const catSheet = workbook.Sheets['Categories']
const cats = XLSX.utils.sheet_to_json(catSheet)

console.log('\n--- Categories Sheet ---')
cats.forEach((c: any) => {
    // Print checking for Vasos
    const val = Object.values(c).join(' ').toLowerCase()
    if (val.includes('vasos')) {
        console.log('VASOS CATEGORY:', c)
    }
})

// Also print the whole list to see IDs
// console.log(cats)

const movSheet = workbook.Sheets['Movements']
const movs = XLSX.utils.sheet_to_json(movSheet)

console.log('\n--- Movements Sample ---')
const samples = movs.filter((m: any) => {
    const desc = (m['description'] || m['descripcion'] || '').toLowerCase()
    return desc.includes('buffet minu') || desc.includes('empanadas')
})

console.log('Found', samples.length, 'sample movements matching "buffet minu" or "empanadas"')
samples.slice(0, 5).forEach((m: any) => {
    console.log('Movement:', JSON.stringify(m))
    const catId = m['category_id'] || m['categoria_id']
    console.log('  -> Category ID:', catId)
    const cat = cats.find((c: any) => (c['category_id'] == catId || c['id'] == catId))
    console.log('  -> Mapped Category:', cat)
})
