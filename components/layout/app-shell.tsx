"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AileSidebar } from "@/components/aile/sidebar"
import { AileHeader } from "@/components/aile/header"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Determinar página actual basada en pathname
  const currentPage = pathname?.split("/")[1] || "dashboard"

  // Mapeo de IDs a Labels para el header
  const pageLabels: Record<string, string> = {
    dashboard: "Inicio",
    socios: "Socios",
    deudas: "Deudas",
    finanzas: "Finanzas",
    documentos: "Documentos",
    configuracion: "Configuración",
  }

  const handleNavigate = (page: string) => {
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
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[240px]"
        }`}
      >
        <AileHeader
          currentPage={currentPage}
          pageLabel={pageLabels[currentPage] || "Inicio"}
        />

        <main className="flex-1 p-4 lg:p-8 bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
