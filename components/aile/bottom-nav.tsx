"use client"

import {
  LayoutGrid,
  CalendarDays,
  KanbanSquare,
  Users,
  BarChart2,
  FileText,
  ArrowUpDown,
  MoreHorizontal,
  CreditCard,
  Settings,
  Landmark,
  ReceiptText,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"

const navItems = [
  { id: "dashboard", label: "Inicio", icon: LayoutGrid, recurso: "dashboard" as const },
  { id: "socios", label: "Socios", icon: Users, recurso: "socios" as const },
  { id: "finanzas", label: "Finanzas", icon: BarChart2, recurso: "finanzas" as const },
  { id: "documentos", label: "Docs", icon: FileText, recurso: "documentos" as const },
  { id: "calendario", label: "Calendario", icon: CalendarDays, recurso: "calendario" as const },
  { id: "tareas", label: "Tareas", icon: KanbanSquare, recurso: "tareas" as const },
  { id: "deudas", label: "Deudas", icon: CreditCard, recurso: "deudas" as const, allowOwnDebtView: true },
  { id: "movimientos", label: "Movimientos", icon: ArrowUpDown, recurso: "movimientos" as const },
  { id: "tesoreria", label: "Tesorería", icon: Landmark, recurso: "tesoreria" as const },
  { id: "reintegros", label: "Reintegros", icon: ReceiptText, recurso: "reintegros" as const },
  { id: "configuracion", label: "Ajustes", icon: Settings, recurso: "configuracion" as const },
] as const

interface BottomNavProps {
  currentPage: string
  onNavigate: (page: string) => void
}

export function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  const [showMore, setShowMore] = useState(false)
  const { hasPermission, user } = useAuth()
  const canViewAllDebt = hasPermission("deudas", "ver")

  const visibleItems = navItems.filter((item) => {
    if ('allowOwnDebtView' in item && item.allowOwnDebtView) {
      return hasPermission(item.recurso, "ver") || Boolean(user)
    }
    return hasPermission(item.recurso, "ver")
  })

  const mainNavItems = visibleItems.slice(0, 4)
  const moreItems = visibleItems.slice(4)
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
                  <span>{item.id === "deudas" && !canViewAllDebt ? "Mi deuda" : item.label}</span>
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
                  {item.id === "deudas" && !canViewAllDebt ? "Mi deuda" : item.label}
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
