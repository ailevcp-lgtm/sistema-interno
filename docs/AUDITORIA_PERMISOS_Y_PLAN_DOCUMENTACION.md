# Auditoría integral de permisos y plan de documentación por rol/funcionalidad

Fecha de auditoría: 2026-03-04  
Base auditada: frontend (`app`, `components`, `hooks`, `lib`) + migraciones SQL (`supabase/migrations`)  
Tipo de auditoría: estática (código y migraciones en repositorio)

## 1) Objetivo

Definir un plan implementable para crear una sección de **Documentación** que explique, por cada:

- rol del sistema,
- rol institucional (AILE),
- funcionalidad/módulo,
- pestaña/subsección,

qué se puede hacer, qué no, a qué datos se accede y cómo usar cada flujo.

---

## 2) Modelo actual de permisos (estado real en código)

### 2.1 Recursos y acciones

Recursos definidos en [`lib/constants.ts`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/lib/constants.ts): `dashboard`, `calendario`, `tareas`, `socios`, `deudas`, `movimientos`, `finanzas`, `tesoreria`, `reintegros`, `documentos`, `configuracion`, `estatuto`, `resoluciones`, `balances`, `logs` (línea aprox. 272 en adelante para matriz).

Acciones: `ver`, `crear`, `editar`, `eliminar`, `aprobar`.

### 2.2 Matriz RBAC base (sin overrides dinámicos)

| Recurso | Ver | Crear | Editar | Eliminar | Aprobar |
|---|---|---|---|---|---|
| dashboard | socio, comision_directiva, revisor_cuentas, admin | - | - | - | - |
| calendario | socio, comision_directiva, revisor_cuentas, admin | comision_directiva, admin | comision_directiva, admin | comision_directiva, admin | - |
| tareas | socio, comision_directiva, revisor_cuentas, admin | - | - | - | - |
| socios | comision_directiva, revisor_cuentas, admin | comision_directiva, admin | comision_directiva, admin | admin | - |
| deudas | comision_directiva, revisor_cuentas, admin | comision_directiva, admin | comision_directiva, admin | admin | - |
| movimientos | socio, comision_directiva, revisor_cuentas, admin | comision_directiva, admin | comision_directiva, admin | admin | - |
| finanzas | comision_directiva, revisor_cuentas, admin | comision_directiva, admin | comision_directiva, admin | admin | - |
| tesoreria | comision_directiva, revisor_cuentas, admin | comision_directiva, admin | comision_directiva, admin | admin | - |
| reintegros | comision_directiva, admin | comision_directiva, admin | comision_directiva, admin | admin | comision_directiva, admin |
| documentos | comision_directiva, revisor_cuentas, admin | comision_directiva, admin | comision_directiva, admin | admin | - |
| configuracion | comision_directiva, admin | comision_directiva, admin | comision_directiva, admin | admin | - |
| estatuto | comision_directiva, revisor_cuentas, admin | - | admin | - | - |
| resoluciones | comision_directiva, revisor_cuentas, admin | comision_directiva, admin | comision_directiva, admin | admin | - |
| balances | comision_directiva, revisor_cuentas, admin | comision_directiva, admin | comision_directiva, admin | admin | comision_directiva, admin |
| logs | comision_directiva, admin | - | - | - | - |

Fuente: [`lib/constants.ts`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/lib/constants.ts):301,329,343.

### 2.3 Overrides institucionales y reglas especiales

- Global manager: `admin`, `comision_directiva` y ciertos cargos AILE (`Presidente`, `Tesorero`, `Secretario General`, `Vocal Titular`) devuelven `true` en `isGlobalManager`.
- Overrides institucionales hardcodeados:
  - RRHH: `socios.ver`, `socios.editar`.
  - Finanzas (`Director(a)`, `Miembro`, `Tesorero`): `finanzas.ver`, `tesoreria.ver`, `reintegros.ver`, `reintegros.crear`.
  - Director(a) Finanzas además: `deudas.ver`, `deudas.editar`.
- Overrides dinámicos desde DB:
  - `role_permission_overrides`.
  - `role_task_scope_overrides`.

Fuentes:

- [`lib/constants.ts`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/lib/constants.ts):142,182,193,208,266,433.
- [`hooks/useAuth.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/hooks/useAuth.tsx):364,603,662.

### 2.4 Excepciones funcionales

- **Deudas / “Mi deuda”**: navegación permite entrada a `/deudas` si el usuario tiene `socio_id` aunque no tenga `deudas.ver`.
  - [`components/aile/sidebar.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/components/aile/sidebar.tsx):26,47,48
  - [`components/aile/bottom-nav.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/components/aile/bottom-nav.tsx):29,47,48
  - [`components/layout/app-shell.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/components/layout/app-shell.tsx):26
- **Simulación de rol**:
  - habilitada solo para `lautarolopezlabrin@gmail.com`,
  - y condicionada a permiso real de configuración.
  - [`hooks/useAuth.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/hooks/useAuth.tsx):64,364

---

## 3) Auditoría por módulo y pestaña

## 3.1 Inicio (`/dashboard`)

- Acceso: abierto a usuario autenticado.
- Render condicional: varias tarjetas dependen de `hasPermission(...)`.
- Observación: accesos rápidos incluyen links no filtrados por permiso para algunos módulos (ej. `/socios`).
- Evidencia: [`app/(app)/dashboard/page.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/app/(app)/dashboard/page.tsx):552,564,576,600,606.

## 3.2 Calendario (`/calendario`)

- Acceso de lectura amplio.
- Mutaciones protegidas en hook por `calendario.crear/editar/eliminar`.
- Usa RPC para reuniones y políticas RLS específicas.
- Evidencia:
  - [`hooks/useCalendario.ts`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/hooks/useCalendario.ts):199,200,201,202,540,610,653,694,736.
  - [`supabase/migrations/024_calendar_module.sql`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/supabase/migrations/024_calendar_module.sql)
  - [`supabase/migrations/025_fix_calendar_rls_recursion.sql`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/supabase/migrations/025_fix_calendar_rls_recursion.sql)
  - [`supabase/migrations/035_calendar_planning_module.sql`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/supabase/migrations/035_calendar_planning_module.sql)

## 3.3 Tareas (`/tareas`)

- Página principal delega en `TareasModulePage`.
- Permisos compuestos: RBAC + scope por dirección + asignación + aprobaciones CD.
- Buen nivel de validación frontend antes de RPC.
- Evidencia:
  - [`app/(app)/tareas/page.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/app/(app)/tareas/page.tsx)
  - [`hooks/useTareas.ts`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/hooks/useTareas.ts):489,527,537,556,650,1131,1268,1322,1460.
  - [`supabase/migrations/028_tasks_permissions_workflow.sql`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/supabase/migrations/028_tasks_permissions_workflow.sql)
  - [`supabase/migrations/039_tasks_scope_controls_from_settings.sql`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/supabase/migrations/039_tasks_scope_controls_from_settings.sql)

## 3.4 Socios (`/socios`, `/socios/[id]`)

- Listado:
  - guardado con `useRequirePermission('socios','ver')`.
  - crear/editar condicionados por `socios.crear` y `socios.editar`.
- Hallazgo:
  - acción “Eliminar” en UI depende de `canEdit` (no de `socios.eliminar`).
  - `deleteSocio` en hook no valida permiso en cliente.
- Detalle (`/socios/[id]`):
  - no usa `useRequirePermission`; depende de flujo y datos del hook.
- Evidencia:
  - [`app/(app)/socios/page.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/app/(app)/socios/page.tsx):37,70,355,356
  - [`hooks/useSocios.ts`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/hooks/useSocios.ts):143,175,195
  - [`app/(app)/socios/[id]/page.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/app/(app)/socios/[id]/page.tsx):37,38,41

## 3.5 Deudas (`/deudas`, `/deudas/mi-cuenta`)

- Acceso:
  - gestión completa si `deudas.ver`.
  - si no, pero tiene `socio_id`, redirige a `mi-cuenta`.
- Hallazgo:
  - mutaciones en `useCuotas` (registrar pago, anular, promos) no validan permiso en hook.
- Evidencia:
  - [`app/(app)/deudas/page.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/app/(app)/deudas/page.tsx):69,70,99,100,101,105,106,302
  - [`hooks/useSocios.ts`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/hooks/useSocios.ts):283,481,596,672,686,701
  - [`app/(app)/deudas/mi-cuenta/page.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/app/(app)/deudas/mi-cuenta/page.tsx)

## 3.6 Movimientos (`/movimientos`)

- Página y componente sin guard explícito por permiso.
- Depende de visibilidad en navegación y/o RLS.
- Evidencia:
  - [`app/(app)/movimientos/page.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/app/(app)/movimientos/page.tsx):3,6
  - [`components/aile/movimientos/movimientos-chronology.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/components/aile/movimientos/movimientos-chronology.tsx):51

## 3.7 Finanzas (`/finanzas`)

- Guarda acceso con `finanzas.ver` en la página.
- Hook de finanzas opera sobre datos y también tiene mutación `registrarMovimiento`.
- Evidencia:
  - [`app/(app)/finanzas/page.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/app/(app)/finanzas/page.tsx):11
  - [`hooks/useFinanzas.ts`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/hooks/useFinanzas.ts)

## 3.8 Tesorería (`/tesoreria`)

- Guarda lectura con `tesoreria.ver`.
- UI de edición condicionada por `tesoreria.editar`.
- Hallazgo:
  - `useTesoreria.registrarArqueo` y `NuevaTransaccionModal` no revalidan permiso en cliente.
- Evidencia:
  - [`app/(app)/tesoreria/page.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/app/(app)/tesoreria/page.tsx):27,28,41,47,59
  - [`hooks/useTesoreria.ts`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/hooks/useTesoreria.ts):136,148
  - [`components/aile/tesoreria/nueva-transaccion-modal.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/components/aile/tesoreria/nueva-transaccion-modal.tsx):58,73

## 3.9 Reintegros (`/reintegros`)

- Guarda por `reintegros.ver`.
- Capacidades separadas:
  - crear/enviar/cancelar por `reintegros.crear`,
  - aprobar/observar/rechazar/pagar por `reintegros.aprobar`.
- Tabs: `Mis reintegros`, `Bandeja de aprobación`, `Pendientes de pago`.
- Evidencia:
  - [`app/(app)/reintegros/page.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/app/(app)/reintegros/page.tsx):103,104,105,377,379,380,381,508,614
  - [`supabase/migrations/022_reintegros_core.sql`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/supabase/migrations/022_reintegros_core.sql)
  - [`supabase/migrations/033_roles_audit_permissions_alignment.sql`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/supabase/migrations/033_roles_audit_permissions_alignment.sql)

## 3.10 Documentos (`/documentos`)

- Guardado con `useRequirePermission('documentos','ver')`.
- Tabs: `Estatuto`, `Resoluciones`, `Decretos CD`, `Balances`.
- Hallazgo:
  - UI muestra links admin a `/admin/estatuto` y `/admin/resoluciones`.
  - esas rutas no existen en `app/` actualmente.
  - hook `useDocumentos` ejecuta writes directos sin check local.
- Evidencia:
  - [`app/(app)/documentos/page.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/app/(app)/documentos/page.tsx):7
  - [`components/aile/documentos.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/components/aile/documentos.tsx):65,76,151,159
  - [`hooks/useDocumentos.ts`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/hooks/useDocumentos.ts):53,73,89,105,120,160,177,219

## 3.11 Configuración (`/configuracion`)

- Guard de acceso: `configuracion.ver` usando permiso real (`useActualPermission`), no simulado.
- Tabs: `Roles`, `Cuotas`, `Categorías`, `Logs`.
- Hallazgo:
  - no hay subpermisos por tab ni por operación; con `configuracion.ver` se llega a operaciones sensibles.
- Evidencia:
  - [`app/(app)/configuracion/page.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/app/(app)/configuracion/page.tsx):59,73,80,87,94,103,104
  - [`hooks/useAuth.tsx`](/Volumes/Kingston/PROYECTOS%20WEB/Sistema%20Interno%20AILE/aile-internal-system/hooks/useAuth.tsx):662

---

## 4) Hallazgos críticos priorizados

| Prioridad | Hallazgo | Riesgo | Acción recomendada |
|---|---|---|---|
| Alta | En Socios, “Eliminar” depende de `socios.editar` y no `socios.eliminar`. | Escalación de privilegio en UI y confusión de autorización. | Separar `canDelete` y exigir `socios.eliminar` en UI + hook + RLS. |
| Alta | `/socios/[id]` no tiene guard explícito de acceso. | Acceso por URL directa según estado de RLS. | Agregar `useRequirePermission('socios','ver')` o guard contextual por propietario/rol. |
| Alta | Movimientos no tiene guard explícito en página. | Exposición de datos si RLS queda permisivo. | Agregar guard en ruta (`movimientos.ver`) y test de acceso. |
| Alta | Varias mutaciones en hooks (deudas, documentos, tesorería) no revalidan permiso local. | Dependencia fuerte en ocultamiento de UI. | Agregar validación client-side consistente y forzar RPC/RLS para mutaciones críticas. |
| Media | Configuración no tiene granularidad por tab/operación. | Cualquier rol con `configuracion.ver` accede a funciones de alto impacto. | Introducir recursos internos (`config_roles`, `config_cuotas`, etc.) o acciones por tab. |
| Media | Links `/admin/*` en Documentos sin rutas existentes. | UX rota y confusión de alcance de permisos. | Implementar rutas o retirar botones hasta tener flujo real. |
| Media | Historial de migraciones incluye políticas muy permisivas (`USING (true)`). | Difícil asegurar postura final sin validación runtime de `pg_policies`. | Ejecutar auditoría SQL en entorno real y fijar baseline oficial de políticas activas. |
| Baja | Reglas especiales dispersas (hardcode + overrides DB + excepciones por módulo). | Mantenimiento complejo y mayor riesgo de regresión. | Centralizar catálogo canónico de permisos y generar docs desde fuente única. |

---

## 5) Plan de implementación para la sección “Documentación”

## 5.1 Resultado esperado

Crear una sección `/documentacion` dentro del sistema que permita ver:

- por rol del sistema y rol AILE,
- por módulo y pestaña,
- capacidades (`puede`) y restricciones (`no puede`),
- acceso a datos,
- pasos de uso.

## 5.2 Fases (roadmap)

| Fase | Objetivo | Entregable | Estimación |
|---|---|---|---|
| F0 | Normalizar seguridad antes de documentar | Fix de hallazgos críticos (socios/movimientos/guards base) | 2-4 días |
| F1 | Definir fuente canónica de permisos | `permissions-catalog.json` generado desde matriz + overrides + rutas | 1-2 días |
| F2 | Modelo de contenido documental | Esquema `doc_entry` por rol/módulo/pestaña con campos de uso y límites | 1 día |
| F3 | Carga inicial de documentación | Contenido completo por módulo/pestaña/rol con revisión funcional | 3-5 días |
| F4 | Implementar UI `/documentacion` | Página con filtros por rol, módulo y buscador; vista por pestañas | 2-3 días |
| F5 | QA + automatización | Checklist QA de permisos + test e2e de visibilidad + control de drift | 2 días |

## 5.3 Estructura técnica sugerida

- `app/(app)/documentacion/page.tsx`
- `components/aile/documentacion/*`
- `lib/permissions-catalog.ts`
- `content/documentacion-permisos/*.md` (o JSON estructurado)
- `scripts/generate-permissions-catalog.ts`

## 5.4 Esquema mínimo del contenido (por entrada)

Cada entrada documental debe tener:

- `rolSistema`
- `rolAile` (opcional)
- `modulo`
- `pestana`
- `accionesPermitidas`
- `accionesRestringidas`
- `accesoDatos`
- `pasosDeUso`
- `erroresFrecuentes`
- `notasSeguridad`
- `fuenteCodigo` (archivo/línea)
- `ultimaRevision`

## 5.5 Reglas de mantenimiento

- Cada cambio en permisos debe incluir actualización de documentación en el mismo PR.
- CI debe fallar si cambia el catálogo de permisos y no cambia la documentación asociada.
- Revisión mensual de consistencia entre:
  - `lib/constants.ts`,
  - overrides DB (`role_permission_overrides`, `role_task_scope_overrides`),
  - guards de rutas,
  - políticas RLS activas.

---

## 6) Validación de backend (paso obligatorio antes de publicar docs)

Antes de publicar la documentación final al usuario:

1. Ejecutar auditoría runtime en Supabase con `pg_policies` para saber políticas efectivamente activas.
2. Confirmar por tabla crítica (`socios`, `cuotas`, `movimientos`, `documentos`, `reintegros`, `tareas`, `calendario`) que no queden permisos excesivos.
3. Consolidar “matriz efectiva final” y usarla como fuente oficial para docs.

Consulta base sugerida:

```sql
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

---

## 7) Punto MD listo para backlog

```md
- [ ] Módulo “Documentación de Permisos” (Rol x Funcionalidad x Pestaña)
  - Objetivo: permitir que cualquier usuario entienda qué puede/no puede hacer según su rol.
  - Alcance:
    - Ruta interna `/documentacion` con filtros por rol, módulo y pestaña.
    - Contenido por cada módulo: acciones permitidas/restringidas, acceso a datos y pasos de uso.
    - Cobertura de tabs internas: Configuración (Roles/Cuotas/Categorías/Logs), Documentos (Estatuto/Resoluciones/Decretos/Balances), Reintegros (Mis/Bandeja/Pagos), etc.
  - Dependencias:
    - Cerrar hallazgos críticos de permisos (socios/movimientos/guards).
    - Consolidar matriz efectiva con RLS real en DB.
  - Criterios de aceptación:
    - 100% de módulos y pestañas documentados.
    - 100% de roles documentados (sistema + institucional cuando aplique).
    - Trazabilidad a código/política por entrada.
    - Checklist QA de permisos aprobado.
```

---

## 8) Cierre de auditoría

El sistema tiene una base RBAC sólida y evolución importante en tareas/calendario/reintegros, pero hoy existen diferencias entre permisos declarados, guards de UI y enforcement efectivo en algunas rutas/mutaciones.  
Para que la sección de documentación sea confiable, primero debe cerrarse la brecha de enforcement y luego generar la documentación desde una fuente canónica única.

