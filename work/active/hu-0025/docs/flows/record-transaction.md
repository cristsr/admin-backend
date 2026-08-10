---
use_case: record-transaction
module: transactions
trigger: rest
entrypoint: POST /transactions
command: RecordTransactionCommand
view: recordTransaction
invariants: [INV-1, INV-2, INV-11, AC-2, AC-4]
introduced_by: hu-0003
last_modified_by: hu-0025
status: active
---

# Record Transaction

Registra una transacción (PENDING o CONFIRMED) con al menos dos postings que balancean a
cero por moneda (INV-1, verificado de forma síncrona y transaccional por el agregado,
Artículo 2). `derivedKind` se clasifica por el projector (RF-4).

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo (validaciones, invariantes del agregado, eventos y proyecciones
síncronas) y hace rollback, devolviendo el resultado real. Ver
[`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `recordTransaction` en [`../transactions.c4`](../../../apps/ledger/docs/transactions/transactions.c4).

## Reglas

- **INV-1:** los postings balancean a cero por moneda — `ZeroSumBalanceRule`, dentro del agregado.
- **INV-2:** al menos dos postings (forma: `minItems: 2`).
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Postings que no balancean | `UnbalancedTransactionException` (`UNBALANCED_TRANSACTION`) | 422 |
| Moneda no permitida en la cuenta | `CurrencyNotAllowedException` (`CURRENCY_NOT_ALLOWED`) | 422 |
| Cuenta cerrada | `AccountClosedException` (`ACCOUNT_CLOSED`) | 422 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
