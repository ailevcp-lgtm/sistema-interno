function normalizeAvatarUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export function extractAuthAvatarUrl(metadata?: Record<string, unknown> | null): string | undefined {
  if (!metadata) return undefined

  const candidates = [
    metadata.avatar_url,
    metadata.picture,
    metadata.photo_url,
  ]

  for (const value of candidates) {
    const normalized = normalizeAvatarUrl(value)
    if (normalized) {
      return normalized
    }
  }

  return undefined
}

export function isGoogleAvatarUrl(url?: string | null): boolean {
  const normalized = normalizeAvatarUrl(url)
  if (!normalized) return false

  try {
    const { hostname } = new URL(normalized)
    return hostname === 'lh3.googleusercontent.com'
      || hostname.endsWith('.googleusercontent.com')
      || hostname.endsWith('.ggpht.com')
  } catch {
    return false
  }
}

export function shouldSyncAuthAvatar(
  currentAvatarUrl?: string | null,
  authAvatarUrl?: string | null
): authAvatarUrl is string {
  const normalizedAuthAvatarUrl = normalizeAvatarUrl(authAvatarUrl)
  if (!normalizedAuthAvatarUrl) return false

  const normalizedCurrentAvatarUrl = normalizeAvatarUrl(currentAvatarUrl)
  if (!normalizedCurrentAvatarUrl) return true
  if (normalizedCurrentAvatarUrl === normalizedAuthAvatarUrl) return false

  return isGoogleAvatarUrl(normalizedCurrentAvatarUrl)
}
