'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Users,
  AlertTriangle,
  Wallet,
  FileText,
  CalendarDays,
  Megaphone,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  KanbanSquare,
} from 'lucide-react'
import { cn, formatARS, formatDate, formatDateTime } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ROL_LABELS, ROL_COLORS } from '@/lib/constants'
import type { Rol, Resolucion } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { runWithRecovery } from '@/lib/async-recovery'
import { useResumeRefresh } from '@/hooks/useResumeRefresh'

interface DashboardStats {
  sociosActivos: number
  sociosConDeuda: number
  montoDeudaTotal: number
  saldoActual: number
  resolucionesVigentes: number
}

interface AgendaItem {
  id: string
  tipo: 'reunion' | 'planificacion'
  titulo: string
  inicio: string
  fin: string
  estado?: 'tentativo' | 'definitivo'
}

interface SupabaseErrorLike {
  code?: string
  message?: string
  details?: string
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybe = error as SupabaseErrorLike
  const code = (maybe.code || '').toUpperCase()
  const details = `${maybe.message || ''} ${maybe.details || ''}`.toLowerCase()

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    details.includes('does not exist') ||
    details.includes('could not find the table')
  )
}

function formatAgendaRange(item: AgendaItem): string {
  if (item.tipo === 'reunion') {
    return formatDateTime(item.inicio)
  }

  const inicio = item.inicio.slice(0, 10)
  const fin = item.fin.slice(0, 10)
  if (inicio === fin) return formatDate(inicio)
  return `${formatDate(inicio)} - ${formatDate(fin)}`
}

function isImportantAgendaItem(item: AgendaItem): boolean {
  if (item.tipo === 'planificacion' && item.estado === 'definitivo') return true

  const now = Date.now()
  const start = new Date(item.inicio).getTime()
  const diffMs = start - now
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  return diffMs >= 0 && diffMs <= sevenDaysMs
}

export default function DashboardPage() {
  const { user, rol, hasPermission } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    sociosActivos: 0,
    sociosConDeuda: 0,
    montoDeudaTotal: 0,
    saldoActual: 0,
    resolucionesVigentes: 0,
  })
  const [loading, setLoading] = useState(true)
  const [resoluciones, setResoluciones] = useState<Resolucion[]>([])
  const [loadingResoluciones, setLoadingResoluciones] = useState(true)
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([])
  const [loadingAgenda, setLoadingAgenda] = useState(true)

  const nombre = user?.nombre || 'Usuario'
  const apellido = user?.apellido || ''
  const rolColors = ROL_COLORS[rol as Rol]

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)

      const [sociosResult, cuotasResult, resolucionesResult] = await Promise.all([
        runWithRecovery(() => supabase
          .from('socios')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'activo'), { label: 'dashboard socios activos' }),
        runWithRecovery(() => supabase
          .from('cuotas')
          .select('socio_id, monto_esperado, monto_pagado')
          .in('estado', ['vencida', 'pendiente']), { label: 'dashboard cuotas pendientes' }),
        runWithRecovery(() => supabase
          .from('resoluciones')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'vigente'), { label: 'dashboard resoluciones vigentes' }),
      ])

      const sociosActivos = sociosResult.count || 0
      const cuotasVencidas = cuotasResult.data || []
      const resolucionesVigentes = resolucionesResult.count || 0

      const sociosConDeudaSet = new Set(cuotasVencidas?.map(c => c.socio_id) || [])
      const montoDeudaTotal = cuotasVencidas?.reduce((acc, c) =>
        acc + (c.monto_esperado - c.monto_pagado), 0
      ) || 0

      // Saldo actual
      let saldoActual = 0
      if (hasPermission('finanzas', 'ver')) {
        const { data: movimientos } = await runWithRecovery(() => supabase
          .from('movimientos')
          .select('tipo, monto')
          .eq('anulado', false), {
            label: 'dashboard saldo actual',
          })

        saldoActual = movimientos?.reduce((acc, m) => {
          return m.tipo === 'ingreso' ? acc + m.monto : acc - m.monto
        }, 0) || 0
      }

      setStats({
        sociosActivos,
        sociosConDeuda: sociosConDeudaSet.size,
        montoDeudaTotal,
        saldoActual,
        resolucionesVigentes,
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [hasPermission])

  const fetchResolucionesRecientes = useCallback(async () => {
    try {
      setLoadingResoluciones(true)
      const { data } = await runWithRecovery(() => supabase
        .from('resoluciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3), {
          label: 'dashboard resoluciones recientes',
        })

      setResoluciones(data || [])
    } catch (error) {
      console.error('Error fetching resoluciones:', error)
    } finally {
      setLoadingResoluciones(false)
    }
  }, [])

  const fetchAgendaItems = useCallback(async () => {
    try {
      setLoadingAgenda(true)

      const nowIso = new Date().toISOString()
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayKey = today.toISOString().slice(0, 10)

      const [reunionesResult, planificacionesResult] = await Promise.all([
        runWithRecovery(() => supabase
          .from('reuniones_calendario')
          .select('id, titulo, fecha_inicio, fecha_fin')
          .gte('fecha_fin', nowIso)
          .order('fecha_inicio', { ascending: true })
          .limit(8), {
            label: 'dashboard reuniones proximas',
          }),
        runWithRecovery(() => supabase
          .from('planificaciones_calendario')
          .select('id, titulo, fecha_inicio, fecha_fin, estado')
          .gte('fecha_fin', todayKey)
          .order('fecha_inicio', { ascending: true })
          .limit(12), {
            label: 'dashboard planificaciones proximas',
          }),
      ])

      const reunionesError = reunionesResult.error
      const planificacionesError = planificacionesResult.error
      if (reunionesError && !isMissingRelationError(reunionesError)) throw reunionesError
      if (planificacionesError && !isMissingRelationError(planificacionesError)) throw planificacionesError

      const reuniones = (reunionesResult.data || []).map((r) => ({
        id: `reunion-${r.id}`,
        tipo: 'reunion' as const,
        titulo: r.titulo || 'Reunión sin título',
        inicio: r.fecha_inicio,
        fin: r.fecha_fin,
      }))

      const planificaciones = (planificacionesResult.data || []).map((p) => ({
        id: `planificacion-${p.id}`,
        tipo: 'planificacion' as const,
        titulo: p.titulo || 'Actividad sin título',
        inicio: `${p.fecha_inicio}T00:00:00`,
        fin: `${p.fecha_fin}T23:59:59`,
        estado: p.estado as 'tentativo' | 'definitivo',
      }))

      const unified = [...reuniones, ...planificaciones]
        .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())
        .slice(0, 6)

      setAgendaItems(unified)
    } catch (error) {
      console.error('Error fetching dashboard agenda:', error)
      setAgendaItems([])
    } finally {
      setLoadingAgenda(false)
    }
  }, [])

  useEffect(() => {
    void fetchDashboardData()
    void fetchResolucionesRecientes()
    void fetchAgendaItems()
  }, [fetchDashboardData, fetchResolucionesRecientes, fetchAgendaItems])

  useResumeRefresh(() => {
    void fetchDashboardData()
    void fetchResolucionesRecientes()
    void fetchAgendaItems()
  }, { throttleMs: 5_000 })

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-muted p-6 lg:p-8 border border-border">
        <div className="relative z-10">
          <h1 className="text-2xl lg:text-3xl font-black text-foreground mb-2">
            ¡Bienvenido/a, {nombre}!
          </h1>
          <p className="text-muted-foreground mb-4">
            Este es el panel de gestión interna de AILE
          </p>
          <span className={cn(
            'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
            rolColors.bg,
            rolColors.text
          )}>
            {ROL_LABELS[rol as Rol]}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Socios Activos */}
        <Card className="bg-card border-border hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Socios activos</p>
                {loading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                    {stats.sociosActivos}
                  </p>
                )}
              </div>
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Socios con Deuda */}
        {hasPermission('deudas', 'ver') && (
          <Card className="bg-card border-border hover:border-destructive/30 transition-all hover:shadow-lg hover:shadow-destructive/5">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Socios con deuda</p>
                  {loading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-xl sm:text-2xl font-bold text-[#e50051] mt-1">
                      {stats.sociosConDeuda}
                    </p>
                  )}
                </div>
                <div className="p-2 rounded-lg bg-[#e50051]/10">
                  <AlertTriangle className="w-5 h-5 text-[#e50051]" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Saldo Actual */}
        {hasPermission('finanzas', 'ver') && (
          <Card className="bg-card border-border hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo actual</p>
                  {loading ? (
                    <Skeleton className="h-8 w-24 mt-1" />
                  ) : (
                    <p className="mt-1 text-lg font-bold leading-tight text-foreground break-words sm:text-2xl">
                      {formatARS(stats.saldoActual)}
                    </p>
                  )}
                </div>
                <div className="p-2 rounded-lg bg-[#00a3e2]/10">
                  <Wallet className="w-5 h-5 text-[#00a3e2]" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resoluciones Vigentes */}
        <Card className="bg-card border-border hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resoluciones vigentes</p>
                {loading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                    {stats.resolucionesVigentes}
                  </p>
                )}
              </div>
              <div className="p-2 rounded-lg bg-[#cea2dc]/10">
                <FileText className="w-5 h-5 text-[#cea2dc]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest News and Agenda */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Últimas novedades */}
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5" style={{ color: "#6314a7" }} />
              Últimas novedades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingResoluciones ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : resoluciones.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                No hay novedades recientes
              </p>
            ) : (
              <div className="space-y-3">
                {resoluciones.map((res) => (
                  <Link
                    key={res.id}
                    href={`/documentos?tab=${res.tipo === 'asamblea' ? 'resoluciones' : 'decretos'}`}
                    className="group block min-w-0 overflow-hidden rounded-lg bg-muted p-3 transition-colors hover:bg-muted/80"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="mb-1 flex min-w-0 items-center gap-2">
                          <span className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-xs',
                            res.tipo === 'asamblea'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-[#00a3e2]/10 text-[#00a3e2]'
                          )}>
                            {res.tipo === 'asamblea' ? 'Resolución' : 'Decreto'}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            N° {res.numero}/{res.anio}
                          </span>
                        </div>
                        <p className="w-full truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                          {res.titulo}
                        </p>
                      </div>
                      <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary sm:block" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximas fechas importantes */}
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <CalendarDays className="w-5 h-5" style={{ color: "#6314a7" }} />
              Próximas fechas importantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAgenda ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : agendaItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Todavía no hay fechas próximas cargadas.
                </p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link href="/calendario">Ir al calendario</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {agendaItems.map((item) => (
                    <Link
                      key={item.id}
                      href="/calendario"
                      className="group block min-w-0 overflow-hidden rounded-lg bg-muted p-3 transition-colors hover:bg-muted/80"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="mb-1.5 flex min-w-0 items-center gap-2 flex-wrap">
                            <span className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-xs',
                              item.tipo === 'planificacion'
                                ? 'bg-cyan-100 text-cyan-800'
                                : 'bg-violet-100 text-violet-800'
                            )}>
                              {item.tipo === 'planificacion' ? 'Planificación' : 'Reunión'}
                            </span>

                            {item.estado && (
                              <span className={cn(
                                'shrink-0 rounded-full px-2 py-0.5 text-xs',
                                item.estado === 'definitivo'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              )}>
                                {item.estado === 'definitivo' ? 'Definitiva' : 'Tentativa'}
                              </span>
                            )}

                            {isImportantAgendaItem(item) && (
                              <span className="shrink-0 rounded-full bg-[#e50051]/10 px-2 py-0.5 text-xs text-[#e50051]">
                                Importante
                              </span>
                            )}
                          </div>

                          <p className="w-full truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                            {item.titulo}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatAgendaRange(item)}
                          </p>
                        </div>
                        <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary sm:block" />
                      </div>
                    </Link>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="mt-4 w-full min-w-0 justify-start bg-muted border-border text-foreground hover:bg-muted/80"
                >
                  <Link href="/calendario">
                    <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">Ver agenda completa</span>
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accesos rápidos */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5" style={{ color: "#6314a7" }} />
            Accesos rápidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full min-w-0 justify-start bg-muted border-border text-foreground hover:bg-muted/80"
            >
              <Link href="/tareas">
                <KanbanSquare className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Ir a tareas</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full min-w-0 justify-start bg-muted border-border text-foreground hover:bg-muted/80"
            >
              <Link href="/socios">
                <Users className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Ver socios</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full min-w-0 justify-start bg-muted border-border text-foreground hover:bg-muted/80"
            >
              <Link href="/deudas/mi-cuenta">
                <Wallet className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Mi estado de cuenta</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full min-w-0 justify-start bg-muted border-border text-foreground hover:bg-muted/80"
            >
              <Link href="/calendario">
                <Megaphone className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Ver calendario</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full min-w-0 justify-start bg-muted border-border text-foreground hover:bg-muted/80"
            >
              <Link href="/documentos?tab=estatuto">
                <FileText className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Ver estatuto</span>
              </Link>
            </Button>

            {hasPermission('finanzas', 'crear') && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full min-w-0 justify-start bg-muted border-border text-foreground hover:bg-muted/80"
              >
                <Link href="/finanzas">
                  <TrendingDown className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">Registrar egreso</span>
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
