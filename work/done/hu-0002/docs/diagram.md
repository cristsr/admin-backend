# Diagrama de flujo: hu-0002

```mermaid
sequenceDiagram
  participant CH as CommandHandler
  participant ESR as EventSourcedRepository
  participant EF as EnvelopeFactory
  participant ES as EventStore (puerto)
  participant IMES as InMemoryEventStore

  CH->>ESR: save(aggregate, ctx)
  ESR->>ESR: aggregate.pullChanges()
  alt changes.length === 0 (AC-11 guard — NUEVO)
    ESR-->>CH: early return (no-op)
  else changes.length > 0
    ESR->>EF: build(stream, fromVersion, events, ctx)
    EF-->>ESR: EventEnvelope[]
    ESR->>ES: append(stream, expectedVersion, envelopes)
    ES->>IMES: append(stream, expectedVersion, events)
    alt events.length === 0 (NUEVO)
      IMES-->>ES: early no-op
    else events.length > 0
      IMES->>IMES: valida expectedVersion (INV-7)
      IMES->>IMES: valida secuencias consecutivas
      IMES->>IMES: valida unicidad external_ref (INV-10)
      IMES->>IMES: asigna globalPosition monotónica
      IMES->>IMES: persiste eventos
      IMES-->>ES: AppendResult
    end
    ES-->>ESR: AppendResult
    ESR-->>CH: AppendResult
  end
```

> **Nota:** Este es un flujo interno de `apps/ledger`. No hay comunicación entre microservicios.
> Los dos bloques marcados `(NUEVO)` son el alcance concreto de esta historia de verificación:
> el guard de lote vacío en `EventSourcedRepository.save()` y en `InMemoryEventStore.append()`,
> más el test de contract correspondiente en `describeEventStoreContract`.
