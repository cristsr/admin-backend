# context: hu-0009

## Historia resumida

**Como** desarrollador del adaptador conductor (driving) de `apps/ledger`
**Quiero** el esqueleto OpenAPI con versionado por URI y un patrón canónico de controller que
traduce HTTP a los buses de aplicación (command bus / query bus) sin lógica de dominio
**Para** disponer de la base compartida sobre la que se construyen todos los endpoints de
negocio (cuentas y transacciones), con un contrato publicado y estable desde el día uno

---

## Microservicios afectados

- `apps/ledger` (monorepo — app objetivo)
- `apps/finances` (solo como referencia de patrones: swagger builder, wiring test)

---

## apps/ledger

### main.ts — AC-1, AC-2

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\main.ts`

Ya están implementados:

| Configuración | Línea | Código |
|---|---|---|
| Global prefix `api` | 28 | `app.setGlobalPrefix('api')` |
| URI versioning v1 | 29 | `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })` |
| Montaje de Swagger | 47 | `maybeMountSwagger(app, config.showDocs)` |
| Pino logger | 23-24 | `app.useLogger(app.get(PinoLogger))` + `flushLogs()` |
| ValidationPipe | 31-36 | `transform: true, forbidUnknownValues: false` |
| ExceptionFilter global | 40 | `app.useGlobalFilters(new ExceptionFilter())` de `@shared` |
| Trust proxy | 21 | `app.set('trust proxy', true)` |
| Telemetry | 3 | `import '@shared/telemetry/instrumentation'` |
| class-validator container | 42 | `useContainer(app.select(AppModule), { fallbackOnErrors: true })` |

El config `showDocs` se obtiene desde `AppConfig` (`@ledger/config/environment`), que valida `SHOW_DOCS` de `process.env`.

---

### config/swagger/ — AC-2, AC-3

**Directorio:** `D:\Cristian\Nest\admin-back\apps\ledger\src\config\swagger\`

Archivos existentes:

| Archivo | Descripción |
|---|---|
| `ledger-swagger.builder.ts` | Builder principal: `DocumentBuilder` con title "Ledger API", version "1.0.0" |
| `ledger-swagger.builder.spec.ts` | Tests de esquemas de seguridad, default security, título |
| `index.ts` | Barrel: `export * from './ledger-swagger.builder'` |

**Constantes y funciones exportadas:**

| Export | Valor / Signature |
|---|---|
| `SWAGGER_PATH` | `'docs'` |
| `SWAGGER_SECURITY` | `{ gatewayContext: 'gatewayContext', bearer: 'bearerAuth' }` |
| `buildSwaggerDocument()` | `() => OpenAPIObject` |
| `maybeMountSwagger(app, showDocs)` | Monta Swagger UI en `/docs` si `showDocs === true` |

**Esquemas de seguridad (AC-3):**
- `gatewayContext`: `apiKey` en header `x-user-id` — **esquema por defecto** (`addSecurityRequirements`)
- `bearerAuth`: `http` bearer con formato JWT

**Importación desde `main.ts`:** `import { maybeMountSwagger } from './config/swagger'` (usa barrel).

**Discrepancia con AC-2:** El AC dice `GET /api/v1/docs`, pero `SwaggerModule.setup('docs', ...)` con `setGlobalPrefix('api')` resuelve a `/api/docs` (sin versión). NestJS Swagger no integra automáticamente con `VersioningType.URI`.

---

### shared/infrastructure/adapters/http/ — AC-4, AC-5, AC-6

**Directorio:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\infrastructure\adapters\http\`

> **Importante:** El código HTTP no está en `shared-kernel/infrastructure/adapters/http/` (RNF-11), sino en `shared/infrastructure/adapters/http/`. `shared` es una capa distinta de `shared-kernel` en la arquitectura del ledger.

Archivos bajo este directorio:

| Archivo | Clase/Export | Rol |
|---|---|---|
| `dto/command-accepted.dto.ts` | `CommandAcceptedDto` | DTO de respuesta de escritura: `{ id: string, streamPosition: string }` + `static from(result: CommandResult)` |
| `dto/index.ts` | Barrel de DTOs | `export * from './command-accepted.dto'` |
| `command-result.interceptor.ts` | `CommandResultInterceptor implements NestInterceptor` | Interceptor global: mapea `CommandResult` → `CommandAcceptedDto`, agrega header `X-Ledger-Stream-Position`, downgradea replays idempotentes a 200 |
| `context-carrying-request.ts` | `ContextCarryingRequest extends Request` | Request con `ledgerContext?: LedgerContext` |
| `context.decorator.ts` | `Context` (param decorator), `extractContext()` | Extrae `LedgerContext` del request |
| `external-ref.decorator.ts` | `ExternalRef` (param decorator), `EXTERNAL_REF_HEADER`, `extractExternalRef()` | Extrae idempotency key de header `x-external-ref` o body `external_ref` |
| `ledger-context.guard.ts` | `LedgerContextGuard implements CanActivate` | Guard global (RF-26): resuelve contexto, rechaza 401 si ausente, bypass `@Public()` |
| `resolvers/gateway-header-context.resolver.ts` | `GatewayHeaderContextResolver extends LedgerContextResolver` | Lee `x-user-id` y `x-client-id` headers |
| `shared-http.module.ts` | `@Global() SharedHttpModule` | Wiring del kernel HTTP: `LedgerContextResolver`, `APP_GUARD`, `CommandResultInterceptor` |
| `index.ts` | Barrel | Re-exporta todos los exports públicos |

**CommandAcceptedDto (AC-5):**

```typescript
export class CommandAcceptedDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ description: 'Global stream position as decimal string.' })
  readonly streamPosition: string;

  private constructor(id: string, streamPosition: string) { ... }

  static from(result: CommandResult): CommandAcceptedDto {
    return new CommandAcceptedDto(result.aggregateId, String(result.streamPosition));
  }
}
```

**Discrepancia con AC-5:** El AC menciona `{ id, sequence, streamPosition }` (tres campos), pero el DTO real tiene solo `{ id, streamPosition }` (dos campos). `CommandResult` tiene `aggregateId`, `streamPosition` e `idempotentReplay` — no existe `sequence`.

**SharedHttpModule (AC-6):**

```typescript
@Global()
@Module({
  providers: [
    { provide: LedgerContextResolver, useClass: GatewayHeaderContextResolver },
    { provide: APP_GUARD, useClass: LedgerContextGuard },
    CommandResultInterceptor,
  ],
  exports: [LedgerContextResolver, CommandResultInterceptor],
})
export class SharedHttpModule {}
```

---

### Puertos de aplicación — CommandBus, QueryBus, CommandResult

**Directorio:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\`

| Archivo | Clase/Type | Signature |
|---|---|---|
| `command-bus/command-bus.ts` | `abstract class CommandBus` | `abstract dispatch(command: Command, ctx: AuthContext): Promise<CommandResult>` |
| `command-bus/command.ts` | `abstract class Command` | `abstract readonly commandType: string` |
| `command-bus/command-handler.ts` | `abstract class CommandHandler<T>` | `abstract execute(command: T, ctx: AuthContext): Promise<CommandResult>` |
| `command-bus/command-result.type.ts` | `type CommandResult` | `{ aggregateId: string; streamPosition: bigint; idempotentReplay: boolean }` |
| `command-bus/auth-context.type.ts` | `type AuthContext` | `{ userId: string; clientId: string; externalRef: Nullable<string> }` |
| `command-bus/command-policy.ts` | `abstract class CommandPolicy` | `abstract handle(command, ctx, next): Promise<CommandResult>` |
| `query-bus/query-bus.ts` | `abstract class QueryBus` | `abstract ask<TResult>(query: Query, ctx: QueryContext): Promise<TResult>` |
| `query-bus/query.ts` | `abstract class Query` | `abstract readonly queryType: string` |
| `query-bus/query-handler.ts` | `abstract class QueryHandler<T, R>` | `abstract execute(query: T, ctx: QueryContext): Promise<R>` |
| `query-bus/query-handler.ts` | `type QueryContext` | `{ readonly userId: string }` |

---

### Controller canónico — AC-4, AC-5, AC-6

**Ejemplo representativo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\accounts\infrastructure\adapters\http\accounts.controller.ts`

Patrón ya establecido:

```typescript
@ApiTags('accounts')
@Controller({ path: 'accounts', version: '1' })
@UseInterceptors(CommandResultInterceptor)
export class AccountsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: CommandAcceptedDto })
  open(@Context() ctx: LedgerContext, @ExternalRef() externalRef: Nullable<string>, @Body() dto: OpenAccountRequestDto): Promise<CommandResult> {
    const cmd = new OpenAccountCommand(dto.name, dto.currencies, dto.openedOn, dto.isBankMirror);
    return this.commandBus.dispatch(cmd, this.authContext(ctx, externalRef));
  }

  @Get()
  @ApiOkResponse({ type: AccountTreeDto })
  list(@Context() ctx: LedgerContext, ...): Promise<AccountTreeDto> {
    return this.queryBus.ask<AccountTreeDto>(new GetAccountTreeQuery(), this.queryContext(ctx));
  }
  // ...
}
```

**Puntos clave del patrón (AC-4, AC-5, AC-6):**
1. Constructor solo inyecta `CommandBus` + `QueryBus` (AC-6).
2. Escrituras: construyen un command → `commandBus.dispatch(cmd, authContext)` → retornan `Promise<CommandResult>` (AC-4, AC-5).
3. Lecturas: construyen un query → `queryBus.ask<T>(query, queryContext)` (AC-4).
4. `CommandResultInterceptor` transforma `CommandResult` → `CommandAcceptedDto` automáticamente (AC-5).
5. `@Context()` extrae `LedgerContext`; `@ExternalRef()` extrae idempotency key (AC-4).
6. Métodos privados `authContext()` / `queryContext()` ensamblan los contexts de bus desde el contexto HTTP.
7. El controller no conoce agregados, eventos, ni repositorios (AC-4).

**Controllers existentes que siguen este patrón:**

| Controller | Ruta | Archivo |
|---|---|---|
| `AccountsController` | `/api/v1/accounts` | `apps/ledger/src/accounts/infrastructure/adapters/http/accounts.controller.ts` |
| `LedgerController` | `/api/v1/ledgers` | `apps/ledger/src/accounts/infrastructure/adapters/http/ledger.controller.ts` |
| `TransactionsController` | `/api/v1/transactions` | `apps/ledger/src/transactions/infrastructure/adapters/http/transactions.controller.ts` |
| `TransferController` | `/api/v1/transfers` | `apps/ledger/src/transactions/infrastructure/adapters/http/transfer.controller.ts` |
| `ReportsController` | `/api/v1/reports` | `apps/ledger/src/reporting/infrastructure/adapters/http/reports.controller.ts` |
| `CurrenciesController` | `/api/v1/currencies` | `apps/ledger/src/reference/infrastructure/adapters/http/currencies.controller.ts` |
| `PricesController` | `/api/v1/prices` | `apps/ledger/src/reference/infrastructure/adapters/http/prices.controller.ts` |
| `BalanceAssertionController` | `/api/v1/balance-assertions` | `apps/ledger/src/reconciliation/infrastructure/adapters/http/balance-assertion.controller.ts` |
| `LedgerSettingsController` | `/api/v1/settings` | `apps/ledger/src/settings/infrastructure/adapters/http/ledger-settings.controller.ts` |

---

### Wiring test — AC-7

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\app.wiring.spec.ts`

Espejo del patrón de `apps/finances/src/app.wiring.spec.ts`:

1. Setea `process.env` con variables mínimas (`ENV`, `PORT`, `DB_URI`, etc.) antes de cualquier import.
2. Usa `require()` para `AppModule` y `DatabaseModule` (el config validator corre en load time).
3. Crea un `StubDatabaseModule` (`@Global()`) con un `dataSource` inerte (stubs `getRepository`, `createEntityManager`, etc.).
4. `Test.createTestingModule({ imports: [AppModule] }).overrideModule(DatabaseModule).useModule(StubDatabaseModule).compile()`.
5. Dos tests: "compiles the root module" y "boots the Nest application and closes it".

---

### Artefactos de referencia (apps/finances)

| Artefacto | Archivo |
|---|---|
| Swagger builder | `D:\Cristian\Nest\admin-back\apps\finances\src\config\swagger\swagger.builder.ts` |
| Swagger builder spec | `D:\Cristian\Nest\admin-back\apps\finances\src\config\swagger\swagger.builder.spec.ts` |
| Wiring test | `D:\Cristian\Nest\admin-back\apps\finances\src\app.wiring.spec.ts` |
| main.ts | `D:\Cristian\Nest\admin-back\apps\finances\src\main.ts` (sin global prefix ni versioning) |

---

### Estructura de módulos en apps/ledger/src/

```
apps/ledger/src/
├── accounts/          # Cuentas: domain + application + infrastructure/http
├── config/            # environment/, logger/, swagger/
├── database/          # TypeORM module + data-source
├── ledger/            # LedgerCoreModule (EP-1 composition root)
├── product/           # Budgets, goals
├── read-side/         # Query handlers + query bus factory
├── reconciliation/    # Balance assertions, discrepancies
├── reference/         # Currencies, prices
├── reporting/         # Net worth, expenses
├── settings/          # Timezone, presentation currency
├── shared/            # Shared domain/infrastructure (money, ports, HTTP adapters)
├── shared-kernel/     # Hexagonal kernel: domain + application + infrastructure
├── tooling/           # CLI tooling (rebuild, verify-balances)
├── transactions/      # Transactions domain + application + infrastructure/http
├── app.module.ts      # Root module
├── app.wiring.spec.ts # Wiring test
└── main.ts            # Entry point
```

### Path aliases

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\tsconfig.json`

| Alias | Resuelve a |
|---|---|
| `@shared` | `libs/shared/src/index.ts` |
| `@shared/*` | `libs/shared/src/*` |
| `@ledger/*` | `apps/ledger/src/*` |

### Dependencias relevantes

| Paquete | Versión |
|---|---|
| `@nestjs/swagger` | `^11.4.6` |
| `@nestjs/core` | `^11.1.28` |
| `@nestjs/common` | `^11.1.28` |
| `@nestjs/platform-express` | `^11.1.28` |
| `class-validator` | `^0.15.1` |
| `class-transformer` | `^0.5.1` |

---

## Gaps detectados

1. **AC-2 — Ruta de Swagger:** El AC dice `GET /api/v1/docs`, pero el código existente monta Swagger en `/docs` (sin prefijo `api` ni versión `v1`). `SwaggerModule.setup` en NestJS respeta `setGlobalPrefix` (resultando en `/api/docs`), pero no integra con `VersioningType.URI`. La ruta real es `/api/docs`, no `/api/v1/docs`.

2. **AC-5 — Campos de `CommandAcceptedDto`:** El AC menciona `{ id, sequence, streamPosition }` (tres campos), pero el DTO implementado solo tiene `{ id, streamPosition }` (dos campos). `CommandResult` define `{ aggregateId, streamPosition, idempotentReplay }` — no existe `sequence`.

3. **RNF-11 — Ubicación del código HTTP:** La regla dice que el código vive en `shared-kernel/infrastructure/adapters/http`, pero el código real está en `shared/infrastructure/adapters/http`. `shared-kernel/` contiene el núcleo hexagonal (domain + application ports + infra de event-store), mientras que `shared/` contiene código de dominio compartido más los adaptadores HTTP. Son dos capas distintas.

4. **Estado general de la HU-0009:** La mayoría de los AC ya están implementados en el código base actual (main.ts con versioning + swagger, swagger builder con esquemas de seguridad, patrón canónico de controller → bus, CommandAcceptedDto, wiring test). La HU podría requerir principalmente refinamiento de ACs existentes más que implementación desde cero.
