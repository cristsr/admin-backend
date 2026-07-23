# EP-4 — Producto: presupuestos, metas, valoración y reportes (Fase 4)

> Épica del [roadmap](../../ledger-roadmap.md). Fuente: [especificación](../../especificacion-tecnica-ledger.md).
> Este archivo debe contener el **plan detallado de implementación** de la épica.

## Alcance (subtareas)

- **EP-4.1** `LedgerSettings`: `presentation_currency`, `timezone` + `/ledger/settings`.
- **EP-4.2** `CurrencyRegistered` (`/currencies`) y `PriceRecorded` con corrección por superposición (§2.6, `/prices`).
- **EP-4.3** Agregado `Budget` + proyección `budget_consumption` (confirmados vs pendientes, RF-24) + `/budgets`.
- **EP-4.4** Agregado `Goal` + progreso desde balances + reactor de logro (RF-25) + `/goals`.
- **EP-4.5** Valoración: proyección `net_worth` + conversión half-even solo en lectura (§2.7.1, RF-23).
- **EP-4.6** Reportes: gastos por categoría/período/payee, patrimonio, auditoría de ajustes (`/reports/*`).

---

## Plan detallado

### 0. Disciplina, precondiciones y encuadre arquitectónico

**Regla de disciplina de la spec (§11, roadmap §"Secuencia y dependencias").** La
capa de producto (EP-4) **no se construye hasta que los invariantes del núcleo
estén reforzados** y las proyecciones estén verificadas contra el stream por
replay (RNF-5). Concretamente, EP-4 **presume terminadas y estables**:

- **EP-0**: `apps/ledger` andamiado, `libs/shared` con plataforma (config
  class-validator + `registerAs`, `DatabaseModule`, OTel, guards de contexto,
  outbox), `Money` decimal exacto (INV-8), harness de contract tests, utilidades
  deterministas `Clock`/`IdGenerator`.
- **EP-1**: puertos `EventStore`, `ReadModelStore`/puertos por proyección,
  `ProjectionDispatcher`; command bus + políticas transversales (idempotencia por
  `external_ref`, contexto, concurrencia optimista); agregados `Account` y
  `LedgerTransaction`; proyecciones `account_tree`, `transaction_list`
  (+ `proj_postings`), `account_balances`; tooling de rebuild/replay. **En
  particular EP-1 ya emite `LedgerInitialized`** (con `presentation_currency` +
  `timezone`) desde el command `InitializeLedger`; EP-4.1 lo **consume**, no lo
  redefine.
- **EP-2**: adaptador HTTP driving (controllers → command/query bus), contexto
  autenticado (`user_id`, `client_id`, RF-26), exception filter con códigos de
  error estables (RF-14), read-your-writes por posición de stream (RNF-9).
- **EP-3**: primeros **reactors/process managers** (re-evaluación de aserciones)
  y proyección `adjustment_audit`. EP-4.4 reutiliza ese patrón de reactor; EP-4.6
  reutiliza `adjustment_audit`.

Todo EP-4 respeta las reglas transversales del núcleo:

- **Núcleo sin infraestructura (RNF-11)**: `domain` y `application` libres de
  NestJS, TypeORM y serialización concreta. Todo acceso externo por puertos.
- **CQRS estricto (§3.2, RNF-10)**: commands → agregados → eventos; queries →
  proyecciones. Los **projectors** son los únicos escritores de read models; los
  **reactors** solo despachan commands (nunca escriben eventos ni proyecciones).
- **INV-8 / RNF-2**: montos como **string decimal** en DTOs, payloads y columnas
  `NUMERIC`; aritmética solo dentro de `Money`; construcción desde `number`
  prohibida.
- **Redondeo solo en valoración y solo en lectura (§2.7.1)**: half-even a los
  `minor_units` de la moneda de presentación; **ningún valor redondeado se
  persiste** (ni siquiera en la proyección `net_worth`).

**Skills obligatorias** al escribir/revisar cualquier TypeScript de esta épica
(CLAUDE.md): `typescript`, `design-principles`, `error-handling`. Comentarios en
inglés + JSDoc de intención. Enums solo en la capa de app; columnas enum-like
como `varchar`/`text` (memoria "No DB enums").

### 0.1 Estructura de módulos bajo `apps/ledger`

EP-4 introduce cuatro módulos NestJS nuevos, cada uno con su hexágono interno
(`domain` / `application` / `infrastructure`), siguiendo la organización por
módulos de §8.1 y la que ya usa `finances` (p. ej. `apps/finances/src/budget`,
`apps/finances/src/exchange`, `apps/finances/src/summary`):

```
apps/ledger/src/
  settings/     # EP-4.1  LedgerSettings (root = UserId)
  reference/    # EP-4.2  Currency + Price (datos de referencia event-sourced)
  product/      # EP-4.3 + EP-4.4  Budget + Goal (submódulos)
  reporting/    # EP-4.5 + EP-4.6  valuation + net_worth + /reports/*
```

Convención hexagonal por módulo (idéntica a `finances`):

```
<module>/
  domain/<aggregate>/{entities,events,value-objects,exceptions,services,repositories,index}.ts
  application/{commands,queries,handlers,reactors,projectors,dto,mappers}
  infrastructure/adapters/{http,persistence/typeorm,messaging}
  <module>.module.ts
```

### 0.2 Patrones de `finances` que se reutilizan como referencia conceptual

- **Presupuesto (concepto, ciclo de vida, umbrales, scheduler, notificación)**:
  `apps/finances/src/budget/domain/budget/entities/budget.entity.ts` (umbrales,
  `recordSpending`, renovación), `apps/finances/src/budget/infrastructure/adapters/schedulers/budget.scheduler.ts`
  (cron mensual con `@nestjs/schedule`), `apps/finances/src/budget/infrastructure/adapters/messaging/pgmq-budget-notification.publisher.ts`
  (publicación PGMQ tolerante a fallo), `apps/finances/src/budget/infrastructure/adapters/http/budget.controller.ts`.
  **Nota**: en `ledger` el `Budget` es un agregado event-sourced (no una entidad
  TypeORM CRUD) y su "consumo" es una **proyección**, no un cálculo en el entity.
- **Tasas de cambio / valoración**: `apps/finances/src/exchange/infrastructure/adapters/rates/caching-exchange-rate.provider.ts`
  (cache-aside rate lookup), `apps/finances/src/exchange/domain/exchange-rate/providers/exchange-rate.provider.ts`,
  `apps/finances/src/exchange/infrastructure/adapters/rates/cuex-exchange-rate-source.provider.ts`.
  **Nota**: en `ledger` las tasas son `PriceRecorded` en el stream y la proyección
  `proj_prices`; no hay fuente externa en v1 (se registran vía API), y la
  valoración usa `Money` decimal, **no `number`** como el provider de `finances`.
- **Reportes consolidados sobre lecturas**: `apps/finances/src/summary/infrastructure/adapters/persistence/typeorm/summary/typeorm-summary.repository.ts`
  (query builders de balance/expenses) y `apps/finances/src/summary/application/usecases/get-consolidated-balance.usecase.ts`.
  **Nota**: en `ledger` los reportes son **query handlers** sobre proyecciones
  (`proj_postings`, `net_worth`, `budget_consumption`, `adjustment_audit`), sin
  lógica de dominio (RNF-10).

---

### EP-4.1 — `LedgerSettings`: moneda de presentación y zona horaria

**Objetivo.** Modelar `LedgerSettings` como agregado con raíz `UserId` que folda
`LedgerInitialized` (emitido por EP-1) y sus dos eventos de mutación
`PresentationCurrencyChanged` / `TimezoneChanged`, exponer la proyección
`proj_ledger_settings` y los endpoints `GET/PATCH /ledger/settings`. El cambio
afecta interpretaciones y valoración **futuras**, jamás eventos registrados
(§2.7). Este módulo es prerrequisito de EP-4.5 (valoración necesita
`presentation_currency`) y de EP-3 en producción (cierre de día necesita
`timezone`); su proyección puede ya existir parcialmente desde EP-1, en cuyo caso
EP-4.1 la **extiende** para reaccionar a los dos eventos de cambio.

**Archivos/módulos a crear.**

```
apps/ledger/src/settings/
  domain/ledger-settings/
    entities/ledger-settings.aggregate.ts
    value-objects/currency-code.vo.ts
    value-objects/iana-timezone.vo.ts
    events/{ledger-settings-events.ts,index.ts}   # tipos de PresentationCurrencyChanged, TimezoneChanged
    exceptions/{settings.exception.ts,index.ts}
    repositories/ledger-settings.repository.ts     # puerto: load/save via EventStore
    index.ts
  application/
    commands/{change-presentation-currency.command.ts,change-timezone.command.ts}
    handlers/{change-presentation-currency.handler.ts,change-timezone.handler.ts}
    queries/get-ledger-settings.query.ts
    handlers/get-ledger-settings.handler.ts
    projectors/ledger-settings.projector.ts
    dto/{ledger-settings-output.dto.ts,change-settings-input.dto.ts,index.ts}
    mappers/ledger-settings.mapper.ts
  infrastructure/adapters/
    http/ledger-settings.controller.ts
    persistence/typeorm/ledger-settings/{proj-ledger-settings.entity.ts,proj-ledger-settings.read-store.ts}
  settings.module.ts
```

**Firmas TypeScript clave.**

```ts
/** IANA zone id, e.g. 'America/Bogota'. Validated against the runtime zone set. */
export class IanaTimeZone {
  private constructor(private readonly value: string) {}
  static of(value: string): IanaTimeZone;   // throws InvalidTimeZoneException
  toString(): string;
}

/** ISO-4217-like code; must be a registered currency to be usable (EP-4.2). */
export class CurrencyCode {
  private constructor(private readonly value: string);
  static of(value: string): CurrencyCode;   // throws InvalidCurrencyCodeException
  equals(other: CurrencyCode): boolean;
  toString(): string;
}

/**
 * Accounting preferences the domain needs to know (§2.7). Root = UserId: exactly
 * one settings stream per user. Rehydrated from LedgerInitialized (EP-1) plus the
 * two change events; a no-op change (same value) emits nothing (idempotent).
 */
export class LedgerSettings extends AggregateRoot<UserId> {
  private presentationCurrency: CurrencyCode;
  private timezone: IanaTimeZone;

  /** Guard: no-op if unchanged. Emits PresentationCurrencyChanged. */
  changePresentationCurrency(currency: CurrencyCode): void;
  /** Guard: no-op if unchanged. Emits TimezoneChanged. */
  changeTimezone(timezone: IanaTimeZone): void;

  protected apply(event: DomainEvent): void;   // folds Initialized + both Changed
}

export interface LedgerSettingsRepository {   // puerto (EP-1 EventStore-backed)
  load(userId: UserId): Promise<Nullable<LedgerSettings>>;
  save(settings: LedgerSettings, expectedVersion: number): Promise<StreamPosition>;
}
```

**Plan TDD.**

1. *Unit del agregado* (`ledger-settings.aggregate.spec.ts`): rehidratación desde
   `LedgerInitialized`; `changePresentationCurrency` emite un evento; repetirlo con
   el **mismo** valor no emite nada (idempotencia de dominio, no confundir con la
   idempotencia por `external_ref`); `changeTimezone` idem; secuencia/versión
   correcta.
2. *Unit de value objects*: `CurrencyCode.of` rechaza vacío/formato inválido;
   `IanaTimeZone.of` rechaza zonas inexistentes y acepta `America/Bogota`.
3. *Unit del projector*: `LedgerInitialized` inserta fila; cada `Changed`
   actualiza la columna correspondiente y `updated_at`; **rebuild** desde cero
   reproduce el estado final (RNF-5).
4. *e2e* (`ledger-settings.e2e-spec.ts`): `PATCH /ledger/settings` sin contexto
   autenticado → rechazado (RF-26); cambio válido → 200 + `GET` refleja el nuevo
   valor (read-your-writes, RNF-9); código de moneda no registrada → error de
   dominio estable.

**Criterios de aceptación.**

- Existe exactamente una fila en `proj_ledger_settings` por usuario tras
  inicializar; `GET /ledger/settings` la devuelve.
- Cambiar moneda de presentación o zona horaria emite el evento respectivo y
  actualiza la proyección; no toca eventos previos.
- Un cambio al mismo valor es idempotente (no crece el stream).

**Dependencias.** EP-1 (`LedgerInitialized`, `AggregateRoot`, `EventStore`,
projector infra), EP-2 (HTTP + contexto). **Bloquea** EP-4.5 (valoración) y
EP-4.3 (presupuestos definidos en la moneda de presentación).

**Riesgos.** (a) Validación de `presentation_currency` contra monedas registradas
crea un acoplamiento EP-4.1↔EP-4.2: resolver como validación inter-agregado
relajada (§3.5) consultando `proj_currencies`, no como invariante duro. (b) Cambiar
`timezone` re-interpreta el "cierre de día" de aserciones ya evaluadas (§2.4);
documentar que **no** dispara re-evaluación retroactiva en v1 (solo afecta futuro).

**Estimación: S/M.**

---

### EP-4.2 — Datos de referencia: `CurrencyRegistered` y `PriceRecorded`

**Objetivo.** Registrar monedas (`CurrencyRegistered`, con `minor_units`, §2.5) y
tasas de cambio fechadas (`PriceRecorded`, §2.6) como **datos de referencia
event-sourced simples** (no agregados ricos, §3.3), con **corrección por
superposición last-write-wins auditada**: una tasa mal cargada se corrige
registrando otra para la misma `(base, quote, date, source)`, y la **vigente es la
de mayor posición global en el stream**. Exponer `/currencies` y `/prices`.

**Archivos/módulos a crear.**

```
apps/ledger/src/reference/
  domain/
    currency/
      entities/currency.aggregate.ts          # thin: aggregate_id derivado de (user, code)
      events/currency-registered.event.ts
      value-objects/minor-units.vo.ts
      exceptions/{currency.exception.ts,index.ts}
      repositories/currency.repository.ts
      index.ts
    price/
      entities/price-feed.aggregate.ts         # thin: append-only PriceRecorded per (base,quote,source)
      events/price-recorded.event.ts
      value-objects/exchange-rate.vo.ts         # rate como decimal string, no number
      services/price-lookup.service.ts          # puerto de lectura para valoración
      repositories/price.repository.ts
      index.ts
  application/
    commands/{register-currency.command.ts,record-price.command.ts}
    handlers/{register-currency.handler.ts,record-price.handler.ts}
    queries/{list-currencies.query.ts,list-prices.query.ts,resolve-rate.query.ts}
    handlers/{list-currencies.handler.ts,list-prices.handler.ts,resolve-rate.handler.ts}
    projectors/{currencies.projector.ts,prices.projector.ts}
    dto/{currency-io.dto.ts,price-io.dto.ts,index.ts}
    mappers/{currency.mapper.ts,price.mapper.ts}
  infrastructure/adapters/
    http/{currencies.controller.ts,prices.controller.ts}
    persistence/typeorm/{proj-currencies.*,proj-prices.*}
  reference.module.ts
```

**Firmas TypeScript clave.**

```ts
/** Number of decimal places of a currency (COP=0, USD=2). Drives INV-8/Money. */
export class MinorUnits {
  static of(value: number): MinorUnits;   // integer >= 0
  get value(): number;
}

/** CurrencyRegistered payload. minor_units feeds Money construction (§2.7.1). */
export interface CurrencyRegistered {
  code: string;
  minorUnits: number;
  name: string;
}

/**
 * Dated FX observation used ONLY for valuation in projections/reports, never to
 * alter recorded amounts (§2.6). rate as decimal string (INV-8/RNF-2).
 */
export interface PriceRecorded {
  base: string;
  quote: string;
  date: PlainDate;      // flat date, no zone (RNF-7)
  rate: string;         // decimal string
  source: string;
}

/**
 * Read-side rate resolution for valuation. Overlap correction (§2.6): among rows
 * with the same (base, quote, date, source) the one with the highest global
 * position wins (last-write-wins). Resolves the rate effective at a report date
 * (RF-23): latest date <= asOf.
 */
export interface PriceLookup {
  rateAt(base: CurrencyCode, quote: CurrencyCode, asOf: PlainDate): Promise<Nullable<ExchangeRate>>;
}
```

**Diseño LWW auditado (§2.6).** El stream conserva **todas** las
`PriceRecorded` (auditoría, INV-12: append-only, nunca se edita). El projector
`prices.projector` resuelve la vigente por `(base, quote, date, source)` quedándose
con la de **mayor `global_position`**; `proj_prices` guarda la fila vigente +
`superseded` de las anteriores (o una tabla histórica separada). La query de
valoración toma la vigente a la fecha del reporte (`date <= asOf`, la más reciente).

**Plan TDD.**

1. *Unit*: `MinorUnits.of` rechaza negativos/no enteros; `ExchangeRate` rechaza
   `number`/float y acepta string decimal.
2. *Unit del projector de precios — corrección por superposición*: registrar tasa
   A para `(USD,COP,2026-07-20,manual)`, luego tasa B para la misma clave;
   `proj_prices` marca B vigente y A superseded; `rateAt` devuelve B. Registrar una
   tercera con posición mayor la vuelve vigente (LWW por posición, no por
   `recorded_at`).
3. *Unit del projector de precios — vigencia por fecha*: `rateAt(asOf)` toma la
   fecha más reciente `<= asOf`.
4. *Unit del projector de monedas*: `CurrencyRegistered` inserta; re-registro del
   mismo code actualiza `minor_units`/`name` (con la política elegida) sin
   duplicar.
5. *e2e*: `POST /currencies` y `POST /prices` con `external_ref` idempotente
   (INV-10); `GET` listan; corrección visible al re-`POST` de la misma clave.

**Criterios de aceptación.**

- Registrar una moneda la hace utilizable por `Money` (respeta `minor_units`).
- Re-registrar una tasa para la misma `(base, quote, date, source)` cambia la
  vigente **sin borrar** la anterior (auditable en el stream).
- `PriceLookup.rateAt` devuelve la tasa vigente correcta para valoración.

**Dependencias.** EP-0 (`Money`, `MinorUnits` ligada), EP-1 (`EventStore`,
projector infra), EP-2 (HTTP). **Bloquea** EP-4.5 (valoración depende de
`PriceLookup`) y EP-4.1 (validación de moneda de presentación).

**Riesgos.** (a) Política de re-registro de moneda (¿`CurrencyAmended` explícito
vs. re-`CurrencyRegistered` LWW?): proponer LWW simple como precios, dado que no
protege invariantes; documentar. (b) No hay fuente externa de tasas en v1 (a
diferencia de `finances` cuex provider): las tasas entran solo por API; el
`CachingExchangeRateProvider` de `finances` es referencia conceptual, no se
porta.

**Estimación: M.**

---

### EP-4.3 — Agregado `Budget` + proyección `budget_consumption`

**Objetivo.** Modelar `Budget` (raíz `BudgetId`) con ciclo de vida
`BudgetDefined` / `BudgetAmended` / `BudgetRemoved` (§2.8): límite mensual sobre
una cuenta `EXPENSES` (opcionalmente su subárbol), definido en la moneda de
presentación. Construir la proyección **`budget_consumption`** que calcula el
consumo del período desde `proj_postings` de `EXPENSES`, **distinguiendo
confirmados de pendientes** (RF-24). Redefinir el presupuesto de un período es una
modificación explícita (`BudgetAmended`), no un upsert silencioso. Exponer
`/budgets`.

**Archivos/módulos a crear.**

```
apps/ledger/src/product/budget/
  domain/budget/
    entities/budget.aggregate.ts
    value-objects/{budget-period.vo.ts,budget-id.vo.ts}   # BudgetPeriod = YearMonth
    events/{budget-defined.event.ts,budget-amended.event.ts,budget-removed.event.ts,index.ts}
    exceptions/{budget.exception.ts,index.ts}
    repositories/budget.repository.ts
    index.ts
  application/
    commands/{define-budget.command.ts,amend-budget.command.ts,remove-budget.command.ts}
    handlers/{define-budget.handler.ts,amend-budget.handler.ts,remove-budget.handler.ts}
    queries/{get-budget-consumption.query.ts,list-budgets.query.ts}
    handlers/{get-budget-consumption.handler.ts,list-budgets.handler.ts}
    projectors/{budgets.projector.ts,budget-consumption.projector.ts}
    dto/{budget-input.dto.ts,budget-consumption-output.dto.ts,index.ts}
    mappers/budget.mapper.ts
  infrastructure/adapters/
    http/budgets.controller.ts
    persistence/typeorm/{proj-budgets.*,budget-consumption.*}
  budget.module.ts
```

**Firmas TypeScript clave.**

```ts
/** Calendar month a budget applies to, e.g. 2026-07. */
export class BudgetPeriod {
  static of(year: number, month: number): BudgetPeriod;
  static fromString(value: string): BudgetPeriod;   // 'YYYY-MM'
  contains(date: PlainDate): boolean;
  toString(): string;
}

/**
 * Monthly spending limit for an EXPENSES account (optionally its subtree),
 * denominated in the presentation currency (§2.8). Redefining a period is an
 * explicit BudgetAmended, never a silent upsert.
 */
export class Budget extends AggregateRoot<BudgetId> {
  static define(params: {
    id: BudgetId; userId: UserId; accountId: AccountId;
    period: BudgetPeriod; amount: Money; includeChildren: boolean;
  }): Budget;                                 // emits BudgetDefined

  amend(params: { amount?: Money; includeChildren?: boolean }): void;   // BudgetAmended; guard: not removed
  remove(): void;                             // BudgetRemoved; guard: not already removed
  protected apply(event: DomainEvent): void;
}

/** Row of the budget_consumption projection (RF-24). Amounts as decimal strings. */
export interface BudgetConsumptionView {
  budgetId: string;
  accountId: string;
  period: string;                // 'YYYY-MM'
  limitAmount: string;           // presentation currency
  confirmedSpent: string;        // sum of CONFIRMED EXPENSES postings in period
  pendingSpent: string;          // sum of PENDING EXPENSES postings in period
  currency: string;
}
```

**Diseño de la proyección `budget_consumption` (RF-24, pregunta abierta #3).**

- Proyección **asíncrona** (poller con checkpoint; §8.1 la clasifica como
  asíncrona). Alimentada por: `BudgetDefined/Amended/Removed` (define/actualiza el
  límite y la ventana) y por los postings de `EXPENSES` del período
  (`TransactionRecorded/Confirmed/Voided/Reversed/Amended` reflejados en
  `proj_postings`).
- **Confirmados vs pendientes** en columnas separadas (`confirmed_spent`,
  `pending_spent`), nunca sumadas en la proyección: la diferenciación se preserva
  hasta la capa de lectura, que decide cómo presentarlas (decisión abierta #3
  abajo). Se apoya en que `proj_postings.status` ya está desnormalizado desde EP-1.
- **Transferencias excluidas** (RF-5): solo cuentan postings cuya transacción tiene
  `derived_kind = EXPENSE` (o postings sobre cuentas `EXPENSES`); las transferencias
  entre cuentas propias no consumen presupuesto.
- **Agregación jerárquica** (`include_children`): si el presupuesto incluye
  subárbol, suma los postings de las cuentas descendientes resueltas vía
  `proj_accounts` (jerarquía por nombre/`parent_id`).
- **Signo**: los postings `EXPENSES` son positivos (entrada de valor a la categoría
  de gasto); el consumo es su suma directa.

**Plan TDD.**

1. *Unit del agregado*: `define` emite `BudgetDefined`; `amend` sobre removido →
   excepción de dominio; `remove` doble → no-op/excepción; `amend` cambia monto y
   preserva período.
2. *Unit del projector — confirmado vs pendiente* (**test central RF-24**): con un
   presupuesto de 500.000 COP en `Expenses:Food` para 2026-07, un posting
   `CONFIRMED` de 120.000 y uno `PENDING` de 30.000 producen
   `confirmed_spent=120000`, `pending_spent=30000` (no 150.000 mezclados);
   confirmar el pendiente mueve 30.000 de `pending` a `confirmed`; anular
   (`VOIDED`) el pendiente lo descuenta de `pending`.
3. *Unit del projector — transferencia excluida*: un posting de transferencia entre
   cuentas propias no altera ninguna fila de `budget_consumption` (RF-5).
4. *Unit del projector — subárbol*: con `include_children`, un gasto en
   `Expenses:Food:Restaurants` consume el presupuesto de `Expenses:Food`.
5. *Unit del projector — rebuild*: replay del stream reconstruye idéntico
   (RNF-5).
6. *e2e*: `POST /budgets` define; `PATCH /budgets/{id}` amend explícito;
   `GET /budgets/{id}/consumption` devuelve confirmado y pendiente separados;
   `DELETE /budgets/{id}` remove.

**Criterios de aceptación.**

- El consumo distingue confirmados de pendientes en la respuesta del API (RF-24).
- Redefinir el límite de un período existente exige `AmendBudget` explícito.
- Las transferencias no consumen presupuesto (RF-5).
- La proyección se reconstruye por replay.

**Dependencias.** EP-1 (`proj_postings`, `account_balances`, `proj_accounts`,
`derived_kind`), EP-4.1 (moneda de presentación), EP-2 (HTTP). Referencia de
patrón: `apps/finances/src/budget`.

**Riesgos.** (a) La agregación de subárbol vía jerarquía por nombre debe
recomputarse ante `AccountRenamed` (§2.1.1); resolver referenciando `account_id`
+ cierre de descendientes en `proj_accounts`, no el nombre. (b) Consistencia
eventual del poller: el consumo puede ir por detrás del último posting; aceptable
(no es vista crítica, §8.1). (c) Definir el límite en moneda de presentación
mientras los gastos pueden ser multi-moneda: en v1 los presupuestos operan en la
moneda de presentación (§4.2, "presupuestos multi-moneda fuera de alcance"); si
un gasto está en otra moneda, se valora con `PriceLookup` (reutiliza EP-4.5) —
documentar como decisión.

**Estimación: L.**

---

### EP-4.4 — Agregado `Goal` + progreso desde balances + reactor de logro

**Objetivo.** Modelar `Goal` (raíz `GoalId`) con ciclo de vida
`GoalDefined` / `GoalAmended` / `GoalAchieved` / `GoalArchived` (§2.9): objetivo de
saldo sobre una cuenta `ASSETS`, con monto objetivo, moneda y fecha límite
opcional. El **progreso se deriva del saldo proyectado** (`account_balances`, no se
almacena en el agregado). Construir el **reactor** que detecta el logro y despacha
`MarkGoalAchieved` (RF-25). Exponer `/goals`.

**Archivos/módulos a crear.**

```
apps/ledger/src/product/goal/
  domain/goal/
    entities/goal.aggregate.ts
    value-objects/goal-id.vo.ts
    events/{goal-defined.event.ts,goal-amended.event.ts,goal-achieved.event.ts,goal-archived.event.ts,index.ts}
    exceptions/{goal.exception.ts,index.ts}
    services/goal-progress.service.ts          # pure: progress from balance + target
    repositories/goal.repository.ts
    index.ts
  application/
    commands/{define-goal.command.ts,amend-goal.command.ts,mark-goal-achieved.command.ts,archive-goal.command.ts}
    handlers/{define-goal.handler.ts,amend-goal.handler.ts,mark-goal-achieved.handler.ts,archive-goal.handler.ts}
    reactors/goal-achievement.reactor.ts        # listens balance-changing events, dispatches MarkGoalAchieved
    queries/{get-goal-progress.query.ts,list-goals.query.ts}
    handlers/{get-goal-progress.handler.ts,list-goals.handler.ts}
    projectors/goals.projector.ts
    dto/{goal-input.dto.ts,goal-progress-output.dto.ts,index.ts}
    mappers/goal.mapper.ts
  infrastructure/adapters/
    http/goals.controller.ts
    persistence/typeorm/proj-goals.*
  goal.module.ts
```

**Firmas TypeScript clave.**

```ts
/**
 * Savings target over an ASSETS account (§2.9). Progress is derived from the
 * projected balance, never stored on the aggregate. GoalAchieved is marked by the
 * system (via the reactor) when the balance reaches the target.
 */
export class Goal extends AggregateRoot<GoalId> {
  static define(params: {
    id: GoalId; userId: UserId; accountId: AccountId;
    target: Money; dueDate?: PlainDate;
  }): Goal;                                    // emits GoalDefined

  amend(params: { target?: Money; dueDate?: Nullable<PlainDate> }): void;  // GoalAmended; guard: not archived
  /** Idempotent: no-op if already achieved/archived. Emits GoalAchieved. */
  markAchieved(): void;
  archive(): void;                             // GoalArchived
  protected apply(event: DomainEvent): void;
}

/** Pure domain service: derives progress ratio and reached flag. */
export class GoalProgressService {
  evaluate(target: Money, currentBalance: Money): { ratio: number; reached: boolean };
}

/**
 * Process manager (§3.2): on balance-changing events it reads account_balances,
 * evaluates every active goal on the affected account, and dispatches
 * MarkGoalAchieved when the target is reached. Never writes events or projections
 * directly — only dispatches commands (RNF-10). Mirrors the EP-3 assertion
 * re-evaluation reactor pattern.
 */
export class GoalAchievementReactor {
  on(event: DomainEvent): Promise<void>;       // reacts to TransactionConfirmed/Reversed/TransfersMerged
}
```

**Diseño del reactor (RF-25, patrón §3.2).**

- Escucha eventos que alteran saldos confirmados de cuentas `ASSETS`
  (`TransactionConfirmed`, `TransactionReversed`, `TransfersMerged`).
- Para la(s) cuenta(s) afectada(s), consulta `account_balances` (lectura de
  proyección permitida a reactors) y las metas activas (`proj_goals`, estado
  `ACTIVE`).
- Si `balance >= target` y la meta no está `ACHIEVED`/`ARCHIVED`, **despacha**
  `MarkGoalAchieved(goalId)` por el command bus. La detección del umbral vive en el
  reactor (tiene acceso a la proyección); el agregado solo garantiza idempotencia
  (`markAchieved` no-op si ya alcanzada).
- Reutiliza el andamiaje de reactors introducido en EP-3.4; instrumentado con OTel
  (RNF-12: "errores de reactors" como métrica — un reactor que falla en silencio
  rompe la detección de logro).

**Plan TDD.**

1. *Unit del agregado*: `define` emite `GoalDefined`; `amend` sobre archivada →
   excepción; `markAchieved` doble → segundo es no-op (idempotencia); `archive`
   emite `GoalArchived`.
2. *Unit de `GoalProgressService`*: 0%, 50%, 100%, >100% (reached), y con moneda
   distinta que exige valoración (delega a EP-4.5) — o restringe target a la moneda
   de la cuenta en v1 (decisión, ver riesgos).
3. *Unit del reactor* (**test central RF-25**): un `TransactionConfirmed` que lleva
   el saldo de `Assets:Savings` a ≥ target dispara **exactamente un**
   `MarkGoalAchieved`; un segundo evento no vuelve a dispararlo (meta ya
   `ACHIEVED`); una reversa que baja el saldo **no** revierte el logro (v1: el logro
   es un hecho histórico, no se des-marca — documentar); el reactor **no** escribe
   proyecciones ni eventos, solo despacha commands (verificar con doble del bus).
4. *Unit del projector `goals`*: refleja estado `ACTIVE/ACHIEVED/ARCHIVED` y
   rebuild reproduce.
5. *e2e*: `POST /goals`, `PATCH /goals/{id}`, `GET /goals/{id}` con progreso
   derivado del saldo actual, `POST /goals/{id}/archive`; confirmar transacciones
   hasta alcanzar el target y ver la meta `ACHIEVED` sin acción manual.

**Criterios de aceptación.**

- El progreso se deriva del saldo proyectado en tiempo de lectura (no se persiste
  en el agregado).
- El sistema marca `GoalAchieved` automáticamente al alcanzar el saldo (RF-25) vía
  reactor que solo despacha commands.
- Ciclo de vida completo: definir, modificar, archivar.

**Dependencias.** EP-1 (`account_balances`), EP-3.4 (patrón de reactor), EP-4.1
(moneda), EP-2 (HTTP). Posible dependencia blanda de EP-4.5 si el target puede
estar en moneda distinta a la de la cuenta.

**Riesgos.** (a) **Race/consistencia del reactor**: el reactor lee
`account_balances` (eventualmente consistente); si va por detrás, el logro se
detecta con lag — aceptable. Alternativa robusta: el command `MarkGoalAchieved`
lleva la posición de stream observada; el handler valida idempotencia por estado.
(b) ¿Se des-marca el logro si una reversa baja el saldo? Propuesta v1: **no**
(`GoalAchieved` es histórico); documentar. (c) Moneda del target vs. moneda de la
cuenta (`ASSETS` es mono-moneda): en v1 exigir que el target esté en la moneda de
la cuenta evita valoración; si se permite otra, se apoya en EP-4.5 — decisión
abierta.

**Estimación: M/L.**

---

### EP-4.5 — Valoración: proyección `net_worth` + half-even solo en lectura

**Objetivo.** Construir la valoración de patrimonio en la moneda de presentación
(RF-23) mediante un **servicio de valoración** de dominio que aplica **redondeo
half-even a los `minor_units` de la moneda de presentación exclusivamente en la
capa de lectura** (§2.7.1); y la proyección `net_worth` que **materializa los
componentes crudos** (saldos por cuenta+moneda) sin valorar, dejando la conversión
(y por tanto el redondeo) para el query handler. **Ningún valor redondeado se
persiste** — ni en la proyección.

**Decisión de diseño central.** La proyección `net_worth` **no** almacena el
patrimonio ya convertido: guarda la agregación de saldos crudos por moneda
(componentes de activos y pasivos confirmados/pendientes). La conversión a la
moneda de presentación con la tasa vigente a la fecha del reporte, y el redondeo
half-even, ocurren en el **query handler** al leer, usando `PriceLookup` (EP-4.2)
y `presentation_currency` (EP-4.1). Esto satisface literalmente "el redondeo ocurre
solo en la capa de lectura y ningún valor redondeado se persiste" (§2.7.1) y "la
tasa vigente a la fecha del reporte" (RF-23).

**Archivos/módulos a crear.**

```
apps/ledger/src/reporting/
  domain/valuation/
    services/valuation.service.ts             # half-even conversion, read-only
    value-objects/valued-amount.vo.ts
    ports/{price-lookup.port.ts}              # re-exporta el puerto de EP-4.2
    index.ts
  application/
    queries/get-net-worth.query.ts
    handlers/get-net-worth.handler.ts
    projectors/net-worth.projector.ts         # raw per-currency components, unvalued
    dto/net-worth-output.dto.ts
    mappers/net-worth.mapper.ts
  infrastructure/adapters/
    http/net-worth.controller.ts              # o dentro de /reports (EP-4.6)
    persistence/typeorm/net-worth.*
  reporting.module.ts
```

**Firmas TypeScript clave.**

```ts
/** A raw per-currency component of net worth, straight from account_balances. */
export interface NetWorthComponent {
  currency: string;
  confirmedAmount: string;   // decimal string, unvalued
  pendingAmount: string;
}

/**
 * Read-layer valuation (§2.7.1, RF-23). Converts per-currency balances into the
 * presentation currency applying HALF-EVEN rounding to the presentation currency's
 * minor_units. Pure and read-only: the result is NEVER persisted. Uses the rate
 * effective at the report date.
 */
export class ValuationService {
  /**
   * @param components  raw per-currency balances (unvalued)
   * @param presentation  target currency + its minor_units
   * @param rateAt  resolver of the rate effective at `asOf`
   */
  valueNetWorth(
    components: NetWorthComponent[],
    presentation: { code: CurrencyCode; minorUnits: MinorUnits },
    rateAt: (base: CurrencyCode) => ExchangeRate,
    asOf: PlainDate,
  ): ValuedAmount;   // single amount in presentation currency, half-even rounded
}

/** Money already converted for presentation; carries the rounding mode used. */
export class ValuedAmount {
  static of(amount: Money, currency: CurrencyCode): ValuedAmount;
  toString(): string;
}
```

**Redondeo half-even.** Se implementa dentro de `Money`/`ValuationService` usando
la librería decimal elegida en EP-0 (`decimal.js`/`big.js`) con modo de redondeo
`ROUND_HALF_EVEN`, y **solo** en `valueNetWorth`/conversión. La aritmética de
balanceo (INV-1) sigue siendo exacta y sin redondeo (§2.7.1). No se introduce
cuenta de residuos de redondeo (`Equity:Rounding`) — diferida a §9.2.

**Plan TDD.**

1. *Unit de `ValuationService` — half-even* (**test central §2.7.1**): convertir
   componentes que caen justo en `.5` de la unidad mínima de la moneda de
   presentación redondea al par más cercano (p. ej. a COP `minor_units=0`:
   `2.5 → 2`, `3.5 → 4`; a USD `minor_units=2`: `x.xx5 → par`); verificar que el
   resultado respeta los `minor_units` de la moneda de presentación.
2. *Unit — nunca persiste*: el projector `net_worth` **no** escribe montos
   valorados (solo componentes crudos); el valor redondeado solo existe en la
   salida del query handler.
3. *Unit — tasa a la fecha del reporte* (RF-23): usa la tasa vigente `<= asOf`;
   cambiar la moneda de presentación (EP-4.1) revalúa en la siguiente lectura sin
   tocar datos.
4. *Unit del projector `net_worth`*: agrega saldos de cuentas `ASSETS` (positivos)
   y `LIABILITIES` (negativos) por moneda; rebuild reproduce.
5. *e2e*: `GET /reports/net-worth?asOf=YYYY-MM-DD` devuelve el patrimonio en la
   moneda de presentación con el redondeo correcto; sin tasa disponible para una
   moneda → error/omisión explícita, no un valor inventado.

**Criterios de aceptación.**

- El patrimonio se valora en la moneda de presentación con half-even a sus
  `minor_units`, solo en lectura (§2.7.1, RF-23).
- Ningún valor redondeado se persiste (verificable inspeccionando `net_worth`).
- Cambiar la moneda de presentación o registrar una tasa correctiva cambia la
  siguiente lectura, no los datos.

**Dependencias.** EP-4.1 (`presentation_currency`, `minor_units` de la moneda),
EP-4.2 (`PriceLookup`), EP-1 (`account_balances`). Referencia de patrón de
lectura consolidada: `apps/finances/src/summary`.

**Riesgos.** (a) Moneda sin tasa a la fecha: definir política (excluir del total
con aviso vs. error) — proponer excluir y reportar las monedas no valoradas. (b)
Tentación de cachear el valor convertido en la proyección: **prohibido** (§2.7.1);
mantener la conversión en el query handler.

**Estimación: M.**

---

### EP-4.6 — Reportes: gastos, patrimonio, auditoría de ajustes (`/reports/*`)

**Objetivo.** Exponer los reportes consolidados como **query handlers sobre
proyecciones** (RNF-10, sin lógica de dominio ni acceso al event store): gastos por
categoría / período / payee, patrimonio (reutiliza EP-4.5), y auditoría de ajustes
(reutiliza `adjustment_audit` de EP-3.6). Valoración a moneda de presentación vía
`ValuationService` cuando el reporte consolida monedas.

**Archivos/módulos a crear** (dentro de `apps/ledger/src/reporting/`).

```
reporting/
  application/
    queries/{expenses-by-category.query.ts,expenses-by-payee.query.ts,expenses-by-period.query.ts,adjustment-audit.query.ts}
    handlers/{expenses-by-category.handler.ts,expenses-by-payee.handler.ts,expenses-by-period.handler.ts,adjustment-audit.handler.ts}
    dto/{expense-report-filter.dto.ts,expense-report-output.dto.ts,adjustment-audit-output.dto.ts,index.ts}
    mappers/report.mapper.ts
  infrastructure/adapters/http/reports.controller.ts
```

**Firmas TypeScript clave.**

```ts
export interface ExpenseReportFilter {
  from: PlainDate;
  to: PlainDate;
  groupBy: 'CATEGORY' | 'PAYEE' | 'PERIOD';
  accountId?: AccountId;        // subtree via proj_accounts
  status?: 'CONFIRMED' | 'PENDING' | 'ALL';
  valuedIn?: CurrencyCode;      // default: presentation_currency
}

export interface ExpenseReportRow {
  key: string;                  // category name | payee | 'YYYY-MM'
  amount: string;               // decimal string, valued if multi-currency
  currency: string;
}

/** Read-only handler over proj_postings/proj_transactions; excludes transfers (RF-5). */
export class ExpensesReportQueryHandler {
  execute(filter: ExpenseReportFilter): Promise<ExpenseReportRow[]>;
}
```

**Diseño.**

- **Gastos por categoría/período/payee**: agregan `proj_postings` filtrando
  `EXPENSES` (o `derived_kind = EXPENSE`), agrupando por cuenta (categoría), por
  `proj_transactions.payee`, o por mes. Excluyen transferencias (RF-5). Filtro por
  `status` para distinguir confirmados/pendientes (coherente con RF-24). Patrón de
  query builder: `apps/finances/src/summary/.../typeorm-summary.repository.ts` y
  usecases `get-expenses`/`get-consolidated-balance`.
- **Patrimonio**: delega en el query handler de EP-4.5 (`net_worth` +
  `ValuationService`).
- **Auditoría de ajustes**: lee `adjustment_audit` (EP-3.6) — acumulado de "dinero
  sin explicación" por cuenta (§2.4.1); solo formatea y valora si se consolida.
- **Valoración multi-moneda**: cuando el reporte cruza monedas, aplica
  `ValuationService` (half-even, solo lectura); si es mono-moneda, no convierte.

**Plan TDD.**

1. *Unit/integration del query handler de gastos*: agrupa por categoría, por payee
   y por período correctamente; excluye transferencias (RF-5); respeta el filtro
   `status`.
2. *Unit*: reporte multi-moneda valora con `ValuationService` (half-even) y
   mono-moneda no convierte.
3. *Integration*: auditoría de ajustes refleja `adjustment_audit` por cuenta.
4. *e2e*: `GET /reports/expenses?groupBy=payee&from=…&to=…`,
   `GET /reports/expenses?groupBy=category`, `GET /reports/net-worth`,
   `GET /reports/adjustment-audit`; sin contexto autenticado → rechazado (RF-26);
   paginación donde aplique.

**Criterios de aceptación.**

- Reportes de gastos por categoría, período y payee, excluyendo transferencias.
- Patrimonio valorado en moneda de presentación (vía EP-4.5).
- Auditoría de ajustes por cuenta (vía EP-3.6).
- Todo servido desde proyecciones, sin lógica de dominio (RNF-10).

**Dependencias.** EP-1 (`proj_postings`, `proj_transactions`, `proj_accounts`),
EP-3.6 (`adjustment_audit`), EP-4.5 (valoración), EP-4.1 (moneda). Referencia:
`apps/finances/src/summary`.

**Estimación: M.**

---

## DDL propuesto de proyecciones (siguiendo el patrón §6.2)

> Tablas derivadas, **sin constraints de negocio** (la verdad vive en el stream),
> optimizadas para consulta; reconstruibles por replay (§6.3). Montos como
> `NUMERIC` exacto (RNF-2); enums como `text` (memoria "No DB enums"). `net_worth`
> y `budget_consumption` **no** almacenan valores redondeados por conversión.

```sql
-- EP-4.2 — Registered currencies
CREATE TABLE proj_currencies (
    user_id       UUID NOT NULL,
    code          TEXT NOT NULL,
    minor_units   SMALLINT NOT NULL,
    name          TEXT NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, code)
);

-- EP-4.2 — FX prices with audited last-write-wins overlap correction (§2.6).
-- The full history stays in the event stream; this table keeps the currently
-- effective row per (base, quote, date, source) plus a superseded flag for audit.
CREATE TABLE proj_prices (
    user_id         UUID NOT NULL,
    base            TEXT NOT NULL,
    quote           TEXT NOT NULL,
    date            DATE NOT NULL,
    source          TEXT NOT NULL,
    rate            NUMERIC(30, 12) NOT NULL,   -- decimal string in payload
    global_position BIGINT NOT NULL,            -- wins by max position (LWW)
    superseded      BOOLEAN NOT NULL DEFAULT FALSE,
    recorded_at     TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, base, quote, date, source, global_position)
);
CREATE INDEX idx_proj_prices_effective
    ON proj_prices (user_id, base, quote, date)
    WHERE superseded = FALSE;

-- EP-4.3 — Budget definitions
CREATE TABLE proj_budgets (
    budget_id        UUID PRIMARY KEY,
    user_id          UUID NOT NULL,
    account_id       UUID NOT NULL,
    period           TEXT NOT NULL,             -- 'YYYY-MM'
    limit_amount     NUMERIC(20, 6) NOT NULL,   -- presentation currency
    currency_code    TEXT NOT NULL,
    include_children BOOLEAN NOT NULL DEFAULT FALSE,
    removed          BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at       TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_proj_budgets_lookup ON proj_budgets (user_id, account_id, period);

-- EP-4.3 — Budget consumption: confirmed vs pending kept SEPARATE (RF-24),
-- never summed at projection level. Transfers excluded (RF-5).
CREATE TABLE budget_consumption (
    budget_id        UUID NOT NULL,
    user_id          UUID NOT NULL,
    account_id       UUID NOT NULL,
    period           TEXT NOT NULL,             -- 'YYYY-MM'
    limit_amount     NUMERIC(20, 6) NOT NULL,
    confirmed_spent  NUMERIC(20, 6) NOT NULL DEFAULT 0,
    pending_spent    NUMERIC(20, 6) NOT NULL DEFAULT 0,
    currency_code    TEXT NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (budget_id, period)
);
CREATE INDEX idx_budget_consumption_user ON budget_consumption (user_id, period);

-- EP-4.4 — Goals with lifecycle state; progress derived at read time from balances.
CREATE TABLE proj_goals (
    goal_id       UUID PRIMARY KEY,
    user_id       UUID NOT NULL,
    account_id    UUID NOT NULL,
    target_amount NUMERIC(20, 6) NOT NULL,
    currency_code TEXT NOT NULL,
    due_date      DATE,
    status        TEXT NOT NULL,                -- ACTIVE | ACHIEVED | ARCHIVED
    achieved_at   TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_proj_goals_account ON proj_goals (user_id, account_id, status);

-- EP-4.5 — Net worth: RAW per-currency components only, UNVALUED. Conversion to
-- the presentation currency (half-even) happens in the query handler, never here;
-- no rounded value is ever persisted (§2.7.1).
CREATE TABLE net_worth (
    user_id          UUID NOT NULL,
    currency_code    TEXT NOT NULL,
    confirmed_amount NUMERIC(20, 6) NOT NULL DEFAULT 0,   -- assets(+) - liabilities(-)
    pending_amount   NUMERIC(20, 6) NOT NULL DEFAULT 0,
    updated_at       TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, currency_code)
);
```

> `proj_ledger_settings` (EP-4.1) ya está definida en §6.2 de la spec; EP-4.1 solo
> añade el projector que reacciona a `PresentationCurrencyChanged`/`TimezoneChanged`.

---

## Endpoints REST (traducción a commands/queries, §7)

| Recurso | Método | Command/Query | Subtarea |
|---|---|---|---|
| `/ledger/settings` | `GET` | proj_ledger_settings | EP-4.1 |
| `/ledger/settings` | `PATCH` | ChangePresentationCurrency / ChangeTimezone | EP-4.1 |
| `/currencies` | `POST` / `GET` | RegisterCurrency / proj_currencies | EP-4.2 |
| `/prices` | `POST` / `GET` | RecordPrice / proj_prices | EP-4.2 |
| `/budgets` | `POST` | DefineBudget | EP-4.3 |
| `/budgets` | `GET` | list-budgets | EP-4.3 |
| `/budgets/{id}` | `PATCH` | AmendBudget | EP-4.3 |
| `/budgets/{id}` | `DELETE` | RemoveBudget | EP-4.3 |
| `/budgets/{id}/consumption` | `GET` | budget_consumption (confirmado vs pendiente) | EP-4.3 |
| `/goals` | `POST` | DefineGoal | EP-4.4 |
| `/goals` | `GET` | list-goals | EP-4.4 |
| `/goals/{id}` | `GET` | get-goal-progress (desde balances) | EP-4.4 |
| `/goals/{id}` | `PATCH` | AmendGoal | EP-4.4 |
| `/goals/{id}/archive` | `POST` | ArchiveGoal | EP-4.4 |
| `/reports/net-worth` | `GET` | net_worth + ValuationService | EP-4.5 / EP-4.6 |
| `/reports/expenses` | `GET` | proj_postings (`groupBy=category\|payee\|period`) | EP-4.6 |
| `/reports/adjustment-audit` | `GET` | adjustment_audit (EP-3.6) | EP-4.6 |

Transversales (§7): contexto autenticado obligatorio (RF-26), `external_ref`
idempotente en todos los commands (INV-10), errores de dominio con código estable
(RF-14), read-your-writes (RNF-9), versionado del API (RNF-8). `GoalAchieved` **no**
tiene endpoint: lo emite el reactor vía `MarkGoalAchieved`, nunca el cliente.

---

## Decisiones abiertas para el usuario

1. **Pregunta abierta #3 (§8.2) — ¿el presupuesto consume `PENDING` + `CONFIRMED`?**
   La propuesta de la spec es **ambas, diferenciadas** (RF-24), y este plan la
   implementa manteniendo `confirmed_spent` y `pending_spent` **separados** en la
   proyección y en el API. **Falta decidir la semántica de presentación**: ¿el
   "consumido" que se compara contra el límite y dispara alertas es
   `confirmed`, `confirmed + pending`, o ambas curvas mostradas al usuario?
   Recomendación: exponer las dos y dejar la política de alerta configurable
   (por defecto `confirmed + pending`, como en el flujo bancario donde un pendiente
   ya debitó dinero real, §2.4).
2. **Re-registro de moneda (EP-4.2)**: ¿`CurrencyAmended` explícito o LWW como
   precios? Recomendación: LWW simple (no protege invariantes, §3.3).
3. **Logro de meta reversible (EP-4.4)**: ¿una reversa que baja el saldo por debajo
   del target des-marca `GoalAchieved`? Recomendación v1: **no** (el logro es un
   hecho histórico). Requiere confirmación.
4. **Moneda del target de meta (EP-4.4)**: ¿se restringe a la moneda de la cuenta
   `ASSETS` (mono-moneda) o se permite otra con valoración (EP-4.5)? Recomendación
   v1: restringir a la moneda de la cuenta.
5. **Moneda sin tasa a la fecha (EP-4.5)**: ¿excluir del total con aviso o error?
   Recomendación: excluir y reportar las monedas no valoradas.
6. **Presupuesto con gastos en otra moneda (EP-4.3)**: el presupuesto está en la
   moneda de presentación; los gastos en otra moneda se valoran con `PriceLookup`.
   Confirmar que es aceptable en v1 (presupuestos multi-moneda están fuera de
   alcance, §4.2).

---

## Estimación S/M/L por subtarea

| Subtarea | Alcance | Estimación | Justificación |
|---|---|---|---|
| EP-4.1 `LedgerSettings` | Agregado simple (2 eventos de cambio) + proyección + 2 endpoints | **S/M** | Reusa `LedgerInitialized`; poca lógica |
| EP-4.2 Currency + Price | 2 flujos de referencia + LWW auditado + 2 projectors + 2 recursos | **M** | La corrección por superposición y la resolución de tasa vigente añaden trabajo |
| EP-4.3 `Budget` + consumo | Agregado + proyección compleja (confirmado/pendiente, subárbol, exclusión de transferencias) | **L** | La proyección `budget_consumption` es la pieza de mayor complejidad de EP-4 |
| EP-4.4 `Goal` + reactor | Agregado (4 eventos) + reactor con acceso a balances + proyección | **M/L** | El reactor y su idempotencia/consistencia son delicados |
| EP-4.5 Valoración `net_worth` | Servicio half-even (solo lectura) + proyección de componentes crudos + query handler | **M** | Redondeo y "nunca persistir" bien acotados, pero críticos |
| EP-4.6 Reportes | Query handlers sobre proyecciones existentes + valoración | **M** | Mayormente composición de proyecciones ya construidas |

**Secuencia interna sugerida.** EP-4.1 y EP-4.2 primero (habilitan moneda de
presentación y tasas). Luego, en paralelo: EP-4.3 (presupuestos) y EP-4.4 (metas).
EP-4.5 tras EP-4.1+EP-4.2. EP-4.6 al final (consume EP-4.5 y EP-3.6). Todo EP-4
solo arranca con EP-0..EP-3 estables y proyecciones verificadas por replay
(regla de disciplina §11).
