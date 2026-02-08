"use client"

import { useState, useEffect, useMemo } from "react"
import { Users, AlertTriangle, Wallet, FileText, ArrowRight, TrendingUp, Bell } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"
import { useFinanzas } from "@/hooks/useFinanzas"
import { useSocios } from "@/hooks/useSocios"
import { useDocumentos } from "@/hooks/useDocumentos"
import { supabase } from "@/lib/supabase"
import { formatARS, formatDateTime } from "@/lib/utils"
import type { Resolucion, LogActividad } from "@/lib/types"

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  comision_directiva: "Comision Directiva",
  revisor_cuentas: "Revisor de Cuentas",
  socio: "Socio",
}

export function DashboardPage() {
  const { user } = useAuth()
  const { summary: finStats, loading: finLoading } = useFinanzas()
  const { allSocios, loading: sociosLoading } = useSocios()
  const { getResoluciones } = useDocumentos()

  const [recentResolutions, setRecentResolutions] = useState<Resolucion[]>([])
  const [notifications, setNotifications] = useState<LogActividad[]>([])
  const [extraLoading, setExtraLoading] = useState(true)

  const sociosActivos = useMemo(() => allSocios.filter(s => s.estado === "activo").length, [allSocios])
  const sociosConDeuda = useMemo(() => allSocios.filter(s => s.tiene_deuda).length, [allSocios])

  useEffect(() => {
    const loadExtra = async () => {
      setExtraLoading(true)

      // Load recent resoluciones (both types, take 3 most recent)
      const [resAsamblea, resDecreto] = await Promise.all([
        getResoluciones("asamblea"),
        getResoluciones("decreto"),
      ])
      const allRes = [...resAsamblea, ...resDecreto]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 3)
      setRecentResolutions(allRes)

      // Load recent activity logs
      const { data: logs } = await supabase
        .from("logs_actividad")
        .select("*, usuario:socios!logs_actividad_usuario_id_fkey(nombre, apellido)")
        .order("created_at", { ascending: false })
        .limit(5)

      if (logs) {
        setNotifications(logs as LogActividad[])
      }

      setExtraLoading(false)
    }
    loadExtra()
  }, [getResoluciones])

  const loading = finLoading || sociosLoading

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse opacity-50">
        <div className="h-10 w-64 bg-muted rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="h-48 bg-muted rounded-lg" />
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      </div>
    )
  }

  const stats = [
    {
      title: "Socios activos",
      value: String(sociosActivos),
      icon: Users,
      iconBg: "#ede5f7",
      iconColor: "#6314a7",
    },
    {
      title: "Con deuda",
      value: String(sociosConDeuda),
      icon: AlertTriangle,
      iconBg: "#fde2e8",
      iconColor: "#e50051",
    },
    {
      title: "Saldo actual",
      value: formatARS(finStats.balance),
      change: finStats.gananciaPorcentual !== 0
        ? `${finStats.gananciaPorcentual >= 0 ? "+" : ""}${finStats.gananciaPorcentual.toFixed(1)}%`
        : undefined,
      icon: Wallet,
      iconBg: "#ede5f7",
      iconColor: "#9341bf",
    },
    {
      title: "Resoluciones",
      value: String(recentResolutions.length),
      icon: FileText,
      iconBg: "#f3e8f9",
      iconColor: "#cea2dc",
    },
  ]

  const formatResNumber = (res: Resolucion) => {
    const prefix = res.tipo === "decreto" ? "Dec. CD" : "Res."
    return `${prefix} ${String(res.numero).padStart(3, "0")}/${res.anio}`
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground text-balance">
          Hola, {user?.nombre || "Usuario"}
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          {roleLabels[user?.rol || "socio"] || "Socio"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border border-border shadow-none">
            <CardContent className="p-4 lg:p-5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{ backgroundColor: stat.iconBg }}
              >
                <stat.icon className="w-[18px] h-[18px]" style={{ color: stat.iconColor }} strokeWidth={1.8} />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.title}</p>
              {stat.change && (
                <p className="text-xs font-medium mt-1" style={{ color: "#6314a7" }}>{stat.change}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent resolutions */}
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Ultimas resoluciones</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recentResolutions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No hay resoluciones disponibles
              </div>
            ) : (
              recentResolutions.map((res) => (
                <div
                  key={res.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-mono font-medium" style={{ color: "#6314a7" }}>{formatResNumber(res)}</span>
                    <span className="text-sm text-foreground truncate">{res.titulo}</span>
                    <span className="text-xs text-muted-foreground">{new Date(res.fecha).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-3" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" strokeWidth={1.8} />
              Actividad reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No hay actividad reciente
              </div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: "#6314a7" }}
                  />
                  <div>
                    <p className="text-sm text-foreground">{notif.detalle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(notif.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Accesos rapidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Registrar pago", icon: Wallet, color: "#6314a7" },
              { label: "Agregar socio", icon: Users, color: "#9341bf" },
              { label: "Nueva resolucion", icon: FileText, color: "#6314a7" },
              { label: "Ver balance", icon: TrendingUp, color: "#9341bf" },
            ].map((action) => (
              <button
                key={action.label}
                className="flex flex-col items-center gap-2.5 p-4 rounded-lg border border-border hover:bg-muted/50 transition-all"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${action.color}12` }}
                >
                  <action.icon className="w-[18px] h-[18px]" style={{ color: action.color }} strokeWidth={1.8} />
                </div>
                <span className="text-xs text-foreground font-medium text-center">{action.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
