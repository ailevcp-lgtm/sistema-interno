"use client"

import { type ChangeEvent, type FormEvent, useId, useRef, useState } from "react"
import { Loader2, Upload, FileText, X } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/hooks/useAuth"
import { useDocumentos } from "@/hooks/useDocumentos"
import { supabase } from "@/lib/supabase"
import type { EstadoBalance, TipoBalance } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface BalanceUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploaded?: () => void
}

const BALANCE_TYPE_OPTIONS: Array<{ value: TipoBalance; label: string }> = [
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "anual", label: "Anual" },
]

const BALANCE_STATUS_OPTIONS: Array<{ value: EstadoBalance; label: string }> = [
  { value: "aprobado_asamblea", label: "Aprobado por Asamblea" },
  { value: "aprobado_cd", label: "Aprobado por CD" },
  { value: "borrador", label: "Borrador" },
]

function getDefaultPeriodo() {
  return `Balance ${new Date().getFullYear()}`
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function BalanceUploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: BalanceUploadDialogProps) {
  const uploadInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { createBalance } = useDocumentos()
  const { user } = useAuth()

  const [periodo, setPeriodo] = useState(getDefaultPeriodo)
  const [tipo, setTipo] = useState<TipoBalance>("anual")
  const [estado, setEstado] = useState<EstadoBalance>("aprobado_asamblea")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const resetForm = () => {
    setPeriodo(getDefaultPeriodo())
    setTipo("anual")
    setEstado("aprobado_asamblea")
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDialogChange = (nextOpen: boolean) => {
    if (!nextOpen && !submitting) {
      resetForm()
    }
    onOpenChange(nextOpen)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    if (!file) {
      setSelectedFile(null)
      return
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    if (!isPdf) {
      toast.error("Solo se permiten archivos PDF")
      event.target.value = ""
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedPeriodo = periodo.trim()
    if (!normalizedPeriodo) {
      toast.error("Ingresá el período del balance")
      return
    }

    if (!selectedFile) {
      toast.error("Seleccioná un PDF para subir")
      return
    }

    setSubmitting(true)
    let uploadedPath: string | null = null

    try {
      const fileBaseName = sanitizeFileName(
        normalizedPeriodo || selectedFile.name.replace(/\.pdf$/i, "")
      ) || "balance"
      const filePath = `balances/${new Date().getFullYear()}/${Date.now()}-${fileBaseName}.pdf`

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(filePath, selectedFile, {
          contentType: "application/pdf",
          upsert: false,
        })

      if (uploadError) {
        throw uploadError
      }

      uploadedPath = filePath

      const { data: publicUrlData } = supabase.storage
        .from("documentos")
        .getPublicUrl(filePath)

      await createBalance({
        periodo: normalizedPeriodo,
        tipo,
        estado,
        archivo_url: publicUrlData.publicUrl,
        total_ingresos: 0,
        total_egresos: 0,
        aprobado_por: user?.id || undefined,
      })

      resetForm()
      onOpenChange(false)
      onUploaded?.()
    } catch (error) {
      console.error("Error creating balance:", error)

      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from("documentos")
          .remove([uploadedPath])

        if (cleanupError) {
          console.warn("Error cleaning uploaded balance file:", cleanupError)
        }
      }

      toast.error("No se pudo subir el balance")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Subir balance</DialogTitle>
          <DialogDescription>
            Cargá un PDF institucional para publicarlo en Documentos y notificar al resto del sistema.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${uploadInputId}-periodo`}>Período</Label>
              <Input
                id={`${uploadInputId}-periodo`}
                value={periodo}
                onChange={(event) => setPeriodo(event.target.value)}
                placeholder="Ej: Ejercicio 2025"
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={tipo}
                onValueChange={(value: TipoBalance) => setTipo(value)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {BALANCE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={estado}
                onValueChange={(value: EstadoBalance) => setEstado(value)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {BALANCE_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={uploadInputId}>Archivo PDF</Label>
            <input
              id={uploadInputId}
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={submitting}
            />

            {selectedFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background border border-border">
                  <FileText className="h-5 w-5 text-[#6314a7]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setSelectedFile(null)
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ""
                    }
                  }}
                  disabled={submitting}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Quitar archivo</span>
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2 border-dashed bg-transparent"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
              >
                <Upload className="h-4 w-4" />
                Seleccionar PDF
              </Button>
            )}

            <p className="text-xs text-muted-foreground">
              El archivo se publicará para consulta desde web y teléfono.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Publicar balance
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
