'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout/app-shell'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, sessionStatus } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user && sessionStatus === 'unauthenticated') {
      router.push('/login')
    }
  }, [user, loading, sessionStatus, router])

  if (loading || (!user && sessionStatus === 'unknown')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#6314a7] to-[#e50051] animate-pulse flex items-center justify-center shadow-sm">
            <img
              src="/images/aile-logo-white.png"
              alt="AILE"
              className="h-7 w-auto object-contain"
            />
          </div>
          <p className="text-muted-foreground">Reconectando sesión...</p>
        </div>
      </div>
    )
  }

  if (!user && sessionStatus === 'unauthenticated') {
    return null
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Recuperando perfil...</p>
      </div>
    )
  }

  return <AppShell>{children}</AppShell>
}
