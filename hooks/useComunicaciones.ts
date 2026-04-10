'use client'

import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type {
  CommunicationCampaign,
  CommunicationCampaignFilters,
  CommunicationCampaignRecipient,
  CommunicationContact,
  CommunicationEmailContent,
  CommunicationModuleAccess,
  CommunicationSegment,
  CommunicationSyncRun,
  CommunicationTemplate,
  Socio,
} from '@/lib/types'
import { matchesAgeRange } from '@/lib/communications/utils'

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase()
}

function sanitizeClientFilters(filters: CommunicationCampaignFilters): CommunicationCampaignFilters {
  const minAge = typeof filters.minAge === 'number' && Number.isFinite(filters.minAge)
    ? Math.max(0, Math.trunc(filters.minAge))
    : undefined
  const maxAge = typeof filters.maxAge === 'number' && Number.isFinite(filters.maxAge)
    ? Math.max(0, Math.trunc(filters.maxAge))
    : undefined

  return {
    contactIds: Array.from(new Set((filters.contactIds || []).map((value) => value.trim()).filter(Boolean))),
    tags: Array.from(new Set((filters.tags || []).map(normalizeTag).filter(Boolean))),
    statuses: Array.from(new Set(filters.statuses || [])),
    sources: Array.from(new Set((filters.sources || []).map((value) => value.trim()).filter(Boolean))),
    optInOnly: Boolean(filters.optInOnly),
    minAge,
    maxAge,
  }
}

type ContactRow = CommunicationContact & {
  email_contact_tags?: Array<{ tag: string; origin?: string | null }>
}

interface SaveContactInput {
  id: string
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  account_name?: string | null
  account_image_url?: string | null
  account_roles?: string[] | null
  email_verified_at?: string | null
  account_is_active?: boolean | null
  birth_date?: string | null
  dni?: string | null
  phone_number?: string | null
  status: CommunicationContact['status']
  opt_in?: boolean | null
  unsubscribed: boolean
  bounced: boolean
  metadata?: Record<string, unknown> | null
  tags: string[]
}

type AccessSocioOption = Pick<Socio, 'id' | 'usuario_id' | 'nombre' | 'apellido' | 'email' | 'estado' | 'rol_aile' | 'created_at'> & {
  rol?: string | null
}

export function useComunicaciones() {
  const [contacts, setContacts] = useState<CommunicationContact[]>([])
  const [campaigns, setCampaigns] = useState<CommunicationCampaign[]>([])
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([])
  const [segments, setSegments] = useState<CommunicationSegment[]>([])
  const [syncRuns, setSyncRuns] = useState<CommunicationSyncRun[]>([])
  const [moduleAccess, setModuleAccess] = useState<Array<CommunicationModuleAccess & { socio?: Partial<Socio> | null }>>([])
  const [socios, setSocios] = useState<AccessSocioOption[]>([])
  const [campaignRecipients, setCampaignRecipients] = useState<Record<string, CommunicationCampaignRecipient[]>>({})
  const [loading, setLoading] = useState(true)

  const hydrateContacts = useCallback((rows: ContactRow[]) => (
    rows.map((row) => ({
      ...row,
      tags: Array.isArray(row.email_contact_tags) ? row.email_contact_tags.map((tagRow) => tagRow.tag) : [],
      manual_tags: Array.isArray(row.email_contact_tags)
        ? row.email_contact_tags.filter((tagRow) => (tagRow.origin || 'manual') === 'manual').map((tagRow) => tagRow.tag)
        : [],
      synced_tags: Array.isArray(row.email_contact_tags)
        ? row.email_contact_tags.filter((tagRow) => tagRow.origin === 'sync').map((tagRow) => tagRow.tag)
        : [],
    }))
  ), [])

  const resolveContactsByFilters = useCallback((filters: CommunicationCampaignFilters) => {
    const normalized = sanitizeClientFilters(filters)
    const idSet = new Set(normalized.contactIds || [])

    return contacts.filter((contact) => {
      const matchesIds = !idSet.size || idSet.has(contact.id)
      const matchesTags = !(normalized.tags?.length) || normalized.tags.some((tag) => (contact.tags || []).includes(tag))
      const matchesStatus = !(normalized.statuses?.length) || normalized.statuses.includes(contact.status)
      const matchesSource = !(normalized.sources?.length) || normalized.sources.includes(contact.source || '')
      const matchesOptIn = !normalized.optInOnly || contact.opt_in === true
      const matchesAge = matchesAgeRange(contact.birth_date, normalized.minAge, normalized.maxAge)

      return matchesIds && matchesTags && matchesStatus && matchesSource && matchesOptIn && matchesAge
    })
  }, [contacts])

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)

      const [
        contactsResponse,
        campaignsResponse,
        templatesResponse,
        segmentsResponse,
        syncRunsResponse,
        accessResponse,
        sociosResponse,
      ] = await Promise.all([
        supabase
          .from('email_contacts')
          .select('*, email_contact_tags(tag, origin)')
          .order('created_at', { ascending: false }),
        supabase
          .from('email_campaigns')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('email_templates')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('email_segments')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('email_sync_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(10),
        supabase
          .from('communication_module_access')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('socios')
          .select('id, usuario_id, nombre, apellido, email, estado, rol, rol_aile, created_at')
          .eq('estado', 'activo')
          .not('usuario_id', 'is', null)
          .order('apellido', { ascending: true }),
      ])

      if (contactsResponse.error) throw contactsResponse.error
      if (campaignsResponse.error) throw campaignsResponse.error
      if (templatesResponse.error) throw templatesResponse.error
      if (segmentsResponse.error) throw segmentsResponse.error
      if (syncRunsResponse.error) throw syncRunsResponse.error
      if (accessResponse.error) throw accessResponse.error
      if (sociosResponse.error) throw sociosResponse.error

      const socioRows = (sociosResponse.data || []) as AccessSocioOption[]
      const sociosByUserId = new Map<string, AccessSocioOption>(
        socioRows
          .filter((socio) => socio.usuario_id)
          .map((socio) => [socio.usuario_id, socio])
      )

      setContacts(hydrateContacts((contactsResponse.data || []) as ContactRow[]))
      setCampaigns((campaignsResponse.data || []) as CommunicationCampaign[])
      setTemplates((templatesResponse.data || []) as CommunicationTemplate[])
      setSegments((segmentsResponse.data || []) as CommunicationSegment[])
      setSyncRuns((syncRunsResponse.data || []) as CommunicationSyncRun[])
      setSocios(socioRows)
      setModuleAccess(
        ((accessResponse.data || []) as CommunicationModuleAccess[]).map((row) => ({
          ...row,
          socio: sociosByUserId.get(row.user_id) || null,
        }))
      )
    } catch (error) {
      console.error('Error cargando comunicaciones:', error)
      toast.error('No se pudo cargar el modulo de comunicaciones')
    } finally {
      setLoading(false)
    }
  }, [hydrateContacts])

  const saveContact = useCallback(async (contact: SaveContactInput) => {
    const normalizedTags = Array.from(new Set(contact.tags.map(normalizeTag).filter(Boolean)))

    const { error: contactError } = await supabase
      .from('email_contacts')
      .update({
        first_name: contact.first_name || null,
        last_name: contact.last_name || null,
        full_name: contact.full_name || null,
        account_name: contact.account_name || null,
        account_image_url: contact.account_image_url || null,
        account_roles: contact.account_roles || [],
        email_verified_at: contact.email_verified_at || null,
        account_is_active: contact.account_is_active ?? null,
        birth_date: contact.birth_date || null,
        dni: contact.dni || null,
        phone_number: contact.phone_number || null,
        status: contact.status,
        opt_in: contact.opt_in ?? null,
        unsubscribed: contact.unsubscribed,
        bounced: contact.bounced,
        metadata: contact.metadata || {},
      })
      .eq('id', contact.id)

    if (contactError) throw contactError

    const { error: deleteTagsError } = await supabase
      .from('email_contact_tags')
      .delete()
      .eq('contact_id', contact.id)
      .eq('origin', 'manual')

    if (deleteTagsError) throw deleteTagsError

    if (normalizedTags.length > 0) {
      const { error: insertTagsError } = await supabase
        .from('email_contact_tags')
        .insert(normalizedTags.map((tag) => ({ contact_id: contact.id, tag, origin: 'manual' })))

      if (insertTagsError) throw insertTagsError
    }

    await loadAll()
    toast.success('Contacto actualizado')
  }, [loadAll])

  const saveTemplate = useCallback(async (
    input: Partial<CommunicationTemplate> & { name: string; content_json: CommunicationEmailContent }
  ) => {
    if (input.id) {
      const { error } = await supabase
        .from('email_templates')
        .update({
          name: input.name,
          description: input.description || null,
          content_json: input.content_json,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('email_templates')
        .insert({
          name: input.name,
          description: input.description || null,
          content_json: input.content_json,
          key: input.key || null,
          is_system: false,
        })

      if (error) throw error
    }

    await loadAll()
    toast.success('Plantilla guardada')
  }, [loadAll])

  const deleteTemplate = useCallback(async (templateId: string) => {
    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', templateId)
      .eq('is_system', false)

    if (error) throw error
    await loadAll()
    toast.success('Plantilla eliminada')
  }, [loadAll])

  const saveSegment = useCallback(async (
    input: Partial<CommunicationSegment> & {
      name: string
      description?: string | null
      criteria_json: CommunicationCampaignFilters
    }
  ) => {
    const payload = {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      type: input.type || 'dynamic',
      criteria_json: sanitizeClientFilters(input.criteria_json),
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { error } = await supabase
        .from('email_segments')
        .update(payload)
        .eq('id', input.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('email_segments')
        .insert(payload)

      if (error) throw error
    }

    await loadAll()
    toast.success('Filtro guardado')
  }, [loadAll])

  const deleteSegment = useCallback(async (segmentId: string) => {
    const { error } = await supabase
      .from('email_segments')
      .delete()
      .eq('id', segmentId)

    if (error) throw error
    await loadAll()
    toast.success('Filtro eliminado')
  }, [loadAll])

  const applyManualTagFromFilters = useCallback(async (input: {
    tag: string
    filters: CommunicationCampaignFilters
  }) => {
    const normalizedTag = normalizeTag(input.tag)
    if (!normalizedTag) {
      throw new Error('Ingresa una etiqueta valida')
    }

    const matchedContacts = resolveContactsByFilters(input.filters)
    if (!matchedContacts.length) {
      throw new Error('No hay contactos que coincidan con ese filtro')
    }

    const contactIds = matchedContacts.map((contact) => contact.id)
    const { data: existingRows, error: existingError } = await supabase
      .from('email_contact_tags')
      .select('contact_id, origin')
      .eq('tag', normalizedTag)
      .in('contact_id', contactIds)

    if (existingError) throw existingError

    const existingContactIds = new Set((existingRows || []).map((row) => row.contact_id as string))
    const rowsToInsert = contactIds
      .filter((contactId) => !existingContactIds.has(contactId))
      .map((contactId) => ({
        contact_id: contactId,
        tag: normalizedTag,
        origin: 'manual',
      }))

    if (rowsToInsert.length > 0) {
      const { error } = await supabase
        .from('email_contact_tags')
        .insert(rowsToInsert)

      if (error) throw error
    }

    await loadAll()
    toast.success(`Etiqueta aplicada a ${rowsToInsert.length} contactos`)

    return {
      matched: matchedContacts.length,
      inserted: rowsToInsert.length,
      skipped: matchedContacts.length - rowsToInsert.length,
    }
  }, [loadAll, resolveContactsByFilters])

  const saveCampaign = useCallback(async (
    input: Partial<CommunicationCampaign> & {
      name: string
      subject: string
      sender_name: string
      sender_email: string
      content_json: CommunicationEmailContent
      selection_mode: CommunicationCampaign['selection_mode']
      filters_json: CommunicationCampaignFilters
    },
    options?: {
      silent?: boolean
    }
  ) => {
    const payload = {
      name: input.name,
      subject: input.subject,
      preheader: input.preheader || null,
      sender_name: input.sender_name,
      sender_email: input.sender_email,
      template_id: input.template_id || null,
      content_json: input.content_json,
      selection_mode: input.selection_mode,
      filters_json: sanitizeClientFilters(input.filters_json),
      status: input.status || 'draft',
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { error } = await supabase
        .from('email_campaigns')
        .update(payload)
        .eq('id', input.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('email_campaigns')
        .insert(payload)

      if (error) throw error
    }

    await loadAll()
    if (!options?.silent) {
      toast.success('Campana guardada')
    }
  }, [loadAll])

  const deleteCampaign = useCallback(async (campaignId: string) => {
    const { error } = await supabase
      .from('email_campaigns')
      .delete()
      .eq('id', campaignId)

    if (error) throw error
    await loadAll()
    toast.success('Campana eliminada')
  }, [loadAll])

  const loadCampaignRecipients = useCallback(async (campaignId: string) => {
    const { data, error } = await supabase
      .from('email_campaign_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    if (error) throw error

    setCampaignRecipients((current) => ({
      ...current,
      [campaignId]: (data || []) as CommunicationCampaignRecipient[],
    }))
  }, [])

  const requestPreview = useCallback(async (campaign: Omit<CommunicationCampaign, 'id' | 'created_at' | 'updated_at'>) => {
    const response = await fetch('/api/communications/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ campaign }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'No se pudo generar la vista previa')
    }

    return data.html as string
  }, [])

  const sendTest = useCallback(async (campaign: Omit<CommunicationCampaign, 'id' | 'created_at' | 'updated_at'>, testEmails: string[], campaignId?: string) => {
    const response = await fetch('/api/communications/send-test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ campaignId, campaign, testEmails }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'No se pudieron enviar las pruebas')
    }

    await loadAll()
    return data as { sent: number; failed: number }
  }, [loadAll])

  const sendCampaign = useCallback(async (campaignId: string) => {
    const response = await fetch('/api/communications/send-campaign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ campaignId }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'No se pudo enviar la campana')
    }

    await loadAll()
    await loadCampaignRecipients(campaignId)
    return data
  }, [loadAll, loadCampaignRecipients])

  const syncContacts = useCallback(async () => {
    const response = await fetch('/api/communications/sync-contacts', {
      method: 'POST',
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'No se pudo sincronizar la base externa')
    }

    await loadAll()
    return data
  }, [loadAll])

  const grantModuleAccess = useCallback(async (userId: string) => {
    const { error } = await supabase
      .from('communication_module_access')
      .insert({ user_id: userId })

    if (error) throw error
    await loadAll()
    toast.success('Acceso otorgado')
  }, [loadAll])

  const revokeModuleAccess = useCallback(async (accessId: string) => {
    const { error } = await supabase
      .from('communication_module_access')
      .delete()
      .eq('id', accessId)

    if (error) throw error
    await loadAll()
    toast.success('Acceso removido')
  }, [loadAll])

  const campaignMetrics = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}

    for (const [campaignId, recipients] of Object.entries(campaignRecipients)) {
      const stats: Record<string, number> = {}
      recipients.forEach((recipient) => {
        stats[recipient.delivery_status] = (stats[recipient.delivery_status] || 0) + 1
      })
      map[campaignId] = stats
    }

    return map
  }, [campaignRecipients])

  return {
    contacts,
    campaigns,
    templates,
    segments,
    syncRuns,
    moduleAccess,
    socios,
    campaignRecipients,
    campaignMetrics,
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
  }
}
