"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import type { CategoriaFinanciera, Evento } from "@/lib/types"

interface FinanceFiltersProps {
  availableYears: number[]
  categorias: CategoriaFinanciera[]
  eventos: Evento[]
  anio?: number
  categoriaId?: string
  eventoId?: string
  hasActiveFilters: boolean
  onAnioChange: (anio?: number) => void
  onCategoriaChange: (id?: string) => void
  onEventoChange: (id?: string) => void
  onClear: () => void
}

export function FinanceFilters({
  availableYears,
  categorias,
  eventos,
  anio,
  categoriaId,
  eventoId,
  hasActiveFilters,
  onAnioChange,
  onCategoriaChange,
  onEventoChange,
  onClear,
}: FinanceFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
      <Select
        value={anio?.toString() || "all"}
        onValueChange={(v) => onAnioChange(v === "all" ? undefined : Number(v))}
      >
        <SelectTrigger className="w-full sm:w-[130px] h-9 text-sm bg-transparent">
          <SelectValue placeholder="Año" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los años</SelectItem>
          {availableYears.map((y) => (
            <SelectItem key={y} value={y.toString()}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={categoriaId || "all"}
        onValueChange={(v) => onCategoriaChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-transparent">
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las categorías</SelectItem>
          {categorias.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={eventoId || "all"}
        onValueChange={(v) => onEventoChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm bg-transparent">
          <SelectValue placeholder="Evento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los eventos</SelectItem>
          {eventos.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-9 gap-1.5 text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
          Limpiar
        </Button>
      )}
    </div>
  )
}
