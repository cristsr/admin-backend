# context: refactor-read-side-ports

Relevamiento del read side completo de `apps/ledger` (37 archivos tocan
`ReadModelStore`). Todo lo de acá está verificado contra el código, no inferido.

## Microservicios afectados

- `apps/ledger` — los 5 módulos.
- `libs/cqrs` — **sin cambios**. `ReadModelStore` conserva su contrato y su rol.

---

## El patrón a generalizar (ya existe)

`reconciliation` ya usa puerto + adapter. Son la plantilla exacta:

- Puerto: `apps/ledger/src/reconciliation/application/ports/assertion-status-store.port.ts`
- Adapter: `apps/ledger/src/reconciliation/infrastructure/adapters/persistence/read-model-assertion-status-reader.ts`
- Contract test: `apps/ledger/src/reconciliation/infrastructure/testing/assertion-status-store.contract.ts`
- Contract contra Postgres: `apps/ledger/src/reconciliation/infrastructure/adapters/persistence/read-model-readers.postgres.spec.ts`
- Binding: `reconciliation.module.ts` → `{ provide: AssertionStatusStore, useClass: ReadModelAssertionStatusReader }`

Otros dos ya conformes: `transactions/application/ports/account-lookup.port.ts` +
`read-model-account-lookup.ts`, y `reference/application/ports/currency-catalog.cache.ts`.

---

## Consumidores de `ReadModelStore` desde `application/` — lo que hay que migrar

### Query handlers (8)

| Handler | Tabla(s) | Puerto destino |
|---|---|---|
| `accounts/…/get-account-tree/get-account-tree.handler.ts` | `proj_accounts` | `AccountTreeFinder` |
| `accounts/…/get-account-by-id/get-account-by-id.handler.ts` | `proj_accounts` | `AccountTreeFinder` |
| `accounts/…/get-account-balances/get-account-balances.handler.ts` | `proj_balances` + `proj_accounts` | `AccountBalanceFinder` |
| `transactions/…/list-transactions/list-transactions.handler.ts` | `proj_transactions` + `proj_postings` | `TransactionFinder` |
| `transactions/…/get-transaction-by-id/get-transaction-by-id.handler.ts` | `proj_transactions` + `proj_postings` | `TransactionFinder` |
| `transactions/…/list-pending-review/list-pending-review.handler.ts` | `proj_pending_review` | `PendingReviewFinder` |
| `ledger/…/get-ledger-settings/get-ledger-settings.handler.ts` | `proj_ledger_settings` | `LedgerSettingsFinder` |
| `reference/…/list-currencies/list-currencies.handler.ts` | `proj_currencies` | `CurrencyCatalogFinder` |

### Servicios de aplicación y command handler (3)

| Consumidor | Tabla | Puerto destino |
|---|---|---|
| `accounts/application/services/account-validation.service.ts` | `proj_accounts` | `AccountConstraintsReader` |
| `accounts/application/services/account-name.registry.ts` | `proj_accounts` | `AccountNameReader` |
| `accounts/…/record-opening-balance/record-opening-balance.handler.ts` | `proj_ledger_settings` | `SystemAccountLookup` |

`RecordOpeningBalanceHandler` es el **único command handler** que depende de
`ReadModelStore`.

---

## Deuda concreta a corregir (evidencia, no opinión)

- `get-account-balances.handler.ts:30` — `query(PROJ_BALANCES, Criteria.none())` trae la
  tabla completa de **todos los usuarios** y filtra por pertenencia en memoria.
  `proj_balances` no tiene `user_id`.
- `list-transactions.handler.ts:63` — trae todos los postings de una cuenta para armar un
  `Set` de ids que luego entra como `IN (...)` sin cota.
- `account-validation.service.ts:45` — trae todas las cuentas del usuario para validar 2
  postings.
- `account-name.registry.ts:28` — trae N filas para responder una pregunta booleana.
- `read-model-assertion-posting-reader.ts:60` — filtra `status` y `date` en memoria
  teniendo ambas columnas disponibles.
- `AccountRow` declarado 3 veces (`account-tree.read-model.ts:15`,
  `read-model-account-lookup.ts:6`, `consistency-verifier.ts`); `PostingRow` 2 veces
  (`transaction-list.read-model.ts:32` con 6 campos,
  `read-model-assertion-posting-reader.ts:16` con 7). La tabla tiene 10 columnas.
- `list-currencies.handler.ts:9` — declara su `CurrencyRow` dentro del propio handler.

---

## Read models actuales (a convertir en `views/` + `schema.ts`)

| Archivo actual | Contiene | Destino |
|---|---|---|
| `accounts/application/read-models/account-tree.read-model.ts` | `PROJ_ACCOUNTS`, `AccountRow`, `AccountView`, `toAccountView` | `accounts/application/views/account.view.ts` + `accounts/infrastructure/projections/account-tree.schema.ts` |
| `transactions/…/read-models/transaction-list.read-model.ts` | `PROJ_TRANSACTIONS`, `PROJ_POSTINGS`, `TransactionRow`, `PostingRow`, 3 `View`, 3 `to*View` | `transactions/application/views/transaction.view.ts` + `transactions/infrastructure/projections/transaction-list.schema.ts` |
| `transactions/…/read-models/account-balances.read-model.ts` | `PROJ_BALANCES`, `BalanceRow`, `BalanceView`, `toBalanceView` | `accounts/application/views/balance.view.ts` (el caso de uso vive en `accounts`) + `transactions/infrastructure/projections/account-balances.schema.ts` |
| `transactions/…/read-models/pending-review.read-model.ts` | `PROJ_PENDING_REVIEW`, `PendingReviewRow`, `PendingReviewView`, `toPendingReviewView` | `transactions/application/views/pending-review.view.ts` + `transactions/infrastructure/projections/pending-review.schema.ts` |
| `ledger/application/read-models/ledger-settings.read-model.ts` | `PROJ_LEDGER_SETTINGS`, `LedgerSettingsRow`, `LedgerSettingsView`, `toLedgerSettingsView` | `ledger/application/views/ledger-settings.view.ts` + `ledger/infrastructure/projections/ledger-settings.schema.ts` |
| `reference/application/read-models/currencies.read-model.ts` | sólo `PROJ_CURRENCIES` | `reference/infrastructure/projections/currencies.schema.ts` (+ `CurrencyView` que hoy está en `list-currencies.query.ts`) |
| `reconciliation/application/read-models/assertion-status.read-model.ts` | `AssertionStatusView`, `toAssertionStatusView` | `reconciliation/application/views/assertion-status.view.ts` (ya no tiene `PROJ_*` ni `Row`) |

`PROJ_ASSERTIONS`, `PROJ_ADJUSTMENT_AUDIT` y `PROJ_ADJUSTMENT_AUDIT_ENTRIES` ya están
declarados en sus projectors (`reconciliation/infrastructure/projections/`) — o sea,
`reconciliation` ya cumple R2 de facto.

---

## Esquema físico (DDL vigente)

`apps/ledger/src/database/migrations/1790000000003-CreateCoreProjections.ts`

- `proj_accounts` — PK `account_id`; UNIQUE `(user_id, name)`.
- `proj_transactions` — PK `transaction_id`; índices `(user_id, date)` y `(user_id, payee)`.
- `proj_postings` — PK `posting_id`; índices `(account_id, date)` y `(transaction_id)`.
  **Tiene** `user_id`, `status`, `date`, `occurred_at` — columnas que los `Row` de
  `application` no declaran.
- `proj_balances` — PK `(account_id, currency_code)`. **Sin `user_id`.** ← fase 0.

Otras: `…004-CreateLedgerSettingsProjection`, `…005-CreateReconciliationProjections`,
`…006-CreateCurrencyCatalogProjection`, `…007-CreatePendingReviewProjection`.

---

## Composición actual

- `bootstrap/query-bus.factory.ts:29` — `createQueryBus(readModel)` pasa el store a los 8
  query handlers. Cambia de firma.
- `bootstrap/ledger-application.factory.ts` — `LedgerApplicationDeps.readModel` llega a
  `AccountValidationService`, `AccountNameRegistry` y `RecordOpeningBalanceHandler`.
  El `readModel` **sigue entrando**: lo necesita `SynchronousProjectionDispatcher`.
- `reconciliation.module.ts` — ya registra sus queries en `onModuleInit` con sus puertos
  bindeados localmente. Es el modelo a seguir (fuera de alcance migrarlo).
- `accounts.module.ts` — hoy sin providers propios; gana 4 bindings.
- `transactions.module.ts` / `reference.module.ts` / `ledger-core.module.ts` — ganan
  bindings; ninguno cambia de estructura.

## Testing existente a preservar

- `apps/ledger/src/hexagonal-isolation.spec.ts` — el guard de fronteras; gana un caso.
- `apps/ledger/src/app.wiring.spec.ts` y `bootstrap/*.spec.ts` — verifican la composición.
- `libs/cqrs/src/infrastructure/testing/read-model-store.contract.ts` — cubre el store; no
  se toca.
- `apps/ledger/src/shared/testing/fixed-ledger-doubles.ts` — dobles de las composiciones
  in-memory.
- e2e: `accounts-api.e2e.spec.ts`, `transactions-api.e2e.spec.ts`,
  `reconciliation.discrepancy.e2e.spec.ts`, `transactions.merge-transfers.e2e.spec.ts`,
  `ledger-context.e2e.spec.ts`.
- Rebuild/consistencia: `tooling/projection-rebuilder.integration.spec.ts`,
  `tooling/consistency-verifier.spec.ts`, `reconciliation.rebuild.spec.ts`.
