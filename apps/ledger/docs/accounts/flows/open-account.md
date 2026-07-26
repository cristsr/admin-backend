---
use_case: open-account
module: accounts
trigger: rest
entrypoint: POST /accounts
command: OpenAccountCommand
view: openAccount
invariants: [AC-2, AC-3]
introduced_by: hu-0003
last_modified_by: hu-0013
status: active
---

# Abrir cuenta

Registra una nueva cuenta contable en el ledger. El controller despacha
`OpenAccountCommand` al `CommandBus`; el `OpenAccountHandler` verifica la colisión de
nombre y construye el agregado `Account` vía `Account.open(...)`, que valida la regla de
moneda antes de emitir `AccountOpened`. El evento se persiste en el `EventStore`.

**El nombre jerárquico es la autoridad.** `Account.open` deriva el tipo de cuenta de
`name.rootType` y el padre de `name.parentName()`: `Assets:Bancolombia:Savings` produce tipo
`ASSETS` y padre `Assets:Bancolombia`. El `OpenAccountCommand` transporta solo
`(name, currencies, openedOn, isBankMirror)` — los campos `type` y `parentId` del
`OpenAccountRequestDto` se validan como forma pero **no se transportan**, así que un `type`
que contradiga el prefijo del nombre se ignora en silencio (hu-0013, AC-3).

**Diagrama:** dynamic view `openAccount` en [`../accounts.c4`](../accounts.c4).

## Reglas

- **AC-2:** una cuenta real (`ASSETS`/`LIABILITIES`) debe declarar **exactamente una**
  moneda; una cuenta de agregación puede declarar varias. `Account.open` rechaza la
  combinación inválida.
- **AC-3:** el nombre debe ser único para el usuario — lo verifica el handler contra
  `proj_accounts` antes de construir el agregado.
- **No hay validación de fecha futura:** `Account.open` no compara `openedOn` contra el
  `Clock`. Abrir una cuenta con fecha futura es aceptado hoy.

## Errores

| Condición | Excepción | code | HTTP |
|---|---|---|---|
| Nombre de cuenta ya existente para el usuario | `NameCollisionException` | `NAME_COLLISION` | 409 |
| Cuenta real con ≠1 moneda (§2.1) | `RealAccountCurrencyException` | `REAL_ACCOUNT_SINGLE_CURRENCY` | 422 |
| Nombre con forma inválida | `InvalidAccountNameException` | `INVALID_ACCOUNT_NAME` | 422 |
| `openedOn` fuera de `YYYY-MM-DD` o día inexistente | `InvalidLedgerDateException` | `INVALID_LEDGER_DATE` | 422 |
| Moneda no presente en el catálogo | `UnknownCurrencyException` | `UNKNOWN_CURRENCY` | 422 |

## Respuesta

`201 Created` con `CommandAcceptedDto` (`aggregateId`, `streamPosition`).
