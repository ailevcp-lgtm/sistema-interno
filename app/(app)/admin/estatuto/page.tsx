"use client"

import { useState, useEffect, useCallback } from "react"
import { useDocumentos } from "@/hooks/useDocumentos"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { DocumentUpload } from "@/components/aile/document-upload"
import { ArrowLeft, Pencil, FileText, Upload } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import type { ArticuloEstatuto } from "@/lib/types"
import { useResumeRefresh } from "@/hooks/useResumeRefresh"
import { useRequirePermission } from "@/hooks/useAuth"

export default function AdminEstatutoPage() {
    const { loading: checkingPermission, hasPermission } = useRequirePermission("documentos", "crear", "/documentos")

    const [articulos, setArticulos] = useState<ArticuloEstatuto[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedArt, setSelectedArt] = useState<ArticuloEstatuto | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)

    const { getEstatuto, updateArticulo, createArticulo, deleteArticulo, deleteAllArticulos, createArticulosBulk, getConfig, updateConfig } = useDocumentos()

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [artData, configPdf] = await Promise.all([
                getEstatuto(),
                getConfig("estatuto_pdf_url")
            ])
            setArticulos(artData)
            setPdfUrl(configPdf)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar datos")
        } finally {
            setLoading(false)
        }
    }, [getConfig, getEstatuto])

    useEffect(() => {
        void loadData()
    }, [loadData])

    useResumeRefresh(() => { void loadData() }, { throttleMs: 5_000 })

    const handleCreate = () => {
        setSelectedArt({
            id: '',
            capitulo: 1,
            articulo: (articulos.length + 1).toString(),
            titulo: '',
            contenido: '',
            updated_at: new Date().toISOString()
        })
        setIsDialogOpen(true)
    }

    const handleEdit = (art: ArticuloEstatuto) => {
        setSelectedArt(art)
        setIsDialogOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este artículo?")) return
        try {
            await deleteArticulo(id)
            loadData()
        } catch (error) {
            console.error(error)
        }
    }

    const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const loadingToast = toast.loading("Procesando archivo...")

        try {
            const arrayBuffer = await file.arrayBuffer()
            // @ts-ignore
            const mammoth = (await import("mammoth")).default
            const result = await mammoth.extractRawText({ arrayBuffer })
            const fullText = result.value

            console.log("Extracted Text Length:", fullText.length)

            // Improved Regex based on specific file format:
            // Matches "ARTÍCULO X.-" or "ARTÍCULO X bis.-" or "ARTÍCULO X ter.-"
            // Also matches "DISPOSICIÓN TRANSITORIA PRIMERA:" etc.
            const splitRegex = /(?:^|\n)(?=ART[ÍI]CULO\s+[\d\w\s]+[.:-]+|DISPOSICI[ÓO]N\s+TRANSITORIA)/gi;

            const rawSections = fullText.split(splitRegex).filter(s => s.trim().length > 0);

            console.log("Raw Sections found:", rawSections.length)

            if (rawSections.length === 0) {
                toast.error("No se detectaron artículos. Verifique el formato", { id: loadingToast })
                return
            }

            const validSections = rawSections.filter(s =>
                /^\s*(ART[ÍI]CULO|DISPOSICI[ÓO]N)/i.test(s)
            )

            if (validSections.length === 0) {
                toast.error("No se detectaron secciones válidas.", { id: loadingToast })
                return
            }

            if (!confirm(`Se detectaron ${validSections.length} artículos/disposiciones. ¿Desea reemplazar TODA la lista actual?`)) {
                toast.dismiss(loadingToast)
                return
            }

            // Clear existing
            await deleteAllArticulos()

            // Prepare bulk data
            const newArticles = validSections.map((section, index) => {
                const cleanedSection = section.trim()

                let capitulo = 1
                let articuloNum = "" // Changed to string
                let titulo = "Sin Título"
                let contenido = cleanedSection

                // Match Article Start: Allow multiple separator chars like ".-"
                const matchArt = cleanedSection.match(/^(ART[ÍI]CULO\s+)([\d\w\s.]+)([.:-]+)\s*(.*)/i)
                const matchDisp = cleanedSection.match(/^(DISPOSICI[ÓO]N\s+TRANSITORIA\s+)(\w+)([:.-]?)\s*(.*)/i)

                if (matchArt) {
                    const numberPart = matchArt[2].trim() // "1", "11.1", "26 bis"
                    const possibleTitle = matchArt[4].trim().split('\n')[0]

                    articuloNum = numberPart // Keep as string string

                    if (possibleTitle && possibleTitle.length < 150) {
                        titulo = possibleTitle
                    }

                    contenido = cleanedSection
                } else if (matchDisp) {
                    // Handle Transitory Provisions
                    capitulo = 99
                    articuloNum = (1000 + index).toString() // use explicit ordering or string
                    titulo = `DISPOSICIÓN TRANSITORIA ${matchDisp[2].trim()}`
                    contenido = cleanedSection
                } else {
                    // Fallback 
                    articuloNum = (index + 1).toString()
                }

                return {
                    capitulo,
                    articulo: articuloNum,
                    titulo: titulo,
                    contenido: contenido
                }
            })

            await createArticulosBulk(newArticles)
            toast.success("Estatuto importado correctamente", { id: loadingToast })
            loadData()

        } catch (error: any) {
            console.error("Bulk Import Error Details:", JSON.stringify(error, null, 2))
            toast.error(`Error al importar: ${error.message || 'Desconocido'}`, { id: loadingToast })
        } finally {
            e.target.value = ""
        }
    }

    const handleSaveArticle = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedArt) return

        try {
            if (selectedArt.id) {
                await updateArticulo(selectedArt.id, selectedArt.contenido, selectedArt.titulo)
            } else {
                await createArticulo({
                    capitulo: selectedArt.capitulo,
                    articulo: selectedArt.articulo,
                    titulo: selectedArt.titulo,
                    contenido: selectedArt.contenido
                })
            }
            setIsDialogOpen(false)
            loadData()
        } catch (error) {
            console.error(error)
        }
    }

    const handlePdfUpload = async (url: string) => {
        if (!url) return // Handle clear
        try {
            await updateConfig("estatuto_pdf_url", url)
            setPdfUrl(url)
            toast.success("PDF oficial actualizado")
        } catch (error) {
            console.error(error)
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/documentos">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Gestión de Estatuto</h1>
                        <p className="text-muted-foreground">Editar artículos y actualizar documento oficial</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <input
                            type="file"
                            id="bulk-upload"
                            accept=".docx"
                            className="hidden"
                            onChange={handleBulkImport}
                        />
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => document.getElementById('bulk-upload')?.click()}
                        >
                            <Upload className="h-4 w-4" />
                            Importar Completo
                        </Button>
                    </div>
                    <Button onClick={handleCreate} className="gap-2">
                        <FileText className="h-4 w-4" />
                        Nuevo Artículo
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* PDF Upload Section */}
                <div className="md:col-span-1 space-y-4">
                    <div className="p-4 border rounded-lg bg-card">
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            PDF Oficial
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Sube el archivo PDF firmado del estatuto completo. Este archivo será descargable por los socios.
                        </p>
                        <DocumentUpload
                            folder="estatuto"
                            onUploadComplete={handlePdfUpload}
                            label="Subir Estatuto Firmado"
                        />
                        {pdfUrl && (
                            <div className="mt-4">
                                <p className="text-xs text-muted-foreground mb-1">Archivo actual:</p>
                                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline truncate block">
                                    {pdfUrl.split('/').pop()}
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                {/* Articles List */}
                <div className="md:col-span-2 border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Art.</TableHead>
                                <TableHead>Título</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                        Cargando...
                                    </TableCell>
                                </TableRow>
                            ) : (
                                articulos.map((art) => (
                                    <TableRow key={art.id}>
                                        <TableCell className="font-mono font-medium">#{art.articulo}</TableCell>
                                        <TableCell>{art.titulo}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEdit(art)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                {/* Delete button could be added here if needed */}
                                                {/* <Button variant="ghost" size="sm" onClick={() => handleDelete(art.id)}><Trash className="h-4 w-4 text-red-500" /></Button> */}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedArt?.id ? `Editar Artículo ${selectedArt.articulo}` : 'Nuevo Artículo'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveArticle} className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-1">
                                <Label>Capítulo</Label>
                                <Input
                                    type="number"
                                    value={selectedArt?.capitulo || 1}
                                    onChange={(e) => setSelectedArt(prev => prev ? ({ ...prev, capitulo: parseInt(e.target.value) }) : null)}
                                />
                            </div>
                            <div className="col-span-1">
                                <Label>Artículo Nº</Label>
                                <Input
                                    value={selectedArt?.articulo || ''}
                                    onChange={(e) => setSelectedArt(prev => prev ? ({ ...prev, articulo: e.target.value }) : null)}
                                />
                            </div>
                            <div className="col-span-2">
                                <Label>Título</Label>
                                <Input
                                    value={selectedArt?.titulo || ''}
                                    onChange={(e) => setSelectedArt(prev => prev ? ({ ...prev, titulo: e.target.value }) : null)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-between items-center bg-muted/30 p-2 rounded-md border border-border mb-2">
                            <Label>Contenido</Label>
                            <div className="relative">
                                <input
                                    type="file"
                                    id="docx-upload-dialog"
                                    accept=".docx"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        const toastId = toast.loading("Importando documento...")
                                        try {
                                            const arrayBuffer = await file.arrayBuffer()
                                            // @ts-ignore
                                            const mammoth = (await import("mammoth")).default
                                            const result = await mammoth.extractRawText({ arrayBuffer }) // Use raw text for textarea

                                            if (result.value) {
                                                setSelectedArt(prev => prev ? ({ ...prev, contenido: result.value }) : null)
                                                toast.success("Texto importado", { id: toastId })
                                            } else {
                                                toast.warning("Sin texto extraíble", { id: toastId })
                                            }
                                        } catch (error) {
                                            console.error(error)
                                            toast.error("Error al importar", { id: toastId })
                                        } finally {
                                            e.target.value = ""
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 h-7 text-xs"
                                    onClick={() => document.getElementById('docx-upload-dialog')?.click()}
                                >
                                    <Upload className="h-3 w-3" />
                                    Importar Word
                                </Button>
                            </div>
                        </div>
                        <div>
                            <Textarea
                                value={selectedArt?.contenido || ''}
                                onChange={(e) => setSelectedArt(prev => prev ? ({ ...prev, contenido: e.target.value }) : null)}
                                className="min-h-[300px] font-mono text-sm"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit">Guardar Cambios</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
