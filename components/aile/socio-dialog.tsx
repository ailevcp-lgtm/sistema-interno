"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Upload, X, Loader2 } from "lucide-react"
import { ROLES_AILE } from "@/lib/constants"
import { getInitials } from "@/lib/utils"
import type { Socio, RolAile } from "@/lib/types"
import { useRoles } from "@/hooks/useRoles"

interface SocioDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    socio?: Socio
    onSave: (data: Partial<Socio>) => Promise<void>
    onUploadAvatar: (file: File, path: string) => Promise<string>
}

export function SocioDialog({
    open,
    onOpenChange,
    socio,
    onSave,
    onUploadAvatar,
}: SocioDialogProps) {
    const { roles, loading: loadingRoles } = useRoles()
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [formData, setFormData] = useState<Partial<Socio>>({
        nombre: "",
        apellido: "",
        dni: "",
        email: "",
        telefono: "",
        fecha_ingreso: new Date().toISOString().split("T")[0],
        rol_aile: "Socio",
        avatar_url: "",
    })

    useEffect(() => {
        if (socio) {
            setFormData({
                nombre: socio.nombre,
                apellido: socio.apellido,
                dni: socio.dni,
                email: socio.email,
                telefono: socio.telefono || "",
                fecha_ingreso: socio.fecha_ingreso.split("T")[0],
                rol_aile: socio.rol_aile as RolAile,
                rol_aile_id: socio.rol_aile_id,
                avatar_url: socio.avatar_url,
            })
        } else {
            setFormData({
                nombre: "",
                apellido: "",
                dni: "",
                email: "",
                telefono: "",
                fecha_ingreso: new Date().toISOString().split("T")[0],
                rol_aile: "Socio",
                rol_aile_id: undefined,
                avatar_url: "",
            })
        }
    }, [socio, open])

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return

        const file = e.target.files[0]
        setUploading(true)
        try {
            // Use a temp path or existing ID if available, or a random ID for new users
            const userId = socio?.id || `new_${Date.now()}`
            const url = await onUploadAvatar(file, userId)
            setFormData((prev) => ({ ...prev, avatar_url: url }))
        } catch (error) {
            console.error("Upload failed", error)
        } finally {
            setUploading(false)
        }
    }

    const handleSubmit = async () => {
        setLoading(true)
        try {
            await onSave(formData)
            onOpenChange(false)
        } catch (error) {
            console.error("Save failed", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{socio ? "Editar socio" : "Nuevo socio"}</DialogTitle>
                    <DialogDescription>
                        {socio
                            ? "Modifica los datos del socio existente"
                            : "Completa los datos para registrar un nuevo socio"}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="flex flex-col items-center gap-4">
                        <Avatar className="w-24 h-24 border-2 border-border">
                            <AvatarImage src={formData.avatar_url} />
                            <AvatarFallback className="text-2xl">
                                {getInitials(formData.nombre || "?", formData.apellido || "?")}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Upload className="w-4 h-4 mr-2" />
                                )}
                                Subir foto
                            </Button>
                            {formData.avatar_url && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setFormData((prev) => ({ ...prev, avatar_url: "" }))}
                                >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nombre</Label>
                            <Input
                                value={formData.nombre}
                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                placeholder="Nombre"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Apellido</Label>
                            <Input
                                value={formData.apellido}
                                onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                                placeholder="Apellido"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>DNI</Label>
                            <Input
                                value={formData.dni}
                                onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                                placeholder="00.000.000"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Rol en AILE</Label>
                            <Select
                                value={formData.rol_aile_id || (roles.find(r => r.nombre === formData.rol_aile)?.id) || (formData.rol_aile ? "legacy_" + formData.rol_aile : "")}
                                onValueChange={(v) => {
                                    if (v.startsWith("legacy_")) {
                                        // Legacy handling (should rarely happen if migration ran)
                                    } else {
                                        const selectedRole = roles.find(r => r.id === v);
                                        setFormData({
                                            ...formData,
                                            rol_aile_id: v,
                                            rol_aile: selectedRole?.nombre
                                        })
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((rol) => (
                                        <SelectItem key={rol.id} value={rol.id}>
                                            {rol.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="email@ejemplo.com"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Teléfono</Label>
                            <Input
                                value={formData.telefono}
                                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                placeholder="+54 ..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Fecha de ingreso</Label>
                            <Input
                                type="date"
                                value={formData.fecha_ingreso}
                                onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground border-0"
                        disabled={loading || uploading}
                    >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {socio ? "Guardar cambios" : "Crear socio"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
