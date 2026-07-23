# EP-0 — Andamiaje `apps/ledger` + plataforma compartida

> Épica del [roadmap](../../ledger-roadmap.md). Fuente: [especificación](../../especificacion-tecnica-ledger.md).
> Este archivo debe contener el **plan detallado de implementación** de la épica.

## Alcance (subtareas)

- **EP-0.1** Generar app Nx `apps/ledger` (NestJS), tsconfig paths `@ledger/*`, lint, estructura hexagonal.
- **EP-0.2** Mover a `libs/shared` la plataforma reutilizable de `finances`: config, `DatabaseModule`, telemetría OTel, guards de contexto, outbox.
- **EP-0.3** `Money` decimal exacto + `minor_units` por moneda; construcción desde `number` prohibida (INV-8).
- **EP-0.4** Harness de testing: unit + contract tests reusables real/in-memory; `Clock`/`IdGenerator` deterministas.
- **EP-0.5** CI de la app nueva; decisión de despliegue en paralelo a `finances`.

## Plan detallado

### Contexto de plataforma existente (lo que se reutiliza)

Verificado en el código actual de `apps/finances` y `libs/shared`:

- **Config con `class-validator` + `registerAs`**: una única clase `Environment`
  con decoradores (`@IsString`, `@ToNumber`, `@ToBoolean`) en
  `apps/finances/src/env.ts`, validada de una sola vez por `loadEnvironment()`
  (closure con caché). Cada namespace se declara con `registerAs('database', …)`
  en `apps/finances/src/config/environment/database.config.ts` (y hermanos:
  `app.config.ts`, `auth.config.ts`, `messaging.config.ts`, …). El validador
  genérico `configValidator(config, type)` **ya vive en `@shared`**
  (`libs/shared/src/config/index.ts`), igual que `ToBoolean` / `ToNumber`
  (`libs/shared/src/decorators/`). → Las **primitivas** de config ya son
  compartidas; cada app escribe su propia clase `Environment`.
- **`DatabaseModule`**: `apps/finances/src/database/database.module.ts`,
  `@Global`, `TypeOrmModule.forRootAsync` con `autoLoadEntities`, ruta de
  migraciones **hardcodeada** a `dist/apps/finances/database/migrations/*.js`
  y `extra.columnTypes.timestamp = 'timestamp with time zone'`. → No es
  reutilizable tal cual; hay que parametrizarlo.
- **Telemetría OTel**: `apps/finances/src/config/telemetry/` —
  `instrumentation.ts` (bootstrap que arranca el `NodeSDK` **antes** que Nest,
  se importa primero en `main.ts`), `telemetry.config.ts` (`buildNodeSDK`,
  `isTelemetryEnabled`) y `correlation.ts`. Deps `@opentelemetry/*` ya en
  `package.json`. Código genérico, no acoplado a finances. → Movible a `@shared`.
- **Guards de contexto autenticado**: `AuthModule` + `JwtAuthGuard` ya en
  `@shared/auth` (`libs/shared/src/auth/`), consumidos vía
  `AuthModule.forRootAsync` en `apps/finances/src/app.module.ts`. `AuthenticatedUser`
  en `libs/shared/src/auth/types/`. El guard de webhook M2M
  (`WebhookApiKeyGuard`) vive en finances. → Auth ya es compartido.
- **Outbox**: `apps/finances/src/outbox/` — outbox TypeORM + `OutboxRelayScheduler`.
  **La spec del ledger lo declara innecesario en v1**: el `event_store` es un
  outbox por construcción (append-only, posición global, payload autocontenido)
  y la publicación externa vía CDC se difiere (§9.3). → Ver decisión abierta D-3.
- **`Money` actual (float)**: `apps/finances/src/shared/domain/money.ts` usa
  `number` (`readonly amount: number`, `Math.round(... * SCALE)`). Viola INV-8.
  `apps/finances` está **congelado** (roadmap §Estrategia de convivencia), así que
  **no se reescribe ese archivo**: se escribe un `Money` decimal **nuevo** en el
  core del ledger. El dominio no se reutiliza.
- **Aliases y linter**: `tsconfig.base.json` mapea `@shared` → `libs/shared/src/index.ts`
  y `@app/*` → `apps/finances/src/*`. `eslint.config.mjs` restringe
  `@nx/enforce-module-boundaries` con `allow: ['@app/**']` y ordena imports con
  `import-x/order` (grupo interno para `@app/**`). `jest.config.ts` de finances
  mapea `@app/(.*)` y `@shared` en `moduleNameMapper`.
- **CI**: `.github/workflows/ci.yml` compila/migra/testea **solo** finances de
  forma explícita; dispara en `push` a `main` **pese a que la rama principal del
  repo es `master`** (bug a corregir en EP-0.5). Node 22, Postgres 16 de servicio.
- **Decimal libs**: `big.js@5.2.2` y `bignumber.js@9.3.1` ya están **resueltas
  transitivamente** en `node_modules` (no declaradas en `package.json`);
  `decimal.js` **no** está presente.

---

### EP-0.1 — Generar `apps/ledger` (NestJS) con hexágono y paths `@ledger/*`

**Objetivo.** Crear la app Nx `ledger` vacía que compila y arranca, con el alias
`@ledger/*`, lint y test cableados, y la estructura de carpetas hexagonal por
módulo lista para escribir dominio.

**Archivos/módulos a crear (rutas concretas).**

- `apps/ledger/project.json` — targets `build` (`@nx/webpack:webpack`, salida
  `dist/apps/ledger`), `serve` (`@nx/js:node`), `lint` (`@nx/eslint:lint`,
  patrón `apps/ledger/**/*.ts`), `test` (`@nx/jest:jest`). Espejo de
  `apps/finances/project.json`.
- `apps/ledger/tsconfig.json`, `apps/ledger/tsconfig.app.json`,
  `apps/ledger/tsconfig.spec.json` — extienden `../../tsconfig.base.json`,
  replican `ignoreDeprecations: "6.0"` y `target/module` de finances.
- `apps/ledger/webpack.config.js`, `apps/ledger/jest.config.ts` (con
  `moduleNameMapper` para `^@ledger/(.*)$` → `<rootDir>/src/$1`, `@shared` y el
  pin de `typeorm` a su CJS, copiado de finances).
- `apps/ledger/src/main.ts` — importa **primero** el bootstrap de telemetría
  (`@shared` tras EP-0.2), luego crea la app Nest.
- `apps/ledger/src/app.module.ts` — raíz: `ConfigModule.forRoot({ validate: () => loadEnvironment(), load: [...] })`, `LoggerModule`, `DatabaseModule` (el compartido de EP-0.2).
- `apps/ledger/src/env.ts` — clase `Environment` propia del ledger + `loadEnvironment()`.
- `apps/ledger/src/config/environment/*.config.ts` — namespaces `registerAs`
  propios (`app`, `database`, `telemetry`; auth/context según EP-2).
- **Estructura hexagonal por módulo de dominio** (carpetas vacías con `index.ts`
  o `.gitkeep`), un módulo Nest por área de la spec §8.1
  (accounts, transactions, reconciliation, product, shared-kernel):

```
apps/ledger/src/
  shared/                     # shared-kernel del ledger (VOs, ports, testing)
    domain/                   # Money, Currency, ports Clock/IdGenerator (EP-0.3/0.4)
    application/
    infrastructure/
    testing/                  # dobles deterministas + contract-suite helpers (EP-0.4)
  accounts/{domain,application,infrastructure}/
  transactions/{domain,application,infrastructure}/
  reconciliation/{domain,application,infrastructure}/
  product/{domain,application,infrastructure}/    # budgets + goals
```

**Cambios en config raíz (no son código de producción, son andamiaje).**

- `tsconfig.base.json`: añadir `"@ledger/*": ["apps/ledger/src/*"]` a `paths`.
- `eslint.config.mjs`: añadir `@ledger/**` al `allow` de
  `@nx/enforce-module-boundaries` y un `pathGroup` interno para `@ledger/**` en
  `import-x/order` (espejo del de `@app/**`).

**Interfaces/firmas clave.** El `env.ts` del ledger sigue exactamente el patrón
de finances (mismo import desde `@shared`):

```ts
import { ToBoolean, ToNumber, configValidator } from '@shared';
import { IsOptional, IsString } from 'class-validator';

/** Environment contract for the ledger service; validated once at boot. */
export class Environment {
  @IsString() ENV: string;
  @ToNumber() @IsNumber() PORT: number;
  @IsString() DB_TYPE: string;
  @IsString() DB_URI: string;
  @ToBoolean() @IsBoolean() DB_SSL: boolean;
  @ToBoolean() @IsBoolean() DB_SYNCHRONIZE: boolean;
  @IsOptional() @IsString() OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  // …context/auth vars deferred to EP-2
}

export const loadEnvironment: () => Environment = (() => {
  let cached: Nullable<Environment> = null;
  return () => (cached ??= configValidator(process.env, Environment) as Environment);
})();
```

**Plan TDD (tests primero).**

- `apps/ledger/src/app.wiring.spec.ts` → `it('compiles the root module without a database connection')`
  (espejo de `apps/finances/src/app.wiring.spec.ts`; usa `Test.createTestingModule` con overrides).
- `apps/ledger/src/env.spec.ts` → `it('fails fast when a required variable is missing')`,
  `it('coerces PORT and DB_SSL from strings')`.
- Smoke de arranque: `it('boots the Nest application and closes it')`.

**Criterios de aceptación (Hecho cuando).**

- `npx nx build ledger` produce `dist/apps/ledger` sin errores.
- `npx nx serve ledger` levanta un proceso Nest vacío que responde en `PORT`.
- `npx nx lint ledger` y `npx nx test ledger` pasan (con `passWithNoTests`).
- `@ledger/*` resuelve en compilación, en ESLint (sin violar boundaries) y en Jest.

**Dependencias y riesgos.** Ninguna dependencia interna previa. Riesgo: el
generador `@nx/nest:app` puede emitir `strict: true` o estructura plana; hay que
forzar `--strict=false` y limpiar el scaffolding sobrante para respetar el
hexágono. Riesgo menor: colisión del `nxCloudAccessToken`/caché — irrelevante.

---

### EP-0.2 — Mover a `libs/shared` la plataforma reutilizable

**Objetivo.** Elevar a `libs/shared` (y parametrizar) solo la plataforma que el
ledger consume de verdad — `DatabaseModule` configurable y bootstrap de
telemetría — dejando ya-compartidos config-primitives y auth intactos, sin tocar
el dominio.

**Qué se mueve y qué NO (análisis, no genérico).**

| Pieza | Estado hoy | Acción para EP-0 |
|---|---|---|
| `configValidator`, `ToBoolean`, `ToNumber` | ya en `@shared` | Reutilizar tal cual; el ledger escribe su `Environment` |
| Namespaces `registerAs` | específicos de finances | **No** se mueven; el ledger crea los suyos |
| `DatabaseModule` | en finances, ruta de migraciones hardcodeada | **Mover parametrizado** a `libs/shared` |
| Telemetría (`instrumentation`, `telemetry.config`, `correlation`) | en finances, genérica | **Mover** a `libs/shared/src/telemetry/` |
| `AuthModule` / `JwtAuthGuard` / `AuthenticatedUser` | ya en `@shared/auth` | Reutilizar; contexto `client_id` se añade en EP-2 |
| Outbox + relay scheduler | en finances | **No mover / no cablear** en ledger (ver D-3) |

**Archivos/módulos a crear o mover (rutas concretas).**

- `libs/shared/src/database/database.module.ts` — `DatabaseModule.forRoot(options)`
  estático y `@Global`, con `migrations` y `entities` inyectables por la app.
- `libs/shared/src/database/database-module-options.type.ts`.
- `libs/shared/src/database/index.ts` + re-export en `libs/shared/src/index.ts`.
- `libs/shared/src/telemetry/{instrumentation.ts,telemetry.config.ts,correlation.ts,index.ts}`
  — movidos desde `apps/finances/src/config/telemetry/` con sus `.spec.ts`.
- Consumidores en el ledger:
  `apps/ledger/src/database/data-source.ts` (para migraciones TypeORM del ledger,
  con su propio `entities`/`migrations` glob) y `apps/ledger/src/main.ts`
  (import del bootstrap compartido).

> **Nota de convivencia.** `apps/finances` está congelado; mover estos archivos
> obliga a re-apuntar sus imports (`main.ts`, `database.module.ts`) a `@shared`.
> Es un cambio mecánico de imports, permitido porque no altera comportamiento;
> la suite de finances debe seguir verde. Si se prefiere cero-toque a finances,
> ver D-4 (dejar una fina fachada en finances que re-exporte de `@shared`).

**Interfaces/firmas clave.**

```ts
/** Options an app supplies so one DatabaseModule serves both finances and ledger. */
export interface DatabaseModuleOptions {
  readonly configKey: unknown;          // registerAs KEY of the app's `database` namespace
  readonly migrations: readonly string[];
  readonly entities?: readonly unknown[];
  readonly autoLoadEntities?: boolean;
}

@Global()
export class DatabaseModule {
  /** Wires TypeOrmModule.forRootAsync from the app's `database` config namespace. */
  static forRoot(options: DatabaseModuleOptions): DynamicModule { /* … */ }
}
```

El ledger lo consume así (dos roles, un solo Postgres, §6): event store +
proyecciones comparten conexión; migraciones bajo `dist/apps/ledger/database/migrations/*.js`.

**Plan TDD (tests primero).**

- `libs/shared/src/database/database.module.spec.ts` →
  `it('builds TypeORM options from the injected database namespace')`,
  `it('applies the timestamptz column-type override')`,
  `it('registers the migrations glob passed by the app')`.
- `libs/shared/src/telemetry/telemetry.config.spec.ts` → mover el existente y
  mantener `it('does not start the SDK when OTLP endpoint is unset')`.
- Regresión: `npx nx test finances` sigue verde tras re-apuntar imports.

**Criterios de aceptación (Hecho cuando).**

- `@shared` expone `DatabaseModule.forRoot` y el bootstrap de telemetría.
- `finances` y `ledger` importan **el mismo** `DatabaseModule` con opciones distintas.
- `apps/ledger` arranca telemetría vía el bootstrap compartido (opt-in por env).
- Suites de finances y shared verdes.

**Dependencias y riesgos.** Depende de EP-0.1 (existe `apps/ledger`). Riesgo:
`instrumentation.ts` debe importarse **antes** que cualquier módulo instrumentado;
al moverlo a `@shared` el `main.ts` del ledger debe hacer
`import '@shared/telemetry/instrumentation'` como primerísima línea (side-effect
import), no un import perezoso. Riesgo de boundaries ESLint si finances importa
`@shared` internals; usar el barrel.

---

### EP-0.3 — `Money` decimal exacto + `minor_units` por moneda (INV-8)

**Objetivo.** Escribir en el core del ledger un value object `Money` de
aritmética **decimal exacta**, cuya construcción desde `number` sea imposible
(INV-8), que respete los `minor_units` de su moneda en el registro y serialice
como string decimal (RNF-2).

**Recomendación de librería: `big.js` (sobre `decimal.js`).**

| Criterio | `big.js` | `decimal.js` |
|---|---|---|
| Exactitud decimal | Sí (base-10, sin binario) | Sí |
| Inmutabilidad | Sí, cada op retorna nuevo `Big` | Sí |
| Modo estricto que **prohíbe construir desde `number`** | **Sí: `Big.strict = true`** exige strings y rechaza primitivos numéricos | No tiene equivalente |
| Superficie de API | Mínima (+ − × ÷ cmp round) — menos footguns | Amplia (trig, exp, log…) que no usamos |
| Redondeo half-even para valoración | `Big.RM = Big.roundHalfEven` | `Decimal.ROUND_HALF_EVEN` |
| Presencia en el árbol | Ya resuelta (`big.js@5.2.2`) | Ausente (habría que añadirla) |
| Tamaño | ~6 KB | ~32 KB |

**Justificación.** `big.js` gana por dos razones decisivas para este dominio:
(1) `Big.strict = true` convierte INV-8 en una **defensa de librería** además de
la de tipos — cualquier intento de `new Big(number)` lanza, reforzando la regla
"construcción desde `number` prohibida" incluso ante llamadores JS sin tipos;
(2) su API mínima reduce la superficie de error y basta para todo lo que el
ledger necesita (suma/resta/negación/comparación en el core; multiplicación y
redondeo half-even **solo** en valoración de lectura, EP-4.5). `decimal.js`
aporta funciones que la spec no requiere (YAGNI). Además `big.js` ya está en
`node_modules`; se **promueve a dependencia directa** en `package.json`. Se
configura `Big.DP` alto y `Big.RM = Big.roundHalfEven` en un único módulo de
inicialización del VO, nunca disperso.

**Archivos/módulos a crear (rutas concretas).**

- `apps/ledger/src/shared/domain/money/currency.ts` — VO mínimo `Currency`
  (`code` + `minorUnits`); semilla que EP-1.1 expandirá (validación ISO,
  registro `CurrencyRegistered`). Mantiene `(amount, currency)` inseparable
  (regla de protección §9.4.1).
- `apps/ledger/src/shared/domain/money/money.ts` — el VO `Money`.
- `apps/ledger/src/shared/domain/money/money.exception.ts` — excepciones tipadas,
  extendiendo `DomainUnprocessableException` de `@shared` (como hoy hace
  `apps/finances/src/shared/domain/money.exception.ts`).
- `apps/ledger/src/shared/domain/money/big.config.ts` — configuración única de
  `Big` (`Big.strict`, `Big.DP`, `Big.RM`).
- `apps/ledger/src/shared/domain/money/index.ts` (+ barrel del shared-kernel).

**Interfaces/firmas clave (Money decimal — firma nueva).**

```ts
import Big from 'big.js';
import { DomainUnprocessableException } from '@shared';

export class InvalidMoneyException extends DomainUnprocessableException {}
export class CurrencyMismatchException extends DomainUnprocessableException {}
export class MoneyScaleException extends DomainUnprocessableException {}

/**
 * A currency with its minor-unit precision (COP → 0, USD → 2). Seed value
 * object; the full registry (CurrencyRegistered, §2.5) arrives in EP-1.1.
 */
export class Currency {
  private constructor(
    readonly code: string,
    readonly minorUnits: number,
  ) {}

  /** Rejects blank codes and negative/non-integer minor units (guard clauses). */
  static of(code: string, minorUnits: number): Currency { /* … */ }
}

/**
 * An exact decimal amount bound to its currency. Immutable: every operation
 * returns a new instance. Constructing from `number` is forbidden (INV-8) —
 * `of` only accepts a decimal string, and the internal `Big` runs in
 * `Big.strict` mode so a numeric value never enters the arithmetic.
 */
export class Money {
  private constructor(
    private readonly value: Big,
    readonly currency: Currency,
  ) {}

  /**
   * Builds from an exact decimal string, e.g. `"31900"`, `"-7.99"`. The scale
   * must not exceed the currency `minorUnits` (§2.7.1): `"100.5"` for a
   * 0-decimal COP is rejected. Never accepts a `number`.
   */
  static of(amount: string, currency: Currency): Money { /* guard: typeof amount === 'string' */ }

  static zero(currency: Currency): Money { /* … */ }

  add(other: Money): Money { /* ensureSameCurrency */ }
  subtract(other: Money): Money { /* … */ }
  negate(): Money { /* … */ }

  isZero(): boolean
  isNegative(): boolean
  equals(other: Money): boolean
  compareTo(other: Money): -1 | 0 | 1

  /** Exact decimal string for event payloads / DTOs / NUMERIC columns (RNF-2). */
  toDecimalString(): string

  toString(): string { /* `${this.toDecimalString()} ${this.currency.code}` */ }

  private ensureSameCurrency(other: Money): void { /* throw CurrencyMismatchException */ }
}
```

> **Fuera de alcance de EP-0.3 (deliberado, YAGNI):** `multiply`/`convertTo` con
> redondeo half-even pertenecen a valoración de lectura (EP-4.5); la lógica de
> **balanceo a cero por moneda** (INV-1) es un componente único del dominio
> (INV-11) que vive en el agregado `LedgerTransaction` (EP-1.7). EP-0.3 entrega
> el ladrillo `Money`; opcionalmente una función pura `sumByCurrency(postings)`
> como semilla de INV-11 solo si EP-1.7 la va a consumir de inmediato.

**Plan TDD (tests primero) — `money.spec.ts` / `currency.spec.ts`.**

- `it('builds from a decimal string and echoes it back exactly')`.
- `it('rejects construction from a number at runtime (INV-8)')` — pasar `(10.005 as any)`.
- `it('rejects a scale beyond the currency minor units')` — `Money.of('100.5', COP0)` lanza `MoneyScaleException`.
- `it('accepts a scale within the currency minor units')` — `Money.of('7.99', USD2)`.
- `it('keeps cent arithmetic exact where float fails')` — `of('0.1').add(of('0.2'))` → `'0.3'` (el test que el `Money` float pasaba por redondeo, aquí es exacto por construcción).
- `it('adds and subtracts within the same currency')`.
- `it('refuses to combine different currencies')` → `CurrencyMismatchException`.
- `it('is immutable: operations return a new instance')`.
- `it('negates, compares and detects zero/negative')`.
- `it('serializes negative amounts as decimal strings for events (RNF-2)')` — `of('-31900', COP0).toDecimalString()` → `'-31900'`.
- `it('rejects blank currency codes and non-integer minor units')` (Currency).

**Criterios de aceptación (Hecho cuando).**

- `Money` no expone ninguna vía de construcción desde `number` (ni tipo ni runtime).
- Toda aritmética es exacta y `toDecimalString()` nunca produce notación
  científica ni float.
- Se rechazan escalas superiores a `minorUnits`.
- `big.js` figura como dependencia directa en `package.json`.
- Suite de `Money`/`Currency` verde; cobertura de los invariantes INV-8/RNF-2.

**Dependencias y riesgos.** Solaparse con EP-1.1 (`Currency` completa) — se
mitiga entregando un `Currency` mínimo y marcando el punto de extensión. Riesgo:
`Big.strict` es **global** del módulo `big.js`; si finances llegara a importar el
mismo `big.js` podría verse afectado — mitigación: finances no usa `big.js`
(su `Money` es float y congelado), y la configuración se hace en `big.config.ts`
del ledger, importado solo por el core del ledger. Riesgo de serialización:
`Big.prototype.toString` puede usar exponencial fuera de `Big.PE`/`Big.NE`;
fijar `Big.PE`/`Big.NE` a extremos para forzar notación plana en `toDecimalString`.

---

### EP-0.4 — Harness de testing: contract tests reusables + `Clock`/`IdGenerator`

**Objetivo.** Dejar la infraestructura de pruebas que EP-1 usará intensivamente:
puertos `Clock` e `IdGenerator` con dobles deterministas, y un **patrón de
contract-suite** que corre la misma batería contra el adaptador in-memory y el
real (RNF-11), demostrado ya con `Clock`/`IdGenerator`.

**Archivos/módulos a crear (rutas concretas).**

- Puertos del núcleo (clases abstractas, no interfaces — convención del repo):
  - `apps/ledger/src/shared/domain/ports/clock.ts` — `abstract class Clock`.
  - `apps/ledger/src/shared/domain/ports/id-generator.ts` — `abstract class IdGenerator`.
  - `apps/ledger/src/shared/domain/ports/index.ts`.
- Dobles deterministas (para tests, no producción):
  - `apps/ledger/src/shared/testing/fixed-clock.ts` — `FixedClock`.
  - `apps/ledger/src/shared/testing/sequential-id-generator.ts` — `SequentialIdGenerator`.
- Adaptadores reales (mínimos, para probar el patrón contra "real"):
  - `apps/ledger/src/shared/infrastructure/system-clock.ts` — `SystemClock`.
  - `apps/ledger/src/shared/infrastructure/uuid-id-generator.ts` — `UuidIdGenerator` (`crypto.randomUUID`).
- **Contract-suite reusable** (el corazón de EP-0.4):
  - `apps/ledger/src/shared/testing/contract/clock.contract.ts` — export `runClockContract(makeClock: () => Clock)`.
  - `apps/ledger/src/shared/testing/contract/id-generator.contract.ts` — export `runIdGeneratorContract(makeIdGenerator: () => IdGenerator)`.
  - `apps/ledger/src/shared/testing/contract/define-contract.ts` — helper
    `defineContract(name, cases)` que estandariza cómo se declara una suite
    reusable (convención que EP-1.4/EP-1.5 aplicarán al puerto `EventStore`).
  - Specs que **invocan** la suite contra cada implementación:
    `system-clock.spec.ts` → `runClockContract(() => new SystemClock())` y
    `fixed-clock.spec.ts` → `runClockContract(() => new FixedClock(...))`.
- Builders de datos de prueba: `apps/ledger/src/shared/testing/builders/money.builder.ts`
  (p. ej. `aMoney().of('100').inUsd()`), para tests legibles del dominio.

**Interfaces/firmas clave.**

```ts
/** Wall clock as a port so tests pin time (§3.8, "deterministas en tests"). */
export abstract class Clock {
  abstract now(): Date; // always UTC (RNF-7)
}

/** Identifier source as a port so tests get reproducible ids. */
export abstract class IdGenerator {
  abstract next(): string; // UUID v4 string
}

/** Deterministic double: returns the pinned instant, advanceable in tests. */
export class FixedClock extends Clock {
  constructor(private current: Date) { super(); }
  now(): Date { return this.current; }
  advanceBy(ms: number): void { this.current = new Date(this.current.getTime() + ms); }
}

/** Deterministic double: monotonic, reproducible ids like '00000000-…-0001'. */
export class SequentialIdGenerator extends IdGenerator {
  #seq = 0;
  next(): string { return formatSequential(++this.#seq); }
}

/**
 * The reusable contract for any Clock. EP-1 mirrors this shape for EventStore:
 * one exported runner, invoked by each adapter's spec so in-memory and real
 * implementations prove identical behaviour (RNF-11).
 */
export function runClockContract(makeClock: () => Clock): void {
  describe('Clock contract', () => {
    it('returns a Date in UTC', () => { /* … */ });
    it('never returns a time before the previous call', () => { /* … */ });
  });
}
```

**Plan TDD (tests primero).**

- `runClockContract` ejecutado por `FixedClock` y `SystemClock`:
  `it('returns a Date in UTC')`, `it('is monotonic non-decreasing')`.
- `runIdGeneratorContract` ejecutado por `SequentialIdGenerator` y `UuidIdGenerator`:
  `it('never repeats an id across N calls')`, `it('returns UUID-shaped strings')`.
- `it('FixedClock.advanceBy moves time forward deterministically')`.
- `it('SequentialIdGenerator is reproducible from a fresh instance')`.
- Meta-test del helper: `it('defineContract runs every case it is given')`.

**Criterios de aceptación (Hecho cuando).**

- Existen `Clock`/`IdGenerator` (puertos) con dobles deterministas y adaptadores reales.
- La **misma** función de contract-suite corre contra dos implementaciones y pasa.
- El patrón (`define-contract` + `run<Port>Contract`) está documentado con un
  ejemplo real, listo para que EP-1.4/EP-1.5 lo apliquen a `EventStore`.
- `npx nx test ledger` corre la suite del harness.

**Dependencias y riesgos.** Solapa con EP-1.3 (roadmap lista allí "Puertos
`Clock`, `IdGenerator`"): **decisión de frontera** — EP-0.4 *entrega* los puertos
y sus dobles + el patrón de contract-suite; EP-1.3 solo los *consume* al declarar
`EventStore`. Actualizar el roadmap para reflejarlo (ver D-5). Riesgo: sobre-diseñar
el helper `defineContract`; mantenerlo mínimo (YAGNI) — su valor se prueba con
Clock/IdGenerator, no antes.

---

### EP-0.5 — CI de `apps/ledger` y decisión de despliegue en paralelo

**Objetivo.** Que CI construya, linte y testee `ledger` (con migraciones contra
una base efímera), y dejar decidido cómo se despliega junto a `finances`.

**Archivos/cambios (rutas concretas).**

- `.github/workflows/ci.yml`:
  - Corregir el disparador `push: branches: [main]` → incluir `master` (bug actual).
  - Añadir al job `build-and-test` pasos para el ledger, o migrar a `nx affected`
    (`npx nx run-many -t build lint test` / `npx nx affected -t …`) para cubrir
    ambos proyectos sin duplicar YAML.
  - Añadir servicio Postgres con base `ledger` (o reutilizar la instancia y crear
    una segunda base) y paso de migraciones del event store del ledger
    (`data-source.ts` del ledger).
- `docker-compose.yml` / `docker/`: añadir base `ledger` para desarrollo local
  (misma instancia Postgres, base separada — event store fresco, §Estrategia).
- `apps/ledger/.env.example` con las vars mínimas (`DB_URI`, `PORT`, `OTEL_*`).

**Decisión de despliegue (a confirmar, ver D-1).** Propuesta:

- `ledger` es un **deployable independiente** de `finances` (proceso y puerto
  propios), no un módulo dentro de finances: son bounded contexts distintos y
  finances está congelado para retirarse por reemplazo.
- **Base de datos propia** `ledger` (event store append-only + proyecciones en
  el mismo Postgres, roles separados §6). No comparte tablas con finances. Como
  no hay datos de producción, se crea desde cero.
- En dev, ambos servicios comparten la instancia Postgres del `docker-compose`
  con bases distintas; en CI, un servicio Postgres con dos bases o dos pasos de
  migración.
- Convivencia: se despliegan **en paralelo** detrás del mismo gateway/identidad
  externa; el tráfico se corta a `ledger` por endpoint a medida que alcanza
  paridad (roadmap). Sin doble escritura: cada uno es dueño de su base.

**Plan TDD / verificación (no hay unidades nuevas; se verifica el pipeline).**

- `it` de humo ya cubiertos por EP-0.1 corren en CI (`nx test ledger`).
- Job de migraciones: la migración inicial del event store (esquema §6.1) aplica
  limpio sobre base vacía — se valida en CI con `migration:run` del ledger
  (la migración concreta es EP-1.5; en EP-0.5 basta el **paso** cableado, aunque
  arranque sin migraciones si EP-1.5 aún no existe).
- `npx nx run-many -t lint build test` verde localmente antes de commitear.

**Criterios de aceptación (Hecho cuando).**

- CI construye/linta/testea `ledger` además de `finances` en cada PR.
- CI dispara en `master` (y en `main` si se conserva).
- Existe base `ledger` en dev/CI y un paso de migraciones del event store cableado.
- La decisión de despliegue en paralelo está escrita y confirmada.

**Dependencias y riesgos.** Depende de EP-0.1 (targets Nx) y se beneficia de
EP-1.5 (primera migración real). Riesgo: `nx affected` necesita `fetch-depth: 0`
en el checkout para comparar contra `master`; hoy el checkout no lo fija. Riesgo
operativo: dos apps NestJS en el mismo repo comparten `node_modules` y versiones
— alineado por diseño monorepo, sin acción extra.

---

### Comandos Nx sugeridos (exactos)

```bash
# 1) Generar la app NestJS (Nx 23 + @nx/nest). Forma con project-path:
npx nx g @nx/nest:application apps/ledger \
  --unitTestRunner=jest \
  --linter=eslint \
  --strict=false \
  --e2eTestRunner=none \
  --tags=

# (equivalente clásico si la anterior no infiere el nombre:)
# npx nx g @nx/nest:app ledger --directory=apps/ledger --strict=false --e2eTestRunner=none

# 2) Verificar que el proyecto quedó registrado
npx nx show project ledger --web=false
npx nx graph --file=tmp/graph.json   # inspección del grafo de dependencias

# 3) Ciclo de vida
npx nx build ledger
npx nx serve ledger
npx nx lint  ledger
npx nx test  ledger

# 4) Ambos proyectos a la vez (para CI y verificación local)
npx nx run-many -t build lint test --projects=finances,ledger
npx nx affected -t build lint test --base=master   # requiere checkout fetch-depth: 0

# 5) Promover big.js a dependencia directa (EP-0.3)
npm i big.js && npm i -D @types/big.js
```

> Tras generar, **limpiar** el scaffolding por defecto (`app.controller.ts`,
> `app.service.ts` de ejemplo) y sustituir por la estructura hexagonal descrita
> en EP-0.1. Añadir a mano `@ledger/*` en `tsconfig.base.json`, el `allow` y el
> `pathGroup` en `eslint.config.mjs`, y el `moduleNameMapper` en el `jest.config.ts`
> del ledger (el generador no los pone).

---

### Decisiones (resueltas durante la implementación)

- **D-1 (Despliegue) → deployable independiente.** `ledger` corre como proceso y
  puerto propios con base `ledger` separada en el mismo Postgres; convivencia en
  paralelo con `finances`, cada app dueña de su base. Confirmado por el usuario.
- **D-2 (Librería decimal) → `big.js` v6.** Confirmado por el usuario. Nota de
  implementación: `Big.strict` **solo existe desde big.js v6** — la v5.2.2
  resuelta transitivamente no tiene `strict` ni la constante `roundHalfEven`
  (el análisis las asumía en v5). Se promovió `big.js@^6.2.2` a dependencia
  directa junto a `@types/big.js@^6.2.2`.
- **D-3 (Outbox) → no se cablea en el ledger.** El event store es el outbox
  (§9.3, CDC diferido); el outbox existente se queda en `finances`.
- **D-4 (Tocar finances) → re-apuntar imports.** `DatabaseModule` y telemetría
  movidos a `@shared`; `finances` actualiza `main.ts`, `database.module.ts` y 3
  use cases a imports de `@shared` (cambio mecánico; suite 155/155 verde).
  Nota: cada app conserva un `database.module.ts` **estático** fino que envuelve
  el `forRoot` compartido, porque `overrideModule` de `@nestjs/testing` no
  matchea módulos dinámicos — el wiring spec necesita ese punto de override.
- **D-5 (Frontera EP-0.4/EP-1.3) → EP-0.4 entrega, EP-1.3 consume.** Roadmap
  actualizado.
- **D-6 (`Currency` mínima) → semilla `{code, minorUnits}`.** EP-1.1 la expande.
  Nota: se añadió `InvalidCurrencyException` (cuarta excepción) para los guardas
  de `Currency`, que no encajaban en `InvalidMoneyException`.
- **D-7 (Trigger de CI) → solo `master`.** Confirmado por el usuario.

---

### Estimación relativa de esfuerzo

| Subtarea | Esfuerzo | Racional |
|---|---|---|
| EP-0.1 Generar `apps/ledger` | **M** | Generación + limpieza de scaffolding + aliases/lint/jest en 3 config files + estructura hexagonal |
| EP-0.2 Plataforma a `@shared` | **L** | Parametrizar `DatabaseModule`, mover telemetría, re-apuntar finances sin romper su suite; el toque a app congelada exige cuidado |
| EP-0.3 `Money` decimal | **M** | VO acotado y muy testeable, pero es núcleo crítico (INV-8/RNF-2) y decide librería; `Currency` semilla |
| EP-0.4 Harness + `Clock`/`IdGenerator` | **M** | Puertos + dobles triviales, pero el **patrón** de contract-suite reusable es el activo de mayor valor y hay que dejarlo bien |
| EP-0.5 CI + despliegue | **S** | Cambios de YAML/compose + decisión documentada; sin código de dominio |

Orden sugerido: **0.1 → 0.2 → (0.3 ∥ 0.4) → 0.5**. 0.3 y 0.4 son independientes
entre sí una vez que existe `apps/ledger`.
