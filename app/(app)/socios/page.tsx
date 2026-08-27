'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth, useRequirePermission } from '@/hooks/useAuth'
import { useSocios } from '@/hooks/useSocios'
import { useRoles } from '@/hooks/useRoles'
import { formatDate, getInitials, generateAvatarColor } from '@/lib/utils'
import { ESTADO_SOCIO_COLORS } from '@/lib/constants'
import { getSocioStatutoryStatus } from '@/lib/statutory'
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
import { Search, Plus, MoreVertical, UserCheck, UserX, Eye, ChevronLeft, ChevronRight, Users, Loader2, BookOpen } from 'lucide-react'

export default function SociosPage() {
  const { user, hasPermission } = useAuth()
  const { roles } = useRoles()
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
    updateSocio,
    refreshSocios,
  } = useSocios(canAccessSociosModule)

  const [showNewModal, setShowNewModal] = useState(false)
  const syncAttemptedRef = useRef(false)
  const canCreate = !!user && hasPermission('socios', 'crear')
  const canEdit = !!user && hasPermission('socios', 'editar')
  const [updatingRoleSocioId, setUpdatingRoleSocioId] = useState<string | null>(null)

  useEffect(() => {
    if (checkingAccess || !canAccessSociosModule || !canEdit || syncAttemptedRef.current) {
      return
    }

    syncAttemptedRef.current = true
    let cancelled = false

    void (async () => {
      try {
        const response = await fetch('/api/socios/sync-google-avatars', {
          method: 'POST',
        })

        if (!response.ok) {
          return
        }

        const result = await response.json() as { updated?: number }
        if (!cancelled && Number(result.updated || 0) > 0) {
          await refreshSocios({ silent: true })
        }
      } catch (error) {
        console.warn('No se pudieron sincronizar los avatares de socios', error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [canAccessSociosModule, checkingAccess, canEdit, refreshSocios])

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
        fecha_nacimiento: data.fecha_nacimiento || null,
        rol_aile: data.rol_aile,
        rol_aile_id: data.rol_aile_id,
      })
      setShowNewModal(false)
    } catch {
      // Error handled in hook
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta persona de la comunidad? Los datos históricos se mantendrán.')) {
      try {
        await deleteSocio(id)
      } catch {
        // Error already handled via toast in the hook
      }
    }
  }

  const handleQuickRoleChange = async (socio: Socio, roleId: string) => {
    if (!roleId || roleId === socio.rol_aile_id) return

    const selectedRole = roles.find((role) => role.id === roleId)
    if (!selectedRole) return

    setUpdatingRoleSocioId(socio.id)
    try {
      await updateSocio(socio.id, {
        rol_aile_id: selectedRole.id,
        rol_aile: selectedRole.nombre,
      })
    } catch {
      // Error handled in hook
    } finally {
      setUpdatingRoleSocioId((current) => (current === socio.id ? null : current))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Comunidad AILE</h1>
          <p className="text-muted-foreground mt-1">
            {totalSocios} personas vinculadas históricamente
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/socios/registro">
            <Button variant="outline" className="w-full sm:w-auto">
              <BookOpen className="w-4 h-4 mr-2" />
              Registro formal
            </Button>
          </Link>
          {canCreate && (
            <Button
              onClick={() => setShowNewModal(true)}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground border-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva persona
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Comunidad histórica"
          value={allSocios.length}
        />
        <StatCard
          icon={UserCheck}
          label="Vínculos operativos"
          value={allSocios.filter(s => s.estado === 'activo').length}
          color="text-green-500"
        />
        <StatCard
          icon={UserCheck}
          label="Padrón oficial"
          value={allSocios.filter(s => s.membresia_formal?.estado === 'activo').length}
          color="text-cyan-500"
        />
        <StatCard
          icon={Users}
          label="No asociados"
          value={allSocios.filter(s => !s.membresia_formal).length}
          color="text-slate-500"
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
                  {roles.map((rol) => (
                    <SelectItem key={rol.id} value={rol.nombre}>
                      {rol.nombre}
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
              <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron personas</h3>
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
              currentUserSocioId={user?.socio_id}
              currentUserAvatarUrl={user?.avatar_url}
              roles={roles}
              canEdit={canEdit}
              isUpdatingRole={updatingRoleSocioId === socio.id}
              onQuickRoleChange={handleQuickRoleChange}
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
  currentUserSocioId,
  currentUserAvatarUrl,
  roles,
  canEdit,
  isUpdatingRole,
  onQuickRoleChange,
  onToggleEstado,
  onDelete,
}: {
  socio: Socio
  currentUserSocioId?: string
  currentUserAvatarUrl?: string
  roles: Array<{ id: string; nombre: string }>
  canEdit: boolean
  isUpdatingRole: boolean
  onQuickRoleChange: (socio: Socio, roleId: string) => void
  onToggleEstado: (id: string) => void
  onDelete: (id: string) => void
}) {
  const avatarColor = generateAvatarColor(socio.id)
  const estadoColors = ESTADO_SOCIO_COLORS[socio.estado] || ESTADO_SOCIO_COLORS.inactivo
  const resolvedAvatarUrl = socio.avatar_url || (currentUserSocioId === socio.id ? currentUserAvatarUrl : undefined)
  const cardClassName = socio.estado === 'inactivo'
    ? 'bg-muted/35 border-border hover:border-primary/20'
    : 'bg-card border-border hover:border-primary/30'
  const selectedRoleId = socio.rol_aile_id || roles.find((role) => role.nombre === socio.rol_aile)?.id || ''
  const statutoryStatus = getSocioStatutoryStatus(socio)

  return (
    <Card className={`${cardClassName} transition-colors group`}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <Avatar className={`w-12 h-12 bg-gradient-to-br ${avatarColor}`}>
              <AvatarImage
                src={resolvedAvatarUrl}
                alt={`${socio.nombre} ${socio.apellido}`}
                className="object-cover"
              />
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
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedRoleId}
                      onValueChange={(value) => onQuickRoleChange(socio, value)}
                      disabled={isUpdatingRole}
                    >
                      <SelectTrigger className="h-7 w-auto min-w-[140px] rounded-full border-primary/30 bg-primary/10 px-3 text-[10px] font-medium text-primary shadow-none">
                        <SelectValue placeholder="Rol" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isUpdatingRole ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
                  </div>
                ) : socio.rol_aile ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-primary/30 text-primary bg-primary/10"
                  >
                    {socio.rol_aile}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                <span className="whitespace-nowrap">DNI: {socio.dni}</span>
                <span className="hidden sm:inline text-muted-foreground/60">•</span>
                <span className="break-all sm:break-normal">{socio.email}</span>
                <span className="hidden sm:inline text-muted-foreground/60">•</span>
                <span className="whitespace-nowrap">Desde {formatDate(socio.fecha_ingreso)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {statutoryStatus.isFormalMember ? (
                  <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-600">
                    {statutoryStatus.categoriaLabel} · N.º {socio.membresia_formal?.numero_asociado}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-slate-400/30 bg-slate-100 text-slate-600">
                    No integra el padrón legal
                  </Badge>
                )}
                {statutoryStatus.canVote && (
                  <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-600">
                    Derecho a voto
                  </Badge>
                )}
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
            <Icon className={`w-5 h-5 ${color === 'text-foreground' ? 'text-primary' : color}`} />
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
