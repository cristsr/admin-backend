---
use_case: merge-transfers
module: transactions
trigger: rest
entrypoint: POST /transfers/merge
command: MergePendingTransfersCommand
view: mergeTransfers
invariants: [INV-16, AC-2, AC-4]
introduced_by: hu-0025
last_modified_by: hu-0025
status: active
---

# Merge Transfers

Fusiona las dos patas pendientes de una transferencia en una sola transacción
(`MergePendingTransfers`, F-16/RF-16): anula las dos `PENDING` y registra la
transacción consolidada. Los appends corren dentro de `EventStore.withTransaction`
(INV-7). Endpoint vivo, primero documentado en hu-0025 (gap de docs relevado por
`/scan`).

**Diagrama:** dynamic view `mergeTransfers` en [`../transactions.c4`](../../../apps/ledger/docs/transactions/transactions.c4).

## Reglas

- **INV-16:** exactamente dos patas (`pendingIds` con `minItems: 2, maxItems: 2`);
  ambas deben ser patas de la misma transferencia (`NOT_A_TRANSFER_PAIR`).
- **INV-7:** la anulación de las dos pendientes y el registro de la consolidada
  compiten por la misma transacción.
- **AC-2/AC-4 (hu-0025):** acepta `dryRun: boolean` (default `false`) en el body:
  ejecuta completo y revierte, devolviendo el resultado real — ver
  [`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Las patas no forman una transferencia | `NotATransferPairException` (`NOT_A_TRANSFER_PAIR`) | 422 |
| Pata inexistente | `PendingLegNotFoundException` (`PENDING_LEG_NOT_FOUND`) | 404 |
| Pata no pendiente | `InvalidTransactionStateException` (`INVALID_TRANSACTION_STATE`) | 409 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` (o el preview revertido si
  `dryRun: true`).
- **200:** replay idempotente (hu-0024).
