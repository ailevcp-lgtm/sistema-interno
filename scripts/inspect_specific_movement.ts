import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
import * as path from 'path'

const FILE = path.resolve(process.cwd(), '../DATOS XLSX TESORERIA/Base de datos relacional para Power BI (2024-2025).xlsx')

console.log('Reading Excel:', FILE)
const workbook = XLSX.readFile(FILE)
const movSheet = workbook.Sheets['Movements']
const movs = XLSX.utils.sheet_to_json(movSheet)

const targetDesc = 'Ingresos Buffet MINU'.toLowerCase()
const targetAmount = 1099500

console.log(\`Searching for desc includes "\${targetDesc}" and amount \${targetAmount}...\`)

const found = movs.filter((m: any) => {
    const desc = (m['description'] || m['descripcion'] || '').toLowerCase()
    const amt = parseFloat(m['amount'] || m['monto'] || '0')
    return desc.includes(targetDesc) || Math.abs(amt - targetAmount) < 1
})

console.log(\`Found \${found.length} matches.\`)
found.forEach((m: any) => {
    console.log('--- Match ---')
    console.log(JSON.stringify(m, null, 2))
    const catId = m['category_id'] || m['categoria_id']
    
    // Find category name
    const cats = XLSX.utils.sheet_to_json(workbook.Sheets['Categories'])
    const cat = cats.find((c: any) => (c['category_id'] == catId || c['id'] == catId))
    console.log('Mapped Category:', cat)
})
