import type { Metadata } from 'next'

import {
  LOGIN_PAGE_DESCRIPTION,
  SITE_LOCALE,
  SITE_NAME,
  SOCIAL_IMAGE,
} from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Iniciar sesion',
  description: LOGIN_PAGE_DESCRIPTION,
  alternates: {
    canonical: '/login',
  },
  openGraph: {
    title: `Iniciar sesion | ${SITE_NAME}`,
    description: LOGIN_PAGE_DESCRIPTION,
    url: '/login',
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    type: 'website',
    images: [
      {
        url: SOCIAL_IMAGE.path,
        width: SOCIAL_IMAGE.width,
        height: SOCIAL_IMAGE.height,
        alt: SOCIAL_IMAGE.alt,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Iniciar sesion | ${SITE_NAME}`,
    description: LOGIN_PAGE_DESCRIPTION,
    images: [SOCIAL_IMAGE.path],
  },
}

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
