import {
  ArrowUpDown,
  BarChart2,
  Briefcase,
  CalendarDays,
  CreditCard,
  FileText,
  KanbanSquare,
  Landmark,
  LayoutGrid,
  Mail,
  ReceiptText,
  Settings,
  Scale,
  Users,
  Users2,
  type LucideIcon,
} from 'lucide-react'

import type { NavItem, Recurso } from './types'

export interface AppNavItem {
  id: string
  label: string
  mobileLabel?: string
  iconName: NavItem['icon']
  icon: LucideIcon
  recurso: Recurso
  allowOwnDebtView?: boolean
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { id: 'dashboard', label: 'Inicio', iconName: 'Home', icon: LayoutGrid, recurso: 'dashboard' },
  { id: 'calendario', label: 'Calendario', iconName: 'CalendarDays', icon: CalendarDays, recurso: 'calendario' },
  { id: 'reuniones', label: 'Reuniones', iconName: 'Users2', icon: Users2, recurso: 'reuniones' },
  { id: 'tareas', label: 'Tareas', iconName: 'KanbanSquare', icon: KanbanSquare, recurso: 'tareas' },
  { id: 'socios', label: 'Socios', iconName: 'Users', icon: Users, recurso: 'socios' },
  { id: 'deudas', label: 'Deudas', mobileLabel: 'Deudas', iconName: 'Wallet', icon: CreditCard, recurso: 'deudas', allowOwnDebtView: true },
  { id: 'movimientos', label: 'Movimientos', mobileLabel: 'Movs.', iconName: 'ArrowUpDown', icon: ArrowUpDown, recurso: 'movimientos' },
  { id: 'finanzas', label: 'Finanzas', iconName: 'BarChart3', icon: BarChart2, recurso: 'finanzas' },
  { id: 'tesoreria', label: 'Tesorería', mobileLabel: 'Tesoreria', iconName: 'Landmark', icon: Landmark, recurso: 'tesoreria' },
  { id: 'reintegros', label: 'Reintegros', iconName: 'ReceiptText', icon: ReceiptText, recurso: 'reintegros' },
  { id: 'comunicaciones', label: 'Comunicaciones', mobileLabel: 'Comms', iconName: 'Mail', icon: Mail, recurso: 'comunicaciones' },
  { id: 'propuestas', label: 'Propuestas', iconName: 'Briefcase', icon: Briefcase, recurso: 'propuestas' },
  { id: 'documentos', label: 'Documentos', mobileLabel: 'Docs', iconName: 'FileText', icon: FileText, recurso: 'documentos' },
  { id: 'estatuto', label: 'Estatuto', iconName: 'Scale', icon: Scale, recurso: 'estatuto' },
  { id: 'configuracion', label: 'Ajustes', iconName: 'Settings', icon: Settings, recurso: 'configuracion' },
]

export const MOBILE_PRIMARY_NAV_COUNT = 4

const EXTRA_PAGE_LABELS: Record<string, string> = {
  'mi-perfil': 'Mi perfil',
  'mi-cuenta': 'Mi estado de cuenta',
  guia: 'Guía de uso',
}

export function getVisibleAppNavItems(options: {
  hasPermission: (recurso: Recurso, accion: 'ver') => boolean
  hasSocioId: boolean
}) {
  const { hasPermission, hasSocioId } = options

  return APP_NAV_ITEMS.filter((item) => {
    if (item.allowOwnDebtView) {
      return hasPermission(item.recurso, 'ver') || hasSocioId
    }

    return hasPermission(item.recurso, 'ver')
  })
}

export function getNavItemLabel(item: AppNavItem, options?: { canViewAllDebt?: boolean }) {
  if (item.id === 'deudas' && options?.canViewAllDebt === false) {
    return 'Mi deuda'
  }

  return item.label
}

export function getMobileNavItemLabel(item: AppNavItem, options?: { canViewAllDebt?: boolean }) {
  if (item.id === 'deudas' && options?.canViewAllDebt === false) {
    return 'Mi deuda'
  }

  return item.mobileLabel || item.label
}

export function getPageLabel(pageId: string, options?: { canViewAllDebt?: boolean }) {
  const navItem = APP_NAV_ITEMS.find((item) => item.id === pageId)

  if (navItem) {
    return getNavItemLabel(navItem, options)
  }

  return EXTRA_PAGE_LABELS[pageId] || 'Inicio'
}

export function toLegacyNavItem(item: AppNavItem): NavItem {
  return {
    href: `/${item.id}`,
    label: item.label,
    icon: item.iconName,
  }
}
