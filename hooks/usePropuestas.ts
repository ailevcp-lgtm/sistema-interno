import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Propuesta, EstadoPropuesta } from '@/lib/types'

export function usePropuestas() {
  const getPropuestas = useCallback(async () => {
    const { data, error } = await supabase
      .from('propuestas')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching propuestas:', error)
      throw error
    }

    return (data || []) as Propuesta[]
  }, [])

  const getPropuestaBySlug = useCallback(async (slug: string) => {
    const { data, error } = await supabase
      .from('propuestas')
      .select('*, creadoPor:created_by(id, nombre, apellido, avatar_url)')
      .eq('slug', slug)
      .maybeSingle()

    if (error) {
      console.error('Error fetching propuesta by slug:', error)
      throw error
    }

    return (data || null) as Propuesta | null
  }, [])
  
  const getPropuestaById = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('propuestas')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching propuesta by id:', error)
      throw error
    }

    return (data || null) as Propuesta | null
  }, [])

  const createPropuesta = useCallback(async (data: Omit<Propuesta, 'id' | 'created_at' | 'updated_at'>) => {
    const { error } = await supabase
      .from('propuestas')
      .insert([data])

    if (error) {
      console.error('Error creating propuesta:', error)
      throw error
    }
  }, [])

  const updatePropuesta = useCallback(async (id: string, data: Partial<Propuesta>) => {
    const { error } = await supabase
      .from('propuestas')
      .update(data)
      .eq('id', id)

    if (error) {
      console.error('Error updating propuesta:', error)
      throw error
    }
  }, [])

  const deletePropuesta = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('propuestas')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting propuesta:', error)
      throw error
    }
  }, [])

  return {
    getPropuestas,
    getPropuestaBySlug,
    getPropuestaById,
    createPropuesta,
    updatePropuesta,
    deletePropuesta,
  }
}
