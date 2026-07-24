# hu-0007: Adaptadores Postgres de EventStore y ReadModelStore — Plan de Implementación

**Historia:** `work/active/hu-0007/`
**Microservicio(s):** `apps/ledger`
**Objetivo:** Corregir bugs en `PostgresReadModelStore` y `PostgresEventStore`, y agregar el spec de contract test faltante para `PostgresReadModelStore` (AC-8).
**Arquitectura:** Infraestructura interna del módulo `shared-kernel`. Los adaptadores implementan puertos de dominio (`EventStore`, `ReadModelStore`) verificados por contract tests reutilizados. Sin endpoints REST, sin cambios en el modelo de datos.
**Stack:** NestJS · TypeScript · TypeORM · PostgreSQL · Jest

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Tarea 2 (setup de tablas en spec + contract test de truncate/query) |
| AC-2 | Tarea 3 (batch INSERT multi-fila) |
| AC-3 | Ya cubierto por `postgres-event-store.spec.ts` existente |
| AC-4 | Ya cubierto por contract test `describeEventStoreContract` |
| AC-5 | Ya cubierto por contract test `describeEventStoreContract` |
| AC-6 | Ya cubierto por contract test `describeEventStoreContract` |
| AC-7 | Ya cubierto por `postgres-event-store.spec.ts` existente |
| AC-8 | Tarea 2 (`postgres-read-model-store.spec.ts`) |

> AC-1 se verifica indirectamente: el spec de Tarea 2 crea la tabla de test y el contract test de `ReadModelStore` ejerce upsert/delete/query/truncate que solo funcionan con el esquema correcto. Las migraciones ya existen (`1790000000001-CreateEventStore`, `1790000000002-CreateProjectionCheckpoints`, `1790000000003-CreateCoreProjections`).

---

### Tarea 0: Preparar rama de trabajo

> Esta tarea solicita el nombre de la rama al usuario.

**Step 1: Preguntar nombre de rama**

Preguntar: "¿Cuál es el nombre de la rama? (ej: feat/HU-0007-postgres-adapters-contract-tests)"

**Step 2: Crear rama de trabajo**

```bash
git -C . checkout -b <nombre-de-rama-dado-por-usuario>
```
Esperado: rama nueva creada y activa, partiendo del HEAD actual (`feat/core`).

---

### Tarea 1: Corregir `PostgresReadModelStore.upsert` y su import [X]

**Archivos:**
- Modificar: `apps/ledger/src/shared-kernel/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store.ts:1-28`
- Test: (se escribe en Tarea 2 — esta tarea solo produce el código de implementación)

**Contexto:** La clase abstracta `ReadModelStore` declara `abstract upsert(table: string, key: ReadModelKey, row: ReadModelRow): Promise<void>` pero la implementación actual tiene firma `upsert(table: string, row: ReadModelRow)` omitiendo el parámetro `key`. Además, el import de `ReadModelStore` usa path relativo (`../../application/projection/read-model-store`) en vez del path alias `@ledger/shared-kernel/...`.

**Step 1: Modificar firma y lógica de `upsert`**

En `apps/ledger/src/shared-kernel/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Criteria, Filter, FilterOperator } from '@shared';
import {
  ReadModelKey,
  ReadModelRow,
  ReadModelStore,
} from '@ledger/shared-kernel/application/projection/read-model-store';

@Injectable()
export class PostgresReadModelStore extends ReadModelStore {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async upsert(table: string, key: ReadModelKey, row: ReadModelRow): Promise<void> {
    const cols = Object.keys(row);
    const values = Object.values(row);
    const keyCols = Object.keys(key);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const updateSet = cols
      .filter((c) => !keyCols.includes(c))
      .map((c) => `${c} = EXCLUDED.${c}`)
      .join(', ');

    const conflictTarget = keyCols.length > 0
      ? `ON CONFLICT (${keyCols.join(', ')}) DO UPDATE SET ${updateSet}`
      : 'ON CONFLICT DO NOTHING';

    const sql = `
      INSERT INTO ${table} (${cols.join(', ')})
      VALUES (${placeholders})
      ${conflictTarget}
    `;

    await this.dataSource.query(sql, values);
  }

  // ... resto de métodos sin cambios (delete, query, truncate, etc.)
}
```

**Step 2: Verificar que el archivo compila sin errores de tipo**

```bash
cd apps/ledger
npx tsc --noEmit --pretty 2>&1 | head -20
cd ../..
```
Esperado: sin errores de compilación en `postgres-read-model-store.ts`.

**Step 3: Ejecutar los tests existentes que usan `PostgresReadModelStore`**

```bash
cd apps/ledger
npx jest src/shared-kernel/infrastructure/adapters/read-model-store/ --no-coverage --passWithNoTests 2>&1 | tail -10
cd ../..
```
Esperado: PASS (o test skipped si solo existen los tests in-memory y el de postgres no se ha creado aún).

---

### Tarea 2: Crear `postgres-read-model-store.spec.ts` (AC-8) [X]

**Archivos:**
- Crear: `apps/ledger/src/shared-kernel/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store.spec.ts`

**Step 1: Escribir el spec**

En `apps/ledger/src/shared-kernel/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store.spec.ts`:

```typescript
import { DataSource } from 'typeorm';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { describeReadModelStoreContract } from '@ledger/shared-kernel/infrastructure/testing/read-model-store.contract';
import { PostgresReadModelStore } from './postgres-read-model-store';

const runPgTests = !!process.env.RUN_PG_TESTS;
const testUri =
  process.env.DB_URI ?? 'postgres://postgres:postgres@localhost:5432/ledger_test';

if (runPgTests) {
  let dataSource: DataSource;

  const initialize = async (): Promise<void> => {
    dataSource = new DataSource({ type: 'postgres', url: testUri });
    await dataSource.initialize();

    const runner = dataSource.createQueryRunner();
    await runner.query('DROP TABLE IF EXISTS t, a, b CASCADE');
    await runner.query(`
      CREATE TABLE t (id TEXT PRIMARY KEY, label TEXT, count INT, kind TEXT, "maybe" TEXT, "name" TEXT, age INT, score INT, n INT, v TEXT)
    `);
    await runner.query(`
      CREATE TABLE a (id TEXT PRIMARY KEY)
    `);
    await runner.query(`
      CREATE TABLE b (id TEXT PRIMARY KEY)
    `);
    await runner.release();
  };

  const makeStore = async (): Promise<ReadModelStore> => {
    if (!dataSource?.isInitialized) await initialize();
    await dataSource.query('TRUNCATE t, a, b CASCADE');
    return new PostgresReadModelStore(dataSource);
  };

  afterAll(async () => {
    await dataSource?.destroy();
  });

  describeReadModelStoreContract(makeStore);
} else {
  describe.skip('PostgresReadModelStore contract (set RUN_PG_TESTS=1 with a database)', () => {
    it('is skipped without a database', () => {
      expect(true).toBe(true);
    });
  });
}
```

**Step 2: Ejecutar el spec (sin DB — debe skippear)**

```bash
cd apps/ledger
npx jest src/shared-kernel/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store.spec.ts --no-coverage 2>&1 | tail -15
cd ../..
```
Esperado: PASS — 1 test skipped (sin DB, `RUN_PG_TESTS` no configurado).

**Step 3: Verificar que el import del path alias funciona**

```bash
cd apps/ledger
npx tsc --noEmit --pretty 2>&1 | grep -i "read.model.store\|upsert" | head -10
cd ../..
```
Esperado: sin errores de tipo ni de módulo.

---

### Tarea 3: Batch INSERT en `PostgresEventStore.append` [X]

**Archivos:**
- Modificar: `apps/ledger/src/shared-kernel/infrastructure/adapters/event-store/postgres/postgres-event-store.ts:92-125`

**Contexto:** La implementación actual itera evento por evento haciendo `INSERT ... RETURNING` individuales. La restricción técnica de la HU pide `INSERT` multi-fila por batch para mitigar el costo de round-trips.

**Step 1: Reescribir `insertAll` con INSERT multi-fila**

Reemplazar el método `insertAll`:

En `apps/ledger/src/shared-kernel/infrastructure/adapters/event-store/postgres/postgres-event-store.ts`:

```typescript
  private async insertAll(
    manager: EntityManager,
    events: readonly EventEnvelope[],
  ): Promise<StoredEvent[]> {
    const valuesClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const event of events) {
      const placeholders = Array.from({ length: 12 }, (_, i) => `$${idx + i}`);
      valuesClauses.push(`(${placeholders.join(', ')})`);
      params.push(
        event.eventId,
        event.userId,
        event.aggregateType,
        event.aggregateId,
        event.sequence,
        event.eventType,
        event.schemaVersion,
        event.clientId,
        event.externalRef,
        JSON.stringify(event.payload),
        event.occurredAt.toISOString(),
        event.recordedAt.toISOString(),
      );
      idx += 12;
    }

    const rows: EventStoreRow[] = await manager.query(
      `INSERT INTO event_store
         (event_id, user_id, aggregate_type, aggregate_id, sequence, event_type,
          schema_version, client_id, external_ref, payload, occurred_at, recorded_at)
       VALUES ${valuesClauses.join(', ')}
       RETURNING ${SELECT_COLUMNS}`,
      params,
    );

    return rows.map(toStoredEvent);
  }
```

**Step 2: Verificar compilación**

```bash
cd apps/ledger
npx tsc --noEmit --pretty 2>&1 | head -20
cd ../..
```
Esperado: sin errores de compilación.

**Step 3: Ejecutar spec de PostgresEventStore (sin DB — debe skippear)**

```bash
cd apps/ledger
npx jest src/shared-kernel/infrastructure/adapters/event-store/postgres/postgres-event-store.spec.ts --no-coverage 2>&1 | tail -15
cd ../..
```
Esperado: PASS — 1 test skipped (sin DB, `RUN_PG_TESTS` no configurado).

---

### Tarea 4: Ejecutar suite completa del módulo shared-kernel [X]

**Step 1: Ejecutar todos los tests de shared-kernel**

```bash
cd apps/ledger
npx jest src/shared-kernel/ --no-coverage 2>&1 | tail -25
cd ../..
```
Esperado: PASS — todos los tests pasando (los specs Postgres skippeados sin DB, los in-memory en verde).

**Step 2: Ejecutar todos los tests de ledger (full suite)**

```bash
cd apps/ledger
npx jest --no-coverage --passWithNoTests 2>&1 | tail -30
cd ../..
```
Esperado: PASS — suite completa del ledger en verde.
