# MCP de Tareas Local

Primera versión local del MCP de tareas para AILE.

Objetivo de este corte:
- reutilizar el modelo real de tareas del sistema
- operar localmente desde Claude Desktop
- habilitar lectura completa y escritura básica controlada
- evitar todavía la complejidad de OAuth remoto y federación de identidad

## Qué expone

Servidor MCP local por `stdio`:
- `aile_tasks_get_dashboard`
- `aile_tasks_list_projects`
- `aile_tasks_list_tasks`
- `aile_tasks_get_task_details`
- `aile_tasks_list_assignable_members`
- `aile_tasks_get_member_workload`
- `aile_tasks_get_local_actor`
- `aile_tasks_create_task`
- `aile_tasks_create_tasks_batch`
- `aile_tasks_assign_task`
- `aile_tasks_update_task`
- `aile_tasks_update_task_status`
- `aile_tasks_create_subtask`

## Cómo funciona

- Usa `SUPABASE_SERVICE_ROLE_KEY` y `NEXT_PUBLIC_SUPABASE_URL`.
- Carga `.env` y luego `.env.local` desde la raíz del repo.
- Para escritura local usa un actor fijo configurado en `AILE_MCP_ACTOR_SOCIO_ID` o `AILE_MCP_ACTOR_EMAIL`.
- Está pensado para uso personal/local en esta fase.

## Modo remoto

Además del modo local por `stdio`, ahora existe una variante remota del MCP dentro de la app Next.

URLs esperadas una vez desplegado:
- MCP remoto: `https://interno.aile.com.ar/api/mcp/tareas`
- Protected resource metadata: `https://interno.aile.com.ar/.well-known/oauth-protected-resource/api/mcp/tareas`
- Pantalla de consentimiento OAuth: `https://interno.aile.com.ar/oauth/consent`

Cómo funciona el modo remoto:
- el cliente MCP se conecta por `Streamable HTTP`
- si no tiene token, recibe `401` con `WWW-Authenticate` apuntando al metadata del recurso protegido
- ese metadata declara a Supabase como `authorization server`
- Supabase redirige al usuario a `https://interno.aile.com.ar/oauth/consent`
- una vez aprobado, el MCP remoto ejecuta lecturas y RPCs con el bearer del usuario autenticado

Alcance del MCP remoto:
- conserva las tools de lectura y escritura conversacional ya existentes
- agrega herramientas remotas para proyectos, handoff, envío a CD, resolución de CD, borrado de tareas y edición de subtareas
- deja de depender del actor fijo local para operar

## Arranque manual

```bash
node mcp/tareas/server.mjs
```

Atajo opcional:

```bash
npm run mcp:tareas
```

Nota:
- para integración MCP real conviene ejecutar `node mcp/tareas/server.mjs` directamente
- evitar `npm run ...` como comando del cliente MCP si ese cliente es sensible a cualquier salida extra en `stdout`

## Ejemplo de configuración local

Ejemplo orientativo para clientes MCP tipo Claude Desktop que lanzan un proceso local:

```json
{
  "mcpServers": {
    "aile-tareas": {
      "command": "/bin/zsh",
      "args": [
        "-lc",
        "cd '/Volumes/Kingston/PROYECTOS WEB/Sistema Interno AILE/aile-internal-system' && AILE_MCP_ACTOR_SOCIO_ID='REEMPLAZAR_SOCIO_ID' /Users/lauti/.nvm/versions/node/v24.14.0/bin/node mcp/tareas/server.mjs"
      ]
    }
  }
}
```

Si el cliente no preserva bien el entorno, una alternativa es invocarlo desde shell:

```json
{
  "mcpServers": {
    "aile-tareas": {
      "command": "/bin/zsh",
      "args": [
        "-lc",
        "cd '/Volumes/Kingston/PROYECTOS WEB/Sistema Interno AILE/aile-internal-system' && node mcp/tareas/server.mjs"
      ]
    }
  }
}
```

## Alcance actual

Sí:
- ver panorama de tareas
- listar proyectos
- listar tareas
- ver detalle de tarea
- listar personas asignables
- ver carga de trabajo de socios
- ver con qué actor local está operando el MCP
- crear una tarea
- crear varias tareas en lote
- asignar o reasignar una tarea
- actualizar estado de una tarea existente
- editar título, descripción, prioridad o fecha límite de una tarea existente
- crear subtareas

Todavía pendiente o mejorable:
- comentarios/notas sobre tareas
- validación más estricta de scopes OAuth
- observabilidad específica del modo remoto

## Modo seguro con `dry_run`

Las tools de escritura aceptan `dry_run: true`.

Uso recomendado:
1. primero pedir un `dry_run`
2. revisar proyecto, asignación, prioridad y fecha
3. ejecutar sin `dry_run` cuando esté correcto

## Siguiente etapa sugerida

1. Agregar comentarios/notas y, si hace falta, eliminación controlada.
2. Endurecer verificación de scopes y, si hace falta, resource indicators OAuth.
3. Añadir observabilidad específica para el MCP remoto.
4. Probar el flujo end-to-end con clientes remotos reales y ajustar ergonomía según uso.
