# context: hu-0011

## Historia resumida

**Como** consumidor del API del ledger (frontend, sistema de correos)
**Quiero** que todo fallo de dominio o de puerto se reporte con un código estable y accionable
y un status HTTP consistente, con un cuerpo de error uniforme
**Para** poder reaccionar programáticamente a cada condición de error (RF-14) sin acoplarme a
mensajes de texto ni a detalles internos de la implementación

## Componentes afectados

- `ledger` (app) — objetivo principal
- `shared` (lib) — filter, jerarquía `DomainException` y `ErrorResponseBody` se reutilizan tal cual

---

## ledger

### Estado actual del bootstrap (AC-1 ya satisfecho)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\main.ts`
- Línea 7: `import { ExceptionFilter } from '@shared';`
- Línea 40: `app.useGlobalFilters(new ExceptionFilter());` — **el filter global ya está registrado**
  (con comentario que referencia EP-2.6).
- También: prefix global `api`, versionado URI v1, `ValidationPipe({ transform: true, forbidUnknownValues: false })`.

### Fuente única de códigos (AC-4 ya existe, en otra ubicación)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\domain\errors\ledger-error-code.ts`
- `export const LEDGER_ERROR_CODE = { UNBALANCED_TRANSACTION, ACCOUNT_CLOSED, CURRENCY_NOT_ALLOWED, DUPLICATE_EXTERNAL_REF, IMMUTABLE_TRANSACTION, CONCURRENCY_CONFLICT, NAME_COLLISION, SYSTEM_ACCOUNT_PROTECTED, TRANSACTION_NOT_FOUND, ACCOUNT_NOT_FOUND, LEDGER_NOT_INITIALIZED } as const;`
- `export type LedgerErrorCode = ...`
- **No está en** `apps/ledger/src/shared-kernel/infrastructure/adapters/http/error-codes.ts` (path planeado en la HU): ese directorio `http/` bajo shared-kernel **no existe**.

### Contract test tabular (AC-5/AC-6 ya existen)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\domain\errors\ledger-error-code-mapping.spec.ts`
- `it.each(cases)` con tuplas `[DomainException, HttpStatus, LEDGER_ERROR_CODE]`, ejecuta cada
  excepción a través de `new ExceptionFilter().catch(...)` y afirma `{ statusCode, code }`.
- Cubre 10 excepciones: UnbalancedTransaction, CurrencyNotAllowed, AccountClosed,
  ImmutableTransaction, NameCollision, SystemAccountProtected, ConcurrencyConflict,
  DuplicateExternalRef, AccountNotFound, TransactionNotFound.
- Incluye el caso de error desconocido → 500 sin `code` (AC-6).
- **Documenta la divergencia `ACCOUNT_CLOSED` → 422** (spec líneas 44–46; la HU dice 409).
- **`LEDGER_NOT_INITIALIZED` está ausente de la tabla** pese a estar en `LEDGER_ERROR_CODE`.

### Excepciones de agregado (autoría EP-1, ya existentes)

**Accounts** — `D:\Cristian\Nest\admin-back\apps\ledger\src\accounts\domain\account\exceptions\account.exception.ts`

| Clase | Extiende | code | status |
|---|---|---|---|
| `SystemAccountProtectedException` | `DomainConflictException` | `SYSTEM_ACCOUNT_PROTECTED` | 409 |
| `RealAccountCurrencyException` | `DomainUnprocessableException` | `REAL_ACCOUNT_SINGLE_CURRENCY` | 422 |
| `AccountClosedException` | `DomainUnprocessableException` | `ACCOUNT_CLOSED` | **422** (HU: 409) |
| `AccountAlreadyClosedException` | `DomainConflictException` | `ACCOUNT_ALREADY_CLOSED` | 409 |
| `InvalidCloseDateException` | `DomainUnprocessableException` | `INVALID_CLOSE_DATE` | 422 |
| `CurrencyNotAllowedException` | `DomainUnprocessableException` | `CURRENCY_NOT_ALLOWED` | 422 |
| `NameCollisionException` | `DomainConflictException` | `NAME_COLLISION` | 409 |

**Transactions** — `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\domain\transaction\exceptions\transaction.exception.ts`

| Clase | Extends | code | status |
|---|---|---|---|
| `TransactionNotFoundException` | `DomainNotFoundException` | `TRANSACTION_NOT_FOUND` | 404 |
| `UnbalancedTransactionException` | `DomainUnprocessableException` | `UNBALANCED_TRANSACTION` | 422 |
| `InsufficientPostingsException` | `DomainUnprocessableException` | `INSUFFICIENT_POSTINGS` | 422 |
| `ImmutableTransactionException` | `DomainConflictException` | `IMMUTABLE_TRANSACTION` | 409 |
| `InvalidTransactionStateException` | `DomainConflictException` | `INVALID_TRANSACTION_STATE` | 409 |

**Transfers** — `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\domain\exceptions\transfer.exception.ts`
- `NotATransferPairException` → `NOT_A_TRANSFER_PAIR` (422); `PendingLegNotFoundException` → `PENDING_LEG_NOT_FOUND` (404).

**Ledger module** — `D:\Cristian\Nest\admin-back\apps\ledger\src\ledger\domain\settings\exceptions\ledger.exception.ts`
- `LedgerAlreadyInitializedException` → `LEDGER_ALREADY_INITIALIZED` (409); `AccountNotFoundException` → `ACCOUNT_NOT_FOUND` (404).

**Reconciliation** — `D:\Cristian\Nest\admin-back\apps\ledger\src\reconciliation\domain\balance-assertion\exceptions\balance-assertion.exception.ts`
- `AssertionNotFoundException` (404), `AssertionAlreadyRevokedException` (409), `AssertionNotEvaluableException` (422), `DiscrepancyNotResolvableException` (409), `AssertionCurrencyMismatchException` (422).
- `LedgerNotInitializedException` extends `DomainUnprocessableException` → `LEDGER_NOT_INITIALIZED` **422** (HU: 409).

### Excepciones del puerto EventStore (AC-3 ya satisfecho)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\exceptions\event-store.exception.ts`
- `ConcurrencyConflictException` extends `DomainConflictException` → `CONCURRENCY_CONFLICT` (409).
- `DuplicateExternalRefException` extends `DomainConflictException` → `DUPLICATE_EXTERNAL_REF` (409).
- Ambas ya están dentro de la jerarquía `DomainException`: el mismo filter las mapea, sin `catch` especial.

**Puerto** — `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\ports\event-store.ts`

```typescript
export abstract class EventStore {
  abstract append(stream: StreamId, expectedVersion: number, events: readonly EventEnvelope[]): Promise<AppendResult>;
  abstract load(stream: StreamId): Promise<readonly StoredEvent[]>;
  abstract readAll(fromPosition: bigint, limit: number): Promise<readonly StoredEvent[]>;
  abstract findByExternalRef(userId: string, externalRef: string): Promise<Nullable<StoredEvent>>;
}
```

### Otras excepciones del dominio ledger (fuera de la tabla RF-14)

- `apps\ledger\src\shared-kernel\domain\value-objects\value-object.exception.ts` — todas 422:
  `InvalidAccountNameException`, `RootTypeImmutableException`, `InvalidLedgerDateException`,
  `InvalidCurrencyCodeException`, `UnknownCurrencyException`, `InvalidPayeeException`.
- `apps\ledger\src\shared-kernel\application\` — `UnknownEventTypeException` (`UNKNOWN_EVENT_TYPE`),
  `UnregisteredQueryException` (`UNREGISTERED_QUERY`), `UnregisteredCommandException` (`UNREGISTERED_COMMAND`),
  `MissingAuthContextException` (`MISSING_AUTH_CONTEXT`) — todas 422.
- `apps\ledger\src\shared\domain\money\money.exception.ts` — `InvalidMoneyException`,
  `CurrencyMismatchException`, `MoneyScaleException`, `InvalidCurrencyException`: extienden
  `DomainUnprocessableException` **sin override de `code`** (heredan `UNPROCESSABLE_ENTITY`).

### Patrón de inyección (use case de referencia)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\application\record-transaction\record-transaction.handler.ts`

```typescript
export class RecordTransactionHandler extends CommandHandler<RecordTransactionCommand> {
  constructor(
    private readonly transactions: LedgerTransactionRepository,
    private readonly validation: AccountValidationService,
    private readonly catalog: CurrencyCatalog,
    private readonly balance: BalanceRule,
    private readonly idGenerator: IdGenerator,
    private readonly dispatcher: ProjectionDispatcher,
  ) {
    super();
  }
```

### Tests representativos

- `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\domain\errors\ledger-error-code-mapping.spec.ts` (tabular, AC-5)
- `D:\Cristian\Nest\admin-back\libs\shared\src\filters\exception.filter.spec.ts` (patrón espejo)
- `D:\Cristian\Nest\admin-back\apps\ledger\src\accounts\infrastructure\adapters\http\accounts.controller.spec.ts` / `accounts-api.e2e.spec.ts`
- `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\infrastructure\adapters\http\transactions.controller.spec.ts` / `transactions-api.e2e.spec.ts`
- `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\infrastructure\adapters\http\` (ledger-context.guard, command-result.interceptor, external-ref.decorator — todos con spec)
- `D:\Cristian\Nest\admin-back\apps\ledger\src\app.wiring.spec.ts`

### Documentación disponible

- `apps\ledger\docs\accounts\` — README.md, api.yaml, accounts.c4, flows/ (5 flujos)
- `apps\ledger\docs\transactions\` — README.md, api.yaml, transactions.c4, flows/ (5 flujos)
- `apps\ledger\docs\shared\` — README.md, api.yaml, shared.c4, flows/ (command-dispatch, query-dispatch, get-swagger-docs)
- `apps\ledger\docs\shared-kernel\` — component.md, diagram.md, shared-kernel.c4, flows/ (sin README.md ni api.yaml)
- **No existe** `apps\ledger\README.md` ni doc de la tabla de códigos RF-14 (los códigos solo están congelados en código + mapping spec).

---

## shared (lib)

### ExceptionFilter global (a reutilizar, no reescribir)

**Archivo:** `D:\Cristian\Nest\admin-back\libs\shared\src\filters\exception.filter.ts`
- `@Catch()` sin argumento (catch-all).
- Lee `exception.code` solo si `exception instanceof DomainException`; en otro caso `code: undefined` (omitido del body vía `compact()`).
- Status: `HttpException` passthrough → `DomainException` usa su `exception.status` → resto `InternalServerErrorException` (500).
- Produce `ErrorResponseBody` y responde `http.getResponse().status(body.statusCode).json(compact(body))`.

### ErrorResponseBody

**Archivo:** `D:\Cristian\Nest\admin-back\libs\shared\src\filters\error-response-body.type.ts`

```typescript
export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
  path: string;
  timestamp: string;
}
```

### Jerarquía DomainException

**Directorio:** `D:\Cristian\Nest\admin-back\libs\shared\src\exceptions\`

```
Error
└── BaseException (abstract)                      base.exception.ts — abstract code: string; context?; cause?
    ├── InvalidConfigurationException             invalid-configuration.exception.ts — code INVALID_CONFIGURATION (NO es DomainException → 500 sin code)
    └── DomainException (abstract)                domain.exception.ts — abstract status: number; format()
        ├── DomainNotFoundException               domain-not-found.exception.ts — code NOT_FOUND, status 404
        ├── DomainConflictException               domain-conflict.exception.ts — code CONFLICT, status 409
        └── DomainUnprocessableException          domain-unprocessable.exception.ts — code UNPROCESSABLE_ENTITY, status 422
```

Patrón: las excepciones concretas del ledger extienden la familia y sobreescriben `readonly code`;
heredan el `status` de la familia. Constructor común: `(message: string, options?: BaseExceptionOptions)`.

### Spec del filter (patrón espejo para AC-5)

**Archivo:** `D:\Cristian\Nest\admin-back\libs\shared\src\filters\exception.filter.spec.ts`
- 4 `it(...)` con helper `capture()` que mockea `ArgumentsHost`.
- Casos: not-found de dominio → 404 con `code`; `NotFoundException` de Nest → passthrough sin `code`;
  `HttpException` conserva status; `Error` plano → 500 sin `code`.

### Consumo

- Path alias: `@shared` → `libs/shared/src/index.ts`; `@shared/*` → deep imports (`tsconfig.base.json`).
- `apps\ledger\src\main.ts:40` — `app.useGlobalFilters(new ExceptionFilter())`.
- `apps\finances\src\app.module.ts:90` — `{ provide: APP_FILTER, useClass: ExceptionFilter }`.
- E2E specs de ledger también montan el filter (`accounts-api.e2e.spec.ts`, `transactions-api.e2e.spec.ts`).

---

## Gaps detectados

1. **Divergencia de contrato `ACCOUNT_CLOSED`**: el código y el mapping-spec lo fijan en **422**
   (consciente, documentado en el spec), pero AC-2 de la HU dice **409**. `/design` debe resolver
   cuál es el contrato (y actualizar HU o código).
2. **Divergencia `LEDGER_NOT_INITIALIZED`**: excepción existe (reconciliation) con **422**; la HU
   dice **409**. Además **falta en la tabla del mapping-spec** pese a estar en `LEDGER_ERROR_CODE`.
3. **Ubicación de `LEDGER_ERROR_CODE`**: la HU planea crearlo en
   `apps/ledger/src/shared-kernel/infrastructure/adapters/http/error-codes.ts`, pero ya existe en
   `apps/ledger/src/shared/domain/errors/ledger-error-code.ts`. `/design` debe decidir si se mueve
   o se mantiene la ubicación actual (y corregir la HU/artefactos).
4. **Excepciones fuera de la jerarquía**: `apps\ledger\src\settings\domain\ledger-settings\exceptions\settings.exception.ts`
   (`InvalidCurrencyCodeException`, `InvalidTimeZoneException`) extienden `Error` crudo → mapean a
   500 sin `code`. No están en la tabla RF-14; decidir si entran al contrato o quedan fuera.
5. **Excepciones de Money sin `code` propio** (`apps\ledger\src\shared\domain\money\money.exception.ts`):
   heredan `UNPROCESSABLE_ENTITY` genérico — no son códigos estables RF-14.
6. **Sin doc de la tabla de códigos**: no hay README/api.yaml que documente el contrato de errores
   RF-14 bajo `apps\ledger\docs\` (candidato: `docs/shared/` o un doc nuevo). `/design` debería
   definir dónde vive ese contrato documentado.
