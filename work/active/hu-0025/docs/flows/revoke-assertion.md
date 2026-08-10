---
use_case: revoke-assertion
module: reconciliation
trigger: rest
entrypoint: POST /v1/balance-assertions/{id}/revoke
command: RevokeAssertionCommand
view: revokeAssertion
invariants: [RF-19, INV-10, AC-2, AC-4]
introduced_by: hu-0017
last_modified_by: hu-0025
status: active
---

# Revoke Assertion

Revoca una assertion con un motivo auditado (`reason`, RF-19). REVOKED es terminal.

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo y hace rollback, devolviendo el resultado real. Ver
[`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `revokeAssertion` en [`../reconciliation.c4`](../../../apps/ledger/docs/reconciliation/reconciliation.c4).

## Reglas

- **RF-19:** toda revocación queda auditada con su motivo.
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Assertion ya revocada | `AssertionAlreadyRevokedException` (`ASSERTION_ALREADY_REVOKED`) | 409 |
| Assertion inexistente | `AssertionNotFoundException` (`ASSERTION_NOT_FOUND`) | 404 |

## Respuesta

- **201:** `RevokeAssertionResponse { assertionId, streamPosition }` (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
