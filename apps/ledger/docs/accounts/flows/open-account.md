---
use_case: open-account
module: accounts
trigger: rest
entrypoint: POST /accounts
command: OpenAccountCommand
view: openAccount
invariants: [AC-2]
introduced_by: hu-0003
last_modified_by: hu-0003
status: active
---

# Abrir cuenta

Registra una nueva cuenta contable en el ledger. El controller despacha
`OpenAccountCommand` al `CommandBus`; el `OpenAccountHandler` construye el agregado
`Account` vía `Account.open(...)`, que valida las reglas de moneda antes de emitir
`AccountOpened`. El evento se persiste en el `EventStore`.

**Diagrama:** dynamic view `openAccount` en [`../accounts.c4`](../accounts.c4).

## Reglas

- **AC-2:** una cuenta real acepta una única moneda; una cuenta de agregación puede
  declarar varias. `Account.open` rechaza la combinación inválida.
- El `openedOn` no puede ser futuro respecto del `Clock` del sistema.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| Moneda inválida para el tipo de cuenta | `InvalidCurrencyForAccountException` | 422 |
| Fecha de apertura futura | `InvalidOpenDateException` | 422 |

## Respuesta

`201 Created` con `CommandAcceptedDto` (`aggregateId`, `streamPosition`).
