---
use_case: list-pending-review
module: transactions
trigger: rest
entrypoint: GET /transactions/pending-review
command: ListPendingReviewQuery
invariants: [AC-3, RNF-10, INV-9]
introduced_by: spec-0034
last_modified_by: spec-0034
status: active
---

# Listar bandeja de revisión

`ListPendingReviewHandler` sirve la bandeja de revisión (`pending_review`) desde
`proj_pending_review`, scoped al `userId` del contexto (INV-9).

La bandeja es una cola de trabajo: se ordena **más antigua primero** — lo que más
tiempo lleva esperando aparece arriba, al revés que la lista de transacciones, que se
lee como historial y encabeza con lo más reciente.

**La respuesta es un array crudo de vistas, no una página.** El handler devuelve
`readonly PendingReviewView[]` con paginación `offset`/`limit` (default 50); no existe
envoltorio con `total`. Como en `list-transactions`, el cliente detecta el fin cuando
recibe menos filas que el `limit` pedido.

```mermaid
sequenceDiagram
  actor Client
  participant C as TransactionsController
  participant QB as QueryBus
  participant H as ListPendingReviewHandler
  participant F as PendingReviewFinder

  Client->>C: GET /transactions/pending-review
  C->>QB: ask(ListPendingReviewQuery, ctx)
  QB->>H: execute(query) — solo lectura (RNF-10)
  H->>F: list(userId, { offset, limit }) — más antigua primero
```

## Reglas

- **Solo `PENDING`.** La proyección `pending_review` solo contiene transacciones que
  esperan revisión; confirmar o anular las saca de la bandeja.
- **INV-9:** `user_id` del contexto filtra estrictamente — cada usuario ve solo su
  propia bandeja.
- **RNF-10:** Solo lectura — el handler no escribe ni accede al `EventStore`.
- **Orden:** más antigua primero, por `date` — es una cola de trabajo, no historial.

## Respuesta

`200`: `PendingReviewView[]` — array crudo, no página. Campos: `transactionId`, `date`,
`payee`, `description`, `postingCount`, `clientId`, `externalRef`. Paginación con
`limit` (default 50) y `offset`.
