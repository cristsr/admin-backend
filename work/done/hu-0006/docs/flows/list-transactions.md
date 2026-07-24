---
use_case: list-transactions
module: transactions
trigger: rest
entrypoint: GET /transactions
command: ListTransactionsQuery
view: listTransactions
invariants: [AC-6, AC-8, RNF-10, INV-9]
introduced_by: hu-0003
last_modified_by: hu-0006
status: active
---

# Listar transacciones

`ListTransactionsHandler` sirve el listado filtrado y paginado de transacciones desde
`proj_transactions`, con filtro opcional por cuenta via `proj_postings`. Todo scoped al
`userId` del contexto (INV-9).

**Diagrama:** dynamic view `listTransactions` en [`../model.delta.c4`](../model.delta.c4).

## Reglas

- **AC-6 (RF-13):** Filtros combinables: `status`, `derivedKind`, `payee`, `fromDate`,
  `toDate`, `accountId`. El filtro `accountId` se aplica en memoria intersectando
  `proj_postings` con `proj_transactions`.
- **AC-8 (INV-9):** `userId` del `QueryContext` se aplica siempre como filtro `equals`
  en el `Criteria`; no es opcional ni visible al caller.
- **RNF-10:** Solo lectura — el handler no invoca `EventStore`, `upsert`, `delete`, ni
  produce efectos secundarios.
- **Paginación:** Usa `limitTo(take)` como hard cap sin offset.
- **Orden:** Por defecto `date DESC` (más recientes primero).

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| Query type sin handler registrado | `UnregisteredQueryException` | Depende del controller (no en scope EP-1) |

## Respuesta

`200`: `TransactionRow[]` — lista de transacciones que cumplen los filtros, cada una con
`transaction_id`, `user_id`, `date`, `payee`, `status`, `derived_kind`, `client_id`, etc.
