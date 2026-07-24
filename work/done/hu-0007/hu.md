# hu-0007: Adaptadores Postgres de `EventStore` y `ReadModelStore`

## Historia de Usuario

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** el adaptador `PostgresEventStore` (esquema §6.1: tabla append-only, trigger de
inmutabilidad, índices únicos, `projection_checkpoints`) y el adaptador Postgres de
`ReadModelStore` (`proj_accounts`, `proj_transactions`, `proj_postings`, `proj_balances`),
ambos pasando **la misma** suite de contract tests que sus contrapartes in-memory
**Para** tener un event store y unas proyecciones productivas, sustituibles sin cambiar
comportamiento (RNF-11), una vez que todo el núcleo ya está probado y estable sobre
in-memory

> Corresponde a **EP-1.5** (+ el adaptador Postgres de `ReadModelStore`, implícito en EP-1.9)
> del [roadmap del ledger](../../../ledger-roadmap.md), paso 8 del Apéndice B de
> `work/ledger/EP-1-nucleo.md` — deliberadamente **al final** del núcleo: Postgres solo debe
> pasar los mismos contract tests, nunca introducir lógica de dominio. Detalle técnico:
> `work/ledger/EP-1-nucleo.md` (sección EP-1.5, Apéndice A — DDL). Depende de `hu-0002`
> (contract tests de `EventStore`), `hu-0004` (contract tests de `ReadModelStore`) y de
> EP-0.2 (`DatabaseModule` en `libs/shared`, ya cerrado).

## Criterios de Aceptación

### AC-1: Las migraciones crean el esquema desde cero

Las migraciones `CreateEventStore` y `CreateProjectionCheckpoints` crean las tablas
`event_store` y `projection_checkpoints` (Apéndice A.1/A.2), y `CreateCoreProjections` crea
`proj_accounts`, `proj_transactions`, `proj_postings`, `proj_balances` (Apéndice A.3) con sus
índices. Fase de desarrollo sin datos: el esquema se crea limpio, sin pasos de migración de
datos.

### AC-2: `append` persiste todo el lote en una única transacción

`append` inserta todos los eventos del lote en una sola transacción, devolviendo
`global_position` (columna `GENERATED ALWAYS AS IDENTITY`) por cada uno. La violación de
`UNIQUE (aggregate_id, sequence)` se traduce a `ConcurrencyConflictException`; la violación
del índice único parcial `idx_event_external_ref` (`user_id, external_ref`) se traduce a
`DuplicateExternalRefException`.

### AC-3: El trigger de inmutabilidad rechaza `UPDATE`/`DELETE` (INV-12)

Un `UPDATE` o un `DELETE` directo sobre `event_store` lanza el error `event_store is
append-only` (función `reject_event_mutation`, trigger `trg_event_store_immutable`) — el
puerto no tiene ninguna vía para mutar eventos ya persistidos.

### AC-4: El índice parcial de `external_ref` permite múltiples `NULL`

El índice único parcial `idx_event_external_ref` solo aplica `WHERE external_ref IS NOT
NULL`: múltiples eventos con `external_ref = NULL` para el mismo usuario coexisten sin
colisionar.

### AC-5: `readAll` y `load` respetan el orden y el aislamiento por usuario

`readAll(from, limit)` filtra `global_position > from`, ordena ascendente y respeta `limit`.
`load(stream)` filtra por `aggregate_id` y `user_id`, ordenando por `sequence` ascendente.

### AC-6: Los montos nunca se parsean a `number` en el adaptador

La columna `payload` es `jsonb` con montos en string decimal; el adaptador Postgres lee y
escribe el payload tal cual, sin convertir ningún monto a `number` en ningún punto del código
del adaptador.

### AC-7: `PostgresEventStore` pasa el 100% de la misma suite de contract tests que in-memory

`describeEventStoreContract(() => new PostgresEventStore(...))` — la **misma** función usada
en `hu-0002` para `InMemoryEventStore` — se ejecuta contra una base de datos de test efímera
(vía `DatabaseModule` de `libs/shared`) y pasa sin modificar ni un solo caso de la suite.

### AC-8: El adaptador Postgres de `ReadModelStore` pasa la misma suite de contract tests

El adaptador Postgres que persiste en `proj_accounts`/`proj_transactions`/`proj_postings`/
`proj_balances` pasa la misma suite `read-model-store.contract.ts` definida en `hu-0004` para
el adaptador in-memory, sin modificaciones.

## Reglas de Negocio

- Postgres nunca introduce lógica de dominio: su único trabajo es persistir/leer con la misma
  semántica observable que el adaptador in-memory (RNF-11).
- Columnas enum-like (`aggregate_type`, `event_type`, `status`, `derived_kind`) son
  `TEXT`/`varchar`, nunca un enum de Postgres (regla del proyecto).
- El `EntityManager` de TypeORM del proyecto se usa para que el append comparta unidad de
  trabajo con las proyecciones síncronas (patrón `saveWithinTransaction` del outbox de
  `finances`).
- Los montos viajan como string decimal en `jsonb` y como `NUMERIC(20,6)` en las proyecciones
  — nunca `float`/`number`.
- `bigint`/`global_position` se mapea a JS como `bigint` nativo o string, nunca `number`
  (riesgo de pérdida de precisión).
- TDD estricto: los tests específicos del trigger (`UPDATE`/`DELETE` rechazados) se suman a
  la suite de contract tests reutilizada.

## Fuera de Alcance

- El tooling de rebuild/replay y el verificador de consistencia — `hu-0008` (EP-1.12), que
  depende de este adaptador Postgres.
- Cualquier optimización de despliegue o CI más allá de correr las migraciones contra una DB
  fresca (ya resuelto en EP-0.5).

## Technical Context

### Microservicio objetivo
- `apps/ledger`

### Artefactos a reutilizar
- `describeEventStoreContract` — de `hu-0002`
- `read-model-store.contract.ts` — de `hu-0004`
- `DatabaseModule` de `libs/shared` (movido desde `finances` en EP-0.2)
- Patrón `saveWithinTransaction` de
  `apps/finances/src/outbox/infrastructure/adapters/persistence/typeorm/outbox.repository.ts:11`

### Patrones obligatorios
- Migraciones con `MigrationInterface`, estilo
  `apps/finances/src/database/migrations/1784073600021-CreateOutboxEventsTable.ts`
- Contract tests idénticos a los de `hu-0002`/`hu-0004`, sin bifurcación de casos por adaptador
- TDD estricto

### Restricciones técnicas
- `INSERT` multi-fila por batch para mitigar el costo de un round-trip por evento
  (rendimiento)
- Ninguna conversión de monto a `number` en ningún punto del adaptador

### Deuda técnica relevante
- Ninguna — depende de `hu-0002`/`hu-0004` ya construidas en este mismo flujo; EP-0.2
  (`DatabaseModule` en `libs/shared`) ya está cerrado según el roadmap
