---
use_case: rename-account
module: accounts
trigger: rest
entrypoint: POST /accounts/{id}/rename
command: RenameAccountCommand
view: renameAccount
invariants: [INV-13, INV-14, AC-2, AC-4]
introduced_by: hu-0003
last_modified_by: hu-0025
status: active
---

# Rename Account

Renombra una cuenta dentro del árbol jerárquico. Las cuentas de sistema (INV-13) no se
renombran; el nombre nuevo debe respetar la jerarquía (INV-14).

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo y hace rollback, devolviendo el resultado real. Ver
[`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `renameAccount` en [`../accounts.c4`](../../../apps/ledger/docs/accounts/accounts.c4).

## Reglas

- **INV-13:** renombrar una cuenta de sistema → `SYSTEM_ACCOUNT_PROTECTED` (409).
- **INV-14:** el nuevo nombre debe mantener la posición jerárquica válida.
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Cuenta de sistema | `SystemAccountProtectedException` (`SYSTEM_ACCOUNT_PROTECTED`) | 409 |
| Nombre en colisión | `NameCollisionException` (`NAME_COLLISION`) | 409 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
