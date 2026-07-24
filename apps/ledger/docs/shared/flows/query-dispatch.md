---
use_case: query-dispatch
module: shared
trigger: rest
entrypoint: GET /api/v1/*
command: varies (GetAccountTreeQuery, ListTransactionsQuery, etc.)
view: shared_http_query_dispatch
invariants: [AC-4, AC-6, RNF-10]
introduced_by: hu-0009
last_modified_by: hu-0009
status: active
---

# Query Dispatch (HTTP → QueryBus)

Patrón canónico de controller para lecturas. Todo GET sobre recursos de negocio sigue el
mismo pipeline: el controller ensambla un `QueryContext` desde el contexto autenticado
(headers `x-user-id`), construye el query de aplicación correspondiente con parámetros de
ruta/query, y lo pregunta al `QueryBus`. La respuesta del proyector se devuelve sin
transformar.

**Diagrama:** dynamic view `shared_http_query_dispatch` en [`../shared-kernel.c4`](../../../apps/ledger/docs/shared-kernel/shared-kernel.c4).

## Reglas

- **AC-4 (RNF-10):** El controller solo mapea: contexto + params → query. No toca proyecciones directamente.
- **AC-6:** El controller depende exclusivamente de `CommandBus`/`QueryBus`.
- **INV-9 (Artículo 5):** Todo query incluye `userId` en `QueryContext` para particionar por usuario.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| Sin contexto autenticado | `LedgerContextGuard` rechaza | 401 |

## Respuesta

- **200:** Read model DTO según el query (ej. `AccountTreeDto`, `Transaction[]`).
