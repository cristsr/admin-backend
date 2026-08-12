---
use_case: close-account
module: accounts
trigger: rest
entrypoint: POST /accounts/{id}/close
command: CloseAccountCommand
invariants: [INV-13]
introduced_by: hu-0003
last_modified_by: spec-0033
status: active
---

# Cerrar cuenta

Marca una cuenta como cerrada a partir de una fecha. Transición de ciclo de vida
event-sourced. El `CloseAccountHandler` rehidrata el agregado, aplica `close(closedOn)`
y persiste `AccountClosed`.

```mermaid
sequenceDiagram
  actor Client
  participant C as AccountsController
  participant CB as CommandBus
  participant H as CloseAccountHandler
  participant R as AccountRepository
  participant A as Account
  participant ES as EventStore

  Client->>C: POST /accounts/{id}/close (CloseAccountRequestDto)
  C->>CB: dispatch(CloseAccountCommand)
  CB->>H: handle
  H->>R: load(id)
  H->>A: close(closedOn) — INV-13
  A->>A: raise(AccountClosed)
  H->>R: save(account)
  R->>ES: append(AccountClosed)
```

## Reglas

- **INV-13:** las cuentas de sistema no se cierran.
- El `closedOn` no puede ser anterior a la apertura de la cuenta.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| Cuenta de sistema | `SystemAccountProtectedException` | 409 |
| Fecha de cierre anterior a la apertura | `InvalidCloseDateException` | 422 |
| Cuenta inexistente | `AccountNotFoundException` | 404 |

## Respuesta

`200 OK` con `CommandAcceptedDto`.
