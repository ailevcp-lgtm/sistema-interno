'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Rol, Recurso, Accion } from '@/lib/types'
import { PERMISSIONS } from '@/lib/constants'
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

interface AuthContextType {
  user: AuthUser | null
  rol: Rol
  rolAile: string | null
  loading: boolean
  sessionStatus: 'unknown' | 'authenticated' | 'unauthenticated'
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithGoogle: (nextPath?: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  hasPermission: (recurso: Recurso, accion: Accion) => boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface SessionUserLike {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
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

const SOCIO_AUTH_SELECT =
  'id, usuario_id, nombre, apellido, email, estado, rol, avatar_url, rol_aile, rol_aile_definition:rol_aile_definitions(nombre)'

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
  const latestUserRef = useRef<AuthUser | null>(null)
  const router = useRouter()

  const rol = user?.rol || 'socio'
  const rolAile = user?.rol_aile || null

  useEffect(() => {
    latestUserRef.current = user
  }, [user])

  const syncUserFromSession = useCallback(async () => {
    try {
      const { data: { session } } = await runWithRecovery(
        () => supabase.auth.getSession(),
        { label: 'auth session', timeoutMs: 12_000, retries: 2, retryDelayMs: 400 }
      )

      if (!session?.user) {
        setSessionStatus('unauthenticated')
        setUser(null)
        return
      }

      const authorizedUser = await runWithRecovery(
        () => fetchAuthorizedSocioData(session.user as SessionUserLike),
        { label: 'auth authorized profile', timeoutMs: 12_000, retries: 2, retryDelayMs: 400 }
      )

      if (!authorizedUser) {
        await supabase.auth.signOut()
        setSessionStatus('unauthenticated')
        setUser(null)
        return
      }

      setSessionStatus('authenticated')
      setUser(authorizedUser)
    } catch (error) {
      if (error instanceof RequestTimeoutError || (error as { name?: string } | null)?.name === 'RequestTimeoutError') {
        // Evita ruido de "runtime error" cuando Supabase demora más de lo esperado.
        // Si ya había sesión en memoria, conservamos estado autenticado.
        if (latestUserRef.current) {
          setSessionStatus('authenticated')
        } else {
          setSessionStatus('unauthenticated')
          setUser(null)
        }

        if (process.env.NODE_ENV !== 'production') {
          console.warn('Auth session request timed out; falling back to last known auth state')
        }
        return
      }

      console.error('Error validating auth session:', error)
      setSessionStatus('unknown')
      setUser((current) => current ?? null)
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
          return
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
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
  }, [syncUserFromSession])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return { error: new Error(error.message) }
    }

    return { error: null }
  }

  const signInWithGoogle = async (nextPath: string = '/dashboard') => {
    if (typeof window === 'undefined') {
      return { error: new Error('Google OAuth solo está disponible en el navegador') }
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
    router.push('/login')
  }

  const hasPermission = useCallback((recurso: Recurso, accion: Accion): boolean => {
    const allowedRoles = PERMISSIONS[recurso]?.[accion] || []
    return allowedRoles.includes(rol)
  }, [rol])

  const refreshUser = useCallback(async () => {
    await syncUserFromSession()
  }, [syncUserFromSession])

  const value: AuthContextType = {
    user,
    rol,
    rolAile,
    loading,
    sessionStatus,
    signIn,
    signInWithGoogle,
    signOut,
    hasPermission,
    refreshUser,
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

// Hook para proteger rutas
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

// Hook para requerir permisos específicos
export function useRequirePermission(recurso: Recurso, accion: Accion, redirectTo: string = '/dashboard') {
  const { user, loading, hasPermission } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user && !hasPermission(recurso, accion)) {
      router.push(redirectTo)
    }
  }, [user, loading, hasPermission, router, recurso, accion, redirectTo])

  return { user, loading, hasPermission: hasPermission(recurso, accion) }
}
