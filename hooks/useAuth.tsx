'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Rol, Recurso, Accion } from '@/lib/types'
import { PERMISSIONS } from '@/lib/constants'

interface AuthUser {
  id: string
  socio_id: string
  email: string
  nombre: string
  apellido: string
  rol: Rol
  avatar_url?: string
}

interface AuthContextType {
  user: AuthUser | null
  rol: Rol
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  hasPermission: (recurso: Recurso, accion: Accion) => boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchSocioData(userId: string, authEmail: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('socios')
    .select('id, usuario_id, nombre, apellido, rol, avatar_url')
    .eq('usuario_id', userId)
    .single()

  if (error || !data) return null

  return {
    id: data.usuario_id,
    socio_id: data.id,
    email: authEmail,
    nombre: data.nombre,
    apellido: data.apellido,
    rol: (data.rol as Rol) || 'socio',
    avatar_url: data.avatar_url,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const rol = user?.rol || 'socio'

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        const socioData = await fetchSocioData(session.user.id, session.user.email || '')
        setUser(socioData)
      }
      setLoading(false)
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const socioData = await fetchSocioData(session.user.id, session.user.email || '')
        setUser(socioData)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return { error: new Error(error.message) }
    }

    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
  }

  const hasPermission = (recurso: Recurso, accion: Accion): boolean => {
    const allowedRoles = PERMISSIONS[recurso]?.[accion] || []
    return allowedRoles.includes(rol)
  }

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const socioData = await fetchSocioData(session.user.id, session.user.email || '')
      setUser(socioData)
    }
  }

  const value: AuthContextType = {
    user,
    rol,
    loading,
    signIn,
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
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push(redirectTo)
    }
  }, [user, loading, router, redirectTo])

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
