---
use_case: amend-transaction
module: transactions
trigger: rest
entrypoint: POST /transactions/{id}/amend
command: AmendPendingTransactionCommand
view: amendTransaction
invariants: [AC-2, AC-6, INV-1, INV-6, RNF-10, AC-2, AC-4]
introduced_by: hu-0014
last_modified_by: hu-0025
status: active
---

# Amend Transaction

Modifica postings y/o fecha de una transacción aún PENDING (AC-2/AC-6), revalidando el
balanceo a cero (INV-1).

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo y hace rollback, devolviendo el resultado real. Ver
[`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `amendTransaction` en [`../transactions.c4`](../../../apps/ledger/docs/transactions/transactions.c4).

## Reglas

- **AC-2/AC-6:** solo se amenda una PENDING; las confirmadas son inmutables.
- **INV-1:** los postings nuevos balancean a cero por moneda.
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Transacción no pendiente | `InvalidTransactionStateException` (`INVALID_TRANSACTION_STATE`) | 409 |
| Postings que no balancean | `UnbalancedTransactionException` (`UNBALANCED_TRANSACTION`) | 422 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
