"use client"

import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"
import { getGuideHrefForPath, resolveGuideChapterFromPath } from "@/lib/guide-content"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface GuideContextBarProps {
  pathname: string
  pageLabel: string
}

export function GuideContextBar({ pathname, pageLabel }: GuideContextBarProps) {
  const chapter = resolveGuideChapterFromPath(pathname)

  if (!chapter) return null

  return (
    <Card className="border-[#6314a7]/20 bg-[linear-gradient(90deg,rgba(99,20,167,0.08),rgba(255,255,255,0.96),rgba(229,0,81,0.05))] shadow-none">
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#6314a7] text-white">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Ayuda para {pageLabel}</p>
            <p className="text-sm text-muted-foreground">
              {chapter.description}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline">
            <Link href={getGuideHrefForPath(pathname)}>
              Ver esta pantalla
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild className="bg-[#6314a7] text-white hover:bg-[#53108c]">
            <Link href="/guia">
              Guia completa
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
