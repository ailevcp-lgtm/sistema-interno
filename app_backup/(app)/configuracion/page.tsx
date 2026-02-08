'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  Wallet,
  Tags,
  Activity,
  Loader2,
  Save,
  Search,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react'
import { cn, formatARS, formatDateTime } from '@/lib/utils'
import { useAuth, useRequirePermission } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ROL_LABELS,
  ROL_COLORS,
  DEFAULT_CATEGORIAS_INGRESOS,
  DEFAULT_CATEGORIAS_EGRESOS,
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

export default function ConfiguracionPage() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  
  // Redirect if not admin
  useRequirePermission('configuracion', 'ver', '/dashboard')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Configuración</h1>
        <p className="text-[#7c6a94]">
          Gestiona roles, cuotas, categorías y visualiza logs del sistema
        </p>
      </div>

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList className="bg-[#1a0f2e] border border-[rgba(99,20,167,0.2)]">
          <TabsTrigger 
            value="roles" 
            className="data-[state=active]:bg-[#6314a7] data-[state=active]:text-white"
          >
            <Users className="w-4 h-4 mr-2" />
            Roles
          </TabsTrigger>
          <TabsTrigger 
            value="cuotas"
            className="data-[state=active]:bg-[#6314a7] data-[state=active]:text-white"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Cuotas
          </TabsTrigger>
          <TabsTrigger 
            value="categorias"
            className="data-[state=active]:bg-[#6314a7] data-[state=active]:text-white"
          >
            <Tags className="w-4 h-4 mr-2" />
            Categorías
          </TabsTrigger>
          <TabsTrigger 
            value="logs"
            className="data-[state=active]:bg-[#6314a7] data-[state=active]:text-white"
          >
            <Activity className="w-4 h-4 mr-2" />
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
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
function RolesTab() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null)
  const [newRole, setNewRole] = useState<Rol>('socio')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchUsuarios()
  }, [])

  const fetchUsuarios = async () => {
    try {
      setLoading(true)
      // Mock data - en producción vendría de Supabase
      const mockUsers: Usuario[] = [
        { id: '1', email: 'admin@aile.org', nombre: 'Admin', apellido: 'Sistema', rol: 'admin' },
        { id: '2', email: 'presidente@aile.org', nombre: 'Juan', apellido: 'Pérez', rol: 'comision_directiva' },
        { id: '3', email: 'revisor@aile.org', nombre: 'María', apellido: 'García', rol: 'revisor_cuentas' },
        { id: '4', email: 'socio1@aile.org', nombre: 'Carlos', apellido: 'López', rol: 'socio' },
      ]
      setUsuarios(mockUsers)
    } catch (error) {
      console.error('Error fetching usuarios:', error)
      toast.error('Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async () => {
    if (!selectedUser) return
    
    setIsSaving(true)
    try {
      // En producción: actualizar en Supabase
      setUsuarios(prev => 
        prev.map(u => u.id === selectedUser.id ? { ...u, rol: newRole } : u)
      )
      toast.success(`Rol actualizado correctamente`)
      setIsDialogOpen(false)
    } catch (error) {
      toast.error('Error al actualizar el rol')
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
    <Card className="bg-[#1a0f2e] border-[rgba(99,20,167,0.2)]">
      <CardHeader>
        <CardTitle className="text-white">Gestión de Roles</CardTitle>
        <CardDescription className="text-[#7c6a94]">
          Administra los roles de los usuarios del sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7c6a94]" />
            <Input
              placeholder="Buscar usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-[#0d0618] border-[rgba(99,20,167,0.3)] text-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#6314a7]" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-[rgba(99,20,167,0.2)] hover:bg-transparent">
                <TableHead className="text-[#7c6a94]">Usuario</TableHead>
                <TableHead className="text-[#7c6a94]">Email</TableHead>
                <TableHead className="text-[#7c6a94]">Rol Actual</TableHead>
                <TableHead className="text-[#7c6a94]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((usuario) => (
                <TableRow 
                  key={usuario.id} 
                  className="border-[rgba(99,20,167,0.1)] hover:bg-[rgba(99,20,167,0.1)]"
                >
                  <TableCell className="text-white">
                    {usuario.nombre} {usuario.apellido}
                  </TableCell>
                  <TableCell className="text-[#a899b8]">{usuario.email}</TableCell>
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
                        setIsDialogOpen(true)
                      }}
                      className="bg-[#0d0618] border-[rgba(99,20,167,0.3)] text-white hover:bg-[rgba(99,20,167,0.2)]"
                    >
                      Cambiar rol
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-[#1a0f2e] border-[rgba(99,20,167,0.3)]">
            <DialogHeader>
              <DialogTitle className="text-white">Cambiar Rol</DialogTitle>
              <DialogDescription className="text-[#7c6a94]">
                Cambiar el rol de {selectedUser?.nombre} {selectedUser?.apellido}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Label className="text-[#a899b8]">Selecciona el nuevo rol</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['socio', 'comision_directiva', 'revisor_cuentas', 'admin'] as Rol[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setNewRole(r)}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-colors',
                      newRole === r
                        ? 'border-[#6314a7] bg-[rgba(99,20,167,0.2)]'
                        : 'border-[rgba(99,20,167,0.3)] hover:border-[rgba(99,20,167,0.5)]'
                    )}
                  >
                    <span className={cn(
                      'text-sm font-medium',
                      newRole === r ? 'text-white' : 'text-[#a899b8]'
                    )}>
                      {ROL_LABELS[r]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="bg-[#0d0618] border-[rgba(99,20,167,0.3)] text-white"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRoleChange}
                disabled={isSaving}
                className="bg-[#6314a7] hover:bg-[#9341bf] text-white"
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
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    // En producción: guardar en Supabase
    setTimeout(() => {
      toast.success('Configuración de cuotas guardada')
      setIsSaving(false)
    }, 1000)
  }

  const handleGenerarCuotas = async () => {
    // En producción: generar cuotas para todos los socios
    toast.success('Cuotas generadas correctamente')
  }

  return (
    <Card className="bg-[#1a0f2e] border-[rgba(99,20,167,0.2)]">
      <CardHeader>
        <CardTitle className="text-white">Configuración de Cuotas</CardTitle>
        <CardDescription className="text-[#7c6a94]">
          Define el monto y vencimiento de las cuotas mensuales
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[#a899b8]">Monto de cuota mensual (ARS)</Label>
            <Input
              type="number"
              value={montoCuota}
              onChange={(e) => setMontoCuota(Number(e.target.value))}
              className="bg-[#0d0618] border-[rgba(99,20,167,0.3)] text-white"
            />
            <p className="text-xs text-[#5a4a6e]">
              Valor actual: {formatARS(montoCuota)}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-[#a899b8]">Día de vencimiento</Label>
            <Input
              type="number"
              min={1}
              max={31}
              value={diaVencimiento}
              onChange={(e) => setDiaVencimiento(Number(e.target.value))}
              className="bg-[#0d0618] border-[rgba(99,20,167,0.3)] text-white"
            />
            <p className="text-xs text-[#5a4a6e]">
              Día del mes en que vencen las cuotas
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#6314a7] hover:bg-[#9341bf] text-white"
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
            className="bg-[#0d0618] border-[rgba(99,20,167,0.3)] text-white hover:bg-[rgba(99,20,167,0.2)]"
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

  useEffect(() => {
    fetchCategorias()
  }, [])

  const fetchCategorias = async () => {
    try {
      setLoading(true)
      // En producción: cargar desde Supabase
      const mockCategorias: CategoriaFinanciera[] = [
        ...DEFAULT_CATEGORIAS_INGRESOS.map((nombre, i) => ({
          id: `ing-${i}`,
          nombre,
          tipo: 'ingreso' as const,
          activa: true,
        })),
        ...DEFAULT_CATEGORIAS_EGRESOS.map((nombre, i) => ({
          id: `egr-${i}`,
          nombre,
          tipo: 'egreso' as const,
          activa: true,
        })),
      ]
      setCategorias(mockCategorias)
    } catch (error) {
      console.error('Error fetching categorias:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActiva = async (id: string) => {
    setCategorias(prev =>
      prev.map(c => c.id === id ? { ...c, activa: !c.activa } : c)
    )
    toast.success('Estado actualizado')
  }

  const handleAddCategoria = async () => {
    if (!newCategoria.trim()) return
    
    const nueva: CategoriaFinanciera = {
      id: `new-${Date.now()}`,
      nombre: newCategoria,
      tipo: newTipo,
      activa: true,
    }
    
    setCategorias(prev => [...prev, nueva])
    setNewCategoria('')
    toast.success('Categoría creada')
  }

  return (
    <Card className="bg-[#1a0f2e] border-[rgba(99,20,167,0.2)]">
      <CardHeader>
        <CardTitle className="text-white">Categorías Financieras</CardTitle>
        <CardDescription className="text-[#7c6a94]">
          Administra las categorías para ingresos y egresos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-6">
          <Input
            placeholder="Nueva categoría..."
            value={newCategoria}
            onChange={(e) => setNewCategoria(e.target.value)}
            className="max-w-xs bg-[#0d0618] border-[rgba(99,20,167,0.3)] text-white"
          />
          <select
            value={newTipo}
            onChange={(e) => setNewTipo(e.target.value as 'ingreso' | 'egreso')}
            className="bg-[#0d0618] border border-[rgba(99,20,167,0.3)] text-white rounded-lg px-3"
          >
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </select>
          <Button
            onClick={handleAddCategoria}
            className="bg-[#6314a7] hover:bg-[#9341bf] text-white"
          >
            Agregar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#6314a7]" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-[#a899b8] mb-2">Ingresos</h4>
              <div className="flex flex-wrap gap-2">
                {categorias
                  .filter(c => c.tipo === 'ingreso')
                  .map(c => (
                    <Badge
                      key={c.id}
                      className={cn(
                        'cursor-pointer transition-colors',
                        c.activa
                          ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                          : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                      )}
                      onClick={() => handleToggleActiva(c.id)}
                    >
                      {c.nombre}
                    </Badge>
                  ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-[#a899b8] mb-2">Egresos</h4>
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
                          : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
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

  useEffect(() => {
    fetchLogs()
  }, [page])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      // En producción: cargar desde Supabase
      const mockLogs: LogActividad[] = [
        {
          id: '1',
          usuario_id: '1',
          accion: 'Cambio de rol',
          detalle: 'Cambiado rol de socio a comision_directiva',
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          usuario_id: '2',
          accion: 'Registro de pago',
          detalle: 'Pago registrado: $5,000.00',
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ]
      setLogs(mockLogs)
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-[#1a0f2e] border-[rgba(99,20,167,0.2)]">
      <CardHeader>
        <CardTitle className="text-white">Logs de Actividad</CardTitle>
        <CardDescription className="text-[#7c6a94]">
          Registro de todas las acciones realizadas en el sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#6314a7]" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-[rgba(99,20,167,0.2)] hover:bg-transparent">
                <TableHead className="text-[#7c6a94]">Fecha/Hora</TableHead>
                <TableHead className="text-[#7c6a94]">Usuario</TableHead>
                <TableHead className="text-[#7c6a94]">Acción</TableHead>
                <TableHead className="text-[#7c6a94]">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow 
                  key={log.id} 
                  className="border-[rgba(99,20,167,0.1)] hover:bg-[rgba(99,20,167,0.1)]"
                >
                  <TableCell className="text-[#a899b8] text-sm">
                    {formatDateTime(log.created_at)}
                  </TableCell>
                  <TableCell className="text-white text-sm">
                    Usuario #{log.usuario_id}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-[#6314a7]/20 text-[#9341bf] border-0">
                      {log.accion}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[#a899b8] text-sm">
                    {log.detalle}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-[#5a4a6e]">
            Mostrando {logs.length} registros
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="bg-[#0d0618] border-[rgba(99,20,167,0.3)] text-white"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              className="bg-[#0d0618] border-[rgba(99,20,167,0.3)] text-white"
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
