'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  AlertTriangle,
  Wallet,
  FileText,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Loader2,
} from 'lucide-react'
import { cn, formatARS } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ROL_LABELS, ROL_COLORS } from '@/lib/constants'
import type { Rol, Resolucion } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface DashboardStats {
  sociosActivos: number
  sociosConDeuda: number
  montoDeudaTotal: number
  saldoActual: number
  resolucionesVigentes: number
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

  const nombre = user?.nombre || 'Usuario'
  const apellido = user?.apellido || ''
  const rolColors = ROL_COLORS[rol as Rol]

  useEffect(() => {
    fetchDashboardData()
    fetchResolucionesRecientes()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Socios activos
      const { count: sociosActivos } = await supabase
        .from('socios')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'activo')

      // Socios con deuda
      const { data: cuotasVencidas } = await supabase
        .from('cuotas')
        .select('socio_id, monto_esperado, monto_pagado')
        .in('estado', ['vencida', 'pendiente'])

      const sociosConDeudaSet = new Set(cuotasVencidas?.map(c => c.socio_id) || [])
      const montoDeudaTotal = cuotasVencidas?.reduce((acc, c) =>
        acc + (c.monto_esperado - c.monto_pagado), 0
      ) || 0

      // Saldo actual
      let saldoActual = 0
      if (hasPermission('finanzas', 'ver')) {
        const { data: movimientos } = await supabase
          .from('movimientos')
          .select('tipo, monto')

        saldoActual = movimientos?.reduce((acc, m) => {
          return m.tipo === 'ingreso' ? acc + m.monto : acc - m.monto
        }, 0) || 0
      }

      // Resoluciones vigentes
      const { count: resolucionesVigentes } = await supabase
        .from('resoluciones')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'vigente')

      setStats({
        sociosActivos: sociosActivos || 0,
        sociosConDeuda: sociosConDeudaSet.size,
        montoDeudaTotal,
        saldoActual,
        resolucionesVigentes: resolucionesVigentes || 0,
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchResolucionesRecientes = async () => {
    try {
      setLoadingResoluciones(true)
      const { data } = await supabase
        .from('resoluciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3)

      setResoluciones(data || [])
    } catch (error) {
      console.error('Error fetching resoluciones:', error)
    } finally {
      setLoadingResoluciones(false)
    }
  }

  return (
    <div className="space-y-6">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Socios Activos */}
        <Card className="bg-card border-border hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Socios activos</p>
                {loading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground mt-1">
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
                    <p className="text-2xl font-bold text-[#e50051] mt-1">
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
                    <p className="text-2xl font-bold text-foreground mt-1">
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
                  <p className="text-2xl font-bold text-foreground mt-1">
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

      {/* Latest News and Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Últimas novedades */}
        <Card className="bg-card border-border">
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
                    href={`/documentos/${res.tipo === 'asamblea' ? 'resoluciones' : 'decretos'}`}
                    className="block p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            res.tipo === 'asamblea'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-[#00a3e2]/10 text-[#00a3e2]'
                          )}>
                            {res.tipo === 'asamblea' ? 'Resolución' : 'Decreto'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            N° {res.numero}/{res.anio}
                          </span>
                        </div>
                        <p className="text-sm text-foreground font-medium truncate group-hover:text-primary transition-colors">
                          {res.titulo}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accesos rápidos */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: "#6314a7" }} />
              Accesos rápidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="bg-muted border-border text-foreground hover:bg-muted/80"
              >
                <Link href="/socios">
                  <Users className="w-4 h-4 mr-2" />
                  Ver socios
                </Link>
              </Button>

              <Button
                variant="outline"
                size="sm"
                asChild
                className="bg-muted border-border text-foreground hover:bg-muted/80"
              >
                <Link href="/deudas/mi-cuenta">
                  <Wallet className="w-4 h-4 mr-2" />
                  Mi estado de cuenta
                </Link>
              </Button>

              <Button
                variant="outline"
                size="sm"
                asChild
                className="bg-muted border-border text-foreground hover:bg-muted/80"
              >
                <Link href="/documentos/estatuto">
                  <FileText className="w-4 h-4 mr-2" />
                  Ver estatuto
                </Link>
              </Button>

              {hasPermission('finanzas', 'crear') && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="bg-muted border-border text-foreground hover:bg-muted/80"
                >
                  <Link href="/finanzas">
                    <TrendingDown className="w-4 h-4 mr-2" />
                    Registrar egreso
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
