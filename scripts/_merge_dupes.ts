/**
 * Merge duplicate TEMP socios into their real counterparts.
 * Reassigns cuotas, movimientos, cuota_aplicaciones, then deletes the TEMP socio.
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

// Map: TEMP socio_id → real socio_id
const MERGES: [string, string][] = [
  // [TEMP_ID, REAL_ID]
  ['6bc0c875-9473-4784-853b-49c3ceaa1789', '0af5e989-e85f-494f-8749-4a23cf18b981'], // Paz Maria Juarez
  ['85f4e73b-71b5-42cb-adb8-358f372ca95c', '750b1258-7100-4fe3-aa0f-afae00d02449'], // Lautaro Lopez Labrin
]

async function mergeSocio(tempId: string, realId: string) {
  // Get TEMP socio info
  const { data: temp } = await sb.from('socios').select('nombre, apellido, dni').eq('id', tempId).single()
  const { data: real } = await sb.from('socios').select('nombre, apellido, dni').eq('id', realId).single()
  console.log(`\nMerging: "${temp?.nombre} ${temp?.apellido}" (${tempId})`)
  console.log(`   into: "${real?.nombre} ${real?.apellido}" (${realId})`)

  // 1. Get cuotas from TEMP
  const { data: tempCuotas } = await sb.from('cuotas').select('id, periodo').eq('socio_id', tempId)
  console.log(`  TEMP cuotas: ${tempCuotas?.length}`)

  for (const tc of tempCuotas || []) {
    // Check if real socio already has a cuota for this periodo
    const { data: realCuota } = await sb.from('cuotas')
      .select('id')
      .eq('socio_id', realId)
      .eq('periodo', tc.periodo)
      .single()

    if (realCuota) {
      // Real socio already has cuota for this period
      // Move allocations from TEMP cuota to real cuota
      const { data: allocs } = await sb.from('cuota_aplicaciones')
        .select('id, movimiento_id, monto_aplicado')
        .eq('cuota_id', tc.id)

      for (const a of allocs || []) {
        // Check if allocation already exists for real cuota + same movimiento
        const { data: existing } = await sb.from('cuota_aplicaciones')
          .select('id')
          .eq('cuota_id', realCuota.id)
          .eq('movimiento_id', a.movimiento_id)
          .single()

        if (existing) {
          // Already exists, just delete the TEMP one
          await sb.from('cuota_aplicaciones').delete().eq('id', a.id)
          console.log(`    Allocation ${a.id}: deleted (already exists on real cuota)`)
        } else {
          // Move allocation to real cuota
          const { error } = await sb.from('cuota_aplicaciones')
            .update({ cuota_id: realCuota.id })
            .eq('id', a.id)
          if (error) {
            console.error(`    Allocation ${a.id}: FAILED to move: ${error.message}`)
          } else {
            console.log(`    Allocation ${a.id}: moved to real cuota ${realCuota.id}`)
          }
        }
      }

      // Delete the TEMP cuota (now has no allocations)
      const { error: delErr } = await sb.from('cuotas').delete().eq('id', tc.id)
      if (delErr) {
        console.error(`    Cuota ${tc.id} (${tc.periodo}): FAILED to delete: ${delErr.message}`)
      } else {
        console.log(`    Cuota ${tc.id} (${tc.periodo}): deleted (real already has this periodo)`)
      }
    } else {
      // No cuota for this periodo on real socio — just reassign
      const { error } = await sb.from('cuotas').update({ socio_id: realId }).eq('id', tc.id)
      if (error) {
        console.error(`    Cuota ${tc.id} (${tc.periodo}): FAILED to reassign: ${error.message}`)
      } else {
        console.log(`    Cuota ${tc.id} (${tc.periodo}): reassigned to real socio`)
      }
    }
  }

  // 2. Reassign movimientos
  const { data: tempMovs } = await sb.from('movimientos').select('id, external_id').eq('socio_id', tempId)
  console.log(`  TEMP movimientos: ${tempMovs?.length}`)

  for (const m of tempMovs || []) {
    const { error } = await sb.from('movimientos').update({ socio_id: realId }).eq('id', m.id)
    if (error) {
      console.error(`    Movimiento ${m.id}: FAILED: ${error.message}`)
    } else {
      console.log(`    Movimiento ${m.id} (${m.external_id}): reassigned`)
    }
  }

  // 3. Delete TEMP socio
  // Double check no remaining references
  const { count: remainingCuotas } = await sb.from('cuotas').select('*', { count: 'exact', head: true }).eq('socio_id', tempId)
  const { count: remainingMovs } = await sb.from('movimientos').select('*', { count: 'exact', head: true }).eq('socio_id', tempId)

  if ((remainingCuotas || 0) > 0 || (remainingMovs || 0) > 0) {
    console.error(`  [SKIP DELETE] TEMP socio still has ${remainingCuotas} cuotas, ${remainingMovs} movimientos`)
    return
  }

  const { error: delSocio } = await sb.from('socios').delete().eq('id', tempId)
  if (delSocio) {
    console.error(`  [ERROR] Failed to delete TEMP socio: ${delSocio.message}`)
  } else {
    console.log(`  ✓ TEMP socio deleted: ${tempId}`)
  }
}

async function main() {
  console.log('═══ Merging Duplicate Socios ═══')

  for (const [tempId, realId] of MERGES) {
    await mergeSocio(tempId, realId)
  }

  console.log('\n═══ Verification ═══')
  const { count: tempCount } = await sb.from('socios').select('*', { count: 'exact', head: true }).ilike('dni', 'TEMP-%')
  console.log(`Remaining TEMP socios: ${tempCount}`)

  // Verify the real socios now have the cuotas
  for (const [, realId] of MERGES) {
    const { data: s } = await sb.from('socios').select('nombre, apellido').eq('id', realId).single()
    const { data: cuotas } = await sb.from('cuotas').select('periodo, estado, monto_pagado').eq('socio_id', realId)
    console.log(`\n${s?.nombre} ${s?.apellido}:`)
    cuotas?.sort((a, b) => a.periodo.localeCompare(b.periodo)).forEach(c => {
      console.log(`  ${c.periodo}: ${c.estado} ($${c.monto_pagado})`)
    })
  }

  console.log('\n✓ Merge complete')
}

main()
