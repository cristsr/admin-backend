---
use_case: close-account
module: accounts
trigger: rest
entrypoint: POST /accounts/{id}/close
command: CloseAccountCommand
view: closeAccount
invariants: [INV-13, AC-2, AC-4]
introduced_by: hu-0003
last_modified_by: hu-0025
status: active
---

# Close Account

Cierra una cuenta con una fecha de cierre contable (`closedOn`, RNF-7). Las cuentas de
sistema no se cierran (INV-13); cerrar una cuenta ya cerrada es un conflicto de estado.

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo y hace rollback, devolviendo el resultado real. Ver
[`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `closeAccount` en [`../accounts.c4`](../../../apps/ledger/docs/accounts/accounts.c4).

## Reglas

- **INV-13:** cerrar una cuenta de sistema → `SYSTEM_ACCOUNT_PROTECTED` (409).
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Cuenta de sistema | `SystemAccountProtectedException` (`SYSTEM_ACCOUNT_PROTECTED`) | 409 |
| Cuenta ya cerrada | `AccountAlreadyClosedException` (`ACCOUNT_ALREADY_CLOSED`) | 409 |
| Fecha de cierre inválida | `InvalidCloseDateException` (`INVALID_CLOSE_DATE`) | 422 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
