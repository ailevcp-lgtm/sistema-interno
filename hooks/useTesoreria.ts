import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { toast } from 'sonner'
import type {
    Cuenta,
    MovimientoExtended,
    CategoriaFinanciera
} from '@/lib/types'
import { getFinancialReferenceData } from '@/lib/finance-source'
import { runWithRecovery } from '@/lib/async-recovery'
import { useResumeRefresh } from '@/hooks/useResumeRefresh'

export interface CuentaConSaldo extends Cuenta {
    saldo: number
}

export function useTesoreria() {
    const { user } = useAuth()
    const [cuentas, setCuentas] = useState<CuentaConSaldo[]>([])
    const [categorias, setCategorias] = useState<CategoriaFinanciera[]>([])
    const [movimientos, setMovimientos] = useState<MovimientoExtended[]>([])
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [referenceData, movsResult, recentResult] = await Promise.all([
                runWithRecovery(
                    () => getFinancialReferenceData(),
                    { label: 'tesoreria references', timeoutMs: 8_000, retries: 1 }
                ),
                runWithRecovery(() => supabase
                    .from('movimientos')
                    .select('id, tipo, monto, cuenta_id')
                    .eq('anulado', false), { label: 'tesoreria movimientos', timeoutMs: 8_000, retries: 1 }),
                runWithRecovery(() => supabase
                    .from('movimientos')
                    .select(`
          id,
          tipo,
          categoria_id,
          monto,
          fecha,
          descripcion,
          comprobante_url,
          registrado_por,
          periodo,
          created_at,
          evento_id,
          subcategoria_id,
          cuenta_id,
          voluntario_nombre,
          moneda,
          import_batch_id,
          external_id,
          row_hash,
          socio_id,
          anulado,
          anulado_at,
          anulado_por,
          anulado_motivo
        `)
                    .eq('anulado', false)
                    .order('fecha', { ascending: false })
                    .limit(50), { label: 'tesoreria movimientos recientes', timeoutMs: 8_000, retries: 1 }),
            ])

            if (movsResult.error) throw movsResult.error
            if (recentResult.error) throw recentResult.error

            setCategorias(referenceData.categorias)

            const balances: Record<string, number> = {}
            movsResult.data?.forEach(m => {
                if (!m.cuenta_id) return
                const monto = Number(m.monto)
                if (!balances[m.cuenta_id]) balances[m.cuenta_id] = 0

                if (m.tipo === 'ingreso') {
                    balances[m.cuenta_id] += monto
                } else {
                    balances[m.cuenta_id] -= monto
                }
            })

            const cuentasConSaldo = referenceData.cuentas.map(c => ({
                ...c,
                saldo: balances[c.id] || 0
            }))

            const categoriasById = new Map(
                referenceData.categorias.map((categoria) => [categoria.id, categoria])
            )
            const eventosById = new Map(
                referenceData.eventos.map((evento) => [evento.id, evento])
            )
            const cuentasById = new Map(
                referenceData.cuentas.map((cuenta) => [cuenta.id, cuenta])
            )

            const recentMovimientos = ((recentResult.data || []) as MovimientoExtended[]).map((movimiento) => ({
                ...movimiento,
                categoria: movimiento.categoria_id ? categoriasById.get(movimiento.categoria_id) : undefined,
                evento: movimiento.evento_id ? eventosById.get(movimiento.evento_id) : undefined,
                cuenta: movimiento.cuenta_id ? cuentasById.get(movimiento.cuenta_id) : undefined,
            }))

            setCuentas(cuentasConSaldo)
            setMovimientos(recentMovimientos)

        } catch (error) {
            console.error('Error fetching treasury data:', error)
            toast.error('Error al cargar datos de tesorería')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void fetchData()
    }, [fetchData])
    useResumeRefresh(() => { void fetchData() }, { throttleMs: 5_000 })

    const registrarArqueo = async (cuentaId: string, saldoReal: number, observaciones: string) => {
        if (!user) return

        const cuenta = cuentas.find(c => c.id === cuentaId)
        if (!cuenta) {
            toast.error('Cuenta no encontrada')
            return
        }

        try {
            const { error } = await supabase
                .from('arqueos')
                .insert([{
                    cuenta_id: cuentaId,
                    saldo_sistema: cuenta.saldo,
                    saldo_real: saldoReal,
                    observaciones,
                    realizado_por: user.id
                }])

            if (error) throw error

            toast.success('Arqueo registrado correctamente')
            fetchData()
            return true
        } catch (error) {
            console.error('Error registering arqueo:', error)
            toast.error('Error al registrar arqueo')
            return false
        }
    }

    return {
        cuentas,
        categorias,
        movimientos,
        loading,
        refreshData: fetchData,
        registrarArqueo
    }
}
