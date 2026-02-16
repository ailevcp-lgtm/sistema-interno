"use client"

import { Search, Bell, ChevronDown, User, LogOut, CreditCard } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/useAuth"
import { NotificationsPopover } from "@/components/aile/notifications-popover"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const roleStyles: Record<string, { bg: string; text: string; label: string }> = {
  socio: { bg: "#f3f4f6", text: "#6b7280", label: "Socio" },
  comision_directiva: { bg: "#ede5f7", text: "#6314a7", label: "Comisión Directiva" },
  revisor_cuentas: { bg: "#fef3c7", text: "#b45309", label: "Revisor de Cuentas" },
  admin: { bg: "#fde2e8", text: "#e50051", label: "Admin" },
}

interface HeaderProps {
  currentPage: string
  pageLabel: string
}

export function AileHeader({ currentPage, pageLabel }: HeaderProps) {
  const { user: authUser, signOut } = useAuth()

  const user = {
    name: authUser ? `${authUser.nombre} ${authUser.apellido}` : "",
    role: authUser?.rol || "socio",
    avatarUrl: authUser?.avatar_url || "",
    initials: authUser ? `${authUser.nombre?.[0] || ""}${authUser.apellido?.[0] || ""}`.toUpperCase() : "",
  }

  const roleConfig = roleStyles[user.role] || roleStyles.socio

  return (
    <header className="sticky top-0 z-30 h-14 bg-card border-b border-border flex items-center justify-between px-4 lg:px-8">
      {/* Mobile: Logo */}
      <Link href="/dashboard" className="flex items-center gap-2.5 lg:hidden">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#6314a7" }}>
          <img
            src="/images/aile-logo-white.png"
            alt="AILE"
            className="h-5 w-auto object-contain"
          />
        </div>
        <span className="text-sm font-bold text-foreground tracking-wide">AILE</span>
      </Link>

      {/* Desktop: Page title */}
      <div className="hidden lg:flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">Panel</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground font-medium">{pageLabel}</span>
      </div>

      {/* Desktop: Search */}
      <div className="hidden lg:flex items-center flex-1 max-w-sm mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full h-9 pl-9 pr-4 rounded-lg text-sm bg-muted text-foreground placeholder:text-muted-foreground border-0 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <NotificationsPopover />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg hover:bg-muted transition-colors outline-none">
            <Avatar className="w-7 h-7">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback
                className="text-[11px] font-bold text-white"
                style={{ backgroundColor: "#6314a7" }}
              >
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:flex flex-col items-start">
              <span className="text-sm font-medium text-foreground leading-tight">{user.name}</span>
              <span
                className="text-[10px] font-medium leading-tight"
                style={{ color: roleConfig.text }}
              >
                {roleConfig.label}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden md:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/mi-perfil" className="gap-2 cursor-pointer flex items-center">
                <User className="w-4 h-4" />
                Mi perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/mi-cuenta" className="gap-2 cursor-pointer flex items-center">
                <CreditCard className="w-4 h-4" />
                Mi estado de cuenta
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              onSelect={(event) => {
                event.preventDefault()
                signOut()
              }}
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
