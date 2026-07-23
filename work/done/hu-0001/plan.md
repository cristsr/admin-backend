# hu-0001: Value objects del dominio contable y envelope de eventos — Plan de Implementación

> **Para Claude:** USA el skill /build para implementar este plan tarea por tarea.

**Historia:** `work/active/hu-0001/`
**Microservicio(s):** `apps/ledger`
**Objetivo:** Cerrar el único gap accionable detectado por `/scan`+`/design` sobre EP-1.1/EP-1.2
(ya implementados en `feat/core`): cobertura de tests del round-trip de serialización de
`Money` (AC-7), más un reordenamiento cosmético de `InvalidPayeeException` (AC-3).
**Arquitectura:** No se crea código de producción nuevo salvo el `import` movido de
`InvalidPayeeException`. Los otros 8 AC ya están implementados y probados — este plan solo
agrega los specs faltantes (backfill, ver excepción de Test-First en `design.md`) y reubica
una excepción para consistencia con el resto de los VOs del ledger.
**Stack:** NestJS · TypeScript · TypeORM · PostgreSQL · Jest (`nx test ledger`)
**Rama:** se trabaja directamente sobre `feat/core` (rama actual) — no se crea rama nueva, por
indicación explícita del usuario.

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Ya implementado — `account-name.spec.ts` (existente, 12 casos). Sin tarea nueva. |
| AC-2 | Ya implementado — `account-name.spec.ts` (INV-14, existente). Sin tarea nueva. |
| AC-3 | Tarea 1 (reubica `InvalidPayeeException`) + `payee.spec.ts` (existente, sin cambios). |
| AC-4 | Ya implementado — decisión de diseño ratificada en `design.md` (aceptar `Currency` actual). Sin tarea nueva. |
| AC-5 | Ya implementado — `seed-currency-catalog.spec.ts` (existente). Sin tarea nueva. |
| AC-6 | Ya implementado — `posting-line.spec.ts` (existente) + decisión de diseño ratificada. Sin tarea nueva. |
| AC-7 | **Tarea 2** (`posting.serializer.spec.ts`) + **Tarea 3** (`transaction-recorded.event.spec.ts`) — gap real cerrado acá. |
| AC-8 | Ya implementado — tipo `EventEnvelope`/`StoredEvent` + `envelope.factory.spec.ts` (existentes). Sin tarea nueva. |
| AC-9 | Ya implementado — `envelope.factory.spec.ts` (existente, determinismo probado). Sin tarea nueva. |
| AC-10 | Ya implementado — `event-registry.spec.ts` (existente, upcasting v1→v2 probado). Sin tarea nueva. |

---

### Tarea 0: Confirmar estado de la rama [X]

> Por indicación del usuario, no se crea rama nueva — se trabaja sobre `feat/core`.

**Step 1: Verificar rama y working tree del alcance afectado**

```bash
git branch --show-current
git status --porcelain -- apps/ledger libs
```
Esperado: `feat/core`; salida vacía (sin cambios pendientes en `apps/ledger`/`libs` antes de
empezar).

---

### Tarea 1: Reubicar `InvalidPayeeException` a `value-object.exception.ts` [X]

**Archivos:**
- Modificar: `apps/ledger/src/shared-kernel/domain/value-objects/value-object.exception.ts`
- Modificar: `apps/ledger/src/shared-kernel/domain/value-objects/payee.ts`
- Test: `apps/ledger/src/shared-kernel/domain/value-objects/payee.spec.ts` (existente, sin
  cambios — valida que el comportamiento no se rompió)

Es un cambio mecánico de organización (AC-3), sin comportamiento nuevo: no aplica ciclo
red→green, la regresión se verifica con el spec existente.

**Step 1: Confirmar que el spec existente pasa antes del cambio**

```bash
npx nx test ledger --testPathPattern=payee.spec.ts
```
Esperado: PASS — 3/3 tests (baseline antes de tocar el archivo).

**Step 2: Agregar la excepción a `value-object.exception.ts`**

En `apps/ledger/src/shared-kernel/domain/value-objects/value-object.exception.ts`, agregar al
final del archivo:

```typescript
/** The payee (merchant/counterparty) exceeds its length bound. */
export class InvalidPayeeException extends DomainUnprocessableException {
  readonly code: string = 'INVALID_PAYEE';
}
```

**Step 3: Quitar la definición local y actualizar el import en `payee.ts`**

En `apps/ledger/src/shared-kernel/domain/value-objects/payee.ts`, reemplazar:

```typescript
import { DomainUnprocessableException, Nullable } from '@shared';

/** Upper bound on a payee label, guarding the read-model column. */
const MAX_LENGTH = 255;

/** The payee (merchant/counterparty) exceeds its length bound. */
export class InvalidPayeeException extends DomainUnprocessableException {
  readonly code: string = 'INVALID_PAYEE';
}
```

por:

```typescript
import { Nullable } from '@shared';
import { InvalidPayeeException } from './value-object.exception';

/** Upper bound on a payee label, guarding the read-model column. */
const MAX_LENGTH = 255;
```

El resto de `payee.ts` (la clase `Payee`) queda igual — sigue usando `InvalidPayeeException`,
ahora importada en vez de definida localmente.

**Step 4: Ejecutar y confirmar que sigue pasando**

```bash
npx nx test ledger --testPathPattern=payee.spec.ts
```
Esperado: PASS — 3/3 tests, sin cambios de comportamiento.

**Step 5: Confirmar que no quedó ninguna importación rota**

```bash
npx nx test ledger --testPathPattern="value-objects"
```
Esperado: PASS — todos los specs de `shared-kernel/domain/value-objects/` (incluye
`account-name`, `currency-code`, `ledger-date`, `payee`) siguen en verde; el barrel
`index.ts` re-exporta `InvalidPayeeException` sin cambios en su path público
(`@ledger/shared-kernel/domain/value-objects`).

---

### Tarea 2: Cerrar AC-7 — round-trip de `PostingSerializer` (COP y USD) [X]

**Archivos:**
- Crear: `apps/ledger/src/transactions/domain/posting/posting.serializer.spec.ts`
- Referencia (sin cambios): `apps/ledger/src/transactions/domain/posting/posting.serializer.ts`

**Step 1: Escribir el test que falla (el archivo de test no existe aún)**

En `apps/ledger/src/transactions/domain/posting/posting.serializer.spec.ts`:

```typescript
import { aMoney } from '@ledger/shared/testing';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { PostingLine } from './posting-line';
import { PostingSerializer } from './posting.serializer';

describe('PostingSerializer', () => {
  const catalog = new SeedCurrencyCatalog();

  it('round-trips a COP posting preserving the exact decimal value (RNF-2, INV-8)', () => {
    const original = PostingLine.of({
      accountId: 'expenses',
      amount: aMoney().of('31900').inCop(),
      metadata: { note: 'coffee' },
    });

    const payload = PostingSerializer.toPayload(original);

    expect(payload).toEqual({
      accountId: 'expenses',
      amount: '31900',
      currency: 'COP',
      metadata: { note: 'coffee' },
    });
    expect(typeof payload.amount).toBe('string');

    const rebuilt = PostingSerializer.fromPayload(payload, catalog);

    expect(rebuilt.amount.toDecimalString()).toBe('31900');
    expect(rebuilt.currencyCode).toBe('COP');
    expect(rebuilt.accountId).toBe('expenses');
    expect(rebuilt.metadata).toEqual({ note: 'coffee' });
  });

  it('round-trips a USD posting preserving the exact decimal value (RNF-2, INV-8)', () => {
    const original = PostingLine.of({
      accountId: 'assets',
      amount: aMoney().of('-7.99').inUsd(),
      metadata: {},
    });

    const payload = PostingSerializer.toPayload(original);

    expect(payload).toEqual({
      accountId: 'assets',
      amount: '-7.99',
      currency: 'USD',
      metadata: {},
    });

    const rebuilt = PostingSerializer.fromPayload(payload, catalog);

    expect(rebuilt.amount.toDecimalString()).toBe('-7.99');
    expect(rebuilt.currencyCode).toBe('USD');
  });

  it('rebuilds Money at the currency scale via the catalog, never guessing minor units', () => {
    const payload = {
      accountId: 'expenses',
      amount: '100',
      currency: 'COP',
      metadata: {},
    };

    const rebuilt = PostingSerializer.fromPayload(payload, catalog);

    expect(rebuilt.amount.currency.minorUnits).toBe(0);
  });
});
```

**Step 2: Ejecutar y confirmar el resultado**

```bash
npx nx test ledger --testPathPattern=posting.serializer.spec.ts
```
Esperado: PASS de entrada — `posting.serializer.ts` ya implementa correctamente el
comportamiento (backfill de cobertura sobre código existente, no TDD rojo→verde clásico; ver
excepción de Test-First en `design.md`). Si algo falla acá, es una regresión real a
investigar antes de continuar, no un artefacto esperado del backfill.

**Step 3: Sin cambios de implementación**

No se modifica `posting.serializer.ts` — el paso 2 debe cerrar en PASS sin tocar el archivo de
producción.

---

### Tarea 3: Cerrar AC-7 — round-trip de `TransactionRecorded` (COP y USD) [X]

**Archivos:**
- Crear: `apps/ledger/src/transactions/domain/transaction/events/transaction-recorded.event.spec.ts`
- Referencia (sin cambios): `apps/ledger/src/transactions/domain/transaction/events/transaction-recorded.event.ts`

**Step 1: Escribir el test que falla (el archivo de test no existe aún)**

En `apps/ledger/src/transactions/domain/transaction/events/transaction-recorded.event.spec.ts`:

```typescript
import { aMoney } from '@ledger/shared/testing';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { TransactionRecorded, TransactionRecordedProps } from './transaction-recorded.event';

describe('TransactionRecorded', () => {
  const catalog = new SeedCurrencyCatalog();

  function props(overrides: Partial<TransactionRecordedProps> = {}): TransactionRecordedProps {
    return {
      transactionId: 'tx-1',
      date: '2026-07-20',
      payee: 'Netflix',
      description: 'Subscription',
      status: TransactionStatus.PENDING,
      invoiceUrl: null,
      tags: [],
      postings: [
        PostingLine.of({ accountId: 'expenses', amount: aMoney().of('31900').inCop(), metadata: {} }),
        PostingLine.of({ accountId: 'assets', amount: aMoney().of('-31900').inCop(), metadata: {} }),
      ],
      metadata: {},
      ...overrides,
    };
  }

  it('round-trips COP postings preserving the exact decimal value (RNF-2, INV-8)', () => {
    const event = new TransactionRecorded(props());

    const payload = event.toPayload();
    const rebuilt = TransactionRecorded.fromPayload(payload, catalog);
    const rePayload = rebuilt.toPayload();

    expect(rePayload).toEqual(payload);
    expect(rebuilt.props.postings[0].amount.toDecimalString()).toBe('31900');
    expect(rebuilt.props.postings[0].currencyCode).toBe('COP');
  });

  it('round-trips USD postings preserving the exact decimal value (RNF-2, INV-8)', () => {
    const usdPostings = [
      PostingLine.of({ accountId: 'expenses', amount: aMoney().of('7.99').inUsd(), metadata: {} }),
      PostingLine.of({ accountId: 'assets', amount: aMoney().of('-7.99').inUsd(), metadata: {} }),
    ];
    const event = new TransactionRecorded(props({ postings: usdPostings }));

    const payload = event.toPayload();
    const rebuilt = TransactionRecorded.fromPayload(payload, catalog);
    const rePayload = rebuilt.toPayload();

    expect(rePayload).toEqual(payload);
    expect(rebuilt.props.postings[0].amount.toDecimalString()).toBe('7.99');
    expect(rebuilt.props.postings[0].currencyCode).toBe('USD');
  });

  it('never serializes an amount as a JS number', () => {
    const event = new TransactionRecorded(props());
    const payload = event.toPayload();

    const postingsPayload = payload.postings as ReadonlyArray<{ amount: unknown }>;

    for (const posting of postingsPayload) {
      expect(typeof posting.amount).toBe('string');
    }
  });
});
```

**Step 2: Ejecutar y confirmar el resultado**

```bash
npx nx test ledger --testPathPattern=transaction-recorded.event.spec.ts
```
Esperado: PASS de entrada — mismo caso de backfill que la Tarea 2; `TransactionRecorded` ya
delega correctamente en `PostingSerializer`. Un fallo acá es una regresión real, no algo
esperado.

**Step 3: Sin cambios de implementación**

No se modifica `transaction-recorded.event.ts`.

---

### Tarea 4: Ejecutar la suite completa de `apps/ledger` [X]

```bash
npx nx test ledger --no-coverage
```
Esperado: PASS — todos los tests de `apps/ledger` en verde, incluyendo los 2 specs nuevos
(Tarea 2, Tarea 3) y el spec modificado indirectamente por la Tarea 1 (`payee.spec.ts`, sin
cambios de contenido pero validando la reubicación de `InvalidPayeeException`).
