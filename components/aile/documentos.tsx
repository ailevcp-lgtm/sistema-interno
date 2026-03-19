"use client"

import { Download, ChevronDown, ChevronRight, BookOpen, Scale, Gavel, BarChart2, Plus, FileText, Upload, Settings, Eye, Bell, Pencil, Trash2, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useDocumentos } from "@/hooks/useDocumentos"
import { formatDate } from "@/lib/utils"
import type { ArticuloEstatuto, Resolucion, Balance } from "@/lib/types"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useResumeRefresh } from "@/hooks/useResumeRefresh"
import { BalanceUploadDialog, getDocumentStoragePathFromPublicUrl } from "@/components/aile/balance-upload-dialog"
import { supabase } from "@/lib/supabase"
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

type DocTab = "estatuto" | "resoluciones" | "decretos" | "balances"

function isDocTab(value: string | null): value is DocTab {
  return value === "estatuto" || value === "resoluciones" || value === "decretos" || value === "balances"
}

const tabs: { id: DocTab; label: string; icon: typeof BookOpen }[] = [
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
}

const estadoLabels: Record<string, string> = {
  vigente: "Vigente",
  derogada: "Derogada",
  aprobado_asamblea: "Aprobado por Asamblea",
  aprobado_cd: "Aprobado por CD",
  borrador: "Borrador",
}

export function DocumentosPage() {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get("tab")
  const [activeTab, setActiveTab] = useState<DocTab>("estatuto")
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null)
  const { getEstatuto, getResoluciones, getBalances, getConfig, deleteBalance, notifyBalanceUpload } = useDocumentos()
  const { hasPermission } = useAuth()

  const [articulos, setArticulos] = useState<ArticuloEstatuto[]>([])
  const [resoluciones, setResoluciones] = useState<Resolucion[]>([])
  const [decretos, setDecretos] = useState<Resolucion[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [tabLoading, setTabLoading] = useState(true)
  const [estatutoPdfUrl, setEstatutoPdfUrl] = useState<string | null>(null)
  const [selectedNorma, setSelectedNorma] = useState<Resolucion | null>(null)
  const [isBalanceUploadOpen, setIsBalanceUploadOpen] = useState(false)
  const [editingBalance, setEditingBalance] = useState<Balance | null>(null)
  const [notifyingBalanceId, setNotifyingBalanceId] = useState<string | null>(null)
  const [deletingBalanceId, setDeletingBalanceId] = useState<string | null>(null)

  const canCreateBalance = hasPermission("balances", "crear")
  const canEditBalance = hasPermission("balances", "editar")
  const canDeleteBalance = hasPermission("balances", "eliminar")
  const canNotifyBalance = canCreateBalance || canEditBalance

  const loadData = useCallback(async () => {
    try {
      setTabLoading(true)
      if (activeTab === "estatuto") {
        const [data, pdfUrl] = await Promise.all([
          getEstatuto(),
          getConfig("estatuto_pdf_url")
        ])
        setArticulos(data)
        setEstatutoPdfUrl(pdfUrl)
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
  }, [activeTab, getBalances, getConfig, getEstatuto, getResoluciones])

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
          <p className="text-sm text-muted-foreground mt-0.5">Estatuto, resoluciones, decretos y balances</p>
        </div>
        {canCreateBalance && (
          <div className="flex gap-2">
            {activeTab === "estatuto" && (
              <Link href="/admin/estatuto">
                <Button size="sm" variant="outline" className="gap-2">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Gestionar Estatuto</span>
                </Button>
              </Link>
            )}
            {(activeTab === "resoluciones" || activeTab === "decretos") && (
              <Link href="/admin/resoluciones">
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Nueva Resolución</span>
                </Button>
              </Link>
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
          {/* Estatuto */}
          {activeTab === "estatuto" && (
            <div className="flex flex-col gap-4">
              <Card className="items-center p-4 border-l-4 border-l-[#6314a7] bg-primary/5 flex justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">Estatuto Social Oficial</h3>
                  <p className="text-xs text-muted-foreground">Versión firmada y digitalizada del estatuto vigente.</p>
                </div>
                <Button onClick={() => handleDownload(estatutoPdfUrl || undefined, "Estatuto_AILE.pdf")} disabled={!estatutoPdfUrl} size="sm" variant="outline" className="gap-2 bg-background border-[#6314a7]/20 hover:bg-[#6314a7]/5 text-[#6314a7]">
                  <FileText className="w-4 h-4" />
                  {estatutoPdfUrl ? 'Descargar PDF' : 'No disponible'}
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
                dangerouslySetInnerHTML={{ __html: selectedNorma.contenido }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Esta norma no tiene texto cargado.</p>
            )}
          </div>

          {selectedNorma?.archivo_url && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => handleDownload(selectedNorma.archivo_url, `${selectedNorma.tipo}_${selectedNorma.numero}_${selectedNorma.anio}.pdf`)}
              >
                <Download className="w-4 h-4" />
                Descargar PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
