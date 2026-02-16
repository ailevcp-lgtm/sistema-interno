export class RequestTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`Timeout loading ${label} after ${timeoutMs}ms`)
    this.name = 'RequestTimeoutError'
  }
}

interface AsyncRecoveryOptions {
  label: string
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
}

const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_RETRIES = 1
const DEFAULT_RETRY_DELAY_MS = 250

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withTimeout<T>(
  promise: PromiseLike<T>,
  label: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new RequestTimeoutError(label, timeoutMs))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

export async function runWithRecovery<T>(
  operation: () => PromiseLike<T> | T,
  options: AsyncRecoveryOptions
): Promise<T> {
  const attempts = options.retries ?? DEFAULT_RETRIES
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  let lastError: unknown = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await withTimeout(Promise.resolve().then(operation), options.label, timeoutMs)
    } catch (error) {
      lastError = error

      if (attempt < attempts && retryDelayMs > 0) {
        await sleep(retryDelayMs)
      }
    }
  }

  throw lastError
}
