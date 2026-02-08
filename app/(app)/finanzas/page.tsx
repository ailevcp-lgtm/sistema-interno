'use client'

import { Construction } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { FinanzasPage } from '@/components/aile/finanzas'

export default function Page() {
  const { hasPermission } = useAuth()

  // Si no tiene permiso, mostrar acceso denegado
  if (!hasPermission('finanzas', 'ver')) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Acceso Restringido</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Solo los miembros de la Comisión Directiva y el Revisor de Cuentas pueden acceder al módulo de finanzas.
        </p>
      </div>
    )
  }

  return <FinanzasPage />
}
