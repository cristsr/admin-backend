# Diagrama de flujo: hu-0005

## Dispatch de un command con cadena de políticas

```mermaid
sequenceDiagram
  actor Client
  participant CB as PolicyCommandBus
  participant ACP as AuthenticatedContextPolicy
  participant IP as IdempotencyPolicy
  participant OCP as OptimisticConcurrencyPolicy
  participant H as CommandHandler
  participant A as Aggregate
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
      ACP-->>Client: MissingAuthContextException<br/>(MISSING_AUTH_CONTEXT)
    else valid
      ACP->>IP: next() → handle(command, ctx, next)
      IP->>IP: ctx.externalRef ?
      alt externalRef present
        IP->>ES: findByExternalRef(userId, externalRef)
        ES-->>IP: anchor StoredEvent | null
        alt anchor found
          IP-->>Client: CommandResult {<br/>aggregateId, streamPosition,<br/>idempotentReplay: true }
        end
      end
      IP->>OCP: next() → handle(command, ctx, next)
      loop max 1 retry on conflict
        OCP->>H: next() → execute(command, ctx)
        H->>H: parse args + cross-validate<br/>(account_tree, balance, …)
        alt validation fails
          H-->>Client: DomainException<br/>(NAME_COLLISION, UNBALANCED,<br/>ACCOUNT_CLOSED, CURRENCY_NOT_ALLOWED,<br/>LEDGER_ALREADY_INITIALIZED, …)
        else valid
          H->>A: static factory / instance method
          A-->>H: events emitted
          H->>R: save(aggregate, ctx)
          R->>R: aggregate.pullChanges()
          R->>ES: append(stream, expectedVersion, envelopes)
          alt concurrency conflict
            ES-->>OCP: ConcurrencyConflictException
            Note over OCP: retry once (MAX_RETRIES=1)
          else success
            ES-->>R: AppendResult { events, version, lastPosition }
            R->>PD: dispatch(result.events)
            PD-->>R: void
            R-->>H: AppendResult
            H-->>Client: CommandResult {<br/>aggregateId, streamPosition,<br/>idempotentReplay: false }
          end
        end
      end
    end
  end
```

## Inicialización de ledger (InitializeLedger — detalle del handler)

```mermaid
sequenceDiagram
  participant H as InitializeLedgerHandler
  participant SR as LedgerSettingsRepository
  participant AR as AccountRepository
  participant IG as IdGenerator
  participant ES as EventStore
  participant PD as ProjectionDispatcher

  H->>H: execute(command, ctx)
  H->>SR: load(ctx.userId, ctx.userId)
  SR->>ES: load(stream)
  ES-->>SR: events
  SR-->>H: LedgerSettings | null
  alt settings.isInitialized === true
    H-->>H: throw LedgerAlreadyInitializedException
  else
    H->>AR: save(Account.open(Equity:OpeningBalances, …))
    AR->>ES: append(...) → AppendResult
    H->>AR: save(Account.open(Equity:Adjustments, …))
    AR->>ES: append(...) → AppendResult
    H->>SR: save(LedgerSettings.initialize({...}))
    SR->>ES: append(anchor with ctx.externalRef)
    ES-->>SR: AppendResult
    SR->>PD: dispatch([anchor + account events])
    SR-->>H: AppendResult
    H-->>H: return { aggregateId: ctx.userId, streamPosition, idempotentReplay: false }
  end
```

## ReverseConfirmedTransaction — append atómico con reversa

```mermaid
sequenceDiagram
  participant H as ReverseConfirmedTransactionHandler
  participant TR as LedgerTransactionRepository
  participant IG as IdGenerator
  participant ES as EventStore
  participant PD as ProjectionDispatcher

  H->>H: execute(command, ctx)
  H->>TR: load(ctx.userId, command.transactionId)
  TR->>ES: load(stream)
  ES-->>TR: StoredEvent[]
  TR-->>H: LedgerTransaction
  H->>H: transaction.reverse(reversalId = IG.next())
  H-->>H: ReversalPlan { reversalId, postings, … }
  H->>H: create reversing LedgerTransaction<br/>(postings negados, metadata.reverses_id)
  H->>TR: save(original, ctx)  ← anchor con externalRef
  TR->>ES: append(TransactionReversed)
  ES-->>TR: AppendResult
  H->>TR: save(reversing, ctx)  ← sin anchor (externalRef: null)
  TR->>ES: append(TransactionRecorded + Confirmed)
  ES-->>TR: AppendResult
  H->>PD: dispatch(events from both saves)
  PD-->>H: void
  H-->>H: return { aggregateId: reversalId, streamPosition, idempotentReplay: false }
```

> **Flujo interno de `apps/ledger`.** No hay comunicación entre microservicios.
> El orden fijo de políticas (`AuthenticatedContextPolicy` → `IdempotencyPolicy` →
> `OptimisticConcurrencyPolicy`) está cableado en `createLedgerApplication()` y
> nunca se invierte ni se omite.
