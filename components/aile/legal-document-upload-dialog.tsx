"use client"

import { useMemo, useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

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
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import type { EstadoRegistroDocumento, TipoDocumentoLegal } from "@/lib/legal-documents"

const MAX_PDF_BYTES = 50 * 1024 * 1024

const typeOptions: Array<{ value: TipoDocumentoLegal; label: string }> = [
  { value: "acta_constitutiva_estatuto", label: "Acta constitutiva y estatuto" },
  { value: "acta_cd", label: "Acta de Comisión Directiva" },
  { value: "acta_asamblea", label: "Acta de Asamblea" },
  { value: "resolucion_cd", label: "Resolución de Comisión Directiva" },
  { value: "constancia_ipj", label: "Constancia o expediente IPJ" },
  { value: "libro_digital", label: "Comprobante de libro digital" },
  { value: "otro", label: "Otro documento legal" },
]

const stateOptions: Array<{ value: EstadoRegistroDocumento; label: string }> = [
  { value: "borrador", label: "Borrador" },
  { value: "pendiente_firma", label: "Pendiente de firma" },
  { value: "firmado", label: "Firmado" },
  { value: "presentado_ipj", label: "Presentado ante IPJ" },
  { value: "inscripto_ipj", label: "Inscripto en IPJ" },
  { value: "rechazado", label: "Rechazado" },
  { value: "reemplazado", label: "Reemplazado" },
]

interface LegalDocumentUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

function sanitizeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "documento.pdf"
}

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function assertPdf(file: File) {
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
    throw new Error("El PDF debe pesar entre 1 byte y 50 MB.")
  }

  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  const signature = String.fromCharCode(...header)
  if (signature !== "%PDF-") {
    throw new Error("El archivo no tiene una firma PDF válida.")
  }
}

export function LegalDocumentUploadDialog({
  open,
  onOpenChange,
  onSaved,
}: LegalDocumentUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<TipoDocumentoLegal>("acta_cd")
  const [registrationState, setRegistrationState] = useState<EstadoRegistroDocumento>("firmado")
  const [documentDate, setDocumentDate] = useState("")
  const [number, setNumber] = useState("")
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [agency, setAgency] = useState("Instituto Provincial de Personas Jurídicas (IPJ)")
  const [caseNumber, setCaseNumber] = useState("")
  const [digitallySigned, setDigitallySigned] = useState(true)
  const [saving, setSaving] = useState(false)

  const canSave = useMemo(() => Boolean(file && title.trim().length >= 3 && !saving), [file, saving, title])

  const reset = () => {
    setFile(null)
    setTitle("")
    setDescription("")
    setType("acta_cd")
    setRegistrationState("firmado")
    setDocumentDate("")
    setNumber("")
    setYear(String(new Date().getFullYear()))
    setAgency("Instituto Provincial de Personas Jurídicas (IPJ)")
    setCaseNumber("")
    setDigitallySigned(true)
  }

  const close = (nextOpen: boolean) => {
    if (!nextOpen && !saving) reset()
    onOpenChange(nextOpen)
  }

  const handleSave = async () => {
    if (!file || !canSave) return

    let uploadedPath: string | null = null
    try {
      setSaving(true)
      await assertPdf(file)
      const hash = await sha256Hex(file)

      const { data: existing, error: duplicateError } = await supabase
        .from("documentos_legales")
        .select("id, titulo")
        .eq("sha256", hash)
        .maybeSingle()

      if (duplicateError) throw duplicateError
      if (existing) {
        throw new Error(`Este PDF ya está registrado como “${existing.titulo}”.`)
      }

      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user?.id) throw new Error("No se pudo identificar al usuario autenticado.")

      const { data: socio, error: socioError } = await supabase
        .from("socios")
        .select("id")
        .eq("usuario_id", authData.user.id)
        .eq("estado", "activo")
        .single()

      if (socioError || !socio?.id) {
        throw socioError || new Error("El usuario no está vinculado a un socio activo.")
      }

      const pathYear = documentDate?.slice(0, 4) || year || String(new Date().getFullYear())
      uploadedPath = `${type}/${pathYear}/${hash.slice(0, 16)}-${sanitizeFilePart(file.name)}`

      const { error: uploadError } = await supabase.storage
        .from("documentos-legales")
        .upload(uploadedPath, file, {
          contentType: "application/pdf",
          upsert: false,
        })

      if (uploadError) throw uploadError

      const parsedNumber = number ? Number(number) : null
      const parsedYear = year ? Number(year) : null
      const { error: insertError } = await supabase.from("documentos_legales").insert({
        tipo: type,
        titulo: title.trim(),
        descripcion: description.trim() || null,
        numero: parsedNumber,
        anio: parsedYear,
        fecha_documento: documentDate || null,
        estado_registro: registrationState,
        es_vigente: registrationState !== "reemplazado" && registrationState !== "rechazado",
        firma_digital: digitallySigned,
        organismo_registro: agency.trim() || null,
        expediente: caseNumber.trim() || null,
        registrado_at: registrationState === "inscripto_ipj" ? new Date().toISOString() : null,
        componentes: [],
        etiquetas: registrationState === "inscripto_ipj" ? ["legal", "ipj"] : ["legal"],
        bucket: "documentos-legales",
        storage_path: uploadedPath,
        nombre_archivo: file.name,
        mime_type: "application/pdf",
        tamano_bytes: file.size,
        sha256: hash,
        created_by_socio_id: socio.id,
      })

      if (insertError) throw insertError

      toast.success("Documento incorporado al archivo legal")
      reset()
      onOpenChange(false)
      onSaved()
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage.from("documentos-legales").remove([uploadedPath])
      }
      const message = error instanceof Error ? error.message : "No se pudo guardar el documento legal."
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Subir documento legal</DialogTitle>
          <DialogDescription>
            El PDF se guarda en un espacio privado y queda identificado por hash para evitar duplicados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="legal-file">Archivo PDF</Label>
            <Input
              id="legal-file"
              type="file"
              accept="application/pdf,.pdf"
              disabled={saving}
              onChange={(event) => {
                const nextFile = event.target.files?.[0] || null
                setFile(nextFile)
                if (nextFile && !title) setTitle(nextFile.name.replace(/\.pdf$/i, ""))
              }}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="legal-title">Título</Label>
            <Input id="legal-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="legal-type">Tipo</Label>
            <select id="legal-type" value={type} onChange={(event) => setType(event.target.value as TipoDocumentoLegal)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="legal-state">Estado jurídico</Label>
            <select id="legal-state" value={registrationState} onChange={(event) => setRegistrationState(event.target.value as EstadoRegistroDocumento)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {stateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="legal-date">Fecha del documento</Label>
            <Input id="legal-date" type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="legal-number">Número</Label>
              <Input id="legal-number" type="number" min="1" value={number} onChange={(event) => setNumber(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal-year">Año</Label>
              <Input id="legal-year" type="number" min="1900" max="2200" value={year} onChange={(event) => setYear(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="legal-agency">Organismo</Label>
            <Input id="legal-agency" value={agency} onChange={(event) => setAgency(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="legal-case">Expediente o referencia</Label>
            <Input id="legal-case" value={caseNumber} onChange={(event) => setCaseNumber(event.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={digitallySigned} onChange={(event) => setDigitallySigned(event.target.checked)} />
            El archivo contiene firmas digitales
          </label>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="legal-description">Descripción</Label>
            <Textarea id="legal-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleSave()} disabled={!canSave} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {saving ? "Subiendo..." : "Guardar documento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
