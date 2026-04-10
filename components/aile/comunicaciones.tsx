"use client"

import { useEffect, useMemo, useState } from 'react'
import {
  Eye,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCcw,
  Send,
  Shield,
  Tags,
  TestTube2,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useComunicaciones } from '@/hooks/useComunicaciones'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatDateTime } from '@/lib/utils'
import { getAgeFromBirthDate, matchesAgeRange } from '@/lib/communications/utils'
import type {
  CommunicationCampaign,
  CommunicationCampaignFilters,
  CommunicationContact,
  CommunicationEmailContent,
  CommunicationSegment,
  CommunicationTemplate,
} from '@/lib/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

const DEFAULT_SENDER_NAME = 'AILE'
const DEFAULT_SENDER_EMAIL = 'notificaciones@aile.org.ar'

type CampaignDraft = Omit<CommunicationCampaign, 'id' | 'created_at' | 'updated_at' | 'filters_json' | 'content_json'> & {
  id?: string
  content_json: CommunicationEmailContent
  filters_json: CommunicationCampaignFilters
}
type TemplateDraft = {
  id?: string
  name: string
  key?: string | null
  description?: string | null
  is_system?: boolean
  content_json: CommunicationEmailContent
}

type SegmentDraft = {
  id?: string
  name: string
  description?: string | null
  criteria_json: CommunicationCampaignFilters
}

const contactStatusLabels: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
}

const campaignStatusLabels: Record<string, string> = {
  draft: 'Borrador',
  test_sent: 'Prueba enviada',
  scheduled: 'Programada',
  sending: 'Enviando',
  sent: 'Enviada',
  failed: 'Fallida',
}

const recipientStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  test_sent: 'Prueba',
  sent: 'Enviado',
  failed: 'Fallido',
  skipped: 'Omitido',
  delivered: 'Entregado',
  opened: 'Abierto',
  clicked: 'Click',
  bounced: 'Rebote',
  unsubscribed: 'Baja',
}

function emptyContent(): CommunicationEmailContent {
  return {
    title: '',
    body: '',
    ctaLabel: '',
    ctaUrl: '',
    footerNote: 'Gracias por seguir formando parte de AILE.',
  }
}

function emptyCampaign(): CampaignDraft {
  return {
    name: '',
    subject: '',
    preheader: '',
    sender_name: DEFAULT_SENDER_NAME,
    sender_email: DEFAULT_SENDER_EMAIL,
    template_id: null,
    status: 'draft',
    content_json: emptyContent(),
    selection_mode: 'manual',
    filters_json: {
      contactIds: [],
      tags: [],
      statuses: ['active'],
      sources: [],
      optInOnly: false,
      minAge: undefined,
      maxAge: undefined,
    },
    recipient_count_snapshot: {},
    last_error: null,
    sent_at: null,
  }
}

function emptyTemplate(): TemplateDraft {
  return {
    name: '',
    key: null,
    description: '',
    is_system: false,
    content_json: emptyContent(),
  }
}

function emptySegment(): SegmentDraft {
  return {
    name: '',
    description: '',
    criteria_json: {
      tags: [],
      statuses: ['active'],
      sources: [],
      optInOnly: false,
      minAge: undefined,
      maxAge: undefined,
    },
  }
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function getContactDisplayName(contact: CommunicationContact) {
  return contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.account_name || contact.email
}

function getContactInitials(contact: CommunicationContact) {
  const name = getContactDisplayName(contact)
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'A'
}

function buildSegmentSummary(filters: CommunicationCampaignFilters) {
  const parts: string[] = []

  if (filters.minAge !== undefined || filters.maxAge !== undefined) {
    if (filters.minAge !== undefined && filters.maxAge !== undefined) {
      parts.push(`Edad ${filters.minAge}-${filters.maxAge}`)
    } else if (filters.minAge !== undefined) {
      parts.push(`Desde ${filters.minAge} años`)
    } else if (filters.maxAge !== undefined) {
      parts.push(`Hasta ${filters.maxAge} años`)
    }
  }

  if (filters.tags?.length) {
    parts.push(`Tags: ${filters.tags.join(', ')}`)
  }

  if (filters.sources?.length) {
    parts.push(`Fuentes: ${filters.sources.join(', ')}`)
  }

  if (filters.statuses?.length) {
    parts.push(`Estados: ${filters.statuses.map((status) => contactStatusLabels[status] || status).join(', ')}`)
  }

  if (filters.optInOnly) {
    parts.push('Solo opt-in')
  }

  return parts.join(' • ') || 'Sin criterios específicos'
}

function toSegmentDraft(segment: CommunicationSegment): SegmentDraft {
  return {
    id: segment.id,
    name: segment.name,
    description: segment.description || '',
    criteria_json: {
      contactIds: (segment.criteria_json?.contactIds || []).slice(),
      tags: (segment.criteria_json?.tags || []).slice(),
      statuses: (segment.criteria_json?.statuses || []).slice(),
      sources: (segment.criteria_json?.sources || []).slice(),
      optInOnly: Boolean(segment.criteria_json?.optInOnly),
      minAge: segment.criteria_json?.minAge,
      maxAge: segment.criteria_json?.maxAge,
    },
  }
}

function toCampaignDraft(campaign: CommunicationCampaign) {
  return {
    ...campaign,
    filters_json: {
      contactIds: (campaign.filters_json?.contactIds || []).slice(),
      tags: (campaign.filters_json?.tags || []).slice(),
      statuses: (campaign.filters_json?.statuses || []).slice(),
      sources: (campaign.filters_json?.sources || []).slice(),
      optInOnly: Boolean(campaign.filters_json?.optInOnly),
      minAge: campaign.filters_json?.minAge,
      maxAge: campaign.filters_json?.maxAge,
    },
    content_json: {
      title: campaign.content_json?.title || '',
      body: campaign.content_json?.body || '',
      ctaLabel: campaign.content_json?.ctaLabel || '',
      ctaUrl: campaign.content_json?.ctaUrl || '',
      footerNote: campaign.content_json?.footerNote || '',
    },
  }
}

function toTemplateDraft(template: CommunicationTemplate) {
  return {
    ...template,
    content_json: {
      title: template.content_json?.title || '',
      body: template.content_json?.body || '',
      ctaLabel: template.content_json?.ctaLabel || '',
      ctaUrl: template.content_json?.ctaUrl || '',
      footerNote: template.content_json?.footerNote || '',
    },
  }
}

function computeAudience(
  campaign: Omit<CommunicationCampaign, 'id' | 'created_at' | 'updated_at'>,
  contacts: CommunicationContact[]
) {
  let selected = contacts

  if (campaign.selection_mode === 'manual') {
    const idSet = new Set(campaign.filters_json?.contactIds || [])
    selected = contacts.filter((contact) => idSet.has(contact.id))
  } else {
    selected = contacts.filter((contact) => {
      const matchesTags = !(campaign.filters_json?.tags?.length)
        || campaign.filters_json.tags.some((tag) => (contact.tags || []).includes(tag))
      const matchesStatus = !(campaign.filters_json?.statuses?.length)
        || campaign.filters_json.statuses.includes(contact.status)
      const matchesSource = !(campaign.filters_json?.sources?.length)
        || campaign.filters_json.sources.includes(contact.source || '')
      const matchesOptIn = !campaign.filters_json?.optInOnly || contact.opt_in === true
      const matchesAge = matchesAgeRange(contact.birth_date, campaign.filters_json?.minAge, campaign.filters_json?.maxAge)

      return matchesTags && matchesStatus && matchesSource && matchesOptIn && matchesAge
    })
  }

  const deduped = Array.from(
    new Map(selected.map((contact) => [contact.email.toLowerCase(), contact])).values()
  )

  const valid = deduped.filter((contact) => contact.status === 'active' && !contact.unsubscribed && !contact.bounced)
  const skipped = deduped.filter((contact) => !valid.some((validContact) => validContact.id === contact.id))

  return { selected: deduped, valid, skipped }
}

function campaignSnapshotNumber(value: Record<string, unknown> | null | undefined, key: string) {
  const snapshotValue = value?.[key]
  return typeof snapshotValue === 'number' ? snapshotValue : 0
}

export function ComunicacionesPage() {
  const {
    contacts,
    campaigns,
    templates,
    segments,
    syncRuns,
    moduleAccess,
    socios,
    campaignRecipients,
    loading,
    loadAll,
    saveContact,
    saveTemplate,
    deleteTemplate,
    saveSegment,
    deleteSegment,
    applyManualTagFromFilters,
    saveCampaign,
    deleteCampaign,
    loadCampaignRecipients,
    requestPreview,
    sendTest,
    sendCampaign,
    syncContacts,
    grantModuleAccess,
    revokeModuleAccess,
    resolveContactsByFilters,
  } = useComunicaciones()
  const { hasActualPermission } = useAuth()

  const [activeTab, setActiveTab] = useState('contactos')
  const [contactSearch, setContactSearch] = useState('')
  const [contactStatusFilter, setContactStatusFilter] = useState('all')
  const [contactTagFilter, setContactTagFilter] = useState('all')
  const [contactMinAge, setContactMinAge] = useState('')
  const [contactMaxAge, setContactMaxAge] = useState('')
  const [contactEditor, setContactEditor] = useState<CommunicationContact | null>(null)
  const [contactTagsDraft, setContactTagsDraft] = useState('')

  const [campaignEditorOpen, setCampaignEditorOpen] = useState(false)
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft>({ ...emptyCampaign() })
  const [campaignPreviewHtml, setCampaignPreviewHtml] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testEmailsDraft, setTestEmailsDraft] = useState('')
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

  const [templateEditorOpen, setTemplateEditorOpen] = useState(false)
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null)
  const [segmentDraft, setSegmentDraft] = useState<SegmentDraft>(emptySegment())
  const [segmentTagDraft, setSegmentTagDraft] = useState('')

  const [selectedAccessUserId, setSelectedAccessUserId] = useState('')
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    if (!selectedCampaignId) return
    void loadCampaignRecipients(selectedCampaignId)
  }, [loadCampaignRecipients, selectedCampaignId])

  useEffect(() => {
    if (!contactEditor) return
    setContactTagsDraft((contactEditor.manual_tags || []).join(', '))
  }, [contactEditor])

  const canManageAccess = hasActualPermission('comunicaciones', 'editar') || hasActualPermission('configuracion', 'editar')

  const allTags = useMemo(() => uniqueValues(contacts.flatMap((contact) => contact.tags || [])), [contacts])
  const allSources = useMemo(() => uniqueValues(contacts.map((contact) => contact.source || '').filter(Boolean)), [contacts])

  const filteredContacts = useMemo(() => {
    const needle = contactSearch.trim().toLowerCase()
    return contacts.filter((contact) => {
      const matchesSearch = !needle
        || contact.email.toLowerCase().includes(needle)
        || (contact.full_name || '').toLowerCase().includes(needle)
        || `${contact.first_name || ''} ${contact.last_name || ''}`.toLowerCase().includes(needle)
        || (contact.account_name || '').toLowerCase().includes(needle)
        || (contact.dni || '').toLowerCase().includes(needle)
        || (contact.phone_number || '').toLowerCase().includes(needle)
      const matchesStatus = contactStatusFilter === 'all' || contact.status === contactStatusFilter
      const matchesTag = contactTagFilter === 'all' || (contact.tags || []).includes(contactTagFilter)
      const matchesAge = matchesAgeRange(
        contact.birth_date,
        contactMinAge ? Number(contactMinAge) : undefined,
        contactMaxAge ? Number(contactMaxAge) : undefined
      )

      return matchesSearch && matchesStatus && matchesTag && matchesAge
    })
  }, [contactSearch, contactStatusFilter, contactTagFilter, contactMinAge, contactMaxAge, contacts])

  const currentCampaignRecipients = selectedCampaignId ? (campaignRecipients[selectedCampaignId] || []) : []
  const currentCampaign = selectedCampaignId ? campaigns.find((campaign) => campaign.id === selectedCampaignId) || null : null
  const draftAudience = useMemo(() => computeAudience(campaignDraft, contacts), [campaignDraft, contacts])
  const segmentAudience = useMemo(() => resolveContactsByFilters(segmentDraft.criteria_json), [resolveContactsByFilters, segmentDraft])

  const availableSociosForAccess = useMemo(() => {
    const existing = new Set(moduleAccess.map((access) => access.user_id))
    return socios.filter((socio) => socio.usuario_id && !existing.has(socio.usuario_id))
  }, [moduleAccess, socios])

  const openCampaignEditor = (campaign?: CommunicationCampaign) => {
    if (campaign) {
      setCampaignDraft({ ...toCampaignDraft(campaign), id: campaign.id })
    } else {
      setCampaignDraft({ ...emptyCampaign() })
    }
    setCampaignEditorOpen(true)
  }

  const openTemplateEditor = (template?: CommunicationTemplate) => {
    if (template) {
      setTemplateDraft({ ...toTemplateDraft(template), id: template.id })
    } else {
      setTemplateDraft({ ...emptyTemplate() })
    }
    setTemplateEditorOpen(true)
  }

  const openContactDetail = (contact: CommunicationContact) => {
    setContactEditor(contact)
  }

  const loadSegmentIntoBuilder = (segment?: CommunicationSegment) => {
    setSegmentDraft(segment ? toSegmentDraft(segment) : emptySegment())
  }

  const handleSaveContact = async () => {
    if (!contactEditor) return

    try {
      await saveContact({
        id: contactEditor.id,
        first_name: contactEditor.first_name || null,
        last_name: contactEditor.last_name || null,
        full_name: contactEditor.full_name || null,
        account_name: contactEditor.account_name || null,
        account_image_url: contactEditor.account_image_url || null,
        account_roles: contactEditor.account_roles || [],
        email_verified_at: contactEditor.email_verified_at || null,
        account_is_active: contactEditor.account_is_active ?? null,
        birth_date: contactEditor.birth_date || null,
        dni: contactEditor.dni || null,
        phone_number: contactEditor.phone_number || null,
        status: contactEditor.status,
        opt_in: contactEditor.opt_in ?? null,
        unsubscribed: contactEditor.unsubscribed,
        bounced: contactEditor.bounced,
        metadata: contactEditor.metadata || {},
        tags: contactTagsDraft.split(',').map((value) => value.trim()).filter(Boolean),
      })
      setContactEditor(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el contacto')
    }
  }

  const handleSaveTemplate = async () => {
    if (!templateDraft) return

    try {
      await saveTemplate({
        id: templateDraft.id,
        name: templateDraft.name,
        key: templateDraft.key || null,
        description: templateDraft.description || null,
        content_json: templateDraft.content_json,
      })
      setTemplateEditorOpen(false)
      setTemplateDraft(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la plantilla')
    }
  }

  const buildCampaignSaveInput = () => ({
    id: campaignDraft.id,
    name: campaignDraft.name,
    subject: campaignDraft.subject,
    preheader: campaignDraft.preheader || null,
    sender_name: campaignDraft.sender_name || DEFAULT_SENDER_NAME,
    sender_email: campaignDraft.sender_email || DEFAULT_SENDER_EMAIL,
    template_id: campaignDraft.template_id || null,
    status: campaignDraft.status,
    content_json: campaignDraft.content_json,
    selection_mode: campaignDraft.selection_mode,
    filters_json: campaignDraft.filters_json || {},
  })

  const handleSaveCampaign = async () => {
    try {
      await saveCampaign(buildCampaignSaveInput())
      setCampaignEditorOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la campana')
    }
  }

  const handlePreviewCampaign = async () => {
    try {
      const html = await requestPreview(campaignDraft)
      setCampaignPreviewHtml(html)
      setPreviewOpen(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo generar la vista previa')
    }
  }

  const handleSendTest = async () => {
    const testEmails = testEmailsDraft
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    try {
      const result = await sendTest(campaignDraft, testEmails, campaignDraft.id)
      toast.success(`Pruebas enviadas: ${result.sent}. Fallidas: ${result.failed}.`)
      setTestDialogOpen(false)
      setTestEmailsDraft('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron enviar las pruebas')
    }
  }

  const handleSendCampaign = async () => {
    if (!campaignDraft.id) {
      toast.error('Guarda la campana antes de enviarla')
      return
    }

    try {
      setSendingCampaignId(campaignDraft.id)
      await saveCampaign(buildCampaignSaveInput(), { silent: true })
      const result = await sendCampaign(campaignDraft.id)
      toast.success(`Campana procesada. Enviados: ${result.sent}. Fallidos: ${result.failed}.`)
      setSendConfirmOpen(false)
      setCampaignEditorOpen(false)
      setSelectedCampaignId(campaignDraft.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar la campana')
    } finally {
      setSendingCampaignId(null)
    }
  }

  const handleSyncContacts = async () => {
    try {
      setSyncing(true)
      const result = await syncContacts()
      toast.success(`Sync finalizada. Nuevos: ${result.created}, actualizados: ${result.updated}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo sincronizar la base externa')
    } finally {
      setSyncing(false)
    }
  }

  const handleGrantAccess = async () => {
    if (!selectedAccessUserId) return
    try {
      await grantModuleAccess(selectedAccessUserId)
      setSelectedAccessUserId('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo otorgar el acceso')
    }
  }

  const handleSaveSegment = async () => {
    try {
      await saveSegment({
        id: segmentDraft.id,
        name: segmentDraft.name,
        description: segmentDraft.description || null,
        criteria_json: segmentDraft.criteria_json,
      })
      setSegmentDraft(emptySegment())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el filtro')
    }
  }

  const handleApplySegmentTag = async () => {
    try {
      const result = await applyManualTagFromFilters({
        tag: segmentTagDraft,
        filters: segmentDraft.criteria_json,
      })
      toast.success(`Tag aplicada. Coincidencias: ${result.matched}. Nuevas: ${result.inserted}.`)
      setSegmentTagDraft('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo aplicar la etiqueta')
    }
  }

  const applySegmentToCampaign = (segment: CommunicationSegment) => {
    setCampaignDraft((current) => ({
      ...current,
      selection_mode: 'filters',
      filters_json: {
        contactIds: (segment.criteria_json?.contactIds || []).slice(),
        tags: (segment.criteria_json?.tags || []).slice(),
        statuses: (segment.criteria_json?.statuses || []).slice(),
        sources: (segment.criteria_json?.sources || []).slice(),
        optInOnly: Boolean(segment.criteria_json?.optInOnly),
        minAge: segment.criteria_json?.minAge,
        maxAge: segment.criteria_json?.maxAge,
      },
    }))
    setCampaignEditorOpen(true)
    setActiveTab('campanas')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando modulo de comunicaciones...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comunicaciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestión de contactos, plantillas, campañas institucionales y sincronización desde MongoDB.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => void loadAll()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => void handleSyncContacts()} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Sincronizar contactos
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Contactos</CardDescription>
            <CardTitle className="text-3xl">{contacts.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Campañas</CardDescription>
            <CardTitle className="text-3xl">{campaigns.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Plantillas</CardDescription>
            <CardTitle className="text-3xl">{templates.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Última sync</CardDescription>
            <CardTitle className="text-base">
              {syncRuns[0]?.started_at ? formatDateTime(syncRuns[0].started_at) : 'Sin ejecuciones'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full flex-nowrap overflow-x-auto border border-border bg-muted">
          <TabsTrigger className="shrink-0" value="contactos">
            <Users className="mr-2 h-4 w-4" />
            Contactos
          </TabsTrigger>
          <TabsTrigger className="shrink-0" value="segmentos">
            <Tags className="mr-2 h-4 w-4" />
            Segmentos
          </TabsTrigger>
          <TabsTrigger className="shrink-0" value="campanas">
            <Mail className="mr-2 h-4 w-4" />
            Campañas
          </TabsTrigger>
          <TabsTrigger className="shrink-0" value="plantillas">
            <Pencil className="mr-2 h-4 w-4" />
            Plantillas
          </TabsTrigger>
          {canManageAccess ? (
            <TabsTrigger className="shrink-0" value="accesos">
              <Shield className="mr-2 h-4 w-4" />
              Accesos
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="contactos">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Base de contactos</CardTitle>
                  <CardDescription>Busca, revisa estado y administra etiquetas.</CardDescription>
                </div>
                <div className="grid w-full gap-2 sm:grid-cols-2 xl:grid-cols-5 xl:w-auto">
                  <Input
                    value={contactSearch}
                    onChange={(event) => setContactSearch(event.target.value)}
                    placeholder="Buscar por nombre, email, DNI o teléfono"
                  />
                  <select
                    value={contactStatusFilter}
                    onChange={(event) => setContactStatusFilter(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="active">Activos</option>
                    <option value="inactive">Inactivos</option>
                  </select>
                  <select
                    value={contactTagFilter}
                    onChange={(event) => setContactTagFilter(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="all">Todas las etiquetas</option>
                    {allTags.map((tag) => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min="0"
                    max="120"
                    value={contactMinAge}
                    onChange={(event) => setContactMinAge(event.target.value)}
                    placeholder="Edad mínima"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="120"
                    value={contactMaxAge}
                    onChange={(event) => setContactMaxAge(event.target.value)}
                    placeholder="Edad máxima"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:hidden">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    role="button"
                    tabIndex={0}
                    className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/30"
                    onClick={() => openContactDetail(contact)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openContactDetail(contact)
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <Avatar className="h-10 w-10 border">
                          <AvatarImage src={contact.account_image_url || undefined} alt={getContactDisplayName(contact)} />
                          <AvatarFallback>{getContactInitials(contact)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium break-words">{getContactDisplayName(contact)}</div>
                          <div className="text-xs text-muted-foreground break-all">{contact.email}</div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation()
                          openContactDetail(contact)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <ResponsiveInfoRow label="Estado" value={<Badge variant="outline">{contactStatusLabels[contact.status] || contact.status}</Badge>} />
                      <ResponsiveInfoRow
                        label="Perfil"
                        value={
                          <div className="text-right text-xs text-muted-foreground">
                            <div>{contact.birth_date ? `Edad ${getAgeFromBirthDate(contact.birth_date) ?? '-'}${contact.dni ? ` · DNI ${contact.dni}` : ''}` : (contact.dni ? `DNI ${contact.dni}` : '-')}</div>
                            <div>{contact.phone_number || contact.account_name || '-'}</div>
                          </div>
                        }
                      />
                      <ResponsiveInfoRow label="Fuente" value={contact.source || '-'} />
                      <ResponsiveInfoRow
                        label="Etiquetas"
                        value={
                          <div className="flex flex-wrap justify-end gap-1">
                            {(contact.tags || []).length ? (contact.tags || []).map((tag) => (
                              <Badge
                                key={tag}
                                className={cn(
                                  'border-0',
                                  (contact.synced_tags || []).includes(tag)
                                    ? 'bg-sky-500/15 text-sky-700'
                                    : 'bg-primary/15 text-primary'
                                )}
                              >
                                {tag}
                              </Badge>
                            )) : <span className="text-xs text-muted-foreground">Sin tags</span>}
                          </div>
                        }
                      />
                      <ResponsiveInfoRow
                        label="Flags"
                        value={
                          <div className="flex flex-wrap justify-end gap-1">
                            {contact.unsubscribed ? <Badge className="border-0 bg-amber-500/20 text-amber-700">Baja</Badge> : null}
                            {contact.bounced ? <Badge className="border-0 bg-destructive/20 text-destructive">Bounce</Badge> : null}
                            {contact.opt_in === true ? <Badge className="border-0 bg-emerald-500/20 text-emerald-700">Opt-in</Badge> : null}
                            {!contact.unsubscribed && !contact.bounced && contact.opt_in !== true ? <span className="text-xs text-muted-foreground">Sin flags</span> : null}
                          </div>
                        }
                      />
                      <ResponsiveInfoRow label="Última sync" value={contact.last_synced_at ? formatDateTime(contact.last_synced_at) : '-'} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Fuente</TableHead>
                      <TableHead>Etiquetas</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead>Última sync</TableHead>
                      <TableHead className="w-[90px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((contact) => (
                      <TableRow
                        key={contact.id}
                        className="cursor-pointer"
                        onClick={() => openContactDetail(contact)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border">
                              <AvatarImage src={contact.account_image_url || undefined} alt={getContactDisplayName(contact)} />
                              <AvatarFallback>{getContactInitials(contact)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{getContactDisplayName(contact)}</div>
                              <div className="text-xs text-muted-foreground">{contact.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{contactStatusLabels[contact.status] || contact.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{contact.birth_date ? `Edad ${getAgeFromBirthDate(contact.birth_date) ?? '-'}` : '-'}</div>
                          <div>{contact.dni || contact.phone_number || '-'}</div>
                        </TableCell>
                        <TableCell>{contact.source || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(contact.tags || []).length ? (contact.tags || []).map((tag) => (
                              <Badge
                                key={tag}
                                className={cn(
                                  'border-0',
                                  (contact.synced_tags || []).includes(tag)
                                    ? 'bg-sky-500/15 text-sky-700'
                                    : 'bg-primary/15 text-primary'
                                )}
                              >
                                {tag}
                              </Badge>
                            )) : <span className="text-xs text-muted-foreground">Sin tags</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {contact.unsubscribed ? <Badge className="border-0 bg-amber-500/20 text-amber-700">Baja</Badge> : null}
                            {contact.bounced ? <Badge className="border-0 bg-destructive/20 text-destructive">Bounce</Badge> : null}
                            {contact.opt_in === true ? <Badge className="border-0 bg-emerald-500/20 text-emerald-700">Opt-in</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {contact.last_synced_at ? formatDateTime(contact.last_synced_at) : '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation()
                              openContactDetail(contact)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segmentos">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Filtros guardados</CardTitle>
                <CardDescription>Reutilízalos para campañas o para aplicar tags locales.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {segments.map((segment) => {
                  const matchedCount = resolveContactsByFilters(segment.criteria_json).length
                  return (
                    <div key={segment.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{segment.name}</div>
                          <div className="text-xs text-muted-foreground">{segment.description || 'Sin descripción'}</div>
                        </div>
                        <Badge variant="outline">{matchedCount} contactos</Badge>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {buildSegmentSummary(segment.criteria_json)}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => loadSegmentIntoBuilder(segment)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => applySegmentToCampaign(segment)}>
                          Usar en campaña
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!window.confirm(`Eliminar el filtro "${segment.name}"?`)) return
                            void deleteSegment(segment.id).catch((error) => {
                              toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el filtro')
                            })
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  )
                })}
                {segments.length === 0 ? (
                  <div className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                    Todavía no guardaste filtros reutilizables.
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Tags locales y filtros</CardTitle>
                  <CardDescription>
                    Crea segmentaciones para email marketing sin escribir en Mongo. Las tags sincronizadas desde `aile.com.ar` siguen siendo solo lectura.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                    El sistema maestro de usuarios y tags sincronizadas sigue siendo `aile.com.ar`.
                    Todo lo que crees acá se guarda únicamente en Supabase como segmentación local para campañas institucionales.
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nombre del filtro">
                      <Input
                        value={segmentDraft.name}
                        onChange={(event) => setSegmentDraft((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Ej: Mayores de 18"
                      />
                    </Field>
                    <Field label="Descripción">
                      <Input
                        value={segmentDraft.description || ''}
                        onChange={(event) => setSegmentDraft((current) => ({ ...current, description: event.target.value }))}
                        placeholder="Uso interno para campañas"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Edad mínima">
                      <Input
                        type="number"
                        min="0"
                        max="120"
                        value={segmentDraft.criteria_json.minAge ?? ''}
                        onChange={(event) => setSegmentDraft((current) => ({
                          ...current,
                          criteria_json: {
                            ...current.criteria_json,
                            minAge: event.target.value ? Number(event.target.value) : undefined,
                          },
                        }))}
                      />
                    </Field>
                    <Field label="Edad máxima">
                      <Input
                        type="number"
                        min="0"
                        max="120"
                        value={segmentDraft.criteria_json.maxAge ?? ''}
                        onChange={(event) => setSegmentDraft((current) => ({
                          ...current,
                          criteria_json: {
                            ...current.criteria_json,
                            maxAge: event.target.value ? Number(event.target.value) : undefined,
                          },
                        }))}
                      />
                    </Field>
                    <Field label="Tags requeridas">
                      <Input
                        value={(segmentDraft.criteria_json.tags || []).join(', ')}
                        onChange={(event) => setSegmentDraft((current) => ({
                          ...current,
                          criteria_json: {
                            ...current.criteria_json,
                            tags: event.target.value.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean),
                          },
                        }))}
                        placeholder="Ej: delegado, ex-delegado"
                      />
                    </Field>
                    <Field label="Fuentes">
                      <Input
                        value={(segmentDraft.criteria_json.sources || []).join(', ')}
                        onChange={(event) => setSegmentDraft((current) => ({
                          ...current,
                          criteria_json: {
                            ...current.criteria_json,
                            sources: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
                          },
                        }))}
                        placeholder={allSources.join(', ') || 'mongodb, manual'}
                      />
                    </Field>
                    <Field label="Estados">
                      <div className="flex gap-3 pt-2 text-sm">
                        {(['active', 'inactive'] as const).map((status) => (
                          <label key={status} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={(segmentDraft.criteria_json.statuses || []).includes(status)}
                              onChange={(event) => {
                                const nextStatuses = new Set(segmentDraft.criteria_json.statuses || [])
                                if (event.target.checked) nextStatuses.add(status)
                                else nextStatuses.delete(status)
                                setSegmentDraft((current) => ({
                                  ...current,
                                  criteria_json: {
                                    ...current.criteria_json,
                                    statuses: Array.from(nextStatuses),
                                  },
                                }))
                              }}
                            />
                            {contactStatusLabels[status]}
                          </label>
                        ))}
                      </div>
                    </Field>
                    <Field label="Opt-in requerido">
                      <label className="flex items-center gap-2 pt-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(segmentDraft.criteria_json.optInOnly)}
                          onChange={(event) => setSegmentDraft((current) => ({
                            ...current,
                            criteria_json: {
                              ...current.criteria_json,
                              optInOnly: event.target.checked,
                            },
                          }))}
                        />
                        Solo contactos con consentimiento
                      </label>
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
                    <Field label="Tag local a aplicar">
                      <Input
                        value={segmentTagDraft}
                        onChange={(event) => setSegmentTagDraft(event.target.value)}
                        placeholder="Ej: mayores-18"
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button className="w-full" variant="outline" onClick={() => void handleApplySegmentTag()}>
                        Aplicar tag local
                      </Button>
                    </div>
                    <div className="flex items-end">
                      <Button className="w-full" onClick={() => void handleSaveSegment()}>
                        {segmentDraft.id ? 'Actualizar filtro' : 'Guardar filtro'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Vista previa</CardTitle>
                  <CardDescription>Contactos que coinciden con el filtro actual.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <MetricLine label="Coincidencias" value={segmentAudience.length} />
                  <MetricLine
                    label="Promedio de edad"
                    value={
                      segmentAudience.length
                        ? Math.round(
                          segmentAudience
                            .map((contact) => getAgeFromBirthDate(contact.birth_date))
                            .filter((age): age is number => age !== null)
                            .reduce((total, age) => total + age, 0)
                          / Math.max(segmentAudience.filter((contact) => getAgeFromBirthDate(contact.birth_date) !== null).length, 1)
                        )
                        : '-'
                    }
                  />
                  <MetricLine label="Con tag local actual" value={segmentTagDraft ? segmentAudience.filter((contact) => (contact.manual_tags || []).includes(segmentTagDraft.trim().toLowerCase())).length : '-'} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Primeros contactos</CardTitle>
                  <CardDescription>Muestra rápida de la selección.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {segmentAudience.slice(0, 8).map((contact) => (
                    <div key={contact.id} className="rounded-md border px-3 py-2 text-sm">
                      <div className="font-medium">{getContactDisplayName(contact)}</div>
                      <div className="text-xs text-muted-foreground">{contact.email}</div>
                    </div>
                  ))}
                  {segmentAudience.length === 0 ? (
                    <div className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                      No hay contactos que cumplan este filtro.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="campanas">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                  <CardTitle className="text-xl">Campañas</CardTitle>
                    <CardDescription>Borradores, pruebas, envios y resultados.</CardDescription>
                  </div>
                  <Button className="w-full sm:w-auto" onClick={() => openCampaignEditor()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva campana
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 md:hidden">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className={cn('rounded-lg border p-4', selectedCampaignId === campaign.id && 'border-primary/40 bg-primary/5')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium break-words">{campaign.name}</div>
                          <div className="text-xs text-muted-foreground break-words">{campaign.subject}</div>
                        </div>
                        <Badge variant="outline">{campaignStatusLabels[campaign.status] || campaign.status}</Badge>
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <ResponsiveInfoRow label="Validos" value={campaignSnapshotNumber(campaign.recipient_count_snapshot, 'valid')} />
                        <ResponsiveInfoRow label="Enviados" value={campaignSnapshotNumber(campaign.recipient_count_snapshot, 'sent')} />
                        <ResponsiveInfoRow label="Actualizada" value={formatDateTime(campaign.updated_at)} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openCampaignEditor(campaign)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setSelectedCampaignId(campaign.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver resultado
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!window.confirm(`Eliminar la campana "${campaign.name}"?`)) return
                            void deleteCampaign(campaign.id).catch((error) => {
                              toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la campana')
                            })
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campana</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Destinatarios</TableHead>
                        <TableHead>Actualizada</TableHead>
                        <TableHead className="w-[140px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((campaign) => (
                        <TableRow
                          key={campaign.id}
                          className={cn(selectedCampaignId === campaign.id && 'bg-muted/60')}
                        >
                          <TableCell>
                            <div className="font-medium">{campaign.name}</div>
                            <div className="text-xs text-muted-foreground">{campaign.subject}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{campaignStatusLabels[campaign.status] || campaign.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>Validos: {campaignSnapshotNumber(campaign.recipient_count_snapshot, 'valid')}</div>
                            <div className="text-muted-foreground">Enviados: {campaignSnapshotNumber(campaign.recipient_count_snapshot, 'sent')}</div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDateTime(campaign.updated_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openCampaignEditor(campaign)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setSelectedCampaignId(campaign.id)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (!window.confirm(`Eliminar la campana "${campaign.name}"?`)) return
                                  void deleteCampaign(campaign.id).catch((error) => {
                                    toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la campana')
                                  })
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Detalle y resultados</CardTitle>
                <CardDescription>
                  {currentCampaign ? `Detalle de ${currentCampaign.name}` : 'Selecciona una campana para ver sus destinatarios'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentCampaign ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MetricCard label="Enviados" value={campaignSnapshotNumber(currentCampaign.recipient_count_snapshot, 'sent')} />
                      <MetricCard label="Fallidos" value={campaignSnapshotNumber(currentCampaign.recipient_count_snapshot, 'failed')} />
                      <MetricCard label="Omitidos" value={campaignSnapshotNumber(currentCampaign.recipient_count_snapshot, 'skipped')} />
                    </div>

                    <div className="space-y-3 md:hidden">
                      {currentCampaignRecipients.map((recipient) => (
                        <div key={recipient.id} className="rounded-lg border p-4">
                          <div className="font-medium break-all">{recipient.email}</div>
                          <div className="mt-3 space-y-2 text-sm">
                            <ResponsiveInfoRow
                              label="Estado"
                              value={<Badge variant="outline">{recipientStatusLabels[recipient.delivery_status] || recipient.delivery_status}</Badge>}
                            />
                            <ResponsiveInfoRow label="Error" value={recipient.error_message || '-'} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden rounded-md border md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentCampaignRecipients.map((recipient) => (
                            <TableRow key={recipient.id}>
                              <TableCell>{recipient.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{recipientStatusLabels[recipient.delivery_status] || recipient.delivery_status}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {recipient.error_message || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Aun no seleccionaste ninguna campana.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plantillas">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Plantillas institucionales</CardTitle>
                  <CardDescription>Base visual unificada para comunicaciones de AILE.</CardDescription>
                </div>
                <Button className="w-full sm:w-auto" onClick={() => openTemplateEditor()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva plantilla
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:hidden">
                {templates.map((template) => (
                  <div key={template.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium break-words">{template.name}</div>
                        <div className="text-xs text-muted-foreground break-words">{template.description || 'Sin descripcion'}</div>
                      </div>
                      <Badge variant="outline">{template.is_system ? 'Sistema' : 'Editable'}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openTemplateEditor(template)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      {!template.is_system ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!window.confirm(`Eliminar la plantilla "${template.name}"?`)) return
                            void deleteTemplate(template.id).catch((error) => {
                              toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la plantilla')
                            })
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Descripcion</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="w-[120px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{template.description || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.is_system ? 'Sistema' : 'Editable'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openTemplateEditor(template)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!template.is_system ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (!window.confirm(`Eliminar la plantilla "${template.name}"?`)) return
                                  void deleteTemplate(template.id).catch((error) => {
                                    toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la plantilla')
                                  })
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {canManageAccess ? (
          <TabsContent value="accesos">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Acceso puntual al modulo</CardTitle>
                <CardDescription>
                  Habilita personas concretas para operar Comunicaciones ademas de CD y admin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <select
                    value={selectedAccessUserId}
                    onChange={(event) => setSelectedAccessUserId(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Selecciona un usuario</option>
                    {availableSociosForAccess.map((socio) => (
                      <option key={socio.usuario_id} value={socio.usuario_id}>
                        {`${socio.nombre} ${socio.apellido}`} - {socio.email}
                      </option>
                    ))}
                  </select>
                  <Button className="w-full md:w-auto" onClick={() => void handleGrantAccess()} disabled={!selectedAccessUserId}>
                    Otorgar acceso
                  </Button>
                </div>

                <div className="space-y-3 md:hidden">
                  {moduleAccess.map((access) => (
                    <div key={access.id} className="rounded-lg border p-4">
                      <div className="font-medium">{access.socio ? `${access.socio.nombre || ''} ${access.socio.apellido || ''}`.trim() : access.user_id}</div>
                      <div className="mt-1 text-xs text-muted-foreground break-all">{access.socio?.email || '-'}</div>
                      <div className="mt-3 space-y-2 text-sm">
                        <ResponsiveInfoRow label="Otorgado" value={formatDateTime(access.created_at)} />
                      </div>
                      <div className="mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!window.confirm('Remover este acceso puntual?')) return
                            void revokeModuleAccess(access.id).catch((error) => {
                              toast.error(error instanceof Error ? error.message : 'No se pudo remover el acceso')
                            })
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remover acceso
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Persona</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Otorgado</TableHead>
                        <TableHead className="w-[90px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {moduleAccess.map((access) => (
                        <TableRow key={access.id}>
                          <TableCell className="font-medium">
                            {access.socio ? `${access.socio.nombre || ''} ${access.socio.apellido || ''}`.trim() : access.user_id}
                          </TableCell>
                          <TableCell>{access.socio?.email || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDateTime(access.created_at)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (!window.confirm('Remover este acceso puntual?')) return
                                void revokeModuleAccess(access.id).catch((error) => {
                                  toast.error(error instanceof Error ? error.message : 'No se pudo remover el acceso')
                                })
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimas sincronizaciones</CardTitle>
          <CardDescription>Resumen de importaciones desde la base publica.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {syncRuns.map((run) => (
              <div key={run.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium">{formatDateTime(run.started_at)}</div>
                  <Badge variant="outline">{run.status}</Badge>
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <ResponsiveInfoRow label="Totales" value={<span className="break-all text-right text-xs text-muted-foreground">{JSON.stringify(run.totals || {})}</span>} />
                  <ResponsiveInfoRow label="Errores" value={<span className="text-right text-xs text-muted-foreground">{run.error_summary || '-'}</span>} />
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Totales</TableHead>
                  <TableHead>Errores</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-sm">{formatDateTime(run.started_at)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{run.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {JSON.stringify(run.totals || {})}
                    </TableCell>
                    <TableCell className="max-w-[360px] whitespace-pre-wrap text-xs text-muted-foreground">
                      {run.error_summary || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(contactEditor)} onOpenChange={(open) => !open && setContactEditor(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Detalle del contacto</DialogTitle>
            <DialogDescription>Perfil sincronizado desde la base principal con ajustes internos del módulo.</DialogDescription>
          </DialogHeader>
          {contactEditor ? (
            <div className="space-y-5 py-2">
              <Card className="overflow-hidden border-border/80">
                <CardContent className="bg-gradient-to-r from-primary/10 via-background to-sky-500/10 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 border">
                        <AvatarImage src={contactEditor.account_image_url || undefined} alt={getContactDisplayName(contactEditor)} />
                        <AvatarFallback>{getContactInitials(contactEditor)}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        <div>
                          <h3 className="text-2xl font-semibold leading-tight">{getContactDisplayName(contactEditor)}</h3>
                          <p className="text-sm text-muted-foreground">{contactEditor.email}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{contactStatusLabels[contactEditor.status] || contactEditor.status}</Badge>
                          {contactEditor.account_is_active === true ? <Badge className="border-0 bg-emerald-500/15 text-emerald-700">Cuenta activa</Badge> : null}
                          {contactEditor.email_verified_at ? <Badge className="border-0 bg-sky-500/15 text-sky-700">Email verificado</Badge> : null}
                          {contactEditor.unsubscribed ? <Badge className="border-0 bg-amber-500/20 text-amber-700">Dado de baja</Badge> : null}
                          {contactEditor.bounced ? <Badge className="border-0 bg-destructive/20 text-destructive">Rebote</Badge> : null}
                          {contactEditor.opt_in === true ? <Badge className="border-0 bg-primary/15 text-primary">Opt-in</Badge> : null}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm md:min-w-[240px]">
                      <InfoStat label="Fuente" value={contactEditor.source || '-'} />
                      <InfoStat label="Última sync" value={contactEditor.last_synced_at ? formatDateTime(contactEditor.last_synced_at) : 'Sin sync'} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <ProfileCard title="Información Personal">
                  <InfoGridItem label="Nombre completo" value={contactEditor.full_name || getContactDisplayName(contactEditor)} />
                  <InfoGridItem label="Fecha de nacimiento" value={contactEditor.birth_date || 'No informada'} />
                  <InfoGridItem label="Edad" value={getAgeFromBirthDate(contactEditor.birth_date) ? `${getAgeFromBirthDate(contactEditor.birth_date)} años` : 'No disponible'} />
                  <InfoGridItem label="DNI" value={contactEditor.dni || 'No informado'} />
                  <InfoGridItem label="Alias / usuario" value={contactEditor.account_name || 'No informado'} />
                  <InfoGridItem label="Roles" value={(contactEditor.account_roles || []).join(', ') || 'Sin roles'} />
                </ProfileCard>

                <ProfileCard title="Información de Contacto">
                  <InfoGridItem label="Email" value={contactEditor.email} />
                  <InfoGridItem label="Teléfono" value={contactEditor.phone_number || 'No informado'} />
                  <InfoGridItem label="Proveedor" value={contactEditor.provider || 'No informado'} />
                  <InfoGridItem label="Email verificado" value={contactEditor.email_verified_at ? formatDateTime(contactEditor.email_verified_at) : 'No informado'} />
                  <InfoGridItem label="Alta origen" value={contactEditor.source_created_at ? formatDateTime(contactEditor.source_created_at) : 'No informada'} />
                  <InfoGridItem label="Imagen" value={contactEditor.account_image_url || 'No informada'} compact />
                </ProfileCard>

                <ProfileCard title="Participación y Etiquetas">
                  <div className="space-y-3">
                    <TagSection label="Etiquetas sincronizadas" tags={contactEditor.synced_tags || []} tone="sync" emptyLabel="Sin etiquetas sincronizadas" />
                    <TagSection label="Etiquetas manuales" tags={contactEditor.manual_tags || []} tone="manual" emptyLabel="Sin etiquetas manuales" />
                  </div>
                </ProfileCard>

                <ProfileCard title="Ajustes internos">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nombre">
                      <Input
                        value={contactEditor.first_name || ''}
                        onChange={(event) => setContactEditor((current) => current ? ({ ...current, first_name: event.target.value }) : current)}
                      />
                    </Field>
                    <Field label="Apellido">
                      <Input
                        value={contactEditor.last_name || ''}
                        onChange={(event) => setContactEditor((current) => current ? ({ ...current, last_name: event.target.value }) : current)}
                      />
                    </Field>
                    <Field label="Nombre completo">
                      <Input
                        value={contactEditor.full_name || ''}
                        onChange={(event) => setContactEditor((current) => current ? ({ ...current, full_name: event.target.value }) : current)}
                      />
                    </Field>
                    <Field label="Estado">
                      <select
                        value={contactEditor.status}
                        onChange={(event) => setContactEditor((current) => current ? ({ ...current, status: event.target.value as CommunicationContact['status'] }) : current)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                    </Field>
                    <Field label="Fecha de nacimiento">
                      <Input
                        type="date"
                        value={contactEditor.birth_date || ''}
                        onChange={(event) => setContactEditor((current) => current ? ({ ...current, birth_date: event.target.value || null }) : current)}
                      />
                    </Field>
                    <Field label="DNI">
                      <Input
                        value={contactEditor.dni || ''}
                        onChange={(event) => setContactEditor((current) => current ? ({ ...current, dni: event.target.value }) : current)}
                      />
                    </Field>
                    <Field label="Teléfono">
                      <Input
                        value={contactEditor.phone_number || ''}
                        onChange={(event) => setContactEditor((current) => current ? ({ ...current, phone_number: event.target.value }) : current)}
                      />
                    </Field>
                    <Field label="Etiquetas manuales">
                      <Input
                        value={contactTagsDraft}
                        onChange={(event) => setContactTagsDraft(event.target.value)}
                        placeholder="ej: invitacion, comunidad"
                      />
                    </Field>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(contactEditor.opt_in)}
                        onChange={(event) => setContactEditor((current) => current ? ({ ...current, opt_in: event.target.checked }) : current)}
                      />
                      Tiene consentimiento / opt-in
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(contactEditor.account_is_active)}
                        onChange={(event) => setContactEditor((current) => current ? ({ ...current, account_is_active: event.target.checked }) : current)}
                      />
                      Cuenta principal activa
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={contactEditor.unsubscribed}
                        onChange={(event) => setContactEditor((current) => current ? ({ ...current, unsubscribed: event.target.checked }) : current)}
                      />
                      Dado de baja
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={contactEditor.bounced}
                        onChange={(event) => setContactEditor((current) => current ? ({ ...current, bounced: event.target.checked }) : current)}
                      />
                      Marcado por rebote
                    </label>
                  </div>
                </ProfileCard>
              </div>

              <ProfileCard title="Metadata sincronizada">
                <Textarea
                  value={JSON.stringify(contactEditor.metadata || {}, null, 2)}
                  onChange={(event) => {
                    try {
                      const parsed = JSON.parse(event.target.value)
                      setContactEditor((current) => current ? ({ ...current, metadata: parsed }) : current)
                    } catch {
                      // mantener sin cambios hasta que el JSON sea valido
                    }
                  }}
                  rows={12}
                />
              </ProfileCard>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactEditor(null)}>Cancelar</Button>
            <Button onClick={() => void handleSaveContact()}>Guardar contacto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={campaignEditorOpen} onOpenChange={setCampaignEditorOpen}>
        <DialogContent className="max-w-5xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{campaignDraft.id ? 'Editar campana' : 'Nueva campana'}</DialogTitle>
            <DialogDescription>Redacta, segmenta, prueba y envia comunicaciones institucionales.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nombre de campana">
                  <Input value={campaignDraft.name} onChange={(event) => setCampaignDraft((current) => ({ ...current, name: event.target.value }))} />
                </Field>
                <Field label="Asunto">
                  <Input value={campaignDraft.subject} onChange={(event) => setCampaignDraft((current) => ({ ...current, subject: event.target.value }))} />
                </Field>
                <Field label="Preheader">
                  <Input value={campaignDraft.preheader || ''} onChange={(event) => setCampaignDraft((current) => ({ ...current, preheader: event.target.value }))} />
                </Field>
                <Field label="Plantilla">
                  <select
                    value={campaignDraft.template_id || ''}
                    onChange={(event) => {
                      const value = event.target.value
                      const template = templates.find((item) => item.id === value)
                      setCampaignDraft((current) => ({
                        ...current,
                        template_id: value || null,
                        content_json: template ? { ...template.content_json } : current.content_json,
                      }))
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Sin plantilla base</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Nombre remitente">
                  <Input value={campaignDraft.sender_name || ''} onChange={(event) => setCampaignDraft((current) => ({ ...current, sender_name: event.target.value }))} />
                </Field>
                <Field label="Email remitente">
                  <Input value={campaignDraft.sender_email || ''} onChange={(event) => setCampaignDraft((current) => ({ ...current, sender_email: event.target.value }))} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Titulo del email">
                  <Input
                    value={campaignDraft.content_json.title}
                    onChange={(event) => setCampaignDraft((current) => ({
                      ...current,
                      content_json: { ...current.content_json, title: event.target.value },
                    }))}
                  />
                </Field>
                <Field label="Modo de seleccion">
                  <select
                    value={campaignDraft.selection_mode}
                    onChange={(event) => setCampaignDraft((current) => ({
                      ...current,
                      selection_mode: event.target.value as CommunicationCampaign['selection_mode'],
                    }))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="manual">Manual</option>
                    <option value="filters">Por filtros</option>
                  </select>
                </Field>
                <Field label="Filtro guardado">
                  <select
                    value=""
                    onChange={(event) => {
                      const segment = segments.find((item) => item.id === event.target.value)
                      if (!segment) return
                      setCampaignDraft((current) => ({
                        ...current,
                        selection_mode: 'filters',
                        filters_json: {
                          contactIds: (segment.criteria_json?.contactIds || []).slice(),
                          tags: (segment.criteria_json?.tags || []).slice(),
                          statuses: (segment.criteria_json?.statuses || []).slice(),
                          sources: (segment.criteria_json?.sources || []).slice(),
                          optInOnly: Boolean(segment.criteria_json?.optInOnly),
                          minAge: segment.criteria_json?.minAge,
                          maxAge: segment.criteria_json?.maxAge,
                        },
                      }))
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Seleccionar filtro</option>
                    {segments.map((segment) => (
                      <option key={segment.id} value={segment.id}>{segment.name}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Cuerpo del email">
                <Textarea
                  rows={10}
                  value={campaignDraft.content_json.body}
                  onChange={(event) => setCampaignDraft((current) => ({
                    ...current,
                    content_json: { ...current.content_json, body: event.target.value },
                  }))}
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Texto del boton principal">
                  <Input
                    value={campaignDraft.content_json.ctaLabel || ''}
                    onChange={(event) => setCampaignDraft((current) => ({
                      ...current,
                      content_json: { ...current.content_json, ctaLabel: event.target.value },
                    }))}
                  />
                </Field>
                <Field label="URL del boton principal">
                  <Input
                    value={campaignDraft.content_json.ctaUrl || ''}
                    onChange={(event) => setCampaignDraft((current) => ({
                      ...current,
                      content_json: { ...current.content_json, ctaUrl: event.target.value },
                    }))}
                  />
                </Field>
              </div>

              <Field label="Nota de pie">
                <Input
                  value={campaignDraft.content_json.footerNote || ''}
                  onChange={(event) => setCampaignDraft((current) => ({
                    ...current,
                    content_json: { ...current.content_json, footerNote: event.target.value },
                  }))}
                />
              </Field>

              {campaignDraft.selection_mode === 'manual' ? (
                <Field label="Destinatarios manuales">
                  <div className="max-h-60 overflow-y-auto rounded-md border">
                    {contacts.map((contact) => {
                      const selected = (campaignDraft.filters_json.contactIds || []).includes(contact.id)
                      return (
                        <label key={contact.id} className="flex items-start gap-3 border-b px-3 py-2 text-sm last:border-b-0">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => {
                              const currentIds = new Set(campaignDraft.filters_json.contactIds || [])
                              if (event.target.checked) currentIds.add(contact.id)
                              else currentIds.delete(contact.id)
                              setCampaignDraft((current) => ({
                                ...current,
                                filters_json: {
                                  ...current.filters_json,
                                  contactIds: Array.from(currentIds),
                                },
                              }))
                            }}
                          />
                          <div>
                            <div className="font-medium">{contact.full_name || contact.email}</div>
                            <div className="text-xs text-muted-foreground">{contact.email}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </Field>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Tags">
                    <Input
                      value={(campaignDraft.filters_json.tags || []).join(', ')}
                      onChange={(event) => setCampaignDraft((current) => ({
                        ...current,
                        filters_json: {
                          ...current.filters_json,
                          tags: event.target.value.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean),
                        },
                      }))}
                      placeholder="ej: comunidad, reunion"
                    />
                  </Field>
                  <Field label="Fuentes">
                    <Input
                      value={(campaignDraft.filters_json.sources || []).join(', ')}
                      onChange={(event) => setCampaignDraft((current) => ({
                        ...current,
                        filters_json: {
                          ...current.filters_json,
                          sources: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
                        },
                      }))}
                      placeholder={allSources.join(', ') || 'mongodb, manual'}
                    />
                  </Field>
                  <Field label="Edad mínima">
                    <Input
                      type="number"
                      min="0"
                      max="120"
                      value={campaignDraft.filters_json.minAge ?? ''}
                      onChange={(event) => setCampaignDraft((current) => ({
                        ...current,
                        filters_json: {
                          ...current.filters_json,
                          minAge: event.target.value ? Number(event.target.value) : undefined,
                        },
                      }))}
                    />
                  </Field>
                  <Field label="Edad máxima">
                    <Input
                      type="number"
                      min="0"
                      max="120"
                      value={campaignDraft.filters_json.maxAge ?? ''}
                      onChange={(event) => setCampaignDraft((current) => ({
                        ...current,
                        filters_json: {
                          ...current.filters_json,
                          maxAge: event.target.value ? Number(event.target.value) : undefined,
                        },
                      }))}
                    />
                  </Field>
                  <Field label="Estados permitidos">
                    <div className="flex gap-3 pt-2 text-sm">
                      {(['active', 'inactive'] as const).map((status) => (
                        <label key={status} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={(campaignDraft.filters_json.statuses || []).includes(status)}
                            onChange={(event) => {
                              const nextStatuses = new Set(campaignDraft.filters_json.statuses || [])
                              if (event.target.checked) nextStatuses.add(status)
                              else nextStatuses.delete(status)
                              setCampaignDraft((current) => ({
                                ...current,
                                filters_json: {
                                  ...current.filters_json,
                                  statuses: Array.from(nextStatuses),
                                },
                              }))
                            }}
                          />
                          {contactStatusLabels[status]}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label="Opt-in requerido">
                    <label className="flex items-center gap-2 pt-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(campaignDraft.filters_json.optInOnly)}
                        onChange={(event) => setCampaignDraft((current) => ({
                          ...current,
                          filters_json: {
                            ...current.filters_json,
                            optInOnly: event.target.checked,
                          },
                        }))}
                      />
                      Solo contactos con consentimiento registrado
                    </label>
                  </Field>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Resumen de audiencia</CardTitle>
                  <CardDescription>Validacion previa para evitar envios accidentales.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <MetricLine label="Seleccionados" value={draftAudience.selected.length} />
                  <MetricLine label="Validos para envio" value={draftAudience.valid.length} />
                  <MetricLine label="Omitidos por baja/rebote/estado" value={draftAudience.skipped.length} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Acciones de envio</CardTitle>
                  <CardDescription>Preview, test y envio real con confirmacion.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full justify-start" variant="outline" onClick={() => void handleSaveCampaign()}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Guardar borrador
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => void handlePreviewCampaign()}>
                    <Eye className="mr-2 h-4 w-4" />
                    Generar vista previa
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => setTestDialogOpen(true)}>
                    <TestTube2 className="mr-2 h-4 w-4" />
                    Enviar correo de prueba
                  </Button>
                  <Button className="w-full justify-start" onClick={() => setSendConfirmOpen(true)} disabled={!campaignDraft.id}>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar campana real
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Destinatarios previstos</CardTitle>
                  <CardDescription>Vista rapida de los primeros contactos validos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {draftAudience.valid.slice(0, 8).map((contact) => (
                    <div key={contact.id} className="rounded-md border px-3 py-2 text-sm">
                      <div className="font-medium">{contact.full_name || contact.email}</div>
                      <div className="text-xs text-muted-foreground">{contact.email}</div>
                    </div>
                  ))}
                  {draftAudience.valid.length === 0 ? (
                    <div className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                      No hay destinatarios validos con la configuracion actual.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={templateEditorOpen} onOpenChange={setTemplateEditorOpen}>
        <DialogContent className="max-w-3xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{templateDraft?.id ? 'Editar plantilla' : 'Nueva plantilla'}</DialogTitle>
            <DialogDescription>Plantillas reutilizables sobre la base institucional de AILE.</DialogDescription>
          </DialogHeader>
          {templateDraft ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nombre">
                  <Input value={templateDraft.name} onChange={(event) => setTemplateDraft((current) => current ? ({ ...current, name: event.target.value }) : current)} />
                </Field>
                <Field label="Descripcion">
                  <Input value={templateDraft.description || ''} onChange={(event) => setTemplateDraft((current) => current ? ({ ...current, description: event.target.value }) : current)} />
                </Field>
              </div>
              <Field label="Titulo base">
                <Input
                  value={templateDraft.content_json.title}
                  onChange={(event) => setTemplateDraft((current) => current ? ({
                    ...current,
                    content_json: { ...current.content_json, title: event.target.value },
                  }) : current)}
                />
              </Field>
              <Field label="Cuerpo base">
                <Textarea
                  rows={8}
                  value={templateDraft.content_json.body}
                  onChange={(event) => setTemplateDraft((current) => current ? ({
                    ...current,
                    content_json: { ...current.content_json, body: event.target.value },
                  }) : current)}
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Texto del boton">
                  <Input
                    value={templateDraft.content_json.ctaLabel || ''}
                    onChange={(event) => setTemplateDraft((current) => current ? ({
                      ...current,
                      content_json: { ...current.content_json, ctaLabel: event.target.value },
                    }) : current)}
                  />
                </Field>
                <Field label="URL del boton">
                  <Input
                    value={templateDraft.content_json.ctaUrl || ''}
                    onChange={(event) => setTemplateDraft((current) => current ? ({
                      ...current,
                      content_json: { ...current.content_json, ctaUrl: event.target.value },
                    }) : current)}
                  />
                </Field>
              </div>
              <Field label="Nota de pie">
                <Input
                  value={templateDraft.content_json.footerNote || ''}
                  onChange={(event) => setTemplateDraft((current) => current ? ({
                    ...current,
                    content_json: { ...current.content_json, footerNote: event.target.value },
                  }) : current)}
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateEditorOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveTemplate()}>Guardar plantilla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Vista previa del email</DialogTitle>
            <DialogDescription>Render del template institucional con el contenido actual.</DialogDescription>
          </DialogHeader>
          <iframe
            title="Vista previa de email"
            srcDoc={campaignPreviewHtml}
            className="h-[70vh] w-full rounded-md border"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Enviar pruebas</DialogTitle>
            <DialogDescription>Ingresa uno o varios emails separados por coma.</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={5}
            value={testEmailsDraft}
            onChange={(event) => setTestEmailsDraft(event.target.value)}
            placeholder="ejemplo@aile.org.ar, otra@aile.org.ar"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSendTest()}>
              <TestTube2 className="mr-2 h-4 w-4" />
              Enviar test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <DialogContent className="max-w-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Confirmar envio real</DialogTitle>
            <DialogDescription>
              Esta accion enviara la campana guardada a los destinatarios validos y no podra repetirse accidentalmente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
            <MetricLine label="Seleccionados" value={draftAudience.selected.length} />
            <MetricLine label="Validos" value={draftAudience.valid.length} />
            <MetricLine label="Omitidos" value={draftAudience.skipped.length} />
            <MetricLine label="Asunto" value={campaignDraft.subject || 'Sin asunto'} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSendCampaign()} disabled={!campaignDraft.id || Boolean(sendingCampaignId)}>
              {sendingCampaignId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Confirmar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

function ProfileCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function InfoStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background/80 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

function InfoGridItem({
  label,
  value,
  compact = false,
}: {
  label: string
  value: React.ReactNode
  compact?: boolean
}) {
  return (
    <div className={cn('space-y-1', compact ? '' : 'min-h-[52px]')}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cn('font-medium text-foreground', compact && 'break-all text-sm')}>{value}</div>
    </div>
  )
}

function TagSection({
  label,
  tags,
  tone,
  emptyLabel,
}: {
  label: string
  tags: string[]
  tone: 'manual' | 'sync'
  emptyLabel: string
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="flex min-h-11 flex-wrap gap-2 rounded-lg border bg-muted/20 p-3">
        {tags.length ? tags.map((tag) => (
          <Badge
            key={`${tone}-${tag}`}
            className={cn(
              'border-0',
              tone === 'sync' ? 'bg-sky-500/15 text-sky-700' : 'bg-primary/15 text-primary'
            )}
          >
            {tag}
          </Badge>
        )) : <span className="text-xs text-muted-foreground">{emptyLabel}</span>}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  )
}

function MetricLine({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

function ResponsiveInfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className="max-w-[70%] text-right font-medium text-foreground">{value}</div>
    </div>
  )
}
