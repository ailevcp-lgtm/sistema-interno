"use client"

import {
  LayoutGrid,
  Users,
  BarChart2,
  FileText,
  MoreHorizontal,
  CreditCard,
  Settings,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

const mainNavItems = [
  { id: "dashboard", label: "Inicio", icon: LayoutGrid },
  { id: "socios", label: "Socios", icon: Users },
  { id: "finanzas", label: "Finanzas", icon: BarChart2 },
  { id: "documentos", label: "Docs", icon: FileText },
]

const moreItems = [
  { id: "deudas", label: "Deudas", icon: CreditCard },
  { id: "configuracion", label: "Ajustes", icon: Settings },
]

interface BottomNavProps {
  currentPage: string
  onNavigate: (page: string) => void
}

export function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      {showMore && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
          <div
            className="absolute bottom-[72px] left-3 right-3 bg-card rounded-xl p-3 border border-border shadow-lg"
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
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-card border-t border-border">
        <div className="flex items-center justify-around h-16 px-1">
          {mainNavItems.map((item) => {
            const isActive = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
                <span className={cn("text-[10px]", isActive ? "font-semibold" : "font-medium")}>
                  {item.label}
                </span>
              </button>
            )
          })}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors",
              moreItems.some((i) => i.id === currentPage) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="w-5 h-5" strokeWidth={1.8} />
            <span className="text-[10px] font-medium">Mas</span>
          </button>
        </div>
      </nav>
    </>
  )
}
