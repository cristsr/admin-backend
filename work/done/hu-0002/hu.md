# hu-0002: Puerto `EventStore` + adaptador in-memory + contract tests

## Historia de Usuario

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** un puerto `EventStore` con semántica completa (concurrencia optimista, idempotencia
por `external_ref`, orden por posición global, append atómico) y un adaptador in-memory que lo
satisfaga por completo, junto con una suite de contract tests reutilizable
**Para** poder construir y testear el resto del núcleo (agregados, command bus) sin
infraestructura real, y garantizar que cualquier adaptador futuro (Postgres) sea sustituible
sin cambiar el comportamiento observable (RNF-11)

> Corresponde a **EP-1.3 + EP-1.4** del [roadmap del ledger](../../../ledger-roadmap.md).
> Detalle técnico: `work/ledger/EP-1-nucleo.md` (secciones EP-1.3 y EP-1.4) y
> `especificacion-tecnica-ledger.md` (INV-7, INV-9, INV-10, INV-12, RNF-1, RNF-9, RNF-11).
> Depende de `hu-0001` (envelope de eventos).

## Criterios de Aceptación

### AC-1: El puerto declara el contrato completo

`EventStore` se declara como clase abstracta con cuatro operaciones: `append(stream,
expectedVersion, events)`, `load(stream)`, `readAll(fromPosition, limit)` y
`findByExternalRef(userId, externalRef)`. El puerto no expone ningún método de actualización
ni borrado (append-only, INV-12).

### AC-2: `append` en un stream nuevo asigna secuencia y posición

`append` con `expectedVersion = 0` sobre un stream nuevo persiste los eventos y les asigna
`sequence` correlativa (1..n) y posiciones globales crecientes.

### AC-3: `load` devuelve el historial ordenado

`load` devuelve el historial completo de un agregado ordenado por `sequence`. Para un stream
desconocido devuelve un arreglo vacío (no lanza).

### AC-4: `readAll` ordena estrictamente por posición global

`readAll(fromPosition, limit)` devuelve eventos de **todos** los agregados ordenados
estrictamente por posición global, respetando el tamaño de lote (`limit`) pedido.

### AC-5: Concurrencia optimista rechaza y no persiste nada (INV-7)

`append` con un `expectedVersion` desfasado respecto de la cabeza real del stream lanza
`ConcurrencyConflictException` y **no persiste ningún evento** del lote (atomicidad del
rechazo).

### AC-6: Dos appends concurrentes al mismo agregado — exactamente uno gana

Ante dos llamadas a `append` sobre el mismo agregado con el mismo `expectedVersion`,
exactamente una persiste y la otra lanza `ConcurrencyConflictException`. Para el adaptador
in-memory esto se prueba a nivel de semántica de `expectedVersion` (Node es monohilo; no hay
condición de carrera real que simular).

### AC-7: Idempotencia por `external_ref` (INV-10)

`append` con un `external_ref` ya usado antes por el mismo usuario lanza
`DuplicateExternalRefException` sin incrementar el conteo de eventos persistidos.
`findByExternalRef(userId, externalRef)` devuelve el evento ancla original (el primer evento
del lote que estampó ese `external_ref`).

### AC-8: `external_ref` no colisiona entre usuarios distintos (INV-9)

Dos usuarios distintos pueden usar el mismo valor de `external_ref` sin colisionar entre sí
— el aislamiento de idempotencia está scopeado por `userId`.

### AC-9: Round-trip del payload decimal se preserva

Un evento con montos serializados como string decimal persiste y se recupera (`load`/
`readAll`) sin pérdida ni conversión a `number` en ningún punto del camino.

### AC-10: Atomicidad de un batch multi-evento

Un `append` de varios eventos en un mismo lote que falla a mitad de camino (por ejemplo, por
conflicto de concurrencia) no deja eventos parciales persistidos — o se persiste el lote
completo, o no se persiste nada.

### AC-11: `append` con un lote vacío de eventos

`append(stream, expectedVersion, [])` — un lote sin eventos — es una operación **no-op**: no
falla, no incrementa la versión del stream y no asigna posiciones globales nuevas.

### AC-12: `Clock` e `IdGenerator` deterministas para tests

Existen implementaciones de prueba `DeterministicClock` (fecha fija o secuencial controlable)
y `FixedIdGenerator` (UUIDs predecibles) usadas por toda la suite de contract tests y por
`hu-0001` para reproducibilidad.

### AC-13: `EventSourcedRepository` reconstruye y persiste agregados

Existe una base genérica `EventSourcedRepository<TAggregate>` con `load(userId,
aggregateId)` (reconstruye el agregado desde su stream, o `null` si no existe) y
`save(aggregate, ctx)` (persiste los cambios no confirmados del agregado de forma atómica vía
`EventStore.append`).

### AC-14: `InMemoryEventStore` pasa el 100% de la suite de contract tests

`InMemoryEventStore` implementa el puerto completo y satisface **todos** los casos AC-1 a
AC-11 mediante una única suite de contract tests (`describeEventStoreContract`) parametrizada
por un `makeStore()`, reutilizable sin cambios contra un futuro adaptador Postgres (EP-1.5).

## Reglas de Negocio

- El puerto `EventStore` es una `abstract class`, nunca una `interface` (regla del proyecto).
- Ningún archivo de `domain/`/`application/` de este alcance importa `@nestjs/*` ni `typeorm`.
- La idempotencia se resuelve por **anchor-only stamping**: `external_ref` se estampa solo en
  el evento ancla (el primero) de un command, nunca en cada evento del lote — decisión ya
  confirmada en `ledger-roadmap.md` (2026-07-22).
- El índice único de `external_ref` es defensa en profundidad (RNF-1); el chequeo primario de
  idempotencia lo hace la policy del command bus vía `findByExternalRef` (fuera de este
  alcance, ver `hu-0005`).
- `Clock.now()` siempre en UTC (RNF-7).
- Cada archivo de producción se precede por su `*.spec.ts` (TDD estricto); el puerto mismo no
  tiene spec propio — se prueba únicamente vía la suite de contract tests.

## Resolución de Ambigüedades

- **AC-11:** ¿Qué hace `append` con un lote vacío de eventos? → No-op silencioso (nunca ocurre
  en flujo normal: todo command emite ≥1 evento y la política de idempotencia corta antes de
  llegar a `append`).

## Fuera de Alcance

- El adaptador `PostgresEventStore` sobre la misma suite de contract tests — `hu-0003`
  (EP-1.5).
- Los agregados `Account` y `LedgerTransaction` — `hu-0004` (EP-1.6/EP-1.7).
- El command bus y sus políticas transversales (idempotencia, contexto autenticado) — `hu-0005`
  (EP-1.8).

## Technical Context

### Microservicio objetivo
- `apps/ledger`

### Artefactos a reutilizar
- `EventEnvelope` / `StoredEvent` / `StreamId` — de `hu-0001` (envelope de eventos)
- `Nullable<T>`, jerarquía `DomainException` — de `@shared`

### Patrones obligatorios
- Puertos como `abstract class`
- `domain/` y `application/` libres de NestJS/TypeORM (RNF-11)
- Contract tests parametrizados (`describeEventStoreContract(makeStore, teardown)`) para que
  la misma suite corra contra in-memory y, más adelante, Postgres (RNF-11)
- TDD estricto

### Restricciones técnicas
- Node es monohilo: los tests de concurrencia del adaptador in-memory validan la semántica de
  `expectedVersion`, no carreras de hilos reales
- `external_ref` se estampa solo en el evento ancla (anchor-only), nunca en cada evento del
  lote

### Deuda técnica relevante
- Ninguna — depende de `hu-0001` (envelope) ya construida en este mismo flujo
