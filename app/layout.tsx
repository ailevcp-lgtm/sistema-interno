import type { Metadata } from 'next'
import { Lato } from 'next/font/google'

import './globals.css'
import { AuthProvider } from '@/hooks/useAuth'
import { Toaster } from '@/components/ui/sonner'

const lato = Lato({
  subsets: ['latin'],
  weight: ['100', '300', '400', '700', '900'],
  variable: '--font-lato',
})

export const metadata: Metadata = {
  title: 'AILE — Panel Interno',
  description: 'Panel de gestión interna - Asociación Independiente para Líderes Empoderados',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/apple-icon.png',
  },
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
