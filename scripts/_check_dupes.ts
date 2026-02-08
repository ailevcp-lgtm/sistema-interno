import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

async function main() {
  const { data: temps } = await sb.from('socios').select('id, nombre, apellido, dni').ilike('dni', 'TEMP-%')
  console.log('TEMP socios:', JSON.stringify(temps, null, 2))

  for (const t of temps || []) {
    const { data: all } = await sb.from('socios').select('id, nombre, apellido, dni, email').neq('id', t.id)

    const tParts = [norm(t.nombre), norm(t.apellido)].join(' ').split(/\s+/)

    const similar = (all || []).filter(m => {
      const mParts = [norm(m.nombre), norm(m.apellido)].join(' ').split(/\s+/)
      const overlap = tParts.filter(p => mParts.some(mp => mp.includes(p) || p.includes(mp)))
      return overlap.length >= 2
    })

    console.log(`\nTEMP: "${t.nombre} ${t.apellido}" (id=${t.id}, dni=${t.dni})`)
    if (similar.length > 0) {
      console.log('  MATCH FOUND:')
      similar.forEach(s => console.log(`    → "${s.nombre} ${s.apellido}" (id=${s.id}, dni=${s.dni}, email=${s.email})`))
    } else {
      console.log('  No match found - truly new socio')
    }

    const { data: cuotas } = await sb.from('cuotas').select('id, periodo, estado').eq('socio_id', t.id)
    const { data: movs } = await sb.from('movimientos').select('id, external_id').eq('socio_id', t.id)
    const { data: allocs } = await sb.from('cuota_aplicaciones').select('id, cuota_id, movimiento_id')
      .in('cuota_id', (cuotas || []).map(c => c.id))
    console.log(`  Cuotas: ${cuotas?.length}`, cuotas?.map(c => `${c.periodo}(${c.estado})`).join(', '))
    console.log(`  Movimientos: ${movs?.length}`)
    console.log(`  Allocations: ${allocs?.length}`)
  }
}
main()
