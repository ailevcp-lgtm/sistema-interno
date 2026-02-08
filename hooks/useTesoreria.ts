import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { toast } from 'sonner'
import type {
    Cuenta,
    MovimientoExtended,
    FinanceFilters,
    CategoriaFinanciera
} from '@/lib/types'

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
            // 1. Fetch cuentas
            const { data: cuentasData, error: cuentasError } = await supabase
                .from('cuentas')
                .select('*')
                .eq('activa', true)
                .order('nombre')

            if (cuentasError) throw cuentasError

            // Fetch categorias
            const { data: catData, error: catError } = await supabase
                .from('categorias_financieras')
                .select('*')
                .eq('activa', true)
                .order('nombre')

            if (catError) throw catError
            setCategorias(catData)

            // 2. Fetch all movements to calculate balances
            // TODO: In the future, we might want to paginate or use database views for balances
            const { data: movsData, error: movsError } = await supabase
                .from('movimientos')
                .select('id, tipo, monto, cuenta_id')

            if (movsError) throw movsError

            // Calculate balances
            const balances: Record<string, number> = {}
            movsData?.forEach(m => {
                if (!m.cuenta_id) return
                const monto = Number(m.monto)
                if (!balances[m.cuenta_id]) balances[m.cuenta_id] = 0

                if (m.tipo === 'ingreso') {
                    balances[m.cuenta_id] += monto
                } else {
                    balances[m.cuenta_id] -= monto
                }
            })

            const cuentasConSaldo = cuentasData.map(c => ({
                ...c,
                saldo: balances[c.id] || 0
            }))

            setCuentas(cuentasConSaldo)

            // 3. Fetch recent movements for the list
            const { data: recentMovs, error: recentError } = await supabase
                .from('movimientos')
                .select(`
          *,
          categoria:categorias_financieras(id, nombre, tipo),
          evento:eventos(id, nombre),
          cuenta:cuentas(id, nombre)
        `)
                .order('fecha', { ascending: false })
                .limit(50)

            if (recentError) throw recentError

            setMovimientos(recentMovs as MovimientoExtended[])

        } catch (error) {
            console.error('Error fetching treasury data:', error)
            toast.error('Error al cargar datos de tesorería')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

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
