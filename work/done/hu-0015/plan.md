# hu-0015: Persistencia Postgres de las proyecciones de conciliación — Plan de Implementación

**Historia:** `work/active/hu-0015/`
**App:** `apps/ledger` (mono-repo Nx; no hay microservicios separados)
**Objetivo:** Que `assertion_status` y `adjustment_audit` sean proyecciones de primera
clase — projectors que cumplen el contrato `Projector`, escritura por el `ReadModelStore`
de Postgres, checkpoint persistido y registro en el tooling de rebuild.
**Arquitectura:** Los dos projectors dejan de ser clases sueltas con stores bespoke y pasan
a extender `Projector`, escribiendo por `ReadModelStore.upsert`. Los puertos
`AssertionStatusStore`/`AdjustmentAuditStore` se reducen a **solo lectura** y ganan
adaptadores sobre el mismo store. Se agrega el primer adaptador real de
`ProjectionCheckpointRepository` y el pump pasa a dispararse solo.
**Stack:** NestJS · TypeScript · event-sourcing · PostgreSQL · Jest

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-0 (projectors implementan `Projector`) | Tarea 3, Tarea 4 |
| AC-1 (escritura por `ReadModelStore`) | Tarea 3, Tarea 4, Tarea 5, Tarea 6 |
| AC-2 (módulo sin dobles in-memory) | Tarea 9 |
| AC-3 (contract tests en ambos adaptadores) | Tarea 1, Tarea 6 |
| AC-4 (migración ordenada tras el event store) | Tarea 7 |
| AC-5 (baja de `proj_transfer_candidates`) | Tarea 7 |
| AC-6 (registro en el tooling de rebuild) | Tarea 8 |
| AC-7 (esquema coincide con lo que escriben) | Tarea 7, Tarea 11 |
| AC-8 (rebuild reproduce el estado) | Tarea 11 |
| Decisión de diseño: pump con checkpoint persistido y disparo | Tarea 2, Tarea 10 |

---

### Tarea 0: Rama de trabajo — **no aplica**

Ya estamos en `feat/core`, la rama de trabajo donde vienen todas las HU del ledger, y
`/forge` no toca git por diseño. No se crea rama nueva. Los commits son de `/commit`,
después de la revisión.

---

### Tarea 1: Contract suite de `AdjustmentAuditStore` [X]

**Archivos:**
- Crear: `apps/ledger/src/reconciliation/domain/ports/adjustment-audit-store.contract.ts`

Es lo primero por el **Integration-First Gate**: el contrato antes que los adaptadores.
Sigue el patrón de `assertion-status-store.contract.ts`, que ya existe.

**Step 1: Escribir la suite reusable**

```typescript
import { defineContract } from '@ledger/shared/testing';
import { AdjustmentAuditEntry, AdjustmentAuditStore } from './adjustment-audit-store.port';

const entryFor = (txnId: string, accountId: string, amount: string): AdjustmentAuditEntry => ({
  adjustmentTxnId: txnId,
  userId: 'user-1',
  accountId,
  assertionId: `a-${txnId}`,
  amount,
  currencyCode: 'USD',
  resolvedOn: '2026-07-22',
});

/**
 * Reusable contract for any {@link AdjustmentAuditStore}. Both the read-model
 * adapter and any double run this same suite so they prove identical behaviour
 * (RNF-11).
 */
export function runAdjustmentAuditStoreContract(
  makeStore: () => AdjustmentAuditStore | Promise<AdjustmentAuditStore>,
): void {
  defineContract('AdjustmentAuditStore contract', [
    {
      name: 'accumulates one adjustment for an account',
      verify: async () => {
        const store = await makeStore();
        await store.record(entryFor('txn-1', 'acc-1', '400'));

        const [row] = await store.byAccount('user-1', 'acc-1');
        expect(row.totalAdjusted).toBe('400');
        expect(row.adjustmentCount).toBe(1);
      },
    },
    {
      name: 'sums several adjustments on the same account and currency',
      verify: async () => {
        const store = await makeStore();
        await store.record(entryFor('txn-1', 'acc-1', '400'));
        await store.record(entryFor('txn-2', 'acc-1', '100'));

        const [row] = await store.byAccount('user-1', 'acc-1');
        expect(row.totalAdjusted).toBe('500');
        expect(row.adjustmentCount).toBe(2);
      },
    },
    {
      name: 'is idempotent by adjustmentTxnId (AC-8: replay never double-counts)',
      verify: async () => {
        const store = await makeStore();
        await store.record(entryFor('txn-1', 'acc-1', '400'));
        await store.record(entryFor('txn-1', 'acc-1', '400'));

        const [row] = await store.byAccount('user-1', 'acc-1');
        expect(row.totalAdjusted).toBe('400');
        expect(row.adjustmentCount).toBe(1);
      },
    },
    {
      name: 'keeps accounts and currencies apart',
      verify: async () => {
        const store = await makeStore();
        await store.record(entryFor('txn-1', 'acc-1', '400'));
        await store.record(entryFor('txn-2', 'acc-2', '250'));

        expect(await store.byAccount('user-1', 'acc-2')).toHaveLength(1);
        expect((await store.byAccount('user-1', 'acc-1'))[0].totalAdjusted).toBe('400');
      },
    },
    {
      name: 'returns nothing for an account without adjustments',
      verify: async () => {
        const store = await makeStore();
        expect(await store.byAccount('user-1', 'acc-none')).toEqual([]);
      },
    },
    {
      name: 'isolates users (Artículo 5)',
      verify: async () => {
        const store = await makeStore();
        await store.record(entryFor('txn-1', 'acc-1', '400'));

        expect(await store.byAccount('user-2', 'acc-1')).toEqual([]);
      },
    },
  ]);
}
```

**Step 2: Confirmar que compila**

```bash
npx tsc -p apps/ledger/tsconfig.json --noEmit
```
Esperado: sin errores en el archivo nuevo (todavía nadie la invoca).

---

### Tarea 2: `PostgresProjectionCheckpointRepository` [X]

**Archivos:**
- Crear: `apps/ledger/src/shared-kernel/infrastructure/adapters/projection/postgres-projection-checkpoint.repository.ts`
- Crear: `apps/ledger/src/shared-kernel/infrastructure/adapters/projection/postgres-projection-checkpoint.repository.spec.ts`

Primer adaptador real del puerto; la tabla `projection_checkpoints` existe desde
`1790000000002` y nunca se usó.

**Step 1: Escribir el test (patrón `RUN_PG_TESTS` de `postgres-read-model-store.spec.ts`)**

```typescript
import { DataSource } from 'typeorm';
import { PostgresProjectionCheckpointRepository } from './postgres-projection-checkpoint.repository';

const runPgTests = !!process.env.RUN_PG_TESTS;
const testUri = process.env.DB_URI ?? 'postgres://postgres:postgres@localhost:5432/ledger_test';

if (runPgTests) {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({ type: 'postgres', url: testUri });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE projection_checkpoints');
  });

  describe('PostgresProjectionCheckpointRepository', () => {
    it('returns 0 for a projection that never ran', async () => {
      const repo = new PostgresProjectionCheckpointRepository(dataSource);
      expect(await repo.lastPosition('reconciliation')).toBe(0n);
    });

    it('persists and reads back a position as bigint', async () => {
      const repo = new PostgresProjectionCheckpointRepository(dataSource);
      await repo.advance('reconciliation', 42n);
      expect(await repo.lastPosition('reconciliation')).toBe(42n);
    });

    it('advances an existing checkpoint instead of inserting twice', async () => {
      const repo = new PostgresProjectionCheckpointRepository(dataSource);
      await repo.advance('reconciliation', 10n);
      await repo.advance('reconciliation', 20n);
      expect(await repo.lastPosition('reconciliation')).toBe(20n);
    });

    it('keeps projections independent', async () => {
      const repo = new PostgresProjectionCheckpointRepository(dataSource);
      await repo.advance('reconciliation', 10n);
      await repo.advance('account_tree', 99n);
      expect(await repo.lastPosition('reconciliation')).toBe(10n);
    });
  });
} else {
  describe.skip('PostgresProjectionCheckpointRepository (set RUN_PG_TESTS=1 with a database)', () => {
    it('is skipped without a database', () => {
      expect(true).toBe(true);
    });
  });
}
```

**Step 2: Confirmar que falla**

```bash
npx jest --config apps/ledger/jest.config.ts --testPathPatterns "postgres-projection-checkpoint"
```
Esperado: FAIL — `Cannot find module './postgres-projection-checkpoint.repository'`.

**Step 3: Implementar**

Leer primero el DDL real de la tabla en
`apps/ledger/src/database/migrations/1790000000002-CreateProjectionCheckpoints.ts` y usar
sus nombres de columna exactos. El adaptador debe:
- devolver `0n` cuando no hay fila,
- convertir el valor de Postgres a `bigint` de JS (la columna es `BIGINT`, que el driver
  entrega como `string` — nunca usar `Number`, rompería con posiciones grandes),
- hacer `INSERT … ON CONFLICT (<pk>) DO UPDATE SET position = EXCLUDED.position`.

**Step 4: Confirmar que pasa**

```bash
npx jest --config apps/ledger/jest.config.ts --testPathPatterns "postgres-projection-checkpoint"
```
Esperado: PASS (o skip declarado si no hay `RUN_PG_TESTS`).

---

### Tarea 3: `AssertionStatusProjector` sobre el contrato `Projector` (AC-0, AC-1) [X]

**Archivos:**
- Crear: `apps/ledger/src/reconciliation/infrastructure/projections/assertion-status.projector.ts`
- Crear: `apps/ledger/src/reconciliation/infrastructure/projections/assertion-status.projector.spec.ts`
- Borrar: `apps/ledger/src/reconciliation/application/projectors/assertion-status.projector.ts` y su `.spec.ts`

Se **mueve** a `infrastructure/projections/` (Artículo 1: `application/` no importa
`@nestjs/*`) y se le quita `@Injectable()`, igual que `AccountTreeProjector`.

**Step 1: Escribir el test**

Portar los casos del spec actual (`application/projectors/assertion-status.projector.spec.ts`)
a la firma nueva, usando `InMemoryReadModelStore` real en vez del store bespoke:

```typescript
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import { AssertionStatusProjector, PROJ_ASSERTIONS } from './assertion-status.projector';

describe('AssertionStatusProjector', () => {
  const projector = new AssertionStatusProjector();

  it('declares the projector contract (AC-0)', () => {
    expect(projector.name).toBe('assertion_status');
    expect(projector.consumes).toContain('BalanceAsserted');
    expect(projector.handles('BalanceAsserted')).toBe(true);
    expect(projector.handles('TransactionRecorded')).toBe(false);
  });

  // … un caso por evento: inserta en BalanceAsserted, actualiza status/difference/
  // checked_at en BalanceAssertionEvaluated, status REVOKED + revoke_reason en
  // AssertionRevoked, resolved_by_txn en DiscrepancyResolved.
  // … un caso de idempotencia: aplicar el mismo evento dos veces deja la misma fila.
});
```

**Step 2: Confirmar que falla**

```bash
npx jest --config apps/ledger/jest.config.ts --testPathPatterns "infrastructure/projections/assertion-status"
```
Esperado: FAIL — módulo inexistente.

**Step 3: Implementar**

```typescript
import { Projector } from '@ledger/shared-kernel/application/projection/projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';
import {
  ASSERTION_REVOKED,
  BALANCE_ASSERTED,
  BALANCE_ASSERTION_EVALUATED,
  DISCREPANCY_RESOLVED,
} from '@ledger/reconciliation/domain/balance-assertion/events';

/** Read-model table name for the assertion status projection. */
export const PROJ_ASSERTIONS = 'proj_assertions';

export class AssertionStatusProjector extends Projector {
  readonly name = 'assertion_status';
  readonly consumes = [
    BALANCE_ASSERTED,
    BALANCE_ASSERTION_EVALUATED,
    ASSERTION_REVOKED,
    DISCREPANCY_RESOLVED,
  ];

  async project(event: StoredEvent, store: ReadModelStore): Promise<void> {
    // dispatch por eventType con guard clauses, como el projector actual;
    // cada rama hace store.upsert(PROJ_ASSERTIONS, { assertion_id: event.aggregateId }, {...})
    // con las columnas snake_case de la tabla.
  }
}
```

Claves de traducción respecto del projector viejo:
- `upsertAsserted(row)` → `upsert` con la fila completa en snake_case.
- `applyEvaluation(...)` → `upsert` con `{ status, difference, checked_at }`.
- `markRevoked(...)` → `upsert` con `{ status: REVOKED, revoke_reason }`.
- `linkResolution(...)` → `upsert` con `{ resolved_by_txn }`.

**Step 4: Confirmar que pasa**

```bash
npx jest --config apps/ledger/jest.config.ts --testPathPatterns "infrastructure/projections/assertion-status"
```
Esperado: PASS.

---

### Tarea 4: `AdjustmentAuditProjector` sobre el contrato `Projector` (AC-0, AC-1) [X]

**Archivos:**
- Crear: `apps/ledger/src/reconciliation/infrastructure/projections/adjustment-audit.projector.ts` + `.spec.ts`
- Borrar: `apps/ledger/src/reconciliation/application/projectors/adjustment-audit.projector.ts` y su `.spec.ts`
- Borrar: `apps/ledger/src/reconciliation/application/projectors/index.ts` (queda vacío)

**Step 1: Escribir el test**

Casos: proyecta el detalle y el acumulado desde `DiscrepancyResolved`; ignora el evento si
la aserción no existe o no tiene `difference`; **recalcular es idempotente** (aplicar el
mismo evento dos veces deja `adjustment_count = 1`); dos ajustes distintos sobre la misma
cuenta suman.

**Step 2: Confirmar que falla** — igual que las anteriores.

**Step 3: Implementar**

```typescript
export const PROJ_ADJUSTMENT_AUDIT = 'proj_adjustment_audit';
export const PROJ_ADJUSTMENT_AUDIT_ENTRIES = 'proj_adjustment_audit_entries';

export class AdjustmentAuditProjector extends Projector {
  readonly name = 'adjustment_audit';
  readonly consumes = [DISCREPANCY_RESOLVED];

  async project(event: StoredEvent, store: ReadModelStore): Promise<void> {
    // 1. leer la aserción con store.query(PROJ_ASSERTIONS, criteria por assertion_id)
    // 2. guard: sin fila o sin difference → return
    // 3. upsert del detalle por { adjustment_txn_id }
    // 4. releer las entries de esa cuenta+moneda y upsert del acumulado RECALCULADO
    //    (nunca total = total + x — no sería idempotente ante replay, AC-8)
  }
}
```

El `Criteria` es el de `@shared`, el mismo que usan `AccountTreeProjector` y
`AccountBalancesProjector` para leer — copiar su forma de construirlo.

**Step 4: Confirmar que pasa.**

---

### Tarea 5: Reducir los puertos a solo lectura (AC-1) [X]

**Archivos:**
- Modificar: `apps/ledger/src/reconciliation/domain/ports/assertion-status-store.port.ts`
- Modificar: `apps/ledger/src/reconciliation/domain/ports/adjustment-audit-store.port.ts`
- Modificar: `apps/ledger/src/reconciliation/domain/ports/assertion-status-store.contract.ts`

Con los projectors escribiendo por `ReadModelStore`, los métodos de escritura de ambos
puertos quedan sin llamadores. Quitar de `AssertionStatusStore`: `upsertAsserted`,
`applyEvaluation`, `markRevoked`, `linkResolution`, `truncate`. Conservar `byId`,
`listByAccount`, `nonRevokedOnAccountFrom`.

`truncate` sale porque el rebuild trunca por tabla vía `ReadModelStore`, no por puerto.

`AdjustmentAuditStore` conserva `record` — la contract suite de la Tarea 1 lo usa para
sembrar, y el projector lo necesitaría si se decidiera reusarlo; si al final del build
ningún productor lo llama, quitarlo también y ajustar la suite para sembrar por el
`ReadModelStore`.

Adaptar `assertion-status-store.contract.ts`: los casos que hoy siembran con
`upsertAsserted` pasan a sembrar por el `ReadModelStore` que respalda al reader.

---

### Tarea 6: Adaptadores de lectura sobre `ReadModelStore` (AC-1, AC-3) [X]

**Archivos:**
- Crear: `apps/ledger/src/reconciliation/infrastructure/adapters/persistence/read-model-assertion-status-reader.ts` + `.spec.ts`
- Crear: `apps/ledger/src/reconciliation/infrastructure/adapters/persistence/read-model-adjustment-audit-reader.ts` + `.spec.ts`
- Borrar: `apps/ledger/src/reconciliation/infrastructure/adapters/persistence/in-memory/in-memory-assertion-status-store.ts` + `.spec.ts`
- Borrar: `apps/ledger/src/reconciliation/infrastructure/adapters/persistence/in-memory/in-memory-adjustment-audit-store.ts`

**Step 1: Escribir los tests corriendo las contract suites**

Cada spec instancia el reader sobre un `InMemoryReadModelStore` real y corre la suite
correspondiente. Así el contrato se ejercita **en cada corrida de CI**, sin base de datos:

```typescript
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { runAssertionStatusStoreContract } from '@ledger/reconciliation/domain/ports/assertion-status-store.contract';
import { ReadModelAssertionStatusReader } from './read-model-assertion-status-reader';

runAssertionStatusStoreContract(() => new ReadModelAssertionStatusReader(new InMemoryReadModelStore()));
```

Y una variante bajo `RUN_PG_TESTS` que lo corre sobre `PostgresReadModelStore`, siguiendo
el patrón de `postgres-read-model-store.spec.ts` — así AC-3 queda cubierto contra ambos
adaptadores del store.

**Step 2 a 4:** falla → implementar los readers con `store.query(tabla, criteria)`
mapeando snake_case → camelCase de `AssertionStatusRow`/`AdjustmentAuditRow` → pasa.

`nonRevokedOnAccountFrom` filtra `user_id`, `account_id`, `date >= from` y
`status <> 'REVOKED'` — exactamente el índice parcial `idx_proj_assertions_account`.

---

### Tarea 7: Migración renumerada y sin `proj_transfer_candidates` (AC-4, AC-5, AC-7) [X]

**Archivos:**
- Crear: `apps/ledger/src/database/migrations/1790000000005-CreateReconciliationProjections.ts`
- Borrar: `apps/ledger/src/database/migrations/1784160000010-CreateReconciliationProjections.ts`

**Step 1: Copiar el contenido de la migración vieja**, renombrando la clase y la propiedad
`name` a `CreateReconciliationProjections1790000000005`.

**Step 2: Quitar** el bloque `CREATE TABLE "proj_transfer_candidates"` y sus dos índices,
y su `DROP TABLE` del `down()`.

**Step 3: Verificar el esquema contra lo que escriben los projectors (AC-7).** Comparar
columna por columna las tres tablas contra los `upsert` de las Tareas 3 y 4. Ya se
verificó en `docs/data-model.md` que coinciden — este paso confirma que el código
implementado no se desvió.

**Step 4: Confirmar el orden**

```bash
ls apps/ledger/src/database/migrations/
```
Esperado: `1790000000001` … `1790000000005`, en orden ascendente, sin el `1784…`.

---

### Tarea 8: Registrar la proyección en el tooling de rebuild (AC-6) [X]

**Archivos:**
- Modificar: `apps/ledger/src/tooling/rebuild.command.ts`

Registrar **una** entrada con los dos projectors y las tres tablas (ver
`docs/research.md` — comparten checkpoint por la dependencia de orden):

```typescript
registry.register(
  'reconciliation',
  [new AssertionStatusProjector(), new AdjustmentAuditProjector()],
  [PROJ_ASSERTIONS, PROJ_ADJUSTMENT_AUDIT, PROJ_ADJUSTMENT_AUDIT_ENTRIES],
);
```

Nota: `rebuild.command.ts` construye hoy `InMemoryProjectionCheckpointRepository`. Para el
rebuild está bien (arranca de 0 por definición), así que **no se cambia** — el adaptador
Postgres de la Tarea 2 es para el pump, no para el rebuild.

**Verificación:**

```bash
npx tsc -p apps/ledger/tsconfig.app.json --noEmit
```
Esperado: sin errores.

---

### Tarea 9: Cablear `ReconciliationModule` sin dobles in-memory (AC-2) [X]

**Archivos:**
- Modificar: `apps/ledger/src/reconciliation/reconciliation.module.ts`

- `AssertionStatusStore` → `ReadModelAssertionStatusReader`.
- `AdjustmentAuditStore` → `ReadModelAdjustmentAuditReader`.
- Los dos projectors se proveen desde `infrastructure/projections/` (sin `@Injectable`, así
  que van con `useFactory` o `useValue`).
- Quitar el comentario `TODO(persistence)` del JSDoc del módulo.

---

### Tarea 10: Pump con checkpoint persistido y disparo periódico [X]

**Archivos:**
- Modificar: `apps/ledger/src/reconciliation/infrastructure/adapters/events/reevaluate-assertions.event-handler.ts`
- Modificar: `apps/ledger/src/reconciliation/reconciliation.module.ts`

**Step 1: Test** — el pump arranca desde el checkpoint persistido, no desde `0n`; avanza el
checkpoint por el puerto tras cada evento; ante fallo de un projector no avanza.

**Step 2 a 4:**
- Reemplazar `private checkpoint = 0n` por lecturas/escrituras contra
  `ProjectionCheckpointRepository`, con el nombre de proyección `reconciliation` (el mismo
  del registro de la Tarea 8, para que rebuild y pump compartan posición).
- Llamar a los projectors con `(event, readModelStore)`.
- Agregar el disparo periódico con `@nestjs/schedule` (ya es dependencia directa) e
  importar `ScheduleModule.forRoot()` donde corresponda.
- **Conservar el orden proyectar → reaccionar** y el `try/catch` que loguea la posición
  global antes de propagar.

Renombrar el archivo/clase a `ReconciliationPump` si el nombre viejo
(`ReevaluateAssertionsEventHandler`) ya no describe lo que hace — ahora proyecta y además
reacciona.

---

### Tarea 11: Test de rebuild end-to-end (AC-7, AC-8) [X]

**Archivos:**
- Crear: `apps/ledger/src/reconciliation/reconciliation.rebuild.spec.ts`

Sembrar un stream con `BalanceAsserted` → `BalanceAssertionEvaluated` (MISMATCHED) →
`DiscrepancyResolved`, con `InMemoryEventStore` e `InMemoryReadModelStore` reales.
Correr `ProjectionRebuilder.rebuild('reconciliation')` y verificar que `proj_assertions`
y `proj_adjustment_audit` quedan en el estado esperado.

Después correr el rebuild **una segunda vez** y verificar que el resultado es idéntico —
es la prueba de que el recálculo del acumulado es idempotente (AC-8).

Incluir el caso de una aserción revocada, para cubrir que un rebuild no la resucita.

---

### Tarea 12: Suite completa y verificación de la app [X]

```bash
npx nx test ledger --skip-nx-cache
```
Esperado: PASS — sin suites rojas.

```bash
npx tsc -p apps/ledger/tsconfig.app.json --noEmit
```
Esperado: sin salida.

```bash
npx eslint "apps/ledger/src/reconciliation/**/*.ts" "apps/ledger/src/shared-kernel/**/*.ts"
```
Esperado: sin errores nuevos respecto de la línea base (106 problemas en todo el proyecto
antes de esta historia, ninguno en `reconciliation`).

Verificar que `app.wiring.spec.ts` sigue verde: es el que detecta un módulo mal cableado.
