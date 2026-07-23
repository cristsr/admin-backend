# EP-3 — Conciliación y transferencias (Fase 3)

> Épica del [roadmap](../../ledger-roadmap.md). Fuente: [especificación](../../especificacion-tecnica-ledger.md).
> Este archivo debe contener el **plan detallado de implementación** de la épica.

## Alcance (subtareas)

- **EP-3.1** Agregado `BalanceAssertion` (`Asserted`/`Evaluated`/`Revoked`).
- **EP-3.2** Servicio evaluador con semántica temporal §2.4 (`occurred_at` vs cierre de día, `INDETERMINATE`, tolerancia).
- **EP-3.3** Commands `AssertBalance`/`RevokeAssertion` + endpoints.
- **EP-3.4** Reactor de re-evaluación de aserciones (RF-18), solo despacha commands.
- **EP-3.5** `ResolveDiscrepancy` → ajuste contra `Equity:Adjustments` + `DiscrepancyResolved`.
- **EP-3.6** Proyecciones `assertion_status` y `adjustment_audit`.
- **EP-3.7** Transferencias: proyección `transfer_candidates` (RF-15) + `MergePendingTransfers` (RF-16) + endpoints.

---

## Plan detallado

### Supuestos de partida (EP-0/1/2 ya existen)

Este plan **asume disponible** de fases previas, y lo reutiliza sin modificarlo:

- **Puertos del núcleo** (§3.8): `EventStore` (`append`/`load`/`readAll`), `ReadModelStore`/puertos por proyección, `ProjectionDispatcher`, `Clock`, `IdGenerator`. Adaptadores in-memory + Postgres con contract tests.
- **Buses**: `CommandBus` con políticas transversales (idempotencia por `external_ref`, contexto autenticado `user_id`/`client_id`, concurrencia optimista) y `QueryBus`.
- **Sobre de eventos** (`DomainEvent`) con `event_id`, `aggregate_id`, `aggregate_type`, `sequence`, `user_id`, `client_id`, `external_ref?`, `occurred_at`, `recorded_at`; serialización de montos como strings decimales.
- **Value objects**: `Money` (decimal exacto, INV-8), `AccountName`, `Currency`.
- **Agregado `LedgerTransaction`** con sus commands (`RecordTransaction`, `ConfirmTransaction`, `VoidPendingTransaction`, …) y eventos (`TransactionRecorded`/`Confirmed`/`Voided`/`Reversed`/`Amended`). EP-3 **reutiliza estos commands**, no duplica el ciclo de vida de la transacción.
- **Agregado `Account`** y proyección `proj_accounts` (para conocer tipo, moneda declarada, si es espejo bancario).
- **Proyecciones núcleo** `account_balances` (`proj_balances`), `transaction_list` (`proj_transactions` + `proj_postings`) y `pending_review`, con despacho **síncrono** en la transacción del command.
- **`LedgerSettings`** con `timezone` (IANA) y `presentation_currency`, consultable por el núcleo del lado lectura (`proj_ledger_settings`).
- **Cuentas técnicas** `Equity:OpeningBalances` y `Equity:Adjustments` creadas en `InitializeLedger` (INV-13).

### Ubicación de módulos y convenciones

Siguiendo §8.1 (un módulo NestJS por área con hexágono interno) y el alias `@ledger/*`:

- **`apps/ledger/src/reconciliation/`** — módulo nuevo. Alberga EP-3.1 a EP-3.6 (agregado `BalanceAssertion`, evaluador, reactor, `ResolveDiscrepancy`, proyecciones `assertion_status` y `adjustment_audit`).
- **`apps/ledger/src/transactions/`** — módulo **existente** (EP-1/EP-2). EP-3.7 se **agrega** aquí: proyección `transfer_candidates` y command `MergePendingTransfers` viven junto al agregado `LedgerTransaction` que reutilizan.

Convenciones aplicadas (skills `typescript` + `design-principles` + `error-handling`):
- Puertos como `abstract class` (token DI). Adaptadores `TypeOrm*` / `InMemory*`.
- `Nullable<T>` en vez de `T | null`; `readonly` en propiedades y dependencias; guard clauses.
- Ficheros `kebab-case.tipo.ts`. Excepciones de dominio extienden `DomainException`/`DomainUnprocessableException` de `@shared`, con `code` estable (RF-14). Nunca `throw new Error(...)`.
- Núcleo (`domain`/`application`) libre de NestJS; toda infraestructura en `infrastructure/adapters`.
- Comentarios en inglés + JSDoc.

Patrones de referencia en `apps/finances` (paradigma incompatible pero útil como molde):
- Reacción asíncrona con checkpoint / claim de lote: `apps/finances/src/outbox/infrastructure/adapters/schedulers/outbox-relay.scheduler.ts` y `apps/finances/src/outbox/application/services/domain-event-outbox.publisher.ts` (modelo del poller del `ProjectionDispatcher` y del reactor).
- Handler de evento que solo delega en un usecase (molde del reactor que **solo despacha**): `apps/finances/src/scheduled/infrastructure/adapters/events/generate-scheduled-movements.event-handler.ts`.
- Emparejamiento de dos “piernas” atómicas y grupo compartido (concepto que EP-3.7 reemplaza): `apps/finances/src/transfer/domain/transfer.factory.ts` y `apps/finances/src/transfer/application/usecases/create-transfer.usecase.ts`.
- `transferGroup` como vínculo de dos movimientos: `apps/finances/src/movement/domain/movement/types/transfer-leg.type.ts`.

---

## EP-3.1 — Agregado `BalanceAssertion`

**Objetivo.** Modelar el ciclo de vida de un checkpoint de conciliación como agregado event-sourced: se declara (`BalanceAsserted`), se evalúa una o varias veces (`BalanceAssertionEvaluated`), se revoca (`AssertionRevoked`). El agregado **no calcula saldos** (INV-5): recibe el veredicto ya computado por el servicio evaluador (EP-3.2) y decide si emitir un nuevo evento de evaluación (evita ruido si el resultado no cambió).

**Archivos a crear** (`apps/ledger/src/reconciliation/domain/balance-assertion/`):

- `balance-assertion.aggregate.ts` — raíz del agregado.
- `events/balance-asserted.event.ts`
- `events/balance-assertion-evaluated.event.ts`
- `events/assertion-revoked.event.ts`
- `events/index.ts`
- `enums/assertion-status.enum.ts` — `UNCHECKED | MATCHED | MISMATCHED | INDETERMINATE | REVOKED`.
- `types/assertion-evaluation.type.ts` — resultado del evaluador (`status`, `difference`, `actualAmount`).
- `exceptions/balance-assertion.exception.ts` — `AssertionAlreadyRevokedException`, `AssertionNotEvaluableException`, `DiscrepancyNotResolvableException`.
- `balance-assertion.repository.ts` — puerto de carga/append vía `EventStore` (o reutiliza el `AggregateRepository` genérico de EP-1 si existe).
- `index.ts`

**Firmas TypeScript clave.**

```ts
export enum AssertionStatus {
  UNCHECKED = 'UNCHECKED',
  MATCHED = 'MATCHED',
  MISMATCHED = 'MISMATCHED',
  INDETERMINATE = 'INDETERMINATE',
  REVOKED = 'REVOKED',
}

/** Verdict produced by the evaluator (EP-3.2). `difference = expected - actual`. */
export interface AssertionEvaluation {
  readonly status: AssertionStatus;
  readonly actualAmount: Money;
  readonly difference: Money;
}

/** Immutable declaration payload of the checkpoint. */
export interface AssertBalanceProps {
  readonly assertionId: string;
  readonly userId: string;
  readonly accountId: string;
  readonly date: LocalDate; // plain accounting date, no timezone (RNF-7)
  readonly occurredAt: Nullable<Date>; // UTC instant for intraday assertions
  readonly expectedAmount: Money;
  readonly tolerance: Money; // same currency as expectedAmount; zero by default
}

export class BalanceAssertion {
  private constructor(
    readonly id: string,
    readonly accountId: string,
    readonly date: LocalDate,
    readonly occurredAt: Nullable<Date>,
    readonly expected: Money,
    readonly tolerance: Money,
    private status: AssertionStatus,
    private lastDifference: Nullable<Money>,
    private resolvedByTxn: Nullable<string>,
    private version: number,
  ) {}

  /** Rebuilds state from the event stream (event sourcing). */
  static fromHistory(events: readonly DomainEvent[]): BalanceAssertion;

  /** Declares a new checkpoint; emits `BalanceAsserted`. Starts `UNCHECKED`. */
  static assert(props: AssertBalanceProps): BalanceAssertion;

  /**
   * Records an evaluation verdict. Emits `BalanceAssertionEvaluated` only when
   * the outcome (status or difference) actually changed — re-evaluations that
   * confirm the prior verdict stay silent. No-op if already `REVOKED`.
   */
  applyEvaluation(evaluation: AssertionEvaluation, clock: Clock): void;

  /** Revokes an erroneous assertion; emits `AssertionRevoked`. Guard: not already revoked. */
  revoke(reason: string): void;

  /** Marks the discrepancy as resolved by an adjustment txn (EP-3.5 links here). */
  markResolved(adjustmentTransactionId: string): void;

  /** True when the current status admits a reconciliation adjustment. */
  get isResolvable(): boolean; // MISMATCHED && !resolvedByTxn && status !== REVOKED

  pullEvents(): readonly DomainEvent[];
  get currentVersion(): number;
}
```

Eventos (contenido esencial, §3.4):

```ts
export class BalanceAsserted {
  constructor(
    readonly accountId: string,
    readonly date: string, // ISO plain date
    readonly occurredAt: Nullable<string>,
    readonly expectedAmount: string, // decimal string (RNF-2)
    readonly currency: string,
    readonly tolerance: string,
  ) {}
}

export class BalanceAssertionEvaluated {
  constructor(
    readonly result: AssertionStatus, // MATCHED | MISMATCHED | INDETERMINATE
    readonly difference: string, // decimal string, signed
    readonly currency: string,
    readonly evaluatedAt: string,
  ) {}
}

export class AssertionRevoked {
  constructor(readonly reason: string) {}
}
```

**Notas de diseño (Tell-Don't-Ask).** El evaluador entrega un `AssertionEvaluation`; el agregado **decide** si merece un evento nuevo (`applyEvaluation`) — no se exponen getters para que un handler externo tome esa decisión. `markResolved` mantiene la invariante “una discrepancia se resuelve una sola vez”.

**Plan TDD.**
- `balance-assertion.aggregate.spec.ts`:
  - `assert` emite `BalanceAsserted` con `sequence = 1` y estado `UNCHECKED`.
  - `applyEvaluation` con veredicto distinto → emite `BalanceAssertionEvaluated`; con veredicto igual al anterior → **no** emite.
  - `applyEvaluation` sobre agregado `REVOKED` → no emite (o lanza `AssertionNotEvaluableException`, según decisión de diseño: se opta por no-op silencioso para tolerar re-evaluaciones tardías del reactor).
  - `revoke` dos veces → `AssertionAlreadyRevokedException`.
  - `markResolved` dos veces → `DiscrepancyNotResolvableException`.
  - `fromHistory` reconstruye estado y `version` correctos tras N eventos.

**Criterios de aceptación.** Ciclo declarar → evaluar (repetible, idempotente ante veredicto estable) → revocar/resolver, todo como eventos en el stream. Sin cálculo de saldos dentro del agregado.

**Dependencias.** EP-1 (`EventStore`, sobre de eventos, `Money`, `Clock`). **Riesgos.** Definir con precisión “el veredicto cambió” para no inundar el stream con evaluaciones redundantes (mitigado en `applyEvaluation`).

**Estimación: M.**

---

## EP-3.2 — Servicio de dominio evaluador de aserciones (semántica temporal §2.4)

**Objetivo.** Calcular el veredicto (`MATCHED`/`MISMATCHED`/`INDETERMINATE`) y la **diferencia exacta** de una aserción contra el saldo proyectado de la **cuenta exacta** (sin subcuentas), respetando la semántica temporal de §2.4: corte por `occurred_at` (intradía) o por cierre del día en la timezone de `LedgerSettings`; población `CONFIRMED`+`PENDING` (nunca `VOIDED`); tolerancia por aserción; regla `INDETERMINATE` para el orden intradía indeterminable.

Es un **servicio de dominio puro** (sin NestJS, sin SQL). Lee la población de postings a través de un **puerto de lectura** que devuelve datos ya materializados por `proj_postings` — es la lectura inter-agregado permitida en §3.5/§3.6; ningún invariante contable depende de ella.

**Archivos a crear** (`apps/ledger/src/reconciliation/`):

- `domain/services/assertion-evaluator.service.ts` — el evaluador.
- `domain/services/day-boundary.resolver.ts` — traduce `LocalDate` + timezone IANA a la ventana UTC `[startOfDayUtc, endOfDayUtc)` (RNF-7). Envuelve la librería de zonas (p. ej. `Temporal`/`luxon`) detrás de una firma de dominio.
- `domain/ports/assertion-posting-reader.port.ts` — puerto de lectura de la población evaluable.
- `domain/services/index.ts`
- Adaptadores (infra): `infrastructure/adapters/persistence/typeorm/typeorm-assertion-posting-reader.ts` y `.../in-memory/in-memory-assertion-posting-reader.ts` (para contract tests).

**Firmas TypeScript clave.**

```ts
/** A posting of the asserted account, as materialized by proj_postings. */
export interface AssertablePosting {
  readonly amount: Money; // signed, in the account's currency
  readonly date: LocalDate; // accounting date
  readonly occurredAt: Nullable<Date>; // UTC instant, when known
  readonly status: TransactionStatus; // CONFIRMED | PENDING (VOIDED excluded by the reader)
}

/**
 * Reads the CONFIRMED+PENDING postings of exactly one account (no subaccounts,
 * §2.4) up to a temporal cutoff. VOIDED are never returned.
 */
export abstract class AssertionPostingReader {
  abstract byAccountUpToDate(
    userId: string,
    accountId: string,
    date: LocalDate,
  ): Promise<readonly AssertablePosting[]>;
}

export interface AssertionCutoff {
  readonly date: LocalDate;
  readonly occurredAt: Nullable<Date>; // present => intraday assertion
  readonly timezone: string; // IANA, from LedgerSettings
}

@Injectable()
export class AssertionEvaluator {
  constructor(
    private readonly reader: AssertionPostingReader,
    private readonly dayBoundary: DayBoundaryResolver,
  ) {}

  /**
   * Computes the verdict for `assertion` at its cutoff. Difference is
   * `expected - actual`. MATCHED when |difference| <= tolerance; MISMATCHED
   * when the balance is unambiguous and out of tolerance; INDETERMINATE when
   * an intraday cutoff cannot order same-day postings that lack occurred_at
   * and their inclusion would flip the verdict (§2.4).
   */
  async evaluate(assertion: BalanceAssertion, cutoff: AssertionCutoff): Promise<AssertionEvaluation>;
}
```

**Algoritmo (preciso).**

1. **Población base**: `reader.byAccountUpToDate(userId, accountId, cutoff.date)` → postings de la cuenta exacta con `date <= cutoff.date`, estados `CONFIRMED`+`PENDING`, en la moneda de la cuenta (= la de la aserción; guard si difiere → excepción de configuración).
2. **Partición temporal**:
   - **Caso “cierre de día”** (`occurredAt` de la aserción es `null`): la ventana incluye **todos** los postings con `date <= cutoff.date`. No hay ambigüedad de orden intradía. `included = base`, `ambiguous = []`.
   - **Caso “intradía”** (`occurredAt` presente): sea `boundary = dayBoundary.resolve(cutoff.date, cutoff.timezone)`.
     - `included` = postings con `date < cutoff.date` **más** los del mismo día con `occurredAt != null && occurredAt <= cutoff.occurredAt`.
     - `laterCertain` = mismo día con `occurredAt != null && occurredAt > cutoff.occurredAt` → **excluidos con certeza**.
     - `ambiguous` = postings del mismo día **sin** `occurredAt`: su orden respecto al corte intradía **no puede determinarse**.
3. **Saldo y diferencia**:
   - `actual = sum(included.amount)` (aritmética exacta `Money`, INV-8).
   - `difference = assertion.expected - actual`.
4. **Veredicto**:
   - Si `ambiguous` está vacío: `MATCHED` si `|difference| <= tolerance`, si no `MISMATCHED`.
   - Si `ambiguous` no está vacío (solo posible en intradía): calcular `actualWithAmbiguous = actual + sum(ambiguous.amount)`. Si **ambos** extremos caen dentro de tolerancia (`|expected - actual| <= tol` **y** `|expected - actualWithAmbiguous| <= tol`) → `MATCHED`. Si **ninguno** cae dentro **y** además `sum(ambiguous.amount) != 0` (la ambigüedad podría explicar la brecha) → `INDETERMINATE` (evita un falso `MISMATCHED`, §2.4). Si `sum(ambiguous.amount) == 0` (los ambiguos no alteran el saldo) → resolver como el caso sin ambiguos. La `difference` reportada es la del escenario **sin** ambiguos (determinista y auditable).
   > La resolución fina de este punto es la **pregunta abierta #6**; la regla anterior es conservadora (prefiere `INDETERMINATE` a un falso negativo) y queda parametrizable.
5. Devolver `AssertionEvaluation { status, actualAmount: actual, difference }`.

**Cómo se usa.** Lo invoca el command handler `EvaluateAssertion` (interno, EP-3.4): carga el agregado, resuelve `cutoff` (timezone desde `proj_ledger_settings`), llama `evaluate`, y hace `assertion.applyEvaluation(...)` → persiste eventos. El evaluador **no** escribe nada.

**Plan TDD** (`assertion-evaluator.service.spec.ts`, con `InMemoryAssertionPostingReader` y `Clock` determinista):
- **MATCHED cierre de día**: postings suman exacto al esperado; `occurredAt=null` → `MATCHED`, `difference=0`.
- **MISMATCHED**: falta un movimiento → `MISMATCHED`, `difference` = monto exacto faltante y con signo correcto.
- **Tolerancia**: diferencia de 50 con `tolerance=100` → `MATCHED`; con `tolerance=0` → `MISMATCHED`.
- **Excluye VOIDED / incluye PENDING**: una pendiente cuenta en el saldo; una anulada no (verificado vía el reader que ya las filtra).
- **Intradía determinista**: aserción con `occurred_at`; un posting con `occurredAt` posterior queda fuera → `MATCHED`.
- **INDETERMINATE**: aserción intradía + posting del mismo día sin `occurredAt` cuyo monto ≠ 0 que dejaría la diferencia fuera de tolerancia en un escenario y dentro en otro → `INDETERMINATE`.
- **Ambiguo neutro**: posting mismo día sin `occurredAt` con monto 0 (o que no cambia el veredicto) → resuelve determinista, no `INDETERMINATE`.
- **Frontera de timezone**: posting cuyo `occurredAt` UTC cae en día distinto según la timezone → el `DayBoundaryResolver` lo asigna al día local correcto (test con `America/Bogota`, UTC-5, movimiento a las 03:00Z = día anterior local).

**Criterios de aceptación.** Cubre los cuatro veredictos con diferencia exacta y respeta timezone/tolerancia/población. Determinista y sin infraestructura en los tests unitarios.

**Dependencias.** EP-3.1 (agregado, `AssertionStatus`), `proj_postings` (EP-1), `proj_ledger_settings` (timezone). **Riesgos.** (1) Correctitud de la conversión UTC↔local en fronteras de día/DST — mitigar con librería de zonas probada y tests de frontera. (2) Definición de `INDETERMINATE` (pregunta abierta #6) — encapsulada y parametrizable.

**Estimación: L.**

---

## EP-3.3 — Commands `AssertBalance` / `RevokeAssertion` + endpoints

**Objetivo.** Superficie de escritura para declarar y revocar aserciones, con idempotencia por `external_ref` (RF-17, RF-19) y evaluación inmediata tras declarar.

**Archivos a crear.**

- `application/commands/assert-balance.command.ts`, `.handler.ts`
- `application/commands/revoke-assertion.command.ts`, `.handler.ts`
- `application/commands/evaluate-assertion.command.ts`, `.handler.ts` — **command interno** (no expuesto por HTTP; lo despacha el reactor EP-3.4 y el propio `AssertBalanceHandler` tras declarar).
- `application/commands/index.ts`
- `application/dto/assert-balance-input.dto.ts`, `assert-balance-output.dto.ts`, `revoke-assertion-input.dto.ts`
- `infrastructure/adapters/http/balance-assertion.controller.ts`
- `infrastructure/adapters/http/index.ts`

**Firmas TypeScript clave.**

```ts
export class AssertBalanceCommand {
  constructor(
    readonly context: AuthenticatedContext, // user_id, client_id (RF-26)
    readonly externalRef: Nullable<string>,
    readonly accountId: string,
    readonly date: string, // ISO plain date
    readonly occurredAt: Nullable<string>,
    readonly expectedAmount: string, // decimal string
    readonly currency: string,
    readonly tolerance: string, // decimal string, default "0"
  ) {}
}

@CommandHandler(AssertBalanceCommand)
export class AssertBalanceHandler {
  constructor(
    private readonly repository: BalanceAssertionRepository,
    private readonly commandBus: CommandBus,
    private readonly ids: IdGenerator,
  ) {}

  /** Persists BalanceAsserted, then dispatches EvaluateAssertion for an immediate verdict. */
  async execute(command: AssertBalanceCommand): Promise<CommandResult>;
}

export class RevokeAssertionCommand {
  constructor(
    readonly context: AuthenticatedContext,
    readonly externalRef: Nullable<string>,
    readonly assertionId: string,
    readonly reason: string,
  ) {}
}

export class EvaluateAssertionCommand {
  constructor(
    readonly context: AuthenticatedContext,
    readonly assertionId: string,
  ) {}
}
```

`EvaluateAssertionHandler`: carga el agregado, obtiene `timezone` de `proj_ledger_settings`, arma `AssertionCutoff`, llama `AssertionEvaluator.evaluate`, `assertion.applyEvaluation(...)`, y hace `repository.save(assertion, expectedVersion)` (concurrencia optimista). La evaluación **no** lleva `external_ref` propia (es interna, idempotente por naturaleza: reevaluar produce el mismo veredicto).

Endpoints (controller → command/query bus):
- `POST /balance-assertions` → `AssertBalanceCommand` (devuelve `assertionId`, `streamPosition`, y el primer veredicto vía `assertion_status`).
- `POST /balance-assertions/{id}/revoke` → `RevokeAssertionCommand`.
- `GET /balance-assertions` y `GET /balance-assertions/{id}` → query sobre `assertion_status` (EP-3.6).

**Plan TDD.**
- Unit `assert-balance.handler.spec.ts`: declara → persiste `BalanceAsserted` → despacha `EvaluateAssertionCommand`. Reintento con misma `external_ref` → no re-emite (idempotencia del bus, INV-10).
- Unit `revoke-assertion.handler.spec.ts`: emite `AssertionRevoked`; revocar dos veces → excepción de dominio mapeada a error estable.
- Unit `evaluate-assertion.handler.spec.ts`: cablea evaluador + agregado + repo; conflicto de versión → `CONCURRENCY_CONFLICT`.
- e2e ligero del controller: `POST /balance-assertions` responde 201 con `assertionId` y el estado consultable inmediatamente (read-your-writes por evaluación síncrona tras declarar).

**Criterios de aceptación.** Se declara con idempotencia, se evalúa de inmediato, se revoca con motivo auditado; errores con código estable.

**Dependencias.** EP-3.1, EP-3.2, EP-3.6 (para la lectura del estado). **Riesgos.** Orden declarar→evaluar dentro del mismo request sin acoplar lados CQRS (se resuelve despachando un command interno, no leyendo el write-side desde el read-side).

**Estimación: M.**

---

## EP-3.4 — Reactor de re-evaluación de aserciones (RF-18)

**Objetivo.** Process manager que, ante eventos que **alteran postings** de una cuenta, identifica las aserciones **posteriores** afectadas de esa cuenta y despacha `EvaluateAssertionCommand` por cada una. **Nunca escribe eventos ni proyecciones** (§3.2, RNF-10): solo despacha commands. Es la pieza que hace que una aserción `MATCHED` pase a `MISMATCHED` cuando se revierte/anula/enmienda una transacción anterior a ella.

**Archivos a crear.**

- `application/reactors/reevaluate-assertions.reactor.ts` — lógica de reacción (núcleo, sin NestJS de transporte).
- `infrastructure/adapters/events/reevaluate-assertions.event-handler.ts` — adaptador que engancha el reactor al `ProjectionDispatcher`/poller con checkpoint (molde: `outbox-relay.scheduler.ts`; el handler solo delega, molde: `generate-scheduled-movements.event-handler.ts`).
- `application/reactors/index.ts`

**Qué eventos la gatillan.** Todo evento que cambie la población `CONFIRMED`+`PENDING` de una cuenta a una fecha:

- `TransactionRecorded` (crea postings — pendiente o confirmada directa).
- `TransactionConfirmed` (una pendiente que ya contaba puede cambiar de fecha efectiva/estado).
- `TransactionAmended` (cambia montos/fecha de una pendiente).
- `TransactionVoided` (retira una pendiente del saldo).
- `TransactionReversed` (+ el `TransactionRecorded` de la reversa) — flujo §7.3.
- `TransfersMerged` (anula dos pendientes y crea la transferencia — EP-3.7).
- El `TransactionRecorded`+`Confirmed` del **ajuste** de `ResolveDiscrepancy` (EP-3.5) — cierra el bucle: tras ajustar, las aserciones de esa cuenta se reevalúan y la resuelta queda `MATCHED`.

**Cómo identifica las aserciones afectadas.** Del evento extrae los `account_id` de sus postings y la **fecha/`occurred_at` efectiva más temprana** alterada (`affectedFrom`). Para cada cuenta, consulta la proyección `assertion_status` (read model, no el write-side) las aserciones **no revocadas** cuyo corte es **posterior o igual** a `affectedFrom` (una aserción anterior al cambio no se ve afectada). Despacha `EvaluateAssertionCommand` por cada una.

```ts
/** Events whose postings can shift an account balance, keyed for the reactor. */
const REEVALUATION_TRIGGERS = [
  'TransactionRecorded',
  'TransactionConfirmed',
  'TransactionAmended',
  'TransactionVoided',
  'TransactionReversed',
  'TransfersMerged',
] as const;

@Injectable()
export class ReevaluateAssertionsReactor {
  constructor(
    private readonly affectedAssertions: AssertionLookupPort, // reads assertion_status
    private readonly commandBus: CommandBus,
  ) {}

  /**
   * Reacts to a posting-altering event: finds this user's non-revoked
   * assertions on the touched accounts whose cutoff is at or after the earliest
   * altered date, and dispatches EvaluateAssertion for each. Dispatch only —
   * never writes events or projections (§3.2).
   */
  async on(event: DomainEvent): Promise<void> {
    if (!this.isTrigger(event)) return; // guard clause
    const touched = this.touchedAccounts(event); // account_id + earliest affected date
    for (const scope of touched) {
      const assertions = await this.affectedAssertions.onAccountFrom(
        event.userId,
        scope.accountId,
        scope.affectedFrom,
      );
      for (const assertionId of assertions) {
        await this.commandBus.execute(new EvaluateAssertionCommand(event.context, assertionId));
      }
    }
  }
}

/** Read-side port: which assertions could be affected by a change on an account. */
export abstract class AssertionLookupPort {
  abstract onAccountFrom(
    userId: string,
    accountId: string,
    affectedFrom: LocalDate,
  ): Promise<readonly string[]>;
}
```

**Ejecución con checkpoint.** El adaptador de eventos consume el stream por posición global con checkpoint propio (patrón del poller de proyección/outbox), garantizando at-least-once. Como `EvaluateAssertion` es idempotente en su efecto (reevaluar produce el mismo veredicto y `applyEvaluation` no re-emite si no cambia), el reprocesamiento es seguro. Se emite métrica OTel de errores del reactor (RNF-12: “un reactor fallando en silencio rompe la re-evaluación sin síntoma visible”).

**Plan TDD** (`reevaluate-assertions.reactor.spec.ts`, con `CommandBus` espía y `AssertionLookupPort` in-memory):
- `TransactionReversed` de una txn anterior a una aserción `MATCHED` → despacha `EvaluateAssertionCommand` para esa aserción.
- Aserción **anterior** a la fecha alterada → **no** se despacha.
- Evento sin postings relevantes / tipo no disparador → **no** se despacha (guard).
- Múltiples cuentas y múltiples aserciones → un command por aserción afectada.
- Idempotencia: procesar el mismo evento dos veces → mismos despachos, sin efectos duplicados (verificado junto con `applyEvaluation` que no re-emite).
- **Verificación arquitectónica**: el reactor no tiene dependencia de `EventStore.append` ni de `ReadModelStore` de escritura (solo lectura + `CommandBus`).

**Criterios de aceptación.** Ante reversa/anulación/enmienda anterior, las aserciones posteriores se reevalúan solas; el reactor solo despacha commands; reprocesar es seguro.

**Dependencias.** EP-3.2, EP-3.3 (`EvaluateAssertionCommand`), EP-3.6 (`assertion_status` para el lookup), `ProjectionDispatcher`/poller (EP-1). **Riesgos.** (1) Fallos silenciosos del reactor → métrica OTel + reintentos con backoff. (2) Cascadas de re-evaluación (un rebuild masivo dispara muchas) → acotar por lote y por posición de checkpoint.

**Estimación: L.**

---

## EP-3.5 — `ResolveDiscrepancy` → ajuste contra `Equity:Adjustments` + `DiscrepancyResolved`

**Objetivo.** Resolver una discrepancia `MISMATCHED` confirmada como real (§2.4.1, §7.5, RF-20): registrar una transacción de **origen sistema** entre la cuenta afectada y `Equity:Adjustments` por el **monto exacto** de la diferencia, confirmarla, y emitir `DiscrepancyResolved` vinculando aserción ↔ transacción de ajuste. Deja el saldo cuadrado sin inventar gasto/ingreso.

**Archivos a crear.**

- `application/commands/resolve-discrepancy.command.ts`, `.handler.ts`
- `domain/services/adjustment.factory.ts` — construye los dos postings del ajuste (cuenta afectada vs `Equity:Adjustments`) a partir de la diferencia; garantiza INV-1 (suma cero por moneda).
- `application/dto/resolve-discrepancy-output.dto.ts`
- Endpoint en `balance-assertion.controller.ts`: `POST /balance-assertions/{id}/resolve`.

**Firmas TypeScript clave.**

```ts
export class ResolveDiscrepancyCommand {
  constructor(
    readonly context: AuthenticatedContext,
    readonly externalRef: Nullable<string>,
    readonly assertionId: string,
  ) {}
}

/** Builds the balanced adjustment postings for a reconciliation difference. */
@Injectable()
export class AdjustmentFactory {
  /**
   * difference = expected - actual. To close the gap on `accountId` we post
   * +difference there and -difference on Equity:Adjustments, so INV-1 holds.
   */
  build(accountId: string, adjustmentsAccountId: string, difference: Money): readonly PostingLine[];
}

@CommandHandler(ResolveDiscrepancyCommand)
export class ResolveDiscrepancyHandler {
  constructor(
    private readonly assertions: BalanceAssertionRepository,
    private readonly commandBus: CommandBus, // reuses RecordTransaction/ConfirmTransaction
    private readonly accounts: SystemAccountLookup, // resolves Equity:Adjustments id (INV-13)
    private readonly factory: AdjustmentFactory,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: ResolveDiscrepancyCommand): Promise<ResolveDiscrepancyOutputDto>;
}
```

**Flujo del handler.**
1. Cargar el agregado; guard `assertion.isResolvable` (debe estar `MISMATCHED`, no revocada, no ya resuelta) → si no, `DiscrepancyNotResolvableException` (código estable).
2. Resolver el id de `Equity:Adjustments` del usuario (cuenta técnica, INV-13).
3. `factory.build(...)` con la última `difference` de la aserción → dos `PostingLine` balanceados (INV-1).
4. **Reutilizar** `RecordTransactionCommand` (origen sistema, `metadata.resolves_assertion = assertionId`, `derived_kind` resultará `COMPOUND`/`ADJUSTMENT`) + `ConfirmTransactionCommand` → emite `TransactionRecorded`+`TransactionConfirmed` del ajuste. Se hace atómico (misma operación) según §6.3.
5. `assertion.markResolved(adjustmentTxnId)` → emite `DiscrepancyResolved(assertion_id, adjustment_transaction_id)`; persistir.
6. El ajuste, al ser un `TransactionRecorded`+`Confirmed` sobre la cuenta, **dispara el reactor EP-3.4**, que reevalúa la aserción → pasa a `MATCHED` (cierre del bucle, §7.5).

> El ajuste es una `LedgerTransaction` ordinaria de origen sistema, **no** un agregado nuevo (§3.3). Se reutilizan los commands existentes; EP-3.5 no reimplementa el ciclo de vida de transacción (DRY).

**Plan TDD.**
- Unit `adjustment.factory.spec.ts`: `difference` positiva/negativa → postings con suma cero por moneda; monto exacto; contrapartida = `Equity:Adjustments`.
- Unit `resolve-discrepancy.handler.spec.ts`: aserción `MISMATCHED` → despacha record+confirm del ajuste y emite `DiscrepancyResolved` con el `adjustment_transaction_id` correcto. Aserción `MATCHED`/`REVOKED`/ya resuelta → excepción de dominio.
- e2e `resolve-discrepancy.e2e-spec.ts` (flujo §7.5): sembrar cuenta con saldo real ≠ esperado → aserción `MISMATCHED` → `POST /resolve` → verificar (a) transacción de ajuste confirmada contra `Equity:Adjustments`, (b) `assertion_status` = `MATCHED` con `resolved_by_txn` poblado (tras reevaluación), (c) `adjustment_audit` acumula el monto por cuenta.

**Criterios de aceptación.** La discrepancia se cierra con un ajuste auditado y balanceado; la aserción queda `MATCHED` y vinculada; auditoría por cuenta acumula. Idempotente por `external_ref`.

**Dependencias.** EP-3.1, EP-3.2/3.4 (reevaluación que cierra el bucle), `RecordTransaction`/`ConfirmTransaction` (EP-1), cuentas técnicas (INV-13). **Riesgos.** Doble resolución/carrera → guard `isResolvable` + concurrencia optimista sobre la aserción.

**Estimación: M.**

---

## EP-3.6 — Proyecciones `assertion_status` y `adjustment_audit`

**Objetivo.** Materializar el estado de conciliación consultable (`assertion_status`) y el indicador de “dinero sin explicación” por cuenta (`adjustment_audit`). Proyecciones **asíncronas** (poller con checkpoint, §8.1), reconstruibles por replay (RNF-5). Los projectors son los **únicos** escritores (RNF-10).

**Archivos a crear.**

- `application/projectors/assertion-status.projector.ts` — mapea `BalanceAsserted`/`BalanceAssertionEvaluated`/`AssertionRevoked`/`DiscrepancyResolved` → filas de `proj_assertions`.
- `application/projectors/adjustment-audit.projector.ts` — mapea `DiscrepancyResolved` (+ el ajuste vinculado) → `proj_adjustment_audit`.
- `application/projectors/index.ts`
- `application/queries/get-assertion-status.query.ts` (+ handler), `list-assertions.query.ts` (+ handler).
- `domain/ports/assertion-status-store.port.ts`, `adjustment-audit-store.port.ts` (puertos de read model; escritura solo desde projectors).
- Adaptadores `infrastructure/adapters/persistence/typeorm/*` e `in-memory/*` + entidades TypeORM `typeorm-proj-assertion.entity.ts`, `typeorm-proj-adjustment-audit.entity.ts`.

**Firmas TypeScript clave.**

```ts
export abstract class AssertionStatusStore {
  abstract upsertAsserted(row: AssertionStatusRow): Promise<void>;
  abstract applyEvaluation(assertionId: string, status: AssertionStatus, difference: string, checkedAt: Date): Promise<void>;
  abstract markRevoked(assertionId: string): Promise<void>;
  abstract linkResolution(assertionId: string, adjustmentTxnId: string): Promise<void>;
  abstract truncate(): Promise<void>; // rebuild
  // read side
  abstract byId(userId: string, assertionId: string): Promise<Nullable<AssertionStatusRow>>;
  abstract listByAccount(userId: string, accountId: string): Promise<readonly AssertionStatusRow[]>;
  /** Used by AssertionLookupPort (EP-3.4): non-revoked assertions at/after a date. */
  abstract nonRevokedOnAccountFrom(userId: string, accountId: string, from: LocalDate): Promise<readonly string[]>;
}

@Injectable()
export class AssertionStatusProjector {
  constructor(private readonly store: AssertionStatusStore) {}
  async project(event: DomainEvent): Promise<void>; // switch on event type, guard-cláusulas
}
```

`assertion_status` sirve además al lookup del reactor (EP-3.4): `AssertionLookupPort` se implementa **sobre** `AssertionStatusStore.nonRevokedOnAccountFrom` — evita duplicar el índice de aserciones por cuenta (DRY).

`adjustment_audit`: por `(user_id, account_id, currency)`, acumula `total_adjusted`, `adjustment_count`, `last_adjusted_on`. Alimentado por `DiscrepancyResolved` cruzado con los postings del ajuste (monto sobre la cuenta afectada, no sobre `Equity:Adjustments`).

**Plan TDD.**
- Unit `assertion-status.projector.spec.ts`: cada evento produce la mutación esperada; `BalanceAssertionEvaluated` actualiza `status`+`difference`+`checked_at`; `DiscrepancyResolved` puebla `resolved_by_txn`; `AssertionRevoked` → `REVOKED`.
- Unit `adjustment-audit.projector.spec.ts`: dos resoluciones sobre la misma cuenta acumulan `total_adjusted` y `adjustment_count`.
- **Contract test** de `AssertionStatusStore` reutilizado entre adaptador in-memory y Postgres (RNF-11).
- **Rebuild test**: truncar + replay del stream reproduce el estado idéntico (RNF-5), incluida la consulta `nonRevokedOnAccountFrom`.

**Criterios de aceptación.** Estado de conciliación consultable y correcto tras cualquier secuencia; auditoría de ajustes por cuenta; reconstruible por replay; único escritor = projector.

**Dependencias.** EP-3.1, EP-3.5 (`DiscrepancyResolved`), `ProjectionDispatcher` (EP-1). **Riesgos.** Lag de proyección asíncrona vs. read-your-writes de la evaluación síncrona en `AssertBalance` — mitigar exponiendo `streamPosition` y/o marcando `assertion_status` como proyección de lag acotado. Métrica OTel de lag (RNF-12).

**Estimación: M.**

---

## EP-3.7 — Transferencias: `transfer_candidates` (RF-15) + `MergePendingTransfers` (RF-16)

**Objetivo.** Detectar pares de transacciones **pendientes** candidatas a ser dos patas de una misma transferencia y ofrecer un command que las fusiona en una única transferencia confirmada. Reemplaza el enfoque `transferGroup` de `apps/finances` por detección desde proyección (el ledger tiene la visión completa de pendientes, §4.3).

Vive en el módulo **`apps/ledger/src/transactions/`** (junto al agregado que reutiliza).

**Detección (RF-15).** Dos pendientes son candidatas si: montos **opuestos** (`+X` / `-X`), **misma moneda**, **cuentas reales distintas** (ambas `ASSETS`/`LIABILITIES`, espejo bancario), dentro de una **ventana temporal configurable**. Se materializa como proyección `transfer_candidates` (asíncrona).

**Fusión (RF-16, §6.3, §7.2).** `MergePendingTransfers` emite atómicamente: `TransactionVoided(t1)` + `TransactionVoided(t2)` + `TransactionRecorded`+`TransactionConfirmed` de la transferencia resultante (`[A: -X, B: +X]`), **conservando las `external_ref` de ambas pendientes en metadata**. Se refleja como `TransfersMerged` (§3.4) para trazabilidad.

**Archivos a crear** (`apps/ledger/src/transactions/`):

- `application/projectors/transfer-candidates.projector.ts` — mantiene pares candidatos ante `TransactionRecorded`/`Amended`/`Voided`/`Confirmed`.
- `domain/services/transfer-detector.service.ts` — regla pura de emparejamiento (montos opuestos, misma moneda, cuentas reales distintas, ventana).
- `application/commands/merge-pending-transfers.command.ts`, `.handler.ts`
- `application/queries/list-transfer-candidates.query.ts` (+ handler)
- `domain/ports/transfer-candidate-store.port.ts`
- `infrastructure/adapters/http/transfer.controller.ts` (o extensión del controller de transacciones): `GET /transfers/candidates`, `POST /transfers/merge`.
- Entidad TypeORM `typeorm-proj-transfer-candidate.entity.ts` + adaptadores in-memory/Postgres.

**Firmas TypeScript clave.**

```ts
export interface TransferCandidatePair {
  readonly outgoingTxnId: string; // the -X pending leg
  readonly incomingTxnId: string; // the +X pending leg
  readonly amount: Money;
  readonly currency: string;
  readonly outgoingAccountId: string;
  readonly incomingAccountId: string;
  readonly withinDays: number; // gap between the two legs
}

/** Configurable detection window/tolerance (open question #4). */
export interface TransferDetectionConfig {
  readonly windowDays: number; // e.g. 3
  readonly amountTolerance: Money; // usually zero (exact opposites)
}

@Injectable()
export class TransferDetector {
  constructor(private readonly config: TransferDetectionConfig) {}

  /**
   * Given a newly-pending posting leg and the current pending legs of the user,
   * returns the matching opposite leg if one qualifies as a transfer pair:
   * opposite amount, same currency, distinct real accounts, within window.
   */
  match(candidate: PendingLeg, others: readonly PendingLeg[]): Nullable<TransferCandidatePair>;
}

export class MergePendingTransfersCommand {
  constructor(
    readonly context: AuthenticatedContext,
    readonly externalRef: Nullable<string>,
    readonly pendingIds: readonly [string, string], // exactly two
  ) {}
}

@CommandHandler(MergePendingTransfersCommand)
export class MergePendingTransfersHandler {
  constructor(
    private readonly transactions: LedgerTransactionRepository,
    private readonly accounts: AccountLookup,
    private readonly ids: IdGenerator,
  ) {}

  /**
   * Voids both pending legs and records+confirms a single transfer atomically,
   * preserving both external refs in metadata (§7.2). Emits TransfersMerged.
   */
  async execute(command: MergePendingTransfersCommand): Promise<MergeTransfersOutputDto>;
}
```

**Validaciones del handler (guard clauses).** Ambas pendientes existen, son `PENDING`, del mismo usuario, montos opuestos, misma moneda, cuentas reales distintas → si no, excepción de dominio con código estable (p. ej. `NOT_A_TRANSFER_PAIR`). La confirmación de la transferencia resultante hereda la fecha/postings del par.

**Plan TDD.**
- Unit `transfer-detector.service.spec.ts`: par válido (montos opuestos, misma moneda, cuentas reales distintas, dentro de ventana) → devuelve el par; fuera de ventana → `null`; distinta moneda → `null`; misma cuenta → `null`; una no es real (categoría) → `null`; montos no exactamente opuestos con tolerancia 0 → `null`.
- Unit `transfer-candidates.projector.spec.ts`: al llegar la segunda pierna pendiente aparece el par; al `Void`/`Confirm`/`Merge` de una pierna, el par desaparece de la proyección.
- Unit `merge-pending-transfers.handler.spec.ts`: emite `TransactionVoided`×2 + `TransactionRecorded`+`TransactionConfirmed` en una operación; metadata conserva ambas `external_ref`. Entrada inválida → excepción estable.
- e2e `merge-transfers.e2e-spec.ts` (flujo §7.2): dos `POST /transactions` pendientes opuestas → `GET /transfers/candidates` muestra el par → `POST /transfers/merge` → verificar dos anuladas y una transferencia confirmada; `derived_kind = TRANSFER`; ambas pendientes ya no cuentan como gasto/ingreso (RF-5).

**Criterios de aceptación.** Se detectan pares candidatos por proyección con ventana configurable; el merge es atómico, conserva procedencia y produce una transferencia confirmada; las piernas originales quedan anuladas y no computan en reportes.

**Dependencias.** Agregado `LedgerTransaction` + commands `Void`/`Record`/`Confirm` (EP-1), `proj_accounts` (tipos de cuenta), `ProjectionDispatcher`. **Riesgos.** (1) Falsos positivos de emparejamiento (dos gastos iguales y opuestos casuales) → la regla exige **cuentas reales distintas** y ventana corta; calibrable (pregunta abierta #4). (2) Carrera entre detección y confirmación manual de una pierna → el merge revalida estado `PENDING` en el write-side antes de emitir.

**Estimación: L.**

---

## Secuencia interna de EP-3

```
EP-3.1 (agregado) ─► EP-3.2 (evaluador) ─► EP-3.3 (commands/endpoints)
                                    │
                                    ├─► EP-3.6 (proyecciones) ──┐
                                    │                           │ lookup
                                    └─► EP-3.4 (reactor) ◄───────┘
EP-3.4 + EP-3.6 ─► EP-3.5 (resolve discrepancy, cierra el bucle vía reactor)
EP-3.7 (transferencias) — independiente; solo depende de EP-1/EP-2
```

`EP-3.7` puede desarrollarse en paralelo a `EP-3.1–3.6` (solo comparte el agregado `LedgerTransaction` de EP-1).

---

## DDL propuesto para proyecciones (adaptado de §6.2)

> Tablas de lectura, **sin constraints de negocio** (§6.3): la verdad vive en el stream; un bug se corrige por rebuild. `NUMERIC(20,6)` para montos; la aritmética exacta vive en el núcleo (`Money`), la columna solo materializa.

```sql
-- Reconciliation status (assertion_status) — extiende proj_assertions de §6.2
CREATE TABLE proj_assertions (
    assertion_id     UUID PRIMARY KEY,
    user_id          UUID NOT NULL,
    account_id       UUID NOT NULL,
    date             DATE NOT NULL,
    occurred_at      TIMESTAMPTZ,               -- present => intraday assertion
    expected_amount  NUMERIC(20, 6) NOT NULL,
    currency_code    TEXT NOT NULL,
    tolerance        NUMERIC(20, 6) NOT NULL DEFAULT 0,
    status           TEXT NOT NULL,             -- UNCHECKED | MATCHED | MISMATCHED | INDETERMINATE | REVOKED
    difference       NUMERIC(20, 6),            -- expected - actual, signed; NULL until first evaluation
    resolved_by_txn  UUID,                      -- adjustment transaction, if resolved (EP-3.5)
    revoke_reason    TEXT,
    checked_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reactor lookup (EP-3.4) and per-account listing: assertions on an account, by cutoff
CREATE INDEX idx_proj_assertions_account
    ON proj_assertions (user_id, account_id, date)
    WHERE status <> 'REVOKED';
CREATE INDEX idx_proj_assertions_user_status
    ON proj_assertions (user_id, status);

-- Adjustment audit (adjustment_audit): "unexplained money" indicator per account
CREATE TABLE proj_adjustment_audit (
    user_id           UUID NOT NULL,
    account_id        UUID NOT NULL,
    currency_code     TEXT NOT NULL,
    total_adjusted    NUMERIC(20, 6) NOT NULL DEFAULT 0,   -- sum of adjustment amounts on the account
    adjustment_count  INTEGER NOT NULL DEFAULT 0,
    last_adjusted_on  DATE,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, account_id, currency_code)
);

-- Detail rows behind the audit (one per resolution), for drill-down
CREATE TABLE proj_adjustment_audit_entries (
    adjustment_txn_id UUID PRIMARY KEY,
    user_id           UUID NOT NULL,
    account_id        UUID NOT NULL,
    assertion_id      UUID NOT NULL,
    amount            NUMERIC(20, 6) NOT NULL,   -- signed adjustment on the account
    currency_code     TEXT NOT NULL,
    resolved_on       DATE NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_adjustment_entries_account ON proj_adjustment_audit_entries (user_id, account_id);

-- Transfer candidates (transfer_candidates) — pairs of pending legs (RF-15)
CREATE TABLE proj_transfer_candidates (
    pair_id             UUID PRIMARY KEY,        -- deterministic hash of (outgoing_txn_id, incoming_txn_id)
    user_id             UUID NOT NULL,
    outgoing_txn_id     UUID NOT NULL,           -- the -X pending leg
    incoming_txn_id     UUID NOT NULL,           -- the +X pending leg
    outgoing_account_id UUID NOT NULL,
    incoming_account_id UUID NOT NULL,
    amount              NUMERIC(20, 6) NOT NULL, -- absolute amount
    currency_code       TEXT NOT NULL,
    gap_days            INTEGER NOT NULL,        -- temporal distance between legs
    detected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, outgoing_txn_id, incoming_txn_id)
);
CREATE INDEX idx_transfer_candidates_user ON proj_transfer_candidates (user_id, detected_at);
-- A leg leaving PENDING (void/confirm/merge) removes its rows:
CREATE INDEX idx_transfer_candidates_legs
    ON proj_transfer_candidates (user_id, outgoing_txn_id, incoming_txn_id);
```

> Ninguna de estas tablas lleva FK a otras proyecciones ni al event store: se reconstruyen por replay (RNF-5). `checkpoint` de cada proyección vive en `projection_checkpoints` (§6.1).

---

## Decisiones abiertas para el usuario

**#4 — Ventana temporal y tolerancia del detector de transferencias (RF-15).**
- **Qué decidir**: `windowDays` (distancia máxima entre las dos piernas pendientes) y si se admite `amountTolerance` > 0 (para transferencias con comisión/redondeo entre monedas).
- **Propuesta por defecto**: `windowDays = 3`, `amountTolerance = 0` (misma moneda, montos exactamente opuestos). Encapsulado en `TransferDetectionConfig` vía `registerAs` (config namespaced, patrón del repo) para calibrar sin tocar dominio.
- **Impacto**: ventana amplia ⇒ más falsos positivos; estrecha ⇒ se pierden transferencias con asiento diferido. La spec lo marca “calibrar con datos reales”.

**#6 — Orden intradía con transacciones sin `occurred_at` frente a aserciones intradía → `INDETERMINATE` (§2.4).**
- **Qué decidir**: la regla exacta que distingue `INDETERMINATE` de `MISMATCHED` cuando conviven, el mismo día, transacciones con y sin `occurred_at`, y una aserción intradía.
- **Propuesta por defecto** (implementada en EP-3.2): si existen postings del mismo día **sin** `occurred_at` cuyo monto neto ≠ 0 y que harían caer la diferencia dentro/fuera de tolerancia según se incluyan o no → `INDETERMINATE` (se prefiere no arrojar un falso `MISMATCHED`). Si su efecto neto es 0 o no cambia el veredicto → resolución determinista.
- **Alternativas**: (a) tratar toda transacción sin `occurred_at` como “al inicio del día” (determinista, arriesga falsos MISMATCHED); (b) exigir `occurred_at` en todo posting de cuentas con aserciones intradía (traslada el costo al cliente de captura). La spec lo marca “validar contra datos reales de notificaciones”.

---

## Estimación por subtarea (S / M / L)

| Subtarea | Alcance | Estimación |
|---|---|---|
| EP-3.1 | Agregado `BalanceAssertion` + eventos + ciclo de vida | **M** |
| EP-3.2 | Evaluador con semántica temporal, timezone e `INDETERMINATE` | **L** |
| EP-3.3 | Commands `AssertBalance`/`RevokeAssertion`/`EvaluateAssertion` + endpoints | **M** |
| EP-3.4 | Reactor de re-evaluación (solo despacha commands) + checkpoint | **L** |
| EP-3.5 | `ResolveDiscrepancy` + ajuste contra `Equity:Adjustments` | **M** |
| EP-3.6 | Proyecciones `assertion_status` + `adjustment_audit` + queries | **M** |
| EP-3.7 | `transfer_candidates` + `MergePendingTransfers` + endpoints | **L** |

**Ruta crítica**: EP-3.2 → EP-3.4 → EP-3.5 (la semántica temporal y el bucle reactor↔ajuste concentran el riesgo). EP-3.7 es paralelizable.

**Hecho cuando** (criterio de la épica): se registran aserciones, se evalúan/re-evalúan solas ante cambios previos, se resuelven discrepancias con ajuste auditado, y se detectan y fusionan pares de transferencia — todo con contract tests idénticos in-memory/Postgres y proyecciones reconstruibles por replay.
