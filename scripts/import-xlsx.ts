/**
 * AILE Financial Data Import Script
 * Imports XLSX data from Power BI files into Supabase
 *
 * Usage: cd scripts && npm install && npx tsx import-xlsx.ts
 *
 * Requires .env file in project root with:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...  (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load env from project root
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env.local') })
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Check for --clean flag
const args = process.argv.slice(2)
const shouldClean = args.includes('--clean')

async function deleteOldData() {
  console.log('  [CLEAN] Deleting all previous imported data...')

  // Delete movements linked to batches ensures we don't delete manually entered data if they don't have batch_id
  // But for a full reset, maybe we want to delete everything? 
  // The user said "delete all previously imported data".
  // Let's delete where import_batch_id is not null.

  // Delete movements by batch or external_id pattern (for legacy imports)
  // 1. Delete rows with import_batch_id (from previous runs that worked correctly)
  const { error: err1 } = await supabase
    .from('movimientos')
    .delete()
    .not('import_batch_id', 'is', null)

  if (err1) console.error('  [WARN] Failed to delete batch rows:', err1.message)

  // 2. Delete legacy rows by external_id pattern (PBI-*)
  const { error: err2 } = await supabase
    .from('movimientos')
    .delete()
    .ilike('external_id', 'PBI-%')

  if (err2) console.error('  [WARN] Failed to delete PBI rows:', err2.message)

  // 3. Delete legacy rows by external_id pattern (2026-*)
  const { error: err3 } = await supabase
    .from('movimientos')
    .delete()
    .ilike('external_id', '2026-%')

  if (err3) console.error('  [WARN] Failed to delete 2026 rows:', err3.message)

  const { error: errBatch } = await supabase
    .from('import_batches')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

  if (errBatch) {
    console.error('  [ERROR] Failed to delete batches:', errBatch)
    return
  }

  console.log('  [CLEAN] Data deleted successfully.')
}

// ── Paths ──────────────────────────────────────────────────
const DATA_DIR = path.resolve(import.meta.dirname, '../../DATOS XLSX TESORERIA')
const FILE_2024_2025 = path.join(DATA_DIR, 'Base de datos relacional para Power BI (2024-2025).xlsx')
const FILE_2026 = path.join(DATA_DIR, 'Movimientos (2026).xlsx')

// ── Category Mapping ───────────────────────────────────────
const CATEGORY_NORMALIZE: Record<string, string> = {
  'cuotas': 'Cuotas',
  'rendimientos': 'Rendimientos',
  'merchandising': 'Merchandising',
  'donaciones': 'Donaciones',
  'varios': 'Varios',
  'indumentaria': 'Indumentaria',
  'buffet': 'Buffet',
  'vasos': 'Vasos',
  'campamento': 'Campamento',
  'comunicacion': 'Comunicación',
  'comunicación': 'Comunicación',
  'papeleria': 'Papelería',
  'papelería': 'Papelería',
  'papelería e impresiones': 'Papelería',
  'gastos operativos': 'Gastos Operativos',
  'mesa dulce': 'Mesa Dulce',
  'decoracion': 'Decoración',
  'decoración': 'Decoración',
  'aportes internos': 'Aportes Internos',
  'gastos internos': 'Gastos Internos',
  'suscripciones': 'Suscripciones',
  'donaciones internas': 'Donaciones',
  'donaciones externas': 'Donaciones Externas',
  'pines': 'Pines',
  'almuerzo': 'Almuerzo',
  'dulce': 'Dulce',
  'movimientos de cuentas': 'Movimientos de Cuentas',
  'logística': 'Logística',
  'logistica': 'Logística',
  'catering': 'Catering',
  'alquiler de espacios': 'Alquiler de espacios',
  'honorarios': 'Honorarios',
  'otros ingresos': 'Otros ingresos',
  'otros egresos': 'Otros egresos',
  'inscripciones a modelos': 'Inscripciones a modelos',
  'sponsors': 'Sponsors',
}

// ── Helpers ────────────────────────────────────────────────
function normalizeText(val: unknown): string | null {
  if (val == null) return null
  return String(val).trim().replace(/\s+/g, ' ')
}

function normalizeKey(val: unknown): string | null {
  const t = normalizeText(val)
  return t ? t.toLowerCase() : null
}

function parseAmount(val: unknown): number {
  if (val == null || val === '' || val === '-') return 0
  if (typeof val === 'number') return Math.abs(val)
  let s = String(val).replace(/\$/g, '').replace(/\s/g, '')
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.abs(n)
}

function parseExcelDate(val: unknown): string | null {
  if (val == null || val === '') return null
  if (val instanceof Date) {
    return val.toISOString().split('T')[0]
  }
  if (typeof val === 'number') {
    // Excel serial date
    const d = new Date(Date.UTC(1899, 11, 30 + Math.floor(val)))
    return d.toISOString().split('T')[0]
  }
  const s = String(val).trim()
  // Try dd/mm/yyyy or dd/mm/yy
  for (const sep of ['/', '-']) {
    const parts = s.split(sep)
    if (parts.length === 3) {
      const [a, b, c] = parts
      if (a.length <= 2 && b.length <= 2) {
        const day = parseInt(a)
        const month = parseInt(b)
        let year = parseInt(c)
        if (year < 100) year += 2000
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        }
      }
      // Try yyyy-mm-dd
      if (a.length === 4) {
        return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`
      }
    }
  }
  // Try ISO
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return null
}

function computeRowHash(externalId: string, monto: number, fecha: string, tipo: string): string {
  return crypto.createHash('md5').update(`${externalId}|${monto}|${fecha}|${tipo}`).digest('hex')
}

function isValidDate(fecha: string): boolean {
  const d = new Date(fecha)
  return !isNaN(d.getTime()) && d.getFullYear() >= 2024 && d.getFullYear() <= 2027
}

// ── Lookup Caches ──────────────────────────────────────────
const categoryCache = new Map<string, string>() // nombre+tipo → id
const eventCache = new Map<string, string>()    // nombre → id (keyed by "nombre_lower|anio")
const accountCache = new Map<string, string>()   // nombre → id

async function loadCaches() {
  const { data: cats } = await supabase.from('categorias_financieras').select('id, nombre, tipo')
  cats?.forEach(c => categoryCache.set(`${c.nombre.toLowerCase()}|${c.tipo}`, c.id))

  const { data: events } = await supabase.from('eventos').select('id, nombre, anio')
  events?.forEach(e => {
    // Cache by full name (for exact matching)
    eventCache.set(e.nombre.toLowerCase(), e.id)
    // Cache by name+year (for year-specific matching)
    if (e.anio) eventCache.set(`${e.nombre.toLowerCase()}|${e.anio}`, e.id)
  })

  const { data: accounts } = await supabase.from('cuentas').select('id, nombre')
  accounts?.forEach(a => accountCache.set(a.nombre.toLowerCase(), a.id))
}

async function getOrCreateCategory(nombre: string, tipo: 'ingreso' | 'egreso'): Promise<string | null> {
  const key = normalizeKey(nombre)
  if (!key) return null

  const canonical = CATEGORY_NORMALIZE[key] || normalizeText(nombre)!
  const cacheKey = `${canonical.toLowerCase()}|${tipo}`

  if (categoryCache.has(cacheKey)) return categoryCache.get(cacheKey)!

  // Try to create
  const { data, error } = await supabase
    .from('categorias_financieras')
    .upsert({ nombre: canonical, tipo, activa: true }, { onConflict: 'nombre,tipo' })
    .select('id')
    .single()

  if (error) {
    // Try exact match by nombre+tipo
    const { data: exact } = await supabase
      .from('categorias_financieras')
      .select('id')
      .eq('nombre', canonical)
      .eq('tipo', tipo)
      .single()
    if (exact) {
      categoryCache.set(cacheKey, exact.id)
      return exact.id
    }
    // Fallback: match by nombre only (category exists with other tipo)
    const { data: byName } = await supabase
      .from('categorias_financieras')
      .select('id')
      .eq('nombre', canonical)
      .limit(1)
      .single()
    if (byName) {
      categoryCache.set(cacheKey, byName.id)
      return byName.id
    }
    // Last resort: insert with plain insert (no upsert)
    const { data: created } = await supabase
      .from('categorias_financieras')
      .insert({ nombre: canonical, tipo, activa: true })
      .select('id')
      .single()
    if (created) {
      categoryCache.set(cacheKey, created.id)
      return created.id
    }
    console.warn(`  [WARN] Could not resolve category: ${nombre} (${tipo})`)
    return null
  }

  categoryCache.set(cacheKey, data.id)
  return data.id
}

function extractYearFromEventName(nombre: string): number | null {
  const match = nombre.match(/(\d{4})/)
  return match ? parseInt(match[1]) : null
}

async function getOrCreateEvent(nombre: string, anioHint?: number): Promise<string | null> {
  const key = normalizeKey(nombre)
  if (!key) return null

  const canonical = normalizeText(nombre)!
  const anio = anioHint || extractYearFromEventName(canonical)

  // Try exact match by full name
  if (eventCache.has(key)) return eventCache.get(key)!

  // Try match by name+year
  if (anio && eventCache.has(`${key}|${anio}`)) return eventCache.get(`${key}|${anio}`)!

  // Not found — create the event
  const insertData: { nombre: string; anio?: number; activo: boolean } = {
    nombre: canonical,
    activo: true,
  }
  if (anio) insertData.anio = anio

  const { data, error } = await supabase
    .from('eventos')
    .upsert(insertData, { onConflict: 'nombre,anio' })
    .select('id')
    .single()

  if (data) {
    eventCache.set(key, data.id)
    if (anio) eventCache.set(`${key}|${anio}`, data.id)
    console.log(`  [NEW EVENT] Created: "${canonical}" (${anio || 'no year'})`)
    return data.id
  }

  if (error) {
    // Try to find it by exact name
    const { data: existing } = await supabase
      .from('eventos')
      .select('id')
      .eq('nombre', canonical)
      .limit(1)
      .single()
    if (existing) {
      eventCache.set(key, existing.id)
      return existing.id
    }
    console.warn(`  [WARN] Could not resolve event: ${nombre}`, error.message)
  }

  return null
}

async function getAccountId(nombre: string): Promise<string | null> {
  const key = normalizeKey(nombre)
  if (!key) return null
  return accountCache.get(key) || null
}

// ── Import 2024-2025 ───────────────────────────────────────
async function import2024_2025() {
  console.log('\n═══ Importing 2024-2025 Power BI Data ═══')

  const workbook = XLSX.readFile(FILE_2024_2025, { cellDates: true })

  // Load reference sheets
  const categoriesSheet = workbook.Sheets['Categories']
  const volunteersSheet = workbook.Sheets['Volunteers']
  const movTypesSheet = workbook.Sheets['Movement types']
  const way2paySheet = workbook.Sheets['Way to pay']
  const eventsSheet = workbook.Sheets['Events']
  const movementsSheet = workbook.Sheets['Movements']

  if (!movementsSheet) {
    console.error('  [ERROR] Movements sheet not found')
    return
  }

  // Parse reference data
  const categories = XLSX.utils.sheet_to_json<Record<string, unknown>>(categoriesSheet || {})
  const volunteers = XLSX.utils.sheet_to_json<Record<string, unknown>>(volunteersSheet || {})
  const movTypes = XLSX.utils.sheet_to_json<Record<string, unknown>>(movTypesSheet || {})
  const way2pays = XLSX.utils.sheet_to_json<Record<string, unknown>>(way2paySheet || {})
  const events = XLSX.utils.sheet_to_json<Record<string, unknown>>(eventsSheet || {})
  const movements = XLSX.utils.sheet_to_json<Record<string, unknown>>(movementsSheet)

  // Build lookups (trim keys and values to handle trailing spaces like "C16 ")
  const catLookup = new Map<string, string>()
  const catTypeLookup = new Map<string, string>() // category_id → 'ing'|'egr'
  categories.forEach((c: Record<string, unknown>) => {
    const id = String(c['category_id'] || c['id']).trim()
    const name = String(c['category_name'] || c['name'] || c['nombre'] || '').trim()
    const type = String(c['type'] || c['tipo'] || '').trim().toLowerCase()
    catLookup.set(id, name)
    catTypeLookup.set(id, type)
  })

  const volLookup = new Map<string, string>()
  volunteers.forEach((v: Record<string, unknown>) => {
    const id = String(v['volunteer_id'] || v['id']).trim()
    const name = [v['first_name'] || v['nombre'], v['last_name'] || v['apellido']].filter(Boolean).join(' ')
    volLookup.set(id, name || 'Voluntario')
  })

  const typeLookup = new Map<string, string>()
  movTypes.forEach((t: Record<string, unknown>) => {
    const id = String(t['mov_type_id'] || t['id']).trim()
    const typeVal = String(t['type'] || t['mov_type_name'] || t['name'] || '').toLowerCase().trim()
    typeLookup.set(id, typeVal)
  })

  const payLookup = new Map<string, string>()
  way2pays.forEach((p: Record<string, unknown>) => {
    const id = String(p['way2pay_id'] || p['id']).trim()
    const name = String(p['way'] || p['way2pay_name'] || p['name'] || '').trim()
    payLookup.set(id, name)
  })

  const eventLookup = new Map<string, string>()
  events.forEach((e: Record<string, unknown>) => {
    const id = String(e['event_id'] || e['id']).trim()
    const name = String(e['event_name'] || e['name'] || e['nombre'] || '').trim()
    eventLookup.set(id, name)
  })

  console.log(`  Category lookup: ${Array.from(catLookup.entries()).map(([k,v]) => `${k}=${v}`).join(', ')}`)
  console.log(`  Event lookup: ${Array.from(eventLookup.entries()).map(([k,v]) => `${k}=${v}`).join(', ')}`)
  console.log(`  Type lookup: ${Array.from(typeLookup.entries()).map(([k,v]) => `${k}=${v}`).join(', ')}`)
  console.log(`  Pay lookup: ${Array.from(payLookup.entries()).map(([k,v]) => `${k}=${v}`).join(', ')}`)

  // Create import batch
  const { data: batch } = await supabase
    .from('import_batches')
    .insert({
      archivo_origen: 'Base de datos relacional para Power BI (2024-2025).xlsx',
      hoja_origen: 'Movements',
      filas_totales: movements.length,
    })
    .select('id')
    .single()

  const batchId = batch?.id

  console.log(`  Found ${movements.length} movement rows`)
  console.log(`  Reference: ${categories.length} cats, ${volunteers.length} vols, ${events.length} events`)

  let inserted = 0, duplicated = 0, errors = 0

  for (const row of movements) {
    try {
      const movId = row['movement_id'] || row['id']
      if (movId == null) { errors++; continue }

      const externalId = `PBI-${movId}`
      const monto = parseAmount(row['amount'] || row['monto'])
      if (monto <= 0) { errors++; continue }

      // Category ID from Excel (trim spaces like "C16 ")
      const catId = row['category_id'] || row['categoria_id']
      const catIdStr = catId ? String(catId).trim() : ''

      // Determine type from mov_type_id
      const rawTypeId = row['mov_type_id'] || row['tipo_id']
      const typeId = rawTypeId != null ? String(rawTypeId).trim() : ''
      let tipo: 'ingreso' | 'egreso'
      const typeStr = typeLookup.get(typeId) || ''

      if (typeId === '1' || typeStr.includes('ingres') || typeStr.includes('income')) {
        tipo = 'ingreso'
      } else if (typeId === '2' || typeStr.includes('egres') || typeStr.includes('expense')) {
        tipo = 'egreso'
      } else {
        // Fallback: use the category's type from the Excel if available
        const catType = catTypeLookup.get(catIdStr) || ''
        if (catType.startsWith('ing')) {
          tipo = 'ingreso'
        } else if (catType.startsWith('egr')) {
          tipo = 'egreso'
        } else {
          errors++; continue
        }
      }

      const fecha = parseExcelDate(row['movement_date'] || row['fecha'])
      if (!fecha || !isValidDate(fecha)) { errors++; continue }

      const periodo = fecha.substring(0, 7)
      const descripcion = normalizeText(row['description'] || row['descripcion']) || 'Sin detalle'

      // Category
      const catName = catIdStr ? (catLookup.get(catIdStr) || '') : ''
      const categoriaId = catName ? await getOrCreateCategory(catName, tipo) : null

      // Event
      const rawEvId = row['event_id'] || row['evento_id']
      const evId = rawEvId != null ? String(rawEvId).trim() : ''
      const evName = evId ? eventLookup.get(evId) : null
      const eventoId = evName ? await getOrCreateEvent(evName) : null

      // Volunteer
      const rawVolId = row['volunteer_id'] || row['voluntario_id']
      const volId = rawVolId != null ? String(rawVolId).trim() : ''
      const voluntarioNombre = volId ? (volLookup.get(volId) || null) : null

      // Way to pay
      const rawPayId = row['way2pay_id']
      const payId = rawPayId != null ? String(rawPayId).trim() : ''
      const payName = payId ? payLookup.get(payId) : null
      const cuentaId = payName ? await getAccountId(payName) : null

      const rowHash = computeRowHash(externalId, monto, fecha, tipo)

      const { error } = await supabase.from('movimientos').insert({
        tipo,
        monto,
        fecha,
        periodo,
        descripcion,
        categoria_id: categoriaId,
        evento_id: eventoId,
        cuenta_id: cuentaId,
        voluntario_nombre: voluntarioNombre,
        moneda: 'ARS',
        external_id: externalId,
        row_hash: rowHash,
        import_batch_id: batchId,
        registrado_por: null as unknown as string,
        comprobante_url: null,
      })

      if (error) {
        if (error.code === '23505') { // unique violation (row_hash)
          duplicated++
        } else {
          console.warn(`  [ERROR] Row ${movId}: ${error.message}`)
          errors++
        }
      } else {
        inserted++
      }
    } catch (e) {
      console.warn(`  [ERROR] Unexpected:`, e)
      errors++
    }
  }

  // Update batch
  if (batchId) {
    await supabase.from('import_batches').update({
      filas_insertadas: inserted,
      filas_duplicadas: duplicated,
      filas_error: errors,
    }).eq('id', batchId)
  }

  console.log(`  Results: ${inserted} inserted, ${duplicated} duplicated, ${errors} errors`)
}

// ── Import 2026 ────────────────────────────────────────────
async function import2026() {
  console.log('\n═══ Importing 2026 Data ═══')

  const workbook = XLSX.readFile(FILE_2026, { cellDates: true })

  // Find month sheets (Enero, Febrero, etc.)
  const monthSheets = workbook.SheetNames.filter(name =>
    /^(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)$/i.test(name)
  )

  if (monthSheets.length === 0) {
    console.log('  No month sheets found. Available:', workbook.SheetNames.join(', '))
    return
  }

  let totalInserted = 0, totalDuplicated = 0, totalErrors = 0

  for (const sheetName of monthSheets) {
    console.log(`\n  Processing sheet: ${sheetName}`)
    const sheet = workbook.Sheets[sheetName]

    // Convert to array of arrays to find header
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
    let headerRowIndex = -1

    for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
      const row = rawRows[i]
      // Check for key columns
      const rowStr = row.map((c: any) => String(c).toLowerCase()).join(' ')
      if (rowStr.includes('fecha') && (rowStr.includes('ingreso') || rowStr.includes('monto') || rowStr.includes('detalle'))) {
        headerRowIndex = i
        break
      }
    }

    if (headerRowIndex === -1) {
      console.log(`    [WARN] Could not find header row in ${sheetName}. Skipping.`)
      continue
    }

    console.log(`    Found header at row ${headerRowIndex}`)

    // Now parse with correct header
    const range = XLSX.utils.decode_range(sheet['!ref']!)
    range.s.r = headerRowIndex
    const newRef = XLSX.utils.encode_range(range)

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: newRef })

    // Filter valid data rows (must have ID or valid Date/Amount)
    const dataRows = rows.filter(r => {
      // Some rows might be summary or footer
      // Check if it has a valid date or ID
      const hasDate = r['Fecha'] || r['fecha']
      const hasAmount = r['Ingreso'] || r['ingreso'] || r['Egreso'] || r['egreso']
      // Also check if ID exists, or generate one? The previous code required ID starting with MOV
      // Let's see if ID column exists
      const id = r['ID'] || r['id']
      // If we have Date AND Amount, it's likely a valid movement even without ID
      return (hasDate && hasAmount) || (id && String(id).trim() !== '')
    })

    console.log(`    ${dataRows.length} valid data rows (of ${rows.length} total)`)

    const { data: batch } = await supabase
      .from('import_batches')
      .insert({
        archivo_origen: 'Movimientos (2026).xlsx',
        hoja_origen: sheetName,
        filas_totales: dataRows.length,
      })
      .select('id')
      .single()

    const batchId = batch?.id
    let inserted = 0, duplicated = 0, errors = 0
    let rowIndex = 0

    for (const row of dataRows) {
      rowIndex++
      try {
        const rawId = row['ID'] || row['id']
        const idStr = rawId ? String(rawId).trim() : `GEN-${sheetName}-${rowIndex}-${Date.now()}`
        const externalId = `2026-${idStr}`


        // Determine amount and type
        const ingresoVal = parseAmount(row['Ingreso'] || row['ingreso'])
        const egresoVal = parseAmount(row['Egreso'] || row['egreso'] || row['Gasto'] || row['gasto'])
        let monto: number
        let tipo: 'ingreso' | 'egreso'

        const tipoMov = normalizeKey(row['Tipo de Mov.'] || row['Tipo'] || row['tipo'] || '')

        if (ingresoVal > 0 && egresoVal <= 0) {
          monto = ingresoVal; tipo = 'ingreso'
        } else if (egresoVal > 0 && ingresoVal <= 0) {
          monto = egresoVal; tipo = 'egreso'
        } else if (tipoMov?.includes('ingres')) {
          monto = ingresoVal || egresoVal; tipo = 'ingreso'
        } else if (tipoMov?.includes('gasto') || tipoMov?.includes('egres')) {
          monto = egresoVal || ingresoVal; tipo = 'egreso'
        } else {
          errors++; continue
        }

        if (monto <= 0) { errors++; continue }

        const fecha = parseExcelDate(row['Fecha'] || row['fecha'])
        if (!fecha || !isValidDate(fecha)) { errors++; continue }

        const periodo = fecha.substring(0, 7)
        const descripcion = normalizeText(row['Detalle'] || row['detalle'] || row['Descripcion'] || row['descripcion']) || 'Sin detalle'

        // Category
        const catName = normalizeText(row['Categoria'] || row['categoria'] || row['Categoría'] || '')
        const categoriaId = catName ? await getOrCreateCategory(catName, tipo) : null

        // Account
        const cuentaNombre = normalizeText(row['Cuenta'] || row['cuenta'] || '')
        const cuentaId = cuentaNombre ? await getAccountId(cuentaNombre) : null

        const rowHash = computeRowHash(externalId, monto, fecha, tipo)

        const { error } = await supabase.from('movimientos').insert({
          tipo,
          monto,
          fecha,
          periodo,
          descripcion,
          categoria_id: categoriaId,
          cuenta_id: cuentaId,
          moneda: 'ARS',
          external_id: externalId,
          row_hash: rowHash,
          import_batch_id: batchId,
          registrado_por: null as unknown as string,
          comprobante_url: null,
        })

        if (error) {
          if (error.code === '23505') {
            duplicated++
          } else {
            console.warn(`    [ERROR] Row ${rawId}: ${error.message}`)
            errors++
          }
        } else {
          inserted++
        }
      } catch (e) {
        console.warn(`    [ERROR] Unexpected:`, e)
        errors++
      }
    }

    if (batchId) {
      await supabase.from('import_batches').update({
        filas_insertadas: inserted,
        filas_duplicadas: duplicated,
        filas_error: errors,
      }).eq('id', batchId)
    }

    console.log(`    Results: ${inserted} inserted, ${duplicated} duplicated, ${errors} errors`)
    totalInserted += inserted
    totalDuplicated += duplicated
    totalErrors += errors
  }

  console.log(`\n  2026 Total: ${totalInserted} inserted, ${totalDuplicated} duplicated, ${totalErrors} errors`)
}

// ── Validation ─────────────────────────────────────────────
async function validate() {
  console.log('\n═══ Validation ═══')

  const { count: totalMov } = await supabase
    .from('movimientos')
    .select('*', { count: 'exact', head: true })

  console.log(`  Total movimientos: ${totalMov}`)

  const { data: summary } = await supabase
    .from('movimientos')
    .select('tipo, monto')

  if (summary) {
    let ingresos = 0, egresos = 0
    summary.forEach(m => {
      if (m.tipo === 'ingreso') ingresos += Number(m.monto)
      else egresos += Number(m.monto)
    })
    console.log(`  Total ingresos: $${ingresos.toLocaleString('es-AR')}`)
    console.log(`  Total egresos:  $${egresos.toLocaleString('es-AR')}`)
    console.log(`  Balance:        $${(ingresos - egresos).toLocaleString('es-AR')}`)
  }

  // Validate events
  const { data: eventMovs } = await supabase
    .from('movimientos')
    .select('evento_id, tipo, monto, evento:eventos(nombre)')
    .not('evento_id', 'is', null)

  if (eventMovs && eventMovs.length > 0) {
    console.log(`\n  Movements WITH events: ${eventMovs.length}`)
    const eventTotals = new Map<string, { name: string; ingresos: number; egresos: number; count: number }>()
    eventMovs.forEach(m => {
      const evName = (m.evento as any)?.nombre || m.evento_id
      if (!eventTotals.has(m.evento_id)) {
        eventTotals.set(m.evento_id, { name: evName, ingresos: 0, egresos: 0, count: 0 })
      }
      const entry = eventTotals.get(m.evento_id)!
      entry.count++
      if (m.tipo === 'ingreso') entry.ingresos += Number(m.monto)
      else entry.egresos += Number(m.monto)
    })
    eventTotals.forEach((v, k) => {
      console.log(`    ${v.name}: ${v.count} movs, Ing=$${v.ingresos.toLocaleString('es-AR')}, Egr=$${v.egresos.toLocaleString('es-AR')}`)
    })
  } else {
    console.log(`\n  ⚠ NO movements with events found!`)
  }

  // Validate categories
  const { count: withCat } = await supabase
    .from('movimientos')
    .select('*', { count: 'exact', head: true })
    .not('categoria_id', 'is', null)

  const { count: withoutCat } = await supabase
    .from('movimientos')
    .select('*', { count: 'exact', head: true })
    .is('categoria_id', null)

  console.log(`\n  Movements WITH category: ${withCat}`)
  console.log(`  Movements WITHOUT category: ${withoutCat}`)

  const { data: batches } = await supabase
    .from('import_batches')
    .select('*')
    .order('created_at', { ascending: false })

  if (batches) {
    console.log(`\n  Import batches:`)
    batches.forEach(b => {
      console.log(`    ${b.archivo_origen} [${b.hoja_origen}]: ${b.filas_insertadas}/${b.filas_totales} rows (${b.filas_duplicadas} dups, ${b.filas_error} errs)`)
    })
  }
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  console.log('AILE Financial Data Import')
  console.log('══════════════════════════')

  await loadCaches()
  console.log(`Loaded caches: ${categoryCache.size} categories, ${eventCache.size} events, ${accountCache.size} accounts`)

  if (shouldClean) {
    await deleteOldData()
    // Reload caches just in case (though categories/events are not deleted, only movements/batches are)
  }

  await import2024_2025()

  // Reload caches after 2024-2025 (new categories may have been created)
  await loadCaches()

  await import2026()
  await validate()

  console.log('\n✓ Import complete')
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
