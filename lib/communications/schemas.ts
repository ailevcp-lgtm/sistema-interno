import { z } from 'zod'

export const communicationContentSchema = z.object({
  title: z.string().trim().min(1, 'El titulo es obligatorio'),
  body: z.string().trim().min(1, 'El cuerpo es obligatorio'),
  ctaLabel: z.string().trim().max(120).nullable().optional(),
  ctaUrl: z.preprocess(
    (val) => (typeof val === 'string' && !val.trim() ? null : val),
    z.string().trim().url('La URL del boton principal no es valida').nullable().optional()
  ),
  footerNote: z.string().trim().max(240).nullable().optional(),
})

export const communicationContactStatusSchema = z.enum(['active', 'inactive'])

export const communicationCampaignFiltersSchema = z.object({
  contactIds: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  statuses: z.array(communicationContactStatusSchema).optional(),
  sources: z.array(z.string().trim().min(1)).optional(),
  optInOnly: z.boolean().optional(),
  minAge: z.number().int().min(0).max(120).optional(),
  maxAge: z.number().int().min(0).max(120).optional(),
}).refine(
  (value) => value.minAge === undefined || value.maxAge === undefined || value.minAge <= value.maxAge,
  {
    message: 'La edad minima no puede superar la maxima',
    path: ['minAge'],
  }
)

export const communicationCampaignDraftSchema = z.object({
  name: z.string().trim().min(1, 'El nombre de la campana es obligatorio'),
  subject: z.string().trim().min(1, 'El asunto es obligatorio'),
  preheader: z.string().trim().max(180).nullable().optional(),
  sender_name: z.string().trim().min(1, 'El nombre del remitente es obligatorio'),
  sender_email: z.string().trim().email('El email remitente no es valido'),
  template_id: z.string().uuid().nullable().optional(),
  content_json: communicationContentSchema,
  selection_mode: z.enum(['manual', 'filters']),
  filters_json: communicationCampaignFiltersSchema.default({}),
})

export const communicationPreviewSchema = z.object({
  campaign: communicationCampaignDraftSchema,
  previewName: z.string().trim().optional(),
  unsubscribeToken: z.string().trim().optional(),
})

export const communicationSendTestSchema = z.object({
  campaignId: z.string().uuid().optional(),
  campaign: communicationCampaignDraftSchema,
  testEmails: z.array(z.string().trim().email()).min(1).max(10),
})

export const communicationSendCampaignSchema = z.object({
  campaignId: z.string().uuid(),
  campaign: communicationCampaignDraftSchema.optional(),
})
