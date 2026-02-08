"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useTesoreria } from "@/hooks/useTesoreria"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"

interface NuevaTransaccionModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    initialType?: "ingreso" | "egreso"
}

export function NuevaTransaccionModal({ isOpen, onClose, onSuccess, initialType = "ingreso" }: NuevaTransaccionModalProps) {
    const { user } = useAuth()
    const { cuentas, categorias, refreshData } = useTesoreria()
    const [loading, setLoading] = useState(false)

    const [tipo, setTipo] = useState<"ingreso" | "egreso">(initialType)
    const [cuentaId, setCuentaId] = useState("")
    const [categoriaId, setCategoriaId] = useState("")
    const [monto, setMonto] = useState("")
    const [descripcion, setDescripcion] = useState("")
    const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])

    const categoriasFiltradas = categorias.filter(c => c.tipo === tipo)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !monto || !cuentaId || !categoriaId) return

        setLoading(true)
        try {
            const { error } = await supabase.from("movimientos").insert([{
                tipo,
                monto: parseFloat(monto),
                fecha,
                periodo: fecha.substring(0, 7),
                descripcion,
                cuenta_id: cuentaId,
                categoria_id: categoriaId,
                registrado_por: user.id
            }])

            if (error) throw error

            await supabase.from("logs_actividad").insert([{
                usuario_id: user.id,
                accion: "CREAR_MOVIMIENTO",
                detalle: `${tipo === "ingreso" ? "Ingreso" : "Egreso"} registrado: ${descripcion} en cuenta ${cuentas.find(c => c.id === cuentaId)?.nombre}`
            }])

            toast.success("Transacción registrada correctamente")
            refreshData()
            onSuccess()
            onClose()

            // Reset form (partial)
            setMonto("")
            setDescripcion("")
        } catch (error) {
            console.error(error)
            toast.error("Error al registrar transacción")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Nueva Transacción</DialogTitle>
                    <DialogDescription>Registra un nuevo movimiento en la tesorería.</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={tipo} onValueChange={(v: "ingreso" | "egreso") => setTipo(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ingreso">Ingreso</SelectItem>
                                    <SelectItem value="egreso">Egreso</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Fecha</Label>
                            <Input
                                type="date"
                                value={fecha}
                                onChange={e => setFecha(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Cuenta</Label>
                        <Select value={cuentaId} onValueChange={setCuentaId} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar cuenta..." />
                            </SelectTrigger>
                            <SelectContent>
                                {cuentas.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Categoría</Label>
                        <Select value={categoriaId} onValueChange={setCategoriaId} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar categoría..." />
                            </SelectTrigger>
                            <SelectContent>
                                {categoriasFiltradas.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Monto</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                            <Input
                                type="number"
                                step="0.01"
                                className="pl-7"
                                placeholder="0.00"
                                value={monto}
                                onChange={e => setMonto(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Descripción</Label>
                        <Textarea
                            placeholder="Detalle del movimiento..."
                            value={descripcion}
                            onChange={e => setDescripcion(e.target.value)}
                            required
                        />
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Registrar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
