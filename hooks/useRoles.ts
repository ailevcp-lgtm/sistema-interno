import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { runWithRecovery } from '@/lib/async-recovery'
import { useResumeRefresh } from '@/hooks/useResumeRefresh'
import {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  ROLE_PERMISSIONS_UPDATED_EVENT,
  normalizeInstitutionalRole,
} from '@/lib/constants'
import type { Accion, Recurso } from '@/lib/types'

export type RolAileDefinition = {
  id: string
  nombre: string
}

export type RolePermissionOverride = {
  id: string
  rol_aile_definition_id: string
  recurso: Recurso
  accion: Accion
  permitido: boolean
}

export type RolePermissionMatrix = Record<Recurso, Record<Accion, boolean>>
export type RoleTaskScopeMode = 'own_direction' | 'all_directions'

export type RoleTaskScopeOverride = {
  id: string
  rol_aile_definition_id: string
  scope_mode: RoleTaskScopeMode
  allow_assigned_cross_direction: boolean
}

export type RoleTaskScopeSettings = {
  scopeMode: RoleTaskScopeMode
  allowAssignedCrossDirection: boolean
}

type RolePermissionOverridesById = Record<string, Partial<Record<Recurso, Partial<Record<Accion, boolean>>>>>
type RolePermissionOverridesByName = Record<string, Partial<Record<Recurso, Partial<Record<Accion, boolean>>>>>
type RoleTaskScopeOverridesById = Record<string, RoleTaskScopeSettings>

const DEFAULT_ROLE_TASK_SCOPE_SETTINGS: RoleTaskScopeSettings = {
  scopeMode: 'own_direction',
  allowAssignedCrossDirection: true,
}

function buildEmptyPermissionMatrix(defaultValue = false): RolePermissionMatrix {
  const matrix = {} as RolePermissionMatrix

  for (const recurso of PERMISSION_RESOURCES) {
    matrix[recurso] = {} as Record<Accion, boolean>
    for (const accion of PERMISSION_ACTIONS) {
      matrix[recurso][accion] = defaultValue
    }
  }

  return matrix
}

export function useRoles() {
  const [roles, setRoles] = useState<RolAileDefinition[]>([])
  const [permissionOverrides, setPermissionOverrides] = useState<RolePermissionOverride[]>([])
  const [taskScopeOverrides, setTaskScopeOverrides] = useState<RoleTaskScopeOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [permissionsLoading, setPermissionsLoading] = useState(true)
  const [taskScopeLoading, setTaskScopeLoading] = useState(true)

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await runWithRecovery(
        () => supabase.from('rol_aile_definitions').select('*').order('nombre'),
        { label: 'roles institucionales' }
      )

      if (error) throw error
      setRoles((data || []) as RolAileDefinition[])
    } catch (error) {
      console.error('Error fetching roles:', error)
      toast.error('Error al cargar los roles')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPermissionOverrides = useCallback(async () => {
    try {
      setPermissionsLoading(true)
      const { data, error } = await runWithRecovery(
        () => supabase
          .from('role_permission_overrides')
          .select('id, rol_aile_definition_id, recurso, accion, permitido')
          .order('rol_aile_definition_id')
          .order('recurso')
          .order('accion'),
        { label: 'overrides de permisos por rol' }
      )

      if (error) throw error
      setPermissionOverrides(((data || []) as RolePermissionOverride[]))
    } catch (error) {
      console.error('Error fetching role permission overrides:', error)
      toast.error('Error al cargar permisos por rol')
    } finally {
      setPermissionsLoading(false)
    }
  }, [])

  const fetchRoleTaskScopeOverrides = useCallback(async () => {
    try {
      setTaskScopeLoading(true)
      const { data, error } = await runWithRecovery(
        () => supabase
          .from('role_task_scope_overrides')
          .select('id, rol_aile_definition_id, scope_mode, allow_assigned_cross_direction')
          .order('rol_aile_definition_id'),
        { label: 'alcance de tareas por rol' }
      )

      if (error) throw error
      setTaskScopeOverrides((data || []) as RoleTaskScopeOverride[])
    } catch (error) {
      console.error('Error fetching role task scope overrides:', error)
      toast.error('Error al cargar alcance de tareas por rol')
    } finally {
      setTaskScopeLoading(false)
    }
  }, [])

  const saveRolePermissions = useCallback(async (roleId: string, matrix: RolePermissionMatrix) => {
    try {
      const payload = PERMISSION_RESOURCES.flatMap((recurso) =>
        PERMISSION_ACTIONS.map((accion) => ({
          rol_aile_definition_id: roleId,
          recurso,
          accion,
          permitido: Boolean(matrix[recurso]?.[accion]),
        }))
      )

      const { error } = await supabase
        .from('role_permission_overrides')
        .upsert(payload, { onConflict: 'rol_aile_definition_id,recurso,accion' })

      if (error) throw error

      await fetchPermissionOverrides()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(ROLE_PERMISSIONS_UPDATED_EVENT))
      }
      toast.success('Permisos del rol actualizados')
    } catch (error) {
      console.error('Error saving role permissions:', error)
      toast.error('Error al guardar permisos del rol')
      throw error
    }
  }, [fetchPermissionOverrides])

  const resetRolePermissions = useCallback(async (roleId: string) => {
    try {
      const { error } = await supabase
        .from('role_permission_overrides')
        .delete()
        .eq('rol_aile_definition_id', roleId)

      if (error) throw error

      setPermissionOverrides((prev) => prev.filter((row) => row.rol_aile_definition_id !== roleId))
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(ROLE_PERMISSIONS_UPDATED_EVENT))
      }
      toast.success('Permisos restablecidos a la configuracion base')
    } catch (error) {
      console.error('Error resetting role permissions:', error)
      toast.error('Error al restablecer permisos del rol')
      throw error
    }
  }, [])

  const saveRoleTaskScope = useCallback(async (roleId: string, settings: RoleTaskScopeSettings) => {
    try {
      const { error } = await supabase
        .from('role_task_scope_overrides')
        .upsert({
          rol_aile_definition_id: roleId,
          scope_mode: settings.scopeMode,
          allow_assigned_cross_direction: settings.allowAssignedCrossDirection,
        }, { onConflict: 'rol_aile_definition_id' })

      if (error) throw error

      await fetchRoleTaskScopeOverrides()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(ROLE_PERMISSIONS_UPDATED_EVENT))
      }
      toast.success('Alcance de tareas actualizado')
    } catch (error) {
      console.error('Error saving role task scope:', error)
      toast.error('Error al guardar alcance de tareas')
      throw error
    }
  }, [fetchRoleTaskScopeOverrides])

  const resetRoleTaskScope = useCallback(async (roleId: string) => {
    try {
      const { error } = await supabase
        .from('role_task_scope_overrides')
        .delete()
        .eq('rol_aile_definition_id', roleId)

      if (error) throw error

      setTaskScopeOverrides((prev) => prev.filter((row) => row.rol_aile_definition_id !== roleId))
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(ROLE_PERMISSIONS_UPDATED_EVENT))
      }
      toast.success('Alcance de tareas restablecido')
    } catch (error) {
      console.error('Error resetting role task scope:', error)
      toast.error('Error al restablecer alcance de tareas')
      throw error
    }
  }, [])

  const addRole = async (nombre: string) => {
    try {
      const { data, error } = await supabase
        .from('rol_aile_definitions')
        .insert([{ nombre }])
        .select()
        .single()

      if (error) throw error

      setRoles((prev) => [...prev, data as RolAileDefinition].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      toast.success('Rol creado exitosamente')
      return data
    } catch (error) {
      console.error('Error adding role:', error)
      toast.error('Error al crear el rol')
      throw error
    }
  }

  const updateRole = async (id: string, nombre: string) => {
    try {
      const { data, error } = await supabase
        .from('rol_aile_definitions')
        .update({ nombre })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setRoles((prev) => prev.map((r) => (r.id === id ? (data as RolAileDefinition) : r)).sort((a, b) => a.nombre.localeCompare(b.nombre)))
      toast.success('Rol actualizado exitosamente')
      return data
    } catch (error) {
      console.error('Error updating role:', error)
      toast.error('Error al actualizar el rol')
      throw error
    }
  }

  const deleteRole = async (id: string) => {
    try {
      const { error } = await supabase
        .from('rol_aile_definitions')
        .delete()
        .eq('id', id)

      if (error) throw error

      setRoles((prev) => prev.filter((r) => r.id !== id))
      setPermissionOverrides((prev) => prev.filter((row) => row.rol_aile_definition_id !== id))
      setTaskScopeOverrides((prev) => prev.filter((row) => row.rol_aile_definition_id !== id))
      toast.success('Rol eliminado exitosamente')
    } catch (error: unknown) {
      const safeError = error as { code?: string; message?: string } | null
      console.error('Error deleting role:', error)
      if (safeError?.code === '23503') {
        toast.error('No se puede eliminar el rol porque hay usuarios asignados. Por favor, reasigne los usuarios o ejecute la migracion 017.')
      } else {
        toast.error(`Error al eliminar el rol: ${safeError?.message || 'Error desconocido'}`)
      }
      throw error
    }
  }

  const permissionOverridesByRoleId = useMemo<RolePermissionOverridesById>(() => {
    const map: RolePermissionOverridesById = {}

    for (const row of permissionOverrides) {
      map[row.rol_aile_definition_id] ||= {}
      map[row.rol_aile_definition_id]![row.recurso] ||= {}
      map[row.rol_aile_definition_id]![row.recurso]![row.accion] = row.permitido
    }

    return map
  }, [permissionOverrides])

  const permissionOverridesByRoleName = useMemo<RolePermissionOverridesByName>(() => {
    const roleNameById = new Map(roles.map((role) => [role.id, role.nombre]))
    const map: RolePermissionOverridesByName = {}

    for (const row of permissionOverrides) {
      const roleName = roleNameById.get(row.rol_aile_definition_id)
      if (!roleName) continue

      const normalizedName = normalizeInstitutionalRole(roleName)
      if (!normalizedName) continue

      map[normalizedName] ||= {}
      map[normalizedName]![row.recurso] ||= {}
      map[normalizedName]![row.recurso]![row.accion] = row.permitido
    }

    return map
  }, [permissionOverrides, roles])

  const roleTaskScopeOverridesByRoleId = useMemo<RoleTaskScopeOverridesById>(() => {
    const map: RoleTaskScopeOverridesById = {}

    for (const row of taskScopeOverrides) {
      map[row.rol_aile_definition_id] = {
        scopeMode: row.scope_mode,
        allowAssignedCrossDirection: row.allow_assigned_cross_direction,
      }
    }

    return map
  }, [taskScopeOverrides])

  const getRoleMatrix = useCallback((roleId: string): RolePermissionMatrix => {
    const roleOverrides = permissionOverridesByRoleId[roleId]
    const matrix = buildEmptyPermissionMatrix(false)

    for (const recurso of PERMISSION_RESOURCES) {
      for (const accion of PERMISSION_ACTIONS) {
        matrix[recurso][accion] = roleOverrides?.[recurso]?.[accion] ?? false
      }
    }

    return matrix
  }, [permissionOverridesByRoleId])

  const getRoleTaskScope = useCallback((roleId: string): RoleTaskScopeSettings => {
    return roleTaskScopeOverridesByRoleId[roleId] || DEFAULT_ROLE_TASK_SCOPE_SETTINGS
  }, [roleTaskScopeOverridesByRoleId])

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchRoles(), fetchPermissionOverrides(), fetchRoleTaskScopeOverrides()])
  }, [fetchPermissionOverrides, fetchRoleTaskScopeOverrides, fetchRoles])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])
  useResumeRefresh(() => { void refreshAll() }, { throttleMs: 5_000 })

  return {
    roles,
    permissionOverrides,
    taskScopeOverrides,
    permissionOverridesByRoleId,
    permissionOverridesByRoleName,
    roleTaskScopeOverridesByRoleId,
    loading,
    permissionsLoading,
    taskScopeLoading,
    fetchRoles,
    fetchPermissionOverrides,
    fetchRoleTaskScopeOverrides,
    refreshAll,
    addRole,
    updateRole,
    deleteRole,
    saveRolePermissions,
    resetRolePermissions,
    saveRoleTaskScope,
    resetRoleTaskScope,
    getRoleMatrix,
    getRoleTaskScope,
  }
}
