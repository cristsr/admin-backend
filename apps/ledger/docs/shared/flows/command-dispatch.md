---
use_case: command-dispatch
module: shared
trigger: rest
entrypoint: POST /api/v1/*
command: varies (OpenAccountCommand, RecordTransactionCommand, etc.)
invariants: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, RNF-10, RF-26]
introduced_by: hu-0009
last_modified_by: spec-0033
status: active
---

# Command Dispatch (HTTP → CommandBus)

Patrón canónico de controller para escrituras. Todo POST/PATCH sobre recursos de negocio
sigue el mismo pipeline: el `LedgerContextGuard` (APP_GUARD global, RF-26) intercepta cada
request, resuelve el contexto autenticado vía `LedgerContextResolver` (actualmente
`GatewayHeaderContextResolver`: headers `x-user-id`/`x-client-id`), y lo adjunta al request.
El controller ensambla un `AuthContext` desde fuentes disjuntas (`@Context()` para
`userId`/`clientId`, `@ExternalRef()` para el idempotency key) y despacha el command al
`CommandBus`. El `CommandResultInterceptor` transforma `CommandResult` en
`CommandAcceptedDto { id, streamPosition }` + header `X-Ledger-Stream-Position`.

```mermaid
sequenceDiagram
  actor Client
  participant G as LedgerContextGuard
  participant CR as LedgerContextResolver
  participant GH as GatewayHeaderContextResolver
  participant CB as CommandBus
  participant ACP as AuthenticatedContextPolicy
  participant RP as RetryPolicy
  participant IP as IdempotencyPolicy
  participant OCP as OptimisticConcurrencyPolicy
  participant DRP as DryRunPolicy
  participant I as CommandResultInterceptor
  participant D as CommandAcceptedDto

  Client->>G: POST /api/v1/*
  G->>CR: resolve context
  CR->>GH: reads x-user-id, x-client-id
  CB->>ACP: valida userId/clientId no vacíos
  ACP->>RP: delega (reintenta transitorios, AC-5)
  RP->>IP: delega (replay o 409, AC-7)
  IP->>OCP: delega (conflicto propaga, AC-6)
  OCP->>DRP: delega (rollback si dryRun, AC-2/3)
  CB->>I: returns CommandResult
  I->>D: maps to { id, streamPosition }
```

> **Validación del contexto autenticado.** `AuthenticatedContextPolicy` es el primer
> eslabón: si `userId` o `clientId` están ausentes o vacíos lanza
> `MissingAuthContextException` y la cadena no continúa; si el contexto es válido delega
> al siguiente vía `next()`.

### El dispatch completo, hasta el event store

El diagrama de arriba muestra el chain de políticas. Este muestra el recorrido entero,
con las ramas de error de cada eslabón — es el que se usaba para razonar el
`PolicyCommandBus` desde hu-0005.

```mermaid
sequenceDiagram
  actor Client
  participant CB as PolicyCommandBus
  participant ACP as AuthenticatedContextPolicy
  participant IP as IdempotencyPolicy
  participant OCP as OptimisticConcurrencyPolicy
  participant H as CommandHandler
  participant A as AggregateRoot
  participant R as EventSourcedRepository
  participant ES as EventStore
  participant PD as ProjectionDispatcher

  Client->>CB: dispatch(command, authContext)
  CB->>CB: lookup handler by commandType
  alt unregistered
    CB-->>Client: UnregisteredCommandException
  else found
    CB->>ACP: handle(command, ctx, next)
    ACP->>ACP: validate userId/clientId non-empty
    alt missing
      ACP-->>Client: MissingAuthContextException (MISSING_AUTH_CONTEXT)
    else valid
      ACP->>IP: next() → handle(command, ctx, next)
      alt externalRef presente
        IP->>ES: findByExternalRef(userId, externalRef)
        ES-->>IP: anchor StoredEvent | null
        alt anchor encontrado
          IP-->>Client: CommandResult { idempotentReplay: true }
        end
      end
      IP->>OCP: next() → handle(command, ctx, next)
      loop máx 1 reintento por conflicto
        OCP->>H: next() → execute(command, ctx)
        H->>H: parse args + validación cruzada
        alt la validación falla
          H-->>Client: DomainException (NAME_COLLISION, UNBALANCED, ACCOUNT_CLOSED, …)
        else válido
          H->>A: static factory / instance method
          A-->>H: events emitted
          H->>R: save(aggregate, ctx)
          R->>ES: append(stream, expectedVersion, envelopes)
          alt conflicto de concurrencia
            ES-->>OCP: ConcurrencyConflictException
            Note over OCP: reintenta una vez (MAX_RETRIES=1)
          else éxito
            ES-->>R: AppendResult { events, version, lastPosition }
            R->>PD: dispatch(result.events)
            R-->>H: AppendResult
            H-->>Client: CommandResult { idempotentReplay: false }
          end
        end
      end
    end
  end
```

## Reglas

- **AC-1 (RF-26):** Request sin header `x-user-id` → `LedgerContextGuard` rechaza con 401.
- **AC-2 (RF-26):** Request sin header `x-client-id` → 401.
- **AC-3:** Ambos headers presentes → `LedgerContextResolver.resolve()` produce `{ userId, clientId }`, guard lo adjunta a `request.ledgerContext`.
- **AC-4 (RNF-10):** El controller solo hace mapeo de forma: headers/body → command, `CommandResult` → `CommandAcceptedDto`. No toca agregados, eventos, ni proyecciones.
- **AC-5:** `LedgerContextGuard` registrado como `APP_GUARD` global. Endpoint marcado `@Public()` (health) omite el guard vía `Reflector` + `IS_PUBLIC`.
- **AC-6:** `client_id` llega hasta el command sin interpretación ni validación: el ledger solo exige su presencia y lo registra como metadata (RF-12).
- **AC-7:** Binding intercambiable: `{ provide: LedgerContextResolver, useClass: GatewayHeaderContextResolver }`. Cambiar a JWT es reemplazar el provider, sin tocar controllers (RNF-11).
- **RNF-10:** Escrituras al command bus, lecturas al query bus.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| Sin header `x-user-id` | `UnauthorizedException` (desde `LedgerContextGuard`) | 401 |
| Sin header `x-client-id` | `UnauthorizedException` (desde `LedgerContextGuard`) | 401 |
| Header duplicado (array) | `LedgerContextResolver.resolve()` → `null` → `UnauthorizedException` | 401 |
| Header en blanco | `LedgerContextResolver.resolve()` → `null` → `UnauthorizedException` | 401 |
| Policy de command bus: `userId` vacío en `AuthContext` | `MissingAuthContextException` (code `MISSING_AUTH_CONTEXT`) | 422 |
| Policy de command bus: `clientId` vacío en `AuthContext` | `MissingAuthContextException` (code `MISSING_AUTH_CONTEXT`) | 422 |
| Idempotency replay (mismo `external_ref` + mismo usuario) | `CommandResult.idempotentReplay === true` | 200 (downgradeado por `CommandResultInterceptor`) |

## Respuesta

- **201:** `CommandAcceptedDto { id: string, streamPosition: string }` + header `X-Ledger-Stream-Position: <streamPosition>`.
- **200:** Replay idempotente (mismo `external_ref` ya procesado, `CommandResult.idempotentReplay === true`).
- **401:** Contexto autenticado ausente o inválido — `LedgerContextGuard` bloquea antes de llegar al controller.
