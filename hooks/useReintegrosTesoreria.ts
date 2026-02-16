import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { runWithRecovery } from '@/lib/async-recovery'
import { useResumeRefresh } from '@/hooks/useResumeRefresh'
import type {
  RegistrarPagoReintegroPayload,
  SolicitudReintegro,
  SolicitudReintegroHistorial,
} from '@/lib/types'

function asSingleSolicitud(data: unknown): SolicitudReintegro {
  if (Array.isArray(data)) {
    return data[0] as SolicitudReintegro
  }
  return data as SolicitudReintegro
}

export function useReintegrosTesoreria(options?: { enabled?: boolean }) {
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
          .in('estado', ['pendiente_aprobacion', 'aprobada_pendiente_pago', 'pagada', 'rechazada', 'cancelada'])
          .order('created_at', { ascending: false }),
        { label: 'reintegros tesoreria' }
      )

      if (error) throw error
      setSolicitudes((data || []) as SolicitudReintegro[])
    } catch (error) {
      console.error('Error fetching reintegros tesoreria:', error)
      toast.error('No se pudieron cargar los reintegros para tesoreria')
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

  const observarSolicitud = async (solicitudId: string, motivo: string) => {
    const { data, error } = await supabase.rpc('rpc_observar_solicitud_reintegro', {
      p_solicitud_id: solicitudId,
      p_motivo: motivo,
    })

    if (error) {
      toast.error(error.message || 'No se pudo observar la solicitud')
      throw error
    }

    const actualizada = asSingleSolicitud(data)
    setSolicitudes((prev) => prev.map((s) => (s.id === actualizada.id ? actualizada : s)))
    toast.success('Solicitud observada')
    return actualizada
  }

  const aprobarSolicitud = async (solicitudId: string, montoAprobado?: number) => {
    const { data, error } = await supabase.rpc('rpc_aprobar_solicitud_reintegro', {
      p_solicitud_id: solicitudId,
      p_monto_aprobado: montoAprobado ?? null,
    })

    if (error) {
      toast.error(error.message || 'No se pudo aprobar la solicitud')
      throw error
    }

    const actualizada = asSingleSolicitud(data)
    setSolicitudes((prev) => prev.map((s) => (s.id === actualizada.id ? actualizada : s)))
    toast.success('Solicitud aprobada')
    return actualizada
  }

  const rechazarSolicitud = async (solicitudId: string, motivo: string) => {
    const { data, error } = await supabase.rpc('rpc_rechazar_solicitud_reintegro', {
      p_solicitud_id: solicitudId,
      p_motivo: motivo,
    })

    if (error) {
      toast.error(error.message || 'No se pudo rechazar la solicitud')
      throw error
    }

    const actualizada = asSingleSolicitud(data)
    setSolicitudes((prev) => prev.map((s) => (s.id === actualizada.id ? actualizada : s)))
    toast.success('Solicitud rechazada')
    return actualizada
  }

  const registrarPago = async (payload: RegistrarPagoReintegroPayload) => {
    const { data, error } = await supabase.rpc('rpc_registrar_pago_reintegro', {
      p_solicitud_id: payload.solicitud_id,
      p_cuenta_pago_id: payload.cuenta_pago_id,
      p_fecha_pago: payload.fecha_pago,
      p_comprobante_pago_url: payload.comprobante_pago_url,
    })

    if (error) {
      toast.error(error.message || 'No se pudo registrar el pago')
      throw error
    }

    const actualizada = asSingleSolicitud(data)
    setSolicitudes((prev) => prev.map((s) => (s.id === actualizada.id ? actualizada : s)))
    toast.success('Pago registrado correctamente')
    return actualizada
  }

  const cancelarSolicitud = async (solicitudId: string, motivo: string) => {
    const { data, error } = await supabase.rpc('rpc_cancelar_solicitud_reintegro', {
      p_solicitud_id: solicitudId,
      p_motivo: motivo,
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
      { label: 'historial reintegros tesoreria' }
    )

    if (error) {
      toast.error('No se pudo cargar el historial')
      throw error
    }

    return (data || []) as SolicitudReintegroHistorial[]
  }

  const bandejaAprobacion = useMemo(
    () => solicitudes.filter((s) => s.estado === 'pendiente_aprobacion'),
    [solicitudes]
  )

  const pendientesPago = useMemo(
    () => solicitudes.filter((s) => s.estado === 'aprobada_pendiente_pago'),
    [solicitudes]
  )

  const historial = useMemo(
    () => solicitudes.filter((s) => ['pagada', 'rechazada', 'cancelada'].includes(s.estado)),
    [solicitudes]
  )

  return {
    solicitudes,
    loading,
    bandejaAprobacion,
    pendientesPago,
    historial,
    fetchSolicitudes,
    observarSolicitud,
    aprobarSolicitud,
    rechazarSolicitud,
    registrarPago,
    cancelarSolicitud,
    fetchHistorial,
  }
}
