# context: hu-0006

## Historia resumida

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** los proyectores `transaction_list` (+ `proj_postings`) y `account_balances`, junto con el query bus y sus handlers (`get-account-tree`, `get-account-balance`, `list-transactions`)
**Para** poder consultar el estado completo del ledger (árbol de cuentas, saldos, listado de transacciones filtrable) desde las proyecciones, cerrando el lado de lectura de EP-1

> **Tipo de historia:** Verificación y documentación. Todo el código ya existe — construido en el flujo anteror de EP-1. El objetivo es verificar que cumple los AC, documentarlo y corregir los gaps detectados.

## Apps / libs afectados

- `apps/ledger`

---

## apps/ledger

### shared-kernel — Infraestructura de proyecciones

#### Projector (abstract)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\projection\projector.ts`
- `abstract readonly name: string`
- `abstract readonly consumes: readonly string[]` — event types que maneja
- `abstract project(event: StoredEvent, store: ReadModelStore): Promise<void>`
- Método concreto: `handles(eventType: string): boolean`

#### ReadModelStore (abstract)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\projection\read-model-store.ts`
- `abstract upsert(table: string, key: ReadModelKey, row: ReadModelRow): Promise<void>`
- `abstract delete(table: string, key: ReadModelKey): Promise<void>`
- `abstract query<TRow>(table: string, criteria: Criteria): Promise<TRow[]>`
- `abstract truncate(table: string): Promise<void>`
- Tipos: `ReadModelKey = Record<string, string>`, `ReadModelRow = Record<string, unknown>`

#### ProjectionDispatcher (abstract)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\projection\projection-dispatcher.ts`
- `abstract dispatch(events: readonly StoredEvent[]): Promise<void>`

#### ProjectionCheckpointRepository (abstract)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\projection\projection-checkpoint.repository.ts`
- `abstract lastPosition(projectionName: string): Promise<bigint>`
- `abstract advance(projectionName: string, position: bigint): Promise<void>`

#### InMemoryReadModelStore
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\read-model-store\in-memory\in-memory-read-model-store.ts`
- Clase: `InMemoryReadModelStore extends ReadModelStore`
- Almacena `Map<string, Map<string, ReadModelRow>>` por tabla

#### SynchronousProjectionDispatcher
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\projection\synchronous-dispatcher.ts`
- `constructor(projectors: readonly Projector[], store: ReadModelStore)`
- Itera eventos → para cada proyector chequea `handles()` → llama `project(event, store)`

#### StoredEvent
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\event\stored-event.type.ts`
- `EventEnvelope & { readonly globalPosition: bigint }`
- `EventEnvelope`: `eventId`, `userId`, `aggregateType`, `aggregateId`, `sequence`, `eventType`, `schemaVersion`, `clientId`, `externalRef`, `payload`, `occurredAt`, `recordedAt`

### shared-kernel — Query bus (YA EXISTE)

#### Query (abstract)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\query-bus\query.ts`
- `abstract readonly queryType: string`

#### QueryHandler (abstract)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\query-bus\query-handler.ts`
- `abstract execute(query: TQuery extends Query, ctx: QueryContext): Promise<TResult>`
- `QueryContext = { readonly userId: string }`

#### QueryBus (abstract + concrete)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\query-bus\query-bus.ts`
- `abstract class QueryBus`: `abstract ask<TResult>(query: Query, ctx: QueryContext): Promise<TResult>`
- `class RegistryQueryBus extends QueryBus`: `register(queryType, handler)`, `ask(query, ctx)`
- `class UnregisteredQueryException extends DomainUnprocessableException` (code: `'UNREGISTERED_QUERY'`)

### Command bus (patrón de referencia)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\command-bus\command-bus.ts`
- `AuthContext = { userId: string, clientId: string, externalRef: Nullable<string> }`
- `CommandBus.dispatch(command, ctx): Promise<CommandResult>`
- `PolicyCommandBus` con cadena de políticas: `AuthenticatedContextPolicy` → `IdempotencyPolicy` → `OptimisticConcurrencyPolicy`

### Criteria (@shared)
**Archivo:** `D:\Cristian\Nest\admin-back\libs\shared\src\criteria\criteria.ts`
- `Criteria<TField extends string = string>` — builder inmutable
- Métodos: `none()`, `equals(field, value)`, `contains(field, value)`, `between(field, from, to)`, `orderBy(field, type)`, `limitTo(take)`, `paginate(input)`
- Operadores: EQUAL, NOT_EQUAL, GT, LT, GTE, LTE, BETWEEN, CONTAINS, IN, IS_NULL, IS_NOT_NULL

---

### transactions — Proyector transaction_list (EXISTE)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\infrastructure\projections\transaction-list.projector.ts`
**Clase:** `TransactionListProjector extends Projector`
**Nombre:** `'transaction_list'`
**Tablas:** `proj_transactions` (20 columnas), `proj_postings` (9 columnas)
**Eventos que consume:** `TransactionRecorded`, `TransactionAmended`, `TransactionAnnotated`, `TransactionConfirmed`, `TransactionVoided`

**Campos de `proj_transactions` (`TransactionRow`):**
- `transaction_id: string`, `user_id: string`, `date: string`, `occurred_at: string`
- `payee: Nullable<string>`, `description: string`, `status: string`, `derived_kind: string`
- `invoice_url: Nullable<string>`, `tags: readonly string[]`, `client_id: string`
- `external_ref: Nullable<string>`, `reverses_id: Nullable<string>`, `metadata: Record<string, string>`

**Campos de `proj_postings` (`PostingRow`):**
- `posting_id: string` (formado como `${transaction_id}#${index}`)
- `transaction_id: string`, `user_id: string`, `account_id: string`
- `amount: string`, `currency_code: string`, `status: string`, `date: string`
- `metadata: Record<string, string>`

**Comportamiento:**
- `onRecorded`: inserta `TransactionRow` + escribe postings, deriva `derived_kind` desde `account_tree`
- `onAmended`: actualiza date y postings, re-deriva `derived_kind`
- `onAnnotated`: actualiza payee, description, invoiceUrl, tags, metadata
- `onStatus`: actualiza status en transacción y en todos sus postings
- `deriveKind`: consulta `proj_accounts` por userId → obtiene tipos de cuenta de los postings → delega a `TransactionKindDeriver.derive(types)`. Si una cuenta no está en `account_tree`, simplemente no contribuye al array → puede resultar en `COMPOUND` (comportamiento correcto según AC-2)

### transactions — Proyector account_balances (EXISTE)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\infrastructure\projections\account-balances.projector.ts`
**Clase:** `AccountBalancesProjector extends Projector`
**Nombre:** `'account_balances'`
**Tabla:** `proj_balances`
**Eventos que consume:** `TransactionRecorded`, `TransactionAmended`, `TransactionConfirmed`, `TransactionVoided`
**Orden:** Debe ejecutarse después de `transaction_list` (consume de `proj_postings`)

**Campos de `proj_balances`:**
- `account_id: string`, `currency_code: string`
- `confirmed_amount: string`, `pending_amount: string`, `updated_at: string`

**Comportamiento:**
- `project(event)`: obtiene pares `(accountId, currencyCode)` afectados desde `proj_postings` → para cada par, `recompute` suma montos confirmados y pendientes por separado → upsert en `proj_balances`
- INV-5: balances son solo proyección, ningún command los escribe
- Recomputación desde `proj_postings` garantiza idempotencia en replay/rebuild (AC-4)

### TransactionKindDeriver
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\domain\derivation\transaction-kind.deriver.ts`
- `derive(accountTypes: readonly AccountType[]): DerivedKind`
- Logic: solo EXPENSES → EXPENSE; solo INCOME → INCOME; solo ASSETS/LIABILITIES → TRANSFER; resto → COMPOUND

### DerivedKind
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\domain\derivation\derived-kind.ts`
- Valores: `EXPENSE`, `INCOME`, `TRANSFER`, `COMPOUND`

### Eventos de dominio de LedgerTransaction (YA EXISTEN)

| Evento | Archivo | Campos clave |
|---|---|---|
| `TransactionRecorded` | `.../events/transaction-recorded.event.ts` | transactionId, date, payee, description, status, invoiceUrl, tags, postings, metadata |
| `TransactionAmended` | `.../events/transaction-amended.event.ts` | date, postings |
| `TransactionAnnotated` | `.../events/transaction-annotated.event.ts` | annotations (payee, description, invoiceUrl, tags, metadata) |
| `TransactionConfirmed` | `.../events/transaction-confirmed.event.ts` | confirmedAt |
| `TransactionVoided` | `.../events/transaction-voided.event.ts` | reason |
| `TransactionReversed` | `.../events/transaction-reversed.event.ts` | reversalTransactionId |

**Path raíz eventos:** `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\domain\transaction\events\`

### LedgerTransaction aggregate
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\domain\transaction\ledger-transaction.aggregate.ts`
- Estados reconstruidos: `txStatus: TransactionStatus`, `txPostings: PostingLine[]`, `txDate: LedgerDate`, `annotations: TransactionAnnotations`, `reversed: boolean`
- `TransactionStatus`: `PENDING`, `CONFIRMED`, `VOIDED`

---

### accounts — Proyector account_tree (referencia, de hu-0004)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\accounts\infrastructure\projections\account-tree.projector.ts`
**Clase:** `AccountTreeProjector extends Projector`
**Nombre:** `'account_tree'`
**Tabla:** `proj_accounts` (constante `PROJ_ACCOUNTS`)
**Eventos:** `AccountOpened`, `AccountRenamed`, `AccountClosed`
**Campos `AccountRow`:** `account_id`, `user_id`, `type`, `name`, `parent_id`, `currency_code`, `opened_on`, `closed_on`, `is_bank_mirror`, `is_system`

---

### read-side — Query bus factory (YA EXISTE)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\read-side\query-bus.factory.ts`
- `createQueryBus(readModel: ReadModelStore): QueryBus` — crea `RegistryQueryBus` y registra 6 handlers:

| queryType | Handler | Tabla(s) leída(s) | Scoped por userId |
|---|---|---|---|
| `ListTransactions` | `ListTransactionsHandler` | `proj_transactions` + `proj_postings` | Sí |
| `GetTransactionById` | `GetTransactionByIdHandler` | `proj_transactions` | Sí |
| `GetAccountTree` | `GetAccountTreeHandler` | `proj_accounts` | Sí |
| `GetAccountById` | `GetAccountByIdHandler` | `proj_accounts` | Sí |
| `GetAccountBalances` | `GetAccountBalancesHandler` | `proj_balances` (intersectado con `proj_accounts`) | Sí |
| `GetLedgerSettings` | `GetLedgerSettingsHandler` | `proj_ledger_settings` | Sí |

### read-side — Handlers (YA EXISTEN)

#### GetAccountTreeHandler
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\read-side\get-account-tree\get-account-tree.handler.ts`
- Lee `proj_accounts` filtrado por `user_id` del contexto, ordenado por `name ASC`
- Query: `GetAccountTreeQuery` (sin filtros adicionales)

#### GetAccountBalancesHandler
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\read-side\get-account-balances\get-account-balances.handler.ts`
- Obtiene cuentas del usuario desde `proj_accounts` → lee todos los balances → filtra por cuentas owned + accountId opcional
- Query: `GetAccountBalancesQuery(accountId?: string)`
- AC-7: devuelve saldo confirmado y pendiente por moneda

#### ListTransactionsHandler
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\read-side\list-transactions\list-transactions.handler.ts`
- Query: `ListTransactionsQuery` con filtros: `accountId`, `status`, `derivedKind`, `payee`, `fromDate`, `toDate`, `limit`
- El filtro `accountId` se aplica en memoria (post-filtro contra `proj_postings`)
- Paginación: usa `limitTo(take)` (hard cap), no `paginate(input)` con offset
- Filtro `userId` del contexto + filtros opcionales combinados en un `Criteria`

#### ListTransactionsQuery
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\read-side\list-transactions\list-transactions.query.ts`
- Campos: `accountId`, `status`, `derivedKind`, `payee`, `fromDate`, `toDate`, `limit`
- `queryType = 'ListTransactions'`

---

### Composition root (write side)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\ledger\application\ledger-application.factory.ts`
- `createLedgerApplication(deps)`:
  1. Crea 4 proyector instances (ordenados): `AccountTreeProjector` → `TransactionListProjector` → `AccountBalancesProjector(catalog)` → `LedgerSettingsProjector`
  2. Crea `SynchronousProjectionDispatcher(projectors, readModel)`
  3. Crea `PolicyCommandBus` con 3 políticas
  4. Registra 10 command handlers con `dispatcher` inyectado para dispatch síncrono
  5. Retorna `{ commandBus, projectors, dispatcher }`

### NestJS wiring

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\ledger\ledger-core.module.ts`
- `@Global()` — un módulo para todo EP-1
- Providers: `Clock → SystemClock`, `IdGenerator → UuidIdGenerator`, `CurrencyCatalog → SeedCurrencyCatalog`, `EventStore → PostgresEventStore`, `ReadModelStore → PostgresReadModelStore`
- `CommandBus` via `useFactory` → `createLedgerApplication(...).commandBus`
- `QueryBus` via `useFactory` → `createQueryBus(readModel)`
- Exports: `CommandBus`, `QueryBus`, `EventStore`, `ReadModelStore`, `CurrencyCatalog`, `Clock`, `IdGenerator`

### Uso desde HTTP controllers (patrón)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\accounts\infrastructure\adapters\http\accounts.controller.ts`
- Inyecta `CommandBus` y `QueryBus`
- `this.queryBus.ask<ResultType>(query, { userId: context.userId })`

### Tests existentes

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\read-side\query-bus.spec.ts`
- Suite de integración: crea `InMemoryEventStore` + `InMemoryReadModelStore`, ejecuta commands via `createLedgerApplication`, consulta via `createQueryBus`
- 3 tests: listar transacciones, obtener árbol de cuentas, obtener balances

---

## Documentación disponible

| Artefacto | Path |
|---|---|
| transactions module README | `apps/ledger/docs/transactions/README.md` |
| accounts module README | `apps/ledger/docs/accounts/README.md` |
| shared-kernel component diagram | `apps/ledger/docs/shared-kernel/component.md` |
| transactions C4 (LikeC4) | `apps/ledger/docs/transactions/transactions.c4` |
| accounts C4 (LikeC4) | `apps/ledger/docs/accounts/accounts.c4` |
| transactions OpenAPI | `apps/ledger/docs/transactions/api.yaml` |
| accounts OpenAPI | `apps/ledger/docs/accounts/api.yaml` |
| Flows (transactions) | `apps/ledger/docs/transactions/flows/` |
| Flows (accounts) | `apps/ledger/docs/accounts/flows/` |

---

## Gaps detectados

### G1: `TransactionReversed` no es consumido por ningún proyector
El evento `TransactionReversed` existe (`transaction-reversed.event.ts`) pero ni `TransactionListProjector` ni `AccountBalancesProjector` lo incluyen en su array `consumes`. AC-1 y AC-3 lo mencionan explícitamente como evento a consumir. Una reversión no actualiza status ni balances en las proyecciones actuales.

### G2: `ListTransactionsQuery` no tiene filtro `client_id`
AC-6 pide filtros por `client_id`, pero el campo no existe en `ListTransactionsQuery` ni se aplica en el handler. El `client_id` sí está en el `StoredEvent` y se persiste en `proj_transactions.client_id`.

### G3: `TransfersMerged` no existe como evento de dominio
AC-1 lo menciona como evento futuro ("cuando exista"), pero no hay archivo de evento ni lógica de merge de transferencias. Esto es esperable — es un evento de una historia futura.

### G4: Paginación usa `limitTo()`, no `paginate()` con offset
AC-6 pide "paginación" sobre `Criteria`, pero `ListTransactionsHandler` usa `limitTo()` (hard cap sin offset). `Criteria` soporta `paginate(input)` que incluye `offset` y `limit`, pero no se usa.

### G5: `PostgresReadModelStore.upsert` tiene firma inconsistente
El método concreto (`postgres-read-model-store.ts:16`) tiene firma `upsert(table, row)` sin el parámetro `key` que requiere la clase abstracta `ReadModelStore`. Esto es un bug o desviación intencional; puede causar fallos si no hay `ON CONFLICT` correcto.

### G6: Sin documentación de flows para los queries del read-side
Los flujos documentados en `apps/ledger/docs/` cubren los commands (write side), pero los queries del read-side (`list-transactions`, `get-account-tree`, `get-account-balances`) no tienen archivos de flujo ni están en el OpenAPI.

### G7: Sin entidades TypeORM para tablas `proj_*`
Las tablas del read model no tienen entidades TypeORM — se crean/consultan vía `ReadModelStore` con SQL raw. Esto es por diseño (schema-on-read), pero puede ser un gap si se esperan migraciones o entidades formales.
