import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database } from '@/lib/database.types'
import { toast } from 'sonner'

export type RolAileDefinition = {
    id: string
    nombre: string
}

export function useRoles() {
    const [roles, setRoles] = useState<RolAileDefinition[]>([])
    const [loading, setLoading] = useState(true)

    const fetchRoles = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('rol_aile_definitions')
                .select('*')
                .order('nombre')

            if (error) {
                throw error
            }

            setRoles(data || [])
        } catch (error) {
            console.error('Error fetching roles:', error)
            toast.error('Error al cargar los roles')
        } finally {
            setLoading(false)
        }
    }

    const addRole = async (nombre: string) => {
        try {
            const { data, error } = await supabase
                .from('rol_aile_definitions')
                .insert([{ nombre }])
                .select()
                .single()

            if (error) throw error

            setRoles(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
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

            setRoles(prev => prev.map(r => r.id === id ? data : r).sort((a, b) => a.nombre.localeCompare(b.nombre)))
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

            setRoles(prev => prev.filter(r => r.id !== id))
            toast.success('Rol eliminado exitosamente')
        } catch (error: any) {
            console.error('Error deleting role:', error)
            // Postgres error 23503 is foreign_key_violation
            if (error?.code === '23503') {
                toast.error('No se puede eliminar el rol porque hay usuarios asignados. Por favor, reasigne los usuarios o ejecute la migración 017.')
            } else {
                toast.error(`Error al eliminar el rol: ${error.message || 'Error desconocido'}`)
            }
            throw error
        }
    }

    // Initial fetch
    useEffect(() => {
        fetchRoles()
    }, [])

    return {
        roles,
        loading,
        fetchRoles,
        addRole,
        updateRole,
        deleteRole
    }
}
