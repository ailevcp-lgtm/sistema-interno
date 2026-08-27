const DEFAULT_BASE_URL = 'https://api.lapyme.com.ar'

export interface LapymeConfig {
  baseUrl: string
  apiKey?: string
}

export interface LapymeErrorBody {
  error?: {
    type?: string
    code?: string
    message?: string
    retryable?: boolean
    details?: unknown
  }
  request_id?: string
}

export class LapymeApiError extends Error {
  status: number
  requestId?: string
  code?: string
  retryable: boolean
  details?: unknown

  constructor(status: number, body: LapymeErrorBody) {
    const error = body.error
    super(error?.message || `La Pyme API error ${status}`)
    this.name = 'LapymeApiError'
    this.status = status
    this.requestId = body.request_id
    this.code = error?.code
    this.retryable = error?.retryable ?? (status >= 500 || status === 429)
    this.details = error?.details
  }
}

export interface LapymeListResponse<T> {
  request_id: string
  object: 'list'
  url: string
  data: T[]
  has_more: boolean
  next_cursor: string | null
}

export interface LapymeWarehouse {
  object: 'warehouse'
  id: string
  name: string
  address?: string | null
  is_default?: boolean
  is_active?: boolean
  points_of_sale_count?: number
  member_count?: number
  register_count?: number
}

export function getLapymeConfig(): LapymeConfig {
  return {
    baseUrl: (process.env.LAPYME_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    apiKey: process.env.LAPYME_API_KEY,
  }
}

export function assertLapymeApiKey(config = getLapymeConfig()) {
  if (!config.apiKey) {
    throw new Error('Falta configurar LAPYME_API_KEY')
  }
}

export function pesosToCentavos(value: number) {
  return Math.round(value * 100)
}

export function centavosToPesos(value: number) {
  return value / 100
}

export function buildIdempotencyKey(parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== '')
    .map((part) => String(part).trim())
    .join(':')
}

export class LapymeClient {
  private config: LapymeConfig

  constructor(config = getLapymeConfig()) {
    this.config = config
  }

  async health() {
    return this.request<{ status?: string }>('/health', { auth: false })
  }

  async listWarehouses(params: { limit?: number; cursor?: string } = {}) {
    const searchParams = new URLSearchParams()
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.cursor) searchParams.set('cursor', params.cursor)

    const query = searchParams.toString()
    return this.request<LapymeListResponse<LapymeWarehouse>>(
      `/api/v1/warehouses${query ? `?${query}` : ''}`
    )
  }

  async get<T>(path: string) {
    return this.request<T>(path)
  }

  async post<T>(path: string, body: unknown, options: { idempotencyKey?: string } = {}) {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      idempotencyKey: options.idempotencyKey,
    })
  }

  private async request<T>(
    path: string,
    options: RequestInit & { auth?: boolean; idempotencyKey?: string } = {}
  ): Promise<T> {
    const useAuth = options.auth ?? true
    if (useAuth) assertLapymeApiKey(this.config)

    const headers = new Headers(options.headers)
    headers.set('Accept', 'application/json')

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    if (useAuth && this.config.apiKey) {
      headers.set('Authorization', `Bearer ${this.config.apiKey}`)
    }

    if (options.idempotencyKey) {
      headers.set('Idempotency-Key', options.idempotencyKey)
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...options,
      headers,
      cache: 'no-store',
    })

    const contentType = response.headers.get('content-type') || ''
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    if (!response.ok) {
      throw new LapymeApiError(
        response.status,
        typeof data === 'object' && data !== null ? data : { error: { message: String(data) } }
      )
    }

    return data as T
  }
}
