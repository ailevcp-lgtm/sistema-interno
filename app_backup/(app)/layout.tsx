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
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0618] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#6314a7] to-[#e50051] animate-pulse" />
          <p className="text-[#7c6a94]">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <AppShell>{children}</AppShell>
}
