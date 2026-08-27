# Integracion La Pyme: contabilidad y tesoreria

## Objetivo

Preparar AILE para consumir la API de La Pyme sin acoplar la operacion diaria a un proveedor externo. La primera etapa es lectura, conciliacion y trazabilidad; las escrituras se habilitan despues de validar mapeos e idempotencia.

## Documentacion base

- Introduccion: https://docs.lapyme.com.ar/api-reference/introduccion
- Indice para asistentes: https://docs.lapyme.com.ar/llms.txt
- OpenAPI: https://docs.lapyme.com.ar/api-reference/openapi.json

Reglas confirmadas:

- Base URL: `https://api.lapyme.com.ar`
- Autenticacion: `Authorization: Bearer <API_KEY>`
- Health check: `GET /health`
- Smoke test recomendado: `GET /api/v1/warehouses?limit=1`
- Los importes monetarios van en centavos.
- Los listados usan `limit`, `cursor`, `has_more` y `next_cursor`.
- Las respuestas incluyen `request_id`.
- Las escrituras con riesgo de duplicado usan `Idempotency-Key`.

## Variables de entorno

```env
LAPYME_BASE_URL=https://api.lapyme.com.ar
LAPYME_API_KEY=
```

`LAPYME_API_KEY` debe quedar solo del lado servidor. No usar prefijo `NEXT_PUBLIC_`.

## Base local preparada

La migracion `055_prepare_lapyme_integration.sql` agrega:

- Metadatos externos en `movimientos`: origen, request id, payload, fecha de sync.
- Metadatos externos en `cuentas`.
- Checkpoints por scope para sincronizacion incremental.
- Mapeos entre objetos de La Pyme y tablas locales.

## Mapa inicial de recursos

| La Pyme | Uso AILE | Tabla local |
| --- | --- | --- |
| Depositos / cajas | Smoke test y futura separacion operativa | `cuentas` o mapeo auxiliar |
| Metodos de pago | Medios de tesoreria | `cuentas` |
| Cobranzas de clientes | Ingresos conciliables | `movimientos` |
| Pagos a proveedores | Egresos conciliables | `movimientos` |
| Cuentas contables | Plan de cuentas externo | `lapyme_account_mappings` |
| Asientos contables | Evidencia contable y auditoria | `movimientos.external_payload` o tabla dedicada futura |
| Libro diario / mayor / sumas y saldos | Reportes contables | vista o cache futura |

## Estrategia de sincronizacion

1. Validar credencial con `/api/integrations/lapyme/health`.
2. Ejecutar smoke test con `/api/integrations/lapyme/health?smoke=1`.
3. Importar catalogos: depositos, metodos de pago, cuentas contables.
4. Crear mapeos manuales o asistidos hacia `cuentas` y `categorias_financieras`.
5. Sincronizar cobranzas y pagos en modo preview.
6. Insertar movimientos con `external_source = 'lapyme'` y `external_id` estable.
7. Persistir `request_id`, payload original y checkpoint del cursor.

## Scopes sugeridos para API key

Para la primera etapa de lectura:

- `warehouses:read`
- `payment_methods:read`
- `customer_collections:read`
- `supplier_payments:read`
- `accounting_accounts:read`
- `journal_entries:read`
- scopes de reportes contables si La Pyme los separa por permisos

Para escrituras futuras:

- altas de cobranzas/pagos/asientos solo despues de acordar reglas de idempotencia y evitar doble registracion.

## Pendientes antes de activar sincronizacion real

- Confirmar nombres exactos de scopes disponibles en la cuenta de La Pyme.
- Definir si AILE sera fuente de verdad o solo espejo de La Pyme para tesoreria.
- Definir categorias por defecto para cobranzas, pagos y ajustes.
- Decidir retencion del payload externo completo.
- Agregar jobs server-side para sync incremental y pantalla de conciliacion.
