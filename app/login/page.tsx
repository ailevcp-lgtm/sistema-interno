'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, Loader2, Chrome } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [redirectTo, setRedirectTo] = useState('/dashboard')
  const [authError, setAuthError] = useState<string | null>(null)
  const { signIn, signInWithGoogle } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const redirectParam = params.get('redirectTo')
    if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('/auth/callback')) {
      setRedirectTo(redirectParam)
    }

    setAuthError(params.get('error'))
  }, [])

  const authErrorMessage = useMemo(() => {
    if (authError === 'unauthorized') {
      return 'Tu cuenta de Google no está autorizada para ingresar.'
    }
    if (authError === 'oauth_provider' || authError === 'oauth_callback') {
      return 'No se pudo completar el inicio de sesión con Google.'
    }
    if (authError === 'oauth_missing_code') {
      return 'Faltan datos del proveedor de autenticación. Intentá nuevamente.'
    }
    return null
  }, [authError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      toast.error('Por favor completa todos los campos')
      return
    }

    setIsPasswordLoading(true)

    try {
      const { error } = await signIn(email, password)
      
      if (error) {
        toast.error('Credenciales inválidas')
        console.error('Login error:', error)
      } else {
        toast.success('¡Bienvenido!')
        router.push(redirectTo)
        router.refresh()
      }
    } catch (error) {
      toast.error('Error al iniciar sesión')
      console.error('Login error:', error)
    } finally {
      setIsPasswordLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)

    const { error } = await signInWithGoogle(redirectTo)

    if (error) {
      toast.error('No se pudo iniciar con Google')
      console.error('Google OAuth error:', error)
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-28 -left-20 w-80 h-80 rounded-full bg-[#6314a7]/15 blur-3xl" />
        <div className="absolute -bottom-28 -right-20 w-96 h-96 rounded-full bg-[#e50051]/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(99,20,167,0.05),transparent_35%,transparent_65%,rgba(229,0,81,0.05))]" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-5xl grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <section className="hidden lg:flex relative overflow-hidden rounded-3xl border border-[#6314a7]/20 bg-gradient-to-br from-[#6314a7] via-[#7d2bc0] to-[#e50051] p-8">
            <div className="absolute -top-24 -right-20 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full bg-[#00a3e2]/30 blur-3xl" />

            <div className="relative flex flex-col justify-between text-white w-full">
              <div>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 border border-white/40 mb-5">
                  <img
                    src="/images/aile-logo-white.png"
                    alt="AILE"
                    className="h-10 w-auto object-contain"
                  />
                </div>
                <h1 className="text-3xl font-black leading-tight">
                  Sistema Interno
                  <br />
                  AILE
                </h1>
                <p className="mt-3 text-white/85 text-sm max-w-sm">
                  Administración de socios, deudas, finanzas, tesorería y documentos desde una única plataforma.
                </p>
              </div>

              <div className="space-y-2 text-sm text-white/90">
                <p className="font-semibold">Acceso privado para miembros autorizados.</p>
                <p className="text-white/75">Si no puedes ingresar, contacta a la comisión directiva.</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card/95 backdrop-blur-sm shadow-xl p-6 sm:p-8">
            <div className="text-center lg:text-left mb-7">
              <div className="inline-flex lg:hidden items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-[#6314a7] to-[#e50051] mb-4">
                <img
                  src="/images/aile-logo-white.png"
                  alt="AILE"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <h2 className="text-2xl font-black text-foreground">Iniciar sesión</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Ingresa con tu cuenta para acceder al panel interno.
              </p>
            </div>

            {authErrorMessage && (
              <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {authErrorMessage}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 border-border bg-background/80 hover:bg-accent"
              disabled={isGoogleLoading || isPasswordLoading}
              onClick={handleGoogleSignIn}
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redirigiendo a Google...
                </>
              ) : (
                <>
                  <Chrome className="w-4 h-4" />
                  Continuar con Google
                </>
              )}
            </Button>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">o con email y contraseña</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nombre@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11"
                    disabled={isPasswordLoading || isGoogleLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11"
                    disabled={isPasswordLoading || isGoogleLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-[#6314a7] to-[#e50051] hover:from-[#7d2bc0] hover:to-[#ef336f] text-white font-semibold"
                disabled={isPasswordLoading || isGoogleLoading}
              >
                {isPasswordLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar sesión'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-border text-center lg:text-left">
              <p className="text-xs text-muted-foreground">
                Sistema Interno AILE 2026
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Soporte: contactar a administración.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
