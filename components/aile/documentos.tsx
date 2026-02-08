"use client"

import { Search, Download, ChevronDown, ChevronRight, BookOpen, Scale, Gavel, BarChart2, Plus, FileText, Upload, Settings } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useDocumentos } from "@/hooks/useDocumentos"
import { formatDate } from "@/lib/utils"
import type { ArticuloEstatuto, Resolucion, Balance } from "@/lib/types"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type DocTab = "estatuto" | "resoluciones" | "decretos" | "balances"

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
  const [activeTab, setActiveTab] = useState<DocTab>("estatuto")
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null)
  const { loading, getEstatuto, getResoluciones, getBalances, getConfig } = useDocumentos()
  const { hasPermission } = useAuth()

  const [articulos, setArticulos] = useState<ArticuloEstatuto[]>([])
  const [resoluciones, setResoluciones] = useState<Resolucion[]>([])
  const [decretos, setDecretos] = useState<Resolucion[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [tabLoading, setTabLoading] = useState(true)
  const [estatutoPdfUrl, setEstatutoPdfUrl] = useState<string | null>(null)

  // Check if user is admin
  const isAdmin = hasPermission("documentos", "crear")

  useEffect(() => {
    const loadData = async () => {
      setTabLoading(true)
      if (activeTab === "estatuto") {
        const [data, pdfUrl] = await Promise.all([
          getEstatuto(),
          getConfig("estatuto_pdf_url")
        ])
        setArticulos(data)
        setEstatutoPdfUrl(pdfUrl)
        if (data.length > 0 && !expandedArticle) {
          setExpandedArticle(data[0].id)
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
      setTabLoading(false)
    }
    loadData()
  }, [activeTab, getEstatuto, getResoluciones, getBalances, getConfig])

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

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Estatuto, resoluciones, decretos y balances</p>
        </div>
        {isAdmin && (
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
              <Button size="sm" className="gap-2">
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
                                <td className="p-4 text-sm font-mono font-medium" style={{ color: "#6314a7" }}>Res. {String(res.numero).padStart(3, "0")}/{res.anio}</td>
                                <td className="p-4 text-sm text-foreground">{res.titulo}</td>
                                <td className="p-4 text-sm text-muted-foreground">{formatDate(res.fecha)}</td>
                                <td className="p-4">
                                  <Badge variant="secondary" className="text-[10px] border-0 font-medium" style={{ backgroundColor: s.bg, color: s.color }}>{estadoLabels[res.estado] || res.estado}</Badge>
                                </td>
                                <td className="p-4 text-right">
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
                                <span className="text-xs font-mono font-medium" style={{ color: "#6314a7" }}>Res. {String(res.numero).padStart(3, "0")}/{res.anio}</span>
                                <p className="text-sm text-foreground mt-1">{res.titulo}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-muted-foreground">{formatDate(res.fecha)}</span>
                                  <Badge variant="secondary" className="text-[10px] border-0 font-medium" style={{ backgroundColor: s.bg, color: s.color }}>{estadoLabels[res.estado] || res.estado}</Badge>
                                </div>
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
                                <td className="p-4 text-sm font-mono font-medium" style={{ color: "#6314a7" }}>Dec. CD {String(dec.numero).padStart(3, "0")}/{dec.anio}</td>
                                <td className="p-4 text-sm text-foreground">{dec.titulo}</td>
                                <td className="p-4 text-sm text-muted-foreground">{formatDate(dec.fecha)}</td>
                                <td className="p-4">
                                  <Badge variant="secondary" className="text-[10px] border-0 font-medium" style={{ backgroundColor: s.bg, color: s.color }}>{estadoLabels[dec.estado] || dec.estado}</Badge>
                                </td>
                                <td className="p-4 text-right">
                                  {dec.archivo_url && (
                                    <Button onClick={() => handleDownload(dec.archivo_url, `Decreto_${dec.numero}_${dec.anio}.pdf`)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                                      <Download className="w-4 h-4" />
                                    </Button>
                                  )}
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
                                <span className="text-xs font-mono font-medium" style={{ color: "#6314a7" }}>Dec. CD {String(dec.numero).padStart(3, "0")}/{dec.anio}</span>
                                <p className="text-sm text-foreground mt-1">{dec.titulo}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-muted-foreground">{formatDate(dec.fecha)}</span>
                                  <Badge variant="secondary" className="text-[10px] border-0 font-medium" style={{ backgroundColor: s.bg, color: s.color }}>{estadoLabels[dec.estado] || dec.estado}</Badge>
                                </div>
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
                        <div className="flex items-center justify-between gap-3">
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
                            <Button onClick={() => handleDownload(bal.archivo_url, `Balance_${bal.periodo}.pdf`)} size="sm" variant="outline" className="gap-1.5 bg-transparent">
                              <Download className="w-4 h-4" />
                              <span className="hidden sm:inline">PDF</span>
                            </Button>
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
    </div>
  )
}
