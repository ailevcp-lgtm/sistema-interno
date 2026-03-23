const ALLOWED_TAGS = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
}

const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math'])

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('#')) return true
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true

  try {
    const parsed = new URL(trimmed)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

function sanitizeElement(element: Element): void {
  const tagName = element.tagName.toLowerCase()

  if (!ALLOWED_TAGS.has(tagName)) {
    if (DROP_TAGS.has(tagName)) {
      element.remove()
      return
    }

    const parent = element.parentNode
    if (!parent) {
      element.remove()
      return
    }

    const children = Array.from(element.childNodes)
    for (const child of children) {
      parent.insertBefore(child, element)
      sanitizeNode(child)
    }

    element.remove()
    return
  }

  for (const attr of Array.from(element.attributes)) {
    const attrName = attr.name.toLowerCase()
    const allowedAttrs = ALLOWED_ATTRS[tagName] || new Set<string>()
    if (attrName.startsWith('on') || !allowedAttrs.has(attrName)) {
      element.removeAttribute(attr.name)
      continue
    }

    if (tagName === 'a' && attrName === 'href' && !isSafeUrl(attr.value)) {
      element.removeAttribute(attr.name)
    }
  }

  if (tagName === 'a') {
    const target = element.getAttribute('target')
    if (target === '_blank') {
      element.setAttribute('rel', 'noopener noreferrer')
    }
  }

  for (const child of Array.from(element.childNodes)) {
    sanitizeNode(child)
  }
}

function sanitizeNode(node: ChildNode): void {
  if (node.nodeType === Node.ELEMENT_NODE) {
    sanitizeElement(node as Element)
    return
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    node.remove()
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeWithFallback(input: string): string {
  return input
    .replace(/<\s*(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|svg|math)\b[^>]*\/?\s*>/gi, '')
    .replace(/\s(on[a-z-]+|style)\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("javascript:.*?"|'javascript:.*?'|javascript:[^\s>]+)/gi, '')
}

export function sanitizeRichHtml(input: string): string {
  if (!input) return ''

  if (typeof DOMParser === 'undefined') {
    return sanitizeWithFallback(input)
  }

  const parser = new DOMParser()
  const parsed = parser.parseFromString(input, 'text/html')

  for (const child of Array.from(parsed.body.childNodes)) {
    sanitizeNode(child)
  }

  return parsed.body.innerHTML
}
