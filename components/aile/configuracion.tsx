"use client"

import { useState, useEffect, useMemo } from "react"
import { Shield, Users, Calendar, Activity } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useSocios } from "@/hooks/useSocios"
import { supabase } from "@/lib/supabase"
import { formatARS, formatDateTime } from "@/lib/utils"
import { RolesManager } from "@/components/aile/roles-manager"

const roleConfig: Record<string, { descripcion: string; color: string }> = {
  admin: { descripcion: "Acceso total al sistema", color: "#e50051" },
  comision_directiva: { descripcion: "Gestion de socios, finanzas y documentos", color: "#6314a7" },
  revisor_cuentas: { descripcion: "Acceso a finanzas y balances", color: "#b45309" },
  socio: { descripcion: "Acceso a su estado de cuenta y documentos publicos", color: "#6b7280" },
}

const roleLabels: Record<string, string> = {
  admin: "Admin",
  comision_directiva: "Comision Directiva",
  revisor_cuentas: "Revisor de Cuentas",
  socio: "Socio",
}

const logTypeColors: Record<string, string> = {
  CREAR_MOVIMIENTO: "#059669",
  CREAR_RESOLUCION: "#6314a7",
  CREAR_SOCIO: "#9341bf",
  ACTUALIZAR_CUOTA: "#b45309",
}

interface CuotaConfigRow {
  id: string
  periodo: string
  monto: number
  vencimiento_dia: number
  estado: string
}

interface LogRow {
  id: string
  accion: string
  detalle: string
  created_at: string
  usuario?: { nombre: string; apellido: string } | null
}

export function ConfiguracionPage() {
  const { allSocios, loading: sociosLoading } = useSocios()
  const [cuotaConfig, setCuotaConfig] = useState<CuotaConfigRow[]>([])
  const [activityLog, setActivityLog] = useState<LogRow[]>([])
  const [extraLoading, setExtraLoading] = useState(true)

  // Group socios by role to get counts
  const roles = useMemo(() => {
    const counts: Record<string, number> = {}
    allSocios.forEach((s) => {
      const rol = s.rol_aile || "socio"
      counts[rol] = (counts[rol] || 0) + 1
    })

    return Object.entries(roleConfig).map(([key, config]) => ({
      nombre: roleLabels[key] || key,
      descripcion: config.descripcion,
      usuarios: counts[key] || 0,
      color: config.color,
    }))
  }, [allSocios])

  useEffect(() => {
    const loadExtra = async () => {
      setExtraLoading(true)

      // Load cuota config
      const { data: configData } = await supabase
        .from("configuracion")
        .select("*")
        .order("periodo", { ascending: false })
        .limit(5)

      if (configData) {
        setCuotaConfig(configData as CuotaConfigRow[])
      }

      // Load activity log
      const { data: logData } = await supabase
        .from("logs_actividad")
        .select("*, usuario:socios!logs_actividad_usuario_id_fkey(nombre, apellido)")
        .order("created_at", { ascending: false })
        .limit(10)

      if (logData) {
        setActivityLog(logData as LogRow[])
      }

      setExtraLoading(false)
    }
    loadExtra()
  }, [])

  if (sociosLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse opacity-50">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-48 bg-muted rounded-lg" />
        <div className="h-32 bg-muted rounded-lg" />
        <div className="h-64 bg-muted rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-foreground">Ajustes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Administracion del sistema</p>
      </div>

      {/* Roles */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" strokeWidth={1.8} />
            Roles y permisos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <RolesManager />
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Resumen de usuarios por rol</h4>
            {roles.map((rol) => (
              <div key={rol.nombre} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: rol.color }} />
                  <div>
                    <p className="text-sm text-foreground font-medium">{rol.nombre}</p>
                    <p className="text-xs text-muted-foreground">{rol.descripcion}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px] border-0 font-medium gap-1">
                  <Users className="w-3 h-3" />
                  {rol.usuarios}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cuotas */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" strokeWidth={1.8} />
            Periodos de cuotas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {extraLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm opacity-50">Cargando...</div>
          ) : cuotaConfig.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No hay configuracion de cuotas disponible
            </div>
          ) : (
            cuotaConfig.map((cuota) => (
              <div key={cuota.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm text-foreground font-medium">{cuota.periodo}</p>
                  <p className="text-xs text-muted-foreground">Vencimiento: dia {cuota.vencimiento_dia} de cada mes</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-foreground">{formatARS(cuota.monto)}</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] border-0 font-medium"
                    style={{
                      backgroundColor: cuota.estado === "activo" ? "#ecfdf5" : "#fef3c7",
                      color: cuota.estado === "activo" ? "#059669" : "#b45309",
                    }}
                  >
                    {cuota.estado === "activo" ? "Activo" : "Pendiente"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Activity */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" strokeWidth={1.8} />
            Registro de actividad
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {extraLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm opacity-50">Cargando...</div>
          ) : activityLog.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No hay actividad registrada
            </div>
          ) : (
            activityLog.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: logTypeColors[log.accion] || "#6314a7" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{log.detalle}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {log.usuario && (
                      <>
                        <span className="text-xs text-muted-foreground">{log.usuario.nombre} {log.usuario.apellido}</span>
                        <span className="text-xs text-muted-foreground/50">|</span>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div >
  )
}
