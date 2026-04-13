import { createClient } from '@supabase/supabase-js';
import {
  InsufficientScopeError,
  InvalidTokenError,
  ServerError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';

function ensureRemoteSupabaseConfig({ supabaseUrl, anonKey, serviceRoleKey }) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Faltan variables de entorno para el MCP remoto de tareas. Se requiere NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
}

function buildBaseSupabaseClient(supabaseUrl, supabaseKey) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function parseJwtClaims(token) {
  try {
    const [, payload] = String(token || '').split('.');
    if (!payload) return {};
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

function parseScopes(claims) {
  const source = claims.scope || claims.scp;

  if (typeof source === 'string') {
    return source.split(/\s+/).filter(Boolean);
  }

  if (Array.isArray(source)) {
    return source.filter((item) => typeof item === 'string');
  }

  return [];
}

function maybeUrl(value) {
  if (typeof value !== 'string') return undefined;

  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

export function buildSupabaseAuthServerUrl(supabaseUrl) {
  return new URL('/auth/v1', supabaseUrl);
}

export function buildProtectedResourceMetadataUrl(resourceServerUrl) {
  const resourceUrl = resourceServerUrl instanceof URL ? resourceServerUrl : new URL(resourceServerUrl);
  const path = resourceUrl.pathname && resourceUrl.pathname !== '/' ? resourceUrl.pathname : '';
  return new URL(`/.well-known/oauth-protected-resource${path}`, resourceUrl).toString();
}

export function createAuthenticatedSupabaseClient({ supabaseUrl, anonKey, accessToken }) {
  if (!supabaseUrl || !anonKey || !accessToken) {
    throw new Error(
      'No se pudo crear el cliente autenticado del MCP remoto. Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o accessToken.'
    );
  }

  return createClient(supabaseUrl, anonKey, {
    accessToken: async () => accessToken,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createRemoteAuthVerifier({ supabaseUrl, anonKey, serviceRoleKey }) {
  ensureRemoteSupabaseConfig({ supabaseUrl, anonKey, serviceRoleKey });

  const authClient = buildBaseSupabaseClient(supabaseUrl, anonKey);
  const serviceClient = buildBaseSupabaseClient(supabaseUrl, serviceRoleKey);

  return {
    async verifyAccessToken(token) {
      if (!token) {
        throw new InvalidTokenError('Missing access token');
      }

      const { data, error } = await authClient.auth.getUser(token);
      const user = data?.user || null;

      if (error || !user?.id) {
        throw new InvalidTokenError('Invalid or expired access token');
      }

      const claims = parseJwtClaims(token);
      const expiresAt = typeof claims.exp === 'number' ? claims.exp : undefined;

      if (!expiresAt) {
        throw new InvalidTokenError('Token has no expiration time');
      }

      const { data: socio, error: socioError } = await serviceClient
        .from('socios')
        .select('id, usuario_id, nombre, apellido, email, rol, rol_aile, estado')
        .eq('usuario_id', user.id)
        .eq('estado', 'activo')
        .maybeSingle();

      if (socioError) {
        throw new ServerError(`No se pudo resolver el socio autenticado: ${socioError.message}`);
      }

      if (!socio?.id) {
        throw new InvalidTokenError('No active socio linked to this account');
      }

      const { data: memberships, error: membershipsError } = await serviceClient
        .from('socios_direcciones')
        .select('socio_id, direccion_id, es_director, activo, direcciones:direccion_id(id, codigo, nombre)')
        .eq('socio_id', socio.id)
        .eq('activo', true);

      if (membershipsError) {
        throw new ServerError(`No se pudieron leer las direcciones del socio autenticado: ${membershipsError.message}`);
      }

      return {
        token,
        clientId: typeof claims.client_id === 'string' ? claims.client_id : 'supabase-oauth-client',
        scopes: parseScopes(claims),
        expiresAt,
        resource: maybeUrl(claims.resource || claims.aud),
        extra: {
          claims,
          userId: user.id,
          userEmail: user.email || null,
          actor: {
            socio_id: socio.id,
            usuario_id: socio.usuario_id || null,
            nombre: `${socio.nombre || ''} ${socio.apellido || ''}`.trim(),
            email: socio.email || user.email || null,
            rol: socio.rol || 'socio',
            rol_aile: socio.rol_aile || null,
            direcciones: Array.isArray(memberships) ? memberships.map((membership) => ({
              direccion_id: membership.direccion_id,
              codigo: membership.direcciones?.codigo || null,
              direccion: membership.direcciones?.nombre || null,
              es_director: membership.es_director === true,
            })) : [],
          },
        },
      };
    },
  };
}

function buildWwwAuthenticateHeader(errorCode, message, { requiredScopes, resourceMetadataUrl }) {
  let header = `Bearer error="${errorCode}", error_description="${message}"`;

  if (requiredScopes.length > 0) {
    header += `, scope="${requiredScopes.join(' ')}"`;
  }

  if (resourceMetadataUrl) {
    header += `, resource_metadata="${resourceMetadataUrl}"`;
  }

  return header;
}

function createJsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export async function authenticateMcpRequest(request, {
  verifier,
  resourceMetadataUrl,
  requiredScopes = [],
}) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new InvalidTokenError('Missing Authorization header');
    }

    const [type, token] = authHeader.split(' ');

    if (type?.toLowerCase() !== 'bearer' || !token) {
      throw new InvalidTokenError("Invalid Authorization header format, expected 'Bearer TOKEN'");
    }

    const authInfo = await verifier.verifyAccessToken(token);

    if (requiredScopes.length > 0) {
      const hasAllScopes = requiredScopes.every((scope) => authInfo.scopes.includes(scope));
      if (!hasAllScopes) {
        throw new InsufficientScopeError('Insufficient scope');
      }
    }

    if (typeof authInfo.expiresAt !== 'number' || Number.isNaN(authInfo.expiresAt)) {
      throw new InvalidTokenError('Token has no expiration time');
    }

    if (authInfo.expiresAt < Date.now() / 1000) {
      throw new InvalidTokenError('Token has expired');
    }

    return { authInfo };
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      return {
        response: createJsonResponse(error.toResponseObject(), {
          status: 401,
          headers: {
            'WWW-Authenticate': buildWwwAuthenticateHeader(error.errorCode, error.message, {
              requiredScopes,
              resourceMetadataUrl,
            }),
          },
        }),
      };
    }

    if (error instanceof InsufficientScopeError) {
      return {
        response: createJsonResponse(error.toResponseObject(), {
          status: 403,
          headers: {
            'WWW-Authenticate': buildWwwAuthenticateHeader(error.errorCode, error.message, {
              requiredScopes,
              resourceMetadataUrl,
            }),
          },
        }),
      };
    }

    if (error instanceof ServerError) {
      return {
        response: createJsonResponse(error.toResponseObject(), { status: 500 }),
      };
    }

    const serverError = new ServerError('Internal Server Error');
    return {
      response: createJsonResponse(serverError.toResponseObject(), { status: 500 }),
    };
  }
}
