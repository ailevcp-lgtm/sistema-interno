/**
 * AILE – Rebuild Historical Aportes (Cuotas) Payments
 *
 * Imports cuotas schedule, movimientos de pago, and cuota_aplicaciones
 * from CSV files. Creates missing socios automatically.
 *
 * Usage:
 *   cd scripts && npx tsx rebuild_aportes_payments.ts \
 *     --movimientos ../path/to/movimientos_cuotas_import.csv \
 *     --allocations ../path/to/cuota_aplicaciones_import.csv
 *
 * Optionally:
 *   --cuotas ../path/to/cuotas_import.csv   (schedule, if available)
 *   --dry-run                                (no writes, just validate)
 *   --default-monto 7000                     (override default cuota amount)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// ── Env ──────────────────────────────────────────────────────
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env.local') })
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY env vars')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── CLI Args ─────────────────────────────────────────────────
function parseArgs(): {
  cuotasFile?: string
  movimientosFile: string
  allocationsFile: string
  dryRun: boolean
  defaultMonto?: number
} {
  const args = process.argv.slice(2)
  let cuotasFile: string | undefined
  let movimientosFile = ''
  let allocationsFile = ''
  let dryRun = false
  let defaultMonto: number | undefined

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--cuotas':
        cuotasFile = args[++i]; break
      case '--movimientos':
        movimientosFile = args[++i]; break
      case '--allocations':
        allocationsFile = args[++i]; break
      case '--dry-run':
        dryRun = true; break
      case '--default-monto':
        defaultMonto = parseFloat(args[++i]); break
    }
  }

  if (!movimientosFile || !allocationsFile) {
    console.error('Usage: npx tsx rebuild_aportes_payments.ts --movimientos <file> --allocations <file> [--cuotas <file>] [--dry-run]')
    process.exit(1)
  }

  return { cuotasFile, movimientosFile, allocationsFile, dryRun, defaultMonto }
}

// ── CSV Parser (handles quoted fields with commas) ───────────
function parseCSV(filePath: string): Record<string, string>[] {
  const raw = fs.readFileSync(filePath, 'utf-8')
  // Strip BOM
  const content = raw.replace(/^\uFEFF/, '')
  const lines = content.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim()
    })
    rows.push(row)
  }
  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}

// ── Normalize helpers ────────────────────────────────────────
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function computeRowHash(externalId: string, socioId: string, periodo: string, fecha: string, monto: number): string {
  return crypto.createHash('md5').update(`${externalId}|${socioId}|${periodo}|${fecha}|${monto}`).digest('hex')
}

function lastDayOfMonth(periodo: string): string {
  // periodo = "2026-01"
  const [year, month] = periodo.split('-').map(Number)
  const d = new Date(year, month, 0) // day 0 of next month = last day of this month
  return d.toISOString().split('T')[0]
}

// ── Socio Resolution ─────────────────────────────────────────
interface SocioInfo {
  id: string
  nombre: string
  apellido: string
  dni: string | null
  created: boolean
}

const socioCache = new Map<string, SocioInfo>() // keyed by socio_id, dni, or normalized name
const createdSocios: SocioInfo[] = []

function parseName(displayName: string): { nombre: string; apellido: string } {
  const trimmed = displayName.trim()
  if (trimmed.includes(',')) {
    const [apellido, ...rest] = trimmed.split(',')
    return { apellido: apellido.trim(), nombre: rest.join(',').trim() }
  }
  // No comma: last word is apellido
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { nombre: parts[0], apellido: parts[0] }
  const apellido = parts[parts.length - 1]
  const nombre = parts.slice(0, -1).join(' ')
  return { nombre, apellido }
}

async function loadAllSocios(): Promise<void> {
  const { data, error } = await supabase.from('socios').select('id, nombre, apellido, dni')
  if (error) throw new Error(`Failed to load socios: ${error.message}`)

  for (const s of data || []) {
    const info: SocioInfo = { id: s.id, nombre: s.nombre, apellido: s.apellido, dni: s.dni, created: false }
    socioCache.set(s.id, info)
    if (s.dni) socioCache.set(`dni:${s.dni}`, info)
    const nameKey = `name:${normalize(s.nombre)}|${normalize(s.apellido)}`
    socioCache.set(nameKey, info)
  }

  console.log(`  Loaded ${(data || []).length} socios into cache`)
}

async function resolveSocio(
  socioId: string | undefined,
  dni: string | undefined,
  displayName: string
): Promise<SocioInfo> {
  // 1. By socio_id
  if (socioId) {
    const cached = socioCache.get(socioId)
    if (cached) return cached
    // Check DB directly
    const { data } = await supabase.from('socios').select('id, nombre, apellido, dni').eq('id', socioId).single()
    if (data) {
      const info: SocioInfo = { id: data.id, nombre: data.nombre, apellido: data.apellido, dni: data.dni, created: false }
      socioCache.set(data.id, info)
      return info
    }
  }

  // 2. By DNI
  if (dni) {
    const cachedDni = socioCache.get(`dni:${dni}`)
    if (cachedDni) return cachedDni
    const { data } = await supabase.from('socios').select('id, nombre, apellido, dni').eq('dni', dni).single()
    if (data) {
      const info: SocioInfo = { id: data.id, nombre: data.nombre, apellido: data.apellido, dni: data.dni, created: false }
      socioCache.set(data.id, info)
      socioCache.set(`dni:${dni}`, info)
      return info
    }
  }

  // 3. By normalized name
  const { nombre, apellido } = parseName(displayName)
  const nameKey = `name:${normalize(nombre)}|${normalize(apellido)}`
  const cachedName = socioCache.get(nameKey)
  if (cachedName) return cachedName

  // 4. Create new socio
  const newDni = dni || `TEMP-${crypto.createHash('md5').update(`${nombre}|${apellido}|${Date.now()}`).digest('hex').substring(0, 12)}`

  const { data: created, error } = await supabase
    .from('socios')
    .insert({
      nombre,
      apellido,
      dni: newDni,
      estado: 'activo',
      fecha_ingreso: new Date().toISOString().split('T')[0],
    })
    .select('id, nombre, apellido, dni')
    .single()

  if (error) {
    // Might be unique constraint on dni – try to find by dni
    if (error.code === '23505' && newDni) {
      const { data: existing } = await supabase.from('socios').select('id, nombre, apellido, dni').eq('dni', newDni).single()
      if (existing) {
        const info: SocioInfo = { id: existing.id, nombre: existing.nombre, apellido: existing.apellido, dni: existing.dni, created: false }
        socioCache.set(existing.id, info)
        socioCache.set(nameKey, info)
        return info
      }
    }
    throw new Error(`Failed to create socio "${displayName}": ${error.message}`)
  }

  const info: SocioInfo = { id: created.id, nombre: created.nombre, apellido: created.apellido, dni: created.dni, created: true }
  socioCache.set(created.id, info)
  if (created.dni) socioCache.set(`dni:${created.dni}`, info)
  socioCache.set(nameKey, info)
  createdSocios.push(info)

  console.log(`  [NEW SOCIO] "${nombre} ${apellido}" (dni=${newDni}) → ${created.id}`)
  return info
}

// ── Lookup helpers ───────────────────────────────────────────
let cuotasCategoriaId: string
let cuentaDesconocidaId: string
let montoDefault: number

async function setupLookups(overrideMonto?: number): Promise<void> {
  // 1. Categoria Cuotas
  const { data: confCat } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('clave', 'cuotas_categoria_id')
    .single()

  if (confCat?.valor) {
    cuotasCategoriaId = confCat.valor
  } else {
    // Find or create
    let { data: cat } = await supabase
      .from('categorias_financieras')
      .select('id')
      .eq('nombre', 'Cuotas')
      .eq('tipo', 'ingreso')
      .single()

    if (!cat) {
      const { data: created } = await supabase
        .from('categorias_financieras')
        .insert({ nombre: 'Cuotas', tipo: 'ingreso', activa: true })
        .select('id')
        .single()
      cat = created
    }

    cuotasCategoriaId = cat!.id
    await supabase.from('configuracion').upsert(
      { clave: 'cuotas_categoria_id', valor: cuotasCategoriaId },
      { onConflict: 'clave' }
    )
  }
  console.log(`  Categoria Cuotas: ${cuotasCategoriaId}`)

  // 2. Cuenta DESCONOCIDO
  let { data: cuenta } = await supabase
    .from('cuentas')
    .select('id')
    .eq('nombre', 'DESCONOCIDO')
    .single()

  if (!cuenta) {
    const { data: created } = await supabase
      .from('cuentas')
      .insert({ nombre: 'DESCONOCIDO', tipo: 'digital', activa: true })
      .select('id')
      .single()
    cuenta = created
  }
  cuentaDesconocidaId = cuenta!.id
  console.log(`  Cuenta DESCONOCIDO: ${cuentaDesconocidaId}`)

  // 3. Monto default
  if (overrideMonto) {
    montoDefault = overrideMonto
  } else {
    const { data: confMonto } = await supabase
      .from('configuracion')
      .select('valor')
      .eq('clave', 'cuota_monto_default')
      .single()

    if (confMonto?.valor) {
      montoDefault = parseFloat(confMonto.valor)
    } else {
      // Try monto_cuota key
      const { data: confMonto2 } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('clave', 'monto_cuota')
        .single()

      if (confMonto2?.valor) {
        montoDefault = parseFloat(confMonto2.valor)
      } else {
        montoDefault = 7000
        await supabase.from('configuracion').upsert(
          { clave: 'cuota_monto_default', valor: String(montoDefault) },
          { onConflict: 'clave' }
        )
      }
    }
  }
  console.log(`  Monto default cuota: $${montoDefault}`)
}

// ── Ensure unique index on external_id ───────────────────────
async function ensureExternalIdIndex(): Promise<void> {
  // Use RPC or just try – if it already exists, no harm
  const { error } = await supabase.rpc('exec_sql', {
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_movimientos_external_id ON movimientos(external_id) WHERE external_id IS NOT NULL;`
  }).single()

  if (error) {
    // RPC might not exist – warn and continue (row_hash will catch dupes)
    console.log(`  [WARN] Could not create external_id index via RPC: ${error.message}`)
    console.log(`  Will rely on row_hash uniqueness for idempotency`)
  } else {
    console.log(`  Unique index on external_id ensured`)
  }
}

// ── Step 1: Import cuotas schedule (if file provided) ────────
async function importCuotasSchedule(filePath: string): Promise<{ inserted: number; skipped: number }> {
  console.log('\n═══ Step 1: Import Cuotas Schedule ═══')
  const rows = parseCSV(filePath)
  console.log(`  ${rows.length} rows in cuotas CSV`)

  let inserted = 0, skipped = 0

  for (const row of rows) {
    const socio = await resolveSocio(row.socio_id || undefined, row.dni || undefined, row.display_name || row.nombre || '')
    const periodo = row.periodo
    const montoEsperado = row.monto_esperado ? parseFloat(row.monto_esperado) : montoDefault
    const vencimiento = row.vencimiento || lastDayOfMonth(periodo)

    // Check if cuota already exists
    const { data: existing } = await supabase
      .from('cuotas')
      .select('id')
      .eq('socio_id', socio.id)
      .eq('periodo', periodo)
      .single()

    if (existing) {
      skipped++
      continue
    }

    const { error } = await supabase.from('cuotas').insert({
      socio_id: socio.id,
      periodo,
      monto_esperado: montoEsperado,
      monto_pagado: 0,
      estado: 'pendiente',
      vencimiento,
    })

    if (error) {
      if (error.code === '23505') { skipped++; continue }
      console.warn(`  [ERROR] Cuota ${socio.id}/${periodo}: ${error.message}`)
    } else {
      inserted++
    }
  }

  console.log(`  Cuotas: ${inserted} inserted, ${skipped} skipped`)
  return { inserted, skipped }
}

// ── Step 2: Import movimientos ───────────────────────────────
async function importMovimientos(filePath: string): Promise<{
  inserted: number
  duplicated: number
  errors: number
  errorDetails: string[]
  batchId: string | null
}> {
  console.log('\n═══ Step 2: Import Movimientos (Pagos de Cuotas) ═══')
  const rows = parseCSV(filePath)
  console.log(`  ${rows.length} rows in movimientos CSV`)

  // Create batch
  const { data: batch } = await supabase
    .from('import_batches')
    .insert({
      archivo_origen: path.basename(filePath),
      hoja_origen: 'movimientos_cuotas_import',
      filas_totales: rows.length,
    })
    .select('id')
    .single()

  const batchId = batch?.id || null
  let inserted = 0, duplicated = 0, errors = 0
  const errorDetails: string[] = []

  for (const row of rows) {
    try {
      const externalId = row.external_movement_id
      if (!externalId) {
        errors++
        errorDetails.push(`Row without external_movement_id`)
        continue
      }

      // Resolve socio
      const socio = await resolveSocio(
        row.socio_id || undefined,
        row.dni || undefined,
        row.display_name || ''
      )

      const fecha = row.fecha_movimiento
      const periodo = row.periodo
      const monto = row.monto ? parseFloat(row.monto) : montoDefault
      const descripcion = row.notes || `Pago cuota ${periodo}`

      const rowHash = computeRowHash(externalId, socio.id, periodo, fecha, monto)

      const { error } = await supabase.from('movimientos').insert({
        tipo: 'ingreso',
        categoria_id: cuotasCategoriaId,
        monto,
        fecha,
        periodo,
        descripcion,
        cuenta_id: cuentaDesconocidaId,
        socio_id: socio.id,
        moneda: 'ARS',
        external_id: externalId,
        row_hash: rowHash,
        import_batch_id: batchId,
        anulado: false,
      })

      if (error) {
        if (error.code === '23505') {
          duplicated++
        } else {
          errors++
          errorDetails.push(`Mov ${externalId}: ${error.message}`)
        }
      } else {
        inserted++
      }
    } catch (e: any) {
      errors++
      errorDetails.push(`Unexpected: ${e.message}`)
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

  console.log(`  Movimientos: ${inserted} inserted, ${duplicated} duplicated, ${errors} errors`)
  return { inserted, duplicated, errors, errorDetails, batchId }
}

// ── Step 3: Import cuota_aplicaciones ────────────────────────
async function importAllocations(filePath: string): Promise<{
  inserted: number
  skipped: number
  cuotasCreated: number
  errors: number
  errorDetails: string[]
}> {
  console.log('\n═══ Step 3: Import Cuota Aplicaciones ═══')
  const rows = parseCSV(filePath)
  console.log(`  ${rows.length} rows in allocations CSV`)

  let inserted = 0, skipped = 0, cuotasCreated = 0, errors = 0
  const errorDetails: string[] = []

  for (const row of rows) {
    try {
      const externalId = row.external_movement_id
      if (!externalId) {
        errors++
        errorDetails.push(`Row without external_movement_id`)
        continue
      }

      // Find movimiento by external_id
      const { data: mov } = await supabase
        .from('movimientos')
        .select('id, monto, socio_id')
        .eq('external_id', externalId)
        .single()

      if (!mov) {
        errors++
        errorDetails.push(`Movimiento not found for external_id: ${externalId}`)
        continue
      }

      // Resolve socio (use movimiento's socio_id first, then CSV data)
      const socioId = mov.socio_id || (await resolveSocio(
        row.socio_id || undefined,
        row.dni || undefined,
        row.display_name || ''
      )).id

      const periodo = row.periodo

      // Find or create cuota for this socio+periodo
      let { data: cuota } = await supabase
        .from('cuotas')
        .select('id, monto_esperado')
        .eq('socio_id', socioId)
        .eq('periodo', periodo)
        .single()

      if (!cuota) {
        // Create cuota
        const vencimiento = lastDayOfMonth(periodo)
        const { data: created, error: createErr } = await supabase
          .from('cuotas')
          .insert({
            socio_id: socioId,
            periodo,
            monto_esperado: montoDefault,
            monto_pagado: 0,
            estado: 'pendiente',
            vencimiento,
          })
          .select('id, monto_esperado')
          .single()

        if (createErr) {
          // Might be race condition – try to find again
          if (createErr.code === '23505') {
            const { data: retry } = await supabase
              .from('cuotas')
              .select('id, monto_esperado')
              .eq('socio_id', socioId)
              .eq('periodo', periodo)
              .single()
            if (retry) {
              cuota = retry
            } else {
              errors++
              errorDetails.push(`Cuota create conflict for ${socioId}/${periodo}: ${createErr.message}`)
              continue
            }
          } else {
            errors++
            errorDetails.push(`Cuota create failed for ${socioId}/${periodo}: ${createErr.message}`)
            continue
          }
        } else {
          cuota = created!
          cuotasCreated++
        }
      }

      // Determine monto_aplicado
      const montoAplicado = row.monto_aplicado
        ? parseFloat(row.monto_aplicado)
        : cuota!.monto_esperado || montoDefault

      // Insert cuota_aplicacion (unique: movimiento_id + cuota_id)
      const { error: allocErr } = await supabase
        .from('cuota_aplicaciones')
        .insert({
          movimiento_id: mov.id,
          cuota_id: cuota!.id,
          monto_aplicado: montoAplicado,
        })

      if (allocErr) {
        if (allocErr.code === '23505') {
          skipped++
        } else {
          errors++
          errorDetails.push(`Allocation ${externalId}→${periodo}: ${allocErr.message}`)
        }
      } else {
        inserted++
      }
    } catch (e: any) {
      errors++
      errorDetails.push(`Unexpected: ${e.message}`)
    }
  }

  console.log(`  Allocations: ${inserted} inserted, ${skipped} skipped (dupes), ${cuotasCreated} cuotas auto-created, ${errors} errors`)
  return { inserted, skipped, cuotasCreated, errors, errorDetails }
}

// ── Validation Queries ───────────────────────────────────────
async function runValidation(): Promise<void> {
  console.log('\n═══ Validation ═══')

  // 1. Sum monto of imported cuota movements
  const { data: cuotaMovs } = await supabase
    .from('movimientos')
    .select('monto')
    .eq('categoria_id', cuotasCategoriaId)
    .eq('anulado', false)
    .ilike('external_id', 'APORTES:%')

  if (cuotaMovs) {
    const totalMonto = cuotaMovs.reduce((s, m) => s + Number(m.monto), 0)
    console.log(`  Total monto movimientos cuotas importados: $${totalMonto.toLocaleString('es-AR')} (${cuotaMovs.length} movs)`)
  }

  // 2. Cuotas pagadas vs pendientes por periodo
  const { data: cuotaStats } = await supabase
    .from('cuotas')
    .select('periodo, estado')

  if (cuotaStats) {
    const byPeriodo = new Map<string, { pagada: number; pendiente: number; parcial: number; vencida: number }>()
    cuotaStats.forEach(c => {
      if (!byPeriodo.has(c.periodo)) {
        byPeriodo.set(c.periodo, { pagada: 0, pendiente: 0, parcial: 0, vencida: 0 })
      }
      const entry = byPeriodo.get(c.periodo)!
      const estado = c.estado as keyof typeof entry
      if (estado in entry) entry[estado]++
    })

    console.log(`\n  Cuotas por periodo:`)
    const sorted = Array.from(byPeriodo.entries()).sort(([a], [b]) => a.localeCompare(b))
    for (const [periodo, stats] of sorted) {
      console.log(`    ${periodo}: pagada=${stats.pagada}, pendiente=${stats.pendiente}, parcial=${stats.parcial}, vencida=${stats.vencida}`)
    }
  }

  // 3. Top socios con más pagos importados
  const { data: topSocios } = await supabase
    .from('movimientos')
    .select('socio_id, socio:socios(nombre, apellido)')
    .eq('categoria_id', cuotasCategoriaId)
    .ilike('external_id', 'APORTES:%')

  if (topSocios) {
    const countBySocio = new Map<string, { nombre: string; count: number }>()
    topSocios.forEach(m => {
      if (!m.socio_id) return
      if (!countBySocio.has(m.socio_id)) {
        const s = m.socio as any
        countBySocio.set(m.socio_id, { nombre: s ? `${s.nombre} ${s.apellido}` : m.socio_id, count: 0 })
      }
      countBySocio.get(m.socio_id)!.count++
    })

    const top = Array.from(countBySocio.values()).sort((a, b) => b.count - a.count).slice(0, 10)
    console.log(`\n  Top 10 socios con más pagos importados:`)
    top.forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.nombre}: ${s.count} pagos`)
    })
  }
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs()

  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  AILE – Rebuild Historical Aportes Payments     ║')
  console.log('╚══════════════════════════════════════════════════╝')
  if (opts.dryRun) console.log('  *** DRY RUN MODE – no writes ***')

  console.log('\n═══ Setup ═══')
  await loadAllSocios()
  await setupLookups(opts.defaultMonto)
  await ensureExternalIdIndex()

  // Step 1: Cuotas schedule (optional)
  let cuotasResult = { inserted: 0, skipped: 0 }
  if (opts.cuotasFile) {
    cuotasResult = await importCuotasSchedule(opts.cuotasFile)
  } else {
    console.log('\n═══ Step 1: Skipping cuotas schedule (no --cuotas file) ═══')
  }

  // Step 2: Movimientos
  const movResult = await importMovimientos(opts.movimientosFile)

  // Step 3: Allocations
  const allocResult = await importAllocations(opts.allocationsFile)

  // Validation
  await runValidation()

  // ── Final Report ─────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║                  FINAL REPORT                   ║')
  console.log('╠══════════════════════════════════════════════════╣')
  console.log(`║  Socios creados:       ${String(createdSocios.length).padStart(6)}                   ║`)
  console.log(`║  Cuotas ins/skip:      ${String(cuotasResult.inserted).padStart(4)}/${String(cuotasResult.skipped).padStart(4)}               ║`)
  console.log(`║  Movimientos ins/dup:  ${String(movResult.inserted).padStart(4)}/${String(movResult.duplicated).padStart(4)}               ║`)
  console.log(`║  Allocations ins/skip: ${String(allocResult.inserted).padStart(4)}/${String(allocResult.skipped).padStart(4)}               ║`)
  console.log(`║  Cuotas auto-created:  ${String(allocResult.cuotasCreated).padStart(6)}                   ║`)
  console.log(`║  Total errors:         ${String(movResult.errors + allocResult.errors).padStart(6)}                   ║`)
  console.log('╚══════════════════════════════════════════════════╝')

  if (createdSocios.length > 0) {
    console.log('\n  Socios creados:')
    createdSocios.forEach(s => {
      console.log(`    - ${s.nombre} ${s.apellido} (dni=${s.dni}) → ${s.id}`)
    })
  }

  const allErrors = [...movResult.errorDetails, ...allocResult.errorDetails]
  if (allErrors.length > 0) {
    console.log(`\n  Errors (top 30):`)
    allErrors.slice(0, 30).forEach(e => console.log(`    - ${e}`))
  }

  console.log('\n✓ Import complete')
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
