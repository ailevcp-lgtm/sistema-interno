'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Mail, Loader2 } from 'lucide-react'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_LABELS,
  type EmailNotificationType,
} from '@/lib/email/types'

interface EmailPreferences {
  emails_habilitados: boolean
  dias_antelacion_recordatorio: number
  [key: string]: boolean | number
}

const DEFAULT_PREFERENCES: EmailPreferences = {
  emails_habilitados: true,
  dias_antelacion_recordatorio: 2,
  tarea_asignada: true,
  tarea_estado_cambio: true,
  tarea_vencimiento_proximo: true,
  subtarea_creada: true,
  handoff_solicitado: true,
  handoff_resuelto: true,
  aprobacion_cd_pendiente: true,
  aprobacion_cd_resuelta: true,
  calendario_reunion_nueva: true,
  calendario_reunion_modificada: true,
  calendario_reunion_cancelada: true,
  calendario_planificacion_definitiva: true,
  resolucion_nueva: true,
  decreto_nuevo: true,
}

interface EmailPreferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmailPreferencesDialog({ open, onOpenChange }: EmailPreferencesDialogProps) {
  const [preferences, setPreferences] = useState<EmailPreferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return

      const response = await fetch('/api/email/preferences', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setPreferences({ ...DEFAULT_PREFERENCES, ...data })
      }
    } catch (err) {
      console.error('Error cargando preferencias:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      void fetchPreferences()
    }
  }, [open, fetchPreferences])

  const handleToggle = useCallback(async (field: string, value: boolean) => {
    const updated = { ...preferences, [field]: value }
    setPreferences(updated)

    try {
      setSaving(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return

      const response = await fetch('/api/email/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [field]: value }),
      })

      if (!response.ok) {
        toast.error('Error al guardar preferencia')
        setPreferences(preferences)
      }
    } catch {
      toast.error('Error al guardar preferencia')
      setPreferences(preferences)
    } finally {
      setSaving(false)
    }
  }, [preferences])

  const handleDaysChange = useCallback(async (days: number) => {
    const clamped = Math.max(0, Math.min(14, days))
    const updated = { ...preferences, dias_antelacion_recordatorio: clamped }
    setPreferences(updated)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return

      await fetch('/api/email/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dias_antelacion_recordatorio: clamped }),
      })
    } catch {
      console.warn('Error guardando días de antelación')
    }
  }, [preferences])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Preferencias de Email
          </DialogTitle>
          <DialogDescription>
            Configura qué notificaciones recibir por email.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Kill switch global */}
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div>
                <Label className="font-semibold">Emails habilitados</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Desactiva para dejar de recibir todos los emails
                </p>
              </div>
              <Switch
                checked={preferences.emails_habilitados}
                onCheckedChange={(value) => handleToggle('emails_habilitados', value)}
                disabled={saving}
              />
            </div>

            {preferences.emails_habilitados && (
              <>
                {/* Días de antelación */}
                <div className="rounded-lg border p-3">
                  <Label className="font-semibold text-sm">Días de antelación para recordatorios</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    Cuántos días antes de un vencimiento o evento recibir recordatorio
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={preferences.dias_antelacion_recordatorio <= 0}
                      onClick={() => handleDaysChange(preferences.dias_antelacion_recordatorio - 1)}
                    >
                      -
                    </Button>
                    <span className="text-sm font-medium w-16 text-center tabular-nums">
                      {preferences.dias_antelacion_recordatorio} día{preferences.dias_antelacion_recordatorio !== 1 ? 's' : ''}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={preferences.dias_antelacion_recordatorio >= 14}
                      onClick={() => handleDaysChange(preferences.dias_antelacion_recordatorio + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* Categorías de notificación */}
                {NOTIFICATION_CATEGORIES.map((category) => (
                  <div key={category.label}>
                    <h4 className="text-sm font-semibold text-foreground mb-2">{category.label}</h4>
                    <div className="space-y-1">
                      {category.types.map((type) => (
                        <div
                          key={type}
                          className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/40 transition-colors"
                        >
                          <Label className="text-sm font-normal cursor-pointer">
                            {NOTIFICATION_LABELS[type]}
                          </Label>
                          <Switch
                            checked={preferences[type] !== false}
                            onCheckedChange={(value) => handleToggle(type, value)}
                            disabled={saving}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
