"use client"

import { useEffect, useState } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Underline from "@tiptap/extension-underline"
import Image from "@tiptap/extension-image"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Save, Image as ImageIcon, Link as LinkIcon, Plus, ArrowUp, ArrowDown, Pencil, Trash2, X, Wand2, Copy, GripVertical } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { Propuesta, EstadoPropuesta, PropuestaSeccion } from "@/lib/types"
import { usePropuestas } from "@/hooks/usePropuestas"
import { useAuth } from "@/hooks/useAuth"

// --- TIPTAP ISOLATED COMPONENT --- 
function SectionTiptapEditor({ initialContent, onChange }: { initialContent: string, onChange: (html: string) => void }) {
  const [uploading, setUploading] = useState(false)

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !editor) return

    setUploading(true)
    try {
      const fileName = `propuestas/img-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-]/g, '')}`
      const { error: uploadError } = await supabase.storage.from('documentos').upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('documentos').getPublicUrl(fileName)
      
      editor.chain().focus().setImage({ src: data.publicUrl }).run()
      toast.success("Imagen insertada")
    } catch (error) {
      console.error("Error al subir imagen:", error)
      toast.error("Error al subir la imagen")
    } finally {
      setUploading(false)
      const input = document.getElementById('section-img-upload') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-[#6314a7] underline cursor-pointer" } }),
      Image.configure({ inline: true, HTMLAttributes: { class: "max-w-full rounded-lg shadow-sm border my-4" } }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm xl:prose-base max-w-none focus:outline-none min-h-[250px] p-4 border border-t-0 rounded-b-md border-border bg-white",
      },
    },
    immediatelyRender: false,
  })

  if (!editor) return null

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href
    const url = window.prompt("URL del enlace:", previousUrl)
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  return (
    <div className="flex flex-col w-full rounded-md border border-border shadow-sm">
      <div className="flex flex-wrap gap-1 border-b border-border bg-gray-50 p-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive("bold") ? "bg-muted" : "h-8"}>B</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive("italic") ? "bg-muted" : "h-8"}>I</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive("underline") ? "bg-muted" : "h-8"}>U</Button>
        <div className="w-px h-6 bg-border mx-1 self-center" />
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive("heading", { level: 2 }) ? "bg-muted" : "h-8"}>H2</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive("heading", { level: 3 }) ? "bg-muted" : "h-8"}>H3</Button>
        <div className="w-px h-6 bg-border mx-1 self-center" />
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive("bulletList") ? "bg-muted" : "h-8"}>Lista</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive("orderedList") ? "bg-muted" : "h-8"}>Números</Button>
        <div className="w-px h-6 bg-border mx-1 self-center" />
        <Button type="button" variant="ghost" size="sm" onClick={setLink} className={editor.isActive("link") ? "bg-muted" : "h-8"}>
          <LinkIcon className="w-4 h-4" />
        </Button>
        <div>
          <input type="file" id="section-img-upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
          <Button type="button" variant="ghost" size="sm" onClick={() => document.getElementById('section-img-upload')?.click()} className="h-8">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      <EditorContent editor={editor} />
      <div className="bg-gray-50 border-t border-border p-2 text-xs text-muted-foreground flex justify-between">
        <span>Usa el editor para dar formato a tu texto.</span>
        <span>El contenido se guardará en formato HTML.</span>
      </div>
    </div>
  )
}

// --- MAIN EDITOR ---
interface EditorPropuestaProps {
  initialData?: Propuesta | null
}

export function EditorPropuesta({ initialData }: EditorPropuestaProps) {
  const router = useRouter()
  const { createPropuesta, updatePropuesta } = usePropuestas()
  const { user } = useAuth()
  
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    titulo: initialData?.titulo || "",
    slug: initialData?.slug || "",
    descripcion_corta: initialData?.descripcion_corta || "",
    pie_imagen_principal: initialData?.pie_imagen_principal || "",
    autor: initialData?.autor || "",
    categoria: initialData?.categoria || "General",
    estado: (initialData?.estado || "borrador") as EstadoPropuesta,
    hero_image_url: initialData?.hero_image_url || null,
    palabras_clave: initialData?.palabras_clave || ([] as string[]),
    seo_titulo: initialData?.seo_titulo || "",
    seo_descripcion: initialData?.seo_descripcion || "",
    secciones: initialData?.secciones || ([] as PropuestaSeccion[]),
  })

  const [keywordInput, setKeywordInput] = useState("")
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null)
  const [insertingAtIndex, setInsertingAtIndex] = useState<number | null>(null)
  const [tempSection, setTempSection] = useState<PropuestaSeccion | null>(null)
  const [jsonInput, setJsonInput] = useState("")
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null)

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonInput)
      if (typeof parsed !== 'object' || !parsed) throw new Error("JSON Inválido")
      
      setFormData(prev => ({
        ...prev,
        titulo: parsed.titulo || prev.titulo,
        descripcion_corta: parsed.descripcion_corta || prev.descripcion_corta,
        pie_imagen_principal: parsed.pie_imagen_principal || prev.pie_imagen_principal,
        autor: parsed.autor || prev.autor,
        categoria: parsed.categoria || prev.categoria,
        palabras_clave: Array.isArray(parsed.palabras_clave) ? parsed.palabras_clave : prev.palabras_clave,
        seo_titulo: parsed.seo_titulo || prev.seo_titulo,
        seo_descripcion: parsed.seo_descripcion || prev.seo_descripcion,
        secciones: Array.isArray(parsed.secciones) 
          ? parsed.secciones.map((sec: { tipo?: string; titulo?: string; contenido?: string }, i: number) => ({
              id: crypto.randomUUID(),
              orden: prev.secciones.length + i + 1,
              tipo: sec.tipo && ['Texto', 'Imagen', 'Video'].includes(sec.tipo) ? sec.tipo : 'Texto',
              titulo: sec.titulo || "",
              contenido: sec.contenido || ""
            }))
          : prev.secciones
      }))
      
      if (parsed.titulo && !formData.slug) {
        setFormData(prev => ({ ...prev, slug: generateSlug(parsed.titulo) }))
      }

      toast.success("Estructura importada exitosamente")
      setJsonInput("")
    } catch (e) {
      toast.error("El formato JSON no es válido")
    }
  }

  const jsonTemplate = `{
  "titulo": "Título de la propuesta",
  "descripcion_corta": "Resumen conciso...",
  "pie_imagen_principal": "Créditos de la imagen...",
  "autor": "AILE",
  "categoria": "General",
  "palabras_clave": ["institucional", "novedad"],
  "seo_titulo": "Título corto SEO",
  "seo_descripcion": "Descripción para Google",
  "secciones": [
    {
      "tipo": "Texto",
      "titulo": "Introducción opcional",
      "contenido": "<p>Escribe tu contenido aquí usando etiquetas HTML (p, b, i, ul, li...)</p>"
    }
  ]
}`

  const copyTemplate = () => {
    navigator.clipboard.writeText(jsonTemplate)
    toast.success("Esquema JSON copiado al portapapeles")
  }

  const generateSlug = (text: string) => {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const titulo = e.target.value
    if (!initialData && !formData.slug) {
      setFormData(prev => ({ ...prev, titulo, slug: generateSlug(titulo), seo_titulo: titulo }))
    } else {
      setFormData(prev => ({ ...prev, titulo }))
    }
  }

  const handleHeroImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const fileName = `propuestas/hero-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-]/g, '')}`
      const { error: uploadError } = await supabase.storage.from('documentos').upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('documentos').getPublicUrl(fileName)
      setFormData(prev => ({ ...prev, hero_image_url: data.publicUrl }))
      toast.success("Imagen de cabecera subida")
    } catch (error) {
      console.error("Error al subir fondo:", error)
      toast.error("Error al subir imagen")
    } finally {
      setLoading(false)
      const input = document.getElementById('main-img-upload') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  const handleSectionImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const fileName = `propuestas/seccion-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-]/g, '')}`
      const { error: uploadError } = await supabase.storage.from('documentos').upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('documentos').getPublicUrl(fileName)
      
      setTempSection(prev => prev ? { ...prev, contenido: data.publicUrl } : null)
      toast.success("Imagen subida correctamente")
    } catch (error) {
      console.error("Error al subir imagen de sección:", error)
      toast.error("Error al subir la imagen")
    } finally {
      setLoading(false)
      const input = document.getElementById('section-img-direct-upload') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  const addKeyword = () => {
    const kw = keywordInput.trim().toLowerCase()
    if (kw && !formData.palabras_clave.includes(kw)) {
      setFormData(prev => ({ ...prev, palabras_clave: [...prev.palabras_clave, kw] }))
      setKeywordInput("")
    }
  }

  const removeKeyword = (kwToRemove: string) => {
    setFormData(prev => ({ ...prev, palabras_clave: prev.palabras_clave.filter(kw => kw !== kwToRemove) }))
  }

  // --- SECTIONS LOGIC ---
  const handleAddSection = (insertAtIndex?: number) => {
    const newSection: PropuestaSeccion = {
      id: crypto.randomUUID(),
      orden: formData.secciones.length + 1,
      tipo: 'Texto',
      titulo: '',
      contenido: ''
    }
    setTempSection(newSection)
    if (insertAtIndex !== undefined) {
      setInsertingAtIndex(insertAtIndex)
      setEditingSectionIndex(-2) // distinct token indicating inline insertion
    } else {
      setInsertingAtIndex(null)
      setEditingSectionIndex(-1) // bottom injection
    }
  }

  const handleEditSection = (index: number) => {
    setTempSection({ ...formData.secciones[index] })
    setEditingSectionIndex(index)
  }

  const saveTempSection = async () => {
    if (!tempSection) return
    const newSecciones = [...formData.secciones]

    if (editingSectionIndex === -1) {
      newSecciones.push(tempSection)
    } else if (editingSectionIndex === -2 && insertingAtIndex !== null) {
      newSecciones.splice(insertingAtIndex, 0, tempSection)
    } else if (editingSectionIndex !== null && editingSectionIndex >= 0) {
      newSecciones[editingSectionIndex] = tempSection
    }

    newSecciones.forEach((s, idx) => s.orden = idx + 1)

    setFormData(prev => ({ ...prev, secciones: newSecciones }))
    setTempSection(null)
    setEditingSectionIndex(null)
    setInsertingAtIndex(null)

    // Auto-guardar en DB si la propuesta ya existe
    if (initialData?.id) {
      setLoading(true)
      try {
        await updatePropuesta(initialData.id, {
          titulo: formData.titulo,
          slug: formData.slug,
          estado: formData.estado,
          contenido: "",
          descripcion_corta: formData.descripcion_corta || null,
          pie_imagen_principal: formData.pie_imagen_principal || null,
          autor: formData.autor || null,
          categoria: formData.categoria || null,
          hero_image_url: formData.hero_image_url || null,
          palabras_clave: formData.palabras_clave,
          seo_titulo: formData.seo_titulo || null,
          seo_descripcion: formData.seo_descripcion || null,
          secciones: newSecciones,
          created_by: user?.socio_id,
        })
        toast.success("Sección guardada")
      } catch {
        toast.error("Error al guardar la sección")
      } finally {
        setLoading(false)
      }
    }
  }

  const cancelEditSection = () => {
    setTempSection(null)
    setEditingSectionIndex(null)
    setInsertingAtIndex(null)
  }

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const newSecciones = [...formData.secciones]
    if (direction === 'up' && index > 0) {
      const temp = newSecciones[index]
      newSecciones[index] = newSecciones[index - 1]
      newSecciones[index - 1] = temp
    } else if (direction === 'down' && index < newSecciones.length - 1) {
      const temp = newSecciones[index]
      newSecciones[index] = newSecciones[index + 1]
      newSecciones[index + 1] = temp
    }
    // Re-index
    newSecciones.forEach((s, idx) => s.orden = idx + 1)
    setFormData(prev => ({ ...prev, secciones: newSecciones }))
  }

  const handleDeleteSection = (index: number) => {
    if (confirm("¿Estás seguro de eliminar esta sección?")) {
      const newSecciones = formData.secciones.filter((_, i) => i !== index)
      newSecciones.forEach((s, idx) => s.orden = idx + 1)
      setFormData(prev => ({ ...prev, secciones: newSecciones }))
    }
  }

  // --- SAVE FORM ---
  const handleSave = async () => {
    if (!formData.titulo.trim() || !formData.slug.trim()) {
      toast.error("El título y el enlace son obligatorios")
      return
    }

    setLoading(true)
    try {
      const payload: Omit<Propuesta, 'id' | 'created_at' | 'updated_at'> & { created_by?: string } = {
        titulo: formData.titulo,
        slug: formData.slug,
        estado: formData.estado,
        contenido: "", // Leave blank natively, everything is in secciones now
        descripcion_corta: formData.descripcion_corta || null,
        pie_imagen_principal: formData.pie_imagen_principal || null,
        autor: formData.autor || null,
        categoria: formData.categoria || null,
        hero_image_url: formData.hero_image_url || null,
        palabras_clave: formData.palabras_clave,
        seo_titulo: formData.seo_titulo || null,
        seo_descripcion: formData.seo_descripcion || null,
        secciones: formData.secciones,
        created_by: user?.socio_id,
      }
      
      if (initialData) {
        // usePropuestas update hook isn't strictly typed for new fields yet but the DB takes them
        await updatePropuesta(initialData.id, payload)
        toast.success("Actualizado correctamente")
      } else {
        await createPropuesta(payload)
        toast.success("Creado exitosamente")
      }
      router.push("/propuestas")
      router.refresh()
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') toast.error("Ya existe una propuesta con ese enlace URL (slug)")
      else toast.error("Error al guardar")
    } finally {
      setLoading(false)
    }
  }

  // Render Modal if editing section
  if (tempSection && editingSectionIndex !== null) {
    return (
      <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4 sm:p-8 bg-white rounded-lg border border-border mt-4">
        <div className="flex justify-between items-center border-b border-border pb-4">
          <h2 className="text-xl font-bold">Editar Sección</h2>
          <Button type="button" variant="ghost" size="icon" onClick={cancelEditSection}><X className="w-5 h-5" /></Button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo de Sección</Label>
              <Select 
                value={tempSection.tipo} 
                onValueChange={(val: 'Texto'|'Imagen'|'Video') => setTempSection(prev => prev ? {...prev, tipo: val} : null)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Texto">Texto / HTML</SelectItem>
                  <SelectItem value="Imagen">Imagen Central</SelectItem>
                  <SelectItem value="Video">Video Embed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Título de la Sección (Opcional)</Label>
              <Input 
                value={tempSection.titulo || ""}
                onChange={e => setTempSection(prev => prev ? {...prev, titulo: e.target.value} : null)}
                placeholder="Introducción..."
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Contenido</Label>
            {tempSection.tipo === 'Texto' ? (
              <SectionTiptapEditor 
                initialContent={tempSection.contenido} 
                onChange={(html) => setTempSection(prev => prev ? {...prev, contenido: html} : null)} 
              />
            ) : tempSection.tipo === 'Imagen' ? (
              <div className="space-y-3 pt-1">
                <div className="flex gap-2 items-center">
                  <Input 
                    value={tempSection.contenido}
                    onChange={e => setTempSection(prev => prev ? {...prev, contenido: e.target.value} : null)}
                    placeholder="URL de la imagen..."
                    className="flex-1"
                  />
                  <input type="file" id="section-img-direct-upload" className="hidden" accept="image/*" onChange={handleSectionImageUpload} />
                  <Button type="button" variant="outline" onClick={() => document.getElementById('section-img-direct-upload')?.click()} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ImageIcon className="w-4 h-4 mr-2" />}
                    Subir Imagen
                  </Button>
                </div>
                {tempSection.contenido && tempSection.contenido.startsWith('http') && (
                  <div className="relative w-full max-h-[300px] rounded-md overflow-hidden border border-border flex items-center justify-center bg-slate-50">
                    <img src={tempSection.contenido} alt="Vista previa" className="object-contain max-h-[300px]" />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Ingresa la URL directa o sube una imagen desde tu computadora.</p>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <Textarea 
                  value={tempSection.contenido}
                  onChange={e => setTempSection(prev => prev ? {...prev, contenido: e.target.value} : null)}
                  placeholder="Código iframe del video..."
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">Ingresa el código de incrustación provisto por la plataforma (ej. iframe de YouTube).</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={cancelEditSection} disabled={loading}>Cancelar</Button>
          <Button type="button" className="bg-[#a855f7] hover:bg-[#9333ea]" onClick={() => void saveTempSection()} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
          </Button>
        </div>
      </div>
    )
  }

  // --- MAIN VIEW ---
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-foreground">
          {initialData ? "Editar Módulo Especial" : "Crear Documento"}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200">
                <Wand2 className="w-4 h-4 mr-2" />
                Asistente IA
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw]">
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center gap-2 text-purple-800">
                  <Wand2 className="w-5 h-5" /> Importación mediante IA
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 mt-2">
                <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm">1. Copia el Esquema Base</h3>
                    <Button type="button" variant="outline" size="sm" onClick={copyTemplate}>
                      <Copy className="w-4 h-4 mr-2" /> Copiar JSON
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Pídele a ChatGPT o Claude que redacte tu idea rellenando este molde. Usa HTML puro dentro del contenido.</p>
                  <pre className="mt-2 p-3 bg-slate-900 text-slate-50 rounded-md text-[11px] overflow-auto max-h-48 custom-scrollbar">
                    {jsonTemplate}
                  </pre>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">2. Pega e Importa</h3>
                  <p className="text-xs text-muted-foreground">Pega la estructura JSON completada por la IA aquí para autocompletar todo el formulario.</p>
                  <Textarea 
                    value={jsonInput}
                    onChange={e => setJsonInput(e.target.value)}
                    placeholder="Pega el código JSON aquí..."
                    className="font-mono text-xs min-h-[150px] bg-slate-50"
                  />
                  <Button type="button" onClick={handleImportJson} className="w-full bg-[#a855f7] hover:bg-[#9333ea] text-white">
                    Importar Datos al Formulario
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button type="button" variant="outline" onClick={() => router.push("/propuestas")} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={loading} className="bg-slate-900 border border-slate-700">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Todo
          </Button>
        </div>
      </div>

      {/* BLOQUE PRINCIPAL */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold flex gap-1">Título <span className="text-red-500">*</span></Label>
            <Input value={formData.titulo} onChange={handleTitleChange} placeholder="Novedad Institucional..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold flex gap-1">URL Amigable (Slug) <span className="text-red-500">*</span></Label>
            <Input value={formData.slug} onChange={e => setFormData(prev => ({...prev, slug: generateSlug(e.target.value)}))} placeholder="url-amigable-123" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-semibold flex gap-1">Descripción Corta <span className="text-red-500">*</span></Label>
          <Textarea 
            value={formData.descripcion_corta} 
            onChange={e => setFormData(prev => ({...prev, descripcion_corta: e.target.value}))} 
            placeholder="Resumen visible en tarjetas y vistas previas..."
            className="h-20"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5 relative">
            <Label className="text-sm font-semibold flex gap-1">URL de la Imagen Principal <span className="text-red-500">*</span></Label>
            <div className="flex gap-2">
              <Input value={formData.hero_image_url || ""} onChange={e => setFormData(prev => ({...prev, hero_image_url: e.target.value}))} placeholder="https://..." />
              <input type="file" id="main-img-upload" className="hidden" accept="image/*" onChange={handleHeroImageUpload} />
              <Button type="button" variant="outline" onClick={() => document.getElementById('main-img-upload')?.click()}>
                <ImageIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm border-transparent font-semibold text-muted-foreground tracking-wide">Pie de Imagen Principal</Label>
            <Input value={formData.pie_imagen_principal} onChange={e => setFormData(prev => ({...prev, pie_imagen_principal: e.target.value}))} placeholder="Créditos o subtítulo de la portada..." />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Autor</Label>
            <Input value={formData.autor} onChange={e => setFormData(prev => ({...prev, autor: e.target.value}))} placeholder="Ej: AILE, Equipo de Prensa..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Categoría</Label>
            <Select value={formData.categoria} onValueChange={val => setFormData(prev => ({...prev, categoria: val}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="General">General</SelectItem>
                <SelectItem value="Institucional">Institucional</SelectItem>
                <SelectItem value="Proyectos">Proyectos</SelectItem>
                <SelectItem value="Prensa">Prensa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold flex gap-1">Estado <span className="text-red-500">*</span></Label>
            <Select value={formData.estado} onValueChange={(val: EstadoPropuesta) => setFormData(prev => ({...prev, estado: val}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="borrador">Borrador</SelectItem>
                <SelectItem value="publicado">Publicado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <Label className="text-sm font-semibold">Palabras Clave</Label>
          <div className="flex gap-2">
            <Input 
              value={keywordInput} 
              onChange={e => setKeywordInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
              placeholder="Agregar palabra clave..." 
            />
            <Button type="button" variant="secondary" onClick={addKeyword}>Agregar</Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.palabras_clave.map(kw => (
              <span key={kw} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {kw}
                <button type="button" onClick={() => removeKeyword(kw)} className="ml-1.5 text-blue-600 hover:text-blue-900">
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* BLOQUE SEO */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Configuración SEO</h3>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Título SEO</Label>
            <Input value={formData.seo_titulo} onChange={e => setFormData(prev => ({...prev, seo_titulo: e.target.value}))} />
            <p className="text-xs text-muted-foreground text-right">{formData.seo_titulo?.length || 0}/60 caracteres</p>
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Descripción SEO</Label>
            <Textarea 
              value={formData.seo_descripcion} 
              onChange={e => setFormData(prev => ({...prev, seo_descripcion: e.target.value}))} 
              className="h-20"
            />
            <p className="text-xs text-muted-foreground text-right">{formData.seo_descripcion?.length || 0}/160 caracteres</p>
          </div>
        </div>
      </div>

      {/* BLOQUE SECCIONES */}
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Contenido por Secciones</h3>
          <Button type="button" onClick={() => handleAddSection()} className="bg-[#a855f7] hover:bg-[#9333ea] text-white">
            <Plus className="w-4 h-4 mr-2" /> Agregar Sección al final
          </Button>
        </div>
        
        <div className="flex flex-col gap-4">
          {formData.secciones.length === 0 ? (
            <div className="text-center p-8 border-2 border-dashed border-border rounded-lg text-muted-foreground">
              No hay secciones de contenido. Agrega una para comenzar.
            </div>
          ) : (
            formData.secciones.map((sec, i) => (
              <div key={sec.id} className="relative">
                {/* Zona Hover Injectora */}
                <div 
                  className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[18px] flex justify-center items-center group/inject z-20 cursor-pointer" 
                  onClick={(e) => { e.stopPropagation(); handleAddSection(i); }}
                >
                  <div className="opacity-0 group-hover/inject:opacity-100 transition-opacity bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-medium px-3 py-1 rounded-full shadow-sm flex items-center">
                    <Plus className="w-3 h-3 mr-1" /> Añadir sección aquí
                  </div>
                  {/* Línea horizontal guía (opcional pero ayuda a UX) */}
                  <div className="absolute top-1/2 w-full h-px bg-purple-300 opacity-0 group-hover/inject:opacity-100 transition-opacity -z-10" />
                </div>

                <div 
                  draggable
                  onDragStart={(e) => {
                    setDraggedSectionIndex(i)
                    if (e.dataTransfer) {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', i.toString())
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (draggedSectionIndex !== null && draggedSectionIndex !== i) {
                      const newSecciones = [...formData.secciones]
                      const draggedItem = newSecciones[draggedSectionIndex]
                      newSecciones.splice(draggedSectionIndex, 1)
                      newSecciones.splice(i, 0, draggedItem)
                      newSecciones.forEach((s, idx) => s.orden = idx + 1)
                      setFormData(prev => ({ ...prev, secciones: newSecciones }))
                    }
                    setDraggedSectionIndex(null)
                  }}
                  onDragEnd={() => setDraggedSectionIndex(null)}
                  className={`bg-white border ${draggedSectionIndex === i ? 'opacity-50 border-purple-400' : 'border-slate-200'} rounded-lg p-4 flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow cursor-move relative z-10`}
                >
                  <div className="flex flex-col gap-1 w-10 shrink-0 cursor-move h-full justify-center items-center text-slate-300 hover:text-slate-600">
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleMoveSection(i, 'up'); }} disabled={i===0} className="p-1 disabled:opacity-30"><ArrowUp className="w-4 h-4 mx-auto"/></button>
                    <GripVertical className="w-5 h-5 mx-auto opacity-50 my-1" />
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleMoveSection(i, 'down'); }} disabled={i===formData.secciones.length-1} className="p-1 disabled:opacity-30"><ArrowDown className="w-4 h-4 mx-auto"/></button>
                  </div>
                  <div className="flex-1 min-w-0 pt-1 cursor-default" onPointerDown={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1">
                        {sec.tipo === 'Texto' && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                        {sec.tipo === 'Imagen' && <ImageIcon className="w-3 h-3" />}
                        {sec.tipo}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Orden: {sec.orden}</span>
                    </div>
                    {sec.titulo && <h4 className="font-bold text-slate-900 text-sm mb-1">{sec.titulo}</h4>}
                    <div className="text-sm text-slate-600 line-clamp-2" dangerouslySetInnerHTML={{ __html: sec.tipo === 'Texto' ? sec.contenido.replace(/<[^>]*>?/gm, ' ') : sec.contenido }} />
                  </div>
                  <div className="flex gap-1 shrink-0 cursor-default" onPointerDown={(e) => e.stopPropagation()}>
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleEditSection(i)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"><Pencil className="w-4 h-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteSection(i)} className="text-red-500 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
