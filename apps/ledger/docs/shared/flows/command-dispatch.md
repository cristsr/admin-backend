---
use_case: command-dispatch
module: shared
trigger: rest
entrypoint: POST /api/v1/*
command: varies (OpenAccountCommand, RecordTransactionCommand, etc.)
view: shared_http_command_dispatch
invariants: [AC-4, AC-5, AC-6, RNF-10]
introduced_by: hu-0009
last_modified_by: hu-0009
status: active
---

# Command Dispatch (HTTP → CommandBus)

Patrón canónico de controller para escrituras. Todo POST/PATCH sobre recursos de negocio
sigue el mismo pipeline: el controller ensambla un `AuthContext` desde fuentes disjuntas
(headers `x-user-id`/`x-client-id` vía `@Context()`, header `x-external-ref` vía
`@ExternalRef()`), construye el command de aplicación correspondiente, y lo despacha al
`CommandBus`.

El `CommandResultInterceptor` (global, cableado en `SharedHttpModule`) intercepta la
respuesta `CommandResult` y la transforma en `CommandAcceptedDto` con header
`X-Ledger-Stream-Position`.

**Diagrama:** dynamic view `shared_http_command_dispatch` en [`../shared-kernel.c4`](../../../apps/ledger/docs/shared-kernel/shared-kernel.c4).

## Reglas

- **AC-4 (RNF-10):** El controller solo hace mapeo de forma: headers/body → command, `CommandResult` → `CommandAcceptedDto`. No toca agregados, eventos, ni proyecciones.
- **AC-5:** Toda escritura retorna `CommandAcceptedDto { id, streamPosition }`. Nunca una vista de lectura.
- **AC-6:** El controller depende exclusivamente de `CommandBus`/`QueryBus` + decoradores de contexto. Nunca de `EventStore`, repositorios, o TypeORM.
- **RNF-10:** Escrituras al command bus, lecturas al query bus.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| Sin contexto autenticado | `LedgerContextGuard` rechaza | 401 |
| Idempotency replay (mismo `external_ref` + mismo usuario) | `CommandResult.idempotentReplay === true` | 200 (downgradeado por `CommandResultInterceptor`) |

## Respuesta

- **201/200:** `CommandAcceptedDto { id: string, streamPosition: string }` + header `X-Ledger-Stream-Position: <streamPosition>`.
- **200:** Replay idempotente (mismo `external_ref` ya procesado, `CommandResult.idempotentReplay === true`).
