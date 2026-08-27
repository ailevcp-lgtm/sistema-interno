import type { CategoriaSocio, Cuota, Socio } from './types'

export const CATEGORIA_SOCIO_LABELS: Record<CategoriaSocio, string> = {
  pleno: 'Socio Pleno',
  honorario: 'Socio Honorario',
  adherente: 'Socio Adherente',
}

export const CATEGORIA_SOCIO_DESCRIPTIONS: Record<CategoriaSocio, string> = {
  pleno: 'Tiene voz y puede votar o integrar organos si cumple edad, antiguedad y cuotas al dia.',
  honorario: 'Tiene voz, no abona cuota social, no vota y no integra organos sociales.',
  adherente: 'Tiene voz, abona cuota social, no vota y no integra organos sociales.',
}

export const STATUTORY_TRANSITION_END_DATE = '2028-04-30'

export interface StatutoryStatus {
  isFormalMember: boolean
  categoria: CategoriaSocio | null
  categoriaLabel: string
  isAdult: boolean
  age: number | null
  hasSixMonthsMembership: boolean
  membershipMonths: number
  isFeesCurrent: boolean
  unpaidFeesCount: number
  requiresDebtNotice: boolean
  canVote: boolean
  canHoldOffice: boolean
  reasons: string[]
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function getAge(fechaNacimiento?: string | null, today = new Date()): number | null {
  const birth = parseDate(fechaNacimiento)
  if (!birth) return null

  let age = today.getFullYear() - birth.getFullYear()
  const monthDelta = today.getMonth() - birth.getMonth()
  const hasNotHadBirthday =
    monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())

  if (hasNotHadBirthday) age -= 1
  return age
}

export function getMembershipMonths(fechaIngreso?: string | null, today = new Date()): number {
  const start = parseDate(fechaIngreso)
  if (!start) return 0

  let months = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth()
  if (today.getDate() < start.getDate()) months -= 1
  return Math.max(months, 0)
}

export function isStatutoryTransitionActive(today = new Date()): boolean {
  const end = parseDate(STATUTORY_TRANSITION_END_DATE)
  return Boolean(end && today <= end)
}

export function getUnpaidFeesCount(cuotas: Array<Pick<Cuota, 'estado' | 'monto_esperado' | 'monto_pagado'>> = []): number {
  return cuotas.filter((cuota) => {
    if (cuota.estado === 'pagada') return false
    const remaining = Number(cuota.monto_esperado || 0) - Number(cuota.monto_pagado || 0)
    return remaining > 0
  }).length
}

export function getSocioStatutoryStatus(
  socio: Pick<Socio, 'categoria_socio' | 'fecha_nacimiento' | 'fecha_ingreso' | 'tiene_deuda' | 'membresia_formal'>,
  cuotas: Array<Pick<Cuota, 'estado' | 'monto_esperado' | 'monto_pagado'>> = [],
  today = new Date()
): StatutoryStatus {
  const membership = socio.membresia_formal
  const isFormalMember = Boolean(membership && membership.estado === 'activo')
  // El campo histórico de `socios` no acredita membresía. La única fuente
  // jurídica es una membresía formal actualmente activa.
  const categoria = isFormalMember ? membership!.categoria : null
  const age = getAge(socio.fecha_nacimiento, today)
  const membershipMonths = getMembershipMonths(membership?.fecha_inicio, today)
  const unpaidFeesCount = cuotas.length > 0 ? getUnpaidFeesCount(cuotas) : (socio.tiene_deuda ? 1 : 0)
  const isAdult = age === null ? false : age >= 18
  const transitionActive = isStatutoryTransitionActive(today)
  const hasSixMonthsMembership = transitionActive || membershipMonths >= 6
  const isFeesCurrent = unpaidFeesCount === 0
  const isFullMember = isFormalMember && categoria === 'pleno'

  const reasons: string[] = []
  if (!isFormalMember) reasons.push('No integra el padrón legal de personas asociadas activas.')
  if (isFormalMember && !isFullMember && categoria) reasons.push(`${CATEGORIA_SOCIO_LABELS[categoria]} no tiene voto ni puede integrar organos.`)
  if (age === null) reasons.push('Falta fecha de nacimiento para validar mayoria de edad.')
  if (age !== null && !isAdult) reasons.push('No alcanza la mayoria de edad requerida.')
  if (!hasSixMonthsMembership) reasons.push('No alcanza la antiguedad estatutaria minima de 6 meses.')
  if (!isFeesCurrent) reasons.push('No esta al dia con las cuotas sociales.')

  return {
    categoria,
    categoriaLabel: categoria ? CATEGORIA_SOCIO_LABELS[categoria] : 'No asociado/a',
    isAdult,
    age,
    hasSixMonthsMembership,
    membershipMonths,
    isFeesCurrent,
    unpaidFeesCount,
    requiresDebtNotice: unpaidFeesCount >= 3,
    isFormalMember,
    canVote: isFormalMember && isFullMember && isAdult && hasSixMonthsMembership && isFeesCurrent,
    canHoldOffice: isFormalMember && isFullMember && isAdult && hasSixMonthsMembership && isFeesCurrent,
    reasons,
  }
}
