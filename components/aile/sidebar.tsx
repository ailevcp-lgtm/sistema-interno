"use client"

import {
  LayoutGrid,
  CalendarDays,
  KanbanSquare,
  Users,
  CreditCard,
  ArrowUpDown,
  BarChart2,
  FileText,
  Settings,
  Landmark,
  ReceiptText,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"

const navItems = [
  { id: "dashboard", label: "Inicio", icon: LayoutGrid, recurso: "dashboard" as const },
  { id: "calendario", label: "Calendario", icon: CalendarDays, recurso: "calendario" as const },
  { id: "tareas", label: "Tareas", icon: KanbanSquare, recurso: "tareas" as const },
  { id: "socios", label: "Socios", icon: Users, recurso: "socios" as const },
  { id: "deudas", label: "Deudas", icon: CreditCard, recurso: "deudas" as const, allowOwnDebtView: true },
  { id: "movimientos", label: "Movimientos", icon: ArrowUpDown, recurso: "movimientos" as const },
  { id: "finanzas", label: "Finanzas", icon: BarChart2, recurso: "finanzas" as const },
  { id: "tesoreria", label: "Tesorería", icon: Landmark, recurso: "tesoreria" as const },
  { id: "reintegros", label: "Reintegros", icon: ReceiptText, recurso: "reintegros" as const },
  { id: "documentos", label: "Documentos", icon: FileText, recurso: "documentos" as const },
  { id: "configuracion", label: "Ajustes", icon: Settings, recurso: "configuracion" as const },
] as const

interface SidebarProps {
  currentPage: string
  onNavigate: (page: string) => void
  collapsed: boolean
  onToggle: () => void
}

export function AileSidebar({ currentPage, onNavigate, collapsed, onToggle }: SidebarProps) {
  const { hasPermission, user } = useAuth()
  const canViewAllDebt = hasPermission("deudas", "ver")

  const visibleNavItems = navItems.filter((item) => {
    if ('allowOwnDebtView' in item && item.allowOwnDebtView) {
      return hasPermission(item.recurso, "ver") || Boolean(user)
    }
    return hasPermission(item.recurso, "ver")
  })

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-screen fixed left-0 top-0 z-40 transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
      style={{ backgroundColor: "#6314a7" }}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-16 px-4",
        collapsed ? "justify-center" : "gap-3"
      )}>
        <img
          src="/images/aile-logo-white.png"
          alt="AILE"
          className="h-8 w-auto shrink-0 object-contain"
        />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-wider text-white/90">
              AILE
            </span>
            <span className="text-[10px] text-white/50 leading-tight">
              Sistema interno de socios
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-white/15" />

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-0.5">
        {visibleNavItems.map((item) => {
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-white/20 text-white font-semibold"
                  : "text-white/65 hover:text-white hover:bg-white/10"
              )}
              title={collapsed ? (item.id === "deudas" && !canViewAllDebt ? "Mi deuda" : item.label) : undefined}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
              {!collapsed && <span>{item.id === "deudas" && !canViewAllDebt ? "Mi deuda" : item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Collapse */}
      <div className="px-2 pb-4">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="w-[18px] h-[18px]" strokeWidth={1.8} />
          ) : (
            <PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.8} />
          )}
        </button>
      </div>
    </aside>
  )
}
