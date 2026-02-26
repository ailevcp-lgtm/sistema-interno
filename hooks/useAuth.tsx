'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Rol, Recurso, Accion } from '@/lib/types'
import {
  hasPermission as resolvePermission,
  ROLE_PERMISSIONS_UPDATED_EVENT,
  normalizeInstitutionalRole,
  type RolePermissionOverridesMap,
} from '@/lib/constants'
import { RequestTimeoutError, runWithRecovery } from '@/lib/async-recovery'

interface AuthUser {
  id: string
  socio_id: string
  email: string
  nombre: string
  apellido: string
  rol: Rol
  avatar_url?: string
  rol_aile?: string | null
}

interface RoleSimulationState {
  rol: Rol
  rolAile: string | null
}

type TaskScopeMode = 'own_direction' | 'all_directions'

type TaskScopeSettings = {
  scopeMode: TaskScopeMode
  allowAssignedCrossDirection: boolean
}

interface AuthContextType {
  user: AuthUser | null
  rol: Rol
  rolAile: string | null
  actualRol: Rol
  actualRolAile: string | null
  loading: boolean
  sessionStatus: 'unknown' | 'authenticated' | 'unauthenticated'
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithGoogle: (nextPath?: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  hasPermission: (recurso: Recurso, accion: Accion) => boolean
  hasActualPermission: (recurso: Recurso, accion: Accion) => boolean
  taskScopeSettings: TaskScopeSettings
  getTaskScopeSettings: (rolAileValue?: string | null) => TaskScopeSettings
  refreshUser: () => Promise<void>
  canRoleSimulation: boolean
  isRoleSimulationActive: boolean
  roleSimulation: RoleSimulationState | null
  setRoleSimulation: (value: RoleSimulationState | null) => void
  clearRoleSimulation: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const ROLE_SIMULATION_STORAGE_KEY = 'aile-role-simulation'
const ROLE_SIMULATION_ALLOWED_EMAILS = new Set([
  'lautarolopezlabrin@gmail.com',
])

interface SessionUserLike {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}

interface RolePermissionOverrideRow {
  rol_aile_definition_id: string
  recurso: Recurso
  accion: Accion
  permitido: boolean
  rol_aile_definition?: { nombre?: string } | null
}

interface RoleTaskScopeOverrideRow {
  rol_aile_definition_id: string
  scope_mode: TaskScopeMode
  allow_assigned_cross_direction: boolean
  rol_aile_definition?: { nombre?: string } | null
}

interface SocioAuthRow {
  id: string
  usuario_id: string | null
  nombre: string
  apellido: string
  email: string | null
  estado: string
  rol: string | null
  avatar_url: string | null
  rol_aile: string | null
  rol_aile_definition?: { nombre?: string } | null
}

interface RequirePermissionOptions {
  useActualPermission?: boolean
}

const DEFAULT_TASK_SCOPE_SETTINGS: TaskScopeSettings = {
  scopeMode: 'own_direction',
  allowAssignedCrossDirection: true,
}

const SOCIO_AUTH_SELECT =
  'id, usuario_id, nombre, apellido, email, estado, rol, avatar_url, rol_aile, rol_aile_definition:rol_aile_definitions(nombre)'

function isValidRol(value: unknown): value is Rol {
  return value === 'socio' || value === 'comision_directiva' || value === 'revisor_cuentas' || value === 'admin'
}

function resolveSafeNextPath(nextPath?: string | null): string {
  if (!nextPath || !nextPath.startsWith('/')) return '/dashboard'
  if (nextPath.startsWith('/auth/callback')) return '/dashboard'
  return nextPath
}

function getGoogleAvatarUrl(sessionUser: SessionUserLike): string | undefined {
  const metadata = sessionUser.user_metadata
  if (!metadata) return undefined

  const candidates = [
    metadata.avatar_url,
    metadata.picture,
    metadata.photo_url,
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  return undefined
}

function mapSocioToAuthUser(
  data: SocioAuthRow,
  authEmail: string,
  googleAvatarUrl?: string
): AuthUser {
  const institutionalRole = data.rol_aile_definition?.nombre || data.rol_aile

  return {
    id: data.usuario_id || '',
    socio_id: data.id,
    email: authEmail || data.email || '',
    nombre: data.nombre,
    apellido: data.apellido,
    rol: (data.rol as Rol) || 'socio',
    avatar_url: data.avatar_url || googleAvatarUrl || undefined,
    rol_aile: institutionalRole || null,
  }
}

function readRoleSimulationFromStorage(): RoleSimulationState | null {
  if (typeof window === 'undefined') return null

  try {
    const rawValue = window.localStorage.getItem(ROLE_SIMULATION_STORAGE_KEY)
    if (!rawValue) return null

    const parsed = JSON.parse(rawValue) as { rol?: unknown; rolAile?: unknown }
    if (!isValidRol(parsed.rol)) return null

    return {
      rol: parsed.rol,
      rolAile: typeof parsed.rolAile === 'string' ? parsed.rolAile : null,
    }
  } catch {
    return null
  }
}

function persistRoleSimulationToStorage(value: RoleSimulationState | null): void {
  if (typeof window === 'undefined') return

  if (!value) {
    window.localStorage.removeItem(ROLE_SIMULATION_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(ROLE_SIMULATION_STORAGE_KEY, JSON.stringify(value))
}

function buildPermissionOverridesMap(rows: RolePermissionOverrideRow[]): RolePermissionOverridesMap {
  const overridesMap: RolePermissionOverridesMap = {}

  for (const row of rows) {
    const roleName = row.rol_aile_definition?.nombre
    if (!roleName) continue

    const normalizedRoleName = normalizeInstitutionalRole(roleName)
    if (!normalizedRoleName) continue

    overridesMap[normalizedRoleName] ||= {}
    overridesMap[normalizedRoleName]![row.recurso] ||= {}
    overridesMap[normalizedRoleName]![row.recurso]![row.accion] = row.permitido
  }

  return overridesMap
}

function buildTaskScopeOverridesMap(rows: RoleTaskScopeOverrideRow[]): Record<string, TaskScopeSettings> {
  const scopeMap: Record<string, TaskScopeSettings> = {}

  for (const row of rows) {
    const roleName = row.rol_aile_definition?.nombre
    if (!roleName) continue

    const normalizedRoleName = normalizeInstitutionalRole(roleName)
    if (!normalizedRoleName) continue

    scopeMap[normalizedRoleName] = {
      scopeMode: row.scope_mode,
      allowAssignedCrossDirection: row.allow_assigned_cross_direction,
    }
  }

  return scopeMap
}

async function fetchRolePermissionOverrides(): Promise<RolePermissionOverridesMap> {
  const { data, error } = await supabase
    .from('role_permission_overrides')
    .select(`
      rol_aile_definition_id,
      recurso,
      accion,
      permitido,
      rol_aile_definition:rol_aile_definitions(nombre)
    `)

  if (error) throw error

  return buildPermissionOverridesMap((data || []) as RolePermissionOverrideRow[])
}

async function fetchRoleTaskScopeOverrides(): Promise<Record<string, TaskScopeSettings>> {
  const { data, error } = await supabase
    .from('role_task_scope_overrides')
    .select(`
      rol_aile_definition_id,
      scope_mode,
      allow_assigned_cross_direction,
      rol_aile_definition:rol_aile_definitions(nombre)
    `)

  if (error) throw error

  return buildTaskScopeOverridesMap((data || []) as RoleTaskScopeOverrideRow[])
}

async function fetchSocioByUserId(userId: string): Promise<SocioAuthRow | null> {
  const { data, error } = await supabase
    .from('socios')
    .select(SOCIO_AUTH_SELECT)
    .eq('usuario_id', userId)
    .maybeSingle()

  if (error) throw error

  return (data as SocioAuthRow | null) || null
}

async function fetchSocioByEmail(email: string): Promise<SocioAuthRow | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return null

  const { data, error } = await supabase
    .from('socios')
    .select(SOCIO_AUTH_SELECT)
    .eq('estado', 'activo')
    .not('email', 'is', null)
    .ilike('email', normalizedEmail)
    .limit(5)

  if (error) throw error

  const exactMatches = ((data || []) as SocioAuthRow[]).filter(
    (row) => (row.email || '').trim().toLowerCase() === normalizedEmail
  )

  if (exactMatches.length > 1) {
    console.error('Multiple socios found for email during auth linking', {
      email: normalizedEmail,
      socioIds: exactMatches.map((row) => row.id),
    })
    return null
  }

  return exactMatches[0] || null
}

async function linkSocioToUserId(socioId: string, userId: string): Promise<SocioAuthRow | null> {
  const { error: updateError } = await supabase
    .from('socios')
    .update({ usuario_id: userId })
    .eq('id', socioId)
    .is('usuario_id', null)

  if (updateError) throw updateError

  const { data: reloadedSocio, error: reloadError } = await supabase
    .from('socios')
    .select(SOCIO_AUTH_SELECT)
    .eq('id', socioId)
    .maybeSingle()

  if (reloadError) throw reloadError

  return (reloadedSocio as SocioAuthRow | null) || null
}

async function fetchAuthorizedSocioData(sessionUser: SessionUserLike): Promise<AuthUser | null> {
  const authEmail = (sessionUser.email || '').trim().toLowerCase()
  const googleAvatarUrl = getGoogleAvatarUrl(sessionUser)

  let socioData = await fetchSocioByUserId(sessionUser.id)

  if (!socioData && authEmail) {
    const socioByEmail = await fetchSocioByEmail(authEmail)

    if (socioByEmail) {
      if (socioByEmail.usuario_id && socioByEmail.usuario_id !== sessionUser.id) {
        return null
      }

      socioData = socioByEmail.usuario_id
        ? socioByEmail
        : await linkSocioToUserId(socioByEmail.id, sessionUser.id)
    }
  }

  if (!socioData) return null
  if (socioData.estado !== 'activo') return null
  if (socioData.usuario_id !== sessionUser.id) return null

  return mapSocioToAuthUser(socioData, authEmail, googleAvatarUrl)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionStatus, setSessionStatus] = useState<'unknown' | 'authenticated' | 'unauthenticated'>('unknown')
  const [permissionOverrides, setPermissionOverrides] = useState<RolePermissionOverridesMap>({})
  const [taskScopeOverrides, setTaskScopeOverrides] = useState<Record<string, TaskScopeSettings>>({})
  const [roleSimulation, setRoleSimulationState] = useState<RoleSimulationState | null>(null)

  const latestUserRef = useRef<AuthUser | null>(null)
  const router = useRouter()

  const actualRol = user?.rol || 'socio'
  const actualRolAile = user?.rol_aile || null

  const canRoleSimulation = useMemo(() => {
    const normalizedEmail = (user?.email || '').trim().toLowerCase()
    if (!normalizedEmail || !ROLE_SIMULATION_ALLOWED_EMAILS.has(normalizedEmail)) return false
    return resolvePermission(actualRol, 'configuracion', 'ver', actualRolAile, permissionOverrides)
  }, [actualRol, actualRolAile, permissionOverrides, user?.email])

  const rol = (canRoleSimulation && roleSimulation) ? roleSimulation.rol : actualRol
  const rolAile = (canRoleSimulation && roleSimulation) ? (roleSimulation.rolAile ?? actualRolAile) : actualRolAile
  const getTaskScopeSettings = useCallback((rolAileValue?: string | null): TaskScopeSettings => {
    const normalized = normalizeInstitutionalRole(rolAileValue)
    if (!normalized) return DEFAULT_TASK_SCOPE_SETTINGS
    return taskScopeOverrides[normalized] || DEFAULT_TASK_SCOPE_SETTINGS
  }, [taskScopeOverrides])
  const taskScopeSettings = useMemo(() => getTaskScopeSettings(rolAile), [getTaskScopeSettings, rolAile])

  useEffect(() => {
    latestUserRef.current = user
  }, [user])

  useEffect(() => {
    setRoleSimulationState(readRoleSimulationFromStorage())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePermissionOverridesUpdated = () => {
      void (async () => {
        try {
          const [dynamicPermissionOverrides, dynamicTaskScopeOverrides] = await Promise.all([
            runWithRecovery(
              () => fetchRolePermissionOverrides(),
              { label: 'auth role permission overrides refresh', timeoutMs: 12_000, retries: 2, retryDelayMs: 400 }
            ),
            runWithRecovery(
              () => fetchRoleTaskScopeOverrides(),
              { label: 'auth role task scope overrides refresh', timeoutMs: 12_000, retries: 2, retryDelayMs: 400 }
            ),
          ])
          setPermissionOverrides(dynamicPermissionOverrides)
          setTaskScopeOverrides(dynamicTaskScopeOverrides)
        } catch (error) {
          console.error('Error refreshing role permission overrides:', error)
        }
      })()
    }

    window.addEventListener(ROLE_PERMISSIONS_UPDATED_EVENT, handlePermissionOverridesUpdated)
    return () => {
      window.removeEventListener(ROLE_PERMISSIONS_UPDATED_EVENT, handlePermissionOverridesUpdated)
    }
  }, [])

  useEffect(() => {
    if (!user || !canRoleSimulation) {
      setRoleSimulationState((current) => {
        if (!current) return current
        persistRoleSimulationToStorage(null)
        return null
      })
    }
  }, [canRoleSimulation, user])

  const setRoleSimulation = useCallback((value: RoleSimulationState | null) => {
    setRoleSimulationState(value)
    persistRoleSimulationToStorage(value)
  }, [])

  const clearRoleSimulation = useCallback(() => {
    setRoleSimulationState(null)
    persistRoleSimulationToStorage(null)
  }, [])

  const syncUserFromSession = useCallback(async () => {
    try {
      const { data: { session } } = await runWithRecovery(
        () => supabase.auth.getSession(),
        { label: 'auth session', timeoutMs: 12_000, retries: 2, retryDelayMs: 400 }
      )

      if (!session?.user) {
        setSessionStatus('unauthenticated')
        setUser(null)
        setPermissionOverrides({})
        setTaskScopeOverrides({})
        return
      }

      const [authorizedUser, dynamicPermissionOverrides, dynamicTaskScopeOverrides] = await Promise.all([
        runWithRecovery(
          () => fetchAuthorizedSocioData(session.user as SessionUserLike),
          { label: 'auth authorized profile', timeoutMs: 12_000, retries: 2, retryDelayMs: 400 }
        ),
        runWithRecovery(
          () => fetchRolePermissionOverrides(),
          { label: 'auth role permission overrides', timeoutMs: 12_000, retries: 2, retryDelayMs: 400 }
        ),
        runWithRecovery(
          () => fetchRoleTaskScopeOverrides(),
          { label: 'auth role task scope overrides', timeoutMs: 12_000, retries: 2, retryDelayMs: 400 }
        ),
      ])

      if (!authorizedUser) {
        await supabase.auth.signOut()
        setSessionStatus('unauthenticated')
        setUser(null)
        setPermissionOverrides({})
        setTaskScopeOverrides({})
        return
      }

      setSessionStatus('authenticated')
      setUser(authorizedUser)
      setPermissionOverrides(dynamicPermissionOverrides)
      setTaskScopeOverrides(dynamicTaskScopeOverrides)
    } catch (error) {
      if (error instanceof RequestTimeoutError || (error as { name?: string } | null)?.name === 'RequestTimeoutError') {
        if (latestUserRef.current) {
          setSessionStatus('authenticated')
        } else {
          setSessionStatus('unauthenticated')
          setUser(null)
          setPermissionOverrides({})
          setTaskScopeOverrides({})
        }

        if (process.env.NODE_ENV !== 'production') {
          console.warn('Auth session request timed out; falling back to last known auth state')
        }
        return
      }

      console.error('Error validating auth session:', error)
      if (latestUserRef.current) {
        setSessionStatus('authenticated')
        setUser(latestUserRef.current)
        return
      }

      setSessionStatus('unauthenticated')
      setUser(null)
      setPermissionOverrides({})
      setTaskScopeOverrides({})
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      setLoading(true)
      await syncUserFromSession()
      if (mounted) {
        setLoading(false)
      }
    }

    void initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      try {
        if (event === 'SIGNED_OUT') {
          setSessionStatus('unauthenticated')
          setUser(null)
          setPermissionOverrides({})
          setTaskScopeOverrides({})
          clearRoleSimulation()
          return
        }

        if (event === 'TOKEN_REFRESHED') {
          if (latestUserRef.current) {
            setSessionStatus('authenticated')
          }
          return
        }

        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          await syncUserFromSession()
        }
      } catch (error) {
        console.error('Error handling auth state change:', error)
      } finally {
        if (mounted) setLoading((prev) => (prev ? false : prev))
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [clearRoleSimulation, syncUserFromSession])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return { error: new Error(error.message) }
    }

    return { error: null }
  }

  const signInWithGoogle = async (nextPath: string = '/dashboard') => {
    if (typeof window === 'undefined') {
      return { error: new Error('Google OAuth solo esta disponible en el navegador') }
    }

    const safeNextPath = resolveSafeNextPath(nextPath)
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    callbackUrl.searchParams.set('next', safeNextPath)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })

    if (error) {
      return { error: new Error(error.message) }
    }

    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSessionStatus('unauthenticated')
    setUser(null)
    setPermissionOverrides({})
    setTaskScopeOverrides({})
    clearRoleSimulation()
    router.push('/login')
  }

  const hasPermission = useCallback((recurso: Recurso, accion: Accion): boolean => {
    return resolvePermission(rol, recurso, accion, rolAile, permissionOverrides)
  }, [rol, rolAile, permissionOverrides])

  const hasActualPermission = useCallback((recurso: Recurso, accion: Accion): boolean => {
    return resolvePermission(actualRol, recurso, accion, actualRolAile, permissionOverrides)
  }, [actualRol, actualRolAile, permissionOverrides])

  const refreshUser = useCallback(async () => {
    await syncUserFromSession()
  }, [syncUserFromSession])

  const value: AuthContextType = {
    user,
    rol,
    rolAile,
    actualRol,
    actualRolAile,
    loading,
    sessionStatus,
    signIn,
    signInWithGoogle,
    signOut,
    hasPermission,
    hasActualPermission,
    taskScopeSettings,
    getTaskScopeSettings,
    refreshUser,
    canRoleSimulation,
    isRoleSimulationActive: Boolean(canRoleSimulation && roleSimulation),
    roleSimulation,
    setRoleSimulation,
    clearRoleSimulation,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}

export function useRequireAuth(redirectTo: string = '/login') {
  const { user, loading, sessionStatus } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user && sessionStatus === 'unauthenticated') {
      router.push(redirectTo)
    }
  }, [user, loading, sessionStatus, router, redirectTo])

  return { user, loading }
}

export function useRequirePermission(
  recurso: Recurso,
  accion: Accion,
  redirectTo: string = '/dashboard',
  options: RequirePermissionOptions = {}
) {
  const { user, loading, hasPermission, hasActualPermission } = useAuth()
  const router = useRouter()

  const permissionResolver = options.useActualPermission ? hasActualPermission : hasPermission
  const isAllowed = permissionResolver(recurso, accion)

  useEffect(() => {
    if (!loading && user && !isAllowed) {
      router.push(redirectTo)
    }
  }, [user, loading, isAllowed, router, redirectTo])

  return { user, loading, hasPermission: isAllowed }
}
