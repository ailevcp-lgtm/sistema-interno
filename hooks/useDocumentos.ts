import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
    ArticuloEstatuto,
    Resolucion,
    Balance,
    TipoResolucion,
} from '@/lib/types'
import { toast } from 'sonner'

export function useDocumentos() {
    const [loading, setLoading] = useState(false)

    // -- ESTATUTO --
    // -- ESTATUTO --
    const getEstatuto = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('estatuto_articulos')
            .select('*')
        // Remove DB sorting for 'articulo' since it is text and needs natural sort
        // We can keep 'capitulo' sorting if we want, but doing full sort in JS is safer now

        setLoading(false)

        if (error) {
            console.error('Error fetching estatuto:', error)
            toast.error('Error al cargar el estatuto')
            return []
        }

        // Client-side Natural Sort
        const sortedData = (data as ArticuloEstatuto[]).sort((a, b) => {
            // Priority 1: Capitulo (Ascending)
            if (a.capitulo !== b.capitulo) {
                return a.capitulo - b.capitulo;
            }

            // Priority 2: Articulo (Natural Sort for "1", "2", "10", "11.1")
            return a.articulo.localeCompare(b.articulo, undefined, { numeric: true, sensitivity: 'base' });
        });

        return sortedData
    }, [])

    const createArticulo = useCallback(async (data: Omit<ArticuloEstatuto, 'id' | 'updated_at'>) => {
        setLoading(true)
        const { data: newArt, error } = await supabase
            .from('estatuto_articulos')
            .insert([data])
            .select()
            .single()

        setLoading(false)
        if (error) {
            toast.error('Error al crear artículo')
            throw error
        }
        toast.success('Artículo creado')
        return newArt as ArticuloEstatuto
    }, [])

    const updateArticulo = useCallback(async (id: string, contenido: string, titulo?: string) => {
        setLoading(true)
        const updates: any = { contenido, updated_at: new Date().toISOString() }
        if (titulo !== undefined) updates.titulo = titulo

        const { error } = await supabase
            .from('estatuto_articulos')
            .update(updates)
            .eq('id', id)

        setLoading(false)
        if (error) {
            toast.error('Error al actualizar artículo')
            throw error
        }
        toast.success('Artículo actualizado')
        return true
    }, [])

    const deleteArticulo = useCallback(async (id: string) => {
        setLoading(true)
        const { error } = await supabase
            .from('estatuto_articulos')
            .delete()
            .eq('id', id)

        setLoading(false)
        if (error) {
            toast.error('Error al eliminar artículo')
            throw error
        }
        toast.success('Artículo eliminado')
        return true
    }, [])

    const deleteAllArticulos = useCallback(async () => {
        setLoading(true)
        const { error } = await supabase
            .from('estatuto_articulos')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000') // Hack to delete all

        setLoading(false)
        if (error) {
            toast.error('Error al eliminar todos los artículos')
            throw error
        }
        return true
    }, [])

    const createArticulosBulk = useCallback(async (data: Omit<ArticuloEstatuto, 'id' | 'updated_at'>[]) => {
        setLoading(true)
        const { error } = await supabase
            .from('estatuto_articulos')
            .insert(data)

        setLoading(false)
        if (error) {
            toast.error('Error al crear artículos masivamente')
            throw error
        }
        toast.success(`${data.length} artículos importados correctamente`)
        return true
    }, [])

    // -- RESOLUCIONES Y DECRETOS --
    const getResoluciones = useCallback(async (tipo: TipoResolucion) => {
        setLoading(true)
        const { data, error } = await supabase
            .from('resoluciones')
            .select('*')
            .eq('tipo', tipo)
            .order('fecha', { ascending: false })

        setLoading(false)
        if (error) {
            console.error('Error fetching resoluciones:', error)
            toast.error('Error al cargar resoluciones')
            return []
        }
        return data as Resolucion[]
    }, [])

    const createResolucion = useCallback(async (data: Omit<Resolucion, 'id' | 'created_at'>) => {
        setLoading(true)
        const { data: newRes, error } = await supabase
            .from('resoluciones')
            .insert([data])
            .select()
            .single()

        setLoading(false)
        if (error) {
            toast.error('Error al crear resolución')
            throw error
        }
        toast.success('Resolución creada correctamente')
        return newRes as Resolucion
    }, [])

    const updateResolucion = useCallback(async (id: string, data: Partial<Resolucion>) => {
        setLoading(true)
        const { error } = await supabase
            .from('resoluciones')
            .update(data)
            .eq('id', id)

        setLoading(false)
        if (error) {
            toast.error('Error al actualizar resolución')
            throw error
        }
        toast.success('Resolución actualizada')
        return true
    }, [])

    // -- BALANCES --
    const getBalances = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('balances')
            .select('*')
            .order('created_at', { ascending: false })

        setLoading(false)
        if (error) {
            console.error('Error fetching balances:', error)
            toast.error('Error al cargar balances')
            return []
        }
        return data as Balance[]
    }, [])

    const createBalance = useCallback(async (data: Omit<Balance, 'id' | 'created_at' | 'saldo'>) => {
        setLoading(true)
        const saldo = data.total_ingresos - data.total_egresos

        const { data: newBalance, error } = await supabase
            .from('balances')
            .insert([{ ...data, saldo }])
            .select()
            .single()

        setLoading(false)
        if (error) {
            toast.error('Error al crear balance')
            throw error
        }
        toast.success('Balance creado correctamente')
        return newBalance as Balance
    }, [])

    // -- CONFIGURACION --
    const getConfig = useCallback(async (key: string) => {
        const { data, error } = await supabase
            .from('configuracion_sistema')
            .select('value')
            .eq('key', key)
            .single()

        if (error && error.code !== 'PGRST116') { // Ignore not found
            console.error('Error fetching config:', error)
        }
        return data?.value || null
    }, [])

    const updateConfig = useCallback(async (key: string, value: string) => {
        const { error } = await supabase
            .from('configuracion_sistema')
            .upsert({ key, value, updated_at: new Date().toISOString() })

        if (error) {
            toast.error('Error al actualizar configuración')
            throw error
        }
        toast.success('Configuración actualizada')
        return true
    }, [])

    return {
        loading,
        getEstatuto,
        createArticulo,
        updateArticulo,
        deleteArticulo,
        deleteAllArticulos,
        createArticulosBulk,
        getResoluciones,
        createResolucion,
        updateResolucion,
        getBalances,
        createBalance,
        getConfig,
        updateConfig
    }
}
