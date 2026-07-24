# hu-0004: ReadModelStore contract tests — Plan de Implementación

**Historia:** `work/active/hu-0004/`
**App / lib:** `apps/ledger`
**Objetivo:** Crear `describeReadModelStoreContract()`, contract test reutilizable para el puerto `ReadModelStore` (mismo patrón que `describeEventStoreContract` de `hu-0002`), y refactorizar el spec de `InMemoryReadModelStore` para usarlo.
**Arquitectura:** El subsistema de proyecciones (puertos `ReadModelStore`, `Projector`, `ProjectionDispatcher` y adaptadores) ya existe en el código base — construido durante `hu-0001` a `hu-0003`. Esta historia agrega la suite de contract test reutilizable que certifica que toda implementación de `ReadModelStore` (in-memory hoy, Postgres en `hu-0007`) satisface el contrato.
**Stack:** NestJS · TypeScript · Jest · TypeORM (Postgres adapter ya existe, test en `hu-0007`)

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 (`ReadModelStore` declara 4 operaciones) | Tarea 1 (contract test verifica `upsert`, `delete`, `query`, `truncate`) |
| AC-2 (`Projector` agnóstico del modo) | Verificado por tests existentes (`polling-dispatcher.spec.ts`) — sin tarea nueva |
| AC-3 (`SynchronousDispatcher` en transacción) | Verificado por tests existentes (`account-tree.projector.spec.ts`) — sin tarea nueva |
| AC-4 (`PollingDispatcher` avanza checkpoint sin duplicar) | Verificado por tests existentes (`polling-dispatcher.spec.ts`) — sin tarea nueva |
| AC-5 (Mismo resultado en ambos modos) | Verificado por `polling-dispatcher.spec.ts:43-72` — sin tarea nueva |
| AC-6 (`account_tree` refleja open/rename/close) | Verificado por `account-tree.projector.spec.ts` — sin tarea nueva |
| AC-7 (`TransactionKindDeriver` nunca lanza) | Verificado por `transaction-kind.deriver.spec.ts` — sin tarea nueva |

> Las AC-2 a AC-7 ya tienen cobertura en el código existente. Esta historia se concentra en AC-1: el contract test que cierra el gap de `ReadModelStore`.

---

### Tarea 0: Verificar rama de trabajo [X]

> El usuario indicó trabajar sobre la rama actual (`feat/core`). No se crea rama nueva.

**Step 1: Confirmar estado del repo**

```bash
git -C D:\Cristian\Nest\admin-back branch --show-current
```
Esperado: `feat/core`

```bash
git -C D:\Cristian\Nest\admin-back status --porcelain
```
Esperado: solo `work/active/` como untracked (sin cambios dirty en src/).

---

### Tarea 1: Contract test `describeReadModelStoreContract` + refactor `InMemoryReadModelStore.spec.ts` [X]

**Archivos:**
- Crear: `apps/ledger/src/shared-kernel/infrastructure/testing/read-model-store.contract.ts`
- Modificar: `apps/ledger/src/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store.spec.ts`

**Step 1: Escribir el contract test (`read-model-store.contract.ts`)**

En `apps/ledger/src/shared-kernel/infrastructure/testing/read-model-store.contract.ts`:

```typescript
import { Criteria, FilterOperator, OrderType } from '@shared';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';

export type MakeReadModelStore = () => Promise<ReadModelStore>;

export function describeReadModelStoreContract(
  makeStore: MakeReadModelStore,
  teardown?: () => Promise<void>,
): void {
  describe('ReadModelStore contract', () => {
    let store: ReadModelStore;

    beforeEach(async () => {
      store = await makeStore();
    });

    afterEach(async () => {
      await teardown?.();
    });

    it('upserts a new row and queries it by EQUAL', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', label: 'A', count: 10 });

      const rows = await store.query('t', Criteria.none().equals('id', '1'));
      expect(rows).toEqual([{ id: '1', label: 'A', count: 10 }]);
    });

    it('overwrites a row on repeated upsert with the same key (idempotent projection)', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', v: 'old' });
      await store.upsert('t', { id: '1' }, { id: '1', v: 'new' });

      const rows = await store.query('t', Criteria.none());
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: '1', v: 'new' });
    });

    it('isolates tables — upsert in one table does not appear in another', async () => {
      await store.upsert('a', { id: '1' }, { id: '1' });
      await store.upsert('b', { id: '1' }, { id: '2' });

      expect(await store.query('a', Criteria.none())).toHaveLength(1);
      expect(await store.query('b', Criteria.none())).toHaveLength(1);
    });

    it('deletes a row by key', async () => {
      await store.upsert('t', { id: '1' }, { id: '1' });
      await store.upsert('t', { id: '2' }, { id: '2' });
      await store.delete('t', { id: '1' });

      const rows = await store.query('t', Criteria.none());
      expect(rows).toEqual([{ id: '2' }]);
    });

    it('delete on a non-existent key is a no-op', async () => {
      await store.delete('t', { id: 'ghost' });
      expect(await store.query('t', Criteria.none())).toEqual([]);
    });

    it('queries by NOT_EQUAL', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', kind: 'A' });
      await store.upsert('t', { id: '2' }, { id: '2', kind: 'B' });
      await store.upsert('t', { id: '3' }, { id: '3', kind: 'A' });

      const rows = await store.query('t', Criteria.none().equals('kind', 'A').notEquals('id', '1'));
      expect(rows.map(r => r.id)).toEqual(['3']);
    });

    it('queries by IN', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', kind: 'A' });
      await store.upsert('t', { id: '2' }, { id: '2', kind: 'B' });
      await store.upsert('t', { id: '3' }, { id: '3', kind: 'A' });

      const rows = await store.query('t', Criteria.none().oneOf('kind', ['A', 'B']));
      expect(rows).toHaveLength(3);
    });

    it('queries by IS_NULL and IS_NOT_NULL', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', maybe: null });
      await store.upsert('t', { id: '2' }, { id: '2', maybe: 'present' });

      const nulls = await store.query('t', Criteria.none().isNull('maybe'));
      expect(nulls.map(r => r.id)).toEqual(['1']);

      const notNulls = await store.query('t', Criteria.none().isNotNull('maybe'));
      expect(notNulls.map(r => r.id)).toEqual(['2']);
    });

    it('queries by CONTAINS (case-insensitive)', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', name: 'Hello World' });
      await store.upsert('t', { id: '2' }, { id: '2', name: 'Farewell' });

      const rows = await store.query('t', Criteria.none().contains('name', 'hello'));
      expect(rows.map(r => r.id)).toEqual(['1']);
    });

    it('queries by GREATER_THAN', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', age: 10 });
      await store.upsert('t', { id: '2' }, { id: '2', age: 30 });
      await store.upsert('t', { id: '3' }, { id: '3', age: 20 });

      const rows = await store.query('t', Criteria.none().greaterThan('age', 15));
      expect(rows.map(r => r.id)).toEqual(['2', '3']);
    });

    it('queries by BETWEEN', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', score: 5 });
      await store.upsert('t', { id: '2' }, { id: '2', score: 10 });
      await store.upsert('t', { id: '3' }, { id: '3', score: 15 });
      await store.upsert('t', { id: '4' }, { id: '4', score: 20 });

      const rows = await store.query('t', Criteria.none().between('score', 10, 15));
      expect(rows.map(r => r.id)).toEqual(['2', '3']);
    });

    it('orders ASC and DESC', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', n: 3 });
      await store.upsert('t', { id: '2' }, { id: '2', n: 1 });
      await store.upsert('t', { id: '3' }, { id: '3', n: 2 });

      const asc = await store.query('t', Criteria.none().orderBy('n', OrderType.ASC));
      expect(asc.map(r => r.n)).toEqual([1, 2, 3]);

      const desc = await store.query('t', Criteria.none().orderBy('n', OrderType.DESC));
      expect(desc.map(r => r.n)).toEqual([3, 2, 1]);
    });

    it('paginates with limitTo (sets take)', async () => {
      await store.upsert('t', { id: '1' }, { id: '1' });
      await store.upsert('t', { id: '2' }, { id: '2' });
      await store.upsert('t', { id: '3' }, { id: '3' });
      await store.upsert('t', { id: '4' }, { id: '4' });

      const rows = await store.query('t', Criteria.none().limitTo(2));
      expect(rows).toHaveLength(2);
    });

    it('paginates with skip + take', async () => {
      await store.upsert('t', { id: 'a' }, { id: 'a', n: 1 });
      await store.upsert('t', { id: 'b' }, { id: 'b', n: 2 });
      await store.upsert('t', { id: 'c' }, { id: 'c', n: 3 });
      await store.upsert('t', { id: 'd' }, { id: 'd', n: 4 });

      const rows = await store.query(
        't',
        Criteria.none().orderBy('n', OrderType.ASC).paginate({ skip: 1, take: 2 }),
      );
      expect(rows).toHaveLength(2);
      expect(rows.map(r => r.n)).toEqual([2, 3]);
    });

    it('returns all rows with empty Criteria', async () => {
      await store.upsert('t', { id: '1' }, { id: '1' });
      await store.upsert('t', { id: '2' }, { id: '2' });
      await store.upsert('t', { id: '3' }, { id: '3' });

      expect(await store.query('t', Criteria.none())).toHaveLength(3);
    });

    it('truncates all rows from a table', async () => {
      await store.upsert('t', { id: '1' }, { id: '1' });
      await store.upsert('t', { id: '2' }, { id: '2' });
      await store.truncate('t');

      expect(await store.query('t', Criteria.none())).toEqual([]);
    });

    it('truncate of one table does not affect another', async () => {
      await store.upsert('a', { id: '1' }, { id: '1' });
      await store.upsert('b', { id: '2' }, { id: '2' });
      await store.truncate('a');

      expect(await store.query('a', Criteria.none())).toEqual([]);
      expect(await store.query('b', Criteria.none())).toHaveLength(1);
    });
  });
}
```

**Step 2: Refactorizar `InMemoryReadModelStore.spec.ts` para usar el contract test**

Reemplazar el contenido actual de `apps/ledger/src/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store.spec.ts`:

```typescript
import { InMemoryReadModelStore } from './in-memory-read-model-store';
import {
  describeReadModelStoreContract,
} from '@ledger/shared-kernel/infrastructure/testing/read-model-store.contract';

describe('InMemoryReadModelStore', () => {
  describeReadModelStoreContract(async () => new InMemoryReadModelStore());
});
```

**Step 3: Ejecutar y confirmar que todos los tests del contrato pasan**

```bash
npx jest apps/ledger/src/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store.spec.ts --no-coverage
```
Esperado: PASS — 17 tests pasando.

**Step 4: Verificar que el `path alias` `@ledger/shared-kernel` resuelve desde `infrastructure/testing/`**

```bash
npx jest apps/ledger/src/shared-kernel/infrastructure/testing/read-model-store.contract.ts --no-coverage 2>&1 | Select-Object -First 5
```
Esperado: "No tests found" (el archivo es solo una función exportada, no tiene suite propia) — pero el import debe resolver sin errores de módulo.

---

### Tarea 2: Verificar que los tests del subsistema de proyecciones siguen pasando [X]

**Step 1: Ejecutar todos los tests del módulo `shared-kernel/infrastructure/adapters/read-model-store/`**

```bash
npx jest apps/ledger/src/shared-kernel/infrastructure/adapters/read-model-store/ --no-coverage
```
Esperado: PASS — solo el spec del in-memory (el de Postgres no existe, se agrega en `hu-0007`).

**Step 2: Ejecutar tests de projectors que dependen de `ReadModelStore`**

```bash
npx jest apps/ledger/src/accounts/infrastructure/projections/account-tree.projector.spec.ts --no-coverage
```
Esperado: PASS — 3 tests (apertura, renombre con propagación, cierre).

**Step 3: Ejecutar tests de dispatchers**

```bash
npx jest apps/ledger/src/shared-kernel/infrastructure/adapters/projection/ --no-coverage
```
Esperado: PASS — polling-dispatcher (2 tests, incluye AC-5), projection-rebuilder (1 test).

**Step 4: Ejecutar test del derivador `TransactionKindDeriver`**

```bash
npx jest apps/ledger/src/transactions/domain/derivation/transaction-kind.deriver.spec.ts --no-coverage
```
Esperado: PASS — 4 branches (EXPENSE, INCOME, TRANSFER, COMPOUND).

---

### Tarea 3: Run full test suite del ledger [X]

```bash
npx jest --select-projects apps/ledger --no-coverage
```
Esperado: PASS — toda la suite del ledger pasando, incluyendo los 17 tests nuevos del contract.

---

## Resumen de archivos

| Acción | Archivo |
|--------|---------|
| **Crear** | `apps/ledger/src/shared-kernel/infrastructure/testing/read-model-store.contract.ts` |
| **Modificar** | `apps/ledger/src/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store.spec.ts` |
| **Sin cambios** | Todo el resto del código de producción ya existe y está verificado por tests existentes |
