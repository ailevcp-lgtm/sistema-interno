'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import type { SolicitudAdmision, Socio } from '@/lib/types'

export function NewAdmissionDialog({ open, onOpenChange, people, actorSocioId, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  people: Socio[]
  actorSocioId?: string
  onSaved: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [personId, setPersonId] = useState('')
  const [category, setCategory] = useState<'pleno' | 'adherente'>('pleno')
  const [applicationDate, setApplicationDate] = useState(today)
  const [receivedDate, setReceivedDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const selected = useMemo(() => people.find((person) => person.id === personId), [people, personId])

  const save = async () => {
    if (!selected || !actorSocioId) return
    setSaving(true)
    try {
      const { error } = await supabase.from('admision_solicitudes').insert({
        socio_id: selected.id,
        categoria_solicitada: category,
        estado: 'recibida',
        fecha_solicitud: applicationDate,
        fecha_recepcion: receivedDate,
        datos_declarados: {
          apellido_y_nombres: `${selected.apellido}, ${selected.nombre}`,
          dni: selected.dni,
          fecha_nacimiento: selected.fecha_nacimiento || null,
          email: selected.email,
          telefono: selected.telefono || null,
        },
        documentacion_general_verificada: false,
        notificacion_estado: 'pendiente',
        observaciones: notes.trim() || null,
        created_by_socio_id: actorSocioId,
      })
      if (error) throw error
      toast.success('Solicitud incorporada al registro de Secretaría')
      setPersonId('')
      setNotes('')
      onOpenChange(false)
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la solicitud')
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Registrar solicitud de admisión</DialogTitle><DialogDescription>La recepción no otorga por sí misma la calidad de persona asociada.</DialogDescription></DialogHeader>
    <div className="grid gap-4 py-2">
      <div className="space-y-2"><Label>Interesado/a</Label><Select value={personId} onValueChange={setPersonId}><SelectTrigger><SelectValue placeholder="Seleccionar persona de la comunidad" /></SelectTrigger><SelectContent>{people.map((person) => <SelectItem key={person.id} value={person.id}>{person.apellido}, {person.nombre} · DNI {person.dni}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Categoría solicitada</Label><Select value={category} onValueChange={(value) => setCategory(value as 'pleno' | 'adherente')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pleno">Socio/a Pleno/a</SelectItem><SelectItem value="adherente">Socio/a Adherente</SelectItem></SelectContent></Select></div>
      <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Fecha de solicitud</Label><Input type="date" value={applicationDate} onChange={(event) => setApplicationDate(event.target.value)} /></div><div className="space-y-2"><Label>Recepción por Secretaría</Label><Input type="date" value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} /></div></div>
      <div className="space-y-2"><Label>Observaciones iniciales</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
      <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-950">Después de registrar la recepción, Secretaría debe incorporar la solicitud firmada, la copia del DNI y, si corresponde, la autorización del representante antes de marcar la documentación como verificada.</p>
    </div>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button><Button onClick={() => void save()} disabled={!selected || !actorSocioId || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar recepción</Button></DialogFooter>
  </DialogContent></Dialog>
}

interface ResolutionOption { id: string; numero: number; anio: number; fecha: string; titulo: string }
interface ResolutionDocumentOption { id: string; numero?: number | null; anio?: number | null; titulo: string }

export function VerifyAdmissionDocumentsDialog({ open, onOpenChange, application, actorSocioId, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  application?: SolicitudAdmision | null
  actorSocioId?: string
  onSaved: () => void
}) {
  const [documents, setDocuments] = useState<ResolutionDocumentOption[]>([])
  const [applicationDocumentId, setApplicationDocumentId] = useState('')
  const [dniDocumentId, setDniDocumentId] = useState('')
  const [authorizationDocumentId, setAuthorizationDocumentId] = useState('')
  const [saving, setSaving] = useState(false)
  const birthDateMissing = !application?.socio?.fecha_nacimiento

  const isMinor = useMemo(() => {
    const birth = application?.socio?.fecha_nacimiento
    if (!birth) return false
    const atRequest = new Date(`${application.fecha_solicitud}T12:00:00`)
    const born = new Date(`${birth}T12:00:00`)
    let age = atRequest.getFullYear() - born.getFullYear()
    if (atRequest.getMonth() < born.getMonth() || (atRequest.getMonth() === born.getMonth() && atRequest.getDate() < born.getDate())) age -= 1
    return age < 18
  }, [application])

  useEffect(() => {
    if (!open) return
    void supabase
      .from('documentos_legales')
      .select('id, numero, anio, titulo')
      .eq('nivel_acceso', 'secretaria')
      .eq('es_vigente', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setDocuments((data || []) as ResolutionDocumentOption[]))
  }, [open])

  const save = async () => {
    if (!application || birthDateMissing || !actorSocioId || !applicationDocumentId || !dniDocumentId || (isMinor && !authorizationDocumentId)) return
    setSaving(true)
    try {
      const { error } = await supabase.from('admision_solicitudes').update({
        solicitud_documento_id: applicationDocumentId,
        dni_documento_id: dniDocumentId,
        autorizacion_representante_documento_id: authorizationDocumentId || null,
        documentacion_general_verificada: true,
        estado: 'verificada_secretaria',
        verificada_por_socio_id: actorSocioId,
        verificada_at: new Date().toISOString(),
      }).eq('id', application.id)
      if (error) throw error
      toast.success('Documentación general verificada por Secretaría')
      onOpenChange(false)
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo verificar la documentación')
    } finally {
      setSaving(false)
    }
  }

  const documentSelect = (label: string, value: string, setValue: (value: string) => void) => <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={setValue}><SelectTrigger><SelectValue placeholder="Seleccionar PDF restringido" /></SelectTrigger><SelectContent>{documents.map((document) => <SelectItem key={document.id} value={document.id}>{document.titulo}</SelectItem>)}</SelectContent></Select></div>

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Verificar documentación general</DialogTitle><DialogDescription>Seleccioná documentos cargados con nivel “Restringido a Secretaría”. Los certificados NNA no forman parte de esta verificación.</DialogDescription></DialogHeader>
    <div className="grid gap-4 py-2">
      {documentSelect('Solicitud de admisión firmada', applicationDocumentId, setApplicationDocumentId)}
      {documentSelect('Copia del DNI del/de la solicitante', dniDocumentId, setDniDocumentId)}
      {isMinor && documentSelect('Autorización y DNI del representante legal', authorizationDocumentId, setAuthorizationDocumentId)}
      {!application?.socio?.fecha_nacimiento && <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-950">No hay fecha de nacimiento cargada. Secretaría debe verificarla antes de determinar si corresponde autorización de representante.</p>}
    </div>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button><Button onClick={() => void save()} disabled={birthDateMissing || !applicationDocumentId || !dniDocumentId || (isMinor && !authorizationDocumentId) || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar verificación</Button></DialogFooter>
  </DialogContent></Dialog>
}

export function ResolveAdmissionDialog({ open, onOpenChange, application, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  application?: SolicitudAdmision | null
  onSaved: () => void
}) {
  const [decision, setDecision] = useState<'admitida' | 'rechazada'>('admitida')
  const [category, setCategory] = useState<'pleno' | 'adherente'>('pleno')
  const [resolutionId, setResolutionId] = useState('')
  const [documentId, setDocumentId] = useState('')
  const [resolutions, setResolutions] = useState<ResolutionOption[]>([])
  const [documents, setDocuments] = useState<ResolutionDocumentOption[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCategory(application?.categoria_solicitada || 'pleno')
    void Promise.all([
      supabase.from('resoluciones').select('id, numero, anio, fecha, titulo').neq('estado', 'borrador').order('fecha', { ascending: false }),
      supabase.from('documentos_legales').select('id, numero, anio, titulo').eq('tipo', 'resolucion_cd').eq('es_vigente', true).order('fecha_documento', { ascending: false }),
    ]).then(([resolutionResult, documentResult]) => {
      setResolutions((resolutionResult.data || []) as ResolutionOption[])
      setDocuments((documentResult.data || []) as ResolutionDocumentOption[])
    })
  }, [application, open])

  const selectedResolution = resolutions.find((resolution) => resolution.id === resolutionId)
  const save = async () => {
    if (!application || !selectedResolution || !documentId) return
    setSaving(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const response = await fetch('/api/socios/admisiones/resolver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session.session?.access_token ? { Authorization: `Bearer ${session.session.access_token}` } : {}) },
        body: JSON.stringify({
          solicitudId: application.id,
          decision,
          resolucionId: resolutionId,
          resolucionDocumentoId: documentId,
          fechaResolucion: selectedResolution.fecha,
          categoriaAdmitida: decision === 'admitida' ? category : null,
          observaciones: notes.trim() || null,
        }),
      })
      const result = await response.json() as { error?: string; notificada?: boolean }
      if (!response.ok) throw new Error(result.error || 'No se pudo registrar la decisión')
      toast.success(result.notificada ? 'Decisión registrada y notificada por email' : 'Decisión registrada; la notificación requiere revisión')
      onOpenChange(false)
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la decisión')
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Registrar decisión de Comisión Directiva</DialogTitle><DialogDescription>{application?.socio?.apellido}, {application?.socio?.nombre}. Esta acción crea el alta legal si la decisión es afirmativa y envía la resolución adjunta.</DialogDescription></DialogHeader>
    <div className="grid gap-4 py-2">
      <div className="space-y-2"><Label>Decisión</Label><Select value={decision} onValueChange={(value) => setDecision(value as 'admitida' | 'rechazada')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admitida">Admitida</SelectItem><SelectItem value="rechazada">Rechazada</SelectItem></SelectContent></Select></div>
      {decision === 'admitida' && <div className="space-y-2"><Label>Categoría otorgada</Label><Select value={category} onValueChange={(value) => setCategory(value as 'pleno' | 'adherente')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pleno">Socio/a Pleno/a</SelectItem><SelectItem value="adherente">Socio/a Adherente</SelectItem></SelectContent></Select></div>}
      <div className="space-y-2"><Label>Resolución registrada</Label><Select value={resolutionId} onValueChange={setResolutionId}><SelectTrigger><SelectValue placeholder="Seleccionar resolución" /></SelectTrigger><SelectContent>{resolutions.map((resolution) => <SelectItem key={resolution.id} value={resolution.id}>Res. {resolution.numero}/{resolution.anio} · {resolution.titulo}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>PDF firmado de la resolución</Label><Select value={documentId} onValueChange={setDocumentId}><SelectTrigger><SelectValue placeholder="Seleccionar PDF del Archivo legal" /></SelectTrigger><SelectContent>{documents.map((document) => <SelectItem key={document.id} value={document.id}>{document.numero ? `Res. ${document.numero}/${document.anio} · ` : ''}{document.titulo}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Observaciones</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
    </div>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button><Button onClick={() => void save()} disabled={!selectedResolution || !documentId || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar y notificar</Button></DialogFooter>
  </DialogContent></Dialog>
}

export function NnaVerificationDialog({ open, onOpenChange, people, actorSocioId, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  people: Socio[]
  actorSocioId?: string
  onSaved: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [personId, setPersonId] = useState('')
  const [documents, setDocuments] = useState<ResolutionDocumentOption[]>([])
  const [criminalDocumentId, setCriminalDocumentId] = useState('')
  const [sexualOffencesDocumentId, setSexualOffencesDocumentId] = useState('')
  const [presentedAt, setPresentedAt] = useState(today)
  const [expiresAt, setExpiresAt] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    void supabase.from('documentos_legales').select('id, titulo').eq('nivel_acceso', 'proteccion_nna').eq('es_vigente', true).order('created_at', { ascending: false }).then(({ data }) => setDocuments((data || []) as ResolutionDocumentOption[]))
  }, [open])

  const save = async () => {
    if (!personId || !actorSocioId || !criminalDocumentId || !sexualOffencesDocumentId) return
    setSaving(true)
    try {
      const { error } = await supabase.from('habilitaciones_nna').upsert({
        socio_id: personId,
        requiere_contacto_directo: true,
        estado: 'vigente',
        antecedentes_documento_id: criminalDocumentId,
        antecedentes_presentado_el: presentedAt,
        antecedentes_vence_el: expiresAt || null,
        integridad_sexual_documento_id: sexualOffencesDocumentId,
        integridad_sexual_presentado_el: presentedAt,
        integridad_sexual_vence_el: expiresAt || null,
        verificado_por_socio_id: actorSocioId,
        verificado_at: new Date().toISOString(),
        observaciones: notes.trim() || null,
      }, { onConflict: 'socio_id' })
      if (error) throw error
      toast.success('Habilitación para funciones con NNA registrada')
      onOpenChange(false)
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la habilitación')
    } finally {
      setSaving(false)
    }
  }

  const documentSelect = (label: string, value: string, setter: (value: string) => void) => <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={setter}><SelectTrigger><SelectValue placeholder="Seleccionar certificado restringido" /></SelectTrigger><SelectContent>{documents.map((document) => <SelectItem key={document.id} value={document.id}>{document.titulo}</SelectItem>)}</SelectContent></Select></div>

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Registrar habilitación para funciones con NNA</DialogTitle><DialogDescription>Este control se aplica por la función asignada, cualquiera sea la relación de la persona con AILE.</DialogDescription></DialogHeader>
    <div className="grid gap-4 py-2">
      <div className="space-y-2"><Label>Persona</Label><Select value={personId} onValueChange={setPersonId}><SelectTrigger><SelectValue placeholder="Seleccionar persona" /></SelectTrigger><SelectContent>{people.map((person) => <SelectItem key={person.id} value={person.id}>{person.apellido}, {person.nombre} · DNI {person.dni}</SelectItem>)}</SelectContent></Select></div>
      {documentSelect('Certificado de Antecedentes Penales', criminalDocumentId, setCriminalDocumentId)}
      {documentSelect('Certificado provincial de delitos contra la integridad sexual', sexualOffencesDocumentId, setSexualOffencesDocumentId)}
      <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Fecha de presentación</Label><Input type="date" value={presentedAt} onChange={(event) => setPresentedAt(event.target.value)} /></div><div className="space-y-2"><Label>Vigencia interna hasta</Label><Input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></div></div>
      <div className="space-y-2"><Label>Observaciones restringidas</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
    </div>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button><Button onClick={() => void save()} disabled={!personId || !criminalDocumentId || !sexualOffencesDocumentId || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar habilitación</Button></DialogFooter>
  </DialogContent></Dialog>
}
