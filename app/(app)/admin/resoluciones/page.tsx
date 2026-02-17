"use client"

import { useState, useEffect, useCallback } from "react"
import { useDocumentos } from "@/hooks/useDocumentos"
import { ResolutionEditor } from "@/components/aile/resolution-editor"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import type { Resolucion, TipoResolucion } from "@/lib/types"
import { useResumeRefresh } from "@/hooks/useResumeRefresh"
import { useRequirePermission } from "@/hooks/useAuth"

export default function AdminResolucionesPage() {
    const { loading: checkingPermission, hasPermission } = useRequirePermission("documentos", "crear", "/documentos")

    const [mode, setMode] = useState<"list" | "edit" | "create">("list")
    const [selectedRes, setSelectedRes] = useState<Resolucion | undefined>(undefined)
    const [resoluciones, setResoluciones] = useState<Resolucion[]>([])
    const { getResoluciones, createResolucion, updateResolucion } = useDocumentos()
    const [loading, setLoading] = useState(true)

    const loadResoluciones = useCallback(async () => {
        setLoading(true)
        try {
            // Fetch both types
            const asamblea = await getResoluciones("asamblea")
            const decreto = await getResoluciones("decreto")
            // Merge and sort
            const all = [...asamblea, ...decreto].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
            setResoluciones(all)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar resoluciones")
        } finally {
            setLoading(false)
        }
    }, [getResoluciones])

    useEffect(() => {
        void loadResoluciones()
    }, [loadResoluciones])

    useResumeRefresh(() => { void loadResoluciones() }, { throttleMs: 5_000 })

    const handleEdit = (res: Resolucion) => {
        setSelectedRes(res)
        setMode("edit")
    }

    const handleCreate = () => {
        setSelectedRes(undefined)
        setMode("create")
    }

    const handleSave = async (data: Partial<Resolucion>) => {
        try {
            if (mode === "create") {
                // Fix type incompatibility by casting or omitting fields
                const createData = data as Omit<Resolucion, 'id' | 'created_at'>;
                await createResolucion(createData)
            } else if (mode === "edit" && selectedRes) {
                await updateResolucion(selectedRes.id, data)
            }
            setMode("list")
            loadResoluciones()
        } catch (error) {
            console.error(error)
            // Toast already handled in hook
        }
    }

    if (checkingPermission) {
        return (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
                Validando permisos...
            </div>
        )
    }

    if (!hasPermission) {
        return null
    }

    if (mode === "edit" || mode === "create") {
        return (
            <div className="space-y-4">
                <Button variant="ghost" onClick={() => setMode("list")} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Volver al listado
                </Button>
                <ResolutionEditor
                    initialData={selectedRes}
                    onSave={handleSave}
                    onCancel={() => setMode("list")}
                />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Gestión de Resoluciones</h1>
                    <p className="text-muted-foreground">Crear, editar y eliminar resoluciones y decretos</p>
                </div>
                <Button onClick={handleCreate} className="gap-2 bg-[#6314a7] hover:bg-[#52108a]">
                    <Plus className="h-4 w-4" />
                    Nueva Resolución
                </Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Título</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    Cargando...
                                </TableCell>
                            </TableRow>
                        ) : resoluciones.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No se encontraron resoluciones
                                </TableCell>
                            </TableRow>
                        ) : (
                            resoluciones.map((res) => (
                                <TableRow key={res.id}>
                                    <TableCell className="font-mono">
                                        {String(res.numero).padStart(3, "0")}/{res.anio}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="capitalize">
                                            {res.tipo === 'asamblea' ? 'Res. Asamblea' : 'Dec. CD'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[300px] truncate" title={res.titulo}>
                                        {res.titulo}
                                    </TableCell>
                                    <TableCell>{formatDate(res.fecha)}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="secondary"
                                            className={
                                                res.estado === "vigente"
                                                    ? "bg-green-100 text-green-700"
                                                    : res.estado === "derogada"
                                                        ? "bg-red-100 text-red-700"
                                                        : "bg-gray-100 text-gray-700"
                                            }
                                        >
                                            {res.estado}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(res)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        {/* Delete button logic could be added here */}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
