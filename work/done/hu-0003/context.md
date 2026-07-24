# context: hu-0003

## Historia resumida

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** los agregados event-sourced `Account` (apertura, renombre, cierre) y
`LedgerTransaction` (registro, enmienda, anotación, confirmación, anulación, reversa) con sus
invariantes de dominio protegidas
**Para** tener el ciclo de vida contable completo modelado en el dominio puro, probado sobre
`InMemoryEventStore`, antes de exponerlo a través de commands (§9.4)

## Microservicios afectados

- `apps/ledger`

---

## apps/ledger

### Módulos afectados

- `apps/ledger/src/accounts/` — Agregado `Account`
- `apps/ledger/src/transactions/` — Agregado `LedgerTransaction`
- `apps/ledger/src/shared-kernel/` — Base `AggregateRoot`, `EventStore`, `EventSourcedRepository`, value objects
- `apps/ledger/src/shared/` — Puertos `Clock`, `IdGenerator`
- `libs/shared/` — Jerarquía `DomainException`

### Agregado `Account`

**Archivo:** `apps/ledger/src/accounts/domain/account/account.aggregate.ts`
**Métodos:**
- `static open(id, name, type, currencies, openedOn): Account` — emite `AccountOpened`
- `rename(newName): void` — emite `AccountRenamed`; rechaza `RootTypeImmutableException` si cambia raíz; rechaza `SystemAccountProtectedException` si `isSystem`
- `close(closedOn): void` — emite `AccountClosed`; rechaza `SystemAccountProtectedException` si `isSystem`
- `ensureOpenOn(date): void` — valida fecha entre apertura y cierre
- `ensureAcceptsCurrency(code): void` — valida moneda permitida
- `static rehydrate(id, events): Account` — reconstruye desde historial

**Eventos:**
- `AccountOpened` — `apps/ledger/src/accounts/domain/account/events/account-opened.event.ts`
- `AccountRenamed` — `apps/ledger/src/accounts/domain/account/events/account-renamed.event.ts`
- `AccountClosed` — `apps/ledger/src/accounts/domain/account/events/account-closed.event.ts`

**Excepciones:**
- `apps/ledger/src/accounts/domain/account/exceptions/account.exception.ts` — 7 excepciones (SystemAccountProtectedException, AccountAlreadyClosedException, etc.)

**Repositorio:** `apps/ledger/src/accounts/application/account.repository.ts` — extiende `EventSourcedRepository<Account>`

**Handlers (application):**
- `apps/ledger/src/accounts/application/open-account/open-account.handler.ts`
- `apps/ledger/src/accounts/application/rename-account/rename-account.handler.ts`
- `apps/ledger/src/accounts/application/close-account/close-account.handler.ts`

**Controlador HTTP:** `apps/ledger/src/accounts/infrastructure/adapters/http/accounts.controller.ts`
**DTOs HTTP:** `apps/ledger/src/accounts/infrastructure/adapters/http/dto/` — AccountDto, OpenAccountRequestDto, RenameAccountRequestDto, CloseAccountRequestDto, etc.

### Agregado `LedgerTransaction`

**Archivo:** `apps/ledger/src/transactions/domain/transaction/ledger-transaction.aggregate.ts`
**Métodos:**
- `static record(id, ...): LedgerTransaction` — emite `TransactionRecorded`; valida ≥2 postings (INV-2), balanceo por moneda vía `BalanceRule` (INV-1/INV-11); admite estado inicial PENDING o CONFIRMED
- `amend(postings, date): void` — emite `TransactionAmended`; solo en PENDING; re-valida INV-1/INV-2
- `annotate(payee, description, invoiceUrl, tags, metadata): void` — emite `TransactionAnnotated`; cualquier estado salvo VOIDED
- `confirm(): void` — `PENDING → CONFIRMED`; rechaza si ya CONFIRMED o VOIDED
- `void(reason): void` — solo PENDING
- `reverse(reversalId, clock): ReversalPlan` — solo CONFIRMED; emite `TransactionReversed`; devuelve plan con postings invertidos
- `static rehydrate(id, events): LedgerTransaction` — reconstruye desde historial

**Estado:** `TransactionStatus` enum — PENDING | CONFIRMED | VOIDED
**Archivo:** `apps/ledger/src/transactions/domain/transaction/transaction-status.ts`

**Eventos:**
- `apps/ledger/src/transactions/domain/transaction/events/transaction-recorded.event.ts`
- `apps/ledger/src/transactions/domain/transaction/events/transaction-amended.event.ts`
- `apps/ledger/src/transactions/domain/transaction/events/transaction-annotated.event.ts`
- `apps/ledger/src/transactions/domain/transaction/events/transaction-confirmed.event.ts`
- `apps/ledger/src/transactions/domain/transaction/events/transaction-voided.event.ts`
- `apps/ledger/src/transactions/domain/transaction/events/transaction-reversed.event.ts`

**Componente `BalanceRule`:**
- `apps/ledger/src/transactions/domain/balance/balance-rule.ts` — abstract class
- `apps/ledger/src/transactions/domain/balance/zero-sum-balance-rule.ts` — implementación INV-1
- `apps/ledger/src/transactions/domain/balance/zero-sum-balance-rule.spec.ts`

**Value objects de Posting:**
- `apps/ledger/src/transactions/domain/posting/posting-line.ts` — PostingLine value object
- `apps/ledger/src/transactions/domain/posting/posting.serializer.ts`

**Repositorio:** `apps/ledger/src/transactions/application/ledger-transaction.repository.ts` — extiende `EventSourcedRepository<LedgerTransaction>`

**Handlers (application):**
- `apps/ledger/src/transactions/application/record-transaction/record-transaction.handler.ts`
- `apps/ledger/src/transactions/application/amend-transaction/amend-pending-transaction.handler.ts`
- `apps/ledger/src/transactions/application/annotate-transaction/annotate-transaction.handler.ts`
- `apps/ledger/src/transactions/application/confirm-transaction/confirm-transaction.handler.ts`
- `apps/ledger/src/transactions/application/void-transaction/void-pending-transaction.handler.ts`
- `apps/ledger/src/transactions/application/reverse-transaction/reverse-confirmed-transaction.handler.ts`

**Controlador HTTP:** `apps/ledger/src/transactions/infrastructure/adapters/http/transactions.controller.ts`
**DTOs HTTP:** `apps/ledger/src/transactions/infrastructure/adapters/http/dto/` — TransactionDto, RecordTransactionRequestDto, AmendTransactionRequestDto, etc.

### Shared Kernel (infraestructura base)

**Archivo:** `apps/ledger/src/shared-kernel/domain/aggregate/aggregate-root.ts`
- Base `AggregateRoot<TId>`: `version`, `pullChanges()`, `loadFromHistory(events)`, `raise(event)`, `apply(event)` (abstracto)

**Archivo:** `apps/ledger/src/shared-kernel/application/event-sourced.repository.ts`
- `EventSourcedRepository<TAggregate>`: `load(userId, id)`, `save(aggregate, ctx)`

**Implementaciones de EventStore:**
- `apps/ledger/src/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store.ts`
- `apps/ledger/src/shared-kernel/infrastructure/adapters/event-store/postgres/postgres-event-store.ts`

**Value objects:**
- `apps/ledger/src/shared-kernel/domain/value-objects/account-name.ts` — AccountName (jerárquico, colon-separated)
- `apps/ledger/src/shared-kernel/domain/value-objects/account-type.ts` — AccountType enum (ASSETS, LIABILITIES, INCOME, EXPENSES, EQUITY)
- `apps/ledger/src/shared-kernel/domain/value-objects/currency-code.ts` — CurrencyCode (ISO, uppercase)
- `apps/ledger/src/shared-kernel/domain/value-objects/ledger-date.ts` — LedgerDate (YYYY-MM-DD)
- `apps/ledger/src/shared-kernel/domain/value-objects/payee.ts` — Payee (nullable, max 255)

### Puertos compartidos

**Clock:**
- `apps/ledger/src/shared/domain/ports/clock.ts` — abstract `now(): Date`
- `apps/ledger/src/shared/infrastructure/system-clock.ts` — `SystemClock`
- `apps/ledger/src/shared/testing/fixed-clock.ts` — `FixedClock` (determinístico)

**IdGenerator:**
- `apps/ledger/src/shared/domain/ports/id-generator.ts` — abstract `next(): string`
- `apps/ledger/src/shared/infrastructure/uuid-id-generator.ts` — `UuidIdGenerator`
- `apps/ledger/src/shared/testing/sequential-id-generator.ts` — `SequentialIdGenerator`

### Jerarquía DomainException (@shared)

**Archivo:** `libs/shared/src/exceptions/`
- `BaseException` → `DomainException` (abstract, status) → `DomainConflictException` (409) / `DomainNotFoundException` (404) / `DomainUnprocessableException` (422)

### Module wiring

**Archivo:** `apps/ledger/src/app.module.ts`
**Imports relevantes:**
- `LedgerCoreModule` — CommandBus, QueryBus, EventStore, ReadModelStore
- `AccountsHttpModule` — controladores HTTP de Account
- `TransactionsHttpModule` — controladores HTTP de Transaction

### Documentación disponible

- `apps/ledger/docs/shared-kernel/component.md` — C4 Level 3 del shared-kernel (EventStore, EventSourcedRepository, etc.)
- `apps/ledger/docs/shared-kernel/diagram.md` — Diagrama de secuencia de EventSourcedRepository.save()
- Sin documentación para `accounts/` o `transactions/` en `apps/ledger/docs/`

### Patrón de inyección (use case de referencia)

```typescript
// RecordTransactionHandler
constructor(
  private readonly repository: LedgerTransactionRepository,
  private readonly balanceRule: BalanceRule,
  private readonly accountLookup: AccountLookupPort,
  private readonly idGenerator: IdGenerator,
  private readonly clock: Clock,
) {}
```

---

## Gaps detectados

- Sin documentación en `apps/ledger/docs/accounts/` ni `apps/ledger/docs/transactions/` — solo existe `shared-kernel/`
- El agregado `Account` y `LedgerTransaction` ya están implementados; la historia describe su construcción, lo que sugiere que el código actual ya cubre el alcance
