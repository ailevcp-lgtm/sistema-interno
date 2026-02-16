# Tareas Kanban: QA Checklist Manual

## 0. Precondiciones
- Migraciones aplicadas hasta `029_tasks_seed_demo.sql`.
- Proyecto demo disponible:
  - `Modelo ONU - Carteles` (institucional)
  - `Planificación Redes` (interno_direccion, Comunicación)
- Cuentas de prueba disponibles para los perfiles de la matriz.

## 1. Smoke técnico (obligatorio)
Ejecutar:
```bash
cd scripts
npx tsx verify-tareas-rbac.ts
```

Resultado esperado:
- Sin fallas en datos demo.
- Sin fallas en señales RBAC (RLS + RPC).

## 2. Casos por perfil (criterio de aceptación)

### 2.1 Socio no asignado
- Actor: `gabrielgarciaimportantes@gmail.com`
- Verifica:
  - puede listar proyectos/tareas/subtareas
  - no puede crear tarea
  - no puede reasignar ni borrar
  - no puede enviar ni aprobar CD

### 2.2 Socio asignado
- Actor: `naiiabatte@gmail.com`
- Verifica:
  - puede editar su tarea/subtarea asignada
  - no puede gestionar tareas ajenas
  - no puede aprobar CD si no tiene rol habilitado

### 2.3 Director dueño
- Actor: `emiagugames@gmail.com` (director Comunicación)
- Proyecto: `Planificación Redes`
- Verifica:
  - puede crear/editar/reesignar/borrar en proyecto de su dirección
  - puede iniciar y resolver flujo de handoff
  - puede enviar a CD

### 2.4 Director ajeno
- Actor: `nachoalcedo@gmail.com` (director Finanzas)
- Proyecto: `Planificación Redes` (Comunicación)
- Verifica:
  - puede ver
  - no puede gestionar por no ser dueño de la dirección
  - solo puede editar si está explícitamente asignado

### 2.5 CD/Admin
- Actores: `matimarchesinkossoy@gmail.com`, `faustolavezzari99@gmail.com`
- Verifica:
  - pueden gestionar y resolver aprobaciones CD
  - pueden aprobar u observar tareas en estado `pendiente_aprobacion_cd`

## 3. Escenario handoff entre direcciones (obligatorio)
- Caso demo: tarea `Alinear pauta con Finanzas`.
- Flujo:
  - origen Comunicación
  - destino Finanzas
  - resolución aceptada por autoridad habilitada
- Verifica:
  - cambio de estado de tarea consistente
  - trazabilidad en `tareas_handoffs` y `tareas_historial`

## 4. Escenario aprobación CD (obligatorio)
- Casos demo:
  - `Enviar arte final a Comisión Directiva` (pendiente)
  - `Aplicar observaciones de CD` (observada)
  - `Publicación final aprobada por CD` (aprobada)
- Verifica:
  - solo perfiles habilitados ejecutan decisiones CD
  - observaciones exigen texto
  - estado final de tarea consistente con decisiones

## 5. Idempotencia y reproducibilidad (obligatorio)
- Reaplicar seed demo en entorno limpio y validar mismos IDs/escenarios.
- Ejecutar verificación automática en al menos 2 corridas consecutivas.
- Confirmar que no se duplican registros demo por re-ejecución.

## 6. Gate de despliegue recomendado
No desplegar si ocurre cualquiera de estos puntos:
- falla de RLS en tablas Kanban
- ausencia de RPC de negocio para handoff/CD
- discrepancias en escenarios de perfil (matriz RBAC)
- handoff inter-direcciones o aprobación CD sin trazabilidad
