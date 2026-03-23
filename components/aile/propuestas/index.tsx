"use client"

import { useState, useEffect, useCallback } from "react"
import { usePropuestas } from "@/hooks/usePropuestas"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, Eye, Briefcase, FileText } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { Propuesta } from "@/lib/types"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const estadoStyles: Record<string, { bg: string; color: string }> = {
  publicado: { bg: "#ecfdf5", color: "#059669" },
  borrador: { bg: "#f3f4f6", color: "#6b7280" },
}

const estadoLabels: Record<string, string> = {
  publicado: "Publicado",
  borrador: "Borrador",
}

export function PropuestasPage() {
  const router = useRouter()
  const { getPropuestas, deletePropuesta } = usePropuestas()
  const { hasPermission } = useAuth()
  const [propuestas, setPropuestas] = useState<Propuesta[]>([])
  const [loading, setLoading] = useState(true)

  const canCreate = hasPermission("propuestas", "crear")
  const canEdit = hasPermission("propuestas", "editar")
  const canDelete = hasPermission("propuestas", "eliminar")

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getPropuestas()
      setPropuestas(data)
    } catch (error) {
      toast.error("Error al cargar las propuestas")
    } finally {
      setLoading(false)
    }
  }, [getPropuestas])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleDelete = async (propuesta: Propuesta) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`¿Eliminar la propuesta "${propuesta.titulo}"?`)
      if (!confirmed) return
    }

    try {
      await deletePropuesta(propuesta.id)
      toast.success("Propuesta eliminada correctamente")
      await loadData()
    } catch (error) {
      toast.error("Error al eliminar la propuesta")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground">Propuestas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestión de propuestas de proyectos y links públicos</p>
        </div>
        {canCreate && (
          <Button
            size="sm"
            className="gap-2"
            onClick={() => router.push("/propuestas/nueva")}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva Propuesta</span>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 animate-pulse opacity-50">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg" />
          ))}
        </div>
      ) : propuestas.length === 0 ? (
        <div className="p-12 text-center border rounded-lg bg-card text-muted-foreground flex flex-col items-center gap-3">
          <Briefcase className="w-10 h-10 opacity-20" />
          <p>No hay propuestas creadas</p>
          {canCreate && (
            <Button variant="outline" size="sm" onClick={() => router.push("/propuestas/nueva")} className="mt-2">
              Crear la primera propuesta
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Card className="border border-border shadow-none hidden lg:block">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-muted-foreground font-medium p-4">Título</th>
                    <th className="text-left text-xs text-muted-foreground font-medium p-4">Enlace</th>
                    <th className="text-left text-xs text-muted-foreground font-medium p-4">Estado</th>
                    <th className="text-right text-xs text-muted-foreground font-medium p-4" />
                  </tr>
                </thead>
                <tbody>
                  {propuestas.map((prop) => {
                    const s = estadoStyles[prop.estado] || estadoStyles.borrador
                    return (
                      <tr key={prop.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="p-4 text-sm font-medium text-foreground">
                          {prop.titulo}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground font-mono">
                          /p/{prop.slug}
                        </td>
                        <td className="p-4">
                          <Badge variant="secondary" className="text-[10px] border-0 font-medium" style={{ backgroundColor: s.bg, color: s.color }}>
                            {estadoLabels[prop.estado] || prop.estado}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button onClick={() => window.open(`/p/${prop.slug}`, "_blank")} size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Ver vista pública</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {canEdit && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button onClick={() => router.push(`/propuestas/${prop.id}`)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Editar propuesta</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {canDelete && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button onClick={() => void handleDelete(prop)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500/70 hover:text-red-600 hover:bg-red-50">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Eliminar propuesta</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2 lg:hidden">
            {propuestas.map((prop) => {
              const s = estadoStyles[prop.estado] || estadoStyles.borrador
              return (
                <Card key={prop.id} className="border border-border shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground break-words">{prop.titulo}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-1 break-all">/p/{prop.slug}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px] border-0 font-medium" style={{ backgroundColor: s.bg, color: s.color }}>
                            {estadoLabels[prop.estado] || prop.estado}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 flex-col">
                        <Button onClick={() => window.open(`/p/${prop.slug}`, "_blank")} size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canEdit && (
                          <Button onClick={() => router.push(`/propuestas/${prop.id}`)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button onClick={() => void handleDelete(prop)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500/70">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
