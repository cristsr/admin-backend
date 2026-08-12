# hu-0026: Fecha efectiva elegible en la reversa — Plan de Implementación

**Historia:** `work/active/hu-0026/`
**Componente(s):** `apps/ledger` (módulos `transactions` y `shared`)
**Objetivo:** Hacer elegible la fecha contable de la reversa de una transacción confirmada
(`atEffectiveDate: boolean`, default `true`) y darle a la doble reversa su propio código de
error estable (`TRANSACTION_ALREADY_REVERSED`).
**Arquitectura:** La fecha se decide en un único lugar — el agregado. `LedgerTransaction.reverse(reversalId, atEffectiveDate, clock)`
resuelve la fecha (original o `LedgerDate.today(clock)`) dentro del `ReversalPlan` que ya
devolvía y que hasta ahora el handler descartaba; una factory nueva,
`LedgerTransaction.fromReversalPlan(plan, balance)`, construye T2 a partir de ese plan. El
handler pasa a recibir un `Clock` (mismo puerto que ya usa `ConfirmTransactionHandler`) y a
usar ambos métodos en vez de reconstruir la reversa a mano. Ningún evento cambia de esquema
(Artículo 9 no se activa) y no hay tabla ni proyección nueva.
**Stack:** TypeScript · NestJS · event-sourcing (sin ORM en este flujo) · PostgreSQL · Jest (`*.spec.ts`)

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Tarea 1, Tarea 3, Tarea 4, Tarea 7 |
| AC-2 | Tarea 9 |
| AC-3 | Tarea 2, Tarea 3, Tarea 8 |
| AC-4 | Tarea 6, Tarea 7 |
| AC-5 | Tarea 4, Tarea 7 |

> `AC-2` (efecto documentado sobre `§7.3`) y los flujos/`api.yaml` del módulo **no** los edita
> este plan salvo `docs/ledger-spec.md` (Tarea 9): `apps/ledger/docs/transactions/flows/reverse-transaction.md`
> y `apps/ledger/docs/transactions/api.yaml` ya están escritos como delta por `/design`
> (`work/active/hu-0026/docs/`) y los reconcilia `/sync` — no se tocan a mano durante el build.

---

### Tarea 0: Preparar rama de trabajo [X]

**Preguntar:** "¿Cuál es el nombre de la rama? (ej: `feat/hu-0026-effective-date-reversal`)"

**Step 1: Verificar que la base esté fresca (read-only)**

```bash
git branch --show-current
git status --porcelain
```
Esperado: rama de trabajo (`feat/core` u otra ya en curso), working tree limpio. Preparar
`develop` (`checkout` + `pull`) es de `/prepare`, no de este plan — si la base luce vieja,
recomendar `/prepare hu-0026` antes de continuar.

**Step 2: Crear rama de trabajo**

```bash
git checkout -b <nombre-de-rama-dado-por-usuario>
```
Esperado: rama nueva creada y activa.

---

### Tarea 1: `LedgerDate.today(clock)` [X]

Punto único donde se resuelve «hoy» como día calendario (decisión de `docs/research.md`):
UTC, truncando el instante del `Clock` a `YYYY-MM-DD`.

**Archivos:**
- Modificar: `apps/ledger/src/shared/domain/value-objects/ledger-date.ts`
- Test: `apps/ledger/src/shared/domain/value-objects/ledger-date.spec.ts`

**Step 1: Escribir el test que falla**

En `ledger-date.spec.ts`, agregar un `import { FixedClock } from '@ledger/shared/testing';` al
tope y un test nuevo dentro del `describe('LedgerDate', ...)`:

```typescript
  it('builds today from a Clock, truncated to the calendar day in UTC', () => {
    const clock = new FixedClock(new Date('2026-07-22T23:45:00.000Z'));

    expect(LedgerDate.today(clock).value).toBe('2026-07-22');
  });
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/shared/domain/value-objects/ledger-date.spec.ts --no-coverage
```
Esperado: FAIL — `TypeError: LedgerDate.today is not a function`.

**Step 3: Implementar el mínimo código**

En `ledger-date.ts`, agregar el método estático junto a `of`:

```typescript
  /** Today's calendar day, derived from `clock`. Always UTC (Artículo 8, sin excepción). */
  static today(clock: Clock): LedgerDate {
    return LedgerDate.of(clock.now().toISOString().slice(0, 10));
  }
```

Y el import correspondiente al tope del archivo:

```typescript
import { Clock } from '@cqrs/domain/ports';
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest apps/ledger/src/shared/domain/value-objects/ledger-date.spec.ts --no-coverage
```
Esperado: PASS.

---

### Tarea 2: `TransactionAlreadyReversedException` [X]

Sigue exactamente el precedente de `PersistenceConflictException` (hu-0025): excepción
pequeña con su propia spec puntual, antes de que el agregado la use.

**Archivos:**
- Modificar: `apps/ledger/src/transactions/domain/transaction/exceptions/transaction.exception.ts`
- Test: `apps/ledger/src/transactions/domain/transaction/exceptions/transaction.exception.spec.ts` (nuevo)

**Step 1: Escribir el test que falla**

```typescript
import { TransactionAlreadyReversedException } from './transaction.exception';

describe('TransactionAlreadyReversedException', () => {
  it('carries the stable TRANSACTION_ALREADY_REVERSED code', () => {
    const error = new TransactionAlreadyReversedException('already reversed');

    expect(error.code).toBe('TRANSACTION_ALREADY_REVERSED');
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/transactions/domain/transaction/exceptions --no-coverage
```
Esperado: FAIL — `TransactionAlreadyReversedException` no existe.

**Step 3: Implementar el mínimo código**

En `transaction.exception.ts`, agregar al final del archivo (mismo patrón que
`InvalidTransactionStateException`):

```typescript
/**
 * The transaction already has a linked reversal (Artículo 3: no hay segunda reversa).
 * Antes de hu-0026 este caso caía en `InvalidTransactionStateException`; ahora tiene su
 * propio código para que el cliente lo distinga de "no está CONFIRMED".
 */
export class TransactionAlreadyReversedException extends DomainConflictException {
  readonly code: string = 'TRANSACTION_ALREADY_REVERSED';
}
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest apps/ledger/src/transactions/domain/transaction/exceptions --no-coverage
```
Esperado: PASS.

---

### Tarea 3: `LedgerTransaction.reverse()` elige la fecha + factory `fromReversalPlan` [X]

El punto de cambio del agregado. `reverse()` gana los parámetros `atEffectiveDate` y `clock`,
resuelve la fecha dentro del `ReversalPlan`, y lanza el código nuevo ante doble reversa.
`fromReversalPlan` construye T2 a partir de ese plan — hace que el `ReversalPlan` deje de ser
código muerto (decisión consultada de `/clarify`).

**Archivos:**
- Modificar: `apps/ledger/src/transactions/domain/transaction/ledger-transaction.aggregate.ts`
- Test: `apps/ledger/src/transactions/domain/transaction/ledger-transaction.aggregate.spec.ts`

**Step 1: Escribir los tests que fallan**

En `ledger-transaction.aggregate.spec.ts`, agregar `FixedClock` al import ya existente de
`@ledger/shared/testing` (ya trae `SequentialIdGenerator`, `aMoney` — el archivo no importa hoy
`FixedClock`, así que sumarlo) y `TransactionAlreadyReversedException` al import de
`./exceptions/transaction.exception`. Reescribir el bloque de tests de `reverse` (líneas
137-157 actuales) por:

```typescript
  it('reverses at the original date when atEffectiveDate is true', () => {
    const tx = LedgerTransaction.record(
      recordArgs({ date: LedgerDate.of('2026-07-10'), initialStatus: TransactionStatus.CONFIRMED }),
      balance,
      idGen,
    );
    tx.pullChanges();

    const plan = tx.reverse('rev-1', true, clock);

    expect(plan.reversalId).toBe('rev-1');
    expect(plan.sourceTransactionId).toBe(tx.id);
    expect(plan.date.value).toBe('2026-07-10');
    expect(plan.postings[0].amount.toDecimalString()).toBe('-31900');
    expect(plan.postings[1].amount.toDecimalString()).toBe('31900');
  });

  it('reverses at today (UTC) when atEffectiveDate is false', () => {
    const tx = LedgerTransaction.record(
      recordArgs({ date: LedgerDate.of('2026-07-10'), initialStatus: TransactionStatus.CONFIRMED }),
      balance,
      idGen,
    );
    tx.pullChanges();

    const plan = tx.reverse('rev-1', false, clock);

    // clock está fijado en '2026-07-22T12:00:00.000Z' al tope del archivo.
    expect(plan.date.value).toBe('2026-07-22');
  });

  it('does not reverse a PENDING transaction', () => {
    const tx = LedgerTransaction.record(recordArgs(), balance, idGen);

    expect(() => tx.reverse('rev-1', true, clock)).toThrow(InvalidTransactionStateException);
  });

  it('rejects a second reversal with the stable TRANSACTION_ALREADY_REVERSED code', () => {
    const tx = LedgerTransaction.record(
      recordArgs({ initialStatus: TransactionStatus.CONFIRMED }),
      balance,
      idGen,
    );
    tx.pullChanges();
    tx.reverse('rev-1', true, clock);

    expect(() => tx.reverse('rev-2', true, clock)).toThrow(TransactionAlreadyReversedException);
  });

  it('builds the reversing transaction from the plan (fromReversalPlan)', () => {
    const tx = LedgerTransaction.record(
      recordArgs({ date: LedgerDate.of('2026-07-10'), initialStatus: TransactionStatus.CONFIRMED }),
      balance,
      idGen,
    );
    tx.pullChanges();
    const plan = tx.reverse('rev-1', false, clock);

    const reversing = LedgerTransaction.fromReversalPlan(plan, balance);
    const [event] = reversing.pullChanges();

    expect(reversing.id).toBe('rev-1');
    expect(reversing.status).toBe(TransactionStatus.CONFIRMED);
    expect(reversing.date.value).toBe('2026-07-22');
    expect(reversing.postings).toEqual(plan.postings);
    expect(event).toBeInstanceOf(TransactionRecorded);
    expect((event as TransactionRecorded).props.metadata).toEqual({ reverses_id: tx.id });
    expect((event as TransactionRecorded).props.description).toBe(`Reversal of ${tx.id}`);
  });
```

`TransactionRecorded` no está importado hoy en este spec — agregar
`import { TransactionRecorded, TransfersMerged } from './events';` (ya importa
`TransfersMerged`; sumar `TransactionRecorded` al mismo import).

**Step 2: Ejecutar y confirmar que fallan**

```bash
npx jest apps/ledger/src/transactions/domain/transaction/ledger-transaction.aggregate.spec.ts --no-coverage
```
Esperado: FAIL — `reverse` sigue aceptando un solo argumento y `fromReversalPlan` no existe.

**Step 3: Implementar**

En `ledger-transaction.aggregate.ts`:

1. Agregar el import de `Clock` (ya se importa `IdGenerator` desde `@cqrs/domain/ports`; sumar
   `Clock` al mismo import) y el de la excepción nueva:

```typescript
import { Clock, IdGenerator } from '@cqrs/domain/ports';
```
```typescript
import {
  ImmutableTransactionException,
  InsufficientPostingsException,
  InvalidTransactionStateException,
  TransactionAlreadyReversedException,
} from './exceptions/transaction.exception';
```

2. Reescribir `reverse()` (líneas 162-187 actuales):

```typescript
  /**
   * Reverses a CONFIRMED transaction. `atEffectiveDate` chooses T2's accounting
   * date: `true` the original's date (corrects the historical balance), `false`
   * today (leaves it intact) — hu-0026. Emits {@link TransactionReversed} here
   * and returns a {@link ReversalPlan} the handler records via
   * {@link LedgerTransaction.fromReversalPlan} as the linked reversing
   * transaction (metadata `reverses_id`).
   */
  reverse(reversalId: string, atEffectiveDate: boolean, clock: Clock): ReversalPlan {
    if (this.txStatus !== TransactionStatus.CONFIRMED) {
      throw new InvalidTransactionStateException(
        `Only CONFIRMED transactions can be reversed; this one is ${this.txStatus}`,
      );
    }

    if (this.reversed) {
      throw new TransactionAlreadyReversedException(`Transaction "${this.id}" is already reversed`);
    }

    this.raise(new TransactionReversed(reversalId));

    return {
      reversalId,
      sourceTransactionId: this.id,
      date: atEffectiveDate ? this.txDate : LedgerDate.today(clock),
      postings: this.txPostings.map((posting) => posting.negated()),
      description: `Reversal of ${this.id}`,
    };
  }

  /**
   * Builds the linked reversing transaction from a {@link ReversalPlan} — the
   * contract {@link LedgerTransaction.reverse} returns. Always records CONFIRMED,
   * with `metadata.reverses_id` pointing back to the source (hu-0026).
   */
  static fromReversalPlan(plan: ReversalPlan, balance: BalanceRule): LedgerTransaction {
    return LedgerTransaction.record(
      {
        date: plan.date,
        payee: null,
        description: plan.description,
        postings: plan.postings,
        initialStatus: TransactionStatus.CONFIRMED,
        invoiceUrl: null,
        tags: [],
        metadata: { reverses_id: plan.sourceTransactionId },
      },
      balance,
      { next: () => plan.reversalId },
    );
  }
```

> `fromReversalPlan` no recibe un `IdGenerator` real: `LedgerTransaction.record` ya toma
> `idGenerator.next()` para fijar el id, y acá el id **ya está decidido** por el plan
> (`plan.reversalId`, generado por el handler antes de llamar a `reverse()`). Pasar un objeto
> literal `{ next: () => plan.reversalId }` que satisface la interfaz `IdGenerator` es más
> simple que agregar un parámetro de id opcional a `record()` — evaluado y descartado en
> `docs/research.md` (opción 2).

**Step 4: Ejecutar y confirmar que pasan**

```bash
npx jest apps/ledger/src/transactions/domain/transaction/ledger-transaction.aggregate.spec.ts --no-coverage
```
Esperado: PASS.

---

### Tarea 4: `ReverseConfirmedTransactionCommand` + `ReverseConfirmedTransactionHandler` [X]

El command gana `atEffectiveDate: boolean` **requerido** (no opcional con default en el
constructor — decisión de `docs/research.md`: el default se resuelve en el controller para que
el hash de idempotencia sea siempre estable). El handler recibe un `Clock` (mismo puerto que ya
usa `ConfirmTransactionHandler`) y pasa a usar `reverse()` + `fromReversalPlan()` en vez de
reconstruir la reversa a mano.

**Archivos:**
- Modificar: `apps/ledger/src/transactions/application/usecases/reverse-transaction/reverse-confirmed-transaction.command.ts`
- Modificar: `apps/ledger/src/transactions/application/usecases/reverse-transaction/reverse-confirmed-transaction.handler.ts`
- Test: `apps/ledger/src/transactions/application/usecases/reverse-transaction/reverse-confirmed-transaction.handler.spec.ts`

**Step 1: Escribir los tests que fallan**

En `reverse-confirmed-transaction.handler.spec.ts`:

1. Agregar el import de `FixedClock` (ya importa `SequentialIdGenerator, aMoney` de
   `@ledger/shared/testing`; sumar `FixedClock` al mismo import) y de `LedgerDate` (ya
   importado para el bloque de atomicidad; usarlo también en el mock del bloque superior).

2. Actualizar `makeTransaction()` (líneas 58-76) para que `reverse` devuelva un
   `ReversalPlan` válido en vez de `jest.fn()` sin retorno, y agregar un `clock` al `setup()`:

```typescript
function makeTransaction(id: string) {
  const postings = [
    { accountId: 'acc-1', amount: '50000', negated: () => ({ accountId: 'acc-1', amount: '-50000' }) },
    { accountId: 'acc-2', amount: '-50000', negated: () => ({ accountId: 'acc-2', amount: '50000' }) },
  ];

  return {
    id,
    date: LedgerDate.of('2026-07-20'),
    postings,
    reverse: jest.fn((reversalId: string, atEffectiveDate: boolean, clock: { now: () => Date }) => ({
      reversalId,
      sourceTransactionId: id,
      date: atEffectiveDate ? LedgerDate.of('2026-07-20') : LedgerDate.of(clock.now().toISOString().slice(0, 10)),
      postings: postings.map((p) => p.negated()),
      description: `Reversal of ${id}`,
    })),
  };
}
```

3. En `setup()`, agregar `const clock = new FixedClock(new Date('2026-07-22T10:00:00.000Z'));`
   y pasarlo al constructor del handler:

```typescript
  const handler = new ReverseConfirmedTransactionHandler(
    transactions,
    balance,
    idGenerator,
    dispatcher,
    eventStore,
    clock,
  );

  return { handler, transactions, dispatcher, clock };
```

4. Actualizar las **7** construcciones existentes de `new ReverseConfirmedTransactionCommand('tx-1')`
   / `('non-existent')` / `(originalId)` para pasar el segundo argumento `true` (preserva el
   comportamiento previo a hu-0026, que es lo que esos tests verifican):

```typescript
new ReverseConfirmedTransactionCommand('tx-1', true)
```
(y análogamente en cada una de las otras 6 apariciones del archivo — `'non-existent'`,
`originalId` en el bloque de atomicidad cross-stream, etc. Ninguna cambia de semántica, solo
gana el segundo argumento.)

5. En el test `'should reverse a CONFIRMED transaction and return reversing id'` (líneas
   79-91), agregar la aserción de que `atEffectiveDate` y `clock` llegan a `tx.reverse`:

```typescript
    expect(tx.reverse).toHaveBeenCalledWith('rev-id-1', true, clock);
```

6. Agregar dos tests nuevos, después del bloque existente (antes del `describe` de atomicidad
   cross-stream):

```typescript
  it('threads atEffectiveDate: false through to the aggregate', async () => {
    const { handler, transactions, clock } = setup();
    const tx = makeTransaction('tx-1');
    transactions.load.mockResolvedValue(tx as never);
    transactions.save.mockResolvedValue({ events: [], version: 2, lastPosition: 8n });

    await handler.execute(new ReverseConfirmedTransactionCommand('tx-1', false), ctx);

    expect(tx.reverse).toHaveBeenCalledWith('rev-id-1', false, clock);
  });

  it('propagates TRANSACTION_ALREADY_REVERSED when the aggregate rejects a second reversal', async () => {
    const { handler, transactions } = setup();
    const tx = makeTransaction('tx-1');
    tx.reverse.mockImplementation(() => {
      throw new TransactionAlreadyReversedException('already reversed');
    });
    transactions.load.mockResolvedValue(tx as never);

    await expect(
      handler.execute(new ReverseConfirmedTransactionCommand('tx-1', true), ctx),
    ).rejects.toBeInstanceOf(TransactionAlreadyReversedException);
  });
```

Agregar `TransactionAlreadyReversedException` al import ya existente de
`./exceptions/transaction.exception` — wait, ese import en el handler.spec.ts viene de
`@ledger/transactions/domain/transaction/exceptions/transaction.exception` (ver el import
existente de `ImmutableTransactionException, TransactionNotFoundException` al tope del
archivo); sumar `TransactionAlreadyReversedException` ahí.

7. En el bloque de atomicidad cross-stream (a partir de la línea ~151), el `setup()` local de
   ese `describe` construye el handler directamente (líneas 201-207) sin `clock` — agregarlo:

```typescript
    handler = new ReverseConfirmedTransactionHandler(
      transactions,
      balanceRule,
      ids,
      { dispatch: jest.fn().mockResolvedValue(undefined) },
      eventStore,
      new FixedClock(new Date('2026-07-22T10:00:00.000Z')),
    );
```

Y actualizar las 2 construcciones de `new ReverseConfirmedTransactionCommand(originalId)` en
ese bloque a `new ReverseConfirmedTransactionCommand(originalId, true)`.

**Step 2: Ejecutar y confirmar que fallan**

```bash
npx jest apps/ledger/src/transactions/application/usecases/reverse-transaction/reverse-confirmed-transaction.handler.spec.ts --no-coverage
```
Esperado: FAIL — el constructor del command exige un segundo argumento, el del handler exige
`clock`, y `reverse()` real (bloque de atomicidad) exige los tres argumentos nuevos.

**Step 3: Implementar**

En `reverse-confirmed-transaction.command.ts`:

```typescript
import { Command } from '@cqrs/application/command-bus/command';

/** Reverses a CONFIRMED transaction via a linked reversing transaction. */
export class ReverseConfirmedTransactionCommand extends Command {
  readonly commandType = 'ReverseConfirmedTransaction';

  constructor(
    readonly transactionId: string,
    /**
     * `true`: T2 nace con la fecha de la original (corrige el histórico).
     * `false`: T2 nace con la fecha de hoy. Requerido (no opcional): el default
     * lo resuelve el controller para que el hash de idempotencia sea siempre
     * estable — hu-0026 (AC-5).
     */
    readonly atEffectiveDate: boolean,
  ) {
    super();
  }
}
```

En `reverse-confirmed-transaction.handler.ts`, reescribir el archivo completo:

```typescript
import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { Clock, IdGenerator } from '@cqrs/domain/ports';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { LedgerTransactionRepository } from '@ledger/transactions/application/repositories/ledger-transaction.repository';
import { BalanceRule } from '@ledger/transactions/domain/balance/balance-rule';
import { TransactionNotFoundException } from '@ledger/transactions/domain/transaction/exceptions/transaction.exception';
import { LedgerTransaction } from '@ledger/transactions/domain/transaction/ledger-transaction.aggregate';
import { ReverseConfirmedTransactionCommand } from './reverse-confirmed-transaction.command';

/**
 * Reverses a confirmed transaction. Records the linked reversing transaction
 * (inverted postings, `reverses_id` metadata, CONFIRMED) and emits
 * {@link TransactionReversed} on the original — a single audited write path.
 * The original stream is the idempotency anchor; the reversing append carries
 * no external_ref (anchor-only stamping).
 *
 * `atEffectiveDate` (hu-0026) is resolved entirely by the aggregate: `reverse()`
 * returns a `ReversalPlan` with the date already chosen, and
 * `LedgerTransaction.fromReversalPlan` builds T2 from it — the handler only
 * orchestrates, it never picks the date itself (single source of truth,
 * `docs/rules.md` §Reglas de Negocio de hu-0026).
 *
 * The two appends land on different streams, so both run inside
 * `EventStore.withTransaction` (INV-7): a process dying between them would
 * leave the original marked as reversed with no reversing transaction to
 * offset it — visible data loss, not a recoverable intermediate state.
 * Projection dispatch stays outside the scope: read models are rebuildable,
 * so a projector failure must not roll back the accounting facts.
 */
export class ReverseConfirmedTransactionHandler extends CommandHandler<ReverseConfirmedTransactionCommand> {
  constructor(
    private readonly transactions: LedgerTransactionRepository,
    private readonly balance: BalanceRule,
    private readonly idGenerator: IdGenerator,
    private readonly dispatcher: ProjectionDispatcher,
    private readonly eventStore: EventStore,
    private readonly clock: Clock,
  ) {
    super();
  }

  async execute(
    command: ReverseConfirmedTransactionCommand,
    ctx: AuthContext,
  ): Promise<CommandResult> {
    const original = await this.transactions.load(ctx.userId, command.transactionId);

    if (!original) {
      throw new TransactionNotFoundException(`Transaction "${command.transactionId}" not found`);
    }

    const reversalId = this.idGenerator.next();
    // Guarded by the aggregate: only CONFIRMED, not-yet-reversed transactions
    // reach this point; it resolves atEffectiveDate into the plan's date.
    const plan = original.reverse(reversalId, command.atEffectiveDate, this.clock);
    const reversing = LedgerTransaction.fromReversalPlan(plan, this.balance);

    const anchorless: AuthContext = { ...ctx, externalRef: null };
    const { originalResult, reversingResult } = await this.eventStore.withTransaction(async () => {
      const originalResult = await this.transactions.save(original, ctx);
      const reversingResult = await this.transactions.save(reversing, anchorless);

      return { originalResult, reversingResult };
    });

    await this.dispatcher.dispatch([...originalResult.events, ...reversingResult.events]);

    return {
      aggregateId: reversing.id,
      streamPosition: reversingResult.lastPosition,
      idempotentReplay: false,
    };
  }
}
```

> `idGenerator.next()` ahora se llama **antes** de `reverse()` (no dentro de
> `LedgerTransaction.record`, que ya no lo recibe): el id de la reversa lo decide el handler y
> se lo pasa al plan a través de `reversalId`, exactamente como antes generaba el id de
> `reversing` — solo cambia el orden.

**Step 4: Ejecutar y confirmar que pasan**

```bash
npx jest apps/ledger/src/transactions/application/usecases/reverse-transaction/reverse-confirmed-transaction.handler.spec.ts --no-coverage
```
Esperado: PASS.

---

### Tarea 5: Wiring — `Clock` en la composition root [X]

El handler gana una dependencia; cablearla donde ya se registra
(`ledger-application.factory.ts`, que ya destructura `clock` de `deps` y lo usa en
`ConfirmTransactionHandler`). Actualizar también el único test e2e que construye el command
directamente.

**Archivos:**
- Modificar: `apps/ledger/src/bootstrap/ledger-application.factory.ts:206-215`
- Modificar: `apps/ledger/src/bootstrap/ledger-application.spec.ts:326`

**Step 1: Escribir el test que falla**

En `ledger-application.spec.ts`, línea 326 (dentro de `'reverses a confirmed transaction with a
linked reversing transaction'`), agregar el segundo argumento:

```typescript
    const reversal = await bus.dispatch(
      new ReverseConfirmedTransactionCommand(recorded.aggregateId, true),
      ctx(),
    );
```

Esto por sí solo ya rompe la compilación de la suite (el command ahora exige el segundo
argumento) — no hace falta un test nuevo, la migración del call-site es lo que este paso
verifica.

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/bootstrap/ledger-application.spec.ts --no-coverage
```
Esperado: FAIL — `createLedgerApplication` sigue instanciando
`ReverseConfirmedTransactionHandler` con 5 argumentos; falta `clock`.

**Step 3: Implementar**

En `ledger-application.factory.ts`, líneas 206-215, agregar `clock` al final de la
construcción del handler:

```typescript
  commandBus.register(
    ReverseConfirmedTransactionCommand,
    new ReverseConfirmedTransactionHandler(
      transactions,
      balance,
      idGenerator,
      dispatcher,
      eventStore,
      clock,
    ),
  );
```

(`clock` ya está en scope: es la misma variable desestructurada de `deps` en la línea 112, ya
usada por `InitializeLedgerHandler` y `ConfirmTransactionHandler` más arriba en este archivo.)

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest apps/ledger/src/bootstrap/ledger-application.spec.ts --no-coverage
```
Esperado: PASS.

---

### Tarea 6: `ReverseTransactionRequestDto` — campo `atEffectiveDate` [X]

DTO puro (sin test unitario dedicado, mismo criterio que `dryRun` en el mismo archivo): la
validación de comportamiento vive en el test del controller (Tarea 7).

**Archivos:**
- Modificar: `apps/ledger/src/transactions/infrastructure/adapters/http/dto/reverse-transaction-request.dto.ts`
- Test: (sin test unitario para DTOs puros — cubierto por Tarea 7)

**Step 1: Implementar**

```typescript
import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Body of `POST /transactions/{id}/reverse`. Valid only on a `CONFIRMED`
 * transaction; the response carries the id of the newly created reversal.
 */
export class ReverseTransactionRequestDto {
  @ApiPropertyOptional({ example: 'Refunded by the merchant' })
  @IsOptional()
  @IsString()
  readonly reason?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'hu-0026: true (default) — T2 nace con la fecha de la original, corrige el histórico. false — T2 nace con la fecha de hoy, deja el histórico intacto.',
  })
  @IsOptional()
  @IsBoolean()
  readonly atEffectiveDate?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Preview mode (hu-0025): execute the command fully inside the transaction and roll back, returning the result the real run would have produced.' })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;
}
```

Orden de campos: `reason`, `atEffectiveDate`, `dryRun` — coincide con el orden de
`ReverseTransactionRequest` en `work/active/hu-0026/docs/api.delta.yaml`.

**Step 2: Verificar que el módulo sigue compilando**

```bash
npx jest apps/ledger/src/transactions/infrastructure/adapters/http --no-coverage
```
Esperado: PASS (sin fallas nuevas — el controller todavía no lee el campo; eso es la Tarea 7).

---

### Tarea 7: `TransactionsController.reverse` — propagar `atEffectiveDate` con default [X]

**Archivos:**
- Modificar: `apps/ledger/src/transactions/infrastructure/adapters/http/transactions.controller.ts`
- Test: `apps/ledger/src/transactions/infrastructure/adapters/http/transactions.controller.spec.ts`

**Step 1: Escribir los tests que fallan**

En `transactions.controller.spec.ts`, extender el test existente
`'dispatches ReverseConfirmedTransactionCommand and returns the reversal result'` (líneas
97-107) y agregar uno nuevo justo después:

```typescript
  it('dispatches ReverseConfirmedTransactionCommand and returns the reversal result', async () => {
    const reversal: CommandResult = { aggregateId: 'tx-rev', streamPosition: 8n, idempotentReplay: false };
    commandBus.dispatch.mockResolvedValue(reversal);

    const returned = await controller.reverse(context, null, 'tx-6', { reason: 'refund' });

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(ReverseConfirmedTransactionCommand);
    expect(command).toMatchObject({ transactionId: 'tx-6', atEffectiveDate: true });
    expect(returned).toBe(reversal);
  });

  it('propagates atEffectiveDate: false when the client sends it explicitly', async () => {
    const reversal: CommandResult = { aggregateId: 'tx-rev', streamPosition: 9n, idempotentReplay: false };
    commandBus.dispatch.mockResolvedValue(reversal);

    await controller.reverse(context, null, 'tx-7', { atEffectiveDate: false });

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toMatchObject({ transactionId: 'tx-7', atEffectiveDate: false });
  });
```

**Step 2: Ejecutar y confirmar que fallan**

```bash
npx jest apps/ledger/src/transactions/infrastructure/adapters/http/transactions.controller.spec.ts --no-coverage
```
Esperado: FAIL — el `command` sigue construyéndose con un solo argumento (`atEffectiveDate`
llega `undefined`, no `true`/`false`), y `TypeScript` ya marca el constructor con aridad
incorrecta.

**Step 3: Implementar**

En `transactions.controller.ts`, reescribir el método `reverse` (líneas 200-210):

```typescript
  @Post(':id/reverse')
  @ApiOperation({ summary: 'Reverse a confirmed transaction; returns the reversal id.' })
  @ApiCreatedResponse({ type: CommandAcceptedDto })
  reverse(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() dto: ReverseTransactionRequestDto,
  ): Promise<CommandResult> {
    const command = new ReverseConfirmedTransactionCommand(id, dto.atEffectiveDate ?? true);

    return this.dispatch(command, context, externalRef, dto);
  }
```

(El parámetro pasa de `_dto` a `dto`: hasta ahora se ignoraba entero — solo `reason` seguía sin
usarse, gap ya documentado y fuera de alcance — pero `atEffectiveDate` sí se lee.)

**Step 4: Ejecutar y confirmar que pasan**

```bash
npx jest apps/ledger/src/transactions/infrastructure/adapters/http/transactions.controller.spec.ts --no-coverage
```
Esperado: PASS.

---

### Tarea 8: `TRANSACTION_ALREADY_REVERSED` en el catálogo + contract test de mapeo [X]

Mismo patrón exacto que hu-0025 (Tarea 13 de `work/done/hu-0025/plan.md`): la fila del
contract test primero, el código en el catálogo después.

**Archivos:**
- Modificar: `apps/ledger/src/shared/domain/errors/ledger-error-code.ts`
- Modificar: `apps/ledger/src/shared/infrastructure/adapters/http/ledger-error-code-mapping.spec.ts`

**Step 1: Escribir el test que falla**

En `ledger-error-code-mapping.spec.ts`, agregar `TransactionAlreadyReversedException` al
import ya existente de
`@ledger/transactions/domain/transaction/exceptions/transaction.exception` (junto a
`ImmutableTransactionException, TransactionNotFoundException, UnbalancedTransactionException`),
y agregar una fila a la tabla `cases` (justo después de la de `ImmutableTransactionException`,
línea 60):

```typescript
    [new TransactionAlreadyReversedException('already reversed'), HttpStatus.CONFLICT, LEDGER_ERROR_CODE.TRANSACTION_ALREADY_REVERSED],
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/shared/infrastructure/adapters/http/ledger-error-code-mapping.spec.ts --no-coverage
```
Esperado: FAIL — `LEDGER_ERROR_CODE.TRANSACTION_ALREADY_REVERSED` es `undefined`.

**Step 3: Implementar**

En `ledger-error-code.ts`, en el grupo `// Transactions` (junto a `INVALID_TRANSACTION_STATE`):

```typescript
  // Transactions
  UNBALANCED_TRANSACTION: 'UNBALANCED_TRANSACTION',
  INSUFFICIENT_POSTINGS: 'INSUFFICIENT_POSTINGS',
  IMMUTABLE_TRANSACTION: 'IMMUTABLE_TRANSACTION',
  INVALID_TRANSACTION_STATE: 'INVALID_TRANSACTION_STATE',
  /** hu-0026: reversar dos veces la misma transacción confirmada. */
  TRANSACTION_ALREADY_REVERSED: 'TRANSACTION_ALREADY_REVERSED',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  NOT_A_TRANSFER_PAIR: 'NOT_A_TRANSFER_PAIR',
  PENDING_LEG_NOT_FOUND: 'PENDING_LEG_NOT_FOUND',
```

**Step 4: Ejecutar y confirmar que pasan**

```bash
npx jest apps/ledger/src/shared/infrastructure/adapters/http/ledger-error-code-mapping.spec.ts --no-coverage
```
Esperado: PASS. (Además, `ledger-error-code-catalogue.spec.ts` — completeness check que ya
existe — pasa a verificar que este código nuevo está catalogado, sin tocarlo.)

---

### Tarea 9: `docs/ledger-spec.md` §7.3 — documentar la elección (AC-2) [X]

Edición directa de la spec de producto — **no** pasa por el ciclo de reconciliación de
`/design`/`/sync` (ver nota al pie de la tabla de trazabilidad). Sin ciclo test-first: es prosa,
no código.

**Archivos:**
- Modificar: `docs/ledger-spec.md:729-738`

**Step 1: Editar**

Reemplazar el bloque `### 7.3 Flujo: corrección de una confirmada` actual por:

```markdown
### 7.3 Flujo: corrección de una confirmada

```
POST /transactions/{id}/reverse { atEffectiveDate?: boolean }
   → ReverseConfirmedTransaction(id, atEffectiveDate)
   → TransactionReversed(T1) + TransactionRecorded(T2 = reversa, metadata.reverses_id = T1)
   → [opcional] cliente registra T3 con los valores correctos
   → proyecciones netean T1 + T2; el stream conserva la historia completa
```

**`atEffectiveDate` (hu-0026, default `true`) elige la fecha contable de T2:**

- `true` — T2 nace con la fecha de T1. Corrige el saldo histórico; las aserciones de saldo
  posteriores a esa fecha se re-evalúan automáticamente (RF-18).
- `false` — T2 nace con la fecha de hoy. El saldo histórico queda intacto; las aserciones
  anteriores a hoy no cambian de veredicto. Es la práctica contable habitual cuando el período
  de T1 ya fue conciliado y cerrado.

El ledger no infiere si el período está cerrado: la elección es enteramente del cliente.
```

**Step 2: Verificar**

```bash
grep -n "atEffectiveDate" docs/ledger-spec.md
```
Esperado: coincide dentro de `§7.3`, con las dos ramas documentadas.

---

### Tarea 10: Suite completa del módulo [X]

```bash
npx jest apps/ledger/src/transactions apps/ledger/src/shared apps/ledger/src/bootstrap --no-coverage
```
Esperado: PASS — todos los tests de `transactions`, `shared` y el wiring de `bootstrap`
pasando, sin regresiones en el resto del módulo (`amend`, `confirm`, `void`, `merge-transfers`,
proyectores).

```bash
npx likec4 validate
```
Esperado: `✓ Valid` — el modelo, incluido el delta de esta historia, sigue compilando (ya
verificado en `/design`; se re-confirma acá porque ningún archivo `.c4` cambia durante el
build).
