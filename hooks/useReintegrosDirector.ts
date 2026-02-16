import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { runWithRecovery } from '@/lib/async-recovery'
import { useResumeRefresh } from '@/hooks/useResumeRefresh'
import type {
  CrearSolicitudReintegroPayload,
  SolicitudReintegro,
  SolicitudReintegroHistorial,
} from '@/lib/types'

function asSingleSolicitud(data: unknown): SolicitudReintegro {
  if (Array.isArray(data)) {
    return data[0] as SolicitudReintegro
  }
  return data as SolicitudReintegro
}

export function useReintegrosDirector(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true
  const [solicitudes, setSolicitudes] = useState<SolicitudReintegro[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSolicitudes = useCallback(async () => {
    if (!enabled) {
      setSolicitudes([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await runWithRecovery(
        () => supabase
          .from('solicitudes_reintegro')
          .select('*')
          .order('created_at', { ascending: false }),
        { label: 'reintegros director' }
      )

      if (error) throw error
      setSolicitudes((data || []) as SolicitudReintegro[])
    } catch (error) {
      console.error('Error fetching reintegros director:', error)
      toast.error('No se pudieron cargar tus reintegros')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void fetchSolicitudes()
  }, [enabled, fetchSolicitudes])

  useResumeRefresh(() => {
    if (!enabled) return
    void fetchSolicitudes()
  }, { throttleMs: 5_000 })

  const crearSolicitud = async (payload: CrearSolicitudReintegroPayload) => {
    const { data, error } = await supabase.rpc('rpc_crear_solicitud_reintegro', {
      p_payload: payload,
    })

    if (error) {
      toast.error(error.message || 'No se pudo crear la solicitud')
      throw error
    }

    const nueva = asSingleSolicitud(data)
    setSolicitudes((prev) => [nueva, ...prev])
    toast.success('Solicitud creada en borrador')
    return nueva
  }

  const enviarSolicitud = async (solicitudId: string) => {
    const { data, error } = await supabase.rpc('rpc_enviar_solicitud_reintegro', {
      p_solicitud_id: solicitudId,
    })

    if (error) {
      toast.error(error.message || 'No se pudo enviar la solicitud')
      throw error
    }

    const actualizada = asSingleSolicitud(data)
    setSolicitudes((prev) => prev.map((s) => (s.id === actualizada.id ? actualizada : s)))
    toast.success('Solicitud enviada a aprobacion')
    return actualizada
  }

  const cancelarSolicitud = async (solicitudId: string, motivo?: string) => {
    const { data, error } = await supabase.rpc('rpc_cancelar_solicitud_reintegro', {
      p_solicitud_id: solicitudId,
      p_motivo: motivo ?? null,
    })

    if (error) {
      toast.error(error.message || 'No se pudo cancelar la solicitud')
      throw error
    }

    const actualizada = asSingleSolicitud(data)
    setSolicitudes((prev) => prev.map((s) => (s.id === actualizada.id ? actualizada : s)))
    toast.success('Solicitud cancelada')
    return actualizada
  }

  const fetchHistorial = async (solicitudId: string) => {
    const { data, error } = await runWithRecovery(
      () => supabase
        .from('solicitudes_reintegro_historial')
        .select('*')
        .eq('solicitud_id', solicitudId)
        .order('created_at', { ascending: true }),
      { label: 'historial reintegros director' }
    )

    if (error) {
      toast.error('No se pudo cargar el historial')
      throw error
    }

    return (data || []) as SolicitudReintegroHistorial[]
  }

  return {
    solicitudes,
    loading,
    fetchSolicitudes,
    crearSolicitud,
    enviarSolicitud,
    cancelarSolicitud,
    fetchHistorial,
  }
}
