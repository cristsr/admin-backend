# context: hu-0026

## Historia resumida

**Como** usuario que corrige un error contable
**Quiero** elegir si la reversa de una transacción confirmada se asienta en la fecha original
o en la fecha de hoy
**Para** poder corregir el saldo histórico cuando el período sigue abierto, y dejarlo intacto
cuando ya fue conciliado y cerrado

## Componentes afectados

- `apps/ledger` — módulo `transactions` (principal)
- `apps/ledger` — módulo `shared` (catálogo de códigos de error)
- `apps/ledger` — módulo `reconciliation` (solo lectura: se verifica el efecto, no se toca)

> Relevado sobre la rama `feat/core` (limpia), no sobre `develop`. Si la base cambió, correr
> `/scan hu-0026` antes de diseñar.

---

## apps/ledger — módulo `transactions`

### Módulo afectado

`apps/ledger/src/transactions/`

### Agregado

**Archivo:** `apps/ledger/src/transactions/domain/transaction/ledger-transaction.aggregate.ts`

**Estado interno:** `txStatus`, `txPostings`, `txDate: LedgerDate`, `annotations`,
`reversed: boolean`.

**Métodos del ciclo de vida:**
- `static record(args, balance, idGenerator): LedgerTransaction` — valida INV-2 e INV-1, emite
  `TransactionRecorded`.
- `static rehydrate(id, events)`
- `amend(postings, date, balance)` — solo `PENDING` (INV-6)
- `annotate(annotations)` — cualquier estado salvo `VOIDED`
- `confirm(clock)` — `PENDING → CONFIRMED`; **ya recibe un `Clock`**, precedente directo de
  cómo inyectarle el tiempo al agregado
- `void(reason)` — solo `PENDING`
- `reverse(reversalId): ReversalPlan` — **el punto de cambio de esta historia** (líneas
  167-187). Guarda dos condiciones: estado ≠ `CONFIRMED` y `this.reversed`. Emite
  `TransactionReversed(reversalId)` y devuelve el plan.
- `mergedFrom(mergedTransactionIds)`

**`ReversalPlan`** (líneas 47-53) — el contrato ya existente que esta historia pasa a usar:

```typescript
export type ReversalPlan = {
  readonly reversalId: string;
  readonly sourceTransactionId: string;
  readonly date: LedgerDate;
  readonly postings: readonly PostingLine[];
  readonly description: string;
};
```

### Handler (caso de uso)

**Archivo:**
`apps/ledger/src/transactions/application/usecases/reverse-transaction/reverse-confirmed-transaction.handler.ts`

**Constructor:**
```typescript
constructor(
  private readonly transactions: LedgerTransactionRepository,
  private readonly balance: BalanceRule,
  private readonly idGenerator: IdGenerator,
  private readonly dispatcher: ProjectionDispatcher,
  private readonly eventStore: EventStore,
) {}
```

**Flujo actual:**
1. `transactions.load(ctx.userId, command.transactionId)` → 404 si no existe
   (`TransactionNotFoundException`).
2. Construye la reversa con `LedgerTransaction.record({ date: original.date, payee: null,
   description: \`Reversal of ${original.id}\`, postings: original.postings.map(p =>
   p.negated()), initialStatus: CONFIRMED, metadata: { reverses_id: original.id } })`
   (líneas 49-62).
3. `original.reverse(reversing.id)` — **descarta el `ReversalPlan` que devuelve** (línea 65).
4. Ambos `save` dentro de `eventStore.withTransaction` (INV-7); la reversa se guarda
   *anchorless* (`externalRef: null`) porque el stream original es el ancla de idempotencia.
5. `dispatcher.dispatch([...originalResult.events, ...reversingResult.events])` — fuera de la
   transacción a propósito.
6. Retorna `{ aggregateId: reversing.id, streamPosition, idempotentReplay: false }`.

**Command:** `reverse-confirmed-transaction.command.ts` — hoy solo `readonly transactionId:
string`, `commandType = 'ReverseConfirmedTransaction'`.

### Registro del handler (wiring)

**Archivo:** `apps/ledger/src/bootstrap/ledger-application.factory.ts:206-215`

```typescript
commandBus.register(
  ReverseConfirmedTransactionCommand,
  new ReverseConfirmedTransactionHandler(transactions, balance, idGenerator, dispatcher, eventStore),
);
```

> El handler **no** se registra en `transactions.module.ts` — ese módulo solo compone
> `MergePendingTransfersHandler`, los puertos de lectura y el repositorio. Un `Clock` nuevo en
> el constructor del handler se cablea acá, y `ledger-core.module.ts:38` ya provee
> `{ provide: Clock, useClass: SystemClock }`.

### Adaptador HTTP

**Controller:** `apps/ledger/src/transactions/infrastructure/adapters/http/transactions.controller.ts`

```typescript
@Post(':id/reverse')
@ApiOperation({ summary: 'Reverse a confirmed transaction; returns the reversal id.' })
@ApiCreatedResponse({ type: CommandAcceptedDto })
reverse(
  @Context() context: LedgerContext,
  @ExternalRef() externalRef: Nullable<string>,
  @Param('id') id: string,
  @Body() _dto: ReverseTransactionRequestDto,
): Promise<CommandResult> {
  return this.dispatch(new ReverseConfirmedTransactionCommand(id), context, externalRef, _dto);
}
```

Es el único endpoint del ciclo de vida que responde **201** (crea un agregado). El privado
`dispatch(command, context, externalRef, dto)` arma el `AuthContext` incluyendo el `dryRun` que
el body pueda traer (hu-0025).

**DTO:** `apps/ledger/src/transactions/infrastructure/adapters/http/dto/reverse-transaction-request.dto.ts`

```typescript
export class ReverseTransactionRequestDto {
  @ApiPropertyOptional({ example: 'Refunded by the merchant' })
  @IsOptional() @IsString()
  readonly reason?: string;

  @ApiPropertyOptional({ default: false, description: 'Preview mode (hu-0025)…' })
  @IsOptional() @IsBoolean()
  readonly dryRun?: boolean;
}
```

**Patrón de default en el controller** (a replicar): `dto.payee ?? null`, `dto.tags ?? []`,
`dto.occurredAt ?? null`, `dto.invoiceUrl ?? null`.

### Excepciones del módulo

**Archivo:** `apps/ledger/src/transactions/domain/transaction/exceptions/transaction.exception.ts`

| Excepción | Base | `code` | HTTP |
|---|---|---|---|
| `TransactionNotFoundException` | `DomainNotFoundException` | `TRANSACTION_NOT_FOUND` | 404 |
| `UnbalancedTransactionException` | `DomainUnprocessableException` | `UNBALANCED_TRANSACTION` | 422 |
| `InsufficientPostingsException` | `DomainUnprocessableException` | `INSUFFICIENT_POSTINGS` | 422 |
| `ImmutableTransactionException` | `DomainConflictException` | `IMMUTABLE_TRANSACTION` | 409 |
| `InvalidTransactionStateException` | `DomainConflictException` | `INVALID_TRANSACTION_STATE` | 409 |

La excepción nueva de AC-3 sigue exactamente esta forma: `class
TransactionAlreadyReversedException extends DomainConflictException { readonly code: string =
'TRANSACTION_ALREADY_REVERSED'; }`.

### Tests existentes que tocan el cambio

- `reverse-confirmed-transaction.handler.spec.ts` — dobles manuales del repositorio, `BalanceRule`
  y `ProjectionDispatcher`; `SequentialIdGenerator` y `FixedClock` disponibles vía
  `@ledger/shared/testing`. El `eventStore` es un stub cuyo `withTransaction` solo corre el trabajo.
- `transactions.controller.spec.ts` — cubre el dispatch de `reverse`.
- `ledger-application.spec.ts`, `app.wiring.spec.ts` — verifican el registro del handler.
- `ledger-transaction.aggregate.spec.ts` — el agregado. ⚠️ el grafo reporta **`confirm()` sin
  tests que lo cubran**; verificar antes de asumir cobertura del ciclo de vida.

### Documentación del módulo

- `apps/ledger/docs/transactions/README.md` — arc42-lite, tabla de casos de uso e invariantes.
- `apps/ledger/docs/transactions/flows/reverse-transaction.md` — flujo actual, con su tabla de
  errores (hoy: 404 `TRANSACTION_NOT_FOUND`, 409 `INVALID_TRANSACTION_STATE`).
- `apps/ledger/docs/transactions/api.yaml` — `operationId: reverseTransaction`, líneas 367-392.
- `apps/ledger/docs/transactions/transactions.c4` — dynamic view `reverseTransaction`.

---

## apps/ledger — módulo `shared` (códigos de error)

### Catálogo

**Archivo:** `apps/ledger/src/shared/domain/errors/ledger-error-code.ts`

`LEDGER_ERROR_CODE` es un `as const` agrupado por área (Transactions, Accounts,
Reconciliation, Ledger settings, Value objects, Platform) con el tipo derivado
`LedgerErrorCode`. Su JSDoc es normativo:

> «This constant is the single source of truth for the strings the API exposes (…). Adding a
> code is additive; changing the HTTP status a code maps to is a breaking change (new API
> version).»

El bloque **Transactions** es donde entra `TRANSACTION_ALREADY_REVERSED`.

### Contrato código → status

**Archivo:** `apps/ledger/src/shared/infrastructure/adapters/http/ledger-error-code-mapping.spec.ts`

Tabla `cases: ReadonlyArray<[DomainException, number, string]>` ejercitada con `it.each` a
través del `ExceptionFilter` real. Su JSDoc: «Adding a code obliges adding a row here; changing
a status here is a breaking API change.» Agregar el código sin su fila deja el contrato sin
congelar.

### Filtro

**Archivo:** `libs/shared/src/filters/exception.filter.ts` — `@Catch()` global. Toda
`DomainException` aporta su `status` y su `code` al body (`ErrorResponseBody`); cualquier otro
error cae en 500 **sin** filtrar código de dominio.

---

## apps/ledger — módulo `reconciliation` (lectura, no se modifica)

### Reactor de re-evaluación (RF-18)

**Archivo:** `apps/ledger/src/reconciliation/application/reactors/reevaluate-assertions.reactor.ts`

`REEVALUATION_TRIGGERS` incluye `TransactionRecorded`, `TransactionAmended` y
`TransactionVoided`. Su JSDoc dice explícitamente por qué `TransactionReversed` **no** está:

> «a reversal emits its own `TransactionRecorded` — with postings — which this reactor [ya
> consume]».

**Consecuencia para AC-1:** las dos ramas de `atEffectiveDate` disparan el mismo camino; lo
único que cambia es la fecha del evento y, por lo tanto, qué aserciones quedan alcanzadas. No
hay trabajo en el reactor.

### Precedente de «fecha de hoy»

**Archivo:** `apps/ledger/src/reconciliation/application/usecases/resolve-discrepancy/resolve-discrepancy.handler.ts:70`

```typescript
this.clock.now().toISOString().slice(0, 10)
```

Único caso en el repo de una transacción a la que el sistema le asigna la fecha de hoy. Fija
el precedente que adopta AC-1.

### Noción contrapuesta de «día»

**Archivo:** `apps/ledger/src/reconciliation/domain/services/day-boundary.resolver.ts:77`

Usa `Intl.DateTimeFormat` con `timeZone` para derivar el corte del día en la timezone del
ledger, leída con `LedgerTimezoneReader.timezoneOf(userId)`
(`apps/ledger/src/ledger/application/ports/ledger-timezone-reader.port.ts`). Ver «Gaps».

---

## Plataforma (`libs/cqrs`, `libs/shared`)

- **`IdempotencyPolicy`** — `libs/cqrs/src/application/command-bus/policies/idempotency.policy.ts:46`:
  `sha256Hex(await canonicalJson({ userId, command }))`. El hash cubre el **comando entero**,
  así que `atEffectiveDate` entra sin código adicional y habilita AC-5.
- **`Clock`** — puerto en `@cqrs/domain/ports`; adaptador `SystemClock`
  (`@cqrs/infrastructure/adapters/system-clock`), provisto en `ledger-core.module.ts:38`. Doble
  de test: `FixedClock` en `@ledger/shared/testing`.
- **`LedgerDate`** — `apps/ledger/src/shared/domain/value-objects/ledger-date.ts`. Día
  calendario puro `YYYY-MM-DD`, sin hora ni zona; `of()` valida forma y validez calendaria.
  Comparadores: `isBefore`, `isAfter`, `isSameOrBefore`, `isSameOrAfter`, `equals`. **No**
  tiene constructor «hoy».

---

## Gaps detectados

1. **La fecha de la reversa vive hoy en dos lugares.** `LedgerTransaction.reverse()` devuelve un
   `ReversalPlan` completo (fecha, postings negados, descripción) que el handler **descarta**,
   reconstruyendo lo mismo en `handler.ts:49-62`. Es la duplicación que esta historia unifica
   (decisión consultada, ver `hu.md`). `/design` debe definir la firma nueva de `reverse()` y
   qué hace el handler con el plan.

2. **Dos nociones de «día» conviven en el ledger.** Transacciones: UTC
   (`resolve-discrepancy.handler.ts:70`). Reconciliación: timezone del ledger vía
   `DayBoundaryResolver` + `LedgerTimezoneReader`. AC-1 adopta la primera por consistencia y
   por Simplicity Gate, pero un usuario en UTC-5 operando de noche verá la reversa fechada al
   día siguiente. Vale una decisión transversal en algún ítem futuro; **no** en éste.

3. **`LedgerDate` no sabe construir «hoy».** No hay `LedgerDate.today(clock)` ni equivalente;
   el único caso existente arma el string a mano con `slice(0, 10)`. `/design` decide si
   introduce el constructor en el VO o repite el patrón.

4. **`reason?` del body sigue muerto.** El controller declara `_dto` y no lo propaga
   (documentado en el flow doc y en el `api.yaml`). Fuera de alcance de esta historia, pero
   sigue siendo deuda visible en el contrato.

5. **Cobertura del agregado incompleta.** El grafo reporta `LedgerTransaction.confirm()` sin
   tests que lo cubran. Tocar el agregado sin verificar esto arriesga un cambio silencioso en
   el ciclo de vida.

6. **No existe el concepto de «período contable cerrado».** El encuadre lo usa como motivación;
   el código no tiene nada equivalente. Ninguna validación puede apoyarse en él.

7. **Sin regla sobre fechas futuras.** Ni `RecordTransaction` ni `LedgerDate` acotan la fecha
   contra el presente, así que con `atEffectiveDate: false` la reversa puede quedar fechada
   antes que la original. Aceptado explícitamente en AC-1.
