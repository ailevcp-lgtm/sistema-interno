'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth, useRequirePermission } from '@/hooks/useAuth'
import { useSocios } from '@/hooks/useSocios'
import { formatDate, getInitials, generateAvatarColor } from '@/lib/utils'
import { ESTADO_SOCIO_COLORS, ROL_COLORS, ROLES_AILE } from '@/lib/constants'
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
import { SocioDialog } from '@/components/aile/socio-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Plus, MoreVertical, UserCheck, UserX, Edit, Eye, ChevronLeft, ChevronRight, Users } from 'lucide-react'

export default function SociosPage() {
  const router = useRouter()
  const { user, hasPermission } = useAuth()
  const { loading: checkingAccess, hasPermission: canAccessSociosModule } = useRequirePermission('socios', 'ver', '/dashboard')
  const {
    socios,
    allSocios,
    totalSocios,
    totalPages,
    filters,
    setSearch,
    setEstado,
    setRolAile,
    setPage,
    toggleEstado,
    deleteSocio,
    loading,
    createSocio,
    uploadAvatar,
  } = useSocios(canAccessSociosModule)

  const [showNewModal, setShowNewModal] = useState(false)

  if (checkingAccess) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Validando permisos...
      </div>
    )
  }

  if (!canAccessSociosModule) {
    return null
  }

  const canCreate = !!user && hasPermission('socios', 'crear')
  const canEdit = !!user && hasPermission('socios', 'editar')

  const handleToggleEstado = async (id: string) => {
    try {
      await toggleEstado(id)
    } catch {
      // Error already handled via toast in the hook
    }
  }

  const handleNewSocio = async (data: Partial<Socio>) => {
    try {
      if (!data.nombre || !data.apellido || !data.dni || !data.email || !data.fecha_ingreso) {
        return
      }

      await createSocio({
        nombre: data.nombre,
        apellido: data.apellido,
        dni: data.dni,
        email: data.email,
        telefono: data.telefono || '',
        fecha_ingreso: data.fecha_ingreso,
        estado: data.estado || 'activo',
        avatar_url: data.avatar_url,
        rol_aile: data.rol_aile,
        rol_aile_id: data.rol_aile_id,
      })
      setShowNewModal(false)
    } catch {
      // Error handled in hook
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este socio? Esta acción lo ocultará de la lista principal pero los datos históricos se mantendrán.')) {
      try {
        await deleteSocio(id)
      } catch {
        // Error already handled via toast in the hook
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Socios</h1>
          <p className="text-muted-foreground mt-1">
            {totalSocios} socios registrados
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setShowNewModal(true)}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground border-0"
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
          value={allSocios.length}
        />
        <StatCard
          icon={UserCheck}
          label="Activos"
          value={allSocios.filter(s => s.estado === 'activo').length}
          color="text-green-500"
        />
        <StatCard
          icon={UserX}
          label="Inactivos"
          value={allSocios.filter(s => s.estado === 'inactivo').length}
          color="text-gray-400"
        />
        <StatCard
          icon={Users}
          label="Con deuda"
          value={allSocios.filter(s => s.tiene_deuda).length}
          color="text-red-500"
        />
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, DNI o email..."
                value={filters.search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <Select value={filters.estado} onValueChange={(v) => setEstado(v as EstadoSocio | 'todos')}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="inactivo">Inactivos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.rolAile} onValueChange={setRolAile}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los roles</SelectItem>
                  {ROLES_AILE.map((rol) => (
                    <SelectItem key={rol} value={rol}>
                      {rol}
                    </SelectItem>
                  ))}
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
            <Skeleton key={i} className="h-20" />
          ))
        ) : socios.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron socios</h3>
              <p className="text-muted-foreground">
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
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(filters.page - 1) * 15 + 1} - {Math.min(filters.page * 15, totalSocios)} de {totalSocios}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(filters.page - 1)}
              disabled={filters.page === 1}
              className="disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Página {filters.page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(filters.page + 1)}
              disabled={filters.page === totalPages}
              className="disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* New Socio Modal */}
      <SocioDialog
        open={showNewModal}
        onOpenChange={setShowNewModal}
        onSave={handleNewSocio}
        onUploadAvatar={uploadAvatar}
      />
    </div>
  )
}

function SocioRow({
  socio,
  canEdit,
  onToggleEstado,
  onDelete,
}: {
  socio: Socio
  canEdit: boolean
  onToggleEstado: (id: string) => void
  onDelete: (id: string) => void
}) {
  const avatarColor = generateAvatarColor(socio.id)
  const estadoColors = ESTADO_SOCIO_COLORS[socio.estado] || ESTADO_SOCIO_COLORS.inactivo

  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-colors group">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <Avatar className={`w-12 h-12 bg-gradient-to-br ${avatarColor}`}>
              <AvatarImage src={socio.avatar_url} />
              <AvatarFallback className="bg-transparent text-white font-semibold">
                {getInitials(socio.nombre, socio.apellido)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/socios/${socio.id}`}
                  className="font-medium text-foreground hover:text-primary transition-colors"
                >
                  {socio.apellido}, {socio.nombre}
                </Link>
                {socio.rol_aile && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-primary/30 text-primary bg-primary/10"
                  >
                    {socio.rol_aile}
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                <span className="whitespace-nowrap">DNI: {socio.dni}</span>
                <span className="hidden sm:inline text-muted-foreground/60">•</span>
                <span className="break-all sm:break-normal">{socio.email}</span>
                <span className="hidden sm:inline text-muted-foreground/60">•</span>
                <span className="whitespace-nowrap">Desde {formatDate(socio.fecha_ingreso)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <div className="flex items-center gap-2">
              <Badge
                className={`${estadoColors.bg} ${estadoColors.text} border-0 capitalize`}
              >
                {socio.estado}
              </Badge>

              {socio.tiene_deuda && (
                <Badge
                  variant="outline"
                  className="border-red-500/30 text-red-400 bg-red-500/10"
                >
                  Con deuda
                </Badge>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link
                    href={`/socios/${socio.id}`}
                    className="cursor-pointer"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver detalle
                  </Link>
                </DropdownMenuItem>
                {canEdit && (
                  <>
                    <DropdownMenuItem
                      onClick={() => onDelete(socio.id)}
                      className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                    >
                      <UserX className="w-4 h-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onToggleEstado(socio.id)}
                      className="cursor-pointer"
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
        </div>
      </CardContent>
    </Card>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = 'text-foreground',
}: {
  icon: React.ElementType
  label: string
  value: number
  color?: string
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-semibold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
