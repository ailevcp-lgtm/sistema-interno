'use client'

import { PropuestasPage } from '@/components/aile/propuestas'
import { useRequirePermission } from '@/hooks/useAuth'

export default function Page() {
  const { loading, hasPermission } = useRequirePermission('propuestas', 'ver', '/dashboard')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Validando permisos...
      </div>
    )
  }

  if (!hasPermission) return null

  return <PropuestasPage />
}
