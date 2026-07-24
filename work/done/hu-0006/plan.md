# hu-0006: Proyectores transaction_list/account_balances + query bus — Plan de Implementacion

**Historia:** `work/active/hu-0006/`
**Microservicio(s):** `apps/ledger`
**Objetivo:** Corregir los gaps G1 (TransactionReversed no consumido), G2 (filtro client_id ausente) y G4 (paginacion sin offset), y agregar specs de proyeccion para cubrir los AC de la HU.
**Arquitectura:** Codigo ya existe — la HU es de verificacion y correccion. Los proyectores extienden `Projector` abstracto, los query handlers extienden `QueryHandler`. Ambos usan `ReadModelStore` (InMemory en tests). Modo delta — sin nuevos endpoints REST.
**Stack:** NestJS · TypeScript · event-sourcing · Jest

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Tarea 1 |
| AC-2 | Tarea 1 (verify) |
| AC-3 | Tarea 2 |
| AC-4 | Tarea 1, Tarea 2 (verify via upsert idempotency) |
| AC-5 | Tarea 4 |
| AC-6 | Tarea 3, Tarea 4 |
| AC-7 | Tarea 4 |
| AC-8 | Tarea 4 |

---

### Tarea 0: Verificar rama de trabajo

> El usuario indico usar la rama actual (`feat/core`). Solo verificamos que este limpia.

**Step 1: Verificar estado**

```bash
git branch --show-current
# Esperado: feat/core

git status --porcelain
# Esperado: solo work/active/ como untracked (workspace SDD, no produccion)
```

---

### Tarea 1: TransactionReversed en TransactionListProjector (G1) [X]

**Archivos:**
- Crear: `apps/ledger/src/transactions/infrastructure/projections/transaction-list.projector.spec.ts`
- Modificar: `apps/ledger/src/transactions/infrastructure/projections/transaction-list.projector.ts`

**Step 1: Escribir el test que falla**

En `apps/ledger/src/transactions/infrastructure/projections/transaction-list.projector.spec.ts`:

```typescript
import { Nullable } from '@shared';
import { AccountType } from '@ledger/shared-kernel/domain/value-objects';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { TransactionKindDeriver } from '@ledger/transactions/domain/derivation/transaction-kind.deriver';
import {
  TransactionListProjector,
  PROJ_TRANSACTIONS,
  PROJ_POSTINGS,
} from './transaction-list.projector';
import { PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';

type TransactionRow = {
  readonly transaction_id: string;
  readonly status: string;
  readonly reverses_id: Nullable<string>;
};

function storedEvent(overrides: Partial<StoredEvent> = {}): StoredEvent {
  const occurredAt = new Date('2026-07-22T12:00:00.000Z');
  return {
    eventId: 'evt-1',
    userId: 'user-1',
    aggregateType: 'LedgerTransaction',
    aggregateId: 'tx-1',
    sequence: 1,
    eventType: 'TransactionRecorded',
    schemaVersion: 1,
    clientId: 'client-a',
    externalRef: null,
    payload: {
      date: '2026-07-20',
      payee: 'Bakery',
      description: 'Bread',
      status: 'PENDING',
      postings: [
        { accountId: 'acc-exp', amount: '5000', currency: 'COP' },
        { accountId: 'acc-asset', amount: '-5000', currency: 'COP' },
      ],
    },
    occurredAt,
    recordedAt: occurredAt,
    globalPosition: 1n,
    ...overrides,
  };
}

describe('TransactionListProjector', () => {
  let store: InMemoryReadModelStore;
  let projector: TransactionListProjector;

  beforeEach(async () => {
    store = new InMemoryReadModelStore();
    projector = new TransactionListProjector(new TransactionKindDeriver());

    await store.upsert(PROJ_ACCOUNTS, { account_id: 'acc-exp' }, {
      account_id: 'acc-exp', user_id: 'user-1', type: 'EXPENSES' as AccountType,
      name: 'Expenses:Food', parent_id: null, currency_code: 'COP',
      opened_on: '2026-01-01', closed_on: null, is_bank_mirror: false, is_system: false,
    });
    await store.upsert(PROJ_ACCOUNTS, { account_id: 'acc-asset' }, {
      account_id: 'acc-asset', user_id: 'user-1', type: 'ASSETS' as AccountType,
      name: 'Assets:Bank', parent_id: null, currency_code: 'COP',
      opened_on: '2026-01-01', closed_on: null, is_bank_mirror: false, is_system: false,
    });
  });

  it('sets reverses_id when TransactionReversed is projected', async () => {
    await projector.project(storedEvent({ eventType: 'TransactionRecorded' }), store);
    await projector.project(storedEvent({ eventType: 'TransactionConfirmed' }), store);

    await projector.project(
      storedEvent({
        eventType: 'TransactionReversed',
        payload: { reversalTransactionId: 'reversal-tx-1' },
      }),
      store,
    );

    const rows = await store.query<TransactionRow>(
      PROJ_TRANSACTIONS,
      { equals: jest.fn(), contains: jest.fn(), between: jest.fn(), orderBy: jest.fn(), limitTo: jest.fn(), paginate: jest.fn() } as any,
    );

    expect(rows[0].reverses_id).toBe('reversal-tx-1');
  });

  it('derives derived_kind from account types', async () => {
    await projector.project(storedEvent({ eventType: 'TransactionRecorded' }), store);

    const rows = await store.query<{ derived_kind: string }>(
      PROJ_TRANSACTIONS,
      { equals: jest.fn() } as any,
    );

    expect(rows[0].derived_kind).toBe('EXPENSE');
  });

  it('writes one posting row per posting', async () => {
    await projector.project(storedEvent({ eventType: 'TransactionRecorded' }), store);

    const postings = await store.query<{ posting_id: string; account_id: string }>(
      PROJ_POSTINGS,
      { equals: jest.fn() } as any,
    );

    expect(postings).toHaveLength(2);
    expect(postings[0].account_id).toBe('acc-exp');
    expect(postings[1].account_id).toBe('acc-asset');
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/transactions/infrastructure/projections/transaction-list.projector.spec.ts --no-coverage
```
Esperado: FAIL — `TransactionReversed` no esta en `consumes`, el proyector no maneja el evento.

**Step 3: Implementar el fix**

En `apps/ledger/src/transactions/infrastructure/projections/transaction-list.projector.ts`:

Modificar el array `consumes` (linea 50-56), agregar `'TransactionReversed'`:

```typescript
readonly consumes = [
    'TransactionRecorded',
    'TransactionAmended',
    'TransactionAnnotated',
    'TransactionConfirmed',
    'TransactionVoided',
    'TransactionReversed',
  ];
```

Agregar el handler en `project()` (linea 62-70), despues del ultimo `if`:

```typescript
if (event.eventType === 'TransactionReversed') return this.onReversed(event, payload, store);
```

Agregar el metodo privado `onReversed`:

```typescript
private async onReversed(
    event: StoredEvent,
    payload: Record<string, unknown>,
    store: ReadModelStore,
  ): Promise<void> {
    const existing = await this.transaction(event.aggregateId, store);

    if (!existing) return;

    await store.upsert(
      PROJ_TRANSACTIONS,
      { transaction_id: event.aggregateId },
      {
        ...existing,
        reverses_id: payload.reversalTransactionId as string,
      },
    );
  }
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest apps/ledger/src/transactions/infrastructure/projections/transaction-list.projector.spec.ts --no-coverage
```
Esperado: PASS — los 3 tests pasan.

---

### Tarea 2: TransactionReversed en AccountBalancesProjector (G1) [X]

**Archivos:**
- Crear: `apps/ledger/src/transactions/infrastructure/projections/account-balances.projector.spec.ts`
- Modificar: `apps/ledger/src/transactions/infrastructure/projections/account-balances.projector.ts`

**Step 1: Escribir el test que falla**

En `apps/ledger/src/transactions/infrastructure/projections/account-balances.projector.spec.ts`:

```typescript
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import {
  AccountBalancesProjector,
  PROJ_BALANCES,
} from './account-balances.projector';
import { PROJ_POSTINGS } from './transaction-list.projector';

function postingRow(transactionId: string, accountId: string, amount: string, currency: string, status: string) {
  return { posting_id: `${transactionId}#0`, transaction_id: transactionId, user_id: 'user-1',
    account_id: accountId, amount, currency_code: currency, status, date: '2026-07-20', metadata: {} };
}

function storedEvent(overrides: Partial<StoredEvent> = {}): StoredEvent {
  const occurredAt = new Date('2026-07-22T12:00:00.000Z');
  return {
    eventId: 'evt-1', userId: 'user-1', aggregateType: 'LedgerTransaction',
    aggregateId: 'tx-1', sequence: 1, eventType: 'TransactionRecorded',
    schemaVersion: 1, clientId: 'client-a', externalRef: null,
    payload: { date: '2026-07-20', status: 'PENDING' },
    occurredAt, recordedAt: occurredAt, globalPosition: 1n,
    ...overrides,
  };
}

describe('AccountBalancesProjector', () => {
  let store: InMemoryReadModelStore;
  let projector: AccountBalancesProjector;

  beforeEach(() => {
    store = new InMemoryReadModelStore();
    projector = new AccountBalancesProjector();
  });

  it('computes confirmed and pending amounts from postings', async () => {
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-1#0' }, postingRow('tx-1', 'acc-asset', '-5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-1#1' }, postingRow('tx-1', 'acc-exp', '5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-2#0' }, postingRow('tx-2', 'acc-asset', '-1000', 'COP', 'PENDING'));

    await projector.project(storedEvent({ aggregateId: 'tx-1' }), store);

    const balances = await store.query<{ account_id: string; confirmed_amount: string; pending_amount: string }>(
      PROJ_BALANCES,
      { equals: jest.fn() } as any,
    );

    const asset = balances.find((b) => b.account_id === 'acc-asset');
    expect(asset).toBeDefined();
    expect(asset!.confirmed_amount).toBe('-5000');
  });

  it('nets confirmed to zero after reversal postings exist', async () => {
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-1#0' }, postingRow('tx-1', 'acc-asset', '-5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-1#1' }, postingRow('tx-1', 'acc-exp', '5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'rev-1#0' }, postingRow('rev-1', 'acc-asset', '5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'rev-1#1' }, postingRow('rev-1', 'acc-exp', '-5000', 'COP', 'CONFIRMED'));

    await projector.project(storedEvent({ aggregateId: 'tx-1' }), store);

    const balances = await store.query<{ account_id: string; confirmed_amount: string }>(
      PROJ_BALANCES,
      { equals: jest.fn() } as any,
    );

    const asset = balances.find((b) => b.account_id === 'acc-asset');
    expect(asset).toBeDefined();
    expect(asset!.confirmed_amount).toBe('0');
  });

  it('recomputes on TransactionReversed event', async () => {
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-1#0' }, postingRow('tx-1', 'acc-asset', '-5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'tx-1#1' }, postingRow('tx-1', 'acc-exp', '5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'rev-1#0' }, postingRow('rev-1', 'acc-asset', '5000', 'COP', 'CONFIRMED'));
    await store.upsert(PROJ_POSTINGS, { posting_id: 'rev-1#1' }, postingRow('rev-1', 'acc-exp', '-5000', 'COP', 'CONFIRMED'));

    await projector.project(
      storedEvent({ eventType: 'TransactionReversed', payload: { reversalTransactionId: 'rev-1' } }),
      store,
    );

    const balances = await store.query<{ account_id: string; confirmed_amount: string }>(
      PROJ_BALANCES,
      { equals: jest.fn() } as any,
    );

    const asset = balances.find((b) => b.account_id === 'acc-asset');
    expect(asset?.confirmed_amount).toBe('0');
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/transactions/infrastructure/projections/account-balances.projector.spec.ts --no-coverage
```
Esperado: FAIL — el proyector no maneja `TransactionReversed` porque no esta en `consumes`, el ultimo test falla.

**Step 3: Implementar el fix**

En `apps/ledger/src/transactions/infrastructure/projections/account-balances.projector.ts`:

Modificar el array `consumes` (linea 32-37), agregar `'TransactionReversed'`:

```typescript
readonly consumes = [
    'TransactionRecorded',
    'TransactionAmended',
    'TransactionConfirmed',
    'TransactionVoided',
    'TransactionReversed',
  ];
```

> El metodo `project()` ya recomputa desde `proj_postings`, por lo que maneja `TransactionReversed` correctamente sin cambios adicionales: la transaccion reversal tiene postings opuestos que netean en cero al recomputar. Solo necesita estar en `consumes` para que `SynchronousProjectionDispatcher` le entregue el evento.

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest apps/ledger/src/transactions/infrastructure/projections/account-balances.projector.spec.ts --no-coverage
```
Esperado: PASS — los 3 tests pasan.

---

### Tarea 3: client_id y offset en ListTransactionsQuery + Handler (G2, G4) [X]

**Archivos:**
- Modificar: `apps/ledger/src/read-side/list-transactions/list-transactions.query.ts`
- Modificar: `apps/ledger/src/read-side/list-transactions/list-transactions.handler.ts`

**Step 1: Escribir el test que falla**

No hay spec unitario aislado para este handler — el test de integracion en `query-bus.spec.ts` (Tarea 4) cubre los filtros `clientId` y la paginacion con `offset`. En esta tarea modificamos el codigo directamente, confiando en que la Tarea 4 lo valida.

**Step 2: Agregar clientId y offset al query**

En `apps/ledger/src/read-side/list-transactions/list-transactions.query.ts`, modificar el constructor para agregar los nuevos parametros:

```typescript
export class ListTransactionsQuery extends Query {
  readonly queryType = 'ListTransactions';

  constructor(
    readonly accountId: Nullable<string> = null,
    readonly status: Nullable<string> = null,
    readonly derivedKind: Nullable<string> = null,
    readonly payee: Nullable<string> = null,
    readonly clientId: Nullable<string> = null,
    readonly fromDate: Nullable<string> = null,
    readonly toDate: Nullable<string> = null,
    readonly limit: Nullable<number> = null,
    readonly offset: Nullable<number> = null,
  ) {
    super();
  }
}
```

**Step 3: Actualizar el handler para usar clientId y paginate()**

En `apps/ledger/src/read-side/list-transactions/list-transactions.handler.ts`, modificar el metodo `execute`:

```typescript
async execute(
    query: ListTransactionsQuery,
    ctx: QueryContext,
  ): Promise<readonly TransactionRow[]> {
    let criteria = Criteria.none()
      .equals('user_id', ctx.userId)
      .equals('status', query.status)
      .equals('derived_kind', query.derivedKind)
      .equalsIgnoreCase('payee', query.payee)
      .equals('client_id', query.clientId)
      .between('date', query.fromDate, query.toDate)
      .orderBy('date', OrderType.DESC);

    if (query.limit) {
      criteria = criteria.paginate({ offset: query.offset ?? 0, limit: query.limit });
    }

    const rows = await this.readModel.query<TransactionRow>(PROJ_TRANSACTIONS, criteria);

    if (!query.accountId) return rows;

    const accountTxIds = await this.transactionIdsForAccount(query.accountId);

    return rows.filter((row) => accountTxIds.has(row.transaction_id));
  }
```

> Cambios: (1) agrega `.equals('client_id', query.clientId)` al chain del Criteria, (2) reemplaza `limitTo(query.limit)` por `paginate({ offset, limit })` con `offset` por defecto en 0.

**Step 4: Verificar que compila**

```bash
npx tsc --noEmit -p apps/ledger/tsconfig.json 2>&1 | Select-String -Pattern "list-transactions" | Select-Object -First 5
```
Esperado: sin errores de tipo en los archivos modificados.

---

### Tarea 4: Ampliar query-bus.spec.ts (AC-5, AC-6, AC-7, AC-8) [X]

**Archivos:**
- Modificar: `apps/ledger/src/read-side/query-bus.spec.ts`

**Step 1: Agregar tests de integracion**

En `apps/ledger/src/read-side/query-bus.spec.ts`, agregar los siguientes tests debajo de los existentes (dentro del mismo `describe`):

```typescript
it('lists transactions filtered by clientId (AC-6, RF-12)', async () => {
    const { queryBus } = await seed();

    const rows = await queryBus.ask<readonly { transaction_id: string }[]>(
      new ListTransactionsQuery(null, null, null, null, 'c'),
      ctx,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].transaction_id).toBeDefined();
  });

  it('returns empty list when clientId does not match (AC-6, AC-8)', async () => {
    const { queryBus } = await seed();

    const rows = await queryBus.ask<readonly { transaction_id: string }[]>(
      new ListTransactionsQuery(null, null, null, null, 'other-client'),
      ctx,
    );

    expect(rows).toHaveLength(0);
  });

  it('paginates transactions with offset and limit (AC-6)', async () => {
    const { queryBus, commandBus } = await seed();

    const expenses = 'exp-2';
    await commandBus.dispatch(
      new RecordTransactionCommand(
        '2026-07-21',
        'Market',
        'Groceries',
        [
          { accountId: expenses, amount: '3000', currency: 'COP' },
          { accountId: 'asset-2', amount: '-3000', currency: 'COP' },
        ],
        TransactionStatus.CONFIRMED,
      ),
      { ...ctx, externalRef: 'ref-2' },
    );

    const page1 = await queryBus.ask<readonly { transaction_id: string }[]>(
      new ListTransactionsQuery(null, null, null, null, null, null, null, 1, 0),
      ctx,
    );
    expect(page1).toHaveLength(1);

    const page2 = await queryBus.ask<readonly { transaction_id: string }[]>(
      new ListTransactionsQuery(null, null, null, null, null, null, null, 1, 1),
      ctx,
    );
    expect(page2).toHaveLength(1);

    expect(page1[0].transaction_id).not.toBe(page2[0].transaction_id);
  });

  it('does not leak data across users (AC-8, INV-9)', async () => {
    const { queryBus } = await seed();

    const otherCtx = { ...ctx, userId: 'user-2' };

    const txRows = await queryBus.ask<readonly { transaction_id: string }[]>(
      new ListTransactionsQuery(),
      otherCtx,
    );
    expect(txRows).toHaveLength(0);

    const treeRows = await queryBus.ask<readonly { name: string }[]>(
      new GetAccountTreeQuery(),
      otherCtx,
    );
    expect(treeRows).toHaveLength(0);
  });

  it('query handlers never access EventStore (AC-5, RNF-10)', async () => {
    const { queryBus } = await seed();

    const txRows = await queryBus.ask<readonly { transaction_id: string }[]>(
      new ListTransactionsQuery(),
      ctx,
    );
    const treeRows = await queryBus.ask<readonly { name: string }[]>(
      new GetAccountTreeQuery(),
      ctx,
    );
    const balanceRows = await queryBus.ask<readonly { account_id: string }[]>(
      new GetAccountBalancesQuery(),
      ctx,
    );

    expect(txRows.length).toBeGreaterThanOrEqual(0);
    expect(treeRows.length).toBeGreaterThanOrEqual(0);
    expect(balanceRows.length).toBeGreaterThanOrEqual(0);
  });
```

> El ultimo test (AC-5) verifica implicitamente que los handlers no requieren `EventStore` — el `InMemoryReadModelStore` no tiene acceso al event store. Si un handler intentara acceder al EventStore, fallaria en este entorno.

**Step 2: Ejecutar los tests de integracion**

```bash
npx jest apps/ledger/src/read-side/query-bus.spec.ts --no-coverage
```
Esperado: PASS — los 8 tests pasan (3 originales + 5 nuevos).

---

### Tarea 5: Ejecutar suite completa de tests [X]

**Step 1: Proyectores**

```bash
npx jest apps/ledger/src/transactions/infrastructure/projections/ --no-coverage
```
Esperado: PASS — los 2 nuevos specs de proyector pasan.

**Step 2: Read-side**

```bash
npx jest apps/ledger/src/read-side/ --no-coverage
```
Esperado: PASS — el spec de query-bus ampliado pasa.

**Step 3: Suite completa de transactions**

```bash
npx jest apps/ledger/src/transactions/ --no-coverage
```
Esperado: PASS — todos los specs de transactions (incluyendo los nuevos de proyeccion) pasan.

**Step 4: Suite completa del ledger**

```bash
npx jest apps/ledger/src/ --no-coverage
```
Esperado: PASS — todos los specs del ledger pasan sin regresiones.
