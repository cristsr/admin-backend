---
use_case: rename-account
module: accounts
trigger: rest
entrypoint: POST /accounts/{id}/rename
command: RenameAccountCommand
view: renameAccount
invariants: [INV-13, INV-14]
introduced_by: hu-0003
last_modified_by: hu-0003
status: active
---

# Renombrar cuenta

Cambia el nombre de una cuenta existente. Es una transición de ciclo de vida
event-sourced (por eso `POST /{id}/rename` y no `PATCH`). El `RenameAccountHandler`
rehidrata el agregado, aplica `rename(newName)` y persiste `AccountRenamed`.

**Diagrama:** dynamic view `renameAccount` en [`../accounts.c4`](../accounts.c4).

## Reglas

- **INV-13:** las cuentas de sistema están protegidas; renombrarlas se rechaza.
- **INV-14:** el tipo raíz es inmutable — el renombre no puede alterar la naturaleza
  de la cuenta.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| Cuenta de sistema | `SystemAccountProtectedException` | 409 |
| Alteración de tipo raíz | `RootTypeImmutableException` | 409 |
| Cuenta inexistente | `AccountNotFoundException` | 404 |

## Respuesta

`200 OK` con `CommandAcceptedDto`.
