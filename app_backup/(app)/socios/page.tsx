'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useSocios } from '@/hooks/useSocios'
import { hasPermission } from '@/lib/constants'
import { formatDate, getInitials, generateAvatarColor } from '@/lib/utils'
import { ESTADO_SOCIO_COLORS, ROL_COLORS } from '@/lib/constants'
import type { Socio, EstadoSocio } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Plus, MoreVertical, UserCheck, UserX, Edit, Eye, ChevronLeft, ChevronRight, Users } from 'lucide-react'

export default function SociosPage() {
  const router = useRouter()
  const { user } = useAuth()
  const {
    socios,
    totalSocios,
    totalPages,
    filters,
    setSearch,
    setEstado,
    setRolAile,
    setPage,
    toggleEstado,
    loading,
  } = useSocios()

  const [showNewModal, setShowNewModal] = useState(false)
  const [newSocio, setNewSocio] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    email: '',
    telefono: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
  })

  const canCreate = user && hasPermission(user.rol, 'socios', 'crear')
  const canEdit = user && hasPermission(user.rol, 'socios', 'editar')

  const handleToggleEstado = (id: string) => {
    toggleEstado(id)
  }

  const handleNewSocio = () => {
    // In a real app, this would create the socio
    setShowNewModal(false)
    setNewSocio({
      nombre: '',
      apellido: '',
      dni: '',
      email: '',
      telefono: '',
      fecha_ingreso: new Date().toISOString().split('T')[0],
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Socios</h1>
          <p className="text-[#7c6a94] mt-1">
            {totalSocios} socios registrados
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setShowNewModal(true)}
            className="bg-gradient-to-r from-[#6314a7] to-[#e50051] hover:from-[#7a1bc9] hover:to-[#ff1a6b] text-white border-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo socio
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total socios"
          value={totalSocios}
        />
        <StatCard
          icon={UserCheck}
          label="Activos"
          value={socios.filter(s => s.estado === 'activo').length}
          color="text-green-500"
        />
        <StatCard
          icon={UserX}
          label="Inactivos"
          value={socios.filter(s => s.estado === 'inactivo').length}
          color="text-gray-400"
        />
        <StatCard
          icon={Users}
          label="Con deuda"
          value={socios.filter(s => s.tiene_deuda).length}
          color="text-red-500"
        />
      </div>

      {/* Filters */}
      <Card className="bg-[#13121d] border-[#6314a7]/30">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7c6a94]" />
              <Input
                placeholder="Buscar por nombre, DNI o email..."
                value={filters.search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-[#0d0618] border-[#6314a7]/30 text-white placeholder:text-[#7c6a94] focus:border-[#9341bf] focus:ring-[#9341bf]/20"
              />
            </div>
            <div className="flex gap-4">
              <Select value={filters.estado} onValueChange={(v) => setEstado(v as EstadoSocio | 'todos')}>
                <SelectTrigger className="w-[140px] bg-[#0d0618] border-[#6314a7]/30 text-white">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1625] border-[#6314a7]/30">
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="inactivo">Inactivos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.rolAile} onValueChange={setRolAile}>
                <SelectTrigger className="w-[160px] bg-[#0d0618] border-[#6314a7]/30 text-white">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1625] border-[#6314a7]/30">
                  <SelectItem value="todos">Todos los roles</SelectItem>
                  <SelectItem value="Presidente">Presidente</SelectItem>
                  <SelectItem value="Vicepresidente">Vicepresidente</SelectItem>
                  <SelectItem value="Secretario">Secretario</SelectItem>
                  <SelectItem value="Tesorero">Tesorero</SelectItem>
                  <SelectItem value="Revisor de Cuentas">Revisor de Cuentas</SelectItem>
                  <SelectItem value="Vocal">Vocal</SelectItem>
                  <SelectItem value="Socio">Socio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Socios List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 bg-[#13121d]" />
          ))
        ) : socios.length === 0 ? (
          <Card className="bg-[#13121d] border-[#6314a7]/30">
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-[#6314a7] mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No se encontraron socios</h3>
              <p className="text-[#7c6a94]">
                Intenta ajustar los filtros de búsqueda
              </p>
            </CardContent>
          </Card>
        ) : (
          socios.map((socio) => (
            <SocioRow
              key={socio.id}
              socio={socio}
              canEdit={canEdit}
              onToggleEstado={handleToggleEstado}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#7c6a94]">
            Mostrando {(filters.page - 1) * 15 + 1} - {Math.min(filters.page * 15, totalSocios)} de {totalSocios}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(filters.page - 1)}
              disabled={filters.page === 1}
              className="border-[#6314a7]/30 text-white hover:bg-[#6314a7]/20 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-[#7c6a94] px-2">
              Página {filters.page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(filters.page + 1)}
              disabled={filters.page === totalPages}
              className="border-[#6314a7]/30 text-white hover:bg-[#6314a7]/20 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* New Socio Modal */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="bg-[#13121d] border-[#6314a7]/30 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo socio</DialogTitle>
            <DialogDescription className="text-[#7c6a94]">
              Completa los datos del nuevo socio
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-[#7c6a94]">Nombre</label>
                <Input
                  value={newSocio.nombre}
                  onChange={(e) => setNewSocio({ ...newSocio, nombre: e.target.value })}
                  className="bg-[#0d0618] border-[#6314a7]/30 text-white"
                  placeholder="Nombre"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-[#7c6a94]">Apellido</label>
                <Input
                  value={newSocio.apellido}
                  onChange={(e) => setNewSocio({ ...newSocio, apellido: e.target.value })}
                  className="bg-[#0d0618] border-[#6314a7]/30 text-white"
                  placeholder="Apellido"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#7c6a94]">DNI</label>
              <Input
                value={newSocio.dni}
                onChange={(e) => setNewSocio({ ...newSocio, dni: e.target.value })}
                className="bg-[#0d0618] border-[#6314a7]/30 text-white"
                placeholder="00.000.000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#7c6a94]">Email</label>
              <Input
                type="email"
                value={newSocio.email}
                onChange={(e) => setNewSocio({ ...newSocio, email: e.target.value })}
                className="bg-[#0d0618] border-[#6314a7]/30 text-white"
                placeholder="email@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#7c6a94]">Teléfono</label>
              <Input
                value={newSocio.telefono}
                onChange={(e) => setNewSocio({ ...newSocio, telefono: e.target.value })}
                className="bg-[#0d0618] border-[#6314a7]/30 text-white"
                placeholder="+54 ..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewModal(false)}
              className="border-[#6314a7]/30 text-white hover:bg-[#6314a7]/20"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleNewSocio}
              className="bg-gradient-to-r from-[#6314a7] to-[#e50051] hover:from-[#7a1bc9] hover:to-[#ff1a6b] text-white border-0"
            >
              Guardar socio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SocioRow({
  socio,
  canEdit,
  onToggleEstado,
}: {
  socio: Socio
  canEdit: boolean
  onToggleEstado: (id: string) => void
}) {
  const avatarColor = generateAvatarColor(socio.id)
  const estadoColors = ESTADO_SOCIO_COLORS[socio.estado] || ESTADO_SOCIO_COLORS.inactivo

  return (
    <Card className="bg-[#13121d] border-[#6314a7]/20 hover:border-[#6314a7]/40 transition-colors group">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <Avatar className={`w-12 h-12 bg-gradient-to-br ${avatarColor}`}>
            <AvatarFallback className="bg-transparent text-white font-semibold">
              {getInitials(socio.nombre, socio.apellido)}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/socios/${socio.id}`}
                className="font-medium text-white hover:text-[#9341bf] transition-colors"
              >
                {socio.apellido}, {socio.nombre}
              </Link>
              {socio.rol_aile && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-[#6314a7]/30 text-[#9341bf] bg-[#6314a7]/10"
                >
                  {socio.rol_aile}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-[#7c6a94]">
              <span>DNI: {socio.dni}</span>
              <span>•</span>
              <span>{socio.email}</span>
              <span>•</span>
              <span>Desde {formatDate(socio.fecha_ingreso)}</span>
            </div>
          </div>

          {/* Estado Badge */}
          <Badge
            className={`${estadoColors.bg} ${estadoColors.text} border-0 capitalize`}
          >
            {socio.estado}
          </Badge>

          {/* Debt Indicator */}
          {socio.tiene_deuda && (
            <Badge
              variant="outline"
              className="border-red-500/30 text-red-400 bg-red-500/10"
            >
              Con deuda
            </Badge>
          )}

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-[#7c6a94] hover:text-white hover:bg-[#6314a7]/20"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-[#1a1625] border-[#6314a7]/30"
            >
              <DropdownMenuItem asChild>
                <Link
                  href={`/socios/${socio.id}`}
                  className="text-white hover:text-[#9341bf] focus:text-[#9341bf] focus:bg-[#6314a7]/20 cursor-pointer"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver detalle
                </Link>
              </DropdownMenuItem>
              {canEdit && (
                <>
                  <DropdownMenuItem
                    onClick={() => onToggleEstado(socio.id)}
                    className="text-white hover:text-[#9341bf] focus:text-[#9341bf] focus:bg-[#6314a7]/20 cursor-pointer"
                  >
                    {socio.estado === 'activo' ? (
                      <>
                        <UserX className="w-4 h-4 mr-2" />
                        Desactivar
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Activar
                      </>
                    )}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = 'text-white',
}: {
  icon: React.ElementType
  label: string
  value: number
  color?: string
}) {
  return (
    <Card className="bg-[#13121d] border-[#6314a7]/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#6314a7]/10">
            <Icon className="w-5 h-5 text-[#9341bf]" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-white">{value}</p>
            <p className="text-xs text-[#7c6a94]">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
