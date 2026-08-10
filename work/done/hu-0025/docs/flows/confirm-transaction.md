---
use_case: confirm-transaction
module: transactions
trigger: rest
entrypoint: POST /transactions/{id}/confirm
command: ConfirmTransactionCommand
view: confirmTransaction
invariants: [AC-2, AC-6, RNF-10, AC-2, AC-4]
introduced_by: hu-0014
last_modified_by: hu-0025
status: active
---

# Confirm Transaction

Confirma una transacción PENDING (opcionalmente con postings finales), fijando su fecha
efectiva (AC-2) e inmutabilidad posterior (AC-6).

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo y hace rollback, devolviendo el resultado real. Ver
[`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `confirmTransaction` en [`../transactions.c4`](../../../apps/ledger/docs/transactions/transactions.c4).

## Reglas

- **AC-6:** una transacción confirmada es inmutable; toda corrección es un comando nuevo.
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Estado inválido para confirmar | `InvalidTransactionStateException` (`INVALID_TRANSACTION_STATE`) | 409 |
| Postings finales que no balancean | `UnbalancedTransactionException` (`UNBALANCED_TRANSACTION`) | 422 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
