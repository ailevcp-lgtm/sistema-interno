'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Download, FileCheck2, ShieldCheck, Users } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NewAdmissionDialog, NnaVerificationDialog, ResolveAdmissionDialog, VerifyAdmissionDocumentsDialog } from '@/components/aile/registro-asociados-dialogs'
import { useAuth, useRequirePermission } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { HabilitacionNna, LibroAsociadosCierre, MembresiaAsociado, SolicitudAdmision, Socio } from '@/lib/types'

const categoryLabels = { pleno: 'Socio Pleno', adherente: 'Socio Adherente', honorario: 'Socio Honorario' }
const originLabels = { fundador: 'Miembro fundador', admision_cd: 'Admisión por CD', designacion_honoraria: 'Designación honoraria' }
const admissionLabels: Record<string, string> = {
  recibida: 'Recibida',
  documentacion_incompleta: 'Documentación incompleta',
  documentacion_completa: 'Documentación completa',
  verificada_secretaria: 'Verificada por Secretaría',
  elevada_cd: 'Elevada a CD',
  admitida: 'Admitida',
  rechazada: 'Rechazada',
  archivada: 'Archivada',
}

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('es-AR').format(new Date(`${value.slice(0, 10)}T12:00:00`))
}

export default function RegistroAsociadosPage() {
  const { user, hasPermission } = useAuth()
  const { loading: checkingAccess, hasPermission: canView } = useRequirePermission('socios', 'ver', '/dashboard')
  const [memberships, setMemberships] = useState<MembresiaAsociado[]>([])
  const [applications, setApplications] = useState<SolicitudAdmision[]>([])
  const [nna, setNna] = useState<HabilitacionNna[]>([])
  const [closures, setClosures] = useState<LibroAsociadosCierre[]>([])
  const [people, setPeople] = useState<Socio[]>([])
  const [allPeople, setAllPeople] = useState<Socio[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(currentPeriod())
  const [exporting, setExporting] = useState(false)
  const [newApplicationOpen, setNewApplicationOpen] = useState(false)
  const [resolvingApplication, setResolvingApplication] = useState<SolicitudAdmision | null>(null)
  const [verifyingApplication, setVerifyingApplication] = useState<SolicitudAdmision | null>(null)
  const [nnaDialogOpen, setNnaDialogOpen] = useState(false)
  const canEdit = Boolean(user && hasPermission('socios', 'editar'))

  const load = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    try {
      const [membershipResult, applicationResult, nnaResult, closureResult, peopleResult] = await Promise.all([
        supabase
          .from('asociados_membresias')
          .select('*, socio:socios!asociados_membresias_socio_id_fkey(*)')
          .order('numero_asociado'),
        supabase
          .from('admision_solicitudes')
          .select('*, socio:socios!admision_solicitudes_socio_id_fkey(*)')
          .order('fecha_recepcion', { ascending: false }),
        canEdit
          ? supabase.from('habilitaciones_nna').select('*, socio:socios!habilitaciones_nna_socio_id_fkey(*)').order('updated_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('libro_asociados_cierres')
          .select('*, documento:documentos_legales!libro_asociados_cierres_documento_id_fkey(*)')
          .order('periodo', { ascending: false }),
        canEdit
          ? supabase.from('socios').select('*').neq('estado', 'eliminado').order('apellido')
          : Promise.resolve({ data: [], error: null }),
      ])
      const error = membershipResult.error || applicationResult.error || nnaResult.error || closureResult.error || peopleResult.error
      if (error) throw error
      setMemberships((membershipResult.data || []) as MembresiaAsociado[])
      setApplications((applicationResult.data || []) as SolicitudAdmision[])
      setNna((nnaResult.data || []) as HabilitacionNna[])
      setClosures((closureResult.data || []) as LibroAsociadosCierre[])
      const memberIds = new Set((membershipResult.data || []).filter((membership) => membership.estado !== 'baja').map((membership) => membership.socio_id))
      const openApplicationIds = new Set((applicationResult.data || []).filter((application) => !['admitida', 'rechazada', 'archivada'].includes(application.estado)).map((application) => application.socio_id))
      const loadedPeople = (peopleResult.data || []) as Socio[]
      setAllPeople(loadedPeople)
      setPeople(loadedPeople.filter((person) => !memberIds.has(person.id) && !openApplicationIds.has(person.id)))
    } catch (error) {
      console.error(error)
      toast.error('No se pudo cargar el registro formal de asociados')
    } finally {
      setLoading(false)
    }
  }, [canEdit, canView])

  useEffect(() => { void load() }, [load])

  const activeMembers = useMemo(() => memberships.filter((membership) => membership.estado === 'activo'), [memberships])
  const pendingApplications = useMemo(() => applications.filter((application) => !['admitida', 'rechazada', 'archivada'].includes(application.estado)), [applications])

  const exportBook = async () => {
    try {
      setExporting(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const response = await fetch('/api/socios/libro-asociados/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ periodo: period }),
      })
      const result = await response.json() as { error?: string; url?: string; existente?: boolean; folioDesde?: number; folioHasta?: number }
      if (!response.ok || !result.url) throw new Error(result.error || 'No se pudo generar el libro')
      window.open(result.url, '_blank', 'noopener,noreferrer')
      toast.success(result.existente ? 'Se abrió el cierre ya emitido' : `Cierre emitido en folios ${result.folioDesde}-${result.folioHasta}`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el libro')
    } finally {
      setExporting(false)
    }
  }

  if (checkingAccess || loading) return <div className="py-12 text-center text-sm text-muted-foreground">Cargando registro formal...</div>
  if (!canView) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/socios" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver a comunidad AILE
          </Link>
          <h1 className="text-2xl font-semibold">Registro formal de asociados</h1>
          <p className="mt-1 text-sm text-muted-foreground">Padrón legal, admisiones, habilitaciones NNA y Libro de Personas Asociadas.</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="w-[160px]" />
            <Button onClick={() => void exportBook()} disabled={exporting || !period}>
              <Download className="mr-2 h-4 w-4" /> {exporting ? 'Emitiendo...' : 'Cerrar y exportar PDF'}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={Users} label="Asociados activos" value={activeMembers.length} />
        <SummaryCard icon={FileCheck2} label="Solicitudes pendientes" value={pendingApplications.length} />
        <SummaryCard icon={BookOpen} label="Cierres emitidos" value={closures.length} />
      </div>

      <Tabs defaultValue="padron" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="padron">Padrón oficial</TabsTrigger>
          <TabsTrigger value="admisiones">Admisiones</TabsTrigger>
          {canEdit && <TabsTrigger value="nna">Habilitaciones NNA</TabsTrigger>}
          <TabsTrigger value="libro">Libro digital</TabsTrigger>
        </TabsList>

        <TabsContent value="padron" className="space-y-3">
          {activeMembers.length === 0 ? <Empty text="No hay personas asociadas activas en el padrón oficial." /> : activeMembers.map((membership) => (
            <Card key={membership.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">N.º {membership.numero_asociado} · {membership.socio?.apellido}, {membership.socio?.nombre}</span>
                    <Badge variant="outline">{categoryLabels[membership.categoria]}</Badge>
                    <Badge className={membership.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>{membership.estado}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">DNI {membership.socio?.dni} · Desde {formatDate(membership.fecha_inicio)} · {originLabels[membership.origen]}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{membership.instrumento_descripcion}</p>
                </div>
                <Link href={`/socios/${membership.socio_id}`}><Button variant="outline" size="sm">Ver legajo</Button></Link>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="admisiones" className="space-y-3">
          {canEdit && <div className="flex justify-end"><Button onClick={() => setNewApplicationOpen(true)}>Registrar solicitud recibida</Button></div>}
          {applications.length === 0 ? <Empty text="Todavía no hay solicitudes formalmente registradas." /> : applications.map((application) => (
            <Card key={application.id}><CardContent className="flex items-center justify-between gap-4 p-4">
              <div><p className="font-medium">{application.socio?.apellido}, {application.socio?.nombre}</p><p className="text-sm text-muted-foreground">Recibida el {formatDate(application.fecha_recepcion)} · Solicita categoría {application.categoria_solicitada}</p></div>
              <div className="flex items-center gap-2"><Badge variant="outline">{admissionLabels[application.estado] || application.estado}</Badge>{canEdit && !['admitida', 'rechazada', 'archivada'].includes(application.estado) && (application.documentacion_general_verificada ? <Button size="sm" variant="outline" onClick={() => setResolvingApplication(application)}>Registrar decisión CD</Button> : <Button size="sm" variant="outline" onClick={() => setVerifyingApplication(application)}>Verificar documentación</Button>)}</div>
            </CardContent></Card>
          ))}
        </TabsContent>

        {canEdit && <TabsContent value="nna" className="space-y-3">
          <div className="flex justify-end"><Button onClick={() => setNnaDialogOpen(true)}>Registrar habilitación NNA</Button></div>
          <Card className="border-amber-200 bg-amber-50/50"><CardContent className="flex gap-3 p-4 text-sm"><ShieldCheck className="h-5 w-5 shrink-0 text-amber-700" /><p>Este registro es restringido. La documentación sólo habilita funciones con contacto directo con NNA y no integra los requisitos generales de admisión.</p></CardContent></Card>
          {nna.length === 0 ? <Empty text="Todavía no hay habilitaciones NNA registradas." /> : nna.map((item) => {
            const expiryDates = [item.antecedentes_vence_el, item.integridad_sexual_vence_el].filter(Boolean) as string[]
            const isExpired = expiryDates.some((date) => date < new Date().toISOString().slice(0, 10))
            return <Card key={item.id}><CardContent className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium">{item.socio?.apellido}, {item.socio?.nombre}</p><p className="text-sm text-muted-foreground">Verificación: {formatDate(item.verificado_at)}{expiryDates.length ? ` · Vigencia interna hasta ${formatDate(expiryDates.sort()[0])}` : ''}</p></div><Badge variant="outline">{isExpired ? 'vencida' : item.estado}</Badge></CardContent></Card>
          })}
        </TabsContent>}

        <TabsContent value="libro" className="space-y-3">
          <Card className="border-violet-200 bg-violet-50/40"><CardContent className="p-4 text-sm">Cada cierre es correlativo, conserva la huella SHA-256 del cierre anterior y no puede regenerarse con contenido distinto. Una corrección debe asentarse en un cierre posterior.</CardContent></Card>
          {closures.length === 0 ? <Empty text="Todavía no se emitieron cierres del libro." /> : closures.map((closure) => (
            <Card key={closure.id}><CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Período {closure.periodo} · Libro N.º {closure.libro_numero}</p><p className="text-sm text-muted-foreground">Folios {closure.folio_desde} a {closure.folio_hasta} · SHA-256 {closure.sha256.slice(0, 16)}…</p></div><Badge variant="outline">{closure.estado === 'presentado_ipj' ? 'Presentado ante IPJ' : 'Cerrado'}</Badge></CardContent></Card>
          ))}
        </TabsContent>
      </Tabs>
      <NewAdmissionDialog open={newApplicationOpen} onOpenChange={setNewApplicationOpen} people={people} actorSocioId={user?.socio_id} onSaved={() => void load()} />
      <VerifyAdmissionDocumentsDialog open={Boolean(verifyingApplication)} onOpenChange={(open) => !open && setVerifyingApplication(null)} application={verifyingApplication} actorSocioId={user?.socio_id} onSaved={() => { setVerifyingApplication(null); void load() }} />
      <ResolveAdmissionDialog open={Boolean(resolvingApplication)} onOpenChange={(open) => !open && setResolvingApplication(null)} application={resolvingApplication} onSaved={() => { setResolvingApplication(null); void load() }} />
      <NnaVerificationDialog open={nnaDialogOpen} onOpenChange={setNnaDialogOpen} people={allPeople} actorSocioId={user?.socio_id} onSaved={() => void load()} />
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="h-4 w-4 text-primary" /></CardHeader><CardContent><p className="text-2xl font-semibold">{value}</p></CardContent></Card>
}

function Empty({ text }: { text: string }) {
  return <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">{text}</CardContent></Card>
}
