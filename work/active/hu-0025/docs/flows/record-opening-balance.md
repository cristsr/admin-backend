---
use_case: record-opening-balance
module: accounts
trigger: rest
entrypoint: POST /accounts/{id}/opening-balance
command: RecordOpeningBalanceCommand
view: recordOpeningBalance
invariants: [INV-13, INV-8, AC-2, AC-4]
introduced_by: hu-0025
last_modified_by: hu-0025
status: active
---

# Record Opening Balance

Registra el saldo que una cuenta ya tenía al momento de la inicialización del
ledger, como `RecordTransaction` sobre la cuenta técnica `Equity:OpeningBalances`
(que el handler resuelve de los settings del usuario — el request no puede nombrar
cuentas de sistema, INV-13). Endpoint vivo desde hu-0003, primero documentado en
hu-0025 (gap de docs relevado por `/scan`).

**Diagrama:** dynamic view `recordOpeningBalance` en [`../accounts.c4`](../../../apps/ledger/docs/accounts/accounts.c4).

## Reglas

- **INV-13:** el handler resuelve la contraparte (`Equity:OpeningBalances`) y
  estampa el origin por su cuenta; el request solo aporta `amount`, `currency`,
  `date`.
- **INV-8:** `amount` es string decimal exacto (nunca float).
- **AC-2/AC-4 (hu-0025):** acepta `dryRun: boolean` (default `false`) en el body:
  ejecuta completo y revierte, devolviendo el resultado real — ver
  [`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Ledger no inicializado | `LedgerNotInitializedException` (`LEDGER_NOT_INITIALIZED`) | 422 |
| Cuenta inexistente | `AccountNotFoundException` (`ACCOUNT_NOT_FOUND`) | 404 |
| Monto inválido | `InvalidMoneyException` (`INVALID_MONEY`) | 422 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` (o el preview revertido si
  `dryRun: true`).
- **200:** replay idempotente (hu-0024).
