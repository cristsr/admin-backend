# Componentes: shared-kernel (apps/ledger)

> C4 Nivel 3 — building blocks internos del módulo `shared-kernel`.
> Diagrama acumulativo: incluye componentes de `hu-0001` + lo nuevo/modificado de `hu-0002`.

```mermaid
graph TD
  subgraph domain["Domain Layer"]
    EV("EventEnvelope
    type")
    SE("StoredEvent
    type")
    SID("StreamId
    type")
    AR("AppendResult
    type")
    EP("EventPayload
    type")
    ES_PORT("EventStore
    abstract class")
    CCE("ConcurrencyConflictException")
    DRE("DuplicateExternalRefException")
  end

  subgraph application["Application Layer"]
    ESR("EventSourcedRepository&lt;TAggregate&gt;
    abstract class
    ⚡ AC-11 guard")
    EF("EnvelopeFactory
    class")
    ER("EventRegistry
    abstract class")
  end

  subgraph infrastructure["Infrastructure Layer"]
    IMES("InMemoryEventStore
    ⚡ AC-11 guard")
    PES("PostgresEventStore")
    CT("describeEventStoreContract()
    ⚡ +AC-11 test")
    ESR_TEST("PostgresEventStoreRow")
  end

  subgraph testing["Testing Layer"]
    CONTRACT("event-store.contract.ts
    suite parametrizada")
  end

  ES_PORT --> EV
  ES_PORT --> SE
  ES_PORT --> SID
  ES_PORT --> AR
  ES_PORT --> CCE
  ES_PORT --> DRE
  IMES --> ES_PORT
  PES --> ES_PORT
  ESR --> ES_PORT
  ESR --> EF
  ESR --> ER
  EF --> EV
  EF --> SID
  CONTRACT --> ES_PORT
  CONTRACT --> EV
  CONTRACT --> SID
  CONTRACT --> CCE
  CONTRACT --> DRE
  IMES -.-> CONTRACT
  PES -.-> CONTRACT
```

### Componentes modificados por hu-0002

| Componente | Capa | Cambio |
|---|---|---|
| `EventSourcedRepository.save()` | Application | Agrega early return si `pullChanges()` está vacío (AC-11) |
| `InMemoryEventStore.append()` | Infrastructure | Agrega guard para `events: []` → no-op (AC-11) |
| `describeEventStoreContract()` | Testing | Agrega un test case: `append` con lote vacío es no-op (AC-11) |

### Componentes existentes (sin cambios)

- `EventStore` (puerto, `domain/ports/event-store.ts`) — 4 operaciones, sin modificar.
- `EventEnvelope`, `StoredEvent`, `StreamId`, `AppendResult`, `EventPayload` (tipos, `domain/event/`) — sin cambios.
- `ConcurrencyConflictException`, `DuplicateExternalRefException` (`domain/exceptions/event-store.exception.ts`) — sin cambios.
- `EnvelopeFactory`, `EventRegistry` (`application/event/`) — sin cambios.
- `PostgresEventStore` (`infrastructure/adapters/event-store/postgres/`) — sin cambios.
