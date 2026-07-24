# Diagrama de flujo: hu-0004

## Proyección síncrona (en transacción del command, RNF-9)

```mermaid
sequenceDiagram
  participant CH as CommandHandler
  participant ESR as EventSourcedRepository
  participant ES as EventStore
  participant SD as SynchronousProjectionDispatcher
  participant P as Projector (account_tree, …)
  participant RMS as ReadModelStore

  CH->>ESR: save(aggregate, ctx)
  ESR->>ESR: aggregate.pullChanges()
  ESR->>ES: append(stream, expectedVersion, envelopes)
  ES-->>ESR: AppendResult { events, version, lastPosition }
  ESR->>SD: dispatch(result.events)
  loop for each event
    loop for each projector
      alt projector.handles(event.eventType)
        SD->>P: project(event, store)
        P->>RMS: upsert(table, key, row)
        Note over P,RMS: Idempotent by key — no duplicates on replay (AC-4, AC-5)
      end
    end
  end
  SD-->>ESR: void
  ESR-->>CH: AppendResult

  Note over CH,RMS: Si el projector falla, la transacción completa (evento + proyección) revierte (AC-3)
```

## Proyección asíncrona (polling con checkpoint)

```mermaid
sequenceDiagram
  participant Cron as Cron/Scheduler
  participant PD as PollingProjectionDispatcher
  participant CPR as ProjectionCheckpointRepository
  participant ES as EventStore
  participant P as Projector (account_tree, …)
  participant RMS as ReadModelStore

  Cron->>PD: pollOnce()
  PD->>CPR: lastPosition(projectionName)
  CPR-->>PD: position (bigint)
  PD->>ES: readAll(fromPosition, batchSize)
  ES-->>PD: StoredEvent[]
  alt events.length === 0
    PD-->>Cron: 0 (caught up)
  else events.length > 0
    PD->>PD: dispatch(events)
    loop for each event
      loop for each projector
        alt projector.handles(event.eventType)
          PD->>P: project(event, store)
          P->>RMS: upsert(table, key, row)
          Note over P,RMS: Same projector code as sync mode (AC-2, AC-5)
        end
      end
    end
    PD->>CPR: advance(projectionName, lastEvent.globalPosition)
    CPR-->>PD: void
    PD-->>Cron: events.length
  end
```

## Rebuild completo (RNF-5)

```mermaid
sequenceDiagram
  participant RB as ProjectionRebuilder
  participant RMS as ReadModelStore
  participant CPR as ProjectionCheckpointRepository
  participant PD as PollingProjectionDispatcher
  participant ES as EventStore

  RB->>RB: rebuild(target)
  loop for each table in target.tables
    RB->>RMS: truncate(table)
  end
  RB->>CPR: advance(projectionName, 0n)
  RB->>PD: catchUp()
  loop while events remain
    PD->>CPR: lastPosition(projectionName)
    PD->>ES: readAll(fromPosition, batchSize)
    PD->>PD: dispatch(events)
    PD->>CPR: advance(projectionName, lastPosition)
  end
  PD-->>RB: total applied
```

> **Nota:** Este es un flujo interno de `apps/ledger`. No hay comunicación entre microservicios.
> El mismo código de projector (AC-2) se ejecuta idénticamente en modo síncrono y asíncrono;
> el modo es configuración del dispatcher, nunca una bifurcación en el projector (AC-5).
