import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { ServerError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import { createRemoteTareasMcpServer } from '@/mcp/tareas/remote-server.mjs'
import {
  authenticateMcpRequest,
  buildProtectedResourceMetadataUrl,
  createRemoteAuthVerifier,
} from '@/mcp/tareas/remote-auth.mjs'
import { getSiteUrl } from '@/lib/site-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    'Faltan variables de entorno para el MCP remoto de tareas. Se requiere NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.'
  )
}

const siteUrl = getSiteUrl()
const resourceServerUrl = new URL('/api/mcp/tareas', siteUrl)
const resourceMetadataUrl = buildProtectedResourceMetadataUrl(resourceServerUrl)
const authVerifier = createRemoteAuthVerifier({
  supabaseUrl,
  anonKey,
  serviceRoleKey,
})

function jsonRpcError(status: number, code: number, message: string) {
  return Response.json(
    {
      jsonrpc: '2.0',
      error: { code, message },
      id: null,
    },
    {
      status,
      headers: {
        Allow: 'POST',
      },
    }
  )
}

export async function POST(request: Request) {
  const authResult = await authenticateMcpRequest(request, {
    verifier: authVerifier,
    resourceMetadataUrl,
  })

  if ('response' in authResult) {
    return authResult.response
  }

  try {
    const server = createRemoteTareasMcpServer({
      supabaseUrl,
      anonKey,
      accessToken: authResult.authInfo.token,
      authInfo: authResult.authInfo,
    })

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })

    await server.connect(transport)
    return await transport.handleRequest(request, {
      authInfo: authResult.authInfo,
    })
  } catch (error) {
    console.error('Error handling remote MCP request:', error)
    const serverError = new ServerError('Internal Server Error')
    return Response.json(serverError.toResponseObject(), { status: 500 })
  }
}

export async function GET() {
  return jsonRpcError(405, -32000, 'Method not allowed.')
}

export async function DELETE() {
  return jsonRpcError(405, -32000, 'Method not allowed.')
}
