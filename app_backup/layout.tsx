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
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${lato.variable} font-sans antialiased bg-[#0d0618] text-white`}>
        <AuthProvider>
          {children}
          <Toaster 
            position="top-right"
            toastOptions={{
              style: {
                background: '#1a0f2e',
                border: '1px solid rgba(99, 20, 167, 0.3)',
                color: '#fff',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
