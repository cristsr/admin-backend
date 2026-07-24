---
use_case: get-account-balances
module: accounts
trigger: rest
entrypoint: GET /accounts/{id}/balance
command: GetAccountBalancesQuery
view: getAccountBalances
invariants: [AC-7, AC-8, RNF-10, INV-9]
introduced_by: hu-0003
last_modified_by: hu-0006
status: active
---

# Consultar saldos

`GetAccountBalancesHandler` devuelve los saldos confirmados y pendientes por moneda de una
cuenta (o de todas las cuentas del usuario si no se especifica `accountId`). Lee de
`proj_balances` y cruza con `proj_accounts` para garantizar aislamiento por usuario (INV-9).

**Diagrama:** dynamic view `getAccountBalances` en [`../accounts.c4`](../accounts.c4).

## Reglas

- **AC-7:** Devuelve `confirmed_amount` y `pending_amount` por moneda. Cuando se
  especifica `accountId`, filtra a esa única cuenta; sin `accountId`, devuelve todas
  las cuentas del usuario.
- **AC-8 (INV-9):** `proj_balances` no tiene `user_id`. El handler primero obtiene los
  `account_id` del usuario desde `proj_accounts`, luego filtra los balances que
  pertenecen a esas cuentas. Ningún dato de otro usuario se filtra.
- **RNF-10:** Solo lectura — el handler no escribe ni accede al `EventStore`.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| Cuenta no pertenece al usuario | N/A | Array vacío (no es error — es filtro) |
| Query type sin handler registrado | `UnregisteredQueryException` | Depende del controller |

## Respuesta

`200`: `BalanceRow[]` — lista de saldos con `account_id`, `currency_code`,
`confirmed_amount`, `pending_amount`. Si se especificó `accountId`, el array tiene a lo
sumo una entrada por moneda de esa cuenta.
