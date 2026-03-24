import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSocioContext, getServiceSupabase } from '@/lib/server-auth'
import { extractAuthAvatarUrl, shouldSyncAuthAvatar } from '@/lib/avatar'

interface SocioAvatarRow {
  id: string
  usuario_id: string | null
  avatar_url: string | null
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedSocioContext(request)
    if (!authContext) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const canEditSocios = await authContext.hasPermission('socios', 'editar')
    if (!canEditSocios) {
      return authContext.applyCookies(
        NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
      )
    }

    const supabase = getServiceSupabase()
    const { data: socios, error: sociosError } = await supabase
      .from('socios')
      .select('id, usuario_id, avatar_url')
      .not('usuario_id', 'is', null)

    if (sociosError) {
      return authContext.applyCookies(
        NextResponse.json({ error: sociosError.message }, { status: 500 })
      )
    }

    const authAvatarsByUserId = new Map<string, string>()
    const perPage = 200
    let page = 1

    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })

      if (error) {
        return authContext.applyCookies(
          NextResponse.json({ error: error.message }, { status: 500 })
        )
      }

      const users = data.users || []
      for (const user of users) {
        const avatarUrl = extractAuthAvatarUrl(user.user_metadata)
        if (avatarUrl) {
          authAvatarsByUserId.set(user.id, avatarUrl)
        }
      }

      if (users.length < perPage) break
      page += 1
    }

    const sociosToUpdate = ((socios || []) as SocioAvatarRow[]).flatMap((socio) => {
      if (!socio.usuario_id) return []

      const authAvatarUrl = authAvatarsByUserId.get(socio.usuario_id)
      if (!shouldSyncAuthAvatar(socio.avatar_url, authAvatarUrl)) return []

      return [{
        id: socio.id,
        avatar_url: authAvatarUrl,
      }]
    })

    if (sociosToUpdate.length === 0) {
      return authContext.applyCookies(NextResponse.json({ updated: 0 }))
    }

    const updateResults = await Promise.all(
      sociosToUpdate.map(async (socio) => {
        const { error } = await supabase
          .from('socios')
          .update({ avatar_url: socio.avatar_url })
          .eq('id', socio.id)

        if (error) {
          console.error('Error syncing socio avatar:', socio.id, error)
          return false
        }

        return true
      })
    )

    const updated = updateResults.filter(Boolean).length

    return authContext.applyCookies(
      NextResponse.json({
        updated,
        scanned: (socios || []).length,
      })
    )
  } catch (error) {
    console.error('Error en POST /api/socios/sync-google-avatars:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
