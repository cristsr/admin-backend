# context: hu-0010

## Historia resumida

**Como** operador del ledger (`apps/ledger`)
**Quiero** que toda petición exija y resuelva un contexto autenticado `(user_id, client_id)`
provisto por infraestructura externa, inyectado de forma declarativa en los controllers
**Para** garantizar que ninguna operación de negocio se ejecute sin un dueño de ledger y una
procedencia identificados (RF-26), particionando todo por `user_id` (INV-9) sin que el ledger
administre identidad

---

## Microservicios afectados

- `apps/ledger`

---

## apps/ledger

### Dominio: `LedgerContext` y `LedgerContextResolver`

**LedgerContext** — `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\domain\context\ledger-context.ts`

```typescript
export interface LedgerContext {
  readonly userId: string;
  readonly clientId: string;
}
```

**LedgerContextResolver (puerto)** — `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\application\ports\ledger-context-resolver.ts`

```typescript
export abstract class LedgerContextResolver {
  abstract resolve(headers: RequestHeaders): Nullable<LedgerContext>;
}
```

- El puerto es una `abstract class` (token de inyección NestJS).
- `RequestHeaders = Record<string, string | string[] | undefined>` — independiente de HTTP framework.
- Devuelve `null` cuando el contexto está ausente o malformado.

---

### Infraestructura HTTP: adaptadores en `shared/infrastructure/adapters/http/`

**Directorio:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\infrastructure\adapters\http\`

Todos los artefactos de hu-0010 YA existen y están cableados:

| Archivo | Clase/Export | Rol | AC |
|---|---|---|---|
| `ledger-context.guard.ts` | `LedgerContextGuard implements CanActivate` | APP_GUARD global: resuelve contexto, adjunta a request, 401 si ausente, bypass `@Public()` | AC-1, AC-2, AC-3, AC-5 |
| `ledger-context.guard.spec.ts` | — | 3 tests: attach context, reject 401, bypass @Public() | — |
| `context.decorator.ts` | `Context` (param decorator), `extractContext()` | Inyecta `LedgerContext` en handlers | AC-4 |
| `context-carrying-request.ts` | `ContextCarryingRequest extends Request` | Request con `ledgerContext?: LedgerContext` | — |
| `external-ref.decorator.ts` | `ExternalRef`, `extractExternalRef()`, `EXTERNAL_REF_HEADER` | Extrae `x-external-ref` header (o body `external_ref`) | — |
| `external-ref.decorator.spec.ts` | — | 4 tests: header, body fallback, header preference, null | — |
| `command-result.interceptor.ts` | `CommandResultInterceptor` | Transforma `CommandResult` → `CommandAcceptedDto`, header `X-Ledger-Stream-Position` | — |
| `command-result.interceptor.spec.ts` | — | 4 tests: mapping, idempotent downgrade, no leak, pass-through | — |
| `resolvers/gateway-header-context.resolver.ts` | `GatewayHeaderContextResolver extends LedgerContextResolver` | Resuelve `{ userId, clientId }` desde headers `x-user-id`/`x-client-id` | AC-7 |
| `resolvers/gateway-header-context.resolver.spec.ts` | — | 5 tests: resolve ok, user missing, client missing, array reject, blank reject | — |
| `dto/command-accepted.dto.ts` | `CommandAcceptedDto` | `{ id: string, streamPosition: string }` + `static from()` | — |
| `shared-http.module.ts` | `SharedHttpModule` (@Global) | Cablea `LedgerContextResolver → GatewayHeaderContextResolver`, `APP_GUARD → LedgerContextGuard`, `CommandResultInterceptor` | AC-7 |
| `index.ts` | Barrel | Re-exporta todos los exports públicos | — |

**Detalle del binding en `SharedHttpModule`:**

```typescript
@Global()
@Module({
  providers: [
    { provide: LedgerContextResolver, useClass: GatewayHeaderContextResolver },  // AC-7
    { provide: APP_GUARD, useClass: LedgerContextGuard },                       // AC-5
    CommandResultInterceptor,
  ],
  exports: [LedgerContextResolver, CommandResultInterceptor],
})
export class SharedHttpModule {}
```

---

### Guard: `LedgerContextGuard`

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\infrastructure\adapters\http\ledger-context.guard.ts`

Flujo (AC-1, AC-2, AC-3, AC-5):
1. Verifica `IS_PUBLIC` metadata vía `Reflector` → si `@Public()`, bypass.
2. Llama `resolver.resolve(request.headers)`.
3. Si `null` → `throw new UnauthorizedException('Missing or invalid authenticated context')` → 401.
4. Si válido → `request.ledgerContext = context` → continúa al controller.

Constructor: `Reflector` + `LedgerContextResolver` (inyectados).

---

### Resolver: `GatewayHeaderContextResolver`

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\infrastructure\adapters\http\resolvers\gateway-header-context.resolver.ts`

- Lee headers: `x-user-id` y `x-client-id` (constantes `GATEWAY_CONTEXT_HEADER`).
- `resolve(headers)`: extrae cada header como `string` única (rechaza arrays, blanks).
- Ambos presentes → `{ userId, clientId }`. Cualquiera ausente/malformado → `null`.

---

### Decoradores

**`@Context()`** — `context.decorator.ts`
- `createParamDecorator` que lee `request.ledgerContext` (adjuntado por el guard).
- El controller nunca sabe cómo se resolvió (AC-4).

**`@ExternalRef()`** — `external-ref.decorator.ts`
- Lee header `x-external-ref` (preferido) o body `external_ref` (fallback).
- Retorna `string | null`.

---

### Policy de contexto autenticado (nivel command bus)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\command-bus\policies\authenticated-context.policy.ts`

- `AuthenticatedContextPolicy extends CommandPolicy`
- Valida `ctx.userId` y `ctx.clientId` no vacíos antes de delegar al handler.
- Lanza `MissingAuthContextException` (código `MISSING_AUTH_CONTEXT`, extiende `DomainUnprocessableException`).

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\command-bus\policies\authenticated-context.policy.spec.ts`
- 4 tests: reject empty userId, reject empty clientId, reject null ctx, delegate on valid ctx.

---

### `AuthContext` (tipo de aplicación)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\command-bus\auth-context.type.ts`

```typescript
export type AuthContext = {
  readonly userId: string;
  readonly clientId: string;
  readonly externalRef: Nullable<string>;
};
```

Usado por todos los controllers como argumento de `commandBus.dispatch(command, authContext)`.

---

### Controllers que usan el patrón (ya migrados)

| Controller | Archivo | Usa |
|---|---|---|
| `AccountsController` | `apps/ledger/src/accounts/infrastructure/adapters/http/accounts.controller.ts` | `@Context()`, `@ExternalRef()`, `CommandResultInterceptor` |
| `LedgerController` | `apps/ledger/src/accounts/infrastructure/adapters/http/ledger.controller.ts` | `@Context()`, `@ExternalRef()`, `CommandResultInterceptor` |
| `TransactionsController` | `apps/ledger/src/transactions/infrastructure/adapters/http/transactions.controller.ts` | `@Context()`, `@ExternalRef()`, `CommandResultInterceptor` |
| `TransferController` | `apps/ledger/src/transactions/infrastructure/adapters/http/transfer.controller.ts` | `@Context()`, `@ExternalRef()`, `CommandResultInterceptor` |
| `BalanceAssertionController` | `apps/ledger/src/reconciliation/infrastructure/adapters/http/balance-assertion.controller.ts` | `@Context()`, `CommandResultInterceptor` |

### Controllers sin migrar (usan `@CurrentUser()` + paths legacy)

| Controller | Archivo | Estado |
|---|---|---|
| `ReportsController` | `apps/ledger/src/reporting/.../reports.controller.ts` | Módulo no importado en AppModule |
| `CurrenciesController` | `apps/ledger/src/reference/.../currencies.controller.ts` | Módulo no importado en AppModule |
| `PricesController` | `apps/ledger/src/reference/.../prices.controller.ts` | Módulo no importado en AppModule |
| `LedgerSettingsController` | `apps/ledger/src/settings/.../ledger-settings.controller.ts` | Handlers/controller removidos de SettingsModule |

---

### `@Public()` — libs/shared

**Archivo:** `D:\Cristian\Nest\admin-back\libs\shared\src\decorators\public.decorator.ts`

```typescript
export const Public = () => SetMetadata(IS_PUBLIC, true);
```

- `IS_PUBLIC = 'IS_PUBLIC'` (constante en `libs/shared/src/constants/`).
- El `LedgerContextGuard` lee esta metadata y hace bypass.
- **Actualmente ningún endpoint en el ledger usa `@Public()`.** El mecanismo está listo pero no hay endpoints públicos registrados.

---

### `@CurrentUser()` — libs/shared (NO usado por el ledger)

**Archivo:** `D:\Cristian\Nest\admin-back\libs\shared\src\decorators\current-user.decorator.ts`

- Lee `request.user` (inyectado por Passport) — **NO** `request.ledgerContext`.
- Usado por `apps/finances` (monolito legacy), no por `apps/ledger`.
- El ledger usa `@Context()` (definido en `shared/infrastructure/adapters/http/context.decorator.ts`).

---

### `JwtAuthGuard` — libs/shared (NO usado por el ledger)

**Archivo:** `D:\Cristian\Nest\admin-back\libs\shared\src\auth\guards\jwt-auth.guard.ts`

- `extends AuthGuard('jwt')` de `@nestjs/passport`.
- Usa `@Public()` bypass vía `Reflector`.
- Usado por `apps/finances` (monolito legacy), no por `apps/ledger`.
- El ledger usa `LedgerContextGuard` (propio, sin dependencia de Passport/OIDC).

---

### Artefactos de referencia en `libs/shared`

| Archivo | Uso en ledger |
|---|---|
| `decorators/public.decorator.ts` | Reutilizado — `IS_PUBLIC` es leído por `LedgerContextGuard` |
| `decorators/current-user.decorator.ts` | NO usado — el ledger tiene `@Context()` propio |
| `functions/extract-user-from-context.ts` | NO usado — lee `request.user` de Passport |
| `auth/guards/jwt-auth.guard.ts` | NO usado — el ledger tiene `LedgerContextGuard` propio |
| `auth/auth.module.ts` | NO usado — solo finances |

---

### Documentación existente del módulo shared

**Directorio:** `D:\Cristian\Nest\admin-back\apps\ledger\docs\shared\`

Creado por hu-0009, ya incluye referencias a los componentes de hu-0010:
- `README.md`: `LedgerContextResolver`, `LedgerContextGuard`, `AuthContext`, `QueryContext` documentados en lenguaje ubicuo.
- `shared.c4`: `LedgerContextGuard`, `LedgerContextResolver`, `GatewayHeaderContextResolver` como componentes del modelo.
- `flows/command-dispatch.md`: documenta 401 del guard y flujo de contexto.
- `flows/query-dispatch.md`: documenta 401 + `QueryContext { userId }`.

---

### e2e tests existentes

| Archivo | Cobertura |
|---|---|
| `ledger-context.guard.spec.ts` | Unit test: attach, reject 401, bypass @Public() ✅ |
| `gateway-header-context.resolver.spec.ts` | Unit test: resolve, missing headers, arrays, blanks ✅ |
| `authenticated-context.policy.spec.ts` | Unit test: reject empty, delegate valid ✅ |
| `command-result.interceptor.spec.ts` | Unit test: mapping, idempotent, no leak ✅ |
| `external-ref.decorator.spec.ts` | Unit test: header, body fallback, preference, null ✅ |
| `accounts-api.e2e-spec.ts` | **ROTO** — `PostgresReadModelStore` no resuelve `DataSource` |
| `transactions-api.e2e-spec.ts` | **ROTO** — misma causa |

---

## Gaps detectados

1. **AC-8 (e2e de contexto ausente) sin implementar:** No existe un test que envíe `POST /api/v1/accounts` sin headers `x-user-id`/`x-client-id` y verifique 401. Los e2e existentes (`accounts-api.e2e-spec.ts`, `transactions-api.e2e-spec.ts`) están rotos por dependencia de `DataSource` y no cubren este caso.

2. **Paths en "artefactos a crear" desactualizados:** La HU lista `shared-kernel/infrastructure/adapters/http/` pero el código real vive en `shared/infrastructure/adapters/http/` (mismo gap que hu-0009). Todos los archivos listados YA existen.

3. **`@Public()` sin uso:** El guard soporta bypass vía `@Public()` pero ningún endpoint en el ledger lo usa actualmente. Si se necesita un health check público, no está implementado.

4. **Sin `shared-http.module.spec.ts`:** No hay test de wiring específico para el módulo HTTP (aunque el `app.wiring.spec.ts` general sí lo cubre indirectamente).

5. **JWT resolver alternativo no existe:** El Technical Context menciona `resolvers/jwt-context.resolver.ts` como alternativa, pero no está implementado (la HU lo menciona como "esbozado, no cableado como default").

6. **Estado general:** La mayoría de los ACs ya están implementados — el guard, resolver, decoradores y binding existen con sus tests unitarios. La HU requiere principalmente el e2e test de AC-8 y posiblemente refinar paths/documentación.
