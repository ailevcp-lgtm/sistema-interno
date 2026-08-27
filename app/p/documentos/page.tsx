'use client'

import { useEffect, useState } from 'react'
import { Download, FileCheck2, Loader2, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface PublicDocument {
  id: string
  tipo: string
  titulo_publico?: string | null
  titulo: string
  descripcion_publica?: string | null
  numero?: number | null
  anio?: number | null
  fecha_documento?: string | null
  publicado_at: string
  firma_digital: boolean
  sha256: string
}
export default function PublicDocumentsPage() {
  const [documents, setDocuments] = useState<PublicDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/public/documentos')
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo cargar el archivo')
        return response.json()
      })
      .then((result) => setDocuments(result.documentos || []))
      .finally(() => setLoading(false))
  }, [])

  const openDocument = async (id: string) => {
    setOpening(id)
    try {
      const response = await fetch(`/api/public/documentos?id=${encodeURIComponent(id)}`)
      const result = await response.json()
      if (!response.ok || !result.url) throw new Error(result.error || 'No se pudo abrir el documento')
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } finally {
      setOpening(null)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl bg-[#6314a7] p-7 text-white shadow-sm">
          <div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7" /><p className="text-sm font-semibold uppercase tracking-[0.18em]">Asociación Civil AILE</p></div>
          <h1 className="mt-4 text-3xl font-bold">Archivo institucional público</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/80">Resoluciones y documentación institucional publicada por AILE. Cada archivo conserva su huella SHA-256 para permitir verificar su integridad.</p>
        </header>

        {loading ? <div className="py-14 text-center text-sm text-slate-500">Cargando documentos...</div> : documents.length === 0 ? (
          <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Todavía no hay documentos publicados.</CardContent></Card>
        ) : documents.map((document) => (
          <Card key={document.id}>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <FileCheck2 className="mt-0.5 h-6 w-6 shrink-0 text-[#6314a7]" />
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{document.titulo_publico || document.titulo}</h2>{document.firma_digital && <Badge variant="outline">Firma digital</Badge>}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{document.numero ? `N.º ${document.numero}${document.anio ? `/${document.anio}` : ''} · ` : ''}{document.fecha_documento ? new Intl.DateTimeFormat('es-AR').format(new Date(`${document.fecha_documento}T12:00:00`)) : 'Sin fecha'}</p>
                  {document.descripcion_publica && <p className="mt-2 text-sm text-slate-600">{document.descripcion_publica}</p>}
                  <p className="mt-2 font-mono text-[10px] text-slate-400">SHA-256 {document.sha256}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => void openDocument(document.id)} disabled={opening === document.id}>
                {opening === document.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Abrir PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
