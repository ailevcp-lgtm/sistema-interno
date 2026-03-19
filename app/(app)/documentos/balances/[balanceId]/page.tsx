'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Download, ExternalLink, FileText } from 'lucide-react'

import { useRequirePermission } from '@/hooks/useAuth'
import { useDocumentos } from '@/hooks/useDocumentos'
import { formatDate } from '@/lib/utils'
import type { Balance } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const estadoStyles: Record<string, { bg: string; color: string }> = {
  vigente: { bg: '#ecfdf5', color: '#059669' },
  derogada: { bg: '#fef2f2', color: '#dc2626' },
  aprobado_asamblea: { bg: '#ede5f7', color: '#6314a7' },
  aprobado_cd: { bg: '#fef3c7', color: '#b45309' },
  borrador: { bg: '#f3f4f6', color: '#6b7280' },
}

const estadoLabels: Record<string, string> = {
  vigente: 'Vigente',
  derogada: 'Derogada',
  aprobado_asamblea: 'Aprobado por Asamblea',
  aprobado_cd: 'Aprobado por CD',
  borrador: 'Borrador',
}

function handleDownload(url: string | undefined, filename: string) {
  if (!url || typeof document === 'undefined') return

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function BalanceViewerPage() {
  const params = useParams()
  const balanceId = useMemo(() => {
    const rawParam = params.balanceId
    return Array.isArray(rawParam) ? rawParam[0] : rawParam
  }, [params.balanceId])

  const { loading: authLoading, hasPermission } = useRequirePermission('documentos', 'ver', '/dashboard')
  const { getBalanceById, loading } = useDocumentos()

  const [balance, setBalance] = useState<Balance | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!balanceId || authLoading || !hasPermission) return

    let cancelled = false

    void (async () => {
      setLoaded(false)
      const nextBalance = await getBalanceById(balanceId)
      if (!cancelled) {
        setBalance(nextBalance)
        setLoaded(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authLoading, balanceId, getBalanceById, hasPermission])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Validando permisos...
      </div>
    )
  }

  if (!hasPermission) return null

  if (!loaded || loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Cargando balance...
      </div>
    )
  }

  if (!balance) {
    return (
      <div className="space-y-4 py-8">
        <Button asChild variant="ghost" className="gap-2 -ml-2">
          <Link href="/documentos?tab=balances">
            <ArrowLeft className="h-4 w-4" />
            Volver a balances
          </Link>
        </Button>
        <Card className="border border-border shadow-none">
          <CardContent className="p-6 text-sm text-muted-foreground">
            El balance solicitado no existe o ya no está disponible.
          </CardContent>
        </Card>
      </div>
    )
  }

  const estadoStyle = estadoStyles[balance.estado] || estadoStyles.aprobado_asamblea
  const pdfUrl = balance.archivo_url

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Button asChild variant="ghost" className="w-fit gap-2 -ml-2">
        <Link href="/documentos?tab=balances">
          <ArrowLeft className="h-4 w-4" />
          Volver a balances
        </Link>
      </Button>

      <Card className="border border-border shadow-none">
        <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ede5f7]">
                  <FileText className="h-5 w-5 text-[#6314a7]" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-xl font-bold text-foreground sm:text-2xl">{balance.periodo}</h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Publicado el {formatDate(balance.created_at)}
                    </span>
                    <Badge
                      variant="secondary"
                      className="border-0 text-[10px] font-medium"
                      style={{ backgroundColor: estadoStyle.bg, color: estadoStyle.color }}
                    >
                      {estadoLabels[balance.estado] || balance.estado}
                    </Badge>
                  </div>
                </div>
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Vista pensada para escritorio y teléfono. Si tu navegador no incrusta el PDF, abrilo en pestaña completa.
              </p>
            </div>

            {pdfUrl && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline" className="gap-2 bg-transparent">
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Abrir PDF
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 bg-transparent"
                  onClick={() => handleDownload(pdfUrl, `Balance_${balance.periodo}.pdf`)}
                >
                  <Download className="h-4 w-4" />
                  Descargar
                </Button>
              </div>
            )}
          </div>

          {pdfUrl ? (
            <div className="overflow-hidden rounded-xl border border-border bg-white">
              <iframe
                title={`Balance ${balance.periodo}`}
                src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                className="h-[70dvh] min-h-[420px] w-full sm:min-h-[560px]"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Este balance no tiene un PDF asociado.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
