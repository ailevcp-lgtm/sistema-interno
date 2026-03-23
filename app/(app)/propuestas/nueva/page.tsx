'use client'

import { EditorPropuesta } from '@/components/aile/propuestas/editor'
import { useRequirePermission } from '@/hooks/useAuth'

export default function Page() {
  const { loading, hasPermission } = useRequirePermission('propuestas', 'crear', '/dashboard')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Validando permisos...
      </div>
    )
  }

  if (!hasPermission) return null

  return <EditorPropuesta />
}
