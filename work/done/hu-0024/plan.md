# hu-0024: Integridad verificable del event store — Plan de Implementación

**Historia:** `work/active/hu-0024/`
**App/libs:** `libs/shared` · `libs/cqrs` · `apps/ledger`
**Objetivo:** Encadenar criptográficamente el event store (JCS + SHA-256), endurecer la
idempotencia para que detecte reusos de `external_ref` con datos distintos, y agregar un
comando `verify-chain` que audite la cadena completa.
**Arquitectura:** todo el delta vive en el módulo lógico "Shared Kernel": tipos y puertos en
`libs/cqrs` (framework-agnóstico, contract-tested contra in-memory y Postgres), la
canonicalización en `libs/shared` (utilidad genérica, dos funciones puras), y el verificador +
CLI en `apps/ledger/src/tooling` (mismo patrón que `ConsistencyVerifier`/`verify-balances`).
Un solo grupo de implementación — no hay paralelismo real: el protocolo del `CommandBus`, los
tipos del envelope y la función de hash son prerrequisitos compartidos por todo lo demás.
**Stack:** NestJS · TypeScript · TypeORM · PostgreSQL · Jest · `canonicalize@3.0.0` (RFC 8785)

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 — canonicalización JCS determinista | Tarea 1 |
| AC-2 — hash de cadena, atómico, por usuario, génesis vacío | Tarea 1, 3, 8, 10, 11, 12, 13 |
| AC-3 — qué entra al hash (por exclusión, no por tipo) | Tarea 3, 10 |
| AC-4 — comando `verify-chain` | Tarea 10, 13, 14, 15 |
| AC-5 — `external_ref_hash`, inputs del command | Tarea 2, 3, 5, 6, 8, 9, 11, 12 |
| AC-6 — reuso con inputs distintos → 409 (los dos caminos) | Tarea 6 |
| AC-7 — cabecera `Idempotency-Hit` | Tarea 7 |
| AC-8 — sin nulos, `NOT NULL` + CHECK | Tarea 8 |

> Las 8 AC de `hu.md` están cubiertas.

**Notas de integración (ya validadas empíricamente, no re-derivar):**

- `canonicalize@3.0.0` es un paquete **ESM-only** (`"type": "module"`, `exports` sin
  condición `require`). Consumirlo por `import` estático rompe la compilación CommonJS de este
  proyecto. La Tarea 1 usa `import()` dinámico cacheado — **probado** contra `ts-node -r
  tsconfig-paths/register` (ejecución real de CLI) y contra los tres `jest.config.ts`
  afectados (con `moduleNameMapper` + `transformIgnorePatterns`, el mismo patrón que ya
  resuelve `jose` en este repo).
- `pg_advisory_xact_lock` es re-entrante dentro de la misma transacción: varios `append` al
  mismo usuario en un `withTransaction` toman el lock una sola vez efectiva.
- `InMemoryEventStore` no tiene una transacción real de por medio, así que necesita su propio
  mecanismo de serialización por usuario (un mutex asíncrono) para no romper la cadena bajo
  `Promise.all` concurrente — ver Tarea 11.

---

### Tarea 0: Preparar rama de trabajo [X]

Este monorepo no crea una rama por historia (a diferencia de proyectos multi-repo): la
constitución (`docs/rules.md`, "Restricciones de flujo de trabajo") solo prohíbe trabajar sobre
la rama base (`master`). El precedente ya establecido (`work/done/refactor-read-side-ports/plan.md`)
confirma: todo el trabajo va sobre `feat/core`, un commit por tarea o grupo de tareas cohesivo.

**Step 1: Verificar que no estamos sobre la rama base**

```bash
git branch --show-current
```

Esperado: `feat/core` (o cualquier rama que no sea `master`). Si el resultado es `master` →
detener y pedir al usuario que cambie de rama antes de continuar.

**Step 2: Verificar working tree limpio de este story-scope**

```bash
git status --porcelain -- libs/shared libs/cqrs apps/ledger package.json package-lock.json docs/rules.md
```

Esperado: sin salida relacionada a los archivos que este plan va a tocar (puede haber cambios
preexistentes no relacionados de otras historias en curso — no tocarlos).

---

### Tarea 1: Canonicalización JCS + hashing SHA-256 [X]

**Archivos:**
- Crear: `libs/shared/src/functions/canonical-hash.ts`
- Test: `libs/shared/src/functions/canonical-hash.spec.ts`
- Modificar: `libs/shared/src/functions/index.ts`
- Modificar: `libs/shared/jest.config.ts`
- Modificar: `libs/cqrs/jest.config.ts`
- Modificar: `apps/ledger/jest.config.ts`
- Modificar: `package.json`, `package-lock.json` (dependencia nueva)

**Step 1: Instalar la dependencia**

```bash
npm install canonicalize@^3.0.0
```

Esperado: `package.json` gana `"canonicalize": "^3.0.0"` en `dependencies`.

**Step 2: Escribir el test que falla**

En `libs/shared/src/functions/canonical-hash.spec.ts`:

```typescript
import { canonicalJson, sha256Hex } from './canonical-hash';

describe('canonicalJson (RFC 8785 / JCS)', () => {
  it('produces the same string regardless of key insertion order', async () => {
    const a = await canonicalJson({ b: 1, a: 2 });
    const b = await canonicalJson({ a: 2, b: 1 });

    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1}');
  });

  it('sorts keys by UTF-16 code unit — documented RFC 8785 example', async () => {
    const result = await canonicalJson({
      peach: 'This sorting order',
      punkt: 'is heavily used',
      pinkie: 'in Postal Code sorting!',
    });

    expect(result).toBe(
      '{"peach":"This sorting order","pinkie":"in Postal Code sorting!","punkt":"is heavily used"}',
    );
  });

  it('sorts keys recursively in nested objects', async () => {
    const result = await canonicalJson({ z: { d: 1, c: 2 }, a: 1 });

    expect(result).toBe('{"a":1,"z":{"c":2,"d":1}}');
  });

  it('preserves array order (arrays are not reordered)', async () => {
    const result = await canonicalJson({ list: [3, 1, 2] });

    expect(result).toBe('{"list":[3,1,2]}');
  });

  it('passes decimal amount strings through untouched (RNF-2 — never parsed to number)', async () => {
    const result = await canonicalJson({ amount: '-31900', usd: '7.99' });

    expect(result).toBe('{"amount":"-31900","usd":"7.99"}');
  });

  it('is stable across repeated calls for the same value', async () => {
    const value = { postings: [{ amount: '100', currency: 'COP' }], date: '2026-07-20' };

    const first = await canonicalJson(value);
    const second = await canonicalJson(value);

    expect(first).toBe(second);
  });
});

describe('sha256Hex', () => {
  it('matches the well-known SHA-256 vector for the empty string', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('matches the well-known SHA-256 vector for "abc"', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('always returns 64 lowercase hex characters', () => {
    const digest = sha256Hex('anything');

    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(sha256Hex('same input')).toBe(sha256Hex('same input'));
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx nx test shared --testFile=canonical-hash.spec.ts --no-coverage
```

Esperado: FAIL — "Cannot find module './canonical-hash'".

**Step 3: Implementar**

En `libs/shared/src/functions/canonical-hash.ts`:

```typescript
import { createHash } from 'node:crypto';

type CanonicalizeFn = (value: unknown) => string | undefined;

/**
 * `canonicalize` ships ESM-only (`"type": "module"`, no `require` export
 * condition) while this codebase compiles to CommonJS. A dynamic `import()`
 * is the only way a CJS caller can load it — cached after the first call so
 * the async cost only happens once per process.
 */
let canonicalizeFn: Promise<CanonicalizeFn> | undefined;

function loadCanonicalize(): Promise<CanonicalizeFn> {
  canonicalizeFn ??= import('canonicalize').then((mod) => mod.default as CanonicalizeFn);
  return canonicalizeFn;
}

/**
 * JSON Canonicalization Scheme (RFC 8785 / JCS): the same value always
 * serializes to the same string, regardless of key insertion order. Delegates
 * to `canonicalize`, whose maintainer co-authored the RFC — this project does
 * not reimplement JCS (Anti-Abstraction Gate).
 */
export async function canonicalJson(value: unknown): Promise<string> {
  const canonicalize = await loadCanonicalize();
  const result = canonicalize(value);

  if (result === undefined) {
    throw new Error('canonicalJson: value is not JSON-serializable');
  }

  return result;
}

/** Lowercase hex SHA-256 digest, 64 characters — matches a `char(64)` column. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
```

**Step 4: Registrar el barrel**

En `libs/shared/src/functions/index.ts`, agregar:

```typescript
export * from './canonical-hash';
```

**Step 5: Arreglar la resolución ESM en los tres jest config afectados**

En `libs/shared/jest.config.ts`, reemplazar el bloque final:

```typescript
  // jose and canonicalize ship ESM only and this runner is CJS, so both must
  // be transformed instead of required as-is.
  transformIgnorePatterns: ['/node_modules/(?!(jose|canonicalize)/)'],

  moduleNameMapper: {
    // canonicalize's package.json "exports" map declares only an "import"
    // condition (no "require"/"default"), which Jest's CJS-mode resolver
    // cannot match — point it straight at the real file instead.
    '^canonicalize$': '<rootDir>/../../node_modules/canonicalize/lib/canonicalize.js',
  },
};
```

En `libs/cqrs/jest.config.ts`, en el `moduleNameMapper` existente, agregar la misma entrada:

```typescript
  moduleNameMapper: {
    '^typeorm$': '<rootDir>/../../node_modules/typeorm/index.js',
    '^canonicalize$': '<rootDir>/../../node_modules/canonicalize/lib/canonicalize.js',
    '^@cqrs/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../../libs/shared/src/$1',
    '^@shared$': '<rootDir>/../../libs/shared/src/index.ts',
  },
```

y el `transformIgnorePatterns`:

```typescript
  transformIgnorePatterns: ['/node_modules/(?!(jose|canonicalize)/)'],
```

En `apps/ledger/jest.config.ts`, idéntico ajuste: agregar `'^canonicalize$': '<rootDir>/../../node_modules/canonicalize/lib/canonicalize.js'`
al `moduleNameMapper` y extender `transformIgnorePatterns` a `['/node_modules/(?!(jose|canonicalize)/)']`.

**Step 6: Ejecutar y confirmar que pasa**

```bash
npx nx test shared --testFile=canonical-hash.spec.ts --no-coverage
```

Esperado: PASS — 10 tests verdes.

---

### Tarea 2: `CommandNext` contextual + `AuthContext.externalRefHash` [X]

Prerrequisito mecánico: sin esto, `IdempotencyPolicy` no tiene forma de pasar el hash calculado
hacia abajo en el chain sin que el `CommandBus` aprenda idempotencia.

**Archivos:**
- Modificar: `libs/cqrs/src/application/command-bus/auth-context.type.ts`
- Modificar: `libs/cqrs/src/application/command-bus/command-policy.ts`
- Modificar: `libs/cqrs/src/application/command-bus/command-bus.ts`
- Modificar: `libs/cqrs/src/application/command-bus/policies/authenticated-context.policy.ts`
- Modificar: `libs/cqrs/src/application/command-bus/policies/optimistic-concurrency.policy.ts`
- Test (modificar): `libs/cqrs/src/application/command-bus/command-bus.spec.ts`
- Test (modificar): `libs/cqrs/src/application/command-bus/policies/authenticated-context.policy.spec.ts`
- Test (modificar): `libs/cqrs/src/application/command-bus/policies/optimistic-concurrency.policy.spec.ts`

**Step 1: Escribir el test que falla (chain contextual)**

En `libs/cqrs/src/application/command-bus/command-bus.spec.ts`, agregar un caso nuevo antes del
cierre del `describe`:

```typescript
  it('lets a policy replace the ctx seen by downstream policies and the handler', async () => {
    class EnrichingPolicy extends CommandPolicy {
      async handle(_c: Command, ctx: AuthContext, next: CommandNext): Promise<CommandResult> {
        return next({ ...ctx, clientId: 'enriched' });
      }
    }
    class AssertingHandler extends CommandHandler<HelloCommand> {
      async execute(command: HelloCommand, ctx: AuthContext): Promise<CommandResult> {
        return {
          aggregateId: ctx.clientId,
          streamPosition: 0n,
          idempotentReplay: false,
        };
      }
    }

    const enrichedBus = new PolicyCommandBus([new EnrichingPolicy()]);
    enrichedBus.register(HelloCommand, new AssertingHandler());

    const result = await enrichedBus.dispatch(new HelloCommand('x'), ctx);

    expect(result.aggregateId).toBe('enriched');
  });
```

Además, actualizar las 3 clases de política declaradas en el archivo (`NoOpPolicy`,
`FirstPolicy`, `SecondPolicy`) para que sus `next()` pasen `ctx`: `return next(ctx);` en cada
una — hoy compilan con `next()` sin argumentos, que dejará de tipar tras el Step 3.

**Step 2: Ejecutar y confirmar que falla**

```bash
npx nx test cqrs --testFile=command-bus.spec.ts --no-coverage
```

Esperado: FAIL de compilación TS — `Expected 1 arguments, but got 0` en las llamadas `next()`
existentes (`CommandNext` todavía no es contextual, así que el nuevo test tampoco compila:
`next({ ...ctx, clientId: 'enriched' })` no matchea la firma vieja `() => Promise<CommandResult>`).

**Step 3: Implementar — protocolo contextual**

En `libs/cqrs/src/application/command-bus/auth-context.type.ts`:

```typescript
import { Nullable } from '@shared';

/**
 * Authenticated provenance every command carries. The ledger
 * does not manage identity; it requires `userId`/`clientId` to be present and
 * records them on every event. `externalRef` is the optional idempotency key
 * stamped on the command's anchor event.
 */
export type AuthContext = {
  readonly userId: string;
  readonly clientId: string;
  readonly externalRef: Nullable<string>;
  /**
   * Canonical hash of the command's inputs (AC-5), computed by
   * `IdempotencyPolicy` and carried down the policy chain to
   * `EnvelopeFactory`, which stamps it on the anchor event. Never set by the
   * HTTP transport layer — optional so existing `AuthContext` literals built
   * by controllers do not need to change.
   */
  readonly externalRefHash?: Nullable<string>;
};
```

En `libs/cqrs/src/application/command-bus/command-policy.ts`:

```typescript
import { AuthContext } from './auth-context.type';
import { Command } from './command';
import { CommandResult } from './command-result.type';

/**
 * The next link in the policy chain (a policy or, finally, the handler).
 * Contextual: a policy can pass an enriched `ctx` downstream (AC-5 — the
 * idempotency hash reaches `EnvelopeFactory` this way) without the bus or the
 * handler needing to know why.
 */
export type CommandNext = (ctx: AuthContext) => Promise<CommandResult>;

/**
 * Cross-cutting middleware wrapped around every handler (auth, idempotency,
 * concurrency). Policies compose in order; each may short-circuit by not
 * calling `next`.
 */
export abstract class CommandPolicy {
  abstract handle(command: Command, ctx: AuthContext, next: CommandNext): Promise<CommandResult>;
}
```

En `libs/cqrs/src/application/command-bus/command-bus.ts`, el método `dispatch`:

```typescript
  async dispatch(command: Command, ctx: AuthContext): Promise<CommandResult> {
    const handler = this.handlers.get(command.constructor as CommandCtor<Command>);

    if (!handler) {
      throw new UnregisteredCommandException(
        `No handler registered for "${command.commandType}"`,
      );
    }

    const terminal: CommandNext = (finalCtx) => handler.execute(command, finalCtx);
    const chain = this.policies.reduceRight<CommandNext>(
      (next, policy) => (currentCtx) => policy.handle(command, currentCtx, next),
      terminal,
    );

    return chain(ctx);
  }
```

En `authenticated-context.policy.ts`, el único `return next();` pasa a `return next(ctx);`.

En `optimistic-concurrency.policy.ts`, renombrar el parámetro `_ctx` a `ctx` (deja de ser
no usado) y el `return await next();` pasa a `return await next(ctx);`.

**Step 4: Actualizar los mocks de test que quedan sin tipar**

En `authenticated-context.policy.spec.ts` y `optimistic-concurrency.policy.spec.ts`, cada
`jest.fn<Promise<CommandResult>, []>()` pasa a `jest.fn<Promise<CommandResult>, [AuthContext]>()`
(la forma no cambia en runtime, solo el tipo genérico de Jest).

**Step 5: Ejecutar y confirmar que pasa**

```bash
npx nx test cqrs --testFile=command-bus.spec.ts --no-coverage
npx nx test cqrs --testFile=authenticated-context.policy.spec.ts --no-coverage
npx nx test cqrs --testFile=optimistic-concurrency.policy.spec.ts --no-coverage
```

Esperado: PASS en los tres archivos, incluido el caso nuevo de `command-bus.spec.ts`.

---

### Tarea 3: `EventEnvelope.externalRefHash` + `ChainHashInput` [X]

**Archivos:**
- Modificar: `libs/cqrs/src/domain/event/event-envelope.type.ts`
- Crear: `libs/cqrs/src/domain/event/chain-hash-input.type.ts`
- Test: `libs/cqrs/src/domain/event/chain-hash-input.type.spec.ts`

**Step 1: Escribir el test que falla**

En `libs/cqrs/src/domain/event/chain-hash-input.type.spec.ts`:

```typescript
import { EventEnvelope } from './event-envelope.type';
import { chainHashInput } from './chain-hash-input.type';

const envelope: EventEnvelope = {
  eventId: 'evt-1',
  userId: 'user-1',
  aggregateType: 'Transaction',
  aggregateId: 'agg-1',
  sequence: 1,
  eventType: 'TransactionRecorded',
  schemaVersion: 1,
  clientId: 'client-x',
  externalRef: 'ref-1',
  externalRefHash: 'abc123',
  payload: { amount: '31900' },
  occurredAt: new Date('2026-07-20T10:00:00.000Z'),
  recordedAt: new Date('2026-07-20T10:00:05.000Z'),
};

describe('chainHashInput', () => {
  it('includes every envelope field relevant to the decision it records', () => {
    const input = chainHashInput(envelope);

    expect(input).toEqual({
      eventId: 'evt-1',
      userId: 'user-1',
      aggregateType: 'Transaction',
      aggregateId: 'agg-1',
      sequence: 1,
      eventType: 'TransactionRecorded',
      schemaVersion: 1,
      clientId: 'client-x',
      externalRef: 'ref-1',
      payload: { amount: '31900' },
      occurredAt: '2026-07-20T10:00:00.000Z',
    });
  });

  it('excludes recordedAt (infrastructure timestamp, AC-3)', () => {
    const input = chainHashInput(envelope) as Record<string, unknown>;

    expect(input).not.toHaveProperty('recordedAt');
  });

  it('excludes externalRefHash (derived value, AC-3)', () => {
    const input = chainHashInput(envelope) as Record<string, unknown>;

    expect(input).not.toHaveProperty('externalRefHash');
  });

  it('serializes occurredAt as ISO 8601, not as a Date instance', () => {
    const input = chainHashInput(envelope);

    expect(typeof input.occurredAt).toBe('string');
    expect(input.occurredAt).toBe('2026-07-20T10:00:00.000Z');
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx nx test cqrs --testFile=chain-hash-input.type.spec.ts --no-coverage
```

Esperado: FAIL — "Cannot find module './chain-hash-input.type'" y `externalRefHash` no existe
en `EventEnvelope`.

**Step 3: Implementar**

En `libs/cqrs/src/domain/event/event-envelope.type.ts`, agregar el campo:

```typescript
import { Nullable } from '@shared';
import { EventPayload } from './event-payload.type';

/**
 * A domain event wrapped with its append-time metadata. Immutable; the
 * base for auditability (INV-3) and idempotency (INV-10). `sequence` is
 * the 1-based version within the aggregate; `externalRef` is stamped only on a
 * command's anchor event (roadmap: anchor-only stamping).
 */
export type EventEnvelope = {
  readonly eventId: string;
  readonly userId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly sequence: number;
  readonly eventType: string;
  readonly schemaVersion: number;
  readonly clientId: string;
  readonly externalRef: Nullable<string>;
  /**
   * Canonical hash of the command's inputs (AC-5), stamped on the anchor
   * event only — mirrors `externalRef`. Persisted so a later idempotency
   * check can compare against it without recomputing history.
   */
  readonly externalRefHash: Nullable<string>;
  readonly payload: EventPayload;
  readonly occurredAt: Date;
  readonly recordedAt: Date;
};
```

En `libs/cqrs/src/domain/event/chain-hash-input.type.ts`:

```typescript
import { EventEnvelope } from './event-envelope.type';
import { EventPayload } from './event-payload.type';

/**
 * The subset of an envelope that enters the hash chain (AC-3). Every field is
 * listed explicitly — never spread from `envelope` — so that a new field
 * added to {@link EventEnvelope} fails to compile here until someone decides
 * whether it belongs in the chain or not, instead of silently entering the
 * hash. `Omit` on the type keeps that decision visible: it still requires
 * every remaining key.
 */
export type ChainHashInput = Omit<
  EventEnvelope,
  'recordedAt' | 'externalRefHash' | 'occurredAt'
> & {
  readonly occurredAt: string;
};

/**
 * Projects an envelope onto its hash input. Excluded on purpose:
 * `recordedAt` (infrastructure assigns it after the fact) and
 * `externalRefHash` (itself a derived value — including it would make a
 * future change to its own derivation retroactively invalidate the chain,
 * exactly what AC-3 exists to prevent). `globalPosition` is not part of
 * `EventEnvelope` at all, so it is excluded by construction.
 */
export function chainHashInput(envelope: EventEnvelope): ChainHashInput {
  return {
    eventId: envelope.eventId,
    userId: envelope.userId,
    aggregateType: envelope.aggregateType,
    aggregateId: envelope.aggregateId,
    sequence: envelope.sequence,
    eventType: envelope.eventType,
    schemaVersion: envelope.schemaVersion,
    clientId: envelope.clientId,
    externalRef: envelope.externalRef,
    payload: envelope.payload as EventPayload,
    occurredAt: envelope.occurredAt.toISOString(),
  };
}
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx nx test cqrs --testFile=chain-hash-input.type.spec.ts --no-coverage
```

Esperado: PASS — 4 tests verdes. (Este cambio también hace que **todo objeto literal existente
de `EventEnvelope` en el codebase** deje de compilar hasta agregarle `externalRefHash` — se
resuelve en la Tarea 5 y en la Tarea 9/11, únicos lugares donde se construyen envelopes de
producción.

> **Corrección ejecutada durante `/build`:** el plan no había anticipado dos specs que también
> construyen un `EventEnvelope` a mano —
> `libs/cqrs/src/application/event-sourced.repository.spec.ts` (línea 75) y
> `libs/cqrs/src/infrastructure/adapters/projection/polling-dispatcher.spec.ts` (línea ~35).
> Se les agregó `externalRefHash: null` en el mismo paso, verificado con
> `npx tsc --noEmit -p libs/cqrs/tsconfig.spec.json` para confirmar que no quedaban más sitios
> rotos fuera de los ya cubiertos por las Tareas 5, 6 y 9.)

---

### Tarea 4: `IdempotencyInputMismatchException` [X]

**Archivos:**
- Modificar: `libs/cqrs/src/domain/exceptions/event-store.exception.ts`
- Test: `libs/cqrs/src/domain/exceptions/event-store.exception.spec.ts` (crear si no existe;
  si existe, agregar el caso)

**Step 1: Verificar si el archivo de test existe**

```bash
[ -f libs/cqrs/src/domain/exceptions/event-store.exception.spec.ts ] && echo EXISTS || echo MISSING
```

**Step 2: Escribir el test que falla**

En `libs/cqrs/src/domain/exceptions/event-store.exception.spec.ts` (crear si falta, o agregar
`describe` si existe):

```typescript
import { DomainConflictException } from '@shared';
import {
  ConcurrencyConflictException,
  DuplicateExternalRefException,
  IdempotencyInputMismatchException,
} from './event-store.exception';

describe('IdempotencyInputMismatchException', () => {
  it('extends DomainConflictException with a stable code', () => {
    const error = new IdempotencyInputMismatchException('mismatch');

    expect(error).toBeInstanceOf(DomainConflictException);
    expect(error.code).toBe('IDEMPOTENCY_INPUT_MISMATCH');
  });
});

describe('ConcurrencyConflictException', () => {
  it('extends DomainConflictException with a stable code', () => {
    expect(new ConcurrencyConflictException('x').code).toBe('CONCURRENCY_CONFLICT');
  });
});

describe('DuplicateExternalRefException', () => {
  it('extends DomainConflictException with a stable code', () => {
    expect(new DuplicateExternalRefException('x').code).toBe('DUPLICATE_EXTERNAL_REF');
  });
});
```

**Step 3: Ejecutar y confirmar que falla**

```bash
npx nx test cqrs --testFile=event-store.exception.spec.ts --no-coverage
```

Esperado: FAIL — `IdempotencyInputMismatchException` no existe.

**Step 4: Implementar**

En `libs/cqrs/src/domain/exceptions/event-store.exception.ts`, agregar al final del archivo:

```typescript
/**
 * A command reused an `external_ref` already anchored to different inputs
 * (AC-6). Unlike {@link DuplicateExternalRefException} — the port's defense
 * against a concurrent race on the same inputs — this is the policy's
 * intentional rejection of an accidental reference reuse by an automated
 * client: the original operation is never lost silently.
 */
export class IdempotencyInputMismatchException extends DomainConflictException {
  readonly code: string = 'IDEMPOTENCY_INPUT_MISMATCH';
}
```

**Step 5: Ejecutar y confirmar que pasa**

```bash
npx nx test cqrs --testFile=event-store.exception.spec.ts --no-coverage
```

Esperado: PASS — 3 tests verdes.

---

### Tarea 5: `EnvelopeFactory` estampa `externalRefHash` [X]

**Archivos:**
- Modificar: `libs/cqrs/src/application/event/envelope.factory.ts`
- Test (modificar): `libs/cqrs/src/application/event/envelope.factory.spec.ts`

**Step 1: Escribir el test que falla**

En `envelope.factory.spec.ts`, actualizar el `ctx` del archivo y agregar un caso:

```typescript
const ctx: AuthContext = {
  userId: 'user-1',
  clientId: 'client-x',
  externalRef: 'ref-123',
  externalRefHash: 'hash-abc',
};
```

y agregar, junto al test `'stamps external_ref on the anchor event only'`:

```typescript
  it('stamps external_ref_hash on the anchor event only, mirroring external_ref', () => {
    const envelopes = build().build(
      stream,
      0,
      [new Priced('1', '1'), new Priced('2', '2')],
      ctx,
    );

    expect(envelopes[0].externalRefHash).toBe('hash-abc');
    expect(envelopes[1].externalRefHash).toBeNull();
  });

  it('stamps a null external_ref_hash when the context carries none', () => {
    const bareCtx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

    const [envelope] = build().build(stream, 0, [new Priced('1', '1')], bareCtx);

    expect(envelope.externalRefHash).toBeNull();
  });
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx nx test cqrs --testFile=envelope.factory.spec.ts --no-coverage
```

Esperado: FAIL — `envelopes[0].externalRefHash` es `undefined`, no `'hash-abc'`.

**Step 3: Implementar**

En `libs/cqrs/src/application/event/envelope.factory.ts`, el método `build`:

```typescript
  build(
    stream: StreamId,
    fromVersion: number,
    events: readonly DomainEvent[],
    ctx: AuthContext,
  ): EventEnvelope[] {
    const recordedAt = this.clock.now();

    return events.map((event, index) => ({
      eventId: this.idGenerator.next(),
      userId: stream.userId,
      aggregateType: stream.aggregateType,
      aggregateId: stream.aggregateId,
      sequence: fromVersion + index + 1,
      eventType: event.eventType,
      schemaVersion: event.schemaVersion,
      clientId: ctx.clientId,
      externalRef: index === 0 ? ctx.externalRef : null,
      externalRefHash: index === 0 ? (ctx.externalRefHash ?? null) : null,
      payload: event.toPayload(),
      occurredAt: event.occurredAt() ?? recordedAt,
      recordedAt,
    }));
  }
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx nx test cqrs --testFile=envelope.factory.spec.ts --no-coverage
```

Esperado: PASS — 9 tests verdes (7 existentes + 2 nuevos).

---

### Tarea 6: `IdempotencyPolicy` — hash de inputs y rechazo por mismatch (AC-5, AC-6) [X]

**Archivos:**
- Modificar: `libs/cqrs/src/application/command-bus/policies/idempotency.policy.ts`
- Test (reescribir): `libs/cqrs/src/application/command-bus/policies/idempotency.policy.spec.ts`

**Step 1: Escribir el test que falla**

Reescribir `idempotency.policy.spec.ts` completo:

```typescript
import { Command } from '../command';
import { CommandResult } from '../command-result.type';
import { StoredEvent } from '../../../domain/event/stored-event.type';
import {
  DuplicateExternalRefException,
  IdempotencyInputMismatchException,
} from '../../../domain/exceptions/event-store.exception';
import { InMemoryEventStore } from '../../../infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { canonicalJson, sha256Hex } from '@shared';
import { AuthContext } from '../auth-context.type';
import { IdempotencyPolicy } from './idempotency.policy';

class FakeCommand extends Command {
  readonly commandType = 'FakeCommand';
  constructor(readonly amount: string = '100') { super(); }
}

const ctxWithRef: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: 'ref-1' };
const ctxWithoutRef: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

async function hashOf(command: Command, userId: string): Promise<string> {
  return sha256Hex(await canonicalJson({ userId, command }));
}

function makeAnchor(props: {
  aggregateId: string;
  globalPosition: bigint;
  userId: string;
  externalRef: string;
  externalRefHash: string;
}): StoredEvent {
  return {
    eventId: 'evt-1',
    userId: props.userId,
    aggregateType: 'Test',
    aggregateId: props.aggregateId,
    sequence: 1,
    eventType: 'TestEvent',
    schemaVersion: 1,
    clientId: 'client-x',
    externalRef: props.externalRef,
    externalRefHash: props.externalRefHash,
    payload: {},
    occurredAt: new Date(),
    recordedAt: new Date(),
    globalPosition: props.globalPosition,
  };
}

describe('IdempotencyPolicy', () => {
  let policy: IdempotencyPolicy;
  let eventStore: InMemoryEventStore;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    policy = new IdempotencyPolicy(eventStore);
  });

  it('delegates to next(ctx) unchanged when externalRef is null', async () => {
    const command = new FakeCommand();
    const expected: CommandResult = { aggregateId: 'a-1', streamPosition: 5n, idempotentReplay: false };
    const next = jest.fn<Promise<CommandResult>, [AuthContext]>().mockResolvedValue(expected);

    const result = await policy.handle(command, ctxWithoutRef, next);

    expect(result).toBe(expected);
    expect(next).toHaveBeenCalledWith(ctxWithoutRef);
  });

  it('delegates to next with the ctx enriched by externalRefHash when no anchor is found', async () => {
    const command = new FakeCommand();
    const expected: CommandResult = { aggregateId: 'a-1', streamPosition: 5n, idempotentReplay: false };
    const next = jest.fn<Promise<CommandResult>, [AuthContext]>().mockResolvedValue(expected);

    const result = await policy.handle(command, ctxWithRef, next);

    expect(result).toBe(expected);
    const [passedCtx] = next.mock.calls[0];
    expect(passedCtx.userId).toBe('user-1');
    expect(passedCtx.externalRef).toBe('ref-1');
    expect(passedCtx.externalRefHash).toBe(await hashOf(command, 'user-1'));
  });

  it('replays without calling next when the anchor exists with matching inputs', async () => {
    const command = new FakeCommand();
    const hash = await hashOf(command, 'user-1');
    const anchor = makeAnchor({
      aggregateId: 'agg-99', globalPosition: 42n, userId: 'user-1',
      externalRef: 'ref-1', externalRefHash: hash,
    });
    eventStore['events'].push(anchor);

    const next = jest.fn<Promise<CommandResult>, [AuthContext]>();

    const result = await policy.handle(command, ctxWithRef, next);

    expect(result.aggregateId).toBe('agg-99');
    expect(result.streamPosition).toBe(42n);
    expect(result.idempotentReplay).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with IdempotencyInputMismatchException when the anchor inputs differ (AC-6)', async () => {
    const command = new FakeCommand('999');
    const anchor = makeAnchor({
      aggregateId: 'agg-99', globalPosition: 42n, userId: 'user-1',
      externalRef: 'ref-1', externalRefHash: await hashOf(new FakeCommand('100'), 'user-1'),
    });
    eventStore['events'].push(anchor);

    const next = jest.fn<Promise<CommandResult>, [AuthContext]>();

    await expect(policy.handle(command, ctxWithRef, next)).rejects.toBeInstanceOf(
      IdempotencyInputMismatchException,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('replays when DuplicateExternalRefException races with matching inputs', async () => {
    const command = new FakeCommand();
    const hash = await hashOf(command, 'user-1');
    const anchor = makeAnchor({
      aggregateId: 'agg-50', globalPosition: 10n, userId: 'user-1',
      externalRef: 'ref-1', externalRefHash: hash,
    });

    const next = jest.fn<Promise<CommandResult>, [AuthContext]>().mockImplementation(async () => {
      eventStore['events'].push(anchor);
      throw new DuplicateExternalRefException('race');
    });

    const result = await policy.handle(command, ctxWithRef, next);

    expect(result.aggregateId).toBe('agg-50');
    expect(result.idempotentReplay).toBe(true);
  });

  it('rejects with IdempotencyInputMismatchException when the race anchor inputs differ (AC-6, second path)', async () => {
    const command = new FakeCommand('999');
    const anchor = makeAnchor({
      aggregateId: 'agg-50', globalPosition: 10n, userId: 'user-1',
      externalRef: 'ref-1', externalRefHash: await hashOf(new FakeCommand('100'), 'user-1'),
    });

    const next = jest.fn<Promise<CommandResult>, [AuthContext]>().mockImplementation(async () => {
      eventStore['events'].push(anchor);
      throw new DuplicateExternalRefException('race');
    });

    await expect(policy.handle(command, ctxWithRef, next)).rejects.toBeInstanceOf(
      IdempotencyInputMismatchException,
    );
  });

  it('propagates non-DuplicateExternalRef errors', async () => {
    const error = new Error('some other failure');
    const next = jest.fn<Promise<CommandResult>, [AuthContext]>().mockRejectedValue(error);

    await expect(policy.handle(new FakeCommand(), ctxWithRef, next)).rejects.toBe(error);
  });

  it('propagates DuplicateExternalRefException when no anchor is found on reread (consistency bug)', async () => {
    const next = jest
      .fn<Promise<CommandResult>, [AuthContext]>()
      .mockRejectedValue(new DuplicateExternalRefException('race'));

    await expect(policy.handle(new FakeCommand(), ctxWithRef, next)).rejects.toBeInstanceOf(
      DuplicateExternalRefException,
    );
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx nx test cqrs --testFile=idempotency.policy.spec.ts --no-coverage
```

Esperado: FAIL — `IdempotencyPolicy.handle` todavía ignora el `command`, nunca calcula hash ni
compara, y sigue llamando `next()` sin argumento.

**Step 3: Implementar**

En `libs/cqrs/src/application/command-bus/policies/idempotency.policy.ts`:

```typescript
import { canonicalJson, Nullable, sha256Hex } from '@shared';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import {
  DuplicateExternalRefException,
  IdempotencyInputMismatchException,
} from '@cqrs/domain/exceptions/event-store.exception';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { AuthContext } from '../auth-context.type';
import { Command } from '../command';
import { CommandNext, CommandPolicy } from '../command-policy';
import { CommandResult } from '../command-result.type';

/**
 * Enforces command idempotency by `external_ref` (INV-10) and, since hu-0024,
 * detects an accidental reuse of the same reference with different inputs
 * (AC-6): before it just replayed; now it compares a canonical hash of the
 * inputs against the one stamped on the anchor and rejects on mismatch,
 * instead of silently losing the new operation.
 */
export class IdempotencyPolicy extends CommandPolicy {
  constructor(private readonly eventStore: EventStore) {
    super();
  }

  async handle(command: Command, ctx: AuthContext, next: CommandNext): Promise<CommandResult> {
    if (!ctx.externalRef) return next(ctx);

    const inputHash = await this.hashInputs(command, ctx.userId);
    const existing = await this.eventStore.findByExternalRef(ctx.userId, ctx.externalRef);

    if (existing) return this.resolve(existing, inputHash);

    try {
      return await next({ ...ctx, externalRefHash: inputHash });
    } catch (error) {
      if (error instanceof DuplicateExternalRefException) {
        return this.resolve(await this.requireAnchor(ctx), inputHash);
      }

      throw error;
    }
  }

  /** AC-5: the command's own fields plus `userId`, excluding transport metadata. */
  private async hashInputs(command: Command, userId: string): Promise<string> {
    const canonical = await canonicalJson({ userId, command });
    return sha256Hex(canonical);
  }

  /** AC-6: covers both the pre-check and the race-condition path with the same rule. */
  private resolve(anchor: StoredEvent, inputHash: string): CommandResult {
    if (anchor.externalRefHash !== inputHash) {
      throw new IdempotencyInputMismatchException(
        `external_ref "${anchor.externalRef}" was already used with different inputs`,
      );
    }

    return this.replay(anchor);
  }

  private async requireAnchor(ctx: AuthContext): Promise<StoredEvent> {
    const anchor: Nullable<StoredEvent> = await this.eventStore.findByExternalRef(
      ctx.userId,
      ctx.externalRef as string,
    );

    if (!anchor) {
      throw new DuplicateExternalRefException(
        `external_ref "${ctx.externalRef}" reported duplicate but no anchor was found`,
      );
    }

    return anchor;
  }

  private replay(anchor: StoredEvent): CommandResult {
    return {
      aggregateId: anchor.aggregateId,
      streamPosition: anchor.globalPosition,
      idempotentReplay: true,
    };
  }
}
```

> `canonicalJson`/`sha256Hex` se importan desde `@shared` (el barrel de `libs/shared`), no
> directo de `libs/shared/src/functions` — mismo patrón que el resto de `libs/cqrs` usa para
> consumir `Nullable`, `DomainConflictException`, etc.

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx nx test cqrs --testFile=idempotency.policy.spec.ts --no-coverage
```

Esperado: PASS — 9 tests verdes.

---

### Tarea 7: `CommandResultInterceptor` — cabecera `Idempotency-Hit` (AC-7) [X]

**Archivos:**
- Modificar: `libs/cqrs/src/infrastructure/adapters/http/command-result.interceptor.ts`
- Test (modificar): `libs/cqrs/src/infrastructure/adapters/http/command-result.interceptor.spec.ts`

**Step 1: Escribir el test que falla**

En `command-result.interceptor.spec.ts`, agregar:

```typescript
  it('stamps Idempotency-Hit: true only on a replay', async () => {
    const { setHeader } = await run(commandResult({ idempotentReplay: true }));

    expect(setHeader).toHaveBeenCalledWith('Idempotency-Hit', 'true');
  });

  it('never stamps Idempotency-Hit when the operation actually ran', async () => {
    const { setHeader } = await run(commandResult({ idempotentReplay: false }));

    const calls = setHeader.mock.calls.map(([name]) => name);
    expect(calls).not.toContain('Idempotency-Hit');
  });
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx nx test cqrs --testFile=command-result.interceptor.spec.ts --no-coverage
```

Esperado: FAIL — `setHeader` nunca se llama con `'Idempotency-Hit'`.

**Step 3: Implementar**

En `command-result.interceptor.ts`:

```typescript
import { CallHandler, ExecutionContext, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { Nullable } from '@shared';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
import { CommandAcceptedDto } from './dto/command-accepted.dto';

/** Response header exposing the stream position a write reached. */
export const STREAM_POSITION_HEADER = 'X-Ledger-Stream-Position';

/** Response header present, and only present, when the write was an idempotent replay (AC-7). */
export const IDEMPOTENCY_HIT_HEADER = 'Idempotency-Hit';

function isCommandResult(value: unknown): value is CommandResult {
  const candidate = value as Nullable<CommandResult>;
  return typeof candidate?.streamPosition === 'bigint' && typeof candidate?.idempotentReplay === 'boolean';
}

@Injectable()
export class CommandResultInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value) => this.finalize(value, context)));
  }

  private finalize(value: unknown, context: ExecutionContext): unknown {
    if (!isCommandResult(value)) return value;

    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader(STREAM_POSITION_HEADER, String(value.streamPosition));

    if (value.idempotentReplay) {
      response.setHeader(IDEMPOTENCY_HIT_HEADER, 'true');
      response.status(HttpStatus.OK);
    }

    return CommandAcceptedDto.from(value);
  }
}
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx nx test cqrs --testFile=command-result.interceptor.spec.ts --no-coverage
```

Esperado: PASS — 6 tests verdes.

---

### Tarea 8: Migración `CreateEventStore` — `hash`, `external_ref_hash`, CHECK (AC-2, AC-8) [X]

**Archivos:**
- Modificar: `libs/cqrs/src/infrastructure/adapters/migrations/1790000000001-CreateEventStore.ts`
- Modificar: `apps/ledger/src/shared/infrastructure/adapters/event-store/postgres-event-store.integration.spec.ts`

**Step 1: Editar la migración**

En `1790000000001-CreateEventStore.ts`, reemplazar el `CREATE TABLE`:

```typescript
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_store" (
        "global_position"   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        "event_id"          UUID NOT NULL UNIQUE,
        "user_id"           UUID NOT NULL,
        "aggregate_type"    TEXT NOT NULL,
        "aggregate_id"      UUID NOT NULL,
        "sequence"          BIGINT NOT NULL,
        "event_type"        TEXT NOT NULL,
        "schema_version"    SMALLINT NOT NULL DEFAULT 1,
        "client_id"         TEXT NOT NULL,
        "external_ref"      TEXT,
        "external_ref_hash" CHAR(64),
        "payload"           JSONB NOT NULL,
        "hash"              CHAR(64) NOT NULL,
        "occurred_at"       TIMESTAMPTZ NOT NULL,
        "recorded_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_event_aggregate_sequence" UNIQUE ("aggregate_id", "sequence"),
        CONSTRAINT "ck_event_external_ref_hash"
          CHECK (("external_ref" IS NULL) = ("external_ref_hash" IS NULL))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_event_external_ref"
        ON "event_store" ("user_id", "external_ref")
        WHERE "external_ref" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_event_aggregate" ON "event_store" ("aggregate_id", "sequence")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_event_user" ON "event_store" ("user_id", "global_position")
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION reject_event_mutation() RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'event_store is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER "trg_event_store_immutable"
        BEFORE UPDATE OR DELETE ON "event_store"
        FOR EACH ROW EXECUTE FUNCTION reject_event_mutation()
    `);
  }
```

Actualizar también el JSDoc de la clase para mencionar el encadenamiento y el CHECK (una línea,
consistente con el resto del archivo). El método `down` no cambia (`DROP TABLE` ya cubre las
columnas nuevas).

**Step 2: Arreglar el `INSERT` crudo del test del trigger append-only**

En `apps/ledger/src/shared/infrastructure/adapters/event-store/postgres-event-store.integration.spec.ts`,
localizar el `INSERT` manual dentro de `'rejects UPDATE and DELETE on event_store'` (usa SQL
crudo, no pasa por el adaptador) y agregarle `hash`:

```typescript
  describe('PostgresEventStore append-only trigger (INV-12)', () => {
    it('rejects UPDATE and DELETE on event_store', async () => {
      await makeStore();
      await dataSource.query(
        `INSERT INTO event_store
           (event_id, user_id, aggregate_type, aggregate_id, sequence, event_type,
            client_id, payload, hash, occurred_at, recorded_at)
         VALUES (gen_random_uuid(), gen_random_uuid(), 'Thing', gen_random_uuid(), 1,
            'ThingHappened', 'c', '{}',
            '0000000000000000000000000000000000000000000000000000000000000000',
            now(), now())`,
      );
```

(El valor de `hash` es un placeholder arbitrario de 64 caracteres — este test no ejercita la
cadena, solo el trigger de inmutabilidad.)

**Step 3: Verificar que el archivo sigue tipando (sin correr contra Postgres aún)**

```bash
npx tsc --noEmit -p apps/ledger/tsconfig.spec.json 2>&1 | grep -i "postgres-event-store.integration" || echo "sin errores en el archivo"
```

Esperado: `sin errores en el archivo` (el resto de la suite de Postgres corre en la Tarea 13,
gateada por `RUN_PG_TESTS`).

---

### Tarea 9: `event-store.contract.ts` — `external_ref_hash` de punta a punta (AC-5) [X]

Este contrato es lo único que corre **sin** `RUN_PG_TESTS` y ya prueba el roundtrip de
`external_ref_hash` contra los dos adaptadores (`hash`, en cambio, no es visible por este
puerto — ver Tarea 10).

**Archivos:**
- Modificar: `libs/cqrs/src/infrastructure/testing/event-store.contract.ts`

**Step 1: Escribir el test que falla**

En `event-store.contract.ts`, el helper `anEnvelope` necesita `externalRefHash` en su default, y
se agrega un caso nuevo. Editar:

```typescript
function anEnvelope(stream: StreamId, overrides: EnvelopeOverrides): EventEnvelope {
  counter += 1;
  const now = new Date('2026-07-22T00:00:00.000Z');

  return {
    eventId: `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`,
    userId: stream.userId,
    aggregateType: stream.aggregateType,
    aggregateId: stream.aggregateId,
    eventType: 'ThingHappened',
    schemaVersion: 1,
    clientId: 'client-x',
    externalRef: null,
    externalRefHash: null,
    payload: { amount: '31900' },
    occurredAt: now,
    recordedAt: now,
    ...overrides,
  };
}
```

Y agregar, junto al test `'is idempotent per external_ref and exposes the anchor via
findByExternalRef'`:

```typescript
    it('persists external_ref_hash on the anchor and returns it via findByExternalRef', async () => {
      const stream = streamFor('user-1', 'agg-1');
      await store.append(stream, 0, [
        anEnvelope(stream, { sequence: 1, externalRef: 'ref-1', externalRefHash: 'hash-abc' }),
      ]);

      const anchor = await store.findByExternalRef(uuidFor('user-1'), 'ref-1');

      expect(anchor?.externalRefHash).toBe('hash-abc');
    });

    it('persists a null external_ref_hash when no external_ref is present', async () => {
      const stream = streamFor('user-1', 'agg-1');
      await store.append(stream, 0, [anEnvelope(stream, { sequence: 1 })]);

      const [event] = await store.load(stream);

      expect(event.externalRef).toBeNull();
      expect(event.externalRefHash).toBeNull();
    });
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx nx test cqrs --testFile=in-memory-event-store.spec.ts --no-coverage
```

Esperado: FAIL — el `InMemoryEventStore` actual no rompe (ya reenvía todo el envelope), pero el
tipo `EnvelopeOverrides` requiere revisar; si compila y falla en aserción, es porque el
adaptador in-memory aún no está actualizado formalmente para la Tarea 11 (puede pasar en verde
ya en este punto porque `InMemoryEventStore.append` ya reenvía cualquier campo del envelope
— confirmarlo en el Step 3 y anotarlo si ya pasa).

**Step 3: Ejecutar y confirmar el resultado real**

```bash
npx nx test cqrs --testFile=in-memory-event-store.spec.ts --no-coverage
```

Si PASA ya en este punto (probable: `InMemoryEventStore.append` hoy hace
`{ ...envelope, globalPosition }`, reenvía cualquier campo sin filtrar) → continuar sin cambios
adicionales, el roundtrip de `external_ref_hash` para in-memory queda cubierto. Si falla,
ajustar `InMemoryEventStore.append`/`findByExternalRef` para reenviar el campo (no debería ser
necesario).

---

### Tarea 10: `EventChainReader` — puerto, `ChainRow`, contrato compartido (AC-1, AC-2, AC-3) [X]

Este es el contrato que **sí** expone `hash` — vive separado de `event-store.contract.ts` a
propósito (Decisión 4 de `docs/research.md`): `StoredEvent` nunca lo expone, así que solo un
puerto dedicado puede probarlo.

**Archivos:**
- Crear: `libs/cqrs/src/domain/event/chain-row.type.ts`
- Crear: `libs/cqrs/src/domain/ports/event-chain-reader.ts`
- Crear: `libs/cqrs/src/infrastructure/testing/event-chain-reader.contract.ts`

**Step 1: Tipos y puerto**

En `libs/cqrs/src/domain/event/chain-row.type.ts`:

```typescript
import { ChainHashInput } from './chain-hash-input.type';

/** One event's chain-relevant data, as read back for verification (AC-4). */
export type ChainRow = {
  readonly globalPosition: bigint;
  readonly eventId: string;
  readonly hash: string;
  readonly chainInput: ChainHashInput;
};
```

En `libs/cqrs/src/domain/ports/event-chain-reader.ts`:

```typescript
import { ChainRow } from '@cqrs/domain/event/chain-row.type';

/**
 * Read-only access to the hash chain (AC-4) — the one place `hash` is
 * visible outside the adapter that writes it. Deliberately separate from
 * {@link EventStore}: `StoredEvent` never exposes `hash` (it is a storage
 * derivative, not a domain fact), so `verify-chain` needs its own narrow
 * port instead of widening the main one for every consumer.
 */
export abstract class EventChainReader {
  /** Page of one user's chain, strictly after `fromPosition`, in ascending order. */
  abstract readChain(
    userId: string,
    fromPosition: bigint,
    limit: number,
  ): Promise<readonly ChainRow[]>;

  /** Every user with at least one chained event, for a scope-free `verify-chain` run. */
  abstract userIds(): Promise<readonly string[]>;
}
```

**Step 2: Contrato compartido**

En `libs/cqrs/src/infrastructure/testing/event-chain-reader.contract.ts`:

```typescript
import { canonicalJson, sha256Hex } from '@shared';
import { EventEnvelope } from '@cqrs/domain/event/event-envelope.type';
import { StreamId } from '@cqrs/domain/event/stream-id.type';
import { EventChainReader } from '@cqrs/domain/ports/event-chain-reader';
import { EventStore } from '@cqrs/domain/ports/event-store';

export type MakeChainFixture = () => Promise<{ store: EventStore; reader: EventChainReader }>;

let counter = 0;

function anEnvelope(stream: StreamId, sequence: number): EventEnvelope {
  counter += 1;
  const now = new Date('2026-07-22T00:00:00.000Z');

  return {
    eventId: `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`,
    userId: stream.userId,
    aggregateType: stream.aggregateType,
    aggregateId: stream.aggregateId,
    sequence,
    eventType: 'ThingHappened',
    schemaVersion: 1,
    clientId: 'client-x',
    externalRef: null,
    externalRefHash: null,
    payload: { amount: '31900' },
    occurredAt: now,
    recordedAt: now,
  };
}

/**
 * The chain-specific half of the {@link EventStore} contract (AC-1, AC-2,
 * AC-3): every adapter that writes a chain must also make it readable and
 * verifiable through the same rules, in-memory or PostgreSQL alike.
 */
export function describeEventChainReaderContract(
  makeFixture: MakeChainFixture,
  teardown?: () => Promise<void>,
): void {
  describe('EventChainReader contract', () => {
    afterEach(async () => {
      await teardown?.();
    });

    it('chains the first event of a user against the empty string genesis', async () => {
      const { store, reader } = await makeFixture();
      const stream: StreamId = { userId: 'user-1', aggregateType: 'Thing', aggregateId: 'agg-1' };
      const envelope = anEnvelope(stream, 1);

      await store.append(stream, 0, [envelope]);

      const [row] = await reader.readChain('user-1', 0n, 10);
      const expectedCanonical = await canonicalJson({
        eventId: envelope.eventId,
        userId: envelope.userId,
        aggregateType: envelope.aggregateType,
        aggregateId: envelope.aggregateId,
        sequence: envelope.sequence,
        eventType: envelope.eventType,
        schemaVersion: envelope.schemaVersion,
        clientId: envelope.clientId,
        externalRef: envelope.externalRef,
        payload: envelope.payload,
        occurredAt: envelope.occurredAt.toISOString(),
      });

      expect(row.hash).toBe(sha256Hex('' + expectedCanonical));
    });

    it('chains the second event of a user against the first hash', async () => {
      const { store, reader } = await makeFixture();
      const stream: StreamId = { userId: 'user-1', aggregateType: 'Thing', aggregateId: 'agg-1' };

      await store.append(stream, 0, [anEnvelope(stream, 1)]);
      await store.append(stream, 1, [anEnvelope(stream, 2)]);

      const rows = await reader.readChain('user-1', 0n, 10);

      expect(rows).toHaveLength(2);
      const expectedSecond = sha256Hex(rows[0].hash + (await canonicalJson(rows[1].chainInput)));
      expect(rows[1].hash).toBe(expectedSecond);
    });

    it('chains across different aggregates of the same user, in append order', async () => {
      const { store, reader } = await makeFixture();
      const a: StreamId = { userId: 'user-1', aggregateType: 'Thing', aggregateId: 'agg-a' };
      const b: StreamId = { userId: 'user-1', aggregateType: 'Thing', aggregateId: 'agg-b' };

      await store.append(a, 0, [anEnvelope(a, 1)]);
      await store.append(b, 0, [anEnvelope(b, 1)]);

      const rows = await reader.readChain('user-1', 0n, 10);

      expect(rows).toHaveLength(2);
      const expectedSecond = sha256Hex(rows[0].hash + (await canonicalJson(rows[1].chainInput)));
      expect(rows[1].hash).toBe(expectedSecond);
    });

    it('keeps chains isolated per user (INV-9) — each starts from its own genesis', async () => {
      const { store, reader } = await makeFixture();
      const a: StreamId = { userId: 'user-1', aggregateType: 'Thing', aggregateId: 'agg-1' };
      const b: StreamId = { userId: 'user-2', aggregateType: 'Thing', aggregateId: 'agg-1' };

      await store.append(a, 0, [anEnvelope(a, 1)]);
      await store.append(b, 0, [anEnvelope(b, 1)]);

      const [rowA] = await reader.readChain('user-1', 0n, 10);
      const [rowB] = await reader.readChain('user-2', 0n, 10);

      // Both are genesis events (chain against ''), but their inputs differ
      // (different eventId/userId), so their hashes must differ too.
      expect(rowA.hash).not.toBe(rowB.hash);
    });

    it('serializes concurrent appends to different aggregates of the same user', async () => {
      const { store, reader } = await makeFixture();
      const a: StreamId = { userId: 'user-1', aggregateType: 'Thing', aggregateId: 'agg-a' };
      const b: StreamId = { userId: 'user-1', aggregateType: 'Thing', aggregateId: 'agg-b' };

      await Promise.all([
        store.append(a, 0, [anEnvelope(a, 1)]),
        store.append(b, 0, [anEnvelope(b, 1)]),
      ]);

      const rows = await reader.readChain('user-1', 0n, 10);

      expect(rows).toHaveLength(2);
      // Exactly one chains against the empty genesis; the other chains
      // against the first — never both against '' (the G-3 race this
      // historia closes).
      const secondCanonical = await canonicalJson(rows[1].chainInput);
      expect(rows[1].hash).toBe(sha256Hex(rows[0].hash + secondCanonical));
    });

    it('userIds() lists every user with at least one chained event', async () => {
      const { store, reader } = await makeFixture();
      const a: StreamId = { userId: 'user-1', aggregateType: 'Thing', aggregateId: 'agg-1' };
      const b: StreamId = { userId: 'user-2', aggregateType: 'Thing', aggregateId: 'agg-1' };

      await store.append(a, 0, [anEnvelope(a, 1)]);
      await store.append(b, 0, [anEnvelope(b, 1)]);

      const ids = await reader.userIds();

      expect([...ids].sort()).toEqual(['user-1', 'user-2']);
    });

    it('readChain pagination is exclusive on fromPosition (no skip, no repeat)', async () => {
      const { store, reader } = await makeFixture();
      const stream: StreamId = { userId: 'user-1', aggregateType: 'Thing', aggregateId: 'agg-1' };

      await store.append(stream, 0, [anEnvelope(stream, 1), anEnvelope(stream, 2), anEnvelope(stream, 3)]);

      const firstPage = await reader.readChain('user-1', 0n, 2);
      const secondPage = await reader.readChain('user-1', firstPage[1].globalPosition, 2);

      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(1);
      // `global_position` is an autogenerated identity: the only reliable
      // "no gap, no repeat" assertion is strict ordering across the two
      // pages, not a specific numeric offset.
      expect(secondPage[0].globalPosition).toBeGreaterThan(firstPage[1].globalPosition);
    });
  });
}
```

**Step 2: Confirmar que el contrato no corre solo (sin fixtures aún)**

```bash
npx tsc --noEmit -p libs/cqrs/tsconfig.spec.json 2>&1 | grep -i "event-chain-reader.contract" || echo "tipa sin errores"
```

Esperado: `tipa sin errores` — el archivo compila pero **ningún spec lo invoca todavía** (las
Tareas 11 y 13 lo hacen). No hay "RED" ejecutable hasta entonces; este paso deja el contrato
listo para consumir.

---

### Tarea 11: `InMemoryEventStore` — encadenamiento + `InMemoryEventChainReader` [X]

**Archivos:**
- Modificar: `libs/cqrs/src/infrastructure/adapters/event-store/in-memory/in-memory-event-store.ts`
- Crear: `libs/cqrs/src/infrastructure/adapters/event-store/in-memory/in-memory-event-chain-reader.ts`
- Crear: `libs/cqrs/src/infrastructure/adapters/event-store/in-memory/in-memory-event-chain-reader.spec.ts`

**Step 1: Escribir el test que falla**

En `in-memory-event-chain-reader.spec.ts`:

```typescript
import { describeEventChainReaderContract } from '@cqrs/infrastructure/testing/event-chain-reader.contract';
import { InMemoryEventStore } from '../in-memory-event-store';
import { InMemoryEventChainReader } from './in-memory-event-chain-reader';

describeEventChainReaderContract(async () => {
  const store = new InMemoryEventStore();
  return { store, reader: new InMemoryEventChainReader(store) };
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx nx test cqrs --testFile=in-memory-event-chain-reader.spec.ts --no-coverage
```

Esperado: FAIL — "Cannot find module './in-memory-event-chain-reader'".

**Step 3: Implementar el encadenamiento en `InMemoryEventStore`**

Reescribir `libs/cqrs/src/infrastructure/adapters/event-store/in-memory/in-memory-event-store.ts`:

```typescript
import { canonicalJson, Nullable, sha256Hex } from '@shared';
import { AppendResult } from '@cqrs/domain/event/append-result.type';
import { chainHashInput, ChainHashInput } from '@cqrs/domain/event/chain-hash-input.type';
import { EventEnvelope } from '@cqrs/domain/event/event-envelope.type';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { StreamId } from '@cqrs/domain/event/stream-id.type';
import {
  ConcurrencyConflictException,
  DuplicateExternalRefException,
} from '@cqrs/domain/exceptions/event-store.exception';
import { EventStore } from '@cqrs/domain/ports/event-store';

const GENESIS_HASH = '';

type Chained = { readonly hash: string; readonly chainInput: ChainHashInput };

/**
 * In-memory reference implementation of {@link EventStore}. A single
 * monotonic counter models `global_position`; all invariants are enforced in
 * process, mirroring the PostgreSQL adapter so both pass one contract suite.
 *
 * Chaining (AC-1, AC-2, AC-3) is serialized per user with an async mutex
 * (`userLocks`) rather than Node's single-threadedness alone: `canonicalJson`
 * yields to the event loop (it awaits a dynamic `import()`), so two
 * concurrent `append` calls to the same user's different aggregates could
 * otherwise both read the same "current head" before either commits —
 * exactly the race G-3 exists to close, mirrored here for the in-memory
 * adapter since PostgreSQL closes it with `pg_advisory_xact_lock`.
 */
export class InMemoryEventStore extends EventStore {
  private readonly events: StoredEvent[] = [];
  private readonly chains = new Map<string, Chained>();
  private readonly userLocks = new Map<string, Promise<void>>();
  private nextPosition = 1n;
  private depth = 0;

  async withTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.depth > 0) return work();

    const snapshot = [...this.events];
    const chainsSnapshot = new Map(this.chains);
    const positionBefore = this.nextPosition;
    this.depth += 1;

    try {
      return await work();
    } catch (error) {
      this.events.length = 0;
      this.events.push(...snapshot);
      this.chains.clear();
      for (const [id, chained] of chainsSnapshot) this.chains.set(id, chained);
      this.nextPosition = positionBefore;

      throw error;
    } finally {
      this.depth -= 1;
    }
  }

  async append(
    stream: StreamId,
    expectedVersion: number,
    events: readonly EventEnvelope[],
  ): Promise<AppendResult> {
    if (events.length === 0) {
      return { events: [], version: expectedVersion, lastPosition: 0n };
    }

    return this.withUserLock(stream.userId, async () => {
      const current = this.streamEvents(stream);

      if (current.length !== expectedVersion) {
        throw new ConcurrencyConflictException(
          `Expected version ${expectedVersion} for ${stream.aggregateId}, found ${current.length}`,
        );
      }

      this.ensureConsecutiveSequences(expectedVersion, events);
      this.ensureExternalRefsAreFresh(stream.userId, events);

      let prevHash = this.headHash(stream.userId);
      const stored: StoredEvent[] = [];

      for (const envelope of events) {
        const input = chainHashInput(envelope);
        const hash = sha256Hex(prevHash + (await canonicalJson(input)));
        const record: StoredEvent = { ...envelope, globalPosition: this.nextPosition++ };

        this.chains.set(record.eventId, { hash, chainInput: input });
        stored.push(record);
        prevHash = hash;
      }

      this.events.push(...stored);

      return {
        events: stored,
        version: expectedVersion + stored.length,
        lastPosition: stored[stored.length - 1].globalPosition,
      };
    });
  }

  async load(stream: StreamId): Promise<readonly StoredEvent[]> {
    return this.streamEvents(stream);
  }

  async readAll(fromPosition: bigint, limit: number): Promise<readonly StoredEvent[]> {
    return this.events
      .filter((event) => event.globalPosition > fromPosition)
      .sort((a, b) => Number(a.globalPosition - b.globalPosition))
      .slice(0, limit);
  }

  async findByExternalRef(
    userId: string,
    externalRef: string,
  ): Promise<Nullable<StoredEvent>> {
    return (
      this.events.find(
        (event) => event.userId === userId && event.externalRef === externalRef,
      ) ?? null
    );
  }

  /** Chain-only accessor for {@link InMemoryEventChainReader} — not part of the EventStore port. */
  readChainRows(
    userId: string,
    fromPosition: bigint,
    limit: number,
  ): ReadonlyArray<{ globalPosition: bigint; eventId: string; hash: string; chainInput: ChainHashInput }> {
    return this.events
      .filter((event) => event.userId === userId && event.globalPosition > fromPosition)
      .sort((a, b) => Number(a.globalPosition - b.globalPosition))
      .slice(0, limit)
      .map((event) => {
        const chained = this.chains.get(event.eventId);
        if (!chained) throw new Error(`Missing chain entry for event ${event.eventId}`);
        return {
          globalPosition: event.globalPosition,
          eventId: event.eventId,
          hash: chained.hash,
          chainInput: chained.chainInput,
        };
      });
  }

  /** Chain-only accessor for {@link InMemoryEventChainReader} — not part of the EventStore port. */
  chainedUserIds(): readonly string[] {
    return [...new Set(this.events.map((event) => event.userId))].sort();
  }

  private headHash(userId: string): string {
    const userEvents = this.events
      .filter((event) => event.userId === userId)
      .sort((a, b) => Number(b.globalPosition - a.globalPosition));

    const head = userEvents[0];
    if (!head) return GENESIS_HASH;

    const chained = this.chains.get(head.eventId);
    return chained?.hash ?? GENESIS_HASH;
  }

  /** Async mutex per user, so chain computation never interleaves across concurrent appends. */
  private async withUserLock<T>(userId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.userLocks.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });

    this.userLocks.set(userId, previous.then(() => gate));
    await previous;

    try {
      return await work();
    } finally {
      release();
    }
  }

  private streamEvents(stream: StreamId): StoredEvent[] {
    return this.events
      .filter(
        (event) =>
          event.userId === stream.userId && event.aggregateId === stream.aggregateId,
      )
      .sort((a, b) => a.sequence - b.sequence);
  }

  private ensureConsecutiveSequences(
    expectedVersion: number,
    events: readonly EventEnvelope[],
  ): void {
    const outOfOrder = events.some(
      (event, index) => event.sequence !== expectedVersion + index + 1,
    );

    if (outOfOrder) {
      throw new ConcurrencyConflictException(
        `Batch sequences are not consecutive from version ${expectedVersion}`,
      );
    }
  }

  private ensureExternalRefsAreFresh(
    userId: string,
    events: readonly EventEnvelope[],
  ): void {
    for (const event of events) {
      if (!event.externalRef) continue;

      const clash = this.events.some(
        (stored) => stored.userId === userId && stored.externalRef === event.externalRef,
      );

      if (clash) {
        throw new DuplicateExternalRefException(
          `external_ref "${event.externalRef}" already used by user ${userId}`,
        );
      }
    }
  }
}
```

> `withTransaction`'s rollback ahora también restaura `this.chains` — sin eso, un rollback
> dejaría hashes huérfanos que corromperían el `headHash` de la próxima escritura del mismo
> usuario.

**Step 4: Implementar el adaptador de lectura**

En `in-memory-event-chain-reader.ts`:

```typescript
import { ChainRow } from '@cqrs/domain/event/chain-row.type';
import { EventChainReader } from '@cqrs/domain/ports/event-chain-reader';
import { InMemoryEventStore } from './in-memory-event-store';

/** Pairs with a concrete {@link InMemoryEventStore} to expose its chain for verification. */
export class InMemoryEventChainReader extends EventChainReader {
  constructor(private readonly store: InMemoryEventStore) {
    super();
  }

  async readChain(userId: string, fromPosition: bigint, limit: number): Promise<readonly ChainRow[]> {
    return this.store.readChainRows(userId, fromPosition, limit);
  }

  async userIds(): Promise<readonly string[]> {
    return this.store.chainedUserIds();
  }
}
```

**Step 5: Ejecutar y confirmar que pasa**

```bash
npx nx test cqrs --testFile=in-memory-event-chain-reader.spec.ts --no-coverage
npx nx test cqrs --testFile=in-memory-event-store.spec.ts --no-coverage
```

Esperado: PASS en los dos — el contract test de `EventChainReader` (8 casos) y el contract test
de `EventStore` (ahora con los 2 casos de `external_ref_hash` de la Tarea 9).

---

### Tarea 12: `PostgresEventStore` — lock por usuario + encadenamiento real (AC-1, AC-2, AC-3, AC-5) [X]

**Archivos:**
- Modificar: `libs/cqrs/src/infrastructure/adapters/event-store/postgres/postgres-event-store.ts`
- Modificar: `libs/cqrs/src/infrastructure/adapters/event-store/postgres/event-store.row.type.ts`

**Step 1: Actualizar el tipo de fila**

En `event-store.row.type.ts`:

```typescript
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';

/** Raw `event_store` row as returned by the driver (snake_case, bigints as text). */
export type EventStoreRow = {
  readonly global_position: string;
  readonly event_id: string;
  readonly user_id: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly sequence: string;
  readonly event_type: string;
  readonly schema_version: number;
  readonly client_id: string;
  readonly external_ref: string | null;
  readonly external_ref_hash: string | null;
  readonly payload: Record<string, unknown>;
  readonly occurred_at: Date;
  readonly recorded_at: Date;
};

/** Maps a raw row to a {@link StoredEvent}, keeping positions as `bigint`. Never maps `hash` — that column is invisible to the domain (see `EventChainReader`). */
export function toStoredEvent(row: EventStoreRow): StoredEvent {
  return {
    globalPosition: BigInt(row.global_position),
    eventId: row.event_id,
    userId: row.user_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    sequence: Number(row.sequence),
    eventType: row.event_type,
    schemaVersion: row.schema_version,
    clientId: row.client_id,
    externalRef: row.external_ref,
    externalRefHash: row.external_ref_hash,
    payload: row.payload,
    occurredAt: new Date(row.occurred_at),
    recordedAt: new Date(row.recorded_at),
  };
}
```

**Step 2: Implementar el adaptador**

En `postgres-event-store.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { canonicalJson, Nullable, sha256Hex } from '@shared';
import { AsyncLocalStorage } from 'node:async_hooks';
import { AppendResult } from '@cqrs/domain/event/append-result.type';
import { chainHashInput } from '@cqrs/domain/event/chain-hash-input.type';
import { EventEnvelope } from '@cqrs/domain/event/event-envelope.type';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { StreamId } from '@cqrs/domain/event/stream-id.type';
import {
  ConcurrencyConflictException,
  DuplicateExternalRefException,
} from '@cqrs/domain/exceptions/event-store.exception';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { EventStoreRow, toStoredEvent } from './event-store.row.type';

const UNIQUE_VIOLATION = '23505';
const AGGREGATE_SEQUENCE_CONSTRAINT = 'uq_event_aggregate_sequence';
const EXTERNAL_REF_INDEX = 'idx_event_external_ref';
const GENESIS_HASH = '';

const SELECT_COLUMNS = `
  global_position, event_id, user_id, aggregate_type, aggregate_id, sequence,
  event_type, schema_version, client_id, external_ref, external_ref_hash,
  payload, occurred_at, recorded_at
`;

/**
 * PostgreSQL {@link EventStore} adapter. Passes the same contract as the
 * in-memory double: the append runs in a transaction and translates the
 * unique-violation on `(aggregate_id, sequence)` to a concurrency conflict
 * (INV-7) and on `(user_id, external_ref)` to a duplicate (INV-10).
 *
 * Since hu-0024, every append also chains its events (AC-1, AC-2, AC-3):
 * `pg_advisory_xact_lock` serializes appends by user (re-entrant within the
 * same transaction, so `withTransaction` across several streams of the same
 * user only pays the lock once), then reads the current head via
 * `idx_event_user`, then folds `sha256(prev || canonicalJson(chainHashInput))`
 * across the batch before the single multi-row `INSERT`.
 */
@Injectable()
export class PostgresEventStore extends EventStore {
  private readonly scope = new AsyncLocalStorage<EntityManager>();

  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async withTransaction<T>(work: () => Promise<T>): Promise<T> {
    const running = this.scope.getStore();

    if (running) return work();

    return this.dataSource.transaction((manager) => this.scope.run(manager, work));
  }

  async append(
    stream: StreamId,
    expectedVersion: number,
    events: readonly EventEnvelope[],
  ): Promise<AppendResult> {
    if (!events.length) {
      return { events: [], version: expectedVersion, lastPosition: 0n };
    }

    try {
      const inScope = this.scope.getStore();
      const stored = inScope
        ? await this.insertAll(inScope, stream.userId, events)
        : await this.dataSource.transaction((manager) => this.insertAll(manager, stream.userId, events));

      return {
        events: stored,
        version: expectedVersion + stored.length,
        lastPosition: stored[stored.length - 1].globalPosition,
      };
    } catch (error) {
      throw this.translate(error);
    }
  }

  async load(stream: StreamId): Promise<readonly StoredEvent[]> {
    const rows: EventStoreRow[] = await this.dataSource.query(
      `SELECT ${SELECT_COLUMNS} FROM event_store
       WHERE aggregate_id = $1 AND user_id = $2 ORDER BY sequence ASC`,
      [stream.aggregateId, stream.userId],
    );

    return rows.map(toStoredEvent);
  }

  async readAll(fromPosition: bigint, limit: number): Promise<readonly StoredEvent[]> {
    const rows: EventStoreRow[] = await this.dataSource.query(
      `SELECT ${SELECT_COLUMNS} FROM event_store
       WHERE global_position > $1 ORDER BY global_position ASC LIMIT $2`,
      [fromPosition.toString(), limit],
    );

    return rows.map(toStoredEvent);
  }

  async findByExternalRef(
    userId: string,
    externalRef: string,
  ): Promise<Nullable<StoredEvent>> {
    const rows: EventStoreRow[] = await this.dataSource.query(
      `SELECT ${SELECT_COLUMNS} FROM event_store
       WHERE user_id = $1 AND external_ref = $2 ORDER BY global_position ASC LIMIT 1`,
      [userId, externalRef],
    );

    return rows.length ? toStoredEvent(rows[0]) : null;
  }

  private async insertAll(
    manager: EntityManager,
    userId: string,
    events: readonly EventEnvelope[],
  ): Promise<StoredEvent[]> {
    // Serializes appends per user (AC-2): re-entrant within this transaction,
    // released only on commit/rollback. Never taken across two users in the
    // same transaction (INV-9 guarantees one command touches one user), so
    // there is no cross-user lock-ordering deadlock to guard against.
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [userId]);

    const headRows: { hash: string }[] = await manager.query(
      `SELECT hash FROM event_store WHERE user_id = $1 ORDER BY global_position DESC LIMIT 1`,
      [userId],
    );
    let prevHash = headRows[0]?.hash ?? GENESIS_HASH;

    const valuesClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const event of events) {
      const canonical = await canonicalJson(chainHashInput(event));
      const hash = sha256Hex(prevHash + canonical);
      prevHash = hash;

      const placeholders = Array.from({ length: 14 }, (_, i) => `$${idx + i}`);
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
        event.externalRefHash,
        JSON.stringify(event.payload),
        hash,
        event.occurredAt.toISOString(),
        event.recordedAt.toISOString(),
      );
      idx += 14;
    }

    const rows: EventStoreRow[] = await manager.query(
      `INSERT INTO event_store
         (event_id, user_id, aggregate_type, aggregate_id, sequence, event_type,
          schema_version, client_id, external_ref, external_ref_hash, payload,
          hash, occurred_at, recorded_at)
       VALUES ${valuesClauses.join(', ')}
       RETURNING ${SELECT_COLUMNS}`,
      params,
    );

    return rows.map(toStoredEvent);
  }

  private translate(error: unknown): Error {
    if (!(error instanceof QueryFailedError)) {
      return error instanceof Error ? error : new Error(String(error));
    }

    const driverError = error.driverError as { code?: string; constraint?: string };

    if (driverError?.code !== UNIQUE_VIOLATION) return error;

    if (driverError.constraint === EXTERNAL_REF_INDEX) {
      return new DuplicateExternalRefException('external_ref already used by this user');
    }

    if (driverError.constraint === AGGREGATE_SEQUENCE_CONSTRAINT) {
      return new ConcurrencyConflictException('Aggregate head moved since it was read');
    }

    return new ConcurrencyConflictException(error.message);
  }
}
```

> `insertAll` pasó de 12 a 14 columnas/parámetros por fila: el `Array.from({ length: 14 })` y el
> `idx += 14` reemplazan al `12` hardcodeado — la deuda que `context.md` había señalado
> (`insertAll` acopla el conteo en varios lugares) queda igual de frágil que antes, sin
> agravarla; refactorizarla no es parte del alcance de esta historia.

**Step 3: No hay Step de test aislado aquí**

Este archivo se verifica en la Tarea 13 (su propio `.integration.spec.ts` gateado por
`RUN_PG_TESTS`), reutilizando el contract test de `EventStore` (ya extendido en la Tarea 9) y el
nuevo de `EventChainReader` (Tarea 10) — no duplicar aserciones sueltas acá.

---

### Tarea 13: `PostgresEventChainReader` + verificación de integración (AC-1, AC-2, AC-3, AC-5) [X]

> **Verificación completada al retomar (`/build` resume, 2026-08-08):** con PostgreSQL real
> disponible (contenedor `admin-back-postgres` del repo, puerto 5433, base `ledger_test`
> creada), la corrida `RUN_PG_TESTS=1 DB_URI=postgres://postgres:admin@localhost:5433/ledger_test
> npx nx test ledger --testFile=postgres-event-store.integration.spec.ts --no-coverage` pasó
> **27/27** — contract test de `EventStore` (con los 2 casos de `external_ref_hash`), contract
> de `EventChainReader` (8 casos, incluyendo el advisory-lock por usuario bajo `Promise.all`
> concurrente) y el trigger append-only con el `INSERT` corregido.
>
> **Corrección ejecutada durante la verificación:** el primer run falló en el caso
> preexistente `'rejects a stale expectedVersion and persists nothing (INV-7)'` — bug latente
> del adaptador que la suite real expuso por primera vez (la suite gateada nunca había corrido
> contra una base): `PostgresEventStore` nunca validaba `expectedVersion` (dependía solo del
> constraint UNIQUE `(aggregate_id, sequence)`, que no dispara ante una secuencia nueva).
> Se agregó el pre-check `COUNT(*)` por `(aggregate_id, user_id)` dentro de `insertAll` (después
> del advisory lock, viendo escrituras hermanas del mismo `withTransaction`; el constraint sigue
> siendo el árbitro final bajo concurrencia real), espejo exacto del check del `InMemoryEventStore`.
> El `InMemoryEventStore` ya rechazaba este caso — el contrato nunca lo había ejercitado contra
> Postgres hasta hoy.

**Archivos:**
- Crear: `libs/cqrs/src/infrastructure/adapters/event-store/postgres/postgres-event-chain-reader.ts`
- Modificar: `apps/ledger/src/shared/infrastructure/adapters/event-store/postgres-event-store.integration.spec.ts`

**Step 1: Implementar el adaptador**

En `postgres-event-chain-reader.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ChainHashInput } from '@cqrs/domain/event/chain-hash-input.type';
import { ChainRow } from '@cqrs/domain/event/chain-row.type';
import { EventChainReader } from '@cqrs/domain/ports/event-chain-reader';
import { DataSource } from 'typeorm';

type ChainQueryRow = {
  readonly global_position: string;
  readonly event_id: string;
  readonly user_id: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly sequence: string;
  readonly event_type: string;
  readonly schema_version: number;
  readonly client_id: string;
  readonly external_ref: string | null;
  readonly payload: Record<string, unknown>;
  readonly occurred_at: Date;
  readonly hash: string;
};

const CHAIN_COLUMNS = `
  global_position, event_id, user_id, aggregate_type, aggregate_id, sequence,
  event_type, schema_version, client_id, external_ref, payload, occurred_at, hash
`;

/** Reads the chain the same way {@link PostgresEventStore} wrote it — the only place `hash` leaves the adapter. */
@Injectable()
export class PostgresEventChainReader extends EventChainReader {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async readChain(userId: string, fromPosition: bigint, limit: number): Promise<readonly ChainRow[]> {
    const rows: ChainQueryRow[] = await this.dataSource.query(
      `SELECT ${CHAIN_COLUMNS} FROM event_store
       WHERE user_id = $1 AND global_position > $2
       ORDER BY global_position ASC LIMIT $3`,
      [userId, fromPosition.toString(), limit],
    );

    return rows.map((row) => ({
      globalPosition: BigInt(row.global_position),
      eventId: row.event_id,
      hash: row.hash,
      chainInput: this.toChainHashInput(row),
    }));
  }

  async userIds(): Promise<readonly string[]> {
    const rows: { user_id: string }[] = await this.dataSource.query(
      'SELECT DISTINCT user_id FROM event_store ORDER BY user_id',
    );

    return rows.map((row) => row.user_id);
  }

  private toChainHashInput(row: ChainQueryRow): ChainHashInput {
    return {
      eventId: row.event_id,
      userId: row.user_id,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      sequence: Number(row.sequence),
      eventType: row.event_type,
      schemaVersion: row.schema_version,
      clientId: row.client_id,
      externalRef: row.external_ref,
      payload: row.payload,
      occurredAt: new Date(row.occurred_at).toISOString(),
    };
  }
}
```

**Step 2: Enchufar los dos contratos en la suite de integración**

En `postgres-event-store.integration.spec.ts`, dentro del bloque `if (runPgTests) { ... }`,
después de `describeEventStoreContract(makeStore);`, agregar:

```typescript
  describeEventChainReaderContract(async () => {
    const store = await makeStore();
    return { store, reader: new PostgresEventChainReader(dataSource) };
  });
```

y los imports correspondientes al inicio del archivo:

```typescript
import { describeEventChainReaderContract } from '@cqrs/infrastructure/testing/event-chain-reader.contract';
import { PostgresEventChainReader } from '@cqrs/infrastructure/adapters/event-store/postgres/postgres-event-chain-reader';
```

**Step 3: Ejecutar contra Postgres real**

```bash
RUN_PG_TESTS=1 DB_URI=postgres://postgres:postgres@localhost:5432/ledger_test \
  npx nx test ledger --testFile=postgres-event-store.integration.spec.ts --no-coverage
```

Esperado: PASS — el contract test de `EventStore` (con los 2 casos de `external_ref_hash`) y el
de `EventChainReader` (8 casos), más el test del trigger append-only ajustado en la Tarea 8,
todos en verde contra PostgreSQL real. Si no hay una base disponible en este paso, anotarlo
explícitamente y no marcar la tarea como completa — la Tarea 19 (final) exige esta corrida.

---

### Tarea 14: `ChainVerifier` + `ChainVerificationReport` (AC-4) [X]

> **Corrección ejecutada durante `/build`:** el plan encadenaba el `prevHash` de la fila
> siguiente contra el hash **persistido**, no contra el **recomputado**. Con eso, una única fila
> alterada producía **dos** rupturas (la propia + la de la fila siguiente, cuyo hash real fue
> escrito contra el valor verdadero, no el corrupto) en vez de una sola — el test
> `'scopes to a single user when userId is given'` lo detectó en RED. Se corrigió a
> `prevHash = expected` (el valor recomputado) tanto en el código como en la prosa de
> `docs/flows/verify-chain.md`.

**Archivos:**
- Crear: `apps/ledger/src/tooling/chain-verification-report.type.ts`
- Crear: `apps/ledger/src/tooling/chain-verifier.ts`
- Test: `apps/ledger/src/tooling/chain-verifier.spec.ts`

**Step 1: Tipo del reporte**

En `chain-verification-report.type.ts`:

```typescript
export type ChainBreak = {
  readonly userId: string;
  readonly globalPosition: bigint;
  readonly eventId: string;
  readonly expectedHash: string;
  readonly actualHash: string;
};

export type ChainVerificationReport = {
  readonly ok: boolean;
  readonly usersChecked: number;
  readonly eventsChecked: number;
  readonly breaks: readonly ChainBreak[];
};
```

**Step 2: Escribir el test que falla**

En `chain-verifier.spec.ts` — un doble in-memory de `EventChainReader` construido a mano (no el
`InMemoryEventChainReader` real, para poder inyectar una fila corrupta sin pasar por
`InMemoryEventStore.append`):

```typescript
import { canonicalJson, sha256Hex } from '@shared';
import { ChainRow } from '@cqrs/domain/event/chain-row.type';
import { EventChainReader } from '@cqrs/domain/ports/event-chain-reader';
import { ChainVerifier } from './chain-verifier';

class FakeChainReader extends EventChainReader {
  constructor(private readonly rowsByUser: Record<string, ChainRow[]>) { super(); }

  async readChain(userId: string, fromPosition: bigint, limit: number): Promise<readonly ChainRow[]> {
    return (this.rowsByUser[userId] ?? [])
      .filter((row) => row.globalPosition > fromPosition)
      .slice(0, limit);
  }

  async userIds(): Promise<readonly string[]> {
    return Object.keys(this.rowsByUser);
  }
}

async function chainOf(
  userId: string,
  count: number,
  corruptAt?: number,
): Promise<ChainRow[]> {
  const rows: ChainRow[] = [];
  let prevHash = '';

  for (let i = 1; i <= count; i += 1) {
    const chainInput = {
      eventId: `evt-${userId}-${i}`,
      userId,
      aggregateType: 'Thing',
      aggregateId: 'agg-1',
      sequence: i,
      eventType: 'ThingHappened',
      schemaVersion: 1,
      clientId: 'client-x',
      externalRef: null,
      payload: { n: i },
      occurredAt: '2026-07-22T00:00:00.000Z',
    };
    const correctHash = sha256Hex(prevHash + (await canonicalJson(chainInput)));
    const hash = i === corruptAt ? 'tampered'.padEnd(64, '0') : correctHash;

    rows.push({ globalPosition: BigInt(i), eventId: chainInput.eventId, hash, chainInput });
    prevHash = correctHash; // the real chain continues from the correct hash even if this row lies
  }

  return rows;
}

describe('ChainVerifier', () => {
  it('reports ok for an intact chain', async () => {
    const rows = await chainOf('user-1', 3);
    const verifier = new ChainVerifier(new FakeChainReader({ 'user-1': rows }));

    const report = await verifier.verifyChain();

    expect(report.ok).toBe(true);
    expect(report.usersChecked).toBe(1);
    expect(report.eventsChecked).toBe(3);
    expect(report.breaks).toEqual([]);
  });

  it('reports every break without stopping at the first one (AC-4)', async () => {
    const rowsA = await chainOf('user-a', 3, 2);
    const rowsB = await chainOf('user-b', 2, 1);
    const verifier = new ChainVerifier(new FakeChainReader({ 'user-a': rowsA, 'user-b': rowsB }));

    const report = await verifier.verifyChain();

    expect(report.ok).toBe(false);
    expect(report.breaks).toHaveLength(2);
    expect(report.breaks.map((b) => b.userId).sort()).toEqual(['user-a', 'user-b']);
  });

  it('scopes to a single user when userId is given', async () => {
    const rows = await chainOf('user-1', 2, 1);
    const other = await chainOf('user-2', 2);
    const verifier = new ChainVerifier(new FakeChainReader({ 'user-1': rows, 'user-2': other }));

    const report = await verifier.verifyChain('user-1');

    expect(report.usersChecked).toBe(1);
    expect(report.breaks).toHaveLength(1);
    expect(report.breaks[0].userId).toBe('user-1');
  });

  it('an empty database reports ok with zero users checked', async () => {
    const verifier = new ChainVerifier(new FakeChainReader({}));

    const report = await verifier.verifyChain();

    expect(report).toEqual({ ok: true, usersChecked: 0, eventsChecked: 0, breaks: [] });
  });

  it('a user with no events reports ok with zero events checked', async () => {
    const verifier = new ChainVerifier(new FakeChainReader({ 'user-1': [] }));

    const report = await verifier.verifyChain('user-1');

    expect(report).toEqual({ ok: true, usersChecked: 1, eventsChecked: 0, breaks: [] });
  });
});
```

**Step 3: Ejecutar y confirmar que falla**

```bash
npx nx test ledger --testFile=chain-verifier.spec.ts --no-coverage
```

Esperado: FAIL — "Cannot find module './chain-verifier'".

**Step 4: Implementar**

En `chain-verifier.ts`:

```typescript
import { canonicalJson, sha256Hex } from '@shared';
import { EventChainReader } from '@cqrs/domain/ports/event-chain-reader';
import { ChainBreak, ChainVerificationReport } from './chain-verification-report.type';

const DEFAULT_PAGE_SIZE = 1000;
const GENESIS_HASH = '';

/**
 * Recomputes each event's hash from its own chain input and compares it
 * against the persisted one (AC-4). Never stops at the first break: it walks
 * the full chain and reports every discrepancy, chaining forward with the
 * *recomputed* hash — not the persisted one — as the next `prevHash`. A row
 * whose stored `hash` was corrupted still had its true chain hash written
 * correctly into the *next* row's own hash by the original `append`; trusting
 * the recomputed value instead of the tampered one is what keeps a single
 * altered row from cascading into a false break on every row after it.
 * Read-only: never calls anything that writes to the event store.
 */
export class ChainVerifier {
  constructor(
    private readonly reader: EventChainReader,
    private readonly pageSize: number = DEFAULT_PAGE_SIZE,
  ) {}

  async verifyChain(userId?: string): Promise<ChainVerificationReport> {
    const userIds = userId ? [userId] : await this.reader.userIds();

    let eventsChecked = 0;
    const breaks: ChainBreak[] = [];

    for (const id of userIds) {
      const result = await this.verifyUser(id);
      eventsChecked += result.eventsChecked;
      breaks.push(...result.breaks);
    }

    return {
      ok: breaks.length === 0,
      usersChecked: userIds.length,
      eventsChecked,
      breaks,
    };
  }

  private async verifyUser(userId: string): Promise<{ eventsChecked: number; breaks: ChainBreak[] }> {
    let prevHash = GENESIS_HASH;
    let position = 0n;
    let eventsChecked = 0;
    const breaks: ChainBreak[] = [];

    for (;;) {
      const page = await this.reader.readChain(userId, position, this.pageSize);
      if (!page.length) break;

      for (const row of page) {
        const expected = sha256Hex(prevHash + (await canonicalJson(row.chainInput)));

        if (expected !== row.hash) {
          breaks.push({
            userId,
            globalPosition: row.globalPosition,
            eventId: row.eventId,
            expectedHash: expected,
            actualHash: row.hash,
          });
        }

        // Chain forward with the recomputed value, not the persisted one —
        // one tampered row must not cascade into every row after it.
        prevHash = expected;
        eventsChecked += 1;
      }

      position = page[page.length - 1].globalPosition;
    }

    return { eventsChecked, breaks };
  }
}
```

**Step 5: Ejecutar y confirmar que pasa**

```bash
npx nx test ledger --testFile=chain-verifier.spec.ts --no-coverage
```

Esperado: PASS — 5 tests verdes.

---

### Tarea 15: Wiring del CLI — subcomando `verify-chain` (AC-4) [X]

> **Prueba manual completada al retomar (`/build` resume, 2026-08-08)** contra PostgreSQL real
> (contenedor `admin-back-postgres` del repo, base `ledger` regenerada desde cero):
>
> - Base vacía → `Chain verified: 0 users, 0 events, 0 breaks.` exit `0`.
> - Con 3 eventos encadenados (seed con hashes calculados por `canonicalize`+`sha256`) →
>   `Chain verified: 1 users, 3 events, 0 breaks.` exit `0`.
> - Corrompiendo el `hash` del evento 2 (trigger deshabilitado → `UPDATE` → re-habilitado) →
>   `BROKEN user=... pos=2 evt=...` con `expected`/`got`, `Chain FAILED: 1 users, 3 events, 1 breaks.`
>   y exit `1` — **una sola ruptura, sin cascada al evento 3** (confirma en runtime real la
>   corrección de la Tarea 14 de encadenar con el hash recomputado). Hash restaurado después.
> - `--userId` (scoping) cubierto por los tests unitarios de `chain-verifier.spec.ts`.
>
> **Nota de entorno (no es defecto de la historia):** el target `nx run ledger:verify-chain` (y
> los preexistentes `verify-balances`/`rebuild`) no arrancan en este entorno con la invocación
> cruda — ts-node v10 + `module: esnext` del base + Node 24 rompen la resolución de paths
> (`Couldn't find tsconfig.json`), y con `tsconfig.app.json` (commonjs) el `import()` dinámico
> de `canonicalize` se baja a `require()` y falla contra el paquete ESM-only. Se probó con
> `node -r ts-node/register -r tsconfig-paths/register` + `TS_NODE_PROJECT=apps/ledger/tsconfig.app.json`
> + un shim local de resolución de `canonicalize` (espejo del `moduleNameMapper` de jest,
> fuera del repo). El target en `project.json` es idéntico al patrón preexistente — si el
> tooling del repo se mueve a `tsx` o `--esm` en el futuro, el target hereda la solución.

**Archivos:**
- Modificar: `apps/ledger/src/tooling/rebuild.command.ts`
- Modificar: `apps/ledger/project.json`

**Step 1: Agregar el subcomando**

En `rebuild.command.ts`, agregar los imports:

```typescript
import { PostgresEventChainReader } from '@cqrs/infrastructure/adapters/event-store/postgres/postgres-event-chain-reader';
import { ChainVerifier } from '@ledger/tooling/chain-verifier';
```

Actualizar el mensaje de uso:

```typescript
  if (!command) {
    console.error(
      'Usage: ts-node rebuild.command.ts <rebuild|rebuildAll|verify-balances|verify-chain> [--projection <name>] [--userId <uuid>]',
    );
    process.exit(1);
  }
```

Y el nuevo `case` dentro del `switch`, junto a `verify-balances`:

```typescript
      case 'verify-chain': {
        const userId = parseArg(args, '--userId');
        const chainReader = new PostgresEventChainReader(dataSource);
        const verifier = new ChainVerifier(chainReader);
        const report = await verifier.verifyChain(userId);

        for (const b of report.breaks) {
          console.log(`BROKEN  user=${b.userId}  pos=${b.globalPosition}  evt=${b.eventId}`);
          console.log(`  expected ${b.expectedHash}  got ${b.actualHash}`);
        }

        const status = report.ok ? 'verified' : 'FAILED';
        console.log(
          `Chain ${status}: ${report.usersChecked} users, ${report.eventsChecked} events, ${report.breaks.length} breaks.`,
        );

        if (!report.ok) process.exitCode = 1;
        break;
      }
```

> `process.exitCode = 1` (no `process.exit(1)`): así el `finally { await dataSource.destroy(); }`
> alcanza a correr antes de que el proceso termine.

**Step 2: Agregar el target de nx**

En `apps/ledger/project.json`, junto a `"verify-balances"`:

```json
    "verify-chain": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx ts-node -r tsconfig-paths/register apps/ledger/src/tooling/rebuild.command.ts verify-chain"
      }
    }
```

**Step 3: Verificar que compila**

```bash
npx tsc --noEmit -p apps/ledger/tsconfig.app.json
```

Esperado: sin errores.

**Step 4: Prueba manual contra Postgres (si hay base disponible)**

```bash
DB_URI=postgres://postgres:postgres@localhost:5433/ledger \
  npx nx run ledger:verify-chain
```

Esperado: `Chain verified: N users, M events, 0 breaks.` con exit code `0`
(`echo $?` → `0`), o el listado de rupturas con exit code `1` si la base tiene datos
preexistentes sin `hash` (base vieja no regenerada — ver Tarea 19).

---

### Tarea 16: `LEDGER_ERROR_CODE` + mapeo congelado (AC-6) [X]

**Archivos:**
- Modificar: `apps/ledger/src/shared/domain/errors/ledger-error-code.ts`
- Modificar: `apps/ledger/src/shared/infrastructure/adapters/http/ledger-error-code-mapping.spec.ts`

**Step 1: Escribir el test que falla**

En `ledger-error-code-mapping.spec.ts`, agregar el import:

```typescript
import {
  ConcurrencyConflictException,
  DuplicateExternalRefException,
  IdempotencyInputMismatchException,
} from '@cqrs/domain/exceptions/event-store.exception';
```

y una fila en el array `cases`, junto a la de `DuplicateExternalRefException`:

```typescript
    [new IdempotencyInputMismatchException('mismatch'), HttpStatus.CONFLICT, LEDGER_ERROR_CODE.IDEMPOTENCY_INPUT_MISMATCH],
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx nx test ledger --testFile=ledger-error-code-mapping.spec.ts --no-coverage
```

Esperado: FAIL de compilación — `LEDGER_ERROR_CODE.IDEMPOTENCY_INPUT_MISMATCH` no existe.

**Step 3: Implementar**

En `ledger-error-code.ts`, dentro del grupo `// Platform`:

```typescript
  // Platform
  DUPLICATE_EXTERNAL_REF: 'DUPLICATE_EXTERNAL_REF',
  IDEMPOTENCY_INPUT_MISMATCH: 'IDEMPOTENCY_INPUT_MISMATCH',
  CONCURRENCY_CONFLICT: 'CONCURRENCY_CONFLICT',
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx nx test ledger --testFile=ledger-error-code-mapping.spec.ts --no-coverage
```

Esperado: PASS — la tabla congelada crece en una fila, el resto intacto.

---

### Tarea 17: Enmienda al Artículo 6 de la constitución [X]

No es código — es la corrección normativa que `design.md` dejó pendiente (G-1): la
constitución hoy afirma que repetir un `external_ref` "retorna el resultado original" sin
condición; AC-6 le agrega la condición que le faltaba.

> **Corrección ejecutada durante `/build`:** el agente `conventions-reviewer` detectó que el
> plan no había contemplado la sección "Gobernanza" del propio `docs/rules.md` (líneas 261-274):
> toda enmienda exige `version` y `last_amended` actualizados en el frontmatter. Se agregó ese
> paso — `version: 1.1.0 → 1.2.0` (MINOR, porque la enmienda agrega comportamiento nuevo al
> Artículo 6, no solo aclara redacción) y `last_amended: 2026-08-08`.

**Archivos:**
- Modificar: `docs/rules.md`

**Step 1: Reemplazar el Artículo 6**

En `docs/rules.md`, sección `### Artículo 6: Idempotencia por referencia externa`:

```markdown
### Artículo 6: Idempotencia por referencia externa

**Principio:** Todo command que acepte `external_ref` es idempotente: repetirlo con la
misma referencia **y los mismos inputs** para el mismo usuario nunca emite eventos
nuevos y retorna el resultado original. Repetirlo con la misma referencia e **inputs
distintos** se rechaza de forma explícita (`IDEMPOTENCY_INPUT_MISMATCH`, 409): devolver
el resultado viejo perdería la operación nueva en silencio.

**Razón:** los clientes automatizados (integraciones bancarias) reintentan; sin la
primera mitad de la garantía se duplicarían transacciones reales (INV-10, RNF-4). Sin
la segunda, un reuso accidental de la referencia con datos distintos se resolvía
silenciosamente contra el resultado viejo — el fallo que hu-0024 cierra.

**Cómo se verifica:** tests de idempotencia por handler + el contract test de
`IdempotencyPolicy` que cubre los dos caminos (pre-check y carrera concurrente).

*Alcance: `apps/ledger`.*
```

**Step 2: Verificar que no quedan referencias a la redacción vieja**

```bash
grep -rn "nunca emite eventos.*nuevos.*retorna el resultado original" docs/rules.md
```

Esperado: la única coincidencia es la nueva redacción (con "y los mismos inputs" antes de
"para el mismo usuario").

---

### Tarea 18: Suite completa — in-memory y PostgreSQL (final) [X]

> **Verificación completada al retomar (`/build` resume, 2026-08-08)** con PostgreSQL real
> disponible (contenedor `admin-back-postgres` del repo, puerto 5433):
>
> - **Step 1 (in-memory): PASS.** `shared` 69/69 · `cqrs` 134/136 (2 skipped, gateados) ·
>   `ledger` 547/550 (3 skipped, gateados) — mismos números verdes que la sesión anterior.
> - **Step 2 (PostgreSQL): verificado para el alcance de la historia.** Con `RUN_PG_TESTS=1
>   DB_URI=postgres://postgres:admin@localhost:5433/ledger_test` (base migrada completa:
>   `npm run migration:run:ledger` sobre una `ledger_test` recreada):
>   - `postgres-event-store.integration.spec.ts` → **27/27** (contract `EventStore` con los 2
>     casos de `external_ref_hash`, contract `EventChainReader` 8 casos incl. advisory-lock bajo
>     concurrencia, trigger append-only).
>   - **26 fallos preexistentes fuera del alcance de esta historia**, en 2 specs gateados que
>     **nunca corrieron en CI** (`ci.yml` no setea `RUN_PG_TESTS`):
>     `transaction-finder.postgres.spec.ts` y `read-model-readers.postgres.spec.ts` — sus
>     fixtures siembran labels legibles (`tx-1`, `user-1`, `a-1`) en columnas `uuid` de las
>     migraciones (`proj_transactions`, `proj_assertions`, …). Confirmado preexistente por
>     `git diff`: hu-0024 solo agrega `externalRefHash: null` (corrección de Tarea 18, Step 1)
>     en uno de los dos; el otro no está tocado. **Decisión del usuario (2026-08-08): cerrar
>     Step 2 como verificado para la historia**, registrando la deuda para una historia
>     separada.
> - **Step 3 (migraciones): OK.** Base `ledger` de desarrollo recreada desde cero (tenía 3
>   filas de prueba con el esquema viejo sin `hash`) y `npm run migration:run:ledger` aplicó las
>   7 migraciones, incluyendo la reescrita `CreateEventStore` con `hash`, `external_ref_hash` y
>   el CHECK `ck_event_external_ref_hash`. Base `ledger_test` recreada e idem.
> - **Step 4 (lint):** `shared` limpio · `cqrs` 3 errores preexistentes (métodos vacíos en
>   specs que HEAD ya tenía) · `ledger` 141 errores preexistentes de `import-x/order` +
>   `no-console` del CLI (ninguno en archivos de esta historia — verificado por diff; los 2
>   fixes de `chain-verifier` ya los hizo la sesión anterior).
>
> **Corrección ejecutada en la sesión original de `/build` (conservada):** al correr la suite
> completa de `apps/ledger` aparecieron **11 sitios más** que construían un
> `EventEnvelope`/`StoredEvent` a mano sin `externalRefHash` — ninguno estaba anticipado ni por
> el plan ni por la corrección de Tarea 3 (que solo cubrió `libs/cqrs`). Se agregó
> `externalRefHash: null` (o el valor correspondiente) en los 11 sitios, en 10 archivos:
> `account-tree.projector.spec.ts`, `reevaluate-assertions.reactor.spec.ts` (2 sitios),
> `reconciliation.pump.spec.ts`, `read-model-adjustment-audit-reader.spec.ts`,
> `read-model-readers.postgres.spec.ts`, `adjustment-audit.projector.spec.ts`,
> `reconciliation.discrepancy.e2e.spec.ts`, `reconciliation.rebuild.spec.ts`,
> `account-balances.projector.spec.ts`, `pending-review.projector.spec.ts`,
> `transaction-list.projector.spec.ts`. Verificado con
> `npx tsc --noEmit -p apps/ledger/tsconfig.spec.json` hasta cero errores antes de correr la
> suite.
>
> **Corrección de código registrada en este resume:** `PostgresEventStore.insertAll` ganó el
> pre-check de `expectedVersion` (bug preexistente INV-7 expuesto por la suite PG real, ver
> Tarea 13).

**Step 1: Suite in-memory (siempre corre, sin base)**

```bash
npx nx test shared --no-coverage
npx nx test cqrs --no-coverage
npx nx test ledger --no-coverage
```

Esperado: PASS — todos los tests de las tres unidades, incluidos los específicos de esta
historia (canonical-hash, chain-hash-input, event-store.exception, envelope.factory,
idempotency.policy, command-result.interceptor, command-bus, authenticated-context.policy,
optimistic-concurrency.policy, in-memory-event-chain-reader, in-memory-event-store,
chain-verifier, ledger-error-code-mapping).

**Step 2: Suite contra PostgreSQL real (exigida por la historia — decisión G-6)**

```bash
RUN_PG_TESTS=1 DB_URI=postgres://postgres:postgres@localhost:5432/ledger_test \
  npx nx test ledger --no-coverage
```

Esperado: PASS — incluye el contract test de `EventStore` y de `EventChainReader` contra
Postgres real, y el test del trigger append-only con el `INSERT` corregido.

> Si no hay una base de test disponible en este entorno, la historia **no se considera
> terminada**: la decisión G-6 del diseño fue explícita en que el advisory lock, el CHECK y
> el encadenamiento bajo concurrencia real solo existen en Postgres — el in-memory los simula
> pero no los prueba. Reportarlo como bloqueante, no como verde parcial.

**Step 3: Regenerar la base local si existe una viva (la migración se reescribió, no se agregó)**

```bash
npm run migration:run:ledger
```

Si falla porque la tabla `event_store` ya existe con el esquema viejo (sin `hash`), la base
debe recrearse desde cero (CLAUDE.md lo habilita — fase de desarrollo sin datos que proteger):
dropear la base de desarrollo/test y volver a correr las migraciones.

**Step 4: Lint**

```bash
npx nx lint shared --no-cache
npx nx lint cqrs --no-cache
npx nx lint ledger --no-cache
```

Esperado: sin errores nuevos.
