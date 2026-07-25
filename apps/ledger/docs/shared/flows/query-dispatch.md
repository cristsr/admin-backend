---
use_case: query-dispatch
module: shared
trigger: rest
entrypoint: GET /api/v1/*
command: varies (GetAccountTreeQuery, ListTransactionsQuery, etc.)
view: shared_http_query_dispatch
invariants: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, RNF-10, RF-26, INV-9]
introduced_by: hu-0009
last_modified_by: hu-0010
status: active
---

# Query Dispatch (HTTP → QueryBus)

Patrón canónico de controller para lecturas. Todo GET sobre recursos de negocio sigue el
mismo pipeline de autenticación que las escrituras: `LedgerContextGuard` (APP_GUARD global,
RF-26) resuelve el contexto vía `LedgerContextResolver` y lo adjunta al request. El
controller ensambla un `QueryContext { userId }` desde `@Context()` y construye el query
con parámetros de ruta/query, preguntando al `QueryBus`. La respuesta del proyector se
devuelve sin transformar.

**Diagrama:** dynamic view `shared_http_query_dispatch` en [`../shared.c4`](../../../apps/ledger/docs/shared/shared.c4).

## Reglas

- **AC-1 (RF-26):** Request sin header `x-user-id` → `LedgerContextGuard` rechaza con 401.
- **AC-2 (RF-26):** Request sin header `x-client-id` → 401.
- **AC-3:** Ambos headers presentes → `LedgerContextResolver.resolve()` produce `{ userId, clientId }`.
- **AC-4 (RNF-10):** El controller solo mapea: contexto + params → query. No toca proyecciones directamente.
- **AC-5:** Guard global con bypass `@Public()` para endpoints de infraestructura.
- **AC-7:** `LedgerContextResolver` es un puerto abstracto; cambiar el resolver es cambiar el binding del provider, sin tocar controllers.
- **INV-9 (Artículo 5):** Todo query incluye `userId` en `QueryContext { userId }` para particionar por usuario.
- **RNF-10:** Escrituras al command bus, lecturas al query bus.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| Sin header `x-user-id` | `UnauthorizedException` (desde `LedgerContextGuard`) | 401 |
| Sin header `x-client-id` | `UnauthorizedException` (desde `LedgerContextGuard`) | 401 |
| Header duplicado (array) | `LedgerContextResolver.resolve()` → `null` → `UnauthorizedException` | 401 |
| Header en blanco | `LedgerContextResolver.resolve()` → `null` → `UnauthorizedException` | 401 |

## Respuesta

- **200:** Read model DTO según el query (ej. `AccountTreeDto`, `Transaction[]`).
- **401:** Contexto autenticado ausente o inválido — bloqueado por `LedgerContextGuard`.
