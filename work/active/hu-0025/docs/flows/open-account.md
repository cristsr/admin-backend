---
use_case: open-account
module: accounts
trigger: rest
entrypoint: POST /accounts
command: OpenAccountCommand
view: openAccount
invariants: [AC-2, AC-3, AC-2, AC-4]
introduced_by: hu-0003
last_modified_by: hu-0025
status: active
---

# Open Account

Crea una cuenta en el árbol jerárquico del usuario. `type` y `parentId` se validan como
forma pero no se transportan al command: el agregado los deriva del nombre jerárquico.

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo y hace rollback, devolviendo el resultado real. Ver
[`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `openAccount` en [`../accounts.c4`](../../../apps/ledger/docs/accounts/accounts.c4).

## Reglas

- **AC-2/AC-3:** el tipo y el padre se derivan del nombre jerárquico (`Assets:Bancolombia:Savings` → ASSETS / `Assets:Bancolombia`).
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Nombre en colisión o jerarquía inválida | `NameCollisionException` / `InvalidAccountNameException` | 409 / 422 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
