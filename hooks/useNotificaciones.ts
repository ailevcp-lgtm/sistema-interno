import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Notificacion } from '@/lib/types'
import { toast } from 'sonner'
import { runWithRecovery } from '@/lib/async-recovery'

export function useNotificaciones() {
    const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    const fetchNotificaciones = useCallback(async () => {
        if (!user) {
            setNotificaciones([])
            setLoading(false)
            return
        }

        setLoading(true)
        const { data, error } = await runWithRecovery(() => supabase
            .from('notificaciones')
            .select('*')
            .eq('usuario_id', user.id)
            .order('created_at', { ascending: false }), {
                label: 'notificaciones',
            })

        if (error) {
            console.error('Error fetching notifications:', error)
        } else {
            setNotificaciones(data as Notificacion[])
        }
        setLoading(false)
    }, [user])

    useEffect(() => {
        void fetchNotificaciones()

        if (!user) return

        const channel = supabase
            .channel('notificaciones-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notificaciones',
                    filter: `usuario_id=eq.${user.id}`,
                },
                () => {
                    void fetchNotificaciones()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user, fetchNotificaciones])

    const markAsRead = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notificaciones')
                .update({ leida: true })
                .eq('id', id)

            if (error) throw error

            setNotificaciones(prev =>
                prev.map(n => (n.id === id ? { ...n, leida: true } : n))
            )
        } catch (error) {
            console.error('Error marking notification as read:', error)
            toast.error('Error al actualizar notificación')
        }
    }

    const markAllAsRead = async () => {
        if (!user) return
        try {
            const { error } = await supabase
                .from('notificaciones')
                .update({ leida: true })
                .eq('usuario_id', user.id)
                .eq('leida', false)

            if (error) throw error

            setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
            toast.success('Todas las notificaciones marcadas como leídas')
        } catch (error) {
            console.error('Error marking all as read:', error)
            toast.error('Error al actualizar notificaciones')
        }
    }

    const deleteNotification = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notificaciones')
                .delete()
                .eq('id', id)

            if (error) throw error

            setNotificaciones(prev => prev.filter(n => n.id !== id))
            toast.success('Notificación eliminada')
        } catch (error) {
            console.error('Error deleting notification:', error)
            toast.error('Error al eliminar notificación')
        }
    }

    const unreadCount = notificaciones.filter(n => !n.leida).length

    return {
        notificaciones,
        loading,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refreshNotificaciones: fetchNotificaciones,
    }
}
