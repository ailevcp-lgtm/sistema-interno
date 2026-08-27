"use client"

import { Download, ChevronDown, ChevronRight, BookOpen, Scale, Gavel, BarChart2, Plus, FileText, Upload, Eye, Bell, Pencil, Trash2, Loader2, ShieldCheck, LockKeyhole } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useDocumentos } from "@/hooks/useDocumentos"
import { formatDate } from "@/lib/utils"
import type { ArticuloEstatuto, Resolucion, Balance, TipoResolucion } from "@/lib/types"
import type { DocumentoLegal, TipoDocumentoLegal } from "@/lib/legal-documents"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useResumeRefresh } from "@/hooks/useResumeRefresh"
import { BalanceUploadDialog, getDocumentStoragePathFromPublicUrl } from "@/components/aile/balance-upload-dialog"
import { supabase } from "@/lib/supabase"
import { ResolutionEditor } from "@/components/aile/resolution-editor"
import { sanitizeRichHtml } from "@/lib/html-sanitizer"
import { toast } from "sonner"
import { LegalDocumentUploadDialog } from "@/components/aile/legal-document-upload-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type DocTab = "archivo-legal" | "estatuto" | "resoluciones" | "decretos" | "balances"

function isDocTab(value: string | null): value is DocTab {
  return value === "archivo-legal" || value === "estatuto" || value === "resoluciones" || value === "decretos" || value === "balances"
}

const tabs: { id: DocTab; label: string; icon: typeof BookOpen }[] = [
  { id: "archivo-legal", label: "Archivo legal", icon: ShieldCheck },
  { id: "estatuto", label: "Estatuto", icon: BookOpen },
  { id: "resoluciones", label: "Resoluciones", icon: Scale },
  { id: "decretos", label: "Decretos CD", icon: Gavel },
  { id: "balances", label: "Balances", icon: BarChart2 },
]

const estadoStyles: Record<string, { bg: string; color: string }> = {
  vigente: { bg: "#ecfdf5", color: "#059669" },
  derogada: { bg: "#fef2f2", color: "#dc2626" },
  aprobado_asamblea: { bg: "#ede5f7", color: "#6314a7" },
  aprobado_cd: { bg: "#fef3c7", color: "#b45309" },
  borrador: { bg: "#f3f4f6", color: "#6b7280" },
  pendiente_firma: { bg: "#fff7ed", color: "#c2410c" },
  firmado: { bg: "#eff6ff", color: "#1d4ed8" },
  presentado_ipj: { bg: "#fef3c7", color: "#b45309" },
  inscripto_ipj: { bg: "#ecfdf5", color: "#047857" },
  rechazado: { bg: "#fef2f2", color: "#dc2626" },
  reemplazado: { bg: "#f3f4f6", color: "#6b7280" },
}

const estadoLabels: Record<string, string> = {
  vigente: "Vigente",
  derogada: "Derogada",
  aprobado_asamblea: "Aprobado por Asamblea",
  aprobado_cd: "Aprobado por CD",
  borrador: "Borrador",
  pendiente_firma: "Pendiente de firma",
  firmado: "Firmado",
  presentado_ipj: "Presentado ante IPJ",
  inscripto_ipj: "Inscripto en IPJ",
  rechazado: "Rechazado",
  reemplazado: "Reemplazado",
}

const legalTypeLabels: Record<TipoDocumentoLegal, string> = {
  acta_constitutiva_estatuto: "Acta constitutiva y estatuto",
  acta_cd: "Acta de Comisión Directiva",
  acta_asamblea: "Acta de Asamblea",
  resolucion_cd: "Resolución de Comisión Directiva",
  constancia_ipj: "Constancia IPJ",
  libro_digital: "Libro digital",
  otro: "Otro documento legal",
}

export function DocumentosPage() {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get("tab")
  const [activeTab, setActiveTab] = useState<DocTab>("archivo-legal")
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null)
  const {
    getEstatuto,
    getResoluciones,
    getBalances,
    deleteBalance,
    notifyBalanceUpload,
    createResolucion,
    updateResolucion,
    getDocumentosLegales,
    getDocumentoLegalSignedUrl,
  } = useDocumentos()
  const { user, hasPermission } = useAuth()

  const [articulos, setArticulos] = useState<ArticuloEstatuto[]>([])
  const [resoluciones, setResoluciones] = useState<Resolucion[]>([])
  const [decretos, setDecretos] = useState<Resolucion[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [documentosLegales, setDocumentosLegales] = useState<DocumentoLegal[]>([])
  const [tabLoading, setTabLoading] = useState(true)
  const [estatutoOficial, setEstatutoOficial] = useState<DocumentoLegal | null>(null)
  const [selectedNorma, setSelectedNorma] = useState<Resolucion | null>(null)
  const [resolutionEditorOpen, setResolutionEditorOpen] = useState(false)
  const [editingResolution, setEditingResolution] = useState<Resolucion | null>(null)
  const [resolutionEditorInitialData, setResolutionEditorInitialData] = useState<Partial<Resolucion> | null>(null)
  const [draftResolutionType, setDraftResolutionType] = useState<TipoResolucion>("asamblea")
  const [isBalanceUploadOpen, setIsBalanceUploadOpen] = useState(false)
  const [editingBalance, setEditingBalance] = useState<Balance | null>(null)
  const [notifyingBalanceId, setNotifyingBalanceId] = useState<string | null>(null)
  const [deletingBalanceId, setDeletingBalanceId] = useState<string | null>(null)
  const [isLegalUploadOpen, setIsLegalUploadOpen] = useState(false)
  const [openingLegalDocumentId, setOpeningLegalDocumentId] = useState<string | null>(null)

  const canCreateBalance = hasPermission("balances", "crear")
  const canEditBalance = hasPermission("balances", "editar")
  const canDeleteBalance = hasPermission("balances", "eliminar")
  const canCreateResolution = hasPermission("resoluciones", "crear")
  const canEditResolution = hasPermission("resoluciones", "editar")
  const canCreateLegalDocument = hasPermission("documentos", "crear")
  const canNotifyBalance = canCreateBalance || canEditBalance
  const showHeaderActions =
    (activeTab === "archivo-legal" && canCreateLegalDocument) ||
    (activeTab === "balances" && canCreateBalance) ||
    ((activeTab === "resoluciones" || activeTab === "decretos") && canCreateResolution)

  const loadData = useCallback(async () => {
    try {
      setTabLoading(true)
      if (activeTab === "archivo-legal") {
        setDocumentosLegales(await getDocumentosLegales())
      } else if (activeTab === "estatuto") {
        const [data, legalDocuments] = await Promise.all([
          getEstatuto(),
          getDocumentosLegales(),
        ])
        setArticulos(data)
        setEstatutoOficial(
          legalDocuments.find((documento) =>
            documento.tipo === "acta_constitutiva_estatuto" && documento.es_vigente
          ) || null
        )
        if (data.length > 0) {
          setExpandedArticle((current) => current || data[0].id)
        }
      } else if (activeTab === "resoluciones") {
        const data = await getResoluciones("asamblea")
        setResoluciones(data)
      } else if (activeTab === "decretos") {
        const data = await getResoluciones("decreto")
        setDecretos(data)
      } else if (activeTab === "balances") {
        const data = await getBalances()
        setBalances(data)
      }
    } finally {
      setTabLoading(false)
    }
  }, [activeTab, getBalances, getDocumentosLegales, getEstatuto, getResoluciones])

  useEffect(() => {
    if (isDocTab(tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useResumeRefresh(() => { void loadData() }, { throttleMs: 5_000 })

  const handleDownload = (url: string | undefined, filename: string) => {
    if (!url) return
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleOpenNorma = (norma: Resolucion) => {
    setSelectedNorma(norma)
  }

  const handleOpenLegalDocument = async (documento: DocumentoLegal) => {
    const popup = window.open("about:blank", "_blank")
    try {
      setOpeningLegalDocumentId(documento.id)
      const signedUrl = await getDocumentoLegalSignedUrl(documento)
      if (popup) {
        popup.opener = null
        popup.location.href = signedUrl
      } else {
        handleDownload(signedUrl, documento.nombre_archivo)
      }
    } catch (error) {
      popup?.close()
      throw error
    } finally {
      setOpeningLegalDocumentId(null)
    }
  }

  const handleOpenResolutionEditor = (type: TipoResolucion, resolucion?: Resolucion) => {
    setDraftResolutionType(type)
    setEditingResolution(resolucion || null)
    setResolutionEditorInitialData(
      resolucion || {
        tipo: type,
        estado: "borrador",
      }
    )
    setResolutionEditorOpen(true)
  }

  const handleSaveResolution = async (data: Partial<Resolucion>) => {
    if (editingResolution) {
      await updateResolucion(editingResolution.id, data)
    } else {
      if (!user?.id) {
        toast.error("No se pudo identificar al usuario que crea la resolución")
        return
      }

      await createResolucion({
        ...data,
        creado_por: user.id,
      } as Omit<Resolucion, "id" | "created_at">)
    }

    setResolutionEditorOpen(false)
    setEditingResolution(null)
    setResolutionEditorInitialData(null)
    await loadData()
  }

  const formatNormaNumero = (norma: Resolucion) => {
    if (norma.tipo === "decreto") {
      return `Dec. CD ${String(norma.numero).padStart(3, "0")}/${norma.anio}`
    }
    return `Res. ${String(norma.numero).padStart(3, "0")}/${norma.anio}`
  }

  const handleNotifyBalance = async (balance: Balance) => {
    try {
      setNotifyingBalanceId(balance.id)
      await notifyBalanceUpload(balance)
    } finally {
      setNotifyingBalanceId(null)
    }
  }

  const handleDeleteBalance = async (balance: Balance) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`¿Eliminar el balance "${balance.periodo}"?`)
      if (!confirmed) return
    }

    try {
      setDeletingBalanceId(balance.id)
      await deleteBalance(balance.id)

      const storagePath = getDocumentStoragePathFromPublicUrl(balance.archivo_url)
      if (storagePath) {
        const { error } = await supabase.storage
          .from("documentos")
          .remove([storagePath])

        if (error) {
          console.warn("Error cleaning deleted balance file:", error)
        }
      }

      await loadData()
    } finally {
      setDeletingBalanceId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Archivo legal, estatuto, resoluciones, decretos y balances</p>
        </div>
        {showHeaderActions && (
          <div className="flex gap-2">
            {activeTab === "archivo-legal" && canCreateLegalDocument && (
              <Button size="sm" className="gap-2" onClick={() => setIsLegalUploadOpen(true)}>
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Subir documento legal</span>
              </Button>
            )}
            {(activeTab === "resoluciones" || activeTab === "decretos") && canCreateResolution && (
              <Button
                size="sm"
                className="gap-2"
                onClick={() => handleOpenResolutionEditor(activeTab === "decretos" ? "decreto" : "asamblea")}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{activeTab === "decretos" ? "Nuevo Decreto" : "Nueva Resolución"}</span>
              </Button>
            )}
            {activeTab === "balances" && (
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  setEditingBalance(null)
                  setIsBalanceUploadOpen(true)
                }}
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Subir Balance</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0",
              activeTab === tab.id
                ? "text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            style={activeTab === tab.id ? { backgroundColor: "#6314a7" } : undefined}
          >
            <tab.icon className="w-4 h-4" strokeWidth={1.8} />
            {tab.label}
          </button>
        ))}
      </div>

      {tabLoading ? (
        <div className="flex flex-col gap-3 animate-pulse opacity-50">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Archivo legal */}
          {activeTab === "archivo-legal" && (
            <div className="flex flex-col gap-4">
              <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/50 shadow-none dark:bg-emerald-950/10">
                <CardContent className="flex items-start gap-3 p-4">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <div>
                    <p className="text-sm font-semibold">Repositorio privado de documentación jurídica</p>
                    <p className="mt-1 text-xs text-muted-foreground">Los archivos son privados por defecto. Sólo una copia expresamente revisada y marcada como pública aparece en el archivo institucional abierto.</p>
                  </div>
                </CardContent>
              </Card>

              {documentosLegales.length === 0 ? (
                <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                  Todavía no hay documentos incorporados al archivo legal.
                </div>
              ) : (
                <div className="grid gap-3">
                  {documentosLegales.map((documento) => {
                    const statusStyle = estadoStyles[documento.estado_registro] || estadoStyles.borrador
                    return (
                      <Card key={documento.id} className="border border-border shadow-none">
                        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#ede5f7]">
                              <FileText className="h-[18px] w-[18px] text-[#6314a7]" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-foreground">{documento.titulo}</p>
                                <Badge variant="secondary" className="border-0 text-[10px]" style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                                  {estadoLabels[documento.estado_registro] || documento.estado_registro}
                                </Badge>
                                {documento.firma_digital && <Badge variant="outline" className="text-[10px]">Firma digital</Badge>}
                                {documento.visibilidad === "publico" && <Badge variant="outline" className="border-emerald-500/40 bg-emerald-50 text-[10px] text-emerald-700">Publicado</Badge>}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {legalTypeLabels[documento.tipo]}
                                {documento.numero ? ` · N.º ${documento.numero}${documento.anio ? `/${documento.anio}` : ""}` : ""}
                                {documento.fecha_documento ? ` · ${formatDate(documento.fecha_documento)}` : ""}
                              </p>
                              {documento.descripcion && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{documento.descripcion}</p>}
                              {documento.componentes.length > 0 && (
                                <p className="mt-1 text-xs text-muted-foreground">Incluye {documento.componentes.length} pieza(s) documental(es).</p>
                              )}
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="gap-2 sm:shrink-0" disabled={openingLegalDocumentId === documento.id} onClick={() => void handleOpenLegalDocument(documento)}>
                            {openingLegalDocumentId === documento.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                            Abrir PDF
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Estatuto */}
          {activeTab === "estatuto" && (
            <div className="flex flex-col gap-4">
              <Card className="items-center p-4 border-l-4 border-l-[#6314a7] bg-primary/5 flex justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">Estatuto Social Oficial</h3>
                  <p className="text-xs text-muted-foreground">Versión firmada y digitalizada del estatuto vigente.</p>
                </div>
                <Button onClick={() => estatutoOficial && void handleOpenLegalDocument(estatutoOficial)} disabled={!estatutoOficial || openingLegalDocumentId === estatutoOficial.id} size="sm" variant="outline" className="gap-2 bg-background border-[#6314a7]/20 hover:bg-[#6314a7]/5 text-[#6314a7]">
                  {estatutoOficial && openingLegalDocumentId === estatutoOficial.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {estatutoOficial ? 'Descargar PDF oficial' : 'No disponible'}
                </Button>
              </Card>

              {articulos.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No hay articulos disponibles
                </div>
              ) : (
                articulos.map((art) => (
                  <Card key={art.id} className="border border-border shadow-none">
                    <button onClick={() => setExpandedArticle(expandedArticle === art.id ? null : art.id)} className="w-full text-left">
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="text-[10px] font-mono font-semibold border-0" style={{ backgroundColor: "#ede5f7", color: "#6314a7" }}>
                              Art. {art.articulo}
                            </Badge>
                            <span className="text-sm font-medium text-foreground">{art.titulo}</span>
                          </div>
                          {expandedArticle === art.id ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      </CardHeader>
                    </button>
                    {expandedArticle === art.id && (
                      <CardContent className="pt-0 pb-4 px-4">
                        <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed whitespace-pre-line dark:prose-invert">
                          {art.contenido}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Resoluciones */}
          {activeTab === "resoluciones" && (
            <div className="flex flex-col gap-3">
              {resoluciones.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No hay resoluciones disponibles
                </div>
              ) : (
                <>
                  {/* Desktop */}
                  <Card className="border border-border shadow-none hidden lg:block">
                    <CardContent className="p-0">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left text-xs text-muted-foreground font-medium p-4">Numero</th>
                            <th className="text-left text-xs text-muted-foreground font-medium p-4">Titulo</th>
                            <th className="text-left text-xs text-muted-foreground font-medium p-4">Fecha</th>
                            <th className="text-left text-xs text-muted-foreground font-medium p-4">Estado</th>
                            <th className="text-right text-xs text-muted-foreground font-medium p-4" />
                          </tr>
                        </thead>
                        <tbody>
                          {resoluciones.map((res) => {
                            const s = estadoStyles[res.estado] || estadoStyles.vigente
                            return (
                              <tr key={res.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                <td className="p-4 text-sm font-mono font-medium">
                                  <button
                                    onClick={() => handleOpenNorma(res)}
                                    className="hover:underline underline-offset-2"
                                    style={{ color: "#6314a7" }}
                                  >
                                    {formatNormaNumero(res)}
                                  </button>
                                </td>
                                <td className="p-4 text-sm text-foreground">
                                  <button onClick={() => handleOpenNorma(res)} className="text-left hover:text-[#6314a7] transition-colors">
                                    {res.titulo}
                                  </button>
                                </td>
                                <td className="p-4 text-sm text-muted-foreground">{formatDate(res.fecha)}</td>
                                <td className="p-4">
                                  <Badge variant="secondary" className="text-[10px] border-0 font-medium" style={{ backgroundColor: s.bg, color: s.color }}>{estadoLabels[res.estado] || res.estado}</Badge>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button onClick={() => handleOpenNorma(res)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                                            <Eye className="w-4 h-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Ver texto completo</p></TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    {canEditResolution && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button onClick={() => handleOpenResolutionEditor("asamblea", res)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                                              <Pencil className="w-4 h-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent><p>Editar resolución</p></TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    {res.archivo_url && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button onClick={() => handleDownload(res.archivo_url, `Resolucion_${res.numero}_${res.anio}.pdf`)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                                              <Download className="w-4 h-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent><p>Descargar PDF</p></TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>

                  {/* Mobile */}
                  <div className="flex flex-col gap-2 lg:hidden">
                    {resoluciones.map((res) => {
                      const s = estadoStyles[res.estado] || estadoStyles.vigente
                      return (
                        <Card key={res.id} className="border border-border shadow-none">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <button
                                  onClick={() => handleOpenNorma(res)}
                                  className="text-xs font-mono font-medium hover:underline underline-offset-2 break-all"
                                  style={{ color: "#6314a7" }}
                                >
                                  {formatNormaNumero(res)}
                                </button>
                                <p className="text-sm text-foreground mt-1 break-words">
                                  <button onClick={() => handleOpenNorma(res)} className="text-left hover:text-[#6314a7] transition-colors">
                                    {res.titulo}
                                  </button>
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-muted-foreground">{formatDate(res.fecha)}</span>
                                  <Badge variant="secondary" className="text-[10px] border-0 font-medium" style={{ backgroundColor: s.bg, color: s.color }}>{estadoLabels[res.estado] || res.estado}</Badge>
                                </div>
                                <Button onClick={() => handleOpenNorma(res)} size="sm" variant="link" className="h-auto p-0 mt-2 text-[#6314a7]">
                                  Ver texto completo
                                </Button>
                                {canEditResolution && (
                                  <Button onClick={() => handleOpenResolutionEditor("asamblea", res)} size="sm" variant="link" className="h-auto p-0 mt-1 text-[#6314a7]">
                                    Editar resolución
                                  </Button>
                                )}
                              </div>
                              {res.archivo_url && (
                                <Button onClick={() => handleDownload(res.archivo_url, `Resolucion_${res.numero}_${res.anio}.pdf`)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0">
                                  <Download className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Decretos */}
          {activeTab === "decretos" && (
            <div className="flex flex-col gap-3">
              {decretos.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No hay decretos disponibles
                </div>
              ) : (
                <>
                  <Card className="border border-border shadow-none hidden lg:block">
                    <CardContent className="p-0">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left text-xs text-muted-foreground font-medium p-4">Numero</th>
                            <th className="text-left text-xs text-muted-foreground font-medium p-4">Titulo</th>
                            <th className="text-left text-xs text-muted-foreground font-medium p-4">Fecha</th>
                            <th className="text-left text-xs text-muted-foreground font-medium p-4">Estado</th>
                            <th className="text-right text-xs text-muted-foreground font-medium p-4" />
                          </tr>
                        </thead>
                        <tbody>
                          {decretos.map((dec) => {
                            const s = estadoStyles[dec.estado] || estadoStyles.vigente
                            return (
                              <tr key={dec.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                <td className="p-4 text-sm font-mono font-medium">
                                  <button
                                    onClick={() => handleOpenNorma(dec)}
                                    className="hover:underline underline-offset-2"
                                    style={{ color: "#6314a7" }}
                                  >
                                    {formatNormaNumero(dec)}
                                  </button>
                                </td>
                                <td className="p-4 text-sm text-foreground">
                                  <button onClick={() => handleOpenNorma(dec)} className="text-left hover:text-[#6314a7] transition-colors">
                                    {dec.titulo}
                                  </button>
                                </td>
                                <td className="p-4 text-sm text-muted-foreground">{formatDate(dec.fecha)}</td>
                                <td className="p-4">
                                  <Badge variant="secondary" className="text-[10px] border-0 font-medium" style={{ backgroundColor: s.bg, color: s.color }}>{estadoLabels[dec.estado] || dec.estado}</Badge>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button onClick={() => handleOpenNorma(dec)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                                            <Eye className="w-4 h-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Ver texto completo</p></TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    {canEditResolution && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button onClick={() => handleOpenResolutionEditor("decreto", dec)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                                              <Pencil className="w-4 h-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent><p>Editar decreto</p></TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    {dec.archivo_url && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button onClick={() => handleDownload(dec.archivo_url, `Decreto_${dec.numero}_${dec.anio}.pdf`)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                                              <Download className="w-4 h-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent><p>Descargar PDF</p></TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>

                  <div className="flex flex-col gap-2 lg:hidden">
                    {decretos.map((dec) => {
                      const s = estadoStyles[dec.estado] || estadoStyles.vigente
                      return (
                        <Card key={dec.id} className="border border-border shadow-none">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <button
                                  onClick={() => handleOpenNorma(dec)}
                                  className="text-xs font-mono font-medium hover:underline underline-offset-2 break-all"
                                  style={{ color: "#6314a7" }}
                                >
                                  {formatNormaNumero(dec)}
                                </button>
                                <p className="text-sm text-foreground mt-1 break-words">
                                  <button onClick={() => handleOpenNorma(dec)} className="text-left hover:text-[#6314a7] transition-colors">
                                    {dec.titulo}
                                  </button>
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-muted-foreground">{formatDate(dec.fecha)}</span>
                                  <Badge variant="secondary" className="text-[10px] border-0 font-medium" style={{ backgroundColor: s.bg, color: s.color }}>{estadoLabels[dec.estado] || dec.estado}</Badge>
                                </div>
                                <Button onClick={() => handleOpenNorma(dec)} size="sm" variant="link" className="h-auto p-0 mt-2 text-[#6314a7]">
                                  Ver texto completo
                                </Button>
                                {canEditResolution && (
                                  <Button onClick={() => handleOpenResolutionEditor("decreto", dec)} size="sm" variant="link" className="h-auto p-0 mt-1 text-[#6314a7]">
                                    Editar decreto
                                  </Button>
                                )}
                              </div>
                              {dec.archivo_url && (
                                <Button onClick={() => handleDownload(dec.archivo_url, `Decreto_${dec.numero}_${dec.anio}.pdf`)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0">
                                  <Download className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Balances */}
          {activeTab === "balances" && (
            <div className="flex flex-col gap-2.5">
              {balances.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No hay balances disponibles
                </div>
              ) : (
                balances.map((bal) => {
                  const s = estadoStyles[bal.estado] || estadoStyles.aprobado_asamblea
                  return (
                    <Card key={bal.id} className="border border-border shadow-none">
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#ede5f7" }}>
                              <BarChart2 className="w-[18px] h-[18px]" style={{ color: "#6314a7" }} strokeWidth={1.8} />
                            </div>
                            <div>
                              <p className="text-sm text-foreground font-medium">{bal.periodo}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">{formatDate(bal.created_at)}</span>
                                <Badge variant="secondary" className="text-[10px] border-0 font-medium" style={{ backgroundColor: s.bg, color: s.color }}>{estadoLabels[bal.estado] || bal.estado}</Badge>
                              </div>
                            </div>
                          </div>
                          {bal.archivo_url && (
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              {canNotifyBalance && (
                                <Button
                                  onClick={() => void handleNotifyBalance(bal)}
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 bg-transparent"
                                  disabled={notifyingBalanceId === bal.id}
                                >
                                  {notifyingBalanceId === bal.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Bell className="w-4 h-4" />
                                  )}
                                  <span className="hidden sm:inline">Notificar</span>
                                </Button>
                              )}
                              {canEditBalance && (
                                <Button
                                  onClick={() => {
                                    setEditingBalance(bal)
                                    setIsBalanceUploadOpen(true)
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 bg-transparent"
                                >
                                  <Pencil className="w-4 h-4" />
                                  <span className="hidden sm:inline">Editar</span>
                                </Button>
                              )}
                              <Button asChild size="sm" variant="outline" className="gap-1.5 bg-transparent">
                                <Link href={`/documentos/balances/${bal.id}`}>
                                  <Eye className="w-4 h-4" />
                                  <span className="hidden sm:inline">Ver PDF</span>
                                </Link>
                              </Button>
                              <Button onClick={() => handleDownload(bal.archivo_url, `Balance_${bal.periodo}.pdf`)} size="sm" variant="outline" className="gap-1.5 bg-transparent">
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">Descargar</span>
                              </Button>
                              {canDeleteBalance && (
                                <Button
                                  onClick={() => void handleDeleteBalance(bal)}
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 bg-transparent"
                                  disabled={deletingBalanceId === bal.id}
                                >
                                  {deletingBalanceId === bal.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                  <span className="hidden sm:inline">Eliminar</span>
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          )}
        </>
      )}

      <BalanceUploadDialog
        open={isBalanceUploadOpen}
        onOpenChange={(open) => {
          setIsBalanceUploadOpen(open)
          if (!open) {
            setEditingBalance(null)
          }
        }}
        initialBalance={editingBalance}
        onSaved={() => {
          setEditingBalance(null)
          void loadData()
        }}
      />

      <LegalDocumentUploadDialog
        open={isLegalUploadOpen}
        onOpenChange={setIsLegalUploadOpen}
        onSaved={() => void loadData()}
      />

      <Dialog open={Boolean(selectedNorma)} onOpenChange={(isOpen) => !isOpen && setSelectedNorma(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{selectedNorma ? formatNormaNumero(selectedNorma) : "Norma"}</DialogTitle>
            <DialogDescription className="space-y-1">
              <span className="block">{selectedNorma?.titulo || "Sin título"}</span>
              {selectedNorma?.fecha && (
                <span className="block">Fecha: {formatDate(selectedNorma.fecha)}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto overflow-x-hidden rounded-md border p-4">
            {selectedNorma?.contenido ? (
              <div
                className="prose prose-sm max-w-none break-words dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(selectedNorma.contenido) }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Esta norma no tiene texto cargado.</p>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {canEditResolution && selectedNorma && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  const tipo = selectedNorma.tipo === "decreto" ? "decreto" : "asamblea"
                  setSelectedNorma(null)
                  handleOpenResolutionEditor(tipo, selectedNorma)
                }}
              >
                <Pencil className="w-4 h-4" />
                Editar
              </Button>
            )}
            {selectedNorma?.archivo_url && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => handleDownload(selectedNorma.archivo_url, `${selectedNorma.tipo}_${selectedNorma.numero}_${selectedNorma.anio}.pdf`)}
              >
                <Download className="w-4 h-4" />
                Descargar PDF
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resolutionEditorOpen} onOpenChange={(open) => {
        setResolutionEditorOpen(open)
        if (!open) {
          setEditingResolution(null)
          setResolutionEditorInitialData(null)
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl p-0">
          <ResolutionEditor
            key={`${editingResolution?.id || "new"}-${draftResolutionType}`}
            initialData={resolutionEditorInitialData || undefined}
            defaultType={draftResolutionType}
            onCancel={() => {
              setResolutionEditorOpen(false)
              setEditingResolution(null)
              setResolutionEditorInitialData(null)
            }}
            onSave={handleSaveResolution}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
