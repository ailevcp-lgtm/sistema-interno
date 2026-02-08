"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useTesoreria, type CuentaConSaldo } from "@/hooks/useTesoreria"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface ArqueoModalProps {
    cuenta: CuentaConSaldo | null
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function ArqueoModal({ cuenta, isOpen, onClose, onSuccess }: ArqueoModalProps) {
    const { registrarArqueo } = useTesoreria()
    const [saldoReal, setSaldoReal] = useState("")
    const [observaciones, setObservaciones] = useState("")
    const [loading, setLoading] = useState(false)

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setSaldoReal("")
            setObservaciones("")
        }
    }, [isOpen])

    if (!cuenta) return null

    const saldoSistema = cuenta.saldo
    const real = parseFloat(saldoReal) || 0
    const diferencia = real - saldoSistema
    const isNegative = diferencia < 0
    const isPositive = diferencia > 0

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!saldoReal) return

        setLoading(true)
        const success = await registrarArqueo(cuenta.id, real, observaciones)
        setLoading(false)

        if (success) {
            onSuccess()
            onClose()
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Arqueo de Caja: {cuenta.nombre}</DialogTitle>
                    <DialogDescription>
                        Registra el saldo real disponible en la cuenta para comparar con el sistema.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Saldo en Sistema</Label>
                        <div className="p-3 bg-muted rounded-md font-mono text-lg font-semibold">
                            {new Intl.NumberFormat("es-AR", {
                                style: "currency",
                                currency: "ARS",
                            }).format(saldoSistema)}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="saldo-real">Saldo Real (Lo que hay en caja/banco)</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                            <Input
                                id="saldo-real"
                                type="number"
                                step="0.01"
                                className="pl-7"
                                placeholder="0.00"
                                value={saldoReal}
                                onChange={(e) => setSaldoReal(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {saldoReal && (
                        <div className={cn(
                            "p-3 rounded-md border text-sm flex justify-between items-center animate-in fade-in zoom-in-95 duration-200",
                            isNegative ? "bg-red-50 border-red-200 text-red-700" :
                                isPositive ? "bg-green-50 border-green-200 text-green-700" :
                                    "bg-gray-50 border-gray-200 text-gray-700"
                        )}>
                            <span className="font-medium">Diferencia:</span>
                            <span className="font-mono font-bold">
                                {new Intl.NumberFormat("es-AR", {
                                    style: "currency",
                                    currency: "ARS",
                                    signDisplay: "always"
                                }).format(diferencia)}
                            </span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="observaciones">Observaciones</Label>
                        <Textarea
                            id="observaciones"
                            placeholder="Detalles sobre faltantes, sobrantes o justificaciones..."
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={!saldoReal || loading}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confirmar Arqueo
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
