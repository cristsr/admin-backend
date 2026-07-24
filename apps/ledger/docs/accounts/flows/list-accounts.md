---
use_case: list-accounts
module: accounts
trigger: rest
entrypoint: GET /accounts
command: GetAccountTreeQuery
view: listAccounts
invariants: [AC-7, AC-8, RNF-10, INV-9]
introduced_by: hu-0003
last_modified_by: hu-0006
status: active
---

# Listar cuentas (árbol)

`GetAccountTreeHandler` devuelve el árbol de cuentas del usuario desde `proj_accounts`,
ordenado alfabéticamente por nombre. El `userId` del contexto se aplica siempre (INV-9).
El endpoint soporta `?view=tree|flat` para controlar el formato de salida.

**Diagrama:** dynamic view `listAccounts` en [`../accounts.c4`](../accounts.c4).

## Reglas

- **AC-7:** Devuelve todas las cuentas del usuario desde `account_tree` (proyección
  construida por `AccountTreeProjector` en `hu-0004`). El orden es `name ASC`. El
  parámetro `view` controla si la respuesta es plana o jerárquica.
- **AC-8 (INV-9):** `user_id` del contexto filtra estrictamente — un usuario solo ve
  sus propias cuentas.
- **RNF-10:** Solo lectura — el handler no escribe ni accede al `EventStore`.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| Query type sin handler registrado | `UnregisteredQueryException` | Depende del controller |

## Respuesta

`200`: `AccountRow[]` — lista plana de cuentas con `account_id`, `name`, `type`,
`parent_id`, `currency_code`, `opened_on`, `closed_on`, etc. Ordenadas por `name ASC`.
