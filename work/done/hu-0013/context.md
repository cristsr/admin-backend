# context: hu-0013

> **Nota de alcance.** Esta HU **ya está implementada** en el código (`apps/ledger`,
> módulos `accounts` + `ledger` + `read-side`). Este scan no es pre-diseño: además de
> inventariar artefactos reutilizables, verifica el estado real de la implementación
> contra cada AC de `hu.md` y reporta gaps de implementación, documentación y test.
> Ver la sección **[Gaps detectados](#gaps-detectados)** al final.

## Historia resumida

**Como** cliente autenticado del ledger
**Quiero** inicializar mi ledger y gestionar el ciclo de vida de mis cuentas (abrir,
renombrar, cerrar) y consultar el árbol de cuentas y sus saldos vía HTTP
**Para** administrar mi plan de cuentas de partida doble desde el frontend, con
read-your-writes y errores de dominio con código estable

## Componentes afectados

- `ledger` (app) — objetivo principal
  - `apps/ledger/src/accounts/` — adaptador HTTP + agregado + proyector
  - `apps/ledger/src/ledger/` — `InitializeLedger` + settings
  - `apps/ledger/src/read-side/` — query handlers
  - `apps/ledger/src/shared/` + `apps/ledger/src/shared-kernel/` — kernel HTTP y buses
- `shared` (lib) — `ExceptionFilter`, jerarquía `DomainException`, `Nullable`, `Criteria`
  (se reutilizan tal cual, sin cambios)

## Estado de la rama

- Rama actual: `feat/core` (base declarada en `.agents/profile.md` → `BASE_BRANCH: develop`;
  la rama real de trabajo del repo es `master`/`feat/core`).
- Árbol de trabajo **sucio** (9 archivos modificados + 5 sin trackear, ninguno del módulo
  `accounts/src`). El scan lee el código tal como está.

---

## ledger (app)

### Módulo afectado

`D:\Cristian\Nest\admin-back\apps\ledger\src\accounts\`

Estructura hexagonal completa (`domain/` · `application/` · `infrastructure/`), más los
módulos satélite `ledger/` (inicialización + settings) y `read-side/` (query handlers).

### Adaptador HTTP — controllers (artefacto principal de la HU)

**`D:\Cristian\Nest\admin-back\apps\ledger\src\accounts\infrastructure\adapters\http\accounts.controller.ts`**

| Línea | Ruta | Método | Command/Query | Respuesta |
|---|---|---|---|---|
| 47–58 | `POST /api/v1/accounts` | `open` | `OpenAccountCommand` | `201 CommandAcceptedDto` |
| 60–65 | `GET /api/v1/accounts` | `list` | `GetAccountTreeQuery` | `200` |
| 67–72 | `GET /api/v1/accounts/{id}` | `getOne` | `GetAccountByIdQuery` | `200` |
| 74–86 | `GET /api/v1/accounts/{id}/balance` | `balance` | `GetAccountBalancesQuery` | `200` |
| 88–101 | `POST /api/v1/accounts/{id}/rename` | `rename` | `RenameAccountCommand` | `200 CommandAcceptedDto` |
| 103–116 | `POST /api/v1/accounts/{id}/close` | `close` | `CloseAccountCommand` | `200 CommandAcceptedDto` |

- `@Controller({ path: 'accounts', version: '1' })` + `@UseInterceptors(CommandResultInterceptor)`.
- Helpers privados `authContext()` (línea 119) y `queryContext()` (línea 124) separan el
  contexto de escritura (con `externalRef`) del de lectura (solo `userId`, INV-9).
- Constructor: solo `CommandBus` + `QueryBus` (RNF-10 respetado, verificado en el spec).

**`D:\Cristian\Nest\admin-back\apps\ledger\src\accounts\infrastructure\adapters\http\ledger.controller.ts`**

| Línea | Ruta | Método | Command/Query | Respuesta |
|---|---|---|---|---|
| 34–50 | `POST /api/v1/ledger/initialize` | `initialize` | `InitializeLedgerCommand` | `201 CommandAcceptedDto` |
| 52–59 | `GET /api/v1/ledger/settings` | `settings` | `GetLedgerSettingsQuery` | `200` |

**`.../http/accounts-http.module.ts`** — declara solo `controllers: [LedgerController, AccountsController]`,
sin providers (los buses son globales vía `LedgerCoreModule`).

**`.../http/index.ts`** — barrel: `./dto`, `./accounts.controller`, `./ledger.controller`,
`./accounts-http.module`.

### DTOs existentes

**Barrel:** `D:\Cristian\Nest\admin-back\apps\ledger\src\accounts\infrastructure\adapters\http\dto\index.ts`

| Clase | Archivo | Validación / propiedades |
|---|---|---|
| `InitializeLedgerRequestDto` | `initialize-ledger-request.dto.ts` | `presentationCurrency`, `timezone` (`@IsString` + `@IsNotEmpty`) |
| `OpenAccountRequestDto` | `open-account-request.dto.ts` | `type` (`@IsEnum(AccountType)`), `name`, `parentId?` (`@IsUUID`), `currencies[]` (`@ArrayNotEmpty`), `openedOn` (`@IsDateString`), `isBankMirror` (`@IsBoolean`) |
| `RenameAccountRequestDto` | `rename-account-request.dto.ts` | `newName` |
| `CloseAccountRequestDto` | `close-account-request.dto.ts` | `closedOn` (`@IsDateString`, RNF-7) |
| `AccountTreeQueryDto` | `account-tree-query.dto.ts` | `view?: AccountTreeView` (`@IsEnum`, default `tree`) |
| `AccountBalanceQueryDto` | `account-balance-query.dto.ts` | `currency?` (`@IsOptional` + `@IsString`) |
| `AccountTreeView` (enum) | `account-tree-view.ts` | `TREE = 'tree'` \| `FLAT = 'flat'` — **con `TODO(read-shape)` en líneas 6–9** |
| `AccountDto` | `account.dto.ts` | `id`, `type`, `name`, `parentId?`, `currencies[]`, `isClosed`, `isSystem` |
| `AccountTreeDto` | `account-tree.dto.ts` | `view`, `accounts: AccountDto[]` |
| `AccountBalanceDto` | `account-balance.dto.ts` | `currency`, `confirmed`, `pending` (strings decimales, INV-8) |
| `LedgerSettingsDto` | `ledger-settings.dto.ts` | `presentationCurrency`, `timezone`, `isInitialized` |

Todos los DTO validan **solo forma** (class-validator + `@Api*`), sin reglas de dominio → **AC-9 cumplido**.

### Commands y handlers (reutilizados de hu-0003/hu-0005)

| Command | Archivo | Firma del constructor |
|---|---|---|
| `InitializeLedgerCommand` | `apps\ledger\src\ledger\application\initialize-ledger\initialize-ledger.command.ts` | `(presentationCurrency, timezone)` |
| `OpenAccountCommand` | `apps\ledger\src\accounts\application\open-account\open-account.command.ts` | `(name, currencies, openedOn, isBankMirror)` — **sin `type` ni `parentId`** |
| `RenameAccountCommand` | `apps\ledger\src\accounts\application\rename-account\rename-account.command.ts` | `(accountId, newName)` |
| `CloseAccountCommand` | `apps\ledger\src\accounts\application\close-account\close-account.command.ts` | `(accountId, closedOn)` |

Handlers:
- `InitializeLedgerHandler` (`initialize-ledger.handler.ts:24`) — crea `Equity:OpeningBalances`
  y `Equity:Adjustments` como cuentas de sistema (líneas 15–16, 72–83), guarda el ancla de
  idempotencia en el stream del ledger y despacha proyecciones (líneas 54–63). **AC-1 cubierto.**
- `OpenAccountHandler` (`open-account.handler.ts:20`) — verifica colisión de nombre contra
  `proj_accounts` (líneas 55–64) → `NameCollisionException` (409).
- `RenameAccountHandler` / `CloseAccountHandler` — rehidratan, aplican la transición y
  despachan; lanzan `AccountNotFoundException` (404) si no existe.

### Agregado `Account`

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\accounts\domain\account\account.aggregate.ts`

- `OpenAccountArgs` (líneas 24–30): `{ name, currencies, openedOn, isBankMirror, isSystem }`.
- El **tipo raíz se deriva del nombre jerárquico** (`args.name.rootType`, línea 49) y el
  **padre también** (`args.name.parentName()`, línea 63) — no hay `type` ni `parentId` de entrada.
- Invariantes: `RealAccountCurrencyException` (línea 51), `SystemAccountProtectedException`
  (rename línea 100, close línea 117), `RootTypeImmutableException` (línea 106),
  `AccountAlreadyClosedException` (línea 123), `InvalidCloseDateException` (línea 129),
  `AccountClosedException` (`ensureOpenOn`, línea 137), `CurrencyNotAllowedException` (línea 152).

Eventos: `AccountOpened`, `AccountRenamed`, `AccountClosed` (`domain/account/events/`).

### Excepciones y códigos estables (reutilizados de hu-0011)

**`apps\ledger\src\accounts\domain\account\exceptions\account.exception.ts`**

| Clase | Extiende | `code` | HTTP |
|---|---|---|---|
| `SystemAccountProtectedException` | `DomainConflictException` | `SYSTEM_ACCOUNT_PROTECTED` | 409 |
| `NameCollisionException` | `DomainConflictException` | `NAME_COLLISION` | 409 |
| `AccountAlreadyClosedException` | `DomainConflictException` | `ACCOUNT_ALREADY_CLOSED` | 409 |
| `RealAccountCurrencyException` | `DomainUnprocessableException` | `REAL_ACCOUNT_SINGLE_CURRENCY` | 422 |
| `AccountClosedException` | `DomainUnprocessableException` | `ACCOUNT_CLOSED` | **422** (la HU asume 409) |
| `CurrencyNotAllowedException` | `DomainUnprocessableException` | `CURRENCY_NOT_ALLOWED` | **422** |
| `InvalidCloseDateException` | `DomainUnprocessableException` | `INVALID_CLOSE_DATE` | 422 |

**`apps\ledger\src\ledger\domain\settings\exceptions\ledger.exception.ts`**
`LedgerAlreadyInitializedException` → `LEDGER_ALREADY_INITIALIZED` (409);
`AccountNotFoundException` → `ACCOUNT_NOT_FOUND` (404).

**Catálogo único:** `apps\ledger\src\shared\domain\errors\ledger-error-code.ts` (`LEDGER_ERROR_CODE`).
**Filter global:** `ExceptionFilter` de `@shared`, registrado en `apps\ledger\src\main.ts:40`.

### Read-side (queries) — reutilizados de hu-0004/hu-0006

| Query | Handler | Devuelve realmente |
|---|---|---|
| `GetAccountTreeQuery` | `read-side\get-account-tree\get-account-tree.handler.ts` | `readonly AccountRow[]` = `{ account_id, name }` (líneas 10, 22–26), orden `name ASC`, filtrado por `user_id` |
| `GetAccountByIdQuery` | `read-side\get-account-by-id\get-account-by-id.handler.ts` | `Nullable<AccountRow>` = `{ account_id, user_id, name }` — `null` si no existe (línea 27) |
| `GetAccountBalancesQuery` | `read-side\get-account-balances\get-account-balances.handler.ts` | `readonly BalanceRow[]` = `{ account_id, currency_code, confirmed_amount, pending_amount }`; cruza `proj_balances` con `proj_accounts` para aislar por usuario (líneas 34–41) |
| `GetLedgerSettingsQuery` | `read-side\get-ledger-settings\get-ledger-settings.handler.ts` | `Nullable<LedgerSettingsRow>` — `null` si no inicializado (línea 31) |

**Factory del query bus:** `apps\ledger\src\read-side\query-bus.factory.ts`.

### Proyecciones

- **`AccountTreeProjector`** — `apps\ledger\src\accounts\infrastructure\projections\account-tree.projector.ts`
  - Tabla `proj_accounts` (línea 8). Columnas (líneas 10–21): `account_id`, `user_id`, `type`,
    `name`, `parent_id`, `currency_code`, `opened_on`, `closed_on`, `is_bank_mirror`, `is_system`.
  - `parent_id` se **resuelve por nombre** del padre (`resolveParentId`, líneas 102–115).
  - `currency_code` es `null` cuando hay más de una moneda (línea 53) → no hay columna `currencies[]`.
  - Rename re-prefija todos los descendientes (líneas 63–85).
- **`LedgerSettingsProjector`** — `apps\ledger\src\ledger\infrastructure\projections\ledger-settings.projector.ts`
  - Tabla `proj_ledger_settings` (línea 6), fila por `user_id`, campos `presentation_currency`,
    `timezone`, `opening_balances_account_id`, `adjustments_account_id`, `is_initialized`.
- **`AccountBalancesProjector`** — `apps\ledger\src\transactions\infrastructure\projections\account-balances.projector.ts`
  (tabla `proj_balances`). El balance **nunca se escribe desde un command** → INV-5 respetado.

### Kernel HTTP compartido (reutilizado de hu-0009/hu-0010/hu-0012)

**Barrel:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\infrastructure\adapters\http\index.ts`

| Artefacto | Archivo | Rol |
|---|---|---|
| `CommandAcceptedDto` | `dto\command-accepted.dto.ts` | `{ id, streamPosition: string }`; `from(CommandResult)` |
| `CommandResultInterceptor` | `command-result.interceptor.ts` | Mapea `CommandResult` → DTO, setea `X-Ledger-Stream-Position` (línea 39) y degrada a `200` en replay idempotente (líneas 41–43) |
| `STREAM_POSITION_HEADER` | `command-result.interceptor.ts:9` | `'X-Ledger-Stream-Position'` |
| `Context()` | `context.decorator.ts:17` | Inyecta el `LedgerContext` que dejó el guard |
| `ExternalRef()` | `external-ref.decorator.ts:30` | Header `x-external-ref` con fallback a `body.external_ref` |
| `LedgerContextGuard` | `ledger-context.guard.ts:15` | `APP_GUARD` global; 401 si no hay contexto; bypass con `@Public()` |
| `GatewayHeaderContextResolver` | `resolvers\gateway-header-context.resolver.ts:37` | Headers `x-user-id` / `x-client-id` |
| `SharedHttpModule` | `shared-http.module.ts:69` | `@Global()`; cablea resolver + guard + interceptor |

### Buses y políticas (hu-0005 / hu-0012)

- **`PolicyCommandBus`** — `apps\ledger\src\shared-kernel\application\command-bus\command-bus.ts:22`.
- **Cadena de políticas** (cableada en `apps\ledger\src\ledger\application\ledger-application.factory.ts:75-79`):
  `AuthenticatedContextPolicy` → `IdempotencyPolicy` → `OptimisticConcurrencyPolicy`.
- **`IdempotencyPolicy`** — `shared-kernel\application\command-bus\policies\idempotency.policy.ts:17`.
  Busca el ancla por `external_ref` (línea 25), replay con `idempotentReplay: true` (líneas 55–61)
  y captura `DuplicateExternalRefException` como defensa en profundidad (líneas 31–37). **AC-8
  soportado a nivel de bus** (no requiere código nuevo en el controller).
- **Dispatcher síncrono** — `SynchronousProjectionDispatcher`
  (`factory` línea 68) → **read-your-writes real (AC-3)**.

### Composición / wiring

- `apps\ledger\src\app.module.ts:37` importa `AccountsHttpModule`; línea 28 `SharedHttpModule`;
  línea 31 `LedgerCoreModule`.
- `apps\ledger\src\ledger\ledger-core.module.ts` (`@Global`) provee `CommandBus`, `QueryBus`,
  `EventStore` (**`PostgresEventStore`**, línea 31) y `ReadModelStore` (**`PostgresReadModelStore`**,
  línea 32) — cambio EP-5.0 relevante para los tests (ver gaps).
- `apps\ledger\src\main.ts` — prefijo `api`, versionado URI v1 (línea 29),
  `ValidationPipe({ transform: true, forbidUnknownValues: false })` (líneas 31–36),
  `ExceptionFilter` global (línea 40).
- **Sin conflicto de rutas:** `apps\ledger\src\settings\...\ledger-settings.controller.ts:21` usa
  `@Controller('ledger/settings')` pero **no está registrado** — `SettingsModule` solo declara el
  projector (`settings.module.ts:11-13`).

### Tests existentes

| Archivo | Tipo | Estado |
|---|---|---|
| `...\http\accounts.controller.spec.ts` (114 líneas, 8 tests) | unit, buses mockeados | **verde** |
| `...\http\ledger.controller.spec.ts` (46 líneas, 2 tests) | unit, buses mockeados | **verde** |
| `...\http\accounts-api.e2e.spec.ts` (112 líneas, 5 tests) | e2e supertest, buses mockeados | **ROJO — 5/5 fallan** |
| `accounts\domain\account\account.aggregate.spec.ts` | unit dominio | verde |
| `accounts\application\open-account\open-account.handler.spec.ts` | unit aplicación | verde |
| `accounts\infrastructure\projections\account-tree.projector.spec.ts` | unit proyector | verde |
| `ledger\application\initialize-ledger\initialize-ledger.handler.spec.ts` | unit aplicación | verde |

Comando de verificación:
`npx jest --config apps/ledger/jest.config.ts --testPathPatterns "accounts.infrastructure.adapters.http"`
→ `Tests: 5 failed, 10 passed, 15 total`.

### Documentación disponible

| Artefacto | Ruta | Estado |
|---|---|---|
| README de módulo | `apps\ledger\docs\accounts\README.md` | existe (arc42-lite) |
| Modelo LikeC4 | `apps\ledger\docs\accounts\accounts.c4` | existe (127 líneas), **incompleto** |
| OpenAPI del módulo | `apps\ledger\docs\accounts\api.yaml` | existe (282 líneas), **incompleto** |
| Flows | `apps\ledger\docs\accounts\flows\` | 5 archivos: `open-account`, `rename-account`, `close-account`, `list-accounts`, `get-account-balances` |
| Log de decisiones | `docs\decisions.md` | **sin entrada para HU-0013** (última: HU-0011) |
| Landscape C4 | `docs\architecture\landscape.c4` | existe (modificado en el árbol de trabajo) |
| Constitución | `docs\rules.md` | v1.0.0 — Artículos 1, 4, 5, 6, 10 aplican a esta HU |

### Mapa AC → implementación

| AC | Estado | Evidencia |
|---|---|---|
| AC-1 Inicialización | ✅ cubierto | `ledger.controller.ts:34-50` + `initialize-ledger.handler.ts:35-70` |
| AC-2 Lectura de settings | ⚠️ parcial | endpoint existe (`ledger.controller.ts:52-59`) pero devuelve la fila cruda, no `LedgerSettingsDto` |
| AC-3 Apertura + read-your-writes | ⚠️ parcial | dispatcher síncrono ok; el command **descarta `type` y `parentId`** |
| AC-4 Árbol y cuenta | ⚠️ parcial | `view` ignorado; respuesta ≠ `AccountTreeDto`/`AccountDto`; `404` no implementado |
| AC-5 Saldos | ⚠️ parcial | `currency` ignorado; respuesta ≠ `AccountBalanceDto[]` |
| AC-6 Rename / close POST | ✅ cubierto | `accounts.controller.ts:88-116` (`@HttpCode(OK)`) |
| AC-7 Errores estables | ⚠️ parcial | `NAME_COLLISION`/`SYSTEM_ACCOUNT_PROTECTED` ok; `ACCOUNT_CLOSED`/`CURRENCY_NOT_ALLOWED` mapean a 422, no a 409 |
| AC-8 Idempotencia | ✅ cubierto (sin test) | `idempotency.policy.ts:17-61` |
| AC-9 DTO valida solo forma | ✅ cubierto | todos los `*-request.dto.ts` |

---

<a id="gaps-detectados"></a>
## Gaps detectados

### 1. Gaps de implementación

| # | AC / tema | Evidencia | Severidad | Acción sugerida |
|---|---|---|---|---|
| I-1 | **AC-3** — `OpenAccountCommand` descarta `type` y `parentId` del DTO | `apps\ledger\src\accounts\infrastructure\adapters\http\accounts.controller.ts:55` construye `new OpenAccountCommand(dto.name, dto.currencies, dto.openedOn, dto.isBankMirror)`; `open-account.command.ts:7-12` no declara esos campos; `account.aggregate.ts:49,63` los deriva del nombre jerárquico | **Alta** | Decidir el contrato: (a) quitar `type`/`parentId` del DTO y de `api.yaml` documentando que la jerarquía va en el `name`, o (b) extender command+agregado para aceptarlos y validar coherencia con `name.rootType`. Registrar la decisión en `docs/decisions.md`. |
| I-2 | **AC-4** — las lecturas devuelven filas de proyección, no los DTO del contrato | `get-account-tree.handler.ts:10,22-26` devuelve `{ account_id, name }[]`; el controller lo tipa como `AccountTreeDto` (`accounts.controller.ts:63-65`). El cliente recibe `snake_case` sin `view`, `type`, `parentId`, `currencies`, `isClosed`, `isSystem` | **Alta** | Introducir un mapper fila→DTO en el adaptador (o hacer que el read handler proyecte al shape público) y cubrirlo con test. Aplica también a `AccountDto`. |
| I-3 | **AC-5** — idem para balances: `BalanceRow[]` (`account_id`, `currency_code`, `confirmed_amount`, `pending_amount`) ≠ `AccountBalanceDto[]` (`currency`, `confirmed`, `pending`) | `get-account-balances.handler.ts:11-16` vs `dto\account-balance.dto.ts:7-16` | **Alta** | Mapear al DTO declarado; el `api.yaml` ya define el shape correcto. |
| I-4 | **AC-2** — `GET /ledger/settings` devuelve `LedgerSettingsRow` (`presentation_currency`, `is_initialized`, ids de cuentas de sistema) en vez de `LedgerSettingsDto` | `get-ledger-settings.handler.ts:26-31` vs `dto\ledger-settings.dto.ts:4-13`; `ledger.controller.ts:55-59` | **Alta** | Mapear al DTO y decidir si los ids de cuentas técnicas se exponen. |
| I-5 | **AC-4** — el parámetro `view=tree\|flat` se acepta y se descarta | `accounts.controller.ts:63` (`@Query() _query: AccountTreeQueryDto` nunca usado); `dto\account-tree-view.ts:6-9` lo admite en un `TODO(read-shape)` | **Alta** | Implementar el shaping en el adaptador (anidar por `parent_id` para `tree`) o retirar el parámetro del contrato hasta implementarlo. |
| I-6 | **AC-5** — el parámetro `currency` se acepta y se descarta | `accounts.controller.ts:80` (`_query: AccountBalanceQueryDto`); `GetAccountBalancesQuery` solo recibe `accountId` (`get-account-balances.query.ts:8`) | **Media** | Propagar `currency` a la query y filtrar en el handler, o retirar el parámetro. |
| I-7 | **AC-4** — `GET /accounts/{id}` inexistente responde `200` con `null`, no `404 ACCOUNT_NOT_FOUND` | `get-account-by-id.handler.ts:27` retorna `null`; el controller no valida (`accounts.controller.ts:70-72`); `api.yaml:71-72` promete `404` | **Alta** | Lanzar `AccountNotFoundException` (ya existe, → 404 `ACCOUNT_NOT_FOUND`) desde el handler o el controller. |
| I-8 | **AC-7** — `ACCOUNT_CLOSED` y `CURRENCY_NOT_ALLOWED` se mapean a `422`, no a `409` | `account.exception.ts:17-19` y `:32-34` extienden `DomainUnprocessableException` | **Media** | Divergencia ya conocida desde hu-0011. Confirmar el status esperado y, si la HU manda 409, cambiar la clase base; si no, corregir el AC-7 vía `/refine`. |
| I-9 | **AC-7** — ninguno de los dos escenarios (`padre cerrado`, `moneda inválida`) se dispara en el flujo de `POST /accounts` | `open-account.handler.ts:30-53` solo valida colisión de nombre; `ensureOpenOn`/`ensureAcceptsCurrency` (`account.aggregate.ts:137,152`) solo se usan al postear transacciones | **Media** | Añadir validación de padre cerrado / moneda al abrir (vía `AccountValidationService`) o acotar el AC-7 a los códigos realmente alcanzables por este endpoint. |
| I-10 | Duplicación de `LedgerSettingsProjector` en dos rutas | `apps\ledger\src\ledger\infrastructure\projections\ledger-settings.projector.ts` (activo en la factory, línea 66) y `apps\ledger\src\settings\infrastructure\projections\ledger-settings.projector.ts` (registrado en `settings.module.ts:12`, nunca despachado) | **Baja** | Consolidar en uno solo (Artículo 12 por analogía: no duplicar lógica). |

### 2. Gaps documentales

| # | AC / tema | Evidencia | Severidad | Acción sugerida |
|---|---|---|---|---|
| D-1 | **AC-1 / AC-2** — `POST /ledger/initialize` y `GET /ledger/settings` no existen en ningún OpenAPI del repo | `apps\ledger\docs\accounts\api.yaml` (paths: solo `/accounts*`); búsqueda global solo encuentra referencias en `docs\ledger-spec.md:630-631` y `docs\roadmap.md:126` | **Alta** | Añadir ambos paths + schemas `InitializeLedgerRequest` y `LedgerSettings` al `api.yaml` del módulo. |
| D-2 | **AC-1 / AC-2** — `LedgerController` ausente del modelo LikeC4 | `apps\ledger\docs\accounts\accounts.c4:43-50` solo declara `controller = AccountsController`; no hay dynamic view `initializeLedger` ni `getLedgerSettings` | **Alta** | Agregar el componente `LedgerController`, el `LedgerSettingsProjector` y las dos dynamic views. |
| D-3 | **AC-1 / AC-2 / AC-4** — faltan flow docs de tres casos de uso | `apps\ledger\docs\accounts\flows\` no contiene `initialize-ledger.md`, `get-ledger-settings.md` ni `get-account-by-id.md`; el README los deja como *(read-side)* (`README.md:29`) | **Alta** | Crear los tres flows con frontmatter (`trigger: rest`, `entrypoint`, `command`, `view`) y enlazarlos desde el README. |
| D-4 | **AC-4** — la doc afirma que `view` está implementado | `flows\list-accounts.md` («El endpoint soporta `?view=tree\|flat`… El parámetro `view` controla si la respuesta es plana o jerárquica») contra `accounts.controller.ts:63` que lo ignora | **Alta** | Alinear con la decisión de I-5: documentar el estado real o implementar. |
| D-5 | **AC-4 / AC-5** — contradicción interna de contrato: los flows documentan `AccountRow[]` / `BalanceRow[]` mientras `api.yaml` promete `AccountTree` / `AccountBalance[]` | `flows\list-accounts.md` (sección «Respuesta»), `flows\get-account-balances.md` (sección «Respuesta») vs `api.yaml:44-50,93-101` | **Alta** | Unificar tras resolver I-2/I-3; `api.yaml` es el contrato canónico. |
| D-6 | **AC-7** — la tabla de errores de `open-account.md` cita excepciones inexistentes y omite las reales | `flows\open-account.md` lista `InvalidCurrencyForAccountException` e `InvalidOpenDateException`; el código tiene `RealAccountCurrencyException` (422) y `NameCollisionException` (409, `open-account.handler.ts:62`) | **Alta** | Corregir la tabla con las excepciones y códigos reales. |
| D-7 | **AC-7** — `api.yaml` no documenta el cuerpo de error estable ni los `409` de `POST /accounts` | `api.yaml:25-33` (solo `201` y `422`); no hay schema `ErrorResponse` ni respuestas `401` en ningún path | **Media** | Añadir `ErrorResponse` (`statusCode`, `code`, `message`) y las respuestas `401`/`409` por operación. |
| D-8 | **AC-8** — la idempotencia por `external_ref` no está documentada en el contrato del módulo | `api.yaml` no menciona el header `X-External-Ref` ni el campo `external_ref`; tampoco el header de respuesta `X-Ledger-Stream-Position` (`command-result.interceptor.ts:9`) | **Media** | Documentar ambos headers como parámetros/`headers` de respuesta en las operaciones de escritura. |
| D-9 | `docs\decisions.md` no tiene entrada para HU-0013 | `grep "^## HU-" docs\decisions.md` → última entrada HU-0011 | **Media** | Añadir la sección «HU-0013» al cerrar con `/sync`, registrando las decisiones de I-1, I-5 e I-8. |
| D-10 | El README del módulo no lista los dos endpoints de `/ledger` | `apps\ledger\docs\accounts\README.md:23-30` (tabla de casos de uso, solo `/accounts*`) | **Baja** | Añadir las filas «Inicializar ledger» y «Consultar settings». |
| D-11 | Frontmatter de flows con `invariants` inconsistentes (`AC-7`, `AC-8` referencian ACs de otra HU, no invariantes) | `flows\list-accounts.md`, `flows\get-account-balances.md` (`invariants: [AC-7, AC-8, RNF-10, INV-9]`) | **Baja** | Normalizar a IDs de invariante (`INV-*`) o requisitos (`RNF-*`). |

### 3. Gaps de test

| # | AC / tema | Evidencia | Severidad | Acción sugerida |
|---|---|---|---|---|
| T-1 | **AC-1 / AC-3 / AC-7** — toda la suite e2e del módulo está **roja** | `apps\ledger\src\accounts\infrastructure\adapters\http\accounts-api.e2e.spec.ts:42-49` importa `LedgerCoreModule`, que desde EP-5.0 provee `PostgresReadModelStore`/`PostgresEventStore` (`ledger-core.module.ts:31-32`) y exige `DataSource`. Error: *«Nest can't resolve dependencies of the PostgresReadModelStore (?) … DataSource at index [0]»*. Resultado: `Tests: 5 failed, 10 passed`. Mismo fallo en `transactions-api.e2e.spec.ts` (13 tests rojos en total) | **Alta** | Sustituir `LedgerCoreModule` por un módulo de test con `InMemoryEventStore` + `InMemoryReadModelStore`, u override de `DataSource`. Es prerrequisito de todos los gaps T siguientes. |
| T-2 | **AC-8** — idempotencia por `external_ref` sin ningún test a nivel HTTP | No hay ninguna aserción sobre `X-External-Ref`, `idempotentReplay` ni degradación a `200` en `accounts.controller.spec.ts`, `ledger.controller.spec.ts` ni `accounts-api.e2e.spec.ts` | **Alta** | Test e2e: `POST /accounts` dos veces con el mismo `external_ref` → segunda respuesta `200` con el mismo `id`/`streamPosition` y sin cuenta nueva. |
| T-3 | **AC-3** — el read-your-writes «verificado» usa buses mockeados: el `GET` posterior devuelve lo que el mock decide, no la proyección | `accounts-api.e2e.spec.ts:85-93` (`ask.mockResolvedValue(...)`); la HU pide «e2e con in-memory EventStore y proyecciones síncronas» (`hu.md:81-82`) | **Alta** | Reescribir el e2e sobre el core real in-memory (`createLedgerApplication` + `InMemoryEventStore` + `SynchronousProjectionDispatcher`). |
| T-4 | **AC-2** — `GET /ledger/settings` sin cobertura e2e | `accounts-api.e2e.spec.ts` no ejercita la ruta; solo hay unit con mock (`ledger.controller.spec.ts:35-45`) | **Media** | Test e2e tras `initialize`, verificando el shape de `LedgerSettingsDto`. |
| T-5 | **AC-4** — `GET /accounts/{id}` (200 y 404) sin cobertura e2e | No aparece en `accounts-api.e2e.spec.ts` | **Media** | Cubrir el hallazgo y el `404 ACCOUNT_NOT_FOUND` (ligado a I-7). |
| T-6 | **AC-5** — `GET /accounts/{id}/balance` sin cobertura e2e ni de shape | Solo el unit `accounts.controller.spec.ts:100-108`, que verifica la query pero no la respuesta | **Media** | Test e2e con la proyección de balances poblada, verificando `AccountBalanceDto[]`. |
| T-7 | **AC-6** — `rename`/`close` sin test de status `200` ni del header `X-Ledger-Stream-Position` en la ruta feliz | `accounts-api.e2e.spec.ts:103-111` solo cubre el caso 409 de `close`; no hay e2e de `rename` | **Media** | Añadir e2e felices para ambos, afirmando `200` + `CommandAcceptedDto` + header. |
| T-8 | **AC-7** — sin test para `ACCOUNT_CLOSED` ni `CURRENCY_NOT_ALLOWED` desde `POST /accounts` | `accounts-api.e2e.spec.ts` solo cubre `NAME_COLLISION` (línea 95) y `SYSTEM_ACCOUNT_PROTECTED` (línea 103) | **Media** | Cubrir tras resolver I-9 (o retirar del AC). |
| T-9 | **AC-9** — ningún test verifica que un body inválido produzca `400` (validación de forma) | No hay aserciones de `400` en ningún spec del adaptador | **Media** | Tests e2e por DTO: `type` fuera del enum, `openedOn` no-fecha, `currencies` vacío, `parentId` no-UUID. |
| T-10 | **AC-4** — `view=flat` no tiene test de comportamiento diferencial | `accounts.controller.spec.ts:77-87` pasa `view: FLAT` pero solo verifica que la query se despache | **Baja** | Cubrir cuando se implemente I-5. |
| T-11 | **Artículo 4 (TDD estricto)** — `ledger.controller.ts` solo tiene 2 tests unitarios y ninguno cubre `external_ref` nulo ni el `201` | `ledger.controller.spec.ts` (46 líneas) | **Baja** | Ampliar la cobertura unitaria del `LedgerController`. |

### Resumen de severidad

- **Alta:** I-1, I-2, I-3, I-4, I-5, I-7 · D-1, D-2, D-3, D-4, D-5, D-6 · T-1, T-2, T-3 → **15**
- **Media:** I-6, I-8, I-9 · D-7, D-8, D-9 · T-4, T-5, T-6, T-7, T-8, T-9 → **12**
- **Baja:** I-10 · D-10, D-11 · T-10, T-11 → **5**

### Dependencias entre gaps

`T-1` (e2e roja) bloquea a `T-2`…`T-10`. `I-2`/`I-3`/`I-4` (mapeo a DTO) deben resolverse
antes que `D-5` (alineación de docs). `I-1` y `I-5` requieren una **decisión de contrato**
previa al diseño — son las dos incógnitas a resolver antes de correr `/design hu-0013`.
