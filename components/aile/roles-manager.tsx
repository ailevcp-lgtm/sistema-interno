"use client"

import { useMemo, useState, useEffect } from "react"
import { useRoles, type RolePermissionMatrix, type RoleTaskScopeSettings } from "@/hooks/useRoles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ACCION_LABELS,
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  RECURSO_LABELS,
  hasPermission as resolvePermission,
  isGlobalManager,
} from "@/lib/constants"
import type { Recurso, Accion } from "@/lib/types"
import { Pencil, Trash2, Plus, Loader2, Shield } from "lucide-react"

type BasicRole = { id: string; nombre: string }

function buildRolePermissionMatrix(
  role: BasicRole,
  overridesByRoleId: Record<string, Partial<Record<Recurso, Partial<Record<Accion, boolean>>>>>
): RolePermissionMatrix {
  const matrix = {} as RolePermissionMatrix
  const isGlobalRole = isGlobalManager("socio", role.nombre)
  const roleOverrides = overridesByRoleId[role.id] || {}

  for (const recurso of PERMISSION_RESOURCES) {
    matrix[recurso] = {} as Record<Accion, boolean>
    for (const accion of PERMISSION_ACTIONS) {
      if (isGlobalRole) {
        matrix[recurso][accion] = true
        continue
      }

      const explicitValue = roleOverrides[recurso]?.[accion]
      if (typeof explicitValue === "boolean") {
        matrix[recurso][accion] = explicitValue
      } else {
        matrix[recurso][accion] = resolvePermission("socio", recurso, accion, role.nombre)
      }
    }
  }

  return matrix
}

export function RolesManager() {
  const {
    roles,
    loading,
    permissionsLoading,
    taskScopeLoading,
    permissionOverridesByRoleId,
    getRoleTaskScope,
    addRole,
    updateRole,
    deleteRole,
    saveRolePermissions,
    resetRolePermissions,
    saveRoleTaskScope,
    resetRoleTaskScope,
  } = useRoles()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<BasicRole | null>(null)
  const [newRoleName, setNewRoleName] = useState("")
  const [permissionMatrix, setPermissionMatrix] = useState<RolePermissionMatrix | null>(null)
  const [taskScopeSettings, setTaskScopeSettings] = useState<RoleTaskScopeSettings | null>(null)
  const [isSavingPermissions, setIsSavingPermissions] = useState(false)
  const [isResettingPermissions, setIsResettingPermissions] = useState(false)

  const selectedRoleIsGlobal = useMemo(
    () => Boolean(selectedRole && isGlobalManager("socio", selectedRole.nombre)),
    [selectedRole]
  )

  useEffect(() => {
    if (!selectedRole || !isPermissionsOpen) return
    setPermissionMatrix(buildRolePermissionMatrix(selectedRole, permissionOverridesByRoleId))
    setTaskScopeSettings(getRoleTaskScope(selectedRole.id))
  }, [selectedRole, isPermissionsOpen, permissionOverridesByRoleId, getRoleTaskScope])

  const handleAdd = async () => {
    if (!newRoleName.trim()) return
    try {
      await addRole(newRoleName.trim())
      setIsAddOpen(false)
      setNewRoleName("")
    } catch {
      // Errores controlados en hook
    }
  }

  const handleEdit = async () => {
    if (!selectedRole || !newRoleName.trim()) return
    try {
      await updateRole(selectedRole.id, newRoleName.trim())
      setIsEditOpen(false)
      setSelectedRole(null)
      setNewRoleName("")
    } catch {
      // Errores controlados en hook
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("¿Estas seguro de que quieres eliminar este rol? Si hay socios con este rol, podria causar inconsistencias.")) {
      try {
        await deleteRole(id)
      } catch {
        // Errores controlados en hook
      }
    }
  }

  const openEdit = (role: BasicRole) => {
    setSelectedRole(role)
    setNewRoleName(role.nombre)
    setIsEditOpen(true)
  }

  const openPermissions = (role: BasicRole) => {
    setSelectedRole(role)
    setPermissionMatrix(buildRolePermissionMatrix(role, permissionOverridesByRoleId))
    setTaskScopeSettings(getRoleTaskScope(role.id))
    setIsPermissionsOpen(true)
  }

  const updatePermissionCell = (recurso: Recurso, accion: Accion, permitido: boolean) => {
    if (!permissionMatrix || selectedRoleIsGlobal) return

    setPermissionMatrix((current) => {
      if (!current) return current
      return {
        ...current,
        [recurso]: {
          ...current[recurso],
          [accion]: permitido,
        },
      }
    })
  }

  const handleSavePermissions = async () => {
    if (!selectedRole || !permissionMatrix || !taskScopeSettings) return

    setIsSavingPermissions(true)
    try {
      await Promise.all([
        saveRolePermissions(selectedRole.id, permissionMatrix),
        saveRoleTaskScope(selectedRole.id, taskScopeSettings),
      ])
      setIsPermissionsOpen(false)
    } finally {
      setIsSavingPermissions(false)
    }
  }

  const handleResetPermissions = async () => {
    if (!selectedRole) return
    if (!confirm("¿Restablecer los permisos de este rol a la configuracion base?")) return

    setIsResettingPermissions(true)
    try {
      await Promise.all([
        resetRolePermissions(selectedRole.id),
        resetRoleTaskScope(selectedRole.id),
      ])
      setPermissionMatrix(buildRolePermissionMatrix(selectedRole, {}))
      setTaskScopeSettings({
        scopeMode: 'own_direction',
        allowAssignedCrossDirection: true,
      })
    } finally {
      setIsResettingPermissions(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h3 className="text-lg font-medium">Roles de AILE</h3>
          <p className="text-sm text-muted-foreground">
            Gestiona los roles disponibles para asignar a los socios.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Rol
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar nuevo rol</DialogTitle>
              <DialogDescription>
                Crea un nuevo rol para asignar a los socios.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="name">Nombre del rol</Label>
              <Input
                id="name"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Ej: Director de ..."
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button onClick={handleAdd}>Crear</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead>Nombre del Rol</TableHead>
              <TableHead className="w-[180px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(loading || permissionsLoading || taskScopeLoading) ? (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center">
                  No hay roles definidos.
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.nombre}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar permisos"
                        onClick={() => openPermissions(role)}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(role)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(role.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar rol</DialogTitle>
            <DialogDescription>
              Modifica el nombre del rol. Esto actualizara el rol para todos los socios que lo tengan asignado.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="edit-name">Nombre del rol</Label>
            <Input
              id="edit-name"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Nombre del rol"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Permisos del rol: {selectedRole?.nombre}</DialogTitle>
            <DialogDescription>
              Define que puede ver y hacer este rol en cada modulo del sistema.
            </DialogDescription>
          </DialogHeader>

          {selectedRoleIsGlobal ? (
            <div className="rounded-md border bg-primary/5 border-primary/25 px-4 py-3 text-sm text-muted-foreground">
              Este cargo pertenece a la comision directiva y tiene control total global. Sus permisos siempre son completos.
            </div>
          ) : null}

          <div className="max-h-[55vh] overflow-auto rounded-md border">
            <Table className="min-w-[980px]">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-[220px]">Modulo</TableHead>
                  {PERMISSION_ACTIONS.map((accion) => (
                    <TableHead key={accion} className="text-center">
                      {ACCION_LABELS[accion]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {PERMISSION_RESOURCES.map((recurso) => (
                  <TableRow key={recurso}>
                    <TableCell className="font-medium">{RECURSO_LABELS[recurso]}</TableCell>
                    {PERMISSION_ACTIONS.map((accion) => (
                      <TableCell key={`${recurso}-${accion}`} className="text-center">
                        <div className="inline-flex items-center gap-2">
                          <Switch
                            checked={permissionMatrix?.[recurso]?.[accion] ?? false}
                            disabled={selectedRoleIsGlobal || isSavingPermissions || isResettingPermissions}
                            onCheckedChange={(checked) => updatePermissionCell(recurso, accion, checked)}
                          />
                          <span className="text-xs text-muted-foreground w-[44px] text-left">
                            {(permissionMatrix?.[recurso]?.[accion] ?? false) ? "Si" : "No"}
                          </span>
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!selectedRoleIsGlobal && taskScopeSettings ? (
            <div className="rounded-md border p-4 space-y-3">
              <div>
                <h4 className="text-sm font-medium">Alcance de gestión en Tareas</h4>
                <p className="text-xs text-muted-foreground">
                  Define si el rol gestiona solo su dirección o todas las direcciones.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Alcance</Label>
                  <Select
                    value={taskScopeSettings.scopeMode}
                    onValueChange={(value) => {
                      setTaskScopeSettings((current) => (
                        current
                          ? { ...current, scopeMode: value as RoleTaskScopeSettings['scopeMode'] }
                          : current
                      ))
                    }}
                    disabled={isSavingPermissions || isResettingPermissions}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="own_direction">Solo su dirección</SelectItem>
                      <SelectItem value="all_directions">Todas las direcciones</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Edición por asignación cruzada</Label>
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Switch
                      checked={taskScopeSettings.allowAssignedCrossDirection}
                      onCheckedChange={(checked) => {
                        setTaskScopeSettings((current) => (
                          current
                            ? { ...current, allowAssignedCrossDirection: checked }
                            : current
                        ))
                      }}
                      disabled={isSavingPermissions || isResettingPermissions}
                    />
                    <p className="text-xs text-muted-foreground">
                      Permitir editar tareas/subtareas asignadas fuera de su dirección.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              disabled={selectedRoleIsGlobal || isResettingPermissions || isSavingPermissions}
              onClick={handleResetPermissions}
            >
              {isResettingPermissions ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Restablecer base
            </Button>
            <Button variant="outline" onClick={() => setIsPermissionsOpen(false)}>
              Cerrar
            </Button>
            <Button
              disabled={selectedRoleIsGlobal || isSavingPermissions || !permissionMatrix || !taskScopeSettings}
              onClick={handleSavePermissions}
            >
              {isSavingPermissions ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar permisos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
