"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AileSidebar } from "@/components/aile/sidebar"
import { AileHeader } from "@/components/aile/header"
import { BottomNav } from "@/components/aile/bottom-nav"
import { GuideContextBar } from "@/components/aile/guide/guide-context-bar"
import { useAuth } from "@/hooks/useAuth"
import { getGuideHrefForPath } from "@/lib/guide-content"
import { getPageLabel } from "@/lib/navigation"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { hasPermission } = useAuth()

  const canViewAllDebt = hasPermission("deudas", "ver")

  // Determinar página actual basada en pathname
  const currentPage = pathname?.split("/")[1] || "dashboard"
  const guideHref = getGuideHrefForPath(pathname)

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
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[240px]"
        }`}
      >
        <AileHeader
          currentPage={currentPage}
          pageLabel={getPageLabel(currentPage, { canViewAllDebt })}
          guideHref={guideHref}
        />

        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8 bg-background">
          <div className="mb-6">
            <GuideContextBar
              pathname={pathname || ""}
              pageLabel={getPageLabel(currentPage, { canViewAllDebt })}
            />
          </div>
          {children}
        </main>
      </div>

      <BottomNav currentPage={currentPage} onNavigate={handleNavigate} />
    </div>
  )
}
