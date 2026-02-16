'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function OAuthRedirect() {
  const router = useRouter()

  useEffect(() => {
    // createBrowserClient tiene detectSessionInUrl: true.
    // Al inicializarse en esta página con ?code=... en la URL,
    // intercambia el código PKCE por una sesión automáticamente.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.replace('/dashboard')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Completando inicio de sesión...</p>
    </div>
  )
}
