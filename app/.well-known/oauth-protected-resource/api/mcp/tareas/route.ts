import { buildSupabaseAuthServerUrl } from '@/mcp/tareas/remote-auth.mjs'
import { getSiteUrl } from '@/lib/site-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

if (!supabaseUrl) {
  throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL para publicar el metadata OAuth del MCP remoto.')
}

const siteUrl = getSiteUrl()
const resourceServerUrl = new URL('/api/mcp/tareas', siteUrl)
const authorizationServerUrl = buildSupabaseAuthServerUrl(supabaseUrl)

export async function GET() {
  return Response.json({
    resource: resourceServerUrl.toString(),
    authorization_servers: [authorizationServerUrl.toString()],
    resource_name: 'AILE MCP Tareas',
  })
}
