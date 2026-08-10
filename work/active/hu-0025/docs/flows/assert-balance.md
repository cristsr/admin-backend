---
use_case: assert-balance
module: reconciliation
trigger: rest
entrypoint: POST /v1/balance-assertions
command: AssertBalanceCommand
view: assertBalance
invariants: [RF-17, INV-10, RNF-9, Artículo 5, AC-2, AC-4]
introduced_by: hu-0017
last_modified_by: hu-0025
status: active
---

# Assert Balance

Crea una assertion de saldo sobre una cuenta: el ledger compara el saldo esperado contra
el real en la fecha (RF-17). El reactor re-evalúa las assertions cuando un evento altera
los postings (RF-18, §3.2).

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo y hace rollback, devolviendo el resultado real. El preview nunca dispara
el reactor `ReevaluateAssertionsReactor`: se alimenta del stream persistido y el rollback
no persiste nada (AC-3). Ver [`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `assertBalance` en [`../reconciliation.c4`](../../../apps/ledger/docs/reconciliation/reconciliation.c4).

## Reglas

- **RF-17:** la assertion es exactamente sobre la cuenta nombrada, nunca su subárbol.
- **INV-10:** con `external_ref` la assertion es idempotente (mismos inputs → replay).
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Moneda de la assertion ≠ moneda de la cuenta | `AssertionCurrencyMismatchException` (`ASSERTION_CURRENCY_MISMATCH`) | 422 |
| Cuenta inexistente | `AccountNotFoundException` (`ACCOUNT_NOT_FOUND`) | 404 |

## Respuesta

- **201:** `AssertBalanceResponse { assertionId, streamPosition }` (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
