---
use_case: reverse-transaction
module: transactions
trigger: rest
entrypoint: POST /transactions/{id}/reverse
command: ReverseConfirmedTransactionCommand
view: reverseTransaction
invariants: [AC-2, RNF-10, AC-2, AC-4]
introduced_by: hu-0014
last_modified_by: hu-0025
status: active
---

# Reverse Confirmed Transaction

Revoca una transacción CONFIRMED registrando la reversa como transacción nueva (nunca
edita la original, Artículo 3) con la misma fecha efectiva (F-13) y su razón auditada.
Los appends corren dentro de `EventStore.withTransaction` (INV-7).

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo (incluida la reversa dentro de su `withTransaction`, que en modo dry-run
se une al scope de la política y revierte) y hace rollback, devolviendo el resultado real.
Ver [`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `reverseTransaction` en [`../transactions.c4`](../../../apps/ledger/docs/transactions/transactions.c4).

## Reglas

- **AC-2:** la reversa nace con la fecha de la original (de facto `atEffectiveDate: true`).
- **Artículo 3:** reversar dos veces → `INVALID_TRANSACTION_STATE` (409), nunca una segunda reversa.
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Ya revertida o no confirmada | `InvalidTransactionStateException` (`INVALID_TRANSACTION_STATE`) | 409 |
| Transacción inexistente | `TransactionNotFoundException` (`TRANSACTION_NOT_FOUND`) | 404 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` — `id` es el de la reversa (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
