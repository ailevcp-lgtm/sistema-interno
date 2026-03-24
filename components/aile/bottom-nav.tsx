"use client"

import { MoreHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import {
  getMobileNavItemLabel,
  getNavItemLabel,
  getVisibleAppNavItems,
  MOBILE_PRIMARY_NAV_COUNT,
} from "@/lib/navigation"

interface BottomNavProps {
  currentPage: string
  onNavigate: (page: string) => void
}

export function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  const [showMore, setShowMore] = useState(false)
  const { hasPermission, user } = useAuth()
  const canViewAllDebt = hasPermission("deudas", "ver")
  const visibleItems = getVisibleAppNavItems({
    hasPermission,
    hasSocioId: Boolean(user?.socio_id),
  })

  const mainNavItems = visibleItems.slice(0, MOBILE_PRIMARY_NAV_COUNT)
  const moreItems = visibleItems.slice(MOBILE_PRIMARY_NAV_COUNT)
  const hasMoreItems = moreItems.length > 0
  const totalSlots = mainNavItems.length + (hasMoreItems ? 1 : 0)

  return (
    <>
      {showMore && hasMoreItems && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
          <div
            className="absolute bottom-[calc(72px+env(safe-area-inset-bottom))] left-3 right-3 max-h-[60vh] overflow-y-auto bg-card rounded-xl p-3 border border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mas opciones</span>
              <button onClick={() => setShowMore(false)} className="text-muted-foreground p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {moreItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id)
                    setShowMore(false)
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm",
                    currentPage === item.id
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  <span>{getNavItemLabel(item, { canViewAllDebt })}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-card border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div
          className="grid h-16 items-center px-1"
          style={{ gridTemplateColumns: `repeat(${Math.max(totalSlots, 1)}, minmax(0, 1fr))` }}
        >
          {mainNavItems.map((item) => {
            const isActive = currentPage === item.id
            const itemLabel = getMobileNavItemLabel(item, { canViewAllDebt })
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "flex w-full min-w-0 flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
                <span className={cn("text-[10px]", isActive ? "font-semibold" : "font-medium")}>
                  {itemLabel}
                </span>
              </button>
            )
          })}
          {hasMoreItems && (
            <button
              onClick={() => setShowMore(!showMore)}
              className={cn(
                "flex w-full min-w-0 flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg transition-colors",
                moreItems.some((item) => item.id === currentPage) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <MoreHorizontal className="w-5 h-5" strokeWidth={1.8} />
              <span className="text-[10px] font-medium">Mas</span>
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
