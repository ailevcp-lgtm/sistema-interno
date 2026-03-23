"use client"

import { useEffect, useRef, useState } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Loader2, Save, FileDown, Eye, PenLine } from "lucide-react"
import { toast } from "sonner"
import html2pdf from "html2pdf.js"
import { supabase } from "@/lib/supabase"
import type { EstadoResolucion, Resolucion, TipoResolucion } from "@/lib/types"
import { escapeHtml, sanitizeRichHtml } from "@/lib/html-sanitizer"

interface ResolutionEditorProps {
    initialData?: Partial<Resolucion>
    defaultType?: TipoResolucion
    onSave: (data: Partial<Resolucion>) => Promise<void>
    onCancel: () => void
}

const DEFAULT_EDITOR_HTML = `
  <p><strong>VISTO:</strong></p>
  <p>...</p>
  <p><strong>CONSIDERANDO:</strong></p>
  <p>...</p>
  <p><strong>LA COMISIÓN DIRECTIVA DE LA ASOCIACIÓN CIVIL AILE RESUELVE:</strong></p>
  <p><strong>ARTÍCULO 1°:</strong> ...</p>
  <p><strong>ARTÍCULO 2°:</strong> ...</p>
  <p><strong>ARTÍCULO 3°:</strong> De forma.</p>
`

function buildInitialFormData(initialData: Partial<Resolucion> | undefined, defaultType: TipoResolucion) {
    return {
        titulo: initialData?.titulo || "",
        numero: initialData?.numero || new Date().getMonth() + 1,
        anio: initialData?.anio || new Date().getFullYear(),
        fecha: initialData?.fecha || new Date().toISOString().split("T")[0],
        tipo: (initialData?.tipo || defaultType) as TipoResolucion,
        estado: (initialData?.estado || "borrador") as EstadoResolucion,
    }
}

function buildSnapshot(formData: ReturnType<typeof buildInitialFormData>, contentHtml: string) {
    return JSON.stringify({
        titulo: formData.titulo,
        numero: formData.numero,
        anio: formData.anio,
        fecha: formData.fecha,
        tipo: formData.tipo,
        estado: formData.estado,
        contenido: contentHtml,
    })
}

function buildPdfMarkup(formData: ReturnType<typeof buildInitialFormData>, contentHtml: string) {
    return `
      <div style="padding: 40px; font-family: 'Times New Roman', serif;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="margin: 0;">ASOCIACIÓN CIVIL AILE</h2>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Personería Jurídica...</p>
        </div>
        <div style="text-align: right; margin-bottom: 20px;">
          <p><strong>${formData.tipo === "decreto" ? "DECRETO" : "RESOLUCIÓN"} N° ${String(formData.numero).padStart(3, "0")}/${escapeHtml(String(formData.anio))}</strong></p>
          <p>Buenos Aires, ${new Date(formData.fecha).toLocaleDateString("es-AR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}</p>
        </div>
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 30px;">
          ${escapeHtml(formData.titulo)}
        </h3>
        <div style="text-align: justify; line-height: 1.6;">
          ${contentHtml}
        </div>
        <div style="margin-top: 60px; display: flex; justify-content: space-between;">
          <div style="text-align: center; width: 40%;">
            <div style="border-top: 1px solid #000; margin-top: 40px;"></div>
            <p>Secretario General</p>
          </div>
          <div style="text-align: center; width: 40%;">
            <div style="border-top: 1px solid #000; margin-top: 40px;"></div>
            <p>Presidente</p>
          </div>
        </div>
      </div>
    `
}

export function ResolutionEditor({
    initialData,
    defaultType = "asamblea",
    onSave,
    onCancel,
}: ResolutionEditorProps) {
    const [loading, setLoading] = useState(false)
    const [generatingPdf, setGeneratingPdf] = useState(false)
    const [previewMode, setPreviewMode] = useState(false)
    const [formData, setFormData] = useState(() => buildInitialFormData(initialData, defaultType))
    const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(initialData?.archivo_url || null)
    const initialSnapshotRef = useRef<string>(
        buildSnapshot(
            buildInitialFormData(initialData, defaultType),
            sanitizeRichHtml(initialData?.contenido || DEFAULT_EDITOR_HTML)
        )
    )

    useEffect(() => {
        const nextFormData = buildInitialFormData(initialData, defaultType)
        const nextContent = sanitizeRichHtml(initialData?.contenido || DEFAULT_EDITOR_HTML)

        setFormData(nextFormData)
        setGeneratedPdfUrl(initialData?.archivo_url || null)
        initialSnapshotRef.current = buildSnapshot(nextFormData, nextContent)
    }, [defaultType, initialData])

    const editor = useEditor({
        extensions: [StarterKit],
        content: sanitizeRichHtml(initialData?.contenido || DEFAULT_EDITOR_HTML),
        editorProps: {
            attributes: {
                class:
                    "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[300px] p-4 border rounded-md border-input bg-transparent",
            },
        },
        immediatelyRender: false,
    })

    const handleGeneratePdf = async () => {
        if (!editor) return null

        setGeneratingPdf(true)
        try {
            const sanitizedContent = sanitizeRichHtml(editor.getHTML())
            const element = document.createElement("div")
            element.innerHTML = buildPdfMarkup(formData, sanitizedContent)

            const opt = {
                margin: 10,
                filename: `${formData.tipo === "decreto" ? "decreto" : "resolucion"}-${formData.numero}-${formData.anio}.pdf`,
                image: { type: "jpeg" as const, quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
            }

            const pdfBlob = await html2pdf().set(opt).from(element).output("blob")
            const fileName = `${formData.tipo === "decreto" ? "decretos" : "resoluciones"}/${formData.anio}/${formData.numero}-${Date.now()}.pdf`

            const { error: uploadError } = await supabase.storage
                .from("documentos")
                .upload(fileName, pdfBlob, {
                    contentType: "application/pdf",
                })

            if (uploadError) throw uploadError

            const { data: publicUrlData } = supabase.storage
                .from("documentos")
                .getPublicUrl(fileName)

            setGeneratedPdfUrl(publicUrlData.publicUrl)
            initialSnapshotRef.current = buildSnapshot(formData, sanitizedContent)
            toast.success("PDF generado y subido correctamente")
            return publicUrlData.publicUrl
        } catch (error) {
            console.error("Error generating PDF:", error)
            toast.error("Error al generar el PDF")
            return null
        } finally {
            setGeneratingPdf(false)
        }
    }

    const handleSubmit = async () => {
        if (!editor) return

        setLoading(true)
        try {
            const sanitizedContent = sanitizeRichHtml(editor.getHTML())
            const currentSnapshot = buildSnapshot(formData, sanitizedContent)
            const shouldPersistPdf = formData.estado !== "borrador" || Boolean(generatedPdfUrl)
            let archivoUrl = generatedPdfUrl

            if (shouldPersistPdf && (!archivoUrl || initialSnapshotRef.current !== currentSnapshot)) {
                archivoUrl = await handleGeneratePdf()
            }

            const dataToSave: Partial<Resolucion> = {
                ...formData,
                contenido: sanitizedContent,
            }

            if (archivoUrl) {
                dataToSave.archivo_url = archivoUrl
            }

            await onSave(dataToSave)
        } catch (error) {
            console.error("Error saving resolution:", error)
            toast.error("Error al guardar la resolución")
        } finally {
            setLoading(false)
        }
    }

    const previewHtml = sanitizeRichHtml(editor?.getHTML() || "")
    const isBusy = loading || generatingPdf

    return (
        <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-bold">
                    {initialData ? "Editar Resolución" : "Nueva Resolución"}
                </h2>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={onCancel} disabled={isBusy}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={isBusy}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Guardar
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                        value={formData.titulo}
                        onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                        placeholder="Ej: Aprobación de Balance 2025"
                    />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                        <Label>Número</Label>
                        <Input
                            type="number"
                            value={formData.numero}
                            onChange={(e) =>
                                setFormData({ ...formData, numero: Number(e.target.value) || 0 })
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Año</Label>
                        <Input
                            type="number"
                            value={formData.anio}
                            onChange={(e) =>
                                setFormData({ ...formData, anio: Number(e.target.value) || 0 })
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Input
                            type="date"
                            value={formData.fecha}
                            onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                        value={formData.tipo}
                        onValueChange={(val: TipoResolucion) =>
                            setFormData({ ...formData, tipo: val })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="asamblea">Asamblea</SelectItem>
                            <SelectItem value="decreto">Decreto CD</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select
                        value={formData.estado}
                        onValueChange={(val: EstadoResolucion) =>
                            setFormData({ ...formData, estado: val })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="borrador">Borrador</SelectItem>
                            <SelectItem value="vigente">Vigente</SelectItem>
                            <SelectItem value="derogada">Derogada</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border border-border">
                <div className="flex flex-col gap-2 border-b border-border bg-muted/30 p-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-1 overflow-x-auto">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editor?.chain().focus().toggleBold().run()}
                            className={editor?.isActive("bold") ? "bg-muted" : ""}
                        >
                            Bold
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editor?.chain().focus().toggleItalic().run()}
                            className={editor?.isActive("italic") ? "bg-muted" : ""}
                        >
                            Italic
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                editor?.chain().focus().toggleHeading({ level: 3 }).run()
                            }
                            className={editor?.isActive("heading", { level: 3 }) ? "bg-muted" : ""}
                        >
                            H3
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editor?.chain().focus().toggleBulletList().run()}
                            className={editor?.isActive("bulletList") ? "bg-muted" : ""}
                        >
                            List
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => setPreviewMode(!previewMode)}
                            disabled={isBusy}
                        >
                            {previewMode ? (
                                <>
                                    <PenLine className="mr-2 h-3.5 w-3.5" />
                                    Editar
                                </>
                            ) : (
                                <>
                                    <Eye className="mr-2 h-3.5 w-3.5" />
                                    Vista Previa
                                </>
                            )}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-8"
                            onClick={() => void handleGeneratePdf()}
                            disabled={isBusy}
                        >
                            {generatingPdf ? (
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <FileDown className="mr-2 h-3.5 w-3.5" />
                            )}
                            Generar PDF
                        </Button>
                    </div>
                </div>

                {previewMode ? (
                    <div className="min-h-[300px] bg-white p-4 text-black sm:p-8 prose prose-sm max-w-none">
                        <div className="mb-4 text-right">
                            <p className="font-bold">
                                {formData.tipo === "decreto" ? "DECRETO" : "RESOLUCIÓN"} N° {String(formData.numero).padStart(3, "0")}/{formData.anio}
                            </p>
                            <p>
                                Buenos Aires, {new Date(formData.fecha).toLocaleDateString("es-AR", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                })}
                            </p>
                        </div>
                        <h3 className="mb-6 text-center text-lg font-bold uppercase">{formData.titulo}</h3>
                        <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    </div>
                ) : (
                    <EditorContent editor={editor} />
                )}
            </div>
        </div>
    )
}
