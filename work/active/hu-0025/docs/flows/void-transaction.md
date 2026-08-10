---
use_case: void-transaction
module: transactions
trigger: rest
entrypoint: POST /transactions/{id}/void
command: VoidPendingTransactionCommand
view: voidTransaction
invariants: [AC-2, AC-6, RNF-10, AC-2, AC-4]
introduced_by: hu-0014
last_modified_by: hu-0025
status: active
---

# Void Transaction

Anula una transacción PENDING con un motivo auditado (`reason`). Una anulada es terminal
(AC-6) y no deja rastro en saldos.

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo y hace rollback, devolviendo el resultado real. Ver
[`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `voidTransaction` en [`../transactions.c4`](../../../apps/ledger/docs/transactions/transactions.c4).

## Reglas

- **AC-2/AC-6:** solo se anula una PENDING; las confirmadas se revierten, no se anulan.
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Transacción no pendiente | `InvalidTransactionStateException` (`INVALID_TRANSACTION_STATE`) | 409 |
| Transacción inexistente | `TransactionNotFoundException` (`TRANSACTION_NOT_FOUND`) | 404 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
