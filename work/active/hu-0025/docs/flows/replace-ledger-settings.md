---
use_case: replace-ledger-settings
module: accounts
trigger: rest
entrypoint: PUT /v1/ledger/settings
command: ReplaceLedgerSettingsCommand
view: replaceLedgerSettings
invariants: [RF-2, RF-11, RF-26, RNF-7, RNF-9, 3.5, AC-2, AC-4]
introduced_by: hu-0018
last_modified_by: hu-0025
status: active
---

# Replace Ledger Settings

Reemplaza la moneda de presentación y/o el timezone del ledger (RF-2). Solo pueden
cambiarse ambos juntos y el nuevo estado se valida antes de emitir eventos (RNF-7).

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo y hace rollback, devolviendo el resultado real. Ver
[`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `replaceLedgerSettings` en [`../accounts.c4`](../../../apps/ledger/docs/accounts/accounts.c4).

## Reglas

- **RF-2:** presentación y timezone se cambian en un solo paso (silencio si el valor no cambia).
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Valor inválido | `InvalidCurrencyCodeException` / `InvalidTimeZoneException` | 422 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
