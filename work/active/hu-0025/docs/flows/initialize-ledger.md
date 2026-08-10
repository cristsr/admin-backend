---
use_case: initialize-ledger
module: accounts
trigger: rest
entrypoint: POST /ledger/initialize
command: InitializeLedgerCommand
view: initializeLedger
invariants: [AC-1, RNF-10, INV-7, INV-13, AC-2, AC-4]
introduced_by: hu-0013
last_modified_by: hu-0025
status: active
---

# Initialize Ledger

Inicializa el ledger del usuario: fija moneda de presentación y timezone, crea las cuentas
técnicas de sistema (`Equity:OpeningBalances`, `Equity:Adjustments`, INV-13) y despacha
`OpenSystemAccountCommand` por el mismo bus. Los appends corren dentro de
`EventStore.withTransaction` (INV-7). El flujo aprovecha la idempotencia para que
re-inicializar con la misma `external_ref` y los mismos inputs no duplique nada.

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo (incluido el `OpenSystemAccountCommand` anidado, que comparte la cadena de
políticas y la transacción) y hace rollback, devolviendo el resultado real. Ver
[`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `initializeLedger` en [`../accounts.c4`](../../../apps/ledger/docs/accounts/accounts.c4).

## Reglas

- **AC-1 (RNF-10):** la inicialización es un command; la lectura de settings es una query.
- **INV-13:** las cuentas de sistema se crean acá y quedan protegidas de cierre/rename.
- **INV-7:** `InitializeLedgerHandler` envuelve sus appends en `withTransaction` — en modo
  dry-run ese `withTransaction` se une al scope de la política (re-entrante) y revierte.
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Ledger ya inicializado | `LedgerAlreadyInitializedException` (`LEDGER_ALREADY_INITIALIZED`) | 409 |
| Moneda o timezone inválidos | `InvalidCurrencyCodeException` / `InvalidTimeZoneException` | 422 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
