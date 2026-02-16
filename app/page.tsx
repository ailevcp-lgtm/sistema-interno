import { redirect } from 'next/navigation'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams

  // Si Supabase redirige el código OAuth a la raíz en vez de /auth/callback,
  // reenviarlo a la ruta correcta para que se intercambie por una sesión.
  if (params.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(params.code)}`)
  }

  redirect('/dashboard')
}
