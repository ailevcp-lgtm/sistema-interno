# Tareas Kanban: Arquitectura Operativa

## 1. Objetivo
Definir una base única para gestionar proyectos, tareas y subtareas con control RBAC validado en SQL (RLS + RPC), sin depender del frontend para permisos críticos.

## 2. Modelo de datos
Migración base: `supabase/migrations/027_tasks_core_schema.sql`.

Componentes principales:
- Enums:
  - `tipo_proyecto_tarea`: `institucional | interno_direccion`
  - `estado_tarea`: ciclo completo de Kanban, incluyendo `pendiente_handoff`, `pendiente_aprobacion_cd`, `observada_cd`, `aprobada_cd`
- Catálogo organizacional:
  - `direcciones`
  - `socios_direcciones` (afiliación + flag `es_director`)
- Dominio Kanban:
  - `proyectos_tareas`
  - `tareas`
  - `subtareas`
- Flujos especiales:
  - `tareas_handoffs`
  - `tareas_aprobaciones_cd`
  - `tareas_historial` (append-only)

## 3. Seguridad (SQL first)
Reglas funcionales obligatorias:
1. Todo `authenticated` puede ver proyectos/tareas/subtareas.
2. Puede gestionar (crear, asignar, reasignar, handoff, borrar, enviar/aprobar CD):
   - `comision_directiva`
   - `admin`
   - director activo de la dirección dueña del proyecto.
3. Puede editar una tarea/subtarea sin gestionar:
   - socio asignado a esa tarea/subtarea.

Implementación esperada:
- RLS por tabla para visibilidad y mutaciones.
- RPC de negocio para operaciones sensibles (gestión/handoff/CD).
- Frontend solo consume/oculta UX, no decide permisos finales.

## 4. Seed demo y escenarios de validación
Migración demo: `supabase/migrations/029_tasks_seed_demo.sql`.

Incluye:
- Proyecto institucional: `Modelo ONU - Carteles`
- Proyecto interno de Comunicación: `Planificación Redes`
- Escenarios cubiertos:
  - socio no asignado
  - socio asignado
  - director dueño
  - director ajeno
  - CD/admin
  - handoff entre Comunicación y Finanzas
  - tareas en `pendiente_aprobacion_cd`, `observada_cd`, `aprobada_cd`

## 5. RPC de snapshot para QA
`029_tasks_seed_demo.sql` agrega `rpc_tareas_qc_snapshot()` para inspección técnica:
- existencia de tablas Kanban
- estado RLS por tabla
- cantidad de políticas por tabla
- inventario de RPC `rpc_tareas_%`
- presencia de proyectos/personas demo

Uso recomendado: base para CI/manual gate de despliegue.

## 6. Verificación automática
Script: `scripts/verify-tareas-rbac.ts`

Qué valida:
- estructura base (tablas + datos demo)
- señales de seguridad (RLS/policies + RPC)
- escenarios de negocio sobre dataset de ejemplo

Ejecución:
```bash
cd scripts
npx tsx verify-tareas-rbac.ts
```

## 7. Idempotencia y reproducibilidad
Garantías aplicadas:
- IDs fijos para proyectos/tareas/subtareas/handoffs/aprobaciones/historial demo.
- `ON CONFLICT` para upsert seguro en tablas mutables.
- `ON CONFLICT DO NOTHING` en historial append-only.
- Script de verificación determinístico sobre nombres/IDs demo.
