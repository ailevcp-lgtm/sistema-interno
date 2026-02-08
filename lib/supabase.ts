import { createBrowserClient } from '@supabase/ssr'
import type { Rol } from './types'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function getUserRole(userId: string): Promise<Rol> {
  const { data, error } = await supabase
    .from('socios')
    .select('rol')
    .eq('usuario_id', userId)
    .single()

  if (error || !data) return 'socio'
  return (data.rol as Rol) || 'socio'
}

export function hasRole(userRol: Rol, requiredRol: Rol): boolean {
  const hierarchy: Record<Rol, number> = {
    socio: 0,
    revisor_cuentas: 1,
    comision_directiva: 2,
    admin: 3,
  }
  return hierarchy[userRol] >= hierarchy[requiredRol]
}
