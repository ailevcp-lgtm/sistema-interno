import { createClient } from '@supabase/supabase-js'
import { type NextRequest, type NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabase-server'
import type { Accion, Recurso } from '@/lib/types'

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey || !serviceKey) {
    throw new Error('Faltan variables de entorno de Supabase')
  }

  return { url, anonKey, serviceKey }
}

export function getServiceSupabase() {
  const { url, serviceKey } = getSupabaseEnv()
  return createClient(url, serviceKey)
}

export interface AuthenticatedSocioContext {
  userId: string
  socioId: string
  applyCookies<T extends NextResponse>(response: T): T
  hasPermission: (recurso: Recurso, accion: Accion) => Promise<boolean>
}

export async function getAuthenticatedSocioContext(
  request: NextRequest
): Promise<AuthenticatedSocioContext | null> {
  const { url, anonKey } = getSupabaseEnv()
  const serviceSupabase = getServiceSupabase()

  const authHeader = request.headers.get('authorization')
  let userId: string | null = null
  let applyCookies = <T extends NextResponse>(response: T): T => response

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const supabase = createClient(url, anonKey)
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (!error && user) {
      userId = user.id
    }
  }

  if (!userId) {
    const routeClient = createSupabaseRouteClient(request)
    const { data: { user }, error } = await routeClient.supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    userId = user.id
    applyCookies = routeClient.applyCookies
  }

  const { data: socio, error: socioError } = await serviceSupabase
    .from('socios')
    .select('id')
    .eq('usuario_id', userId)
    .eq('estado', 'activo')
    .maybeSingle()

  if (socioError || !socio?.id) {
    return null
  }

  return {
    userId,
    socioId: socio.id,
    applyCookies,
    async hasPermission(recurso, accion) {
      const { data, error } = await serviceSupabase.rpc('fn_has_resource_permission', {
        p_recurso: recurso,
        p_accion: accion,
        p_usuario_id: userId,
      })

      if (error) {
        console.error('Error checking server-side permission:', error)
        return false
      }

      return data === true
    },
  }
}
