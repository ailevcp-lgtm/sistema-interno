'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { signIn } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      toast.error('Por favor completa todos los campos')
      return
    }

    setIsLoading(true)

    try {
      const { error } = await signIn(email, password)
      
      if (error) {
        toast.error('Credenciales inválidas')
        console.error('Login error:', error)
      } else {
        toast.success('¡Bienvenido!')
        router.push('/dashboard')
        router.refresh()
      }
    } catch (error) {
      toast.error('Error al iniciar sesión')
      console.error('Login error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0618] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#6314a7]/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#e50051]/20 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00a3e2]/10 rounded-full blur-[128px]" />
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6314a7] to-[#e50051] mb-4 shadow-lg shadow-[#6314a7]/20">
            <img
              src="/images/aile-logo-white.png"
              alt="AILE"
              className="h-10 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">AILE</h1>
          <p className="text-[#7c6a94] text-sm">
            Sistema interno de socios
          </p>
        </div>

        {/* Form */}
        <div className="bg-[#1a0f2e]/80 backdrop-blur-md border border-[rgba(99,20,167,0.3)] rounded-2xl p-6 shadow-xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white mb-1">Iniciar sesión</h2>
            <p className="text-sm text-[#7c6a94]">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#a899b8]">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7c6a94]" />
                <Input
                  id="email"
                  type="email"
                  placeholder="nombre@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-[#0d0618] border-[rgba(99,20,167,0.3)] text-white placeholder:text-[#5a4a6e] focus:border-[#6314a7] focus:ring-[#6314a7]/20"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#a899b8]">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7c6a94]" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-[#0d0618] border-[rgba(99,20,167,0.3)] text-white placeholder:text-[#5a4a6e] focus:border-[#6314a7] focus:ring-[#6314a7]/20"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7c6a94] hover:text-[#a899b8] transition-colors"
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
              className={cn(
                'w-full bg-gradient-to-r from-[#6314a7] to-[#e50051] hover:from-[#9341bf] hover:to-[#ff6699]',
                'text-white font-semibold py-2.5 rounded-lg transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar sesión'
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-[rgba(99,20,167,0.2)] text-center">
            <p className="text-xs text-[#5a4a6e]">
              Sistema Interno AILE 2026
            </p>
            <p className="text-xs text-[#5a4a6e] mt-1">
              ¿Problemas para acceder? Contacta a un administrador
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
