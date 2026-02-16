# Tareas Kanban: Matriz de Permisos (RBAC)

## Alcance
La matriz aplica a:
- `proyectos_tareas`
- `tareas`
- `subtareas`
- `tareas_handoffs`
- `tareas_aprobaciones_cd`

## Definiciones
- Director dueño: socio con `socios_direcciones.es_director = true` en la misma `direccion_id` del proyecto.
- Director ajeno: director activo de una dirección distinta a la dueña del proyecto.
- Gestionar: crear, asignar, reasignar, handoff, borrar, enviar/aprobar CD.
- Editar asignada: cambios de contenido/estado sobre tarea o subtarea donde `asignado_socio_id` coincide con el actor.

## Matriz
| Actor | Ver proyectos/tareas/subtareas | Gestionar proyecto/tarea/subtarea | Crear/Reasignar Handoff | Enviar a CD | Aprobar CD | Editar tarea/subtarea asignada |
|---|---|---|---|---|---|---|
| Socio no asignado | Si | No | No | No | No | No |
| Socio asignado | Si | No | No | No | No | Si |
| Director dueño | Si | Si | Si | Si | Si | Si |
| Director ajeno | Si | No | No | No | No | Solo si esta asignado |
| Comision Directiva | Si | Si | Si | Si | Si | Si |
| Admin | Si | Si | Si | Si | Si | Si |

## Reglas SQL obligatorias
1. Nunca confiar solo en frontend.
2. RLS debe proteger tablas base.
3. RPC debe concentrar operaciones de gestión crítica.
4. Cualquier operación sensible debe validar actor en SQL antes de mutar datos.

## Contratos mínimos sugeridos para RPC de negocio
- Operaciones de gestión:
  - crear proyecto/tarea/subtarea
  - asignar/reasignar
  - borrar
- Operaciones de flujo:
  - solicitar/resolver handoff
  - enviar a aprobación CD
  - aprobar/observar/rechazar CD

## Dataset de referencia para pruebas
Seed demo: `supabase/migrations/029_tasks_seed_demo.sql`.

Personas utilizadas:
- socio no asignado: `gabrielgarciaimportantes@gmail.com`
- socio asignado: `naiiabatte@gmail.com`
- director dueño (Comunicación): `emiagugames@gmail.com`
- director ajeno (Finanzas): `nachoalcedo@gmail.com`
- CD/admin: `matimarchesinkossoy@gmail.com`, `faustolavezzari99@gmail.com`
