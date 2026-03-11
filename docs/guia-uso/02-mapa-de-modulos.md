# Mapa actual de modulos y pantallas

Este documento no reemplaza la guia detallada.

Su funcion es dejar ordenado, en una sola vista, que existe hoy dentro del sistema y que deberia explicarse despues paso por paso.

## 1. Inicio

Funcion general:

- resume el estado general del sistema.

Elementos detectados:

- socios activos,
- socios con deuda,
- saldo actual,
- resoluciones vigentes,
- proximas fechas importantes,
- accesos rapidos.

## 2. Calendario

Funcion general:

- reunir en una sola agenda reuniones, planificacion institucional y vencimientos de tareas.

Elementos detectados:

- vista de calendario unificado,
- boton `Agregar fecha`,
- reuniones,
- planificacion,
- vencimientos de tareas,
- proximas reuniones,
- proximos vencimientos.

Subtipos actuales:

- Reunion
- Planificacion
- Vencimiento

## 3. Tareas

Funcion general:

- organizar el trabajo en tableros por proyecto y por direccion.

Elementos detectados:

- resumen de proyectos,
- resumen de tareas activas,
- resumen de tareas asignadas a la persona,
- vista `Proyectos Institucionales`,
- vista `Espacios por Direccion`,
- creacion de proyecto,
- creacion de tarea,
- edicion de proyecto,
- tablero Kanban por estados.

## 4. Socios

Funcion general:

- administrar la base de personas vinculadas a AILE.

Elementos detectados:

- total de socios,
- socios activos,
- socios inactivos,
- socios con deuda,
- buscador,
- filtros por estado,
- filtros por rol,
- alta de nuevo socio,
- vista de detalle,
- edicion,
- activacion e inactivacion.

## 5. Deudas

Funcion general:

- consultar cuotas, registrar cobros y seguir la cobranza.

Elementos detectados:

- total recaudado,
- total pendiente,
- total vencido,
- porcentaje de cobranza,
- barra de progreso,
- buscador,
- filtros por periodo,
- filtros por estado,
- exportacion,
- registro de pago,
- historial de pagos,
- anulacion de pago,
- promociones de cuotas.

## 6. Movimientos

Funcion general:

- ver ingresos y egresos en orden cronologico.

Elementos detectados:

- resumen de ingresos,
- resumen de egresos,
- balance,
- filtros por tipo,
- buscador por descripcion, categoria, evento o cuenta,
- lista agrupada por fecha.

## 7. Finanzas

Funcion general:

- analizar la informacion economica ya registrada.

Elementos detectados:

- filtros por año,
- filtros por categoria,
- filtros por evento,
- pestaña `Balance`,
- pestaña `Ingresos`,
- pestaña `Egresos`,
- pestaña `Eventos`,
- boton `Exportar`.

## 8. Tesoreria

Funcion general:

- administrar cuentas, caja y movimientos diarios.

Elementos detectados:

- listado de cuentas con saldo,
- boton `Nuevo Ingreso`,
- boton `Nuevo Egreso`,
- arqueo de cuenta,
- movimientos recientes,
- buscador de movimientos.

## 9. Reintegros

Funcion general:

- ordenar el circuito completo de una devolucion de gasto.

Elementos detectados:

- metricas de solicitudes en curso,
- metricas de solicitudes pagadas,
- metricas de total visible,
- pestaña `Mis reintegros`,
- pestaña `Bandeja de aprobacion`,
- pestaña `Pendientes de pago`,
- nueva solicitud,
- observacion,
- aprobacion,
- rechazo,
- registro de pago.

Estados detectados:

- Borrador
- Pendiente de aprobacion
- Observada
- Aprobada pendiente pago
- Rechazada
- Pagada
- Cancelada

## 10. Documentos

Funcion general:

- centralizar la documentacion institucional de consulta.

Pestañas detectadas:

- Estatuto
- Resoluciones
- Decretos CD
- Balances

Elementos detectados:

- lectura del estatuto por articulos,
- descarga de PDF del estatuto,
- consulta de resoluciones,
- consulta de decretos,
- consulta de balances,
- descarga o apertura de archivos asociados.

## 11. Ajustes

Funcion general:

- administrar reglas internas del sistema.

Pestañas detectadas:

- Roles
- Cuotas
- Categorias
- Logs

Elementos detectados:

- simulador de permisos,
- administrador de roles institucionales,
- asignacion de roles a personas,
- configuracion de cuotas,
- gestion de categorias financieras,
- consulta de registros de actividad.

## 12. Mi perfil

Funcion general:

- mostrar los datos personales y la informacion de pertenencia de la persona que ingreso.

Elementos detectados:

- datos personales,
- datos de socio,
- rol general,
- cargo institucional.

## 13. Mi estado de cuenta

Funcion general:

- permitir a cada socio revisar su propia situacion de cuotas y pagos.

Elementos detectados:

- deuda total,
- cuotas pagadas,
- cuotas pendientes,
- cuotas vencidas,
- detalle de cuotas pendientes,
- historial de pagos,
- resumen personal.

## 14. Orden recomendado para desarrollar la guia completa

Si seguimos esta base documental, el siguiente trabajo conviene hacerlo asi:

1. Explicar acceso e ingreso.
2. Explicar navegacion general.
3. Desarrollar `Inicio`.
4. Desarrollar `Calendario`.
5. Desarrollar `Tareas`.
6. Desarrollar `Socios`.
7. Desarrollar `Deudas`.
8. Desarrollar `Movimientos`.
9. Desarrollar `Finanzas`.
10. Desarrollar `Tesoreria`.
11. Desarrollar `Reintegros`.
12. Desarrollar `Documentos`.
13. Desarrollar `Ajustes`.
14. Cerrar con `Mi perfil` y `Mi estado de cuenta`.

## 15. Criterio sugerido para escribir cada capitulo

Cada modulo se puede documentar siempre con la misma estructura:

1. Para que sirve.
2. Quien lo usa.
3. Que ve la persona al entrar.
4. Que significan los datos o estados que aparecen.
5. Que acciones puede realizar.
6. Ejemplo de uso paso a paso.
7. Errores o dudas frecuentes.
