import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
    ArticuloEstatuto,
    Resolucion,
    Balance,
    TipoResolucion,
} from '@/lib/types'
import { toast } from 'sonner'
import { runWithRecovery } from '@/lib/async-recovery'
import { sendEmailNotificationFromClient } from '@/lib/email/client'
import type { EmailRecipient } from '@/lib/email/types'

interface ActiveSocioRecipient {
    id: string
    usuario_id: string
    nombre: string
    apellido: string
    email: string | null
}

export function useDocumentos() {
    const [loading, setLoading] = useState(false)

    // -- ESTATUTO --
    // -- ESTATUTO --
    const getEstatuto = useCallback(async () => {
        try {
            setLoading(true)
            const { data, error } = await runWithRecovery(() => supabase
                .from('estatuto_articulos')
                .select('*'), {
                    label: 'estatuto articulos',
                })

            if (error) {
                throw error
            }

            // Client-side Natural Sort
            const sortedData = (data as ArticuloEstatuto[]).sort((a, b) => {
                if (a.capitulo !== b.capitulo) {
                    return a.capitulo - b.capitulo
                }

                return a.articulo.localeCompare(b.articulo, undefined, { numeric: true, sensitivity: 'base' })
            })

            return sortedData
        } catch (error) {
            console.error('Error fetching estatuto:', error)
            toast.error('Error al cargar el estatuto')
            return []
        } finally {
            setLoading(false)
        }
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
        const updates: { contenido: string; updated_at: string; titulo?: string } = {
            contenido,
            updated_at: new Date().toISOString(),
        }
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
        try {
            setLoading(true)
            const { data, error } = await runWithRecovery(() => supabase
                .from('resoluciones')
                .select('*')
                .eq('tipo', tipo)
                .order('fecha', { ascending: false }), {
                    label: `resoluciones ${tipo}`,
                })

            if (error) {
                throw error
            }
            return data as Resolucion[]
        } catch (error) {
            console.error('Error fetching resoluciones:', error)
            toast.error('Error al cargar resoluciones')
            return []
        } finally {
            setLoading(false)
        }
    }, [])

    const getActiveSocios = useCallback(async () => {
        const { data: socios, error } = await supabase
            .from('socios')
            .select('id, usuario_id, nombre, apellido, email')
            .eq('estado', 'activo')
            .not('usuario_id', 'is', null)
        if (error) {
            throw error
        }

        return (socios || []) as ActiveSocioRecipient[]
    }, [])

    const createNotificationsForUsuarios = useCallback(async (
        usuarios: ActiveSocioRecipient[],
        payload: {
            titulo: string
            mensaje: string
            tipo?: 'info' | 'alerta' | 'exito' | 'error'
            link?: string
        }
    ) => {
        const rows = usuarios
            .filter((usuario) => usuario.usuario_id)
            .map((usuario) => ({
                usuario_id: usuario.usuario_id,
                titulo: payload.titulo,
                mensaje: payload.mensaje,
                tipo: payload.tipo || 'info',
                link: payload.link || null,
            }))

        if (rows.length === 0) {
            return 0
        }

        const { error } = await supabase
            .from('notificaciones')
            .insert(rows)

        if (error) {
            throw error
        }

        return rows.length
    }, [])

    const notifyBalanceUpload = useCallback(async (
        balance: Pick<Balance, 'id' | 'periodo' | 'created_at'>,
        options?: { silentSuccess?: boolean }
    ) => {
        try {
            const socios = await getActiveSocios()
            const { data: sessionData } = await supabase.auth.getSession()
            const currentUserId = sessionData.session?.user?.id
            const currentSocio = socios.find((s) => s.usuario_id === currentUserId)
            const creatorName = currentSocio ? `${currentSocio.nombre} ${currentSocio.apellido}` : 'Un miembro'

            const sentCount = await createNotificationsForUsuarios(socios, {
                titulo: 'Nuevo balance disponible',
                mensaje: `Se subio el balance ${balance.periodo}. Ya podes verlo en Documentos.`,
                tipo: 'info',
                link: `/documentos/balances/${balance.id}`,
            })

            const recipients: EmailRecipient[] = socios
                .filter((s) => s.usuario_id !== currentUserId && s.email)
                .map((s) => ({
                    socio_id: s.id,
                    email: s.email!,
                    nombre: s.nombre,
                    apellido: s.apellido,
                }))

            await sendEmailNotificationFromClient('balance_nuevo', recipients, {
                type: 'balance_nuevo',
                balance_periodo: balance.periodo,
                balance_fecha_publicacion: balance.created_at,
                creado_por_nombre: creatorName,
            })

            if (!options?.silentSuccess) {
                toast.success(`Notificación enviada a ${sentCount} usuarios`)
            }

            return sentCount
        } catch (error) {
            console.error('Error notifying balance upload:', error)
            if (!options?.silentSuccess) {
                toast.error('No se pudo enviar la notificación del balance')
            }
            throw error
        }
    }, [createNotificationsForUsuarios, getActiveSocios])

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

        const resolucion = newRes as Resolucion

        // Notificar a todos los socios sobre nueva resolución/decreto
        void (async () => {
            try {
                const socios = await getActiveSocios()
                const { data: sessionData } = await supabase.auth.getSession()
                const currentUserId = sessionData.session?.user?.id
                const currentSocio = socios.find((s) => s.usuario_id === currentUserId)
                const creatorName = currentSocio ? `${currentSocio.nombre} ${currentSocio.apellido}` : 'Un miembro'

                const recipients: EmailRecipient[] = socios
                    .filter((s) => s.usuario_id !== currentUserId && s.email)
                    .map((s) => ({
                        socio_id: s.id,
                        email: s.email!,
                        nombre: s.nombre,
                        apellido: s.apellido,
                    }))

                const isDecreto = data.tipo === 'decreto'
                const notifType = isDecreto ? 'decreto_nuevo' as const : 'resolucion_nueva' as const

                if (isDecreto) {
                    void sendEmailNotificationFromClient(notifType, recipients, {
                        type: 'decreto_nuevo',
                        decreto_titulo: resolucion.titulo,
                        decreto_numero: resolucion.numero,
                        decreto_anio: resolucion.anio,
                        decreto_fecha: resolucion.fecha,
                        creado_por_nombre: creatorName,
                    })
                } else {
                    void sendEmailNotificationFromClient(notifType, recipients, {
                        type: 'resolucion_nueva',
                        resolucion_titulo: resolucion.titulo,
                        resolucion_numero: resolucion.numero,
                        resolucion_anio: resolucion.anio,
                        resolucion_fecha: resolucion.fecha,
                        creado_por_nombre: creatorName,
                    })
                }
            } catch (err) {
                console.warn('Error enviando notificación de resolución:', err)
            }
        })()

        return resolucion
    }, [getActiveSocios])

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
        try {
            setLoading(true)
            const { data, error } = await runWithRecovery(() => supabase
                .from('balances')
                .select('*')
                .order('created_at', { ascending: false }), {
                    label: 'balances',
                })

            if (error) {
                throw error
            }
            return data as Balance[]
        } catch (error) {
            console.error('Error fetching balances:', error)
            toast.error('Error al cargar balances')
            return []
        } finally {
            setLoading(false)
        }
    }, [])

    const getBalanceById = useCallback(async (id: string) => {
        try {
            setLoading(true)
            const { data, error } = await runWithRecovery(() => supabase
                .from('balances')
                .select('*')
                .eq('id', id)
                .maybeSingle(), {
                    label: `balance ${id}`,
                })

            if (error) {
                throw error
            }

            return (data as Balance | null) || null
        } catch (error) {
            console.error('Error fetching balance:', error)
            toast.error('Error al cargar el balance')
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    const createBalance = useCallback(async (data: Omit<Balance, 'id' | 'created_at' | 'saldo'>) => {
        setLoading(true)

        const { data: newBalance, error } = await supabase
            .from('balances')
            .insert([data])
            .select()
            .single()

        setLoading(false)
        if (error) {
            console.error('Error creating balance:', error)
            toast.error('Error al crear balance')
            throw error
        }
        toast.success('Balance creado correctamente')
        const balance = newBalance as Balance

        void notifyBalanceUpload(balance, { silentSuccess: true }).catch(() => {
            toast.error('El balance se subio, pero la notificación falló. Podes enviarla manualmente desde la lista.')
        })

        return balance
    }, [notifyBalanceUpload])

    const updateBalance = useCallback(async (id: string, data: Partial<Balance>) => {
        setLoading(true)

        const { data: updatedBalance, error } = await supabase
            .from('balances')
            .update(data)
            .eq('id', id)
            .select()
            .single()

        setLoading(false)
        if (error) {
            console.error('Error updating balance:', error)
            toast.error('Error al actualizar balance')
            throw error
        }

        toast.success('Balance actualizado')
        return updatedBalance as Balance
    }, [])

    const deleteBalance = useCallback(async (id: string) => {
        setLoading(true)

        const { error } = await supabase
            .from('balances')
            .delete()
            .eq('id', id)

        setLoading(false)
        if (error) {
            console.error('Error deleting balance:', error)
            toast.error('Error al eliminar balance')
            throw error
        }

        toast.success('Balance eliminado')
        return true
    }, [])

    // -- CONFIGURACION --
    const getConfig = useCallback(async (key: string) => {
        try {
            const { data, error } = await runWithRecovery(() => supabase
                .from('configuracion_sistema')
                .select('value')
                .eq('key', key)
                .single(), {
                    label: `configuracion ${key}`,
                })

            if (error && error.code !== 'PGRST116') { // Ignore not found
                console.error('Error fetching config:', error)
            }
            return data?.value || null
        } catch (error) {
            console.error('Error fetching config:', error)
            return null
        }
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
        getBalanceById,
        createBalance,
        updateBalance,
        deleteBalance,
        notifyBalanceUpload,
        getConfig,
        updateConfig
    }
}
