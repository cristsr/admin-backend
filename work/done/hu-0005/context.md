# context: hu-0005

## Historia resumida

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** un command bus con políticas transversales (contexto autenticado, idempotencia,
concurrencia optimista) y los 8 handlers núcleo (`InitializeLedger`, `OpenAccount`,
`RecordTransaction`, `ConfirmTransaction`, `AmendPendingTransaction`, `AnnotateTransaction`,
`VoidPendingTransaction`, `ReverseConfirmedTransaction`)
**Para** poder inicializar un ledger, abrir cuentas y registrar/confirmar transacciones
balanceadas end-to-end por código, con errores de dominio estables, antes de exponer nada por
HTTP (EP-2)

> Corresponde a **EP-1.8** del roadmap del ledger.

## Componentes afectados

- `apps/ledger`

---

## apps/ledger

### Módulo afectado: `shared-kernel` (command bus + políticas)

`D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\command-bus\`

#### Command bus core

| Archivo | Artefacto |
|---|---|
| `command.ts:1:2` | `abstract class Command` — `abstract readonly commandType: string` |
| `command-handler.ts:1:2` | `abstract class CommandHandler<TCommand extends Command>` — `abstract execute(command: TCommand, ctx: AuthContext): Promise<CommandResult>` |
| `command-bus.ts:1:9` | `abstract class CommandBus` — `abstract dispatch(command: Command, ctx: AuthContext): Promise<CommandResult>` |
| `command-bus.ts:11:28` | `class PolicyCommandBus extends CommandBus` — constructor recibe `policies: readonly CommandPolicy[]`, método `register(commandType, handler)`, `dispatch` encadena políticas vía `reduceRight` |
| `command-bus.ts:5:7` | `class UnregisteredCommandException extends DomainUnprocessableException` — code `UNREGISTERED_COMMAND` |
| `command-result.type.ts` | `type CommandResult = { aggregateId: string; streamPosition: bigint; idempotentReplay: boolean }` |
| `auth-context.type.ts` | `type AuthContext = { userId: string; clientId: string; externalRef: Nullable<string> }` |
| `command-policy.ts` | `type CommandNext = () => Promise<CommandResult>`; `abstract class CommandPolicy` — `abstract handle(command, ctx, next): Promise<CommandResult>` |

#### Políticas transversales

| Archivo | Política |
|---|---|
| `policies/authenticated-context.policy.ts` | `class AuthenticatedContextPolicy extends CommandPolicy` — valida `userId`/`clientId` no vacíos, lanza `MissingAuthContextException` si faltan |
| `policies/idempotency.policy.ts` | `class IdempotencyPolicy extends CommandPolicy` — constructor recibe `EventStore`; busca por `externalRef` en `EventStore.findByExternalRef`, si existe devuelve `CommandResult` original con `idempotentReplay: true`, si no llama `next()` y captura `DuplicateExternalRefException` como defensa en profundidad |
| `policies/optimistic-concurrency.policy.ts` | `class OptimisticConcurrencyPolicy extends CommandPolicy` — reintenta 1 vez ante `ConcurrencyConflictException` (`MAX_RETRIES = 1`), si falla de nuevo propaga el error |
| `policies/missing-auth-context.exception.ts` | `class MissingAuthContextException extends DomainUnprocessableException` — code `MISSING_AUTH_CONTEXT` |

### Módulo afectado: `ledger` (InitializeLedger + LedgerSettings)

`D:\Cristian\Nest\admin-back\apps\ledger\src\ledger\`

#### Composición raíz (wiring de todo el command bus)

**Archivo:** `application/ledger-application.factory.ts`

Función `createLedgerApplication(deps: LedgerApplicationDeps): LedgerApplication`:
- Crea `EventRegistry`, `EnvelopeFactory`, `ZeroSumBalanceRule`
- Crea 4 projectors: `AccountTreeProjector`, `TransactionListProjector`, `AccountBalancesProjector`, `LedgerSettingsProjector`
- Crea `SynchronousProjectionDispatcher`
- Crea repositorios: `AccountRepository`, `LedgerTransactionRepository`, `LedgerSettingsRepository`
- Crea `AccountValidationService(readModel)`
- Crea `PolicyCommandBus` con 3 políticas en orden fijo:
  1. `new AuthenticatedContextPolicy()`
  2. `new IdempotencyPolicy(eventStore)`
  3. `new OptimisticConcurrencyPolicy()`
- Registra 10 handlers: `InitializeLedger`, `OpenAccount`, `RenameAccount`, `CloseAccount`, `RecordTransaction`, `ConfirmTransaction`, `AmendPendingTransaction`, `AnnotateTransaction`, `VoidPendingTransaction`, `ReverseConfirmedTransaction`
- Retorna `{ commandBus, projectors, dispatcher }`

#### InitializeLedger

| Archivo | Artefacto |
|---|---|
| `application/initialize-ledger/initialize-ledger.command.ts` | `class InitializeLedgerCommand extends Command` — `commandType = 'InitializeLedger'`; args: `presentationCurrency: string`, `timezone: string` |
| `application/initialize-ledger/initialize-ledger.handler.ts` | `class InitializeLedgerHandler extends CommandHandler<InitializeLedgerCommand>` — deps: `LedgerSettingsRepository`, `AccountRepository`, `IdGenerator`, `Clock`, `ProjectionDispatcher`; chequea `existing.isInitialized` → `LedgerAlreadyInitializedException`; crea 2 cuentas de sistema (`Equity:OpeningBalances`, `Equity:Adjustments`); crea `LedgerSettings.initialize(...)` con anchor (`externalRef`); guarda cuentas con contexto sin anchor; despacha todos los eventos |

#### LedgerSettings aggregate

**Archivo:** `domain/settings/ledger-settings.aggregate.ts`
- `class LedgerSettings extends AggregateRoot<string>`
- `static initialize(args: InitializeLedgerArgs): LedgerSettings`
- `static rehydrate(id: string, events: readonly DomainEvent[]): LedgerSettings`
- `get isInitialized(): boolean`
- `changePresentationCurrency(currency: CurrencyCode): void`
- `changeTimezone(timezone: IanaTimeZone): void`
- Campos: `initialized: boolean`, `presentationCurrency: string`, `timezone: string`

**Evento:** `domain/settings/events/ledger-initialized.event.ts` — `LedgerInitializedProps { presentationCurrency, timezone, openingBalancesAccountId, adjustmentsAccountId }`

**Repositorio:** `application/ledger-settings.repository.ts` — `class LedgerSettingsRepository extends EventSourcedRepository<LedgerSettings>`, `aggregateType = 'Ledger'`

#### Excepciones

**Archivo:** `domain/settings/exceptions/ledger.exception.ts`
- `class LedgerAlreadyInitializedException extends DomainConflictException` — code `LEDGER_ALREADY_INITIALIZED`
- `class AccountNotFoundException extends DomainNotFoundException` — code `ACCOUNT_NOT_FOUND`

### Módulo afectado: `accounts`

`D:\Cristian\Nest\admin-back\apps\ledger\src\accounts\`

#### Account aggregate

**Archivo:** `domain/account/account.aggregate.ts`
- `class Account extends AggregateRoot<string>`
- `static open(args: OpenAccountArgs, idGenerator: IdGenerator): Account`
- `static rehydrate(id: string, events: readonly DomainEvent[]): Account`
- `get name(): AccountName`
- `get type(): AccountType`
- `get isSystem(): boolean`
- `get isClosed(): boolean`
- `rename(newName: AccountName): void`
- `close(closedOn: LedgerDate): void`
- `ensureOpenOn(date: LedgerDate): void`
- `ensureAcceptsCurrency(code: CurrencyCode): void`

#### Eventos de dominio

| Evento | Props |
|---|---|
| `AccountOpened` | `{ accountId, type, name, parentName, currencies, openedOn, isBankMirror, isSystem }` |
| `AccountRenamed` | `{ previousName, newName }` |
| `AccountClosed` | `{ closedOn }` |

#### Handlers

| Archivo | Handler | Deps |
|---|---|---|
| `application/open-account/open-account.handler.ts` | `class OpenAccountHandler` | `AccountRepository`, `ReadModelStore`, `IdGenerator`, `ProjectionDispatcher` |
| `application/rename-account/rename-account.handler.ts` | `class RenameAccountHandler` | `AccountRepository`, `ProjectionDispatcher` |
| `application/close-account/close-account.handler.ts` | `class CloseAccountHandler` | `AccountRepository`, `ProjectionDispatcher` |

#### AccountValidationService

**Archivo:** `application/account-validation.service.ts`
- `class AccountValidationService`
- Constructor: `ReadModelStore`
- `async validate(userId: string, date: LedgerDate, postings: readonly PostingLine[]): Promise<readonly AccountType[]>`

#### Repositorio

**Archivo:** `application/account.repository.ts` — `class AccountRepository extends EventSourcedRepository<Account>`, `aggregateType = 'Account'`

#### Excepciones (accounts)

**Archivo:** `domain/account/exceptions/account.exception.ts`
- `SystemAccountProtectedException extends DomainConflictException` — code `SYSTEM_ACCOUNT_PROTECTED`
- `RealAccountCurrencyException extends DomainUnprocessableException` — code `REAL_ACCOUNT_SINGLE_CURRENCY`
- `AccountClosedException extends DomainUnprocessableException` — code `ACCOUNT_CLOSED`
- `AccountAlreadyClosedException extends DomainConflictException` — code `ACCOUNT_ALREADY_CLOSED`
- `InvalidCloseDateException extends DomainUnprocessableException` — code `INVALID_CLOSE_DATE`
- `CurrencyNotAllowedException extends DomainUnprocessableException` — code `CURRENCY_NOT_ALLOWED`
- `NameCollisionException extends DomainConflictException` — code `NAME_COLLISION`

### Módulo afectado: `transactions`

`D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\`

#### LedgerTransaction aggregate

**Archivo:** `domain/transaction/ledger-transaction.aggregate.ts`
- `class LedgerTransaction extends AggregateRoot<string>`
- `static record(args: RecordTransactionArgs, balance: BalanceRule, idGenerator: IdGenerator): LedgerTransaction`
- `static rehydrate(id: string, events: readonly DomainEvent[]): LedgerTransaction`
- `get status(): TransactionStatus`
- `get date(): LedgerDate`
- `get postings(): readonly PostingLine[]`
- `amend(postings: readonly PostingLine[], date: LedgerDate, balance: BalanceRule): void`
- `annotate(annotations: TransactionAnnotations): void`
- `confirm(clock: Clock): void`
- `void(reason: string): void`
- `reverse(reversalId: string): ReversalPlan`

#### Tipos relevantes

| Tipo | Archivo |
|---|---|
| `TransactionStatus` (enum: PENDING, CONFIRMED, VOIDED) | `domain/transaction/transaction-status.ts` |
| `TransactionAnnotations { payee, description, invoiceUrl, tags, metadata }` | `domain/transaction/transaction-annotations.type.ts` |
| `PostingLine { accountId, amount, metadata }` | `domain/posting/posting-line.ts` |
| `PostingInput { accountId, amount, currency, metadata? }` | `application/posting-input.type.ts` |
| `RecordTransactionArgs` | `domain/transaction/ledger-transaction.aggregate.ts` |
| `ReversalPlan { reversalId, sourceTransactionId, date, postings, description }` | `domain/transaction/ledger-transaction.aggregate.ts` |

#### Balance

| Archivo | Clase |
|---|---|
| `domain/balance/balance-rule.ts` | `abstract class BalanceRule` — `abstract ensureBalanced(postings: readonly PostingLine[]): void` |
| `domain/balance/zero-sum-balance-rule.ts` | `class ZeroSumBalanceRule extends BalanceRule` — suma por moneda, lanza `UnbalancedTransactionException` si alguna no es cero |

#### Eventos de dominio

| Evento | Props |
|---|---|
| `TransactionRecorded` | `{ transactionId, date, payee, description, status, invoiceUrl, tags, postings, metadata }` |
| `TransactionAmended` | `{ date, postings: PostingLine[] }` |
| `TransactionAnnotated` | `{ annotations: TransactionAnnotations }` |
| `TransactionConfirmed` | `{ confirmedAt: string }` |
| `TransactionVoided` | `{ reason: string }` |
| `TransactionReversed` | `{ reversalTransactionId: string }` |

#### Handlers

| Archivo | Handler | Deps |
|---|---|---|
| `application/record-transaction/record-transaction.handler.ts` | `RecordTransactionHandler` | `LedgerTransactionRepository`, `AccountValidationService`, `CurrencyCatalog`, `BalanceRule`, `IdGenerator`, `ProjectionDispatcher` |
| `application/confirm-transaction/confirm-transaction.handler.ts` | `ConfirmTransactionHandler` | `LedgerTransactionRepository`, `Clock`, `ProjectionDispatcher` |
| `application/amend-transaction/amend-pending-transaction.handler.ts` | `AmendPendingTransactionHandler` | `LedgerTransactionRepository`, `AccountValidationService`, `CurrencyCatalog`, `BalanceRule`, `ProjectionDispatcher` |
| `application/annotate-transaction/annotate-transaction.handler.ts` | `AnnotateTransactionHandler` | `LedgerTransactionRepository`, `ProjectionDispatcher` |
| `application/void-transaction/void-pending-transaction.handler.ts` | `VoidPendingTransactionHandler` | `LedgerTransactionRepository`, `ProjectionDispatcher` |
| `application/reverse-transaction/reverse-confirmed-transaction.handler.ts` | `ReverseConfirmedTransactionHandler` | `LedgerTransactionRepository`, `BalanceRule`, `IdGenerator`, `ProjectionDispatcher` |

#### Repositorio

**Archivo:** `application/ledger-transaction.repository.ts` — `class LedgerTransactionRepository extends EventSourcedRepository<LedgerTransaction>`, `aggregateType = 'LedgerTransaction'`

#### Excepciones (transactions)

**Archivo:** `domain/transaction/exceptions/transaction.exception.ts`
- `TransactionNotFoundException extends DomainNotFoundException` — code `TRANSACTION_NOT_FOUND`
- `UnbalancedTransactionException extends DomainUnprocessableException` — code `UNBALANCED_TRANSACTION`
- `InsufficientPostingsException extends DomainUnprocessableException` — code `INSUFFICIENT_POSTINGS`
- `ImmutableTransactionException extends DomainConflictException` — code `IMMUTABLE_TRANSACTION`
- `InvalidTransactionStateException extends DomainConflictException` — code `INVALID_TRANSACTION_STATE`

### Event Store (shared-kernel)

`D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\`

#### Puerto

**Archivo:** `domain/ports/event-store.ts`
```typescript
abstract class EventStore {
  abstract append(stream: StreamId, expectedVersion: number, events: readonly EventEnvelope[]): Promise<AppendResult>;
  abstract load(stream: StreamId): Promise<readonly StoredEvent[]>;
  abstract readAll(fromPosition: bigint, limit: number): Promise<readonly StoredEvent[]>;
  abstract findByExternalRef(userId: string, externalRef: string): Promise<Nullable<StoredEvent>>;
}
```

#### Tipos

| Tipo | Archivo |
|---|---|
| `StreamId { userId, aggregateType, aggregateId }` | `domain/event/stream-id.type.ts` |
| `EventEnvelope { eventId, userId, aggregateType, aggregateId, sequence, eventType, schemaVersion, clientId, externalRef, payload, occurredAt, recordedAt }` | `domain/event/event-envelope.type.ts` |
| `AppendResult { events, version, lastPosition }` | `domain/event/append-result.type.ts` |
| `StoredEvent = EventEnvelope & { globalPosition: bigint }` | `domain/event/stored-event.type.ts` |

#### Excepciones

**Archivo:** `domain/exceptions/event-store.exception.ts`
- `ConcurrencyConflictException extends DomainConflictException` — code `CONCURRENCY_CONFLICT`
- `DuplicateExternalRefException extends DomainConflictException` — code `DUPLICATE_EXTERNAL_REF`

#### Repositorio base

**Archivo:** `application/event-sourced.repository.ts`
```typescript
abstract class EventSourcedRepository<TAggregate extends AggregateRoot<string>> {
  protected abstract readonly aggregateType: string;
  constructor(protected readonly eventStore: EventStore, protected readonly registry: EventRegistry, protected readonly envelopes: EnvelopeFactory) {}
  protected abstract rehydrate(id: string, events: readonly DomainEvent[]): TAggregate;
  async load(userId: string, aggregateId: string): Promise<Nullable<TAggregate>>
  async save(aggregate: TAggregate, ctx: AuthContext): Promise<AppendResult>
}
```

### Jerarquía de excepciones (`libs/shared`)

`D:\Cristian\Nest\admin-back\libs\shared\src\exceptions\`

| Clase | Archivo | HTTP Status | Code |
|---|---|---|---|
| `abstract BaseException extends Error` | `base.exception.ts` | — | — |
| `abstract DomainException extends BaseException` | `domain.exception.ts` | — | — |
| `DomainConflictException extends DomainException` | `domain-conflict.exception.ts` | 409 | `CONFLICT` |
| `DomainUnprocessableException extends DomainException` | `domain-unprocessable.exception.ts` | 422 | `UNPROCESSABLE_ENTITY` |
| `DomainNotFoundException extends DomainException` | `domain-not-found.exception.ts` | 404 | `NOT_FOUND` |

### NestJS wiring

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\ledger\ledger-core.module.ts`

- `@Global()` `@Module`
- Providers: `Clock` → `SystemClock`, `IdGenerator` → `UuidIdGenerator`, `CurrencyCatalog` → `SeedCurrencyCatalog`, `EventStore` → `PostgresEventStore`, `ReadModelStore` → `PostgresReadModelStore`, `CommandBus` (via `useFactory` → `createLedgerApplication`), `QueryBus` (via `useFactory`)
- Exports: `CommandBus`, `QueryBus`, `EventStore`, `ReadModelStore`, `CurrencyCatalog`, `Clock`, `IdGenerator`

### Documentación disponible

- `apps/ledger/docs/shared-kernel/component.md` — EventStore, ReadModelStore, Projector, ProjectionDispatcher, repositorios
- `apps/ledger/docs/shared-kernel/diagram.md` — diagramas de secuencia de proyección
- `apps/ledger/docs/accounts/component.md` — Account aggregate, handlers, excepciones
- `apps/ledger/docs/accounts/diagram.md` — diagramas de secuencia de accounts
- `apps/ledger/docs/accounts/api.yaml` — OpenAPI spec
- `apps/ledger/docs/transactions/component.md` — LedgerTransaction aggregate, handlers, excepciones
- `apps/ledger/docs/transactions/diagram.md` — diagramas de secuencia de transactions
- `apps/ledger/docs/transactions/api.yaml` — OpenAPI spec (duplicado de accounts)

---

## Gaps detectados

1. **Sin documentación de `ledger` (settings/initialize).** `apps/ledger/docs/` no tiene carpeta `ledger/` con `component.md`/`diagram.md` para el módulo `ledger` (InitializeLedger, LedgerSettings aggregate). Los módulos `accounts/` y `transactions/` sí tienen docs completos.
2. **`apps/ledger/docs/transactions/api.yaml` es un duplicado exacto de `apps/ledger/docs/accounts/api.yaml`** — ambos contienen la misma especificación de `CommandAccepted`, pero transactions debería tener sus propios endpoints.
3. **Los handlers `RenameAccount` y `CloseAccount` existen pero no son requeridos por hu-0005** (están fuera del alcance de los 8 handlers núcleo). Se documentan igual por completitud.

---

## Resumen de cobertura

**Todos los artefactos descritos en hu-0005 ya existen en el código base.** El command bus (`PolicyCommandBus`), las 3 políticas (`AuthenticatedContextPolicy`, `IdempotencyPolicy`, `OptimisticConcurrencyPolicy`), los 8 handlers núcleo, todas las excepciones de dominio, y el wiring en `createLedgerApplication()` están implementados y cableados en `LedgerCoreModule`.
