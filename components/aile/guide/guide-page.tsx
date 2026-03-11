"use client"

import Link from "next/link"
import {
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  BookOpen,
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  KanbanSquare,
  Landmark,
  LayoutGrid,
  LogIn,
  ReceiptText,
  Settings,
  ShieldCheck,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { GUIDE_CHAPTERS, type GuideChapter, type GuideSection } from "@/lib/guide-content"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function iconForChapter(chapterId: string) {
  const iconMap: Record<string, LucideIcon> = {
    "proposito-y-roles": ShieldCheck,
    "acceso-y-navegacion": LogIn,
    inicio: LayoutGrid,
    calendario: CalendarDays,
    tareas: KanbanSquare,
    socios: Users,
    deudas: CreditCard,
    movimientos: ArrowUpDown,
    finanzas: BarChart3,
    tesoreria: Landmark,
    reintegros: ReceiptText,
    documentos: FileText,
    ajustes: Settings,
    "mi-perfil": User,
    "mi-estado-cuenta": Wallet,
  }

  return iconMap[chapterId] || BookOpen
}

const GUIDE_PDF_DOWNLOAD_PATH = "/guia-uso/guia-completa-directores-aile.pdf"

function renderSection(section: GuideSection) {
  return (
    <Card key={section.title} className="border-border/80 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-foreground">{section.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {section.body?.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-6 text-muted-foreground">
            {paragraph}
          </p>
        ))}

        {section.bullets && section.bullets.length > 0 && (
          <ul className="space-y-2 text-sm text-muted-foreground">
            {section.bullets.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6314a7]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}

        {section.steps && section.steps.length > 0 && (
          <ol className="space-y-2">
            {section.steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6314a7]/10 text-xs font-semibold text-[#6314a7]">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        )}

        {section.note ? (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            <span className="font-semibold">Nota:</span> {section.note}
          </div>
        ) : null}

        {section.caution ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">Importante:</span> {section.caution}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ChapterCard({ chapter }: { chapter: GuideChapter }) {
  const Icon = iconForChapter(chapter.id)

  return (
    <section id={chapter.id} className="scroll-mt-24 space-y-5">
      <Card className="overflow-hidden border-border shadow-sm">
        <CardHeader className="border-b border-border/70 bg-gradient-to-r from-[#6314a7]/8 via-background to-[#e50051]/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6314a7] text-white shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-foreground">{chapter.title}</CardTitle>
                  <CardDescription className="mt-1 text-sm">{chapter.description}</CardDescription>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {chapter.audience.map((item) => (
                  <Badge key={item} variant="outline" className="bg-background text-foreground">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>

            {chapter.route ? (
              <Button asChild variant="outline" className="w-full lg:w-auto">
                <Link href={chapter.route}>
                  {chapter.routeLabel || "Abrir pantalla"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          {chapter.sections.map((section) => renderSection(section))}
        </CardContent>
      </Card>
    </section>
  )
}

export function GuidePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/70 bg-[linear-gradient(135deg,rgba(99,20,167,0.12),rgba(255,255,255,0.92),rgba(229,0,81,0.08))] p-5 shadow-sm lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge className="w-fit bg-[#6314a7] text-white hover:bg-[#6314a7]">
              Guia integrada al sistema
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-foreground lg:text-4xl">
                Guia de uso AILE
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">
                Esta guia explica el funcionamiento actual del sistema con un lenguaje claro, pensado para
                personas que no usan software complejo todos los dias. Puedes leerla de punta a punta o ir
                directo a la pantalla que necesitas entender.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Capitulos</p>
                <p className="text-2xl font-bold text-foreground">{GUIDE_CHAPTERS.length}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pantallas con acceso directo</p>
                <p className="text-2xl font-bold text-foreground">
                  {GUIDE_CHAPTERS.filter((chapter) => chapter.route).length}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="outline" className="bg-background/90">
              <Link href="#proposito-y-roles">
                Empezar a leer
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="bg-[#6314a7] text-white hover:bg-[#53108c]">
              <a href={GUIDE_PDF_DOWNLOAD_PATH} download>
                <Download className="h-4 w-4" />
                Descargar PDF
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-20 xl:self-start">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-foreground">Indice rapido</CardTitle>
              <CardDescription>
                Salta directo al capitulo que necesitas y, cuando exista, entra a la pantalla real.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {GUIDE_CHAPTERS.map((chapter) => {
                const Icon = iconForChapter(chapter.id)

                return (
                  <a
                    key={chapter.id}
                    href={`#${chapter.id}`}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors",
                      "hover:border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#6314a7]/10 text-[#6314a7]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{chapter.shortTitle}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{chapter.description}</p>
                    </div>
                  </a>
                )
              })}
            </CardContent>
          </Card>
        </aside>

        <div id="guide-export-root" className="space-y-6">
          {GUIDE_CHAPTERS.map((chapter) => (
            <ChapterCard key={chapter.id} chapter={chapter} />
          ))}
        </div>
      </div>
    </div>
  )
}
