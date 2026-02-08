"use client"

import { useState } from "react"
import { useRoles } from "@/hooks/useRoles"
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
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react"

export function RolesManager() {
    const { roles, loading, addRole, updateRole, deleteRole } = useRoles()
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [selectedRole, setSelectedRole] = useState<{ id: string, nombre: string } | null>(null)
    const [newRoleName, setNewRoleName] = useState("")

    const handleAdd = async () => {
        if (!newRoleName.trim()) return
        try {
            await addRole(newRoleName.trim())
            setIsAddOpen(false)
            setNewRoleName("")
        } catch (error) {
            // Error handling is done in hook
        }
    }

    const handleEdit = async () => {
        if (!selectedRole || !newRoleName.trim()) return
        try {
            await updateRole(selectedRole.id, newRoleName.trim())
            setIsEditOpen(false)
            setSelectedRole(null)
            setNewRoleName("")
        } catch (error) {
            // Error handling is done in hook
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm("¿Estás seguro de que quieres eliminar este rol? Si hay socios con este rol, podría causar inconsistencias.")) {
            try {
                await deleteRole(id)
            } catch (error) {
                // Error handling is done in hook
            }
        }
    }

    const openEdit = (role: { id: string, nombre: string }) => {
        setSelectedRole(role)
        setNewRoleName(role.nombre)
        setIsEditOpen(true)
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Roles de AILE</h3>
                    <p className="text-sm text-muted-foreground">
                        Gestiona los roles disponibles para asignar a los socios.
                    </p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button>
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

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre del Rol</TableHead>
                            <TableHead className="w-[100px]">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
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
                            Modifica el nombre del rol. Esto actualizará el rol para todos los socios que lo tengan asignado.
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
        </div>
    )
}
