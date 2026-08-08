# refactor-module-boundaries: Fronteras reales entre bounded contexts — Plan de Implementación

**Historia:** `work/active/refactor-module-boundaries/`
**App:** `apps/ledger` (única; `libs/cqrs` no se toca)
**Objetivo:** Eliminar el acoplamiento entre los cinco bounded contexts y dejar una sola raíz de composición, sin cambiar el contrato HTTP.
**Arquitectura:** Kernel compartido para los tipos que tres módulos ya usaban de facto; cruce `ledger → accounts` por `CommandBus` en lugar del agregado ajeno; composition root fuera del módulo de negocio; un puerto anti-corrupción donde el cruce de lectura lo amerita. Todo protegido por dos guards en CI.
**Stack:** NestJS · TypeScript · event sourcing · PostgreSQL · Jest

### El patrón que ordena este plan: allowlist con trinquete

Un guard escrito como `expect(violations).toEqual([])` estaría en rojo desde la Tarea 1 hasta la última, y once tareas seguidas en rojo no son TDD: son una suite rota.

Por eso los dos guards (Tareas 1 y 2) nacen **verdes**, con la lista explícita de las violaciones que hoy existen. A partir de ahí, cada tarea empieza **borrando su entrada de la allowlist** — eso la pone en rojo — y termina moviendo el código para volver a verde. La allowlist se vacía sola y nunca hay una tarea sin ciclo rojo→verde.

Efecto lateral deseado: la allowlist es la deuda escrita en el código. Si el refactor se interrumpe a mitad, lo que falta está enumerado en un archivo que corre en CI, no en un documento.

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 (kernel compartido) | Tarea 3 |
| AC-2 (guard de módulos en CI) | Tarea 1, y cada tarea que vacía una entrada (3, 5, 10, 11) |
| AC-3 (`InitializeLedger` sin agregado ajeno) | Tarea 4, Tarea 5 |
| AC-4 (composition root fuera del módulo) | Tarea 6 |
| AC-5 (`ReferenceModule` por puerto) | Tarea 7 |
| AC-6 (un solo binding vivo) | Tarea 2, Tarea 8 |
| AC-7 (read model unidireccional) | Tarea 9 |
| AC-8 (contratos de esquema declarados) | Tarea 10, Tarea 11 |
| AC-9 (topología) | Tarea 12 |
| AC-10 (nombres de puertos) | Tarea 13 |
| AC-11 (barrels, reinterpretado por Art. 13) | Tarea 14 |
| AC-12 (sin regresión ni cambio de contrato) | Tarea 15 |

---

### Tarea 0: Preparar rama de trabajo [X]

> Baseline capturado: **520 passed, 3 skipped, 523 total** en 88 suites.

**Decidido:** se trabaja sobre `feat/core`, sin rama nueva — es donde vive el trabajo del ledger y donde se ejecutó `refactor-read-side-ports`.

**Step 1: Verificar el punto de partida (read-only)**

```bash
git branch --show-current    # esperado: feat/core
git status --porcelain       # esperado: solo work/active/refactor-module-boundaries/
```

Esperado: en `feat/core`, sin cambios de código sin commitear. Si el working tree tiene cambios en `apps/` → detener y decidir qué hacer con ellos antes de empezar.

**Step 2: Capturar el baseline de la suite**

```bash
npx jest apps/ledger --no-coverage 2>&1 | tail -5
```

Esperado: PASS, y anotar el número de tests. AC-12 exige terminar con ese número o más.

---

## Fase 1 — Red de seguridad (antes de mover una sola línea)

### Tarea 1: Guard de fronteras entre módulos [X]

**Archivos:**
- Modificar: `apps/ledger/src/hexagonal-isolation.spec.ts`

**Step 1: Escribir el test que falla**

Agregar al final de `hexagonal-isolation.spec.ts`, reusando `sourceFiles()` y `importsOf()` que ya existen:

```typescript
/** The five bounded contexts. `shared` is the kernel: reaching it is always legal. */
const MODULES = ['accounts', 'ledger', 'reconciliation', 'reference', 'transactions'] as const;

/**
 * Cross-module reaches that stay, each with the reason it is defensible.
 * This list only shrinks. An entry removed and not replaced by a real fix
 * turns this suite red — which is the point.
 */
const ALLOWED_CROSS_MODULE: readonly { from: string; to: string; reason: string }[] = [
  { from: 'accounts', to: 'transactions/domain/posting/posting-line',
    reason: 'PostingLine es kernel de facto — se mueve a shared en la Tarea 3' },
  { from: 'accounts', to: 'transactions/domain/transaction/transaction-status',
    reason: 'TransactionStatus es kernel de facto — Tarea 3' },
  { from: 'reconciliation', to: 'transactions/domain/posting/posting-line',
    reason: 'idem Tarea 3' },
  { from: 'reconciliation', to: 'transactions/domain/transaction/transaction-status',
    reason: 'idem Tarea 3' },
  { from: 'ledger', to: 'accounts/domain/account/account.aggregate',
    reason: 'InitializeLedger construye Account — se corrige en la Tarea 5' },
  { from: 'ledger', to: 'accounts/domain/account/events',
    reason: 'registro global de deserializadores — se mueve a bootstrap en la Tarea 6' },
  { from: 'ledger', to: 'reference/domain/currency/events', reason: 'idem Tarea 6' },
  { from: 'ledger', to: 'transactions/domain/transaction/events', reason: 'idem Tarea 6' },
  { from: 'ledger', to: 'reference/infrastructure/adapters/read-model-currency-catalog',
    reason: 'el composition root vive dentro del módulo ledger — Tarea 6' },
  { from: 'accounts', to: 'transactions/infrastructure/projections/account-balances.schema',
    reason: 'proj_balances lo escribe transactions y lo consulta accounts; contrato declarado en el schema' },
  { from: 'transactions', to: 'accounts/infrastructure/projections/account-tree.schema',
    reason: 'lee proj_accounts — el adapter pasa a puerto en la Tarea 10, el projector queda con contrato declarado (Tarea 11)' },
  { from: 'reconciliation', to: 'transactions/infrastructure/projections/transaction-list.schema',
    reason: 'AssertionPostingReader ya es el puerto local; contrato declarado (Tarea 11)' },
];

/** The module a source file belongs to, or null when it is bootstrap/tooling/shared. */
const moduleOf = (path: string): string | null => {
  const [first] = relative(SOURCE_ROOT, path).split(sep);

  return MODULES.includes(first as (typeof MODULES)[number]) ? first : null;
};

const isAllowed = (from: string, source: string): boolean =>
  ALLOWED_CROSS_MODULE.some(
    (entry) => entry.from === from && source.includes(entry.to),
  );

/** A module reaching into another module's domain/ or infrastructure/. */
const crossModuleViolations = (): readonly string[] =>
  sourceFiles(SOURCE_ROOT)
    .filter((file) => !isSpec(file))
    .flatMap((file) => {
      const from = moduleOf(file);

      if (!from) return [];

      return importsOf(file)
        .filter((source) => {
          const target = MODULES.find((m) => source.includes(`@ledger/${m}/`));

          if (!target || target === from) return false;
          if (!reaches(source, 'domain') && !reaches(source, 'infrastructure')) return false;

          return !isAllowed(from, source);
        })
        .map((source) => `${relative(SOURCE_ROOT, file)} -> ${source}`);
    });
```

Y el caso:

```typescript
  /**
   * Direction was never the whole invariant, and neither was the read model:
   * `accounts/application` importing `transactions/domain` points inward and
   * passes every case above. Five bounded contexts that reach into each other's
   * aggregates are one context with five folders — and the coupling is invisible
   * precisely because nothing fails.
   */
  it('keeps each module out of its neighbours domain and infrastructure', () => {
    expect(crossModuleViolations()).toEqual([]);
  });
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/hexagonal-isolation.spec.ts --no-coverage
```

Esperado: **FAIL** en la primera corrida, listando los cruces que la allowlist todavía no cubre. Ajustar la allowlist hasta que quede exactamente la lista de arriba y ni una entrada más — si hace falta agregar una que no está prevista, es un cruce que la auditoría no vio: anotarlo antes de seguir.

**Step 3: Confirmar que pasa con la deuda declarada**

```bash
npx jest apps/ledger/src/hexagonal-isolation.spec.ts --no-coverage
```

Esperado: **PASS** — 4 casos. La allowlist tiene 12 entradas.

---

### Tarea 2: Guard de binding único [X]

**Archivos:**
- Modificar: `apps/ledger/src/app.wiring.spec.ts`

**Step 1: Escribir el test que falla**

`app.wiring.spec.ts` ya monta el `AppModule` completo con un `DataSource` inerte. Agregar:

```typescript
/** Read ports whose adapter must be chosen in exactly one place. */
const SINGLE_BINDING_PORTS = [
  AccountTreeFinder,
  AccountBalanceFinder,
  AccountConstraintsReader,
  AccountNameReader,
  CurrencyCatalogFinder,
  LedgerSettingsFinder,
  SystemAccountLookup,
  LedgerTimezoneReader,
] as const;

/**
 * A port bound in a Nest module *and* built by the bootstrap factory has two
 * live adapters: which one answers depends on whether the caller came through
 * DI or through the composed bus. Six of these were bound in a module nobody
 * injected from, so editing that binding changed nothing at all — the failure
 * mode this asserts against is a silent no-op, not a crash.
 */
it('resolves every read port to the instance the bootstrap factory built', () => {
  const ports = { ...createQueryPorts(readModel), ...createWriteSideReadPorts(readModel) };

  for (const token of SINGLE_BINDING_PORTS) {
    const resolved = moduleRef.get(token, { strict: false });
    const built = Object.values(ports).find((p) => p instanceof token);

    expect(resolved.constructor).toBe(built?.constructor);
  }
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/app.wiring.spec.ts --no-coverage
```

Esperado: **FAIL** — los seis puertos con provider muerto no resuelven, o resuelven a una instancia distinta de la que sirve al bus.

**Step 3: Dejarlo verde con el alcance de hoy**

Reducir `SINGLE_BINDING_PORTS` a los dos que hoy **sí** se inyectan por Nest (`SystemAccountLookup`, `LedgerTimezoneReader`) y dejar comentada la lista completa con un `// Tarea 8: restaurar los seis restantes`.

```bash
npx jest apps/ledger/src/app.wiring.spec.ts --no-coverage
```

Esperado: **PASS**. La Tarea 8 restaura la lista completa y la hace pasar de verdad.

---

## Fase 2 — Kernel compartido (AC-1)

### Tarea 3: Mover `PostingLine` y `TransactionStatus` a `shared/domain/` [X]

**Archivos:**
- Mover: `apps/ledger/src/transactions/domain/posting/posting-line.ts` → `apps/ledger/src/shared/domain/posting/posting-line.ts` (con su `.spec.ts`)
- Mover: `apps/ledger/src/transactions/domain/transaction/transaction-status.ts` → `apps/ledger/src/shared/domain/posting/transaction-status.ts`
- Modificar: los 7 archivos de `context.md` §Cruce 1 + los imports internos de `transactions`
- Modificar: `apps/ledger/src/hexagonal-isolation.spec.ts` (borrar 4 entradas de la allowlist)

> `posting.serializer.ts` **se queda** en `transactions/domain/posting/`: serializa eventos, es infraestructura de evento del módulo dueño.

**Step 1: Borrar las 4 entradas de la allowlist → rojo**

Quitar de `ALLOWED_CROSS_MODULE` las cuatro entradas cuyo `reason` dice "Tarea 3".

```bash
npx jest apps/ledger/src/hexagonal-isolation.spec.ts --no-coverage
```

Esperado: **FAIL** — 7 violaciones listadas, una por archivo del cruce 1.

**Step 2: Mover los archivos**

```bash
git mv apps/ledger/src/transactions/domain/posting/posting-line.ts apps/ledger/src/shared/domain/posting/posting-line.ts
git mv apps/ledger/src/transactions/domain/posting/posting-line.spec.ts apps/ledger/src/shared/domain/posting/posting-line.spec.ts
git mv apps/ledger/src/transactions/domain/transaction/transaction-status.ts apps/ledger/src/shared/domain/posting/transaction-status.ts
```

**Step 3: Reescribir los imports**

Todo `@ledger/transactions/domain/posting/posting-line` → `@ledger/shared/domain/posting/posting-line`, y `@ledger/transactions/domain/transaction/transaction-status` → `@ledger/shared/domain/posting/transaction-status`.

```bash
grep -rln "transactions/domain/posting/posting-line\|transactions/domain/transaction/transaction-status" apps/ledger/src
```

Esperado: lista vacía después de reescribir.

**Step 4: Verde**

```bash
npx jest apps/ledger/src/hexagonal-isolation.spec.ts apps/ledger/src/shared apps/ledger/src/transactions --no-coverage
```

Esperado: **PASS**. La allowlist queda en 8 entradas.

---

## Fase 3 — El cruce `ledger → accounts` (AC-3)

### Tarea 4: `OpenSystemAccountCommand` + handler [X]

**Archivos:**
- Crear: `apps/ledger/src/accounts/application/usecases/open-system-account/open-system-account.command.ts`
- Crear: `apps/ledger/src/accounts/application/usecases/open-system-account/open-system-account.handler.ts`
- Test: `apps/ledger/src/accounts/application/usecases/open-system-account/open-system-account.handler.spec.ts`

**Step 1: Escribir el test que falla**

```typescript
describe('OpenSystemAccountHandler', () => {
  it('opens the account with isSystem true (INV-13)', async () => {
    const handler = new OpenSystemAccountHandler(accounts, ids);

    const result = await handler.execute(
      new OpenSystemAccountCommand('Equity:OpeningBalances', '2026-01-01'),
      ctx,
    );

    expect(result.aggregateId).toBe('acc-1');
    expect(saved.isSystem).toBe(true);
  });

  /**
   * The caller opens the transaction and dispatches once for the three appends.
   * A dispatch here would run inside that scope, which is exactly what
   * InitializeLedger avoids so a failing projector cannot roll back committed
   * accounting facts.
   */
  it('does not dispatch projections — the caller owns that', async () => {
    await handler.execute(command, ctx);

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  /**
   * Uniqueness is not checked: at initialization proj_accounts is empty and the
   * first account's dispatch has not run yet, so a registry lookup would report
   * the name as available regardless. The two names are constants and distinct,
   * so the check would be theatre — stating that here beats an implicit skip.
   */
  it('does not consult the name registry', async () => {
    await handler.execute(command, ctx);

    expect(names.ensureAvailable).not.toHaveBeenCalled();
  });
});
```

**Step 2: Confirmar que falla**

```bash
npx jest apps/ledger/src/accounts/application/usecases/open-system-account --no-coverage
```

Esperado: FAIL — "Cannot find module '.../open-system-account.handler'".

**Step 3: Implementar**

```typescript
// open-system-account.command.ts
import { Command } from '@cqrs/application/command-bus/command';

/** Opens one of the ledger's technical accounts (INV-13). Internal: not exposed over HTTP. */
export class OpenSystemAccountCommand extends Command {
  readonly commandType = 'OpenSystemAccount';

  constructor(
    readonly name: string,
    readonly openedOn: string,
  ) {
    super();
  }
}
```

```typescript
// open-system-account.handler.ts
import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { IdGenerator } from '@cqrs/domain/ports';
import { AccountRepository } from '@ledger/accounts/application/repositories/account.repository';
import { Account } from '@ledger/accounts/domain/account/account.aggregate';
import { AccountName, LedgerDate } from '@ledger/shared/domain/value-objects';
import { OpenSystemAccountCommand } from './open-system-account.command';

/**
 * Opens a technical account (`isSystem: true`, INV-13). It exists so the ledger
 * lifecycle can create `Equity:OpeningBalances` and `Equity:Adjustments` without
 * reaching for the `Account` aggregate from another module.
 *
 * Two deliberate differences with {@link OpenAccountHandler}, both because the
 * caller owns a transaction this handler runs inside:
 * - it does not dispatch projections — the caller dispatches once, after commit;
 * - it does not check name uniqueness — at initialization `proj_accounts` is
 *   empty and the previous append has not projected yet, so the answer would be
 *   meaningless. The two names are constants and distinct.
 */
export class OpenSystemAccountHandler extends CommandHandler<OpenSystemAccountCommand> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly idGenerator: IdGenerator,
  ) {
    super();
  }

  async execute(command: OpenSystemAccountCommand, ctx: AuthContext): Promise<CommandResult> {
    const account = Account.open(
      {
        name: AccountName.of(command.name),
        currencies: [],
        openedOn: LedgerDate.of(command.openedOn),
        isBankMirror: false,
        isSystem: true,
      },
      this.idGenerator,
    );

    const result = await this.accounts.save(account, ctx);

    return {
      aggregateId: account.id,
      streamPosition: result.lastPosition,
      idempotentReplay: false,
    };
  }
}
```

**Step 4: Verde**

```bash
npx jest apps/ledger/src/accounts/application/usecases/open-system-account --no-coverage
```

Esperado: PASS — 3 tests.

---

### Tarea 5: `InitializeLedger` despacha en vez de construir [X]

**Archivos:**
- Modificar: `apps/ledger/src/ledger/application/usecases/initialize-ledger/initialize-ledger.handler.ts`
- Modificar: `apps/ledger/src/bootstrap/ledger-application.factory.ts:140-147`
- Modificar: `apps/ledger/src/hexagonal-isolation.spec.ts` (borrar 1 entrada)
- Test: `apps/ledger/src/ledger/application/usecases/initialize-ledger/initialize-ledger.handler.spec.ts`

**Step 1: Borrar la entrada `ledger → account.aggregate` → rojo**

```bash
npx jest apps/ledger/src/hexagonal-isolation.spec.ts --no-coverage
```

Esperado: **FAIL** — 1 violación: `ledger/…/initialize-ledger.handler.ts -> @ledger/accounts/domain/account/account.aggregate`.

**Step 2: Agregar los tests de invariante**

```typescript
it('opens both technical accounts through the command bus', async () => {
  await handler.execute(command, ctx);

  expect(dispatched).toEqual([
    expect.objectContaining({ commandType: 'OpenSystemAccount', name: 'Equity:OpeningBalances' }),
    expect.objectContaining({ commandType: 'OpenSystemAccount', name: 'Equity:Adjustments' }),
  ]);
});

/** INV-7: settings and both accounts commit together or not at all. */
it('runs the three appends inside one transaction', async () => {
  await handler.execute(command, ctx);

  expect(eventStore.withTransaction).toHaveBeenCalledTimes(1);
  expect(appendsOutsideTransaction).toEqual([]);
});

it('leaves no technical account behind when the settings append fails', async () => {
  settings.save.mockRejectedValueOnce(new Error('append failed'));

  await expect(handler.execute(command, ctx)).rejects.toThrow();
  expect(committedEvents).toEqual([]);
});

/** The projection dispatch stays outside the scope: a failing projector must
 *  not roll back accounting facts that already committed. */
it('dispatches projections after the transaction, not inside it', async () => {
  await handler.execute(command, ctx);

  expect(dispatchOrder).toEqual(['withTransaction:end', 'dispatch']);
});
```

**Step 3: Reescribir el handler**

Constructor: `(settings, commandBus, clock, dispatcher, eventStore)` — desaparecen `accounts: AccountRepository` e `idGenerator`.

> **El problema a resolver, y su salida.** Hoy los eventos de las dos cuentas llegan al dispatcher a través de `openingResult.events` / `adjustmentsResult.events`, que devuelve `AccountRepository.save()`. Al pasar por el bus eso desaparece: `CommandResult` expone `{ aggregateId, streamPosition, idempotentReplay }` y **nada más** — su JSDoc lo prohíbe expresamente ("Never a read model", Art. 10). Si el handler despacha solo `anchor.events`, `proj_accounts` nunca ve las cuentas de sistema: no falla nada, simplemente las cuentas técnicas no existen para el read side hasta el próximo rebuild.
>
> La salida es leer cada stream por el id que el bus **sí** devuelve. `StreamId` es `{ userId, aggregateType, aggregateId }` y `AccountRepository.aggregateType` es `'Account'`; para una cuenta recién abierta, `load()` devuelve exactamente su `AccountOpened`. Es determinista y no depende de posiciones globales.
>
> Anidar no es un riesgo: `EventStore.withTransaction` documenta que "an inner call joins the outer scope rather than opening a second transaction", así que los `append` que hace el handler de la cuenta entran en el scope que abre este.

```typescript
const anchorless: AuthContext = { ...ctx, externalRef: null };
const written = await this.eventStore.withTransaction(async () => {
  const opening = await this.commandBus.dispatch(
    new OpenSystemAccountCommand(OPENING_BALANCES, openedOn.value), anchorless,
  );
  const adjustments = await this.commandBus.dispatch(
    new OpenSystemAccountCommand(ADJUSTMENTS, openedOn.value), anchorless,
  );

  const ledger = LedgerSettings.initialize({
    userId: ctx.userId,
    presentationCurrency: command.presentationCurrency,
    timezone: command.timezone,
    openingBalancesAccountId: opening.aggregateId,
    adjustmentsAccountId: adjustments.aggregateId,
  });

  const anchor = await this.settings.save(ledger, ctx);

  // The two accounts were opened through the bus, which returns ids and not
  // events (Art. 10). Their streams are read back here so the projection
  // dispatch below stays complete — without this, `proj_accounts` never learns
  // the system accounts exist and nothing reports it.
  const accountEvents = await this.openedAccountEvents(ctx.userId, [
    opening.aggregateId,
    adjustments.aggregateId,
  ]);

  return {
    events: [...anchor.events, ...accountEvents],
    lastPosition: anchor.streamPosition,
  };
});

await this.dispatcher.dispatch(written.events);
```

```typescript
/** The events of each just-opened system account, in the order they were opened. */
private async openedAccountEvents(
  userId: string,
  accountIds: readonly string[],
): Promise<readonly StoredEvent[]> {
  const streams = await Promise.all(
    accountIds.map((aggregateId) =>
      this.eventStore.load({ userId, aggregateType: 'Account', aggregateId }),
    ),
  );

  return streams.flat();
}
```

> Borrar el método privado `openSystemAccount()` y los imports de `Account` / `AccountRepository` / `IdGenerator`.

**Step 4: Verificar el efecto observable con la composición in-memory**

Los tests del Step 2 usan dobles y prueban el *mecanismo*. Este prueba el *efecto*, que es lo que realmente importa acá: da igual si `/build` termina resolviendo la recolección con `load()` o con `readAll()` — lo que no puede pasar es que una cuenta de sistema quede sin proyectar.

En `apps/ledger/src/bootstrap/ledger-application.spec.ts`, siguiendo el patrón que ya usa el caso de `RegisterCurrency` (`:209-235`):

```typescript
it('initializes a ledger with both system accounts projected and referenced', async () => {
  const eventStore = new InMemoryEventStore();
  const readModel = new InMemoryReadModelStore();
  const { commandBus } = createLedgerApplication({
    eventStore,
    readModel,
    clock: new FixedClock(new Date('2026-01-01T00:00:00.000Z')),
    idGenerator: new SequentialIdGenerator(),
    catalog: seededCatalog(),
  });

  await commandBus.dispatch(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx());

  const accounts = await readModel.query<AccountRow>(
    PROJ_ACCOUNTS,
    Criteria.none().equals('user_id', USER_ID),
  );
  const [settings] = await readModel.query<LedgerSettingsRow>(
    PROJ_LEDGER_SETTINGS,
    Criteria.none().equals('user_id', USER_ID),
  );

  // Ambas cuentas llegaron al read side: es lo que se pierde en silencio si el
  // dispatch se queda solo con los eventos del stream de settings.
  expect(accounts.map((row) => row.name).sort()).toEqual([
    'Equity:Adjustments',
    'Equity:OpeningBalances',
  ]);
  expect(accounts.every((row) => row.is_system)).toBe(true);

  // Y las settings apuntan a cuentas que existen — INV-13 de punta a punta.
  const ids = new Set(accounts.map((row) => row.account_id));
  expect(ids.has(settings.opening_balances_account_id)).toBe(true);
  expect(ids.has(settings.adjustments_account_id)).toBe(true);
});

/** INV-7 de punta a punta: si el append de settings falla, no queda ni una cuenta. */
it('leaves the read side untouched when the settings append fails', async () => {
  const eventStore = new InMemoryEventStore();
  const readModel = new InMemoryReadModelStore();
  jest.spyOn(eventStore, 'append').mockImplementationOnce(async (...args) => {
    throw new Error('settings append failed');
  });

  await expect(
    commandBus.dispatch(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx()),
  ).rejects.toThrow();

  expect(await eventStore.readAll(0n, 100)).toEqual([]);
  expect(await readModel.query(PROJ_ACCOUNTS, Criteria.none())).toEqual([]);
});
```

> El segundo test es válido: `InMemoryEventStore.withTransaction` (`libs/cqrs/src/infrastructure/adapters/event-store/in-memory/in-memory-event-store.ts:31-49`) hace rollback real — toma un snapshot de la lista de eventos y de `nextPosition`, y los restaura en el `catch`. Su JSDoc dice que existe justamente para que ambos adapters satisfagan un solo contrato. También implementa el guard de anidamiento (`if (this.depth > 0) return work()`), que es lo que hace seguro despachar `OpenSystemAccountCommand` dentro del scope abierto por este handler.

```bash
npx jest apps/ledger/src/bootstrap/ledger-application.spec.ts --no-coverage
```

Esperado: FAIL antes del Step 3, PASS después.

**Step 5: Actualizar la composición**

En `ledger-application.factory.ts`, registrar el handler nuevo **antes** de `InitializeLedgerCommand` (el bus debe conocerlo cuando el otro despache) y cambiar la construcción:

```typescript
commandBus.register(
  OpenSystemAccountCommand,
  new OpenSystemAccountHandler(accounts, idGenerator),
);
commandBus.register(
  InitializeLedgerCommand,
  new InitializeLedgerHandler(settings, commandBus, clock, dispatcher, eventStore),
);
```

**Step 6: Verde**

```bash
npx jest apps/ledger/src/ledger apps/ledger/src/bootstrap apps/ledger/src/hexagonal-isolation.spec.ts --no-coverage
```

Esperado: PASS. Allowlist en 7 entradas.

---

## Fase 4 — Composición (AC-4, AC-5, AC-6)

### Tarea 6: Mover `LedgerCoreModule` a `bootstrap/` [X]

**Archivos:**
- Mover: `apps/ledger/src/ledger/ledger-core.module.ts` → `apps/ledger/src/bootstrap/ledger-core.module.ts`
- Mover: `apps/ledger/src/ledger/application/factories/ledger-event-registry.factory.ts` → `apps/ledger/src/bootstrap/ledger-event-registry.factory.ts`
- Modificar: `apps/ledger/src/app.module.ts:9`, y los imports de la factory (3 módulos)
- Modificar: `apps/ledger/src/hexagonal-isolation.spec.ts` (borrar 4 entradas)

> El registro de eventos se mueve con el módulo: es composición, no aplicación del contexto `ledger`. Los cuatro cruces `ledger → *` que quedaban desaparecen juntos, porque `bootstrap/` no es un módulo acotado y `moduleOf()` devuelve `null` para él.

**Step 1: Borrar las 4 entradas restantes de `ledger` → rojo**

```bash
npx jest apps/ledger/src/hexagonal-isolation.spec.ts --no-coverage
```

Esperado: **FAIL** — 5 violaciones (4 de la factory de eventos + 1 del catálogo).

**Step 2: Mover y reapuntar**

```bash
git mv apps/ledger/src/ledger/ledger-core.module.ts apps/ledger/src/bootstrap/ledger-core.module.ts
git mv apps/ledger/src/ledger/application/factories/ledger-event-registry.factory.ts apps/ledger/src/bootstrap/ledger-event-registry.factory.ts
grep -rln "ledger/ledger-core.module\|ledger/application/factories/ledger-event-registry" apps/ledger/src
```

Reescribir cada hit a `@ledger/bootstrap/…`. `apps/ledger/src/ledger/application/factories/` queda vacía: borrarla.

**Step 3: Verde**

```bash
npx jest apps/ledger/src/hexagonal-isolation.spec.ts apps/ledger/src/app.wiring.spec.ts --no-coverage
```

Esperado: PASS. Allowlist en 3 entradas — solo los contratos de esquema. **El ciclo `ledger ↔ reference` ya no existe.**

---

### Tarea 7: `ReferenceModule` depende del puerto [X]

**Archivos:**
- Modificar: `apps/ledger/src/reference/reference.module.ts:30`
- Modificar: `apps/ledger/src/bootstrap/ledger-core.module.ts` (agregar el alias del puerto)
- Test: `apps/ledger/src/app.wiring.spec.ts`

**Step 1: Test que falla**

```typescript
it('hydrates the catalog through the port, not the concrete adapter', () => {
  expect(moduleRef.get(CurrencyCatalogCache, { strict: false })).toBeDefined();
});
```

```bash
npx jest apps/ledger/src/app.wiring.spec.ts --no-coverage
```

Esperado: FAIL — `Nest could not find CurrencyCatalogCache`.

**Step 2: Implementar**

En `bootstrap/ledger-core.module.ts`, junto al binding existente del catálogo:

```typescript
{ provide: CurrencyCatalogCache, useExisting: ReadModelCurrencyCatalog },
```

y agregarlo a `exports`. En `reference.module.ts`:

```typescript
constructor(private readonly catalog: CurrencyCatalogCache) {}
```

**Step 3: Verde**

```bash
npx jest apps/ledger/src/app.wiring.spec.ts apps/ledger/src/reference --no-coverage
```

Esperado: PASS.

---

### Tarea 8: Raíz única de composición [X]

**Archivos:**
- Modificar: `apps/ledger/src/accounts/accounts.module.ts` (borrar 4 providers + exports)
- Modificar: `apps/ledger/src/reference/reference.module.ts` (borrar el binding de `CurrencyCatalogFinder`)
- Modificar: `apps/ledger/src/bootstrap/ledger-core.module.ts:51-53` (los tres `useClass` → `useFactory` sobre la composición)
- Modificar: `apps/ledger/src/app.wiring.spec.ts` (restaurar la lista completa)

**Step 1: Restaurar `SINGLE_BINDING_PORTS` completo → rojo**

```bash
npx jest apps/ledger/src/app.wiring.spec.ts --no-coverage
```

Esperado: **FAIL** — los seis puertos con provider muerto.

**Step 2: Borrar los providers muertos y unificar**

`accounts.module.ts` queda sin `providers` ni `exports` (solo `imports: [AccountsHttpModule]`). En `ledger-core.module.ts`:

```typescript
{
  provide: SystemAccountLookup,
  inject: [ReadModelStore],
  useFactory: (readModel: ReadModelStore): SystemAccountLookup =>
    createWriteSideReadPorts(readModel).systemAccounts,
},
```

y equivalente para `LedgerTimezoneReader` y `LedgerSettingsFinder`.

**Step 3: Verde**

```bash
npx jest apps/ledger/src/app.wiring.spec.ts --no-coverage
```

Esperado: PASS — un solo adapter por puerto, elegido en un solo lugar.

> Decidir acá lo que el diseño dejó abierto: `accounts.module.ts` sin providers ¿sobrevive como declaración de imports o se fusiona con `AccountsHttpModule`? Recomendación: fusionarlo — un módulo que solo importa otro no gana nada.

---

## Fase 5 — Fronteras de lectura (AC-7, AC-8)

### Tarea 9: `toBalanceView` al lado que ya conoce ambos tipos [X]

**Archivos:**
- Modificar: `apps/ledger/src/transactions/infrastructure/projections/account-balances.schema.ts` (borrar el import de `accounts` y la función)
- Modificar: `apps/ledger/src/accounts/infrastructure/adapters/persistence/read-model-account-balance-finder.ts:39`
- Test: `apps/ledger/src/accounts/infrastructure/adapters/persistence/read-model-account-balance-finder.spec.ts`

**Step 1: Test que falla**

```typescript
/** The schema of a projection must not import the view of the module that reads it:
 *  that closes the loop accounts/infra -> transactions/infra -> accounts/application. */
it('account-balances.schema no importa nada de accounts', () => {
  const source = readFileSync(SCHEMA_PATH, 'utf8');

  expect(source).not.toMatch(/@ledger\/accounts/);
});
```

```bash
npx jest apps/ledger/src/accounts/infrastructure/adapters/persistence/read-model-account-balance-finder.spec.ts --no-coverage
```

Esperado: FAIL.

**Step 2: Mover el mapper**

Borrar `toBalanceView` del schema (y su import de `BalanceView`); inlinear el mapeo en el finder, que ya importa ambos:

```typescript
return rows.map((row) => ({
  accountId: row.account_id,
  currency: row.currency_code,
  confirmed: row.confirmed_amount,
  pending: row.pending_amount,
}));
```

**Step 3: Verde**

```bash
npx jest apps/ledger/src/accounts apps/ledger/src/transactions/infrastructure/projections --no-coverage
```

Esperado: PASS.

---

### Tarea 10: `AccountFactsReader` y el adaptador anti-corrupción [X]

**Archivos:**
- Crear: `apps/ledger/src/accounts/application/ports/account-facts-reader.port.ts`
- Crear: `apps/ledger/src/accounts/infrastructure/adapters/persistence/read-model-account-facts-reader.ts`
- Modificar: `apps/ledger/src/transactions/infrastructure/adapters/persistence/read-model-account-lookup.ts`
- Modificar: `apps/ledger/src/bootstrap/read-side-ports.factory.ts` (agregar `accountFacts` a `WriteSideReadPorts`)
- Modificar: `apps/ledger/src/hexagonal-isolation.spec.ts` (acotar 1 entrada)

> Puerto nuevo, no extensión de `AccountConstraintsReader`: ese tipo declara ser "the facts a posting is validated against" e `isBankMirror` no valida ningún posting — ver `research.md` §Decisión 3.

**Step 1: Test que falla**

```typescript
describe('ReadModelAccountLookup', () => {
  it('resuelve los facts a través del puerto de accounts, sin tocar proj_accounts', async () => {
    const facts = { factsOf: jest.fn().mockResolvedValue({ accountId: 'a1', type: 'ASSET', currency: 'COP', isBankMirror: true }) };
    const lookup = new ReadModelAccountLookup(facts as unknown as AccountFactsReader);

    expect(await lookup.factsOf('u1', 'a1')).toEqual(
      expect.objectContaining({ isBankMirror: true }),
    );
    expect(facts.factsOf).toHaveBeenCalledWith('u1', 'a1');
  });
});
```

**Step 2: Implementar el puerto y su adapter**

```typescript
/** What transfer detection needs to know about an account. */
export type AccountFacts = {
  readonly accountId: string;
  readonly type: string;
  readonly currency: Nullable<string>;
  readonly isBankMirror: boolean;
};

/**
 * Read port of `accounts` for the facts other modules need about an account.
 * Separate from {@link AccountConstraintsReader} on purpose: that one answers
 * "what does a posting get validated against", and `isBankMirror` validates
 * nothing — it drives transfer detection.
 */
export abstract class AccountFactsReader {
  abstract factsOf(userId: string, accountId: string): Promise<Nullable<AccountFacts>>;
}
```

`ReadModelAccountFactsReader` en `accounts` lee `proj_accounts` (el cuerpo actual de `ReadModelAccountLookup`), y `ReadModelAccountLookup` pasa a delegar.

**Step 3: Acotar la allowlist**

La entrada `transactions → account-tree.schema` ahora cubre solo el projector. Cambiar su `reason` a: `'TransactionListProjector lee proj_accounts; contrato declarado en el schema'`.

**Step 4: Verde**

```bash
npx jest apps/ledger/src/transactions apps/ledger/src/accounts apps/ledger/src/hexagonal-isolation.spec.ts --no-coverage
```

Esperado: PASS.

---

### Tarea 11: Declarar el contrato de los dos esquemas compartidos [X]

**Archivos:**
- Modificar: `apps/ledger/src/accounts/infrastructure/projections/account-tree.schema.ts`
- Modificar: `apps/ledger/src/transactions/infrastructure/projections/transaction-list.schema.ts`

**Step 1: Test que falla**

```typescript
/** A schema another module reads is a published contract. If it does not say so,
 *  the next person to rename a column finds out from a compile error elsewhere. */
it.each(SHARED_SCHEMAS)('%s declara su contrato de lectura', (path) => {
  expect(readFileSync(path, 'utf8')).toMatch(/Contrato público del módulo/);
});
```

**Step 2: Escribir el JSDoc**

Siguiendo el modelo de `account-balances.schema.ts:6-13`: quién lo escribe, quién lo lee, y qué se rompe al cambiar una columna.

**Step 3: Verde**

```bash
npx jest apps/ledger/src/hexagonal-isolation.spec.ts --no-coverage
```

Esperado: PASS. **Allowlist final: 3 entradas, las tres justificadas y documentadas.**

---

## Fase 6 — Higiene (AC-9, AC-10, AC-11)

### Tarea 12: Topología [X]

**Archivos:** cuatro movimientos, sin cambio de comportamiento.

```bash
git mv apps/ledger/src/reference/infrastructure/adapters/read-model-currency-catalog.ts \
       apps/ledger/src/reference/infrastructure/adapters/persistence/read-model-currency-catalog.ts
git mv apps/ledger/src/transactions/application/ports/page-request.type.ts \
       apps/ledger/src/transactions/application/types/page-request.type.ts
git mv apps/ledger/src/transactions/domain/exceptions/transfer.exception.ts \
       apps/ledger/src/transactions/domain/services/transfer.exception.ts
```

Y mover `StaticCurrencyCatalogCache` de `reference/application/ports/currency-catalog.cache.ts` a `bootstrap/` (su único consumidor es `ledger-application.factory.ts:181`).

```bash
npx jest apps/ledger --no-coverage 2>&1 | tail -5
```

Esperado: PASS, mismo número de tests.

---

### Tarea 13: Sufijo `.port.ts` [X]

```bash
git mv apps/ledger/src/shared/application/ports/ledger-context-resolver.ts \
       apps/ledger/src/shared/application/ports/ledger-context-resolver.port.ts
git mv apps/ledger/src/reference/application/ports/currency-catalog.cache.ts \
       apps/ledger/src/reference/application/ports/currency-catalog-cache.port.ts
```

Reapuntar imports. Verificación:

```bash
ls apps/ledger/src/*/application/ports/ apps/ledger/src/*/domain/ports/ | grep -v "\.port\.ts$\|index\.ts\|:$\|^$"
```

Esperado: salida vacía — todo puerto termina en `.port.ts`.

---

### Tarea 14: Completar el barrel de puertos de `transactions` [X]

> **Alcance reducido por el Artículo 13 de la constitución.** No se eliminan barrels ni se agregan nuevos: Art. 13 ya decidió imports por ruta completa con barrels solo en cuatro conjuntos cerrados, uno de ellos "puertos de un módulo". Lo único que se corrige es que ese conjunto esté completo.

En `apps/ledger/src/transactions/application/ports/index.ts`:

```typescript
export * from './account-lookup.port';
export * from './pending-review-finder.port';
export * from './posting-validator.port';
export * from './transaction-finder.port';
```

(`page-request.type.ts` salió de la carpeta en la Tarea 12.)

```bash
npx jest apps/ledger/src/transactions --no-coverage
```

Esperado: PASS.

---

### Tarea 15: Suite completa y verificación de AC-12 [X]

**Step 1: Suite del ledger**

```bash
npx jest apps/ledger --no-coverage 2>&1 | tail -8
```

Esperado: PASS, con **el mismo número de tests que el baseline de la Tarea 0, o más**. Un número menor significa que una suite dejó de compilar y Jest la saltó: investigar antes de dar por cerrado.

**Step 2: Suite de cqrs (no debe haberse tocado)**

```bash
npx jest libs/cqrs --no-coverage 2>&1 | tail -5
```

Esperado: PASS, sin cambios.

**Step 3: Contrato intacto**

```bash
git status --porcelain apps/ledger/docs/
```

Esperado: **vacío** — ningún `api.yaml` de módulo cambió (AC-12).

**Step 4: El modelo compila**

```bash
npx likec4 validate
```

Esperado: ✓ Valid.

**Step 5: Estado final de los guards**

```bash
npx jest apps/ledger/src/hexagonal-isolation.spec.ts apps/ledger/src/app.wiring.spec.ts --no-coverage
```

Esperado: PASS. La allowlist quedó en 3 entradas, todas con contrato declarado en el schema correspondiente.

---

## Alcance estimado

| | |
|---|---|
| Tareas | 16 (0–15) |
| Archivos nuevos | 6 (2 command/handler, 2 puerto/adapter, 2 specs) |
| Archivos movidos | 9 |
| Archivos modificados | ~35 (mayoría, reescritura de import) |
| Migraciones | 0 |
| Cambios de contrato HTTP | 0 |

## Orden y paralelismo

Un solo app, una sola cadena de dependencias: **sin tareas `[P]`**. Las fases van en orden — la Fase 1 es la red que hace seguras las demás, y cada fase posterior vacía entradas de la allowlist que la Fase 1 dejó declaradas.

---

## Correcciones post-review de convenciones

`conventions-reviewer` encontró cuatro incumplimientos al cerrar el build. Los cuatro
corregidos; dos eran desvíos de este mismo plan.

| Hallazgo | Artículo / AC | Corrección |
|---|---|---|
| `ReadModelAccountFactsReader` sin spec | Art. 4 (TDD estricto) | `read-model-account-facts-reader.spec.ts` — 4 casos, incluido el scope por usuario (INV-9) |
| `ReadModelAccountLookup` reescrito sin spec — el Step 1 de la Tarea 10 lo especificaba y se saltó | Art. 4 | `read-model-account-lookup.spec.ts` — 3 casos sobre la delegación al puerto |
| `StaticCurrencyCatalogCache` seguía en `application/ports/` — la Tarea 12 lo ordenaba mover | AC-9 | movido a `bootstrap/static-currency-catalog.cache.ts`; el puerto quedó solo con el contrato abstracto |
| JSDoc de contrato en español en los dos `.schema.ts` | Art. 8 (comentarios en inglés) | traducidos; en `account-tree.schema.ts` además se fusionaron los dos bloques JSDoc consecutivos que habían quedado. El test del guard pasa a buscar `Public read contract of the` |

Suite tras las correcciones: **541 passed / 91 suites** (baseline 520 / 88).
