---
use_case: register-currency
module: reference
trigger: rest
entrypoint: POST /v1/currencies
command: RegisterCurrencyCommand
view: registerCurrency
invariants: [RF-21, RF-11, RF-26, INV-8, RNF-4, principio #5, AC-2, AC-4]
introduced_by: hu-0019
last_modified_by: hu-0025
status: active
---

# Register Currency

Registra una moneda en el catálogo (`code` ISO-4217, `minorUnits`, `name`). El catálogo es
universal: no pertenece a un usuario, por lo que INV-9 no aplica (RF-21). La moneda
registrada se cachea en `ReadModelCurrencyCatalog` para la rehidratación de streams.

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo y hace rollback, devolviendo el resultado real. El refresh del cache del
catálogo se ejecuta dentro del mismo preview: un registro en dry-run no deja la moneda
cacheada. Ver [`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `registerCurrency` en [`../reference.c4`](../../../apps/ledger/docs/reference/reference.c4).

## Reglas

- **RF-21:** `minorUnits` entre 0 y 4 (INV-8); `code` de 3 letras mayúsculas.
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Moneda ya registrada | `CurrencyAlreadyRegisteredException` (`CURRENCY_ALREADY_REGISTERED`) | 422 |
| Código inválido | `InvalidCurrencyCodeException` (`INVALID_CURRENCY_CODE`) | 422 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
