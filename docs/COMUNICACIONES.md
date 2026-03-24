# Modulo de Comunicaciones

## Variables de entorno

Completar en `.env.local` o en el entorno de despliegue:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_FROM_NAME`
- `EMAIL_UNSUBSCRIBE_SECRET`
- `APP_URL`
- `DATABASE_URL` o `MONGODB_URI`
- `MONGODB_USERS_COLLECTION`

Opcional si la base no viene en la URI:

- `MONGODB_DB_NAME`

Opcionales para mapear la coleccion publica de Mongo:

- `MONGODB_USERS_EMAIL_FIELD`
- `MONGODB_USERS_FIRST_NAME_FIELD`
- `MONGODB_USERS_LAST_NAME_FIELD`
- `MONGODB_USERS_NAME_FIELD`
- `MONGODB_USERS_PROVIDER_FIELD`
- `MONGODB_USERS_CREATED_AT_FIELD`
- `MONGODB_USERS_OPT_IN_FIELD`

Si estos campos opcionales no se configuran, el sistema intenta resolverlos con heuristicas sobre nombres comunes.

## Migracion

Aplicar la migracion de Supabase:

- `supabase/migrations/051_communications_module.sql`
- `supabase/migrations/052_communications_contact_profile_fields.sql`

La migracion crea:

- acceso puntual al modulo
- contactos, tags, segmentos y plantillas
- campañas, destinatarios y eventos
- corridas de sincronizacion
- funciones de sync y helpers RLS
- extension del sistema de permisos para `comunicaciones`

## Flujo general

1. Entrar al modulo `Comunicaciones`.
2. Ejecutar `Sincronizar contactos` para importar desde MongoDB.
3. Revisar y etiquetar contactos en la tab `Contactos`.
4. Crear o ajustar plantillas base en `Plantillas`.
5. Crear una campana, guardar borrador, generar preview y enviar pruebas.
6. Confirmar envio real una vez validado el contenido.
7. Consultar resultados por campana y ultimas sincronizaciones.

## Sincronizacion desde MongoDB

- La sync es manual y se dispara desde el panel.
- El sistema conecta directo a MongoDB usando `MONGODB_URI` o, si no existe, `DATABASE_URL`.
- Si la URI ya trae el nombre de base, `MONGODB_DB_NAME` no hace falta.
- Se hace upsert por email normalizado.
- Si no se configura `MONGODB_USERS_COLLECTION`, el sistema intenta detectar automaticamente `User/users`.
- Se sincronizan tambien campos ampliados del perfil cuando existen en la base publica:
  - alias / nombre de cuenta
  - roles
  - estado activo/inactivo
  - email verificado
  - fecha de nacimiento
  - DNI
  - telefono
- Las etiquetas provenientes de la base principal se guardan como tags sincronizadas y se actualizan en cada sync sin pisar las tags manuales del sistema interno.
- MongoDB se usa solo como fuente de lectura para sincronizacion. Las tags locales, filtros guardados y segmentaciones de email marketing se guardan solo en Supabase.
- `unsubscribed` y `bounced` no se pisan durante la sync.
- Cada corrida queda registrada en `email_sync_runs`.

## Campañas y envíos

- El envio real siempre sucede desde backend seguro.
- Se excluyen automaticamente contactos `unsubscribed`, `bounced` o `inactive`.
- El sistema bloquea reenvíos accidentales de campañas ya enviadas o en proceso.
- Los envios se procesan por lotes y registran estado por destinatario.

## Unsubscribe

- Cada correo institucional incluye link de baja.
- La baja impacta solo al modulo institucional nuevo.
- No corta las notificaciones operativas existentes del sistema.
- La accion registra un evento de trazabilidad.

## Buenas practicas implementadas

- validacion de asunto y contenido minimo
- exclusion de destinatarios invalidos
- confirmacion previa al envio real
- trazabilidad por campana, destinatario y evento
- separacion entre emails institucionales y operativos
