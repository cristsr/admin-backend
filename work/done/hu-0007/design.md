# design: hu-0007

## Decisiones de Diseño

Sin incógnitas — todos los contratos (`EventStore`, `ReadModelStore`, `describeEventStoreContract`, `describeReadModelStoreContract`) ya están definidos por HU anteriores (`hu-0002`, `hu-0004`). Esta HU corrige y verifica las implementaciones Postgres existentes contra esos contratos.

## Flujo entre microservicios

No hay comunicación entre microservicios. Los adaptadores `PostgresEventStore` y `PostgresReadModelStore` son llamados sincrónicamente por el command bus y los projectores dentro de `apps/ledger`. El `DataSource` lo provee `DatabaseModule` de `libs/shared`.

## Componentes del módulo

### Correcciones a componentes existentes

| Componente | Archivo | Cambio |
|-----------|---------|--------|
| `PostgresReadModelStore` | `apps/ledger/src/shared-kernel/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store.ts` | Corregir firma `upsert` para aceptar `key: ReadModelKey` y usar `key` en la cláusula `ON CONFLICT`; corregir import a path alias `@ledger/...` |
| `PostgresEventStore` | `apps/ledger/src/shared-kernel/infrastructure/adapters/event-store/postgres/postgres-event-store.ts` | Cambiar `append` de N INSERTs individuales a INSERT multi-fila en batch |

### Componente nuevo

| Componente | Archivo | Descripción |
|-----------|---------|-------------|
| `PostgresReadModelStoreSpec` | `apps/ledger/src/shared-kernel/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store.spec.ts` | Contract test (AC-8): `describeReadModelStoreContract(() => new PostgresReadModelStore(dataSource))` + teardown, gated por `RUN_PG_TESTS` |

> Diagrama completo (C4 Nivel 3): `docs/model.delta.c4` y el modelo vivo `apps/ledger/docs/shared-kernel/shared-kernel.c4`.

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

El alcance es interno al módulo `shared-kernel` de `apps/ledger`: correcciones de firma y batch insert en los adaptadores Postgres existentes, más la adición de un spec de contract test faltante. Ningún nuevo app, módulo, lib o integración cruza el límite del módulo.

- **Nivel:** N/A
- **Cambio:** Ninguno
- **Nodo/arista concreto:** N/A

## Contratos por microservicio

### apps/ledger

Sin endpoints REST nuevos. Los adaptadores implementan puertos de dominio (`EventStore`, `ReadModelStore`) verificados por contract tests reutilizados (`describeEventStoreContract`, `describeReadModelStoreContract`).

| Método | Ruta/Trigger | Descripción |
|--------|-------------|-------------|
| (sync-call) | `PostgresEventStore.append` | Persiste lote de eventos en `event_store` vía INSERT multi-fila transaccional |
| (sync-call) | `PostgresEventStore.load` | Carga historial de un stream por `(aggregate_id, user_id)` ordenado por `sequence` |
| (sync-call) | `PostgresEventStore.readAll` | Lee slice global por `global_position > from` con `limit` |
| (sync-call) | `PostgresEventStore.findByExternalRef` | Busca evento ancla por `(user_id, external_ref)` |
| (sync-call) | `PostgresReadModelStore.upsert` | INSERT … ON CONFLICT DO UPDATE con key explícita en `proj_*` |
| (sync-call) | `PostgresReadModelStore.delete` | DELETE por key en `proj_*` |
| (sync-call) | `PostgresReadModelStore.query` | SELECT dinámico con filtros `Criteria` en `proj_*` |
| (sync-call) | `PostgresReadModelStore.truncate` | TRUNCATE CASCADE de una tabla `proj_*` |

> Schemas de request/response no aplican — el contrato son los tipos TypeScript del puerto abstracto, verificados por las suites de contract test.

## Modelado de datos

Sin cambios en el modelo de datos. Las 3 migraciones ya existen y crean el esquema completo:

- `1790000000001-CreateEventStore.ts` → `event_store` + trigger de inmutabilidad
- `1790000000002-CreateProjectionCheckpoints.ts` → `projection_checkpoints`
- `1790000000003-CreateCoreProjections.ts` → `proj_accounts`, `proj_transactions`, `proj_postings`, `proj_balances`

Se verifican contra los AC pero no requieren modificación.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | Los adaptadores son wrappers directos de `DataSource.query()` sin capas intermedias — implementan exactamente el contrato del puerto abstracto, sin lógica de dominio. |
| Anti-Abstraction | ✅ | Se usa TypeORM `DataSource` y `EntityManager` directamente, sin envolverlos en una abstracción propia. Las excepciones se mapean con `instanceof QueryFailedError`, el mecanismo nativo del driver. |
| Integration-First | ✅ | Los contract tests (`describeEventStoreContract`, `describeReadModelStoreContract`) fueron definidos en `hu-0002` y `hu-0004` antes de que los adaptadores Postgres existieran. Esta HU solo agrega el spec faltante para `PostgresReadModelStore`. |
| Test-First | ✅ | El spec `postgres-read-model-store.spec.ts` se escribe y falla (por el bug de firma de `upsert`) antes de corregir la implementación. El spec de `PostgresEventStore` ya existe y verifica todos los AC (1-7). |
