import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formato de moneda ARS
export function formatARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Formato de fecha
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Formato de fecha larga
export function formatDateLong(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

// Formato de fecha y hora
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

// Formato de período (2026-01 -> Enero 2026)
export function formatPeriodo(periodo: string): string {
  const [year, month] = periodo.split('-')
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ]
  return `${meses[parseInt(month) - 1]} ${year}`
}

// Obtener período actual
export function getCurrentPeriodo(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Calcular antigüedad
export function calcularAntiguedad(fechaIngreso: string): string {
  const inicio = new Date(fechaIngreso)
  const ahora = new Date()
  
  let años = ahora.getFullYear() - inicio.getFullYear()
  let meses = ahora.getMonth() - inicio.getMonth()
  
  if (meses < 0) {
    años--
    meses += 12
  }
  
  if (años === 0) {
    return meses === 1 ? '1 mes' : `${meses} meses`
  } else if (meses === 0) {
    return años === 1 ? '1 año' : `${años} años`
  } else {
    return `${años} año${años > 1 ? 's' : ''} y ${meses} mes${meses > 1 ? 'es' : ''}`
  }
}

// Generar iniciales del nombre
export function getInitials(nombre: string, apellido?: string): string {
  if (apellido) return `${nombre[0]}${apellido[0]}`.toUpperCase()
  return nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// Generar ID
export function generateId(): string {
  return crypto.randomUUID()
}

// Generar color de avatar basado en string
export function generateAvatarColor(str: string): string {
  const colors = [
    'from-[#6314a7] to-[#9341bf]',
    'from-[#e50051] to-[#ff6699]',
    'from-[#00a3e2] to-[#66c5ef]',
    'from-[#22c55e] to-[#86efac]',
    'from-[#f59e0b] to-[#fcd34d]',
    'from-[#8b5cf6] to-[#c4b5fd]',
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// Validar email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validar DNI argentino
export function isValidDNI(dni: string): boolean {
  return /^\d{7,8}$/.test(dni)
}

// Truncar texto
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// Formato de archivo size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Debounce
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
