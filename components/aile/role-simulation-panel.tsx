"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ShieldAlert } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useRoles } from "@/hooks/useRoles"
import { ROL_LABELS } from "@/lib/constants"
import type { Rol } from "@/lib/types"

const SYSTEM_ROLES: Rol[] = ["socio", "revisor_cuentas", "comision_directiva", "admin"]

interface RoleSimulationPanelContentProps {
  actualRol: Rol
  actualRolAile: string | null
  isRoleSimulationActive: boolean
  loading: boolean
  roles: Array<{ id: string; nombre: string }>
  roleSimulation: { rol: Rol; rolAile: string | null } | null
  setRoleSimulation: (value: { rol: Rol; rolAile: string | null } | null) => void
  clearRoleSimulation: () => void
}

function RoleSimulationPanelContent({
  actualRol,
  actualRolAile,
  isRoleSimulationActive,
  loading,
  roles,
  roleSimulation,
  setRoleSimulation,
  clearRoleSimulation,
}: RoleSimulationPanelContentProps) {
  const [selectedRol, setSelectedRol] = useState<Rol>(roleSimulation?.rol || actualRol)
  const [selectedRolAile, setSelectedRolAile] = useState<string>(roleSimulation?.rolAile || actualRolAile || "")

  const selectedRoleExists = useMemo(
    () => !selectedRolAile || roles.some((role) => role.nombre === selectedRolAile),
    [roles, selectedRolAile]
  )

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">Simulador de permisos</CardTitle>
            <CardDescription>
              Cambia temporalmente el rol para depurar que puede ver o editar cada perfil.
            </CardDescription>
          </div>
          <Badge className={isRoleSimulationActive ? "bg-amber-500/20 text-amber-700 border-0" : "bg-emerald-500/20 text-emerald-700 border-0"}>
            {isRoleSimulationActive ? "Simulacion activa" : "Modo real"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rol del sistema</p>
            <Select value={selectedRol} onValueChange={(value) => setSelectedRol(value as Rol)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROL_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cargo AILE</p>
            <Select value={selectedRolAile || "none"} onValueChange={(value) => setSelectedRolAile(value === "none" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sin cargo institucional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin cargo institucional</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.nombre}>
                    {role.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loading && !selectedRoleExists ? (
              <p className="text-xs text-amber-700 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                El cargo guardado en simulacion ya no existe en la definicion actual de roles.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setRoleSimulation({ rol: selectedRol, rolAile: selectedRolAile || null })}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {isRoleSimulationActive ? "Actualizar simulacion" : "Activar simulacion"}
          </Button>
          <Button variant="outline" onClick={clearRoleSimulation} disabled={!isRoleSimulationActive}>
            Volver al modo real
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function RoleSimulationPanel() {
  const {
    canRoleSimulation,
    isRoleSimulationActive,
    roleSimulation,
    setRoleSimulation,
    clearRoleSimulation,
    actualRol,
    actualRolAile,
  } = useAuth()

  const { roles, loading } = useRoles()

  if (!canRoleSimulation) return null

  const formKey = `${roleSimulation?.rol || actualRol}:${roleSimulation?.rolAile || actualRolAile || ""}`

  return (
    <RoleSimulationPanelContent
      key={formKey}
      actualRol={actualRol}
      actualRolAile={actualRolAile}
      isRoleSimulationActive={isRoleSimulationActive}
      loading={loading}
      roles={roles}
      roleSimulation={roleSimulation}
      setRoleSimulation={setRoleSimulation}
      clearRoleSimulation={clearRoleSimulation}
    />
  )
}
