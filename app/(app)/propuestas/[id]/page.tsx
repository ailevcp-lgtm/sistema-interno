'use client'

import { useEffect, useState, use } from 'react'
import { EditorPropuesta } from '@/components/aile/propuestas/editor'
import { useRequirePermission } from '@/hooks/useAuth'
import { usePropuestas } from '@/hooks/usePropuestas'
import type { Propuesta } from '@/lib/types'
import { Loader2 } from 'lucide-react'

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const id = resolvedParams.id

  const { loading: authLoading, hasPermission } = useRequirePermission('propuestas', 'editar', '/dashboard')
  const { getPropuestaById } = usePropuestas()
  
  const [data, setData] = useState<Propuesta | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    void getPropuestaById(id)
      .then(res => {
        setData(res)
      })
      .finally(() => {
        setDataLoading(false)
      })
  }, [id, getPropuestaById])

  if (authLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Cargando propuesta...
      </div>
    )
  }

  if (!hasPermission) return null

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No se encontró la propuesta solicitada.
      </div>
    )
  }

  return <EditorPropuesta initialData={data} />
}
