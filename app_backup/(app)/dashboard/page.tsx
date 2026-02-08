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

  const nombre = user?.user_metadata?.nombre || 'Usuario'
  const apellido = user?.user_metadata?.apellido || ''
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#6314a7]/30 via-[#e50051]/20 to-[#00a3e2]/20 p-6 lg:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#6314a7]/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#e50051]/20 rounded-full blur-[80px]" />
        
        <div className="relative z-10">
          <h1 className="text-2xl lg:text-3xl font-black text-white mb-2">
            ¡Bienvenido/a, {nombre}!
          </h1>
          <p className="text-[#a899b8] mb-4">
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
        <Card className="bg-[#1a0f2e] border-[rgba(99,20,167,0.2)] hover:border-[rgba(99,20,167,0.4)] transition-all hover:shadow-lg hover:shadow-[#6314a7]/10">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#7c6a94]">Socios activos</p>
                {loading ? (
                  <Skeleton className="h-8 w-16 mt-1 bg-[#0d0618]" />
                ) : (
                  <p className="text-2xl font-bold text-white mt-1">
                    {stats.sociosActivos}
                  </p>
                )}
              </div>
              <div className="p-2 rounded-lg bg-[#6314a7]/20">
                <Users className="w-5 h-5 text-[#9341bf]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Socios con Deuda */}
        {hasPermission('deudas', 'ver') && (
          <Card className="bg-[#1a0f2e] border-[rgba(99,20,167,0.2)] hover:border-[rgba(229,0,81,0.4)] transition-all hover:shadow-lg hover:shadow-[#e50051]/10">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[#7c6a94]">Socios con deuda</p>
                  {loading ? (
                    <Skeleton className="h-8 w-16 mt-1 bg-[#0d0618]" />
                  ) : (
                    <p className="text-2xl font-bold text-[#e50051] mt-1">
                      {stats.sociosConDeuda}
                    </p>
                  )}
                </div>
                <div className="p-2 rounded-lg bg-[#e50051]/20">
                  <AlertTriangle className="w-5 h-5 text-[#ff6699]" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Saldo Actual */}
        {hasPermission('finanzas', 'ver') && (
          <Card className="bg-[#1a0f2e] border-[rgba(99,20,167,0.2)] hover:border-[rgba(99,20,167,0.4)] transition-all hover:shadow-lg hover:shadow-[#6314a7]/10">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[#7c6a94]">Saldo actual</p>
                  {loading ? (
                    <Skeleton className="h-8 w-24 mt-1 bg-[#0d0618]" />
                  ) : (
                    <p className="text-2xl font-bold text-white mt-1">
                      {formatARS(stats.saldoActual)}
                    </p>
                  )}
                </div>
                <div className="p-2 rounded-lg bg-[#00a3e2]/20">
                  <Wallet className="w-5 h-5 text-[#00a3e2]" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resoluciones Vigentes */}
        <Card className="bg-[#1a0f2e] border-[rgba(99,20,167,0.2)] hover:border-[rgba(99,20,167,0.4)] transition-all hover:shadow-lg hover:shadow-[#6314a7]/10">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#7c6a94]">Resoluciones vigentes</p>
                {loading ? (
                  <Skeleton className="h-8 w-16 mt-1 bg-[#0d0618]" />
                ) : (
                  <p className="text-2xl font-bold text-white mt-1">
                    {stats.resolucionesVigentes}
                  </p>
                )}
              </div>
              <div className="p-2 rounded-lg bg-[#cea2dc]/20">
                <FileText className="w-5 h-5 text-[#cea2dc]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest News and Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Últimas novedades */}
        <Card className="bg-[#1a0f2e] border-[rgba(99,20,167,0.2)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#6314a7]" />
              Últimas novedades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingResoluciones ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full bg-[#0d0618]" />
                ))}
              </div>
            ) : resoluciones.length === 0 ? (
              <p className="text-[#7c6a94] text-sm text-center py-4">
                No hay novedades recientes
              </p>
            ) : (
              <div className="space-y-3">
                {resoluciones.map((res) => (
                  <Link
                    key={res.id}
                    href={`/documentos/${res.tipo === 'asamblea' ? 'resoluciones' : 'decretos'}`}
                    className="block p-3 rounded-lg bg-[#0d0618] hover:bg-[rgba(99,20,167,0.1)] transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            res.tipo === 'asamblea' 
                              ? 'bg-[#6314a7]/20 text-[#9341bf]' 
                              : 'bg-[#00a3e2]/20 text-[#00a3e2]'
                          )}>
                            {res.tipo === 'asamblea' ? 'Resolución' : 'Decreto'}
                          </span>
                          <span className="text-xs text-[#5a4a6e]">
                            N° {res.numero}/{res.anio}
                          </span>
                        </div>
                        <p className="text-sm text-white font-medium truncate group-hover:text-[#cea2dc] transition-colors">
                          {res.titulo}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#7c6a94] group-hover:text-[#cea2dc] transition-colors shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accesos rápidos */}
        <Card className="bg-[#1a0f2e] border-[rgba(99,20,167,0.2)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#6314a7]" />
              Accesos rápidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="bg-[#0d0618] border-[rgba(99,20,167,0.3)] text-white hover:bg-[rgba(99,20,167,0.2)] hover:text-white"
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
                className="bg-[#0d0618] border-[rgba(99,20,167,0.3)] text-white hover:bg-[rgba(99,20,167,0.2)] hover:text-white"
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
                className="bg-[#0d0618] border-[rgba(99,20,167,0.3)] text-white hover:bg-[rgba(99,20,167,0.2)] hover:text-white"
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
                  className="bg-[#0d0618] border-[#e50051]/30 text-white hover:bg-[rgba(229,0,81,0.2)] hover:text-white"
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
