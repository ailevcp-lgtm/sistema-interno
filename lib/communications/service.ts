import 'server-only'

import { randomUUID } from 'node:crypto'
import { type Db, MongoClient, ObjectId } from 'mongodb'
import { getResendClient } from '@/lib/email/resend'
import { getServiceSupabase } from '@/lib/server-auth'
import type {
  CommunicationCampaign,
  CommunicationCampaignFilters,
  CommunicationCampaignRecipient,
  CommunicationContact,
  CommunicationEmailContent,
  CommunicationRecipientStatus,
  CommunicationTemplate,
} from '@/lib/types'
import {
  communicationCampaignFiltersSchema,
  communicationPreviewSchema,
  communicationSendCampaignSchema,
  communicationSendTestSchema,
} from './schemas'
import {
  buildRecipientUnsubscribeUrl,
  buildTestUnsubscribeUrl,
  chunkArray,
  ensureMinimumContent,
  firstDefinedValue,
  formatSender,
  matchesAgeRange,
  normalizeCommunicationEmail,
  normalizeStringArray,
  parseJsonObject,
  sanitizeFilters,
  splitFullName,
  toPlainJson,
  verifyUnsubscribeToken,
} from './utils'
import { renderCommunicationEmailHtml } from './email'

const RESEND_SEND_BATCH_SIZE = 100
const RESEND_MAX_SEND_ATTEMPTS = 4
const RESEND_BASE_RETRY_DELAY_MS = 1_000
const RESEND_MAX_RETRY_DELAY_MS = 10_000
const RESEND_FALLBACK_CONCURRENCY = 2
const RESEND_FALLBACK_DELAY_MS = 1_100
const RECIPIENT_PERSIST_BATCH_SIZE = 20
const DEFAULT_MONGO_USER_COLLECTION_CANDIDATES = ['users', 'Users', 'user', 'User']

const emailFieldCandidates = ['email', 'correo', 'mail', 'profile.email', 'user.email', 'emails.0.address']
const firstNameCandidates = ['firstName', 'first_name', 'givenName', 'given_name', 'profile.firstName', 'name.first']
const lastNameCandidates = ['lastName', 'last_name', 'familyName', 'family_name', 'profile.lastName', 'name.last']
const accountNameCandidates = ['name', 'username', 'alias', 'userName', 'displayName', 'display_name', 'profile.name']
const completeNameCandidates = ['completeName', 'complete_name', 'personalInformation.completeName', 'personalInformation.complete_name']
const providerCandidates = ['provider', 'authProvider', 'registrationProvider', 'signupProvider']
const createdAtCandidates = ['createdAt', 'created_at', 'registeredAt', 'fechaAlta']
const optInCandidates = ['optIn', 'opt_in', 'consent', 'marketingOptIn', 'newsletterOptIn']
const birthDateCandidates = ['birthDate', 'birth_date', 'personalInformation.birthDate', 'personalInformation.birth_date']
const dniCandidates = ['dni', 'personalInformation.dni']
const phoneCandidates = ['telephonNumber', 'telephoneNumber', 'phoneNumber', 'phone', 'personalInformation.telephonNumber', 'personalInformation.phoneNumber']
const imageCandidates = ['image', 'avatar', 'avatarUrl', 'avatar_url', 'profile.image', 'picture']
const rolesCandidates = ['roles', 'role', 'account.roles']
const emailVerifiedCandidates = ['emailVerified', 'email_verified', 'verifiedAt', 'verified_at']
const isActiveCandidates = ['isActive', 'active', 'enabled']
const tagsCandidates = ['tags', 'labels', 'segments', 'badges']
const personalInformationRefCandidates = ['personalInformation', 'personalInformationId', 'personal_information', 'personal_information_id']
const personalInformationCollectionCandidates = [
  'PersonalInformation',
  'personalInformation',
  'personalInformations',
  'personal_information',
  'personal_informations',
]
const personalInformationUserRefCandidates = ['userId', 'user_id', 'user', 'usuarioId', 'usuario_id']
const delegationRelationCandidates = ['delegationMembers', 'delegationMemberIds', 'delegations', 'modelParticipations']

type ContactLike = CommunicationContact & {
  tags?: string[]
  email_contact_tags?: Array<{ tag: string; origin?: string | null }>
}

interface MongoRelationResolver {
  db: Db
  availableCollections: string[]
  cache: Map<string, Map<string, Record<string, unknown> | null>>
}

type CampaignEmailPayload = {
  from: string
  to: string
  subject: string
  html: string
}

type CampaignEmailTarget = {
  contact: Pick<CommunicationContact, 'id' | 'email' | 'full_name' | 'first_name' | 'last_name'>
  recipient: CommunicationCampaignRecipient
  email: CampaignEmailPayload
}

type CampaignEmailSendResult = (
  | { status: 'sent'; resendId: string | null }
  | { status: 'failed'; errorMessage: string }
) & {
  target: CampaignEmailTarget
}

type ResendApiError = {
  message: string
  statusCode: number | null
  name: string
}

function getMongoConfig() {
  const uri = process.env.MONGODB_URI?.trim() || process.env.DATABASE_URL?.trim()
  const dbNameOverride = process.env.MONGODB_DB_NAME?.trim()
  const collection = process.env.MONGODB_USERS_COLLECTION?.trim()

  if (!uri) {
    throw new Error('Falta MONGODB_URI o DATABASE_URL para conectarse a MongoDB')
  }

  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('La conexion configurada no parece ser MongoDB. Usa MONGODB_URI o un DATABASE_URL con esquema mongodb:// o mongodb+srv://')
  }

  let dbName = dbNameOverride || ''

  if (!dbName) {
    try {
      const parsedUri = new URL(uri)
      dbName = parsedUri.pathname.replace(/^\/+/, '').trim()
    } catch {
      dbName = ''
    }
  }

  if (!dbName) {
    throw new Error('No se pudo resolver la base Mongo. Define MONGODB_DB_NAME o incluye la base en DATABASE_URL/MONGODB_URI')
  }

  return {
    uri,
    dbName,
    collection,
    fields: {
      email: process.env.MONGODB_USERS_EMAIL_FIELD?.trim(),
      firstName: process.env.MONGODB_USERS_FIRST_NAME_FIELD?.trim(),
      lastName: process.env.MONGODB_USERS_LAST_NAME_FIELD?.trim(),
      name: process.env.MONGODB_USERS_NAME_FIELD?.trim(),
      provider: process.env.MONGODB_USERS_PROVIDER_FIELD?.trim(),
      createdAt: process.env.MONGODB_USERS_CREATED_AT_FIELD?.trim(),
      optIn: process.env.MONGODB_USERS_OPT_IN_FIELD?.trim(),
    },
  }
}

async function resolveMongoUserCollection(mongoClient: MongoClient, dbName: string, preferredCollection?: string) {
  const db = mongoClient.db(dbName)
  const availableCollections = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((entry) => entry.name)

  const candidates = [
    preferredCollection,
    ...DEFAULT_MONGO_USER_COLLECTION_CANDIDATES,
  ].filter(Boolean) as string[]

  const resolved = candidates.find((candidate) => availableCollections.includes(candidate))
  if (resolved) {
    return {
      db,
      collectionName: resolved,
      availableCollections,
    }
  }

  throw new Error(
    preferredCollection
      ? `No existe la coleccion Mongo "${preferredCollection}" en la base "${dbName}". Colecciones disponibles: ${availableCollections.join(', ') || 'ninguna'}`
      : `No se pudo detectar automaticamente la coleccion de usuarios en la base "${dbName}". Configura MONGODB_USERS_COLLECTION. Colecciones disponibles: ${availableCollections.join(', ') || 'ninguna'}`
  )
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'si', 'sí'].includes(normalized)) return true
    if (['false', '0', 'no'].includes(normalized)) return false
  }
  return null
}

function parseDate(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()

  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function parseDateOnly(value: unknown): string | null {
  const iso = parseDate(value)
  return iso ? iso.slice(0, 10) : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeMongoReferenceId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (isRecord(value) && typeof value.toHexString === 'function') {
    return value.toHexString() as string
  }
  if (isRecord(value) && typeof value.$oid === 'string') {
    return value.$oid
  }
  return null
}

async function loadDocumentById(
  resolver: MongoRelationResolver,
  collectionName: string,
  id: string
): Promise<Record<string, unknown> | null> {
  const collectionCache = resolver.cache.get(collectionName) || new Map<string, Record<string, unknown> | null>()
  resolver.cache.set(collectionName, collectionCache)

  if (collectionCache.has(id)) {
    return collectionCache.get(id) || null
  }

  const collection = resolver.db.collection(collectionName)
  const queryCandidates: Array<Record<string, unknown>> = [{ _id: id }]
  if (ObjectId.isValid(id)) {
    queryCandidates.unshift({ _id: new ObjectId(id) })
  }

  let document: Record<string, unknown> | null = null
  for (const query of queryCandidates) {
    const result = await collection.findOne(query)
    if (result && isRecord(result)) {
      document = result
      break
    }
  }

  collectionCache.set(id, document)
  return document
}

async function resolveRelatedDocument(
  resolver: MongoRelationResolver,
  relationValue: unknown,
  collectionCandidates: string[]
): Promise<Record<string, unknown> | null> {
  if (!relationValue) return null

  if (isRecord(relationValue) && !('_bsontype' in relationValue)) {
    return relationValue
  }

  const relationId = normalizeMongoReferenceId(relationValue)
  if (!relationId) return null

  const availableCandidates = collectionCandidates.filter((name) => resolver.availableCollections.includes(name))
  for (const collectionName of availableCandidates) {
    const document = await loadDocumentById(resolver, collectionName, relationId)
    if (document) {
      return document
    }
  }

  return null
}

async function resolveDocumentByForeignKey(
  resolver: MongoRelationResolver,
  collectionCandidates: string[],
  foreignKeyCandidates: string[],
  foreignId: unknown
): Promise<Record<string, unknown> | null> {
  const normalizedId = normalizeMongoReferenceId(foreignId)
  if (!normalizedId) return null

  const availableCandidates = collectionCandidates.filter((name) => resolver.availableCollections.includes(name))
  for (const collectionName of availableCandidates) {
    const collection = resolver.db.collection(collectionName)
    for (const foreignKey of foreignKeyCandidates) {
      const queryCandidates: Array<Record<string, unknown>> = [{ [foreignKey]: normalizedId }]
      if (ObjectId.isValid(normalizedId)) {
        queryCandidates.unshift({ [foreignKey]: new ObjectId(normalizedId) })
      }

      for (const query of queryCandidates) {
        const result = await collection.findOne(query)
        if (result && isRecord(result)) {
          return result
        }
      }
    }
  }

  return null
}

function normalizeSourceTag(rawTag: string): string | null {
  const normalized = rawTag.trim().toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
  return normalized || null
}

function extractSyncedTags(source: Record<string, unknown>): string[] {
  const rawTags = new Set<string>()

  normalizeStringArray(firstDefinedValue(source, undefined, tagsCandidates)).forEach((tag) => rawTags.add(tag))
  normalizeStringArray(firstDefinedValue(source, undefined, rolesCandidates)).forEach((role) => {
    rawTags.add(`rol:${role}`)
    rawTags.add(role)
  })

  const delegationValue = firstDefinedValue(source, undefined, delegationRelationCandidates)
  if (
    parseBoolean(firstDefinedValue(source, undefined, ['isDelegate', 'delegate', 'delegado'])) === true
    || (Array.isArray(delegationValue) && delegationValue.length > 0)
  ) {
    rawTags.add('delegado')
  }

  if (parseBoolean(firstDefinedValue(source, undefined, ['isExDelegate', 'exDelegate', 'exDelegado', 'formerDelegate'])) === true) {
    rawTags.add('ex-delegado')
  }

  return Array.from(rawTags)
    .map(normalizeSourceTag)
    .filter((value): value is string => Boolean(value))
}

function assertCampaignIsSendable(campaign: CommunicationCampaign) {
  if (!campaign.subject.trim()) {
    throw new Error('La campana debe tener asunto')
  }
  if (!campaign.content_json?.title?.trim()) {
    throw new Error('La campana debe tener un titulo')
  }
  if (!ensureMinimumContent(campaign.content_json?.body || '')) {
    throw new Error('La campana debe tener contenido suficiente antes de enviarse')
  }
  if (!campaign.sender_email?.trim()) {
    throw new Error('La campana debe tener un remitente valido')
  }
}

function buildPreviewHtml(
  subject: string,
  preheader: string | null | undefined,
  recipientName: string,
  content: CommunicationEmailContent,
  unsubscribeUrl: string
) {
  return renderCommunicationEmailHtml({
    subject,
    preheader,
    recipientName,
    content,
    unsubscribeUrl,
  })
}

function getContactDisplayName(contact: Pick<CommunicationContact, 'full_name' | 'first_name' | 'last_name' | 'email'>) {
  return (
    contact.full_name?.trim()
    || [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim()
    || contact.email
  )
}

function buildCampaignEmailTarget(params: {
  campaignId: string
  campaign: Pick<CommunicationCampaign, 'subject' | 'preheader' | 'content_json'>
  sender: string
  contact: Pick<CommunicationContact, 'id' | 'email' | 'full_name' | 'first_name' | 'last_name'>
  recipient: CommunicationCampaignRecipient
}): CampaignEmailTarget {
  const unsubscribeUrl = buildRecipientUnsubscribeUrl({
    mode: 'recipient',
    campaignId: params.campaignId,
    recipientId: params.recipient.id,
    contactId: params.contact.id,
  })

  return {
    contact: params.contact,
    recipient: params.recipient,
    email: {
      from: params.sender,
      to: params.contact.email,
      subject: params.campaign.subject,
      html: buildPreviewHtml(
        params.campaign.subject,
        params.campaign.preheader,
        getContactDisplayName(params.contact),
        params.campaign.content_json,
        unsubscribeUrl
      ),
    },
  }
}

function buildResendErrorMessage(error: ResendApiError) {
  return error.message || 'Error desconocido enviando email'
}

function isRetryableResendError(error: ResendApiError) {
  return (
    error.name === 'rate_limit_exceeded'
    || error.name === 'application_error'
    || error.name === 'internal_server_error'
    || error.name === 'concurrent_idempotent_requests'
    || error.statusCode === 429
    || (typeof error.statusCode === 'number' && error.statusCode >= 500)
  )
}

function shouldFallbackToIndividualSends(error: ResendApiError) {
  return ![
    'daily_quota_exceeded',
    'monthly_quota_exceeded',
    'missing_api_key',
    'restricted_api_key',
    'invalid_api_key',
    'invalid_from_address',
    'security_error',
    'invalid_access',
    'invalid_region',
  ].includes(error.name)
}

function parseRetryAfterMs(headers: Record<string, string> | null) {
  if (!headers) return null

  const retryAfterValue = Object.entries(headers).find(([key]) => key.toLowerCase() === 'retry-after')?.[1]
  if (!retryAfterValue) return null

  const retryAfterSeconds = Number(retryAfterValue)
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return retryAfterSeconds * 1_000
  }

  const retryAfterDate = Date.parse(retryAfterValue)
  if (Number.isNaN(retryAfterDate)) return null

  return Math.max(retryAfterDate - Date.now(), 0)
}

function getResendRetryDelayMs(headers: Record<string, string> | null, attempt: number) {
  const retryAfterMs = parseRetryAfterMs(headers)
  if (retryAfterMs !== null) {
    return Math.min(Math.max(retryAfterMs, RESEND_BASE_RETRY_DELAY_MS), RESEND_MAX_RETRY_DELAY_MS)
  }

  return Math.min(
    RESEND_BASE_RETRY_DELAY_MS * (2 ** Math.max(attempt - 1, 0)),
    RESEND_MAX_RETRY_DELAY_MS
  )
}

async function sleep(ms: number) {
  if (ms <= 0) return
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function runResendOperationWithRetry<T extends {
  error: ResendApiError | null
  headers: Record<string, string> | null
}>(operation: () => Promise<T>): Promise<T> {
  let lastResponse: T | null = null

  for (let attempt = 1; attempt <= RESEND_MAX_SEND_ATTEMPTS; attempt += 1) {
    const response = await operation()
    lastResponse = response

    if (!response.error) {
      return response
    }

    if (!isRetryableResendError(response.error) || attempt === RESEND_MAX_SEND_ATTEMPTS) {
      return response
    }

    await sleep(getResendRetryDelayMs(response.headers, attempt))
  }

  if (!lastResponse) {
    throw new Error('No se pudo ejecutar la operacion con Resend')
  }

  return lastResponse
}

function buildCampaignBatchIdempotencyKey(sendRunId: string, batchIndex: number) {
  return `campaign-send:${sendRunId}:batch:${batchIndex}`
}

function buildCampaignRecipientIdempotencyKey(sendRunId: string, recipientId: string) {
  return `campaign-send:${sendRunId}:recipient:${recipientId}`
}

async function sendCampaignBatch(params: {
  resend: ReturnType<typeof getResendClient>
  batch: CampaignEmailTarget[]
  sendRunId: string
  batchIndex: number
}) {
  const response = await runResendOperationWithRetry(() => params.resend.batch.send(
    params.batch.map((target) => target.email),
    {
      batchValidation: 'strict',
      idempotencyKey: buildCampaignBatchIdempotencyKey(params.sendRunId, params.batchIndex),
    }
  ))

  if (!response.error) {
    return params.batch.map((target, index) => ({
      status: 'sent' as const,
      target,
      resendId: response.data.data[index]?.id || null,
    }))
  }

  if (!shouldFallbackToIndividualSends(response.error)) {
    const errorMessage = buildResendErrorMessage(response.error)
    return params.batch.map((target) => ({
      status: 'failed' as const,
      target,
      errorMessage,
    }))
  }

  const results: CampaignEmailSendResult[] = []
  const fallbackBatches = chunkArray(params.batch, RESEND_FALLBACK_CONCURRENCY)

  for (let fallbackIndex = 0; fallbackIndex < fallbackBatches.length; fallbackIndex += 1) {
    const fallbackBatch = fallbackBatches[fallbackIndex]
    const fallbackResults = await Promise.all(fallbackBatch.map(async (target) => {
      const individualResponse = await runResendOperationWithRetry(() => params.resend.emails.send(
        target.email,
        {
          idempotencyKey: buildCampaignRecipientIdempotencyKey(params.sendRunId, target.recipient.id),
        }
      ))

      if (individualResponse.error) {
        return {
          status: 'failed' as const,
          target,
          errorMessage: buildResendErrorMessage(individualResponse.error),
        }
      }

      return {
        status: 'sent' as const,
        target,
        resendId: individualResponse.data?.id || null,
      }
    }))

    results.push(...fallbackResults)

    if (fallbackIndex < fallbackBatches.length - 1) {
      await sleep(RESEND_FALLBACK_DELAY_MS)
    }
  }

  return results
}

async function persistCampaignSendResults(params: {
  serviceSupabase: ReturnType<typeof getServiceSupabase>
  campaignId: string
  results: CampaignEmailSendResult[]
}) {
  for (const resultBatch of chunkArray(params.results, RECIPIENT_PERSIST_BATCH_SIZE)) {
    await Promise.all(resultBatch.map(async (result) => {
      if (result.status === 'sent') {
        const { error } = await params.serviceSupabase
          .from('email_campaign_recipients')
          .update({
            delivery_status: 'sent',
            resend_id: result.resendId,
            sent_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', result.target.recipient.id)

        if (error) throw error

        await insertEmailEvent({
          campaignId: params.campaignId,
          contactId: result.target.contact.id,
          campaignRecipientId: result.target.recipient.id,
          eventType: 'sent',
          body: { resendId: result.resendId },
        })

        return
      }

      const { error } = await params.serviceSupabase
        .from('email_campaign_recipients')
        .update({
          delivery_status: 'failed',
          error_message: result.errorMessage,
        })
        .eq('id', result.target.recipient.id)

      if (error) throw error

      await insertEmailEvent({
        campaignId: params.campaignId,
        contactId: result.target.contact.id,
        campaignRecipientId: result.target.recipient.id,
        eventType: 'failed',
        body: { error: result.errorMessage },
      })
    }))
  }
}

async function resolveContactsForCampaign(
  filters: CommunicationCampaignFilters,
  selectionMode: CommunicationCampaign['selection_mode']
) {
  const serviceSupabase = getServiceSupabase()
  const normalizedFilters = sanitizeFilters(filters)

  let contactIds = normalizedFilters.contactIds || []

  if (selectionMode === 'filters' && normalizedFilters.tags?.length) {
    const { data: tagRows, error: tagError } = await serviceSupabase
      .from('email_contact_tags')
      .select('contact_id, tag')
      .in('tag', normalizedFilters.tags)

    if (tagError) throw tagError

    const ids = new Set((tagRows || []).map((row) => row.contact_id as string))
    contactIds = Array.from(ids)
  }

  let query = serviceSupabase
    .from('email_contacts')
    .select(`
      *,
      email_contact_tags(tag, origin)
    `)

  if (selectionMode === 'manual') {
    if (!contactIds.length) return []
    query = query.in('id', contactIds)
  } else {
    if (contactIds.length) {
      query = query.in('id', contactIds)
    }
    if (normalizedFilters.statuses?.length) {
      query = query.in('status', normalizedFilters.statuses)
    }
    if (normalizedFilters.sources?.length) {
      query = query.in('source', normalizedFilters.sources)
    }
    if (normalizedFilters.optInOnly) {
      query = query.eq('opt_in', true)
    }
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error

  const contacts = ((data || []) as ContactLike[]).map((row) => ({
    ...row,
    tags: Array.isArray(row.email_contact_tags)
      ? row.email_contact_tags.map((tagRow) => tagRow.tag)
      : [],
    manual_tags: Array.isArray(row.email_contact_tags)
      ? row.email_contact_tags.filter((tagRow) => (tagRow.origin || 'manual') === 'manual').map((tagRow) => tagRow.tag)
      : [],
    synced_tags: Array.isArray(row.email_contact_tags)
      ? row.email_contact_tags.filter((tagRow) => tagRow.origin === 'sync').map((tagRow) => tagRow.tag)
      : [],
  }))

  if (selectionMode === 'manual') {
    return contacts
  }

  if (!normalizedFilters.tags?.length && normalizedFilters.minAge === undefined && normalizedFilters.maxAge === undefined) {
    return contacts
  }

  return contacts.filter((contact) => {
    const contactTags = new Set((contact.tags || []).map((tag) => tag.toLowerCase()))
    const matchesTags = normalizedFilters.tags?.some((tag) => contactTags.has(tag)) ?? true
    const matchesAge = matchesAgeRange(contact.birth_date, normalizedFilters.minAge, normalizedFilters.maxAge)
    return matchesTags && matchesAge
  })
}

async function resolveCampaignById(campaignId: string) {
  const serviceSupabase = getServiceSupabase()
  const { data, error } = await serviceSupabase
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('No se encontro la campana')
  return data as CommunicationCampaign
}

async function updateCampaignStatus(
  campaignId: string,
  status: CommunicationCampaign['status'],
  patch: Partial<CommunicationCampaign> = {}
) {
  const serviceSupabase = getServiceSupabase()
  const { error } = await serviceSupabase
    .from('email_campaigns')
    .update({
      status,
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)

  if (error) throw error
}

async function insertEmailEvent(payload: {
  campaignId?: string | null
  contactId?: string | null
  campaignRecipientId?: string | null
  eventType: string
  body?: Record<string, unknown>
}) {
  const serviceSupabase = getServiceSupabase()
  const { error } = await serviceSupabase
    .from('email_events')
    .insert({
      campaign_id: payload.campaignId || null,
      contact_id: payload.contactId || null,
      campaign_recipient_id: payload.campaignRecipientId || null,
      event_type: payload.eventType,
      payload: payload.body || {},
    })

  if (error) {
    console.error('Error guardando email event:', error)
  }
}

async function mapMongoDocument(
  document: Record<string, unknown>,
  resolver: MongoRelationResolver
) {
  const config = getMongoConfig()
  const personalInformation = await resolveRelatedDocument(
    resolver,
    firstDefinedValue(document, undefined, personalInformationRefCandidates),
    personalInformationCollectionCandidates
  )
  const resolvedPersonalInformation = personalInformation || await resolveDocumentByForeignKey(
    resolver,
    personalInformationCollectionCandidates,
    personalInformationUserRefCandidates,
    (document as { _id?: unknown })._id
  )
  const composedSource: Record<string, unknown> = {
    ...document,
    personalInformation: resolvedPersonalInformation || (isRecord(document.personalInformation) ? document.personalInformation : null),
  }
  const emailValue = firstDefinedValue(document, config.fields.email, emailFieldCandidates)
  const normalizedEmail = typeof emailValue === 'string' ? normalizeCommunicationEmail(emailValue) : ''

  if (!normalizedEmail) {
    return null
  }

  const explicitFirstName = firstDefinedValue(composedSource, config.fields.firstName, firstNameCandidates)
  const explicitLastName = firstDefinedValue(composedSource, config.fields.lastName, lastNameCandidates)
  const explicitCompleteName = firstDefinedValue(composedSource, undefined, completeNameCandidates)
  const explicitAccountName = firstDefinedValue(composedSource, config.fields.name, accountNameCandidates)

  const firstName = typeof explicitFirstName === 'string' ? explicitFirstName.trim() : null
  const lastName = typeof explicitLastName === 'string' ? explicitLastName.trim() : null
  const resolvedBaseName = typeof explicitCompleteName === 'string'
    ? explicitCompleteName
    : typeof explicitAccountName === 'string'
      ? explicitAccountName
      : null
  const splitName = !firstName && !lastName && resolvedBaseName
    ? splitFullName(resolvedBaseName)
    : { firstName: null, lastName: null, fullName: resolvedBaseName?.trim() || null }

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || splitName.fullName || null
  const provider = firstDefinedValue(composedSource, config.fields.provider, providerCandidates)
  const createdAtValue = firstDefinedValue(composedSource, config.fields.createdAt, createdAtCandidates)
  const optInValue = firstDefinedValue(composedSource, config.fields.optIn, optInCandidates)
  const roles = normalizeStringArray(firstDefinedValue(composedSource, undefined, rolesCandidates))
  const syncedTags = extractSyncedTags(composedSource)
  const birthDate = parseDateOnly(firstDefinedValue(composedSource, undefined, birthDateCandidates))
  const dni = firstDefinedValue(composedSource, undefined, dniCandidates)
  const phone = firstDefinedValue(composedSource, undefined, phoneCandidates)
  const image = firstDefinedValue(composedSource, undefined, imageCandidates)
  const emailVerified = firstDefinedValue(composedSource, undefined, emailVerifiedCandidates)
  const isActive = firstDefinedValue(composedSource, undefined, isActiveCandidates)
  const accountName = typeof explicitAccountName === 'string' ? explicitAccountName.trim() : null

  return {
    email: normalizedEmail,
    firstName: firstName || splitName.firstName,
    lastName: lastName || splitName.lastName,
    fullName,
    accountName,
    accountImageUrl: typeof image === 'string' ? image.trim() : null,
    accountRoles: roles,
    emailVerifiedAt: parseDate(emailVerified),
    accountIsActive: parseBoolean(isActive),
    birthDate,
    dni: typeof dni === 'string' ? dni.trim() : null,
    phoneNumber: typeof phone === 'string' ? phone.trim() : null,
    provider: typeof provider === 'string' ? provider.trim() : null,
    createdAt: parseDate(createdAtValue),
    optIn: parseBoolean(optInValue),
    syncedTags,
    metadata: {
      source_document: toPlainJson(document),
      personal_information: toPlainJson(resolvedPersonalInformation),
      source_id: toPlainJson((document as { _id?: unknown })._id),
      synced_tags: syncedTags,
      synced_profile: {
        account_name: accountName,
        account_roles: roles,
        email_verified_at: parseDate(emailVerified),
        account_is_active: parseBoolean(isActive),
        birth_date: birthDate,
        dni: typeof dni === 'string' ? dni.trim() : null,
        phone_number: typeof phone === 'string' ? phone.trim() : null,
      },
    },
  }
}

async function syncContactTags(contactId: string, syncedTags: string[]) {
  const serviceSupabase = getServiceSupabase()
  const normalizedTags = Array.from(new Set(syncedTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)))

  const { error: deleteMissingError } = await serviceSupabase
    .from('email_contact_tags')
    .delete()
    .eq('contact_id', contactId)
    .eq('origin', 'sync')
    .not('tag', 'in', `(${(normalizedTags.length ? normalizedTags : ['__none__']).map((tag) => `"${tag}"`).join(',')})`)

  if (deleteMissingError) {
    throw deleteMissingError
  }

  if (!normalizedTags.length) {
    return
  }

  const { data: existingRows, error: existingError } = await serviceSupabase
    .from('email_contact_tags')
    .select('tag')
    .eq('contact_id', contactId)
    .eq('origin', 'sync')

  if (existingError) {
    throw existingError
  }

  const existingTags = new Set((existingRows || []).map((row) => row.tag as string))
  const tagsToInsert = normalizedTags.filter((tag) => !existingTags.has(tag))

  if (!tagsToInsert.length) {
    return
  }

  const { error: insertError } = await serviceSupabase
    .from('email_contact_tags')
    .insert(tagsToInsert.map((tag) => ({
      contact_id: contactId,
      tag,
      origin: 'sync',
    })))

  if (insertError) {
    throw insertError
  }
}

export async function generateCampaignPreview(input: unknown) {
  const parsed = communicationPreviewSchema.parse(input)
  const previewName = parsed.previewName?.trim() || 'Miembro de AILE'
  const unsubscribeUrl = parsed.unsubscribeToken
    ? parsed.unsubscribeToken
    : buildTestUnsubscribeUrl('preview@aile.local')

  return {
    html: buildPreviewHtml(
      parsed.campaign.subject,
      parsed.campaign.preheader,
      previewName,
      parsed.campaign.content_json,
      unsubscribeUrl
    ),
  }
}

export async function sendCampaignTest(input: unknown) {
  const parsed = communicationSendTestSchema.parse(input)
  const resend = getResendClient()
  const sender = formatSender(parsed.campaign.sender_name, parsed.campaign.sender_email)

  if (!ensureMinimumContent(parsed.campaign.content_json.body)) {
    throw new Error('El contenido del email es demasiado corto para enviar una prueba')
  }

  const results = await Promise.allSettled(
    parsed.testEmails.map(async (email) => {
      const html = buildPreviewHtml(
        parsed.campaign.subject,
        parsed.campaign.preheader,
        email.split('@')[0] || 'Contacto',
        parsed.campaign.content_json,
        buildTestUnsubscribeUrl(email)
      )

      const response = await resend.emails.send({
        from: sender,
        to: email,
        subject: parsed.campaign.subject,
        html,
      })

      if (response.error) {
        throw new Error(response.error.message)
      }
    })
  )

  const sent = results.filter((result) => result.status === 'fulfilled').length
  const failed = results.length - sent

  if (parsed.campaignId) {
    await updateCampaignStatus(parsed.campaignId, 'test_sent')
    await insertEmailEvent({
      campaignId: parsed.campaignId,
      eventType: 'test_sent',
      body: {
        testEmails: parsed.testEmails,
        sent,
        failed,
      },
    })
  }

  return { sent, failed }
}

export async function syncContactsFromMongo(actorUserId: string) {
  const serviceSupabase = getServiceSupabase()
  const mongoConfig = getMongoConfig()
  const mongoClient = new MongoClient(mongoConfig.uri)

  const syncRun = await serviceSupabase
    .from('email_sync_runs')
    .insert({
      status: 'running',
      created_by: actorUserId,
      totals: {
        processed: 0,
        created: 0,
        updated: 0,
        skipped_invalid: 0,
        failed: 0,
      },
    })
    .select('id')
    .single()

  if (syncRun.error || !syncRun.data?.id) {
    throw syncRun.error || new Error('No se pudo crear el registro de sincronizacion')
  }

  const runId = syncRun.data.id as string
  const totals = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped_invalid: 0,
    failed: 0,
  }
  const errors: string[] = []

  try {
    await mongoClient.connect()
    const { collectionName, db, availableCollections } = await resolveMongoUserCollection(
      mongoClient,
      mongoConfig.dbName,
      mongoConfig.collection
    )
    const collection = db.collection(collectionName)
    const resolver: MongoRelationResolver = {
      db,
      availableCollections,
      cache: new Map(),
    }

    for await (const rawDocument of collection.find({}, { projection: {} })) {
      totals.processed += 1

      try {
        const mapped = await mapMongoDocument(rawDocument as Record<string, unknown>, resolver)
        if (!mapped) {
          totals.skipped_invalid += 1
          continue
        }

        const { data, error } = await serviceSupabase.rpc('fn_upsert_email_contact_from_sync', {
          p_email: mapped.email,
          p_first_name: mapped.firstName,
          p_last_name: mapped.lastName,
          p_full_name: mapped.fullName,
          p_source: 'mongodb',
          p_provider: mapped.provider,
          p_status: mapped.accountIsActive === false ? 'inactive' : 'active',
          p_opt_in: mapped.optIn,
          p_metadata: mapped.metadata,
          p_source_created_at: mapped.createdAt,
          p_last_synced_at: new Date().toISOString(),
          p_account_name: mapped.accountName,
          p_account_image_url: mapped.accountImageUrl,
          p_account_roles: mapped.accountRoles,
          p_email_verified_at: mapped.emailVerifiedAt,
          p_account_is_active: mapped.accountIsActive,
          p_birth_date: mapped.birthDate,
          p_dni: mapped.dni,
          p_phone_number: mapped.phoneNumber,
        })

        if (error) throw error

        const { data: contactRow, error: contactError } = await serviceSupabase
          .from('email_contacts')
          .select('id')
          .eq('email', mapped.email)
          .single()

        if (contactError) throw contactError
        if (contactRow?.id) {
          await syncContactTags(contactRow.id as string, mapped.syncedTags)
        }

        if (data === 'created') {
          totals.created += 1
        } else {
          totals.updated += 1
        }
      } catch (error) {
        totals.failed += 1
        const message = error instanceof Error ? error.message : 'Error desconocido'
        errors.push(`Registro ${totals.processed}: ${message}`)
      }
    }

    await serviceSupabase
      .from('email_sync_runs')
      .update({
        status: totals.failed > 0 ? 'completed_with_errors' : 'completed',
        totals,
        error_summary: errors.slice(0, 20).join('\n') || null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)

    return {
      runId,
      collection: collection.collectionName,
      ...totals,
      errors,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido en la sincronizacion'
    await serviceSupabase
      .from('email_sync_runs')
      .update({
        status: 'failed',
        totals,
        error_summary: [message, ...errors].slice(0, 20).join('\n'),
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)

    throw error
  } finally {
    await mongoClient.close().catch(() => undefined)
  }
}

export async function sendSavedCampaign(input: unknown) {
  const { campaignId } = communicationSendCampaignSchema.parse(input)
  const serviceSupabase = getServiceSupabase()
  const campaign = await resolveCampaignById(campaignId)
  const filters = communicationCampaignFiltersSchema.parse(parseJsonObject(campaign.filters_json, {}))

  if (!['draft', 'test_sent', 'failed'].includes(campaign.status)) {
    throw new Error('La campana no esta en un estado enviable')
  }

  assertCampaignIsSendable(campaign)

  const contacts = await resolveContactsForCampaign(filters, campaign.selection_mode)
  if (!contacts.length) {
    throw new Error('No hay destinatarios seleccionados para esta campana')
  }

  const uniqueByEmail = new Map<string, CommunicationContact>()
  for (const contact of contacts as CommunicationContact[]) {
    uniqueByEmail.set(normalizeCommunicationEmail(contact.email), contact)
  }

  const selectedContacts = Array.from(uniqueByEmail.values())
  const validContacts = selectedContacts.filter((contact) => (
    contact.status === 'active' && !contact.unsubscribed && !contact.bounced
  ))
  const skippedContacts = selectedContacts.filter((contact) => !validContacts.some((valid) => valid.id === contact.id))

  if (!validContacts.length) {
    throw new Error('No hay destinatarios validos para enviar la campana')
  }

  const sender = formatSender(campaign.sender_name, campaign.sender_email)

  const sendingUpdate = await serviceSupabase
    .from('email_campaigns')
    .update({
      status: 'sending',
      last_error: null,
      recipient_count_snapshot: {
        selected: selectedContacts.length,
        valid: validContacts.length,
        skipped: skippedContacts.length,
      },
    })
    .eq('id', campaignId)
    .in('status', ['draft', 'test_sent', 'failed'])
    .select('id')

  if (sendingUpdate.error) throw sendingUpdate.error
  if (!sendingUpdate.data?.length) {
    throw new Error('La campana ya fue enviada o esta en proceso')
  }

  const skippedRows = skippedContacts.map((contact) => ({
    campaign_id: campaignId,
    contact_id: contact.id,
    email: contact.email,
    delivery_status: 'skipped',
    metadata: {
      reason: contact.unsubscribed ? 'unsubscribed' : contact.bounced ? 'bounced' : 'inactive',
    },
  }))

  const pendingRows = validContacts.map((contact) => ({
    campaign_id: campaignId,
    contact_id: contact.id,
    email: contact.email,
    delivery_status: 'pending',
    metadata: {},
  }))

  const insertedRecipients = await serviceSupabase
    .from('email_campaign_recipients')
    .insert([...skippedRows, ...pendingRows])
    .select('*')

  if (insertedRecipients.error) throw insertedRecipients.error

  const allRecipients = (insertedRecipients.data || []) as CommunicationCampaignRecipient[]
  const pendingRecipients = allRecipients.filter((recipient) => recipient.delivery_status === 'pending')
  const recipientByContactId = new Map<string, CommunicationCampaignRecipient>()
  pendingRecipients.forEach((recipient) => {
    if (recipient.contact_id) {
      recipientByContactId.set(recipient.contact_id, recipient)
    }
  })

  const resend = getResendClient()
  const sendRunId = randomUUID()
  let sentCount = 0
  let failedCount = 0

  for (const [batchIndex, batch] of chunkArray(validContacts, RESEND_SEND_BATCH_SIZE).entries()) {
    const emailBatch = batch.map((contact) => {
      const recipient = recipientByContactId.get(contact.id)
      if (!recipient) {
        throw new Error(`No se encontro el destinatario persistido para ${contact.email}`)
      }

      return buildCampaignEmailTarget({
        campaignId,
        campaign,
        sender,
        contact,
        recipient,
      })
    })

    const results = await sendCampaignBatch({
      resend,
      batch: emailBatch,
      sendRunId,
      batchIndex,
    })

    const batchSentCount = results.filter((result) => result.status === 'sent').length
    sentCount += batchSentCount
    failedCount += results.length - batchSentCount

    await persistCampaignSendResults({
      serviceSupabase,
      campaignId,
      results,
    })
  }

  const finalStatus: CommunicationCampaign['status'] = sentCount > 0 ? 'sent' : 'failed'
  await updateCampaignStatus(campaignId, finalStatus, {
    sent_at: sentCount > 0 ? new Date().toISOString() : campaign.sent_at,
    last_error: failedCount > 0 ? `Hubo ${failedCount} destinatarios fallidos.` : null,
    recipient_count_snapshot: {
      selected: selectedContacts.length,
      valid: validContacts.length,
      skipped: skippedContacts.length,
      sent: sentCount,
      failed: failedCount,
    },
  })

  await insertEmailEvent({
    campaignId,
    eventType: 'campaign_completed',
    body: {
      selected: selectedContacts.length,
      sent: sentCount,
      failed: failedCount,
      skipped: skippedContacts.length,
    },
  })

  return {
    selected: selectedContacts.length,
    valid: validContacts.length,
    skipped: skippedContacts.length,
    sent: sentCount,
    failed: failedCount,
    status: finalStatus,
  }
}

export async function processUnsubscribeToken(token: string) {
  const payload = verifyUnsubscribeToken(token)
  const serviceSupabase = getServiceSupabase()

  if (payload.mode === 'test') {
    return {
      kind: 'test' as const,
      email: payload.email,
    }
  }

  const recipientResponse = await serviceSupabase
    .from('email_campaign_recipients')
    .select('id, campaign_id, contact_id, email, delivery_status')
    .eq('id', payload.recipientId)
    .maybeSingle()

  if (recipientResponse.error) throw recipientResponse.error
  if (!recipientResponse.data) {
    throw new Error('No se encontro el destinatario asociado a la baja')
  }

  const recipient = recipientResponse.data as Pick<CommunicationCampaignRecipient, 'id' | 'campaign_id' | 'contact_id' | 'email' | 'delivery_status'>

  if (recipient.contact_id) {
    const { error: contactError } = await serviceSupabase
      .from('email_contacts')
      .update({
        unsubscribed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recipient.contact_id)

    if (contactError) throw contactError
  }

  const { error: recipientError } = await serviceSupabase
    .from('email_campaign_recipients')
    .update({
      delivery_status: 'unsubscribed' as CommunicationRecipientStatus,
      unsubscribed_at: new Date().toISOString(),
    })
    .eq('id', recipient.id)

  if (recipientError) throw recipientError

  await insertEmailEvent({
    campaignId: recipient.campaign_id,
    contactId: recipient.contact_id,
    campaignRecipientId: recipient.id,
    eventType: 'unsubscribed',
    body: {
      email: recipient.email,
      source: 'public_unsubscribe_link',
    },
  })

  return {
    kind: 'recipient' as const,
    email: recipient.email,
  }
}

export async function fetchCommunicationCatalog() {
  const serviceSupabase = getServiceSupabase()
  const [templates, campaigns, contacts, syncRuns] = await Promise.all([
    serviceSupabase.from('email_templates').select('*').order('created_at', { ascending: false }),
    serviceSupabase.from('email_campaigns').select('*').order('created_at', { ascending: false }),
    serviceSupabase.from('email_contacts').select('id').order('created_at', { ascending: false }),
    serviceSupabase.from('email_sync_runs').select('*').order('started_at', { ascending: false }).limit(10),
  ])

  if (templates.error) throw templates.error
  if (campaigns.error) throw campaigns.error
  if (contacts.error) throw contacts.error
  if (syncRuns.error) throw syncRuns.error

  return {
    templates: (templates.data || []) as CommunicationTemplate[],
    campaigns: (campaigns.data || []) as CommunicationCampaign[],
    contactsCount: contacts.data?.length || 0,
    syncRuns: syncRuns.data || [],
  }
}
