"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AileSidebar } from "@/components/aile/sidebar"
import { AileHeader } from "@/components/aile/header"
import { BottomNav } from "@/components/aile/bottom-nav"
import { useAuth } from "@/hooks/useAuth"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { hasPermission } = useAuth()

  const canViewAllDebt = hasPermission("deudas", "ver")

  // Determinar página actual basada en pathname
  const currentPage = pathname?.split("/")[1] || "dashboard"

  // Mapeo de IDs a Labels para el header
  const pageLabels: Record<string, string> = {
    dashboard: "Inicio",
    calendario: "Calendario",
    tareas: "Tareas",
    socios: "Socios",
    deudas: canViewAllDebt ? "Deudas" : "Mi deuda",
    movimientos: "Movimientos",
    finanzas: "Finanzas",
    tesoreria: "Tesorería",
    reintegros: "Reintegros",
    documentos: "Documentos",
    configuracion: "Configuración",
  }

  const handleNavigate = (page: string) => {
    if (page === "deudas" && !canViewAllDebt) {
      router.push("/deudas/mi-cuenta")
      return
    }
    router.push(`/${page}`)
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AileSidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div
        className={`flex-1 flex min-w-0 flex-col min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[240px]"
        }`}
      >
        <AileHeader
          currentPage={currentPage}
          pageLabel={pageLabels[currentPage] || "Inicio"}
        />

        <main className="flex-1 min-w-0 bg-background p-3 sm:p-4 lg:p-8 pb-[calc(6.25rem+env(safe-area-inset-bottom))] lg:pb-8">
          {children}
        </main>
      </div>

      <BottomNav currentPage={currentPage} onNavigate={handleNavigate} />
    </div>
  )
}
