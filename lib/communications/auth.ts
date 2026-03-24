import type { NextRequest } from 'next/server'
import { getAuthenticatedSocioContext, getServiceSupabase } from '@/lib/server-auth'

export interface AuthenticatedCommunicationsContext {
  userId: string
  socioId: string
  isAllowlistedOnly: boolean
  canManageAccess: boolean
}

export async function getAuthenticatedCommunicationsContext(
  request: NextRequest
): Promise<AuthenticatedCommunicationsContext | null> {
  const authContext = await getAuthenticatedSocioContext(request)
  if (!authContext) return null

  const serviceSupabase = getServiceSupabase()
  const [roleBasedAccess, manageAccess, allowlistResult] = await Promise.all([
    authContext.hasPermission('comunicaciones', 'ver'),
    Promise.all([
      authContext.hasPermission('comunicaciones', 'editar'),
      authContext.hasPermission('configuracion', 'editar'),
    ]).then(([canEditCommunications, canEditSettings]) => canEditCommunications || canEditSettings),
    serviceSupabase
      .from('communication_module_access')
      .select('id')
      .eq('user_id', authContext.userId)
      .maybeSingle(),
  ])

  if (allowlistResult.error) {
    throw allowlistResult.error
  }

  const allowlisted = Boolean(allowlistResult.data?.id)
  if (!roleBasedAccess && !allowlisted) {
    return null
  }

  return {
    userId: authContext.userId,
    socioId: authContext.socioId,
    isAllowlistedOnly: allowlisted && !roleBasedAccess,
    canManageAccess: manageAccess,
  }
}
