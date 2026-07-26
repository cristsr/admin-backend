---
use_case: initialize-ledger
module: accounts
trigger: rest
entrypoint: POST /ledger/initialize
command: InitializeLedgerCommand
view: initializeLedger
invariants: [AC-1, RNF-10]
introduced_by: hu-0013
last_modified_by: hu-0013
status: active
---

# Inicializar ledger

Punto de entrada obligatorio del ledger de un usuario: fija la moneda de presentación y la
timezone, y crea las cuentas técnicas de sistema (`Equity:OpeningBalances`,
`Equity:Adjustments`) que el resto de los flujos asume existentes.

Lo sirve `LedgerController` —no `AccountsController`— porque es ciclo de vida a nivel
ledger, no de una cuenta. Vive bajo el módulo `accounts` por cercanía: el efecto observable
de inicializar es la aparición de las cuentas de sistema.

**Diagrama:** dynamic view `initializeLedger` en [`../accounts.c4`](../accounts.c4).

## Reglas

- **AC-1:** `{ presentationCurrency, timezone }` (+ `external_ref` opcional) despacha
  `InitializeLedgerCommand` y responde `201` con `CommandAcceptedDto`, incluyendo
  `streamPosition` en body y header `X-Ledger-Stream-Position`.
- **RNF-10:** el controller solo mapea forma → command. Las cuentas de sistema las crea el
  agregado, no el adaptador.
- Las cuentas de sistema quedan protegidas por INV-13: no se pueden renombrar ni cerrar
  (`SYSTEM_ACCOUNT_PROTECTED`).
- **Idempotencia:** reenviar con el mismo `external_ref` replaya el resultado original con
  `200` — ver [`../../shared/flows/idempotent-write.md`](../../shared/flows/idempotent-write.md).

## Errores

| Condición | Excepción | code | HTTP |
|---|---|---|---|
| El ledger del usuario ya fue inicializado | `LedgerAlreadyInitializedException` | `LEDGER_ALREADY_INITIALIZED` | 409 |
| Código de moneda inutilizable (blank/formato) | `InvalidCurrencyCodeException` | `INVALID_CURRENCY_CODE` | 422 |
| Timezone IANA inválida | `InvalidTimeZoneException` | `INVALID_TIME_ZONE` | 422 |
| Sin contexto autenticado | `UnauthorizedException` (`LedgerContextGuard`) | — | 401 |

## Respuesta

`201`: `CommandAcceptedDto { id, streamPosition }` + header `X-Ledger-Stream-Position`.
`200` si es un replay idempotente.
