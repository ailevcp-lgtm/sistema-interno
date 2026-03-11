'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Users,
  Wallet,
  Tags,
  Activity,
  Loader2,
  Save,
  Search,
} from 'lucide-react'
import { cn, formatARS, formatDateTime } from '@/lib/utils'
import { useRequirePermission } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ROL_LABELS,
  ROL_COLORS,
  COMISION_DIRECTIVA_ROLES_AILE,
  normalizeInstitutionalRole,
} from '@/lib/constants'
import type { Rol, Usuario, CategoriaFinanciera, LogActividad } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

import { RolesManager } from '@/components/aile/roles-manager'
import { RoleSimulationPanel } from '@/components/aile/role-simulation-panel'
import { runWithRecovery } from '@/lib/async-recovery'
import { useResumeRefresh } from '@/hooks/useResumeRefresh'

export default function ConfiguracionPage() {
  useRequirePermission('configuracion', 'ver', '/dashboard', { useActualPermission: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Configuración</h1>
        <p className="text-muted-foreground">
          Gestiona roles, cuotas, categorías y visualiza logs del sistema
        </p>
      </div>

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList className="bg-muted border border-border">
          <TabsTrigger
            value="roles"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Users className="w-4 h-4 mr-2" />
            Roles
          </TabsTrigger>
          <TabsTrigger
            value="cuotas"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Cuotas
          </TabsTrigger>
          <TabsTrigger
            value="categorias"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Tags className="w-4 h-4 mr-2" />
            Categorías
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Activity className="w-4 h-4 mr-2" />
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-6">
          <RoleSimulationPanel />
          <RolesManager />
          <RolesTab />
        </TabsContent>
        <TabsContent value="cuotas">
          <CuotasTab />
        </TabsContent>
        <TabsContent value="categorias">
          <CategoriasTab />
        </TabsContent>
        <TabsContent value="logs">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Tab de Roles
import { useRoles } from '@/hooks/useRoles'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const COMISION_DIRECTIVA_ROLE_SET = new Set(
  COMISION_DIRECTIVA_ROLES_AILE.map((roleName) => normalizeInstitutionalRole(roleName))
)

interface UsuarioRoleRow {
  id: string
  email: string | null
  nombre: string
  apellido: string
  rol: Rol | null
  rol_aile_id?: string | null
  rol_aile?: string | null
  rol_aile_definition?: { nombre?: string | null } | null
}

function RolesTab() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null)
  const [newRole, setNewRole] = useState<Rol>('socio')
  const [newRoleAileId, setNewRoleAileId] = useState<string>('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { roles: rolesAile } = useRoles()
  const isComisionDirectivaRole = newRole === 'comision_directiva'

  const availableRolesAile = useMemo(
    () => rolesAile.filter((role) => (
      isComisionDirectivaRole
        ? COMISION_DIRECTIVA_ROLE_SET.has(normalizeInstitutionalRole(role.nombre))
        : !COMISION_DIRECTIVA_ROLE_SET.has(normalizeInstitutionalRole(role.nombre))
    )),
    [isComisionDirectivaRole, rolesAile]
  )

  useEffect(() => {
    if (!newRoleAileId) return

    const selectedRole = rolesAile.find((role) => role.id === newRoleAileId)
    if (!selectedRole) return

    const isComisionDirectivaCargo = COMISION_DIRECTIVA_ROLE_SET.has(
      normalizeInstitutionalRole(selectedRole.nombre)
    )

    if (isComisionDirectivaRole && !isComisionDirectivaCargo) {
      setNewRoleAileId('')
      return
    }

    if (!isComisionDirectivaRole && isComisionDirectivaCargo) {
      setNewRoleAileId('')
    }
  }, [isComisionDirectivaRole, newRoleAileId, rolesAile])

  const fetchUsuarios = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await runWithRecovery(() => supabase
        .from('socios')
        .select(`
          id, 
          nombre, 
          apellido, 
          email, 
          rol,
          rol_aile_id,
          rol_aile,
          rol_aile_definition:rol_aile_definitions(nombre)
        `)
        .order('apellido'), {
          label: 'configuracion usuarios',
        })

      if (error) throw error
      setUsuarios(((data || []) as UsuarioRoleRow[]).map((s) => ({
        id: s.id,
        email: s.email || '',
        nombre: s.nombre,
        apellido: s.apellido,
        rol: (s.rol as Rol) || 'socio',
        rol_aile_id: s.rol_aile_id,
        rol_aile_nombre: s.rol_aile_definition?.nombre || s.rol_aile || 'Sin rol'
      })))
    } catch (error) {
      console.error('Error fetching usuarios:', error)
      toast.error('Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchUsuarios()
  }, [fetchUsuarios])
  useResumeRefresh(() => { void fetchUsuarios() }, { throttleMs: 5_000 })

  const handleRoleChange = async () => {
    if (!selectedUser) return
    const selectedRoleDef = rolesAile.find(r => r.id === newRoleAileId)
    const selectedRoleName = selectedRoleDef?.nombre || null
    const isComisionDirectivaCargo = selectedRoleName
      ? COMISION_DIRECTIVA_ROLE_SET.has(normalizeInstitutionalRole(selectedRoleName))
      : false

    if (newRole === 'comision_directiva' && !isComisionDirectivaCargo) {
      toast.error('Si el rol del sistema es Comisión Directiva, el cargo AILE debe ser Presidente, Tesorero, Secretario General o Vocal Titular.')
      return
    }

    if (newRole !== 'comision_directiva' && isComisionDirectivaCargo) {
      toast.error('Los cargos de Comisión Directiva solo se pueden asignar cuando el nivel de permisos es Comisión Directiva.')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('socios')
        .update({
          rol: newRole,
          rol_aile_id: newRoleAileId || null,
          rol_aile: selectedRoleDef?.nombre // Update legacy column for consistency
        })
        .eq('id', selectedUser.id)

      if (error) throw error

      setUsuarios(prev =>
        prev.map(u => u.id === selectedUser.id ? {
          ...u,
          rol: newRole,
          rol_aile_id: newRoleAileId,
          rol_aile_nombre: selectedRoleDef?.nombre || (newRoleAileId ? '...' : 'Sin rol')
        } : u)
      )
      toast.success('Roles actualizados correctamente')
      setIsDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast.error('Error al actualizar roles')
    } finally {
      setIsSaving(false)
    }
  }

  const filteredUsers = usuarios.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.nombre.toLowerCase().includes(search.toLowerCase()) ||
    u.apellido.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Permisos y Roles</CardTitle>
        <CardDescription className="text-muted-foreground">
          Administra los permisos de acceso y roles institucionales
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Usuario</TableHead>
                <TableHead className="text-muted-foreground">Email</TableHead>
                <TableHead className="text-muted-foreground">Rol Institucional</TableHead>
                <TableHead className="text-muted-foreground">Permisos</TableHead>
                <TableHead className="text-muted-foreground">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((usuario) => (
                <TableRow
                  key={usuario.id}
                  className="border-border hover:bg-muted/50"
                >
                  <TableCell className="text-foreground">
                    {usuario.nombre} {usuario.apellido}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{usuario.email}</TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">
                      {usuario.rol_aile_nombre}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      ROL_COLORS[usuario.rol].bg,
                      ROL_COLORS[usuario.rol].text,
                      'border-0'
                    )}>
                      {ROL_LABELS[usuario.rol]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(usuario)
                        setNewRole(usuario.rol)
                        setNewRoleAileId(usuario.rol_aile_id || "")
                        setIsDialogOpen(true)
                      }}
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Roles</DialogTitle>
              <DialogDescription>
                Modificar roles para {selectedUser?.nombre} {selectedUser?.apellido}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">

              <div className="space-y-3">
                <Label className="text-foreground font-medium">Rol Institucional (Visible en perfil)</Label>
                <Select
                  value={newRoleAileId || "none"}
                  onValueChange={(v) => setNewRoleAileId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol institucional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled={isComisionDirectivaRole}>Sin rol específico</SelectItem>
                    {availableRolesAile.map((rol) => (
                      <SelectItem key={rol.id} value={rol.id}>
                        {rol.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {isComisionDirectivaRole
                    ? 'Para Comisión Directiva solo se permiten: Presidente, Tesorero, Secretario General o Vocal Titular.'
                    : 'Este es el cargo que ocupa en la organización (ej. Director de Comunicación).'}
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-foreground font-medium">Nivel de Permisos (Sistema)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['socio', 'comision_directiva', 'revisor_cuentas', 'admin'] as Rol[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setNewRole(r)}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-colors',
                        newRole === r
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <span className={cn(
                        'text-sm font-medium',
                        newRole === r ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {ROL_LABELS[r]}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Define qué secciones del sistema puede ver y editar.
                </p>
              </div>

            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRoleChange}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Guardar cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

// Tab de Cuotas
function CuotasTab() {
  const [montoCuota, setMontoCuota] = useState(5000)
  const [diaVencimiento, setDiaVencimiento] = useState(10)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const loadConfig = useCallback(async () => {
    try {
      setLoadingConfig(true)
      const { data } = await runWithRecovery(() => supabase
        .from('configuracion')
        .select('clave, valor')
        .in('clave', ['monto_cuota', 'dia_vencimiento']), {
          label: 'configuracion cuotas',
        })

      if (data) {
        data.forEach(row => {
          if (row.clave === 'monto_cuota') setMontoCuota(Number(row.valor))
          if (row.clave === 'dia_vencimiento') setDiaVencimiento(Number(row.valor))
        })
      }
    } finally {
      setLoadingConfig(false)
    }
  }, [])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])
  useResumeRefresh(() => { void loadConfig() }, { throttleMs: 5_000 })

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('configuracion')
        .upsert([
          { clave: 'monto_cuota', valor: String(montoCuota), updated_at: new Date().toISOString() },
          { clave: 'dia_vencimiento', valor: String(diaVencimiento), updated_at: new Date().toISOString() },
        ], { onConflict: 'clave' })

      if (error) throw error
      toast.success('Configuración de cuotas guardada')
    } catch {
      toast.error('Error al guardar configuración')
    } finally {
      setIsSaving(false)
    }
  }

  const handleGenerarCuotas = async () => {
    try {
      const periodo = new Date().toISOString().substring(0, 7) // YYYY-MM

      const { data: socios, error: sociosError } = await supabase
        .from('socios')
        .select('id')
        .eq('estado', 'activo')

      if (sociosError || !socios?.length) {
        toast.error('No se encontraron socios activos')
        return
      }

      const cuotas = socios.map(s => ({
        socio_id: s.id,
        periodo,
        monto_esperado: montoCuota,
        monto_pagado: 0,
        estado: 'pendiente',
      }))

      const { error } = await supabase.from('cuotas').insert(cuotas)

      if (error) {
        toast.error('Error al generar cuotas: ' + error.message)
        return
      }

      toast.success(`Cuotas generadas para ${socios.length} socios`)
    } catch {
      toast.error('Error al generar cuotas')
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Configuración de Cuotas</CardTitle>
        <CardDescription className="text-muted-foreground">
          Define el monto y vencimiento de las cuotas mensuales
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Monto de cuota mensual (ARS)</Label>
            <Input
              type="number"
              value={montoCuota}
              onChange={(e) => setMontoCuota(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Valor actual: {formatARS(montoCuota)}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Día de vencimiento</Label>
            <Input
              type="number"
              min={1}
              max={31}
              value={diaVencimiento}
              onChange={(e) => setDiaVencimiento(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Día del mes en que vencen las cuotas
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Guardar configuración
          </Button>

          <Button
            onClick={handleGenerarCuotas}
            variant="outline"
          >
            Generar cuotas del mes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Tab de Categorías
function CategoriasTab() {
  const [categorias, setCategorias] = useState<CategoriaFinanciera[]>([])
  const [loading, setLoading] = useState(true)
  const [newCategoria, setNewCategoria] = useState('')
  const [newTipo, setNewTipo] = useState<'ingreso' | 'egreso'>('egreso')

  const fetchCategorias = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await runWithRecovery(() => supabase
        .from('categorias_financieras')
        .select('*')
        .order('nombre'), {
          label: 'configuracion categorias',
        })

      if (error) throw error
      setCategorias(data as CategoriaFinanciera[])
    } catch (error) {
      console.error('Error fetching categorias:', error)
      toast.error('Error al cargar categorías')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCategorias()
  }, [fetchCategorias])
  useResumeRefresh(() => { void fetchCategorias() }, { throttleMs: 5_000 })

  const handleToggleActiva = async (id: string) => {
    const cat = categorias.find(c => c.id === id)
    if (!cat) return

    const { error } = await supabase
      .from('categorias_financieras')
      .update({ activa: !cat.activa })
      .eq('id', id)

    if (error) {
      toast.error('Error al actualizar estado')
      return
    }

    setCategorias(prev =>
      prev.map(c => c.id === id ? { ...c, activa: !c.activa } : c)
    )
    toast.success('Estado actualizado')
  }

  const handleAddCategoria = async () => {
    if (!newCategoria.trim()) return

    const { data, error } = await supabase
      .from('categorias_financieras')
      .insert([{ nombre: newCategoria, tipo: newTipo, activa: true }])
      .select()
      .single()

    if (error) {
      toast.error('Error al crear categoría')
      return
    }

    setCategorias(prev => [...prev, data as CategoriaFinanciera])
    setNewCategoria('')
    toast.success('Categoría creada')
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Categorías Financieras</CardTitle>
        <CardDescription className="text-muted-foreground">
          Administra las categorías para ingresos y egresos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-6">
          <Input
            placeholder="Nueva categoría..."
            value={newCategoria}
            onChange={(e) => setNewCategoria(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={newTipo}
            onChange={(e) => setNewTipo(e.target.value as 'ingreso' | 'egreso')}
            className="bg-card border border-border text-foreground rounded-lg px-3"
          >
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </select>
          <Button
            onClick={handleAddCategoria}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Agregar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Ingresos</h4>
              <div className="flex flex-wrap gap-2">
                {categorias
                  .filter(c => c.tipo === 'ingreso')
                  .map(c => (
                    <Badge
                      key={c.id}
                      className={cn(
                        'cursor-pointer transition-colors',
                        c.activa
                          ? 'bg-green-500/20 text-green-700 hover:bg-green-500/30'
                          : 'bg-gray-500/20 text-gray-500 hover:bg-gray-500/30'
                      )}
                      onClick={() => handleToggleActiva(c.id)}
                    >
                      {c.nombre}
                    </Badge>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Egresos</h4>
              <div className="flex flex-wrap gap-2">
                {categorias
                  .filter(c => c.tipo === 'egreso')
                  .map(c => (
                    <Badge
                      key={c.id}
                      className={cn(
                        'cursor-pointer transition-colors',
                        c.activa
                          ? 'bg-[#e50051]/20 text-[#e50051] hover:bg-[#e50051]/30'
                          : 'bg-gray-500/20 text-gray-500 hover:bg-gray-500/30'
                      )}
                      onClick={() => handleToggleActiva(c.id)}
                    >
                      {c.nombre}
                    </Badge>
                  ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Tab de Logs
function LogsTab() {
  const [logs, setLogs] = useState<LogActividad[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const pageSize = 20

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data, error } = await runWithRecovery(() => supabase
        .from('logs_actividad')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to), {
          label: 'configuracion logs',
        })

      if (error) throw error
      setLogs(data as LogActividad[])
    } catch (error) {
      console.error('Error fetching logs:', error)
      toast.error('Error al cargar logs')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])
  useResumeRefresh(() => { void fetchLogs() }, { throttleMs: 5_000 })

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Logs de Actividad</CardTitle>
        <CardDescription className="text-muted-foreground">
          Registro de todas las acciones realizadas en el sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Fecha/Hora</TableHead>
                <TableHead className="text-muted-foreground">Usuario</TableHead>
                <TableHead className="text-muted-foreground">Acción</TableHead>
                <TableHead className="text-muted-foreground">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow
                  key={log.id}
                  className="border-border hover:bg-muted/50"
                >
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateTime(log.created_at)}
                  </TableCell>
                  <TableCell className="text-foreground text-sm">
                    Usuario #{log.usuario_id}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-primary/20 text-primary border-0">
                      {log.accion}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {log.detalle}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {logs.length} registros
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
