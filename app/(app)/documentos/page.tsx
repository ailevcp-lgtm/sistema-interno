'use client'

import { DocumentosPage } from '@/components/aile/documentos'
import { useRequirePermission } from '@/hooks/useAuth'

export default function Page() {
  const { loading, hasPermission } = useRequirePermission('documentos', 'ver', '/dashboard')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Validando permisos...
      </div>
    )
  }

  if (!hasPermission) return null

  return <DocumentosPage />
}
