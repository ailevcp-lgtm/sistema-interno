import type { Metadata, Viewport } from 'next'
import { Lato } from 'next/font/google'

import './globals.css'
import { AuthProvider } from '@/hooks/useAuth'
import { Toaster } from '@/components/ui/sonner'
import {
  ICON_VERSION,
  SITE_DESCRIPTION,
  SITE_FAVICON_PATH,
  SITE_KEYWORDS,
  SITE_LOCALE,
  SITE_NAME,
  SOCIAL_IMAGE,
  getSiteUrl,
} from '@/lib/site-config'

const lato = Lato({
  subsets: ['latin'],
  weight: ['100', '300', '400', '700', '900'],
  variable: '--font-lato',
})

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: 'AILE' }],
  creator: 'AILE',
  publisher: 'AILE',
  keywords: SITE_KEYWORDS,
  alternates: {
    canonical: '/',
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: `${SITE_FAVICON_PATH}?v=${ICON_VERSION}`, type: 'image/png', sizes: '1080x1080' },
    ],
    shortcut: [{ url: `/favicon.ico?v=${ICON_VERSION}` }],
    apple: [{ url: `/apple-icon?v=${ICON_VERSION}`, sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    title: SITE_NAME,
    capable: true,
    statusBarStyle: 'default',
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: '/',
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
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SOCIAL_IMAGE.path],
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: false,
    },
  },
}

export const viewport: Viewport = {
  themeColor: '#6314A7',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${lato.variable} font-sans antialiased`}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
          />
        </AuthProvider>
      </body>
    </html>
  )
}
