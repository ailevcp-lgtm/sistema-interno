"use client"

import { Search, Plus, SlidersHorizontal, Mail, Phone } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useSocios } from "@/hooks/useSocios"
import { formatDate } from "@/lib/utils"

const roleLabels: Record<string, string> = {
  admin: "Admin",
  comision_directiva: "Comision Directiva",
  revisor_cuentas: "Revisor de Cuentas",
  socio: "Socio",
}

const roleStyles: Record<string, { bg: string; text: string }> = {
  socio: { bg: "#f3f4f6", text: "#6b7280" },
  comision_directiva: { bg: "#ede5f7", text: "#6314a7" },
  revisor_cuentas: { bg: "#fef3c7", text: "#b45309" },
  admin: { bg: "#fde2e8", text: "#e50051" },
}

function getInitials(nombre: string, apellido: string) {
  return `${nombre[0] || ""}${apellido[0] || ""}`.toUpperCase()
}

const avatarColors = ["#6314a7", "#9341bf", "#cea2dc", "#00a3e2", "#e50051"]

export function SociosPage() {
  const { socios, totalSocios, totalPages, filters, loading, setSearch, setPage } = useSocios()

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse opacity-50">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-10 bg-muted rounded-lg" />
        <div className="h-96 bg-muted rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground">Socios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestion de socios de AILE</p>
        </div>
        <Button className="font-medium" style={{ backgroundColor: "#6314a7", color: "#fff" }}>
          <Plus className="w-4 h-4 mr-2" strokeWidth={2} />
          Agregar socio
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, DNI o email..."
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-lg text-sm bg-card text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Button variant="outline" className="gap-2 bg-transparent">
          <SlidersHorizontal className="w-4 h-4" strokeWidth={1.8} />
          Filtros
        </Button>
      </div>

      {socios.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">
          No hay socios registrados
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="border border-border shadow-none hidden lg:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs text-muted-foreground font-medium p-4">Socio</th>
                      <th className="text-left text-xs text-muted-foreground font-medium p-4">DNI</th>
                      <th className="text-left text-xs text-muted-foreground font-medium p-4">Contacto</th>
                      <th className="text-left text-xs text-muted-foreground font-medium p-4">Ingreso</th>
                      <th className="text-left text-xs text-muted-foreground font-medium p-4">Estado</th>
                      <th className="text-left text-xs text-muted-foreground font-medium p-4">Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {socios.map((socio, idx) => {
                      const rol = socio.rol_aile || "socio"
                      const rs = roleStyles[rol] || roleStyles.socio
                      return (
                        <tr key={socio.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                style={{ backgroundColor: avatarColors[idx % avatarColors.length] }}
                              >
                                {getInitials(socio.nombre, socio.apellido)}
                              </div>
                              <span className="text-sm text-foreground font-medium">{socio.nombre} {socio.apellido}</span>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground font-mono">{socio.dni}</td>
                          <td className="p-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {socio.email}
                              </span>
                              {socio.telefono && (
                                <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> {socio.telefono}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">{formatDate(socio.fecha_ingreso)}</td>
                          <td className="p-4">
                            <Badge
                              variant="secondary"
                              className="text-[10px] border-0 font-medium"
                              style={{
                                backgroundColor: socio.estado === "activo" ? "#ecfdf5" : "#fef2f2",
                                color: socio.estado === "activo" ? "#059669" : "#dc2626",
                              }}
                            >
                              {socio.estado === "activo" ? "Activo" : "Inactivo"}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Badge
                              variant="secondary"
                              className="text-[10px] border-0 font-medium"
                              style={{ backgroundColor: rs.bg, color: rs.text }}
                            >
                              {roleLabels[rol] || "Socio"}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-2.5 lg:hidden">
            {socios.map((socio, idx) => {
              const rol = socio.rol_aile || "socio"
              const rs = roleStyles[rol] || roleStyles.socio
              return (
                <Card key={socio.id} className="border border-border shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ backgroundColor: avatarColors[idx % avatarColors.length] }}
                      >
                        {getInitials(socio.nombre, socio.apellido)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground truncate">{socio.nombre} {socio.apellido}</h3>
                          <Badge
                            variant="secondary"
                            className="text-[10px] border-0 shrink-0 font-medium"
                            style={{
                              backgroundColor: socio.estado === "activo" ? "#ecfdf5" : "#fef2f2",
                              color: socio.estado === "activo" ? "#059669" : "#dc2626",
                            }}
                          >
                            {socio.estado === "activo" ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="secondary"
                            className="text-[10px] border-0 font-medium"
                            style={{ backgroundColor: rs.bg, color: rs.text }}
                          >
                            {roleLabels[rol] || "Socio"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">DNI: {socio.dni}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {socio.email}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>Mostrando {socios.length} de {totalSocios} socios</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(1, filters.page - 1))}
              disabled={filters.page <= 1}
              className="px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="px-3 py-1.5 rounded-md font-medium transition-colors"
                style={
                  p === filters.page
                    ? { backgroundColor: "#6314a7", color: "#fff" }
                    : undefined
                }
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(Math.min(totalPages, filters.page + 1))}
              disabled={filters.page >= totalPages}
              className="px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
