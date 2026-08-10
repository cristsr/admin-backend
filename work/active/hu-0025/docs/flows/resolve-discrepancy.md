---
use_case: resolve-discrepancy
module: reconciliation
trigger: rest
entrypoint: POST /v1/balance-assertions/{id}/resolve
command: ResolveDiscrepancyCommand
view: resolveDiscrepancy
invariants: [RF-20, INV-1, INV-10, Artículo 2, Artículo 12, AC-2, AC-4]
introduced_by: hu-0017
last_modified_by: hu-0025
status: active
---

# Resolve Discrepancy

Cierra una discrepancia registrando un ajuste de sistema contra `Equity:Adjustments`
(RF-20). Los appends corren dentro de `EventStore.withTransaction` (INV-7). El
`TransactionRecorded` del ajuste re-dispara el reactor, que re-evalúa la assertion a
MATCHED (§3.2).

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo y hace rollback, devolviendo el resultado real. En el preview el ajuste
no se persiste, así que el reactor nunca lo ve (AC-3). Ver
[`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `resolveDiscrepancy` en [`../reconciliation.c4`](../../../apps/ledger/docs/reconciliation/reconciliation.c4).

## Reglas

- **RF-20:** el ajuste de sistema cierra la discrepancia; la assertion pasa a MATCHED vía reactor.
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Discrepancia no resoluble (estado) | `DiscrepancyNotResolvableException` (`DISCREPANCY_NOT_RESOLVABLE`) | 409 |
| Assertion inexistente | `AssertionNotFoundException` (`ASSERTION_NOT_FOUND`) | 404 |

## Respuesta

- **201:** `ResolveDiscrepancyResponse { assertionId, adjustmentTransactionId, streamPosition }` (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
