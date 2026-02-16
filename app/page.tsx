import { redirect } from 'next/navigation'
import OAuthRedirect from './oauth-redirect'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams

  // Si Supabase redirige el código OAuth a la raíz en vez de /auth/callback,
  // renderizar un componente client-side que usa detectSessionInUrl del
  // browser client para intercambiar el código PKCE por una sesión.
  if (params.code) {
    return <OAuthRedirect />
  }

  redirect('/dashboard')
}
