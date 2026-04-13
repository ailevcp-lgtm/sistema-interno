'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ExternalLink, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface AuthorizationDetails {
  authorization_id: string
  redirect_uri: string
  scope: string
  user: {
    id: string
    email: string
  }
  client: {
    id: string
    name: string
    uri: string
    logo_uri: string
  }
}

function buildConsentRedirectPath(authorizationId: string | null) {
  if (!authorizationId) return '/oauth/consent'
  return `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
}

function normalizeScopes(rawScope: string) {
  return rawScope
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean)
}

export default function OAuthConsentClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading, sessionStatus } = useAuth()
  const authorizationId = searchParams.get('authorization_id') || searchParams.get('authorizationId')
  const [details, setDetails] = useState<AuthorizationDetails | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [pendingAction, setPendingAction] = useState<'approve' | 'deny' | null>(null)

  const redirectTo = useMemo(
    () => buildConsentRedirectPath(authorizationId),
    [authorizationId]
  )

  useEffect(() => {
    if (!authorizationId) {
      setErrorMessage('Falta authorization_id en la URL de consentimiento.')
      return
    }

    if (!loading && !user && sessionStatus === 'unauthenticated') {
      router.replace(`/login?redirectTo=${encodeURIComponent(redirectTo)}`)
    }
  }, [authorizationId, loading, redirectTo, router, sessionStatus, user])

  useEffect(() => {
    if (!authorizationId || loading || sessionStatus !== 'authenticated') return

    let active = true

    const loadAuthorizationDetails = async () => {
      try {
        setLoadingDetails(true)
        setErrorMessage(null)

        const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)

        if (!active) return

        if (error) {
          setErrorMessage(error.message || 'No se pudieron cargar los detalles del consentimiento.')
          return
        }

        if (!data) {
          setErrorMessage('La respuesta de autorización llegó vacía.')
          return
        }

        if ('redirect_url' in data) {
          window.location.assign(data.redirect_url)
          return
        }

        setDetails(data)
      } catch (error) {
        console.error('OAuth consent details error:', error)
        if (!active) return
        setErrorMessage('Ocurrió un error inesperado al cargar la solicitud de autorización.')
      } finally {
        if (active) {
          setLoadingDetails(false)
        }
      }
    }

    void loadAuthorizationDetails()

    return () => {
      active = false
    }
  }, [authorizationId, loading, sessionStatus])

  const handleConsent = async (action: 'approve' | 'deny') => {
    if (!authorizationId) return

    try {
      setPendingAction(action)

      const response = action === 'approve'
        ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
        : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })

      if (response.error) {
        toast.error(response.error.message || 'No se pudo resolver la autorización.')
        return
      }

      if (!response.data?.redirect_url) {
        toast.error('No llegó una URL de retorno válida desde Supabase.')
        return
      }

      window.location.assign(response.data.redirect_url)
    } catch (error) {
      console.error('OAuth consent resolution error:', error)
      toast.error('Ocurrió un error inesperado al resolver la autorización.')
    } finally {
      setPendingAction(null)
    }
  }

  const scopes = normalizeScopes(details?.scope || '')

  if (!authorizationId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-xl border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Solicitud inválida
            </CardTitle>
            <CardDescription>
              La URL de consentimiento no incluye un `authorization_id`.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (loading || sessionStatus === 'unknown' || (sessionStatus === 'authenticated' && loadingDetails && !details)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardContent className="flex items-center justify-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Preparando solicitud de autorización...
          </CardContent>
        </Card>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              No se pudo continuar
            </CardTitle>
            <CardDescription>
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => router.replace('/dashboard')}>
              Volver al dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (!details) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardContent className="flex items-center justify-center gap-3 py-10 text-muted-foreground">
            <ShieldQuestion className="h-5 w-5" />
            No hay detalles de autorización para mostrar todavía.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-28 -left-20 w-80 h-80 rounded-full bg-[#6314a7]/15 blur-3xl" />
        <div className="absolute -bottom-28 -right-20 w-96 h-96 rounded-full bg-[#e50051]/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(99,20,167,0.05),transparent_35%,transparent_65%,rgba(229,0,81,0.05))]" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6">
        <Card className="w-full max-w-3xl border-border/80 shadow-xl bg-card/95 backdrop-blur-sm">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6314a7] to-[#e50051] text-white">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <CardTitle>Autorizar acceso a una app externa</CardTitle>
                <CardDescription>
                  Vas a permitir que una aplicación use tu cuenta del sistema interno para operar sobre el MCP remoto.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <section className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  {details.client.logo_uri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={details.client.logo_uri}
                      alt={details.client.name}
                      className="h-14 w-14 rounded-xl border border-border object-cover bg-white"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Cliente solicitante
                    </p>
                    <h2 className="text-xl font-black text-foreground">
                      {details.client.name}
                    </h2>
                    <a
                      href={details.client.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {details.client.uri}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                <Badge variant="secondary" className="self-start">
                  OAuth 2.1
                </Badge>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Usuario autenticado
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {details.user.email}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Redirect URI
                </p>
                <p className="mt-2 break-all text-sm text-foreground">
                  {details.redirect_uri}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Scopes solicitados
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {scopes.length > 0 ? scopes.map((scope) => (
                  <Badge key={scope} variant="outline" className="font-mono text-xs">
                    {scope}
                  </Badge>
                )) : (
                  <span className="text-sm text-muted-foreground">
                    La solicitud no especificó scopes explícitos.
                  </span>
                )}
              </div>
            </section>

            <Separator />

            <section className="space-y-2 text-sm text-muted-foreground">
              <p>
                Si apruebas, esta app podrá completar el flujo OAuth y operar con el MCP remoto de tareas usando tu identidad.
              </p>
              <p>
                Si rechazas, volverá al cliente con un error de acceso denegado.
              </p>
            </section>
          </CardContent>

          <CardFooter className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => void handleConsent('deny')}
              disabled={pendingAction !== null}
            >
              {pendingAction === 'deny' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rechazando...
                </>
              ) : (
                'Rechazar'
              )}
            </Button>

            <Button
              onClick={() => void handleConsent('approve')}
              disabled={pendingAction !== null}
              className="bg-gradient-to-r from-[#6314a7] to-[#e50051] text-white hover:from-[#7d2bc0] hover:to-[#ef336f]"
            >
              {pendingAction === 'approve' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aprobando...
                </>
              ) : (
                'Aprobar acceso'
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
